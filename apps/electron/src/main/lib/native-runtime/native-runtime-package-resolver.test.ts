import { chmod, mkdir, unlink, writeFile } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  applyNativeSearchAsarUnpackedPath,
  NativeSearchPackageResolutionError,
  resolveNativeSearchPackage,
  tryResolveNativeSearchPackage,
} from './native-runtime-package-resolver'
import {
  buildNativeSearchPackageManifest,
  getNativeSearchOptionalPackagePlan,
} from './native-runtime-package-manifest'

interface FixturePackageOptions {
  platform?: NodeJS.Platform
  arch?: NodeJS.Architecture
  packageVersion?: string
  binaryName?: string
  manifestPatch?: Record<string, unknown>
  binaryContent?: string
  writeBinary?: boolean
  chmodBinary?: boolean
}

const DEFAULT_PLATFORM: NodeJS.Platform = 'darwin'
const DEFAULT_ARCH: NodeJS.Architecture = 'arm64'

describe('native-runtime-package-resolver', () => {
  test('解析 optional package fixture 并校验 manifest 与 binary SHA-256', async () => {
    const fixture = await createFixturePackage()

    const resolved = resolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      isPackaged: true,
      appNodeModulesRoot: fixture.nodeModulesRoot,
      moduleResolve: fixture.moduleResolve,
    })

    expect(resolved).toEqual({
      binaryPath: fixture.binaryPath,
      source: 'bundled',
      packageName: '@codeinsights/native-search-darwin-arm64',
      packageVersion: '0.0.2',
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      binaryName: 'codeinsights-native-search',
      binarySha256: fixture.binarySha256,
    })
  })

  test('packaged 路径只做 asar.unpacked 转换，不引入 PATH fallback', async () => {
    const fixture = await createFixturePackage()
    const pathDecoy = join(dirname(fixture.rootDir), 'path-decoy', 'codeinsights-native-search')
    await mkdir(dirname(pathDecoy), { recursive: true })
    await writeFile(pathDecoy, '#!/bin/sh\necho decoy\n', 'utf-8')
    await chmod(pathDecoy, 0o755)

    expect(applyNativeSearchAsarUnpackedPath('/App.app/Contents/Resources/app.asar/node_modules/pkg/bin/native', true))
      .toBe('/App.app/Contents/Resources/app.asar.unpacked/node_modules/pkg/bin/native')

    const resolved = resolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      isPackaged: true,
      appNodeModulesRoot: fixture.nodeModulesRoot,
      moduleResolve: fixture.moduleResolve,
    })

    expect(resolved.binaryPath).toBe(fixture.binaryPath)
    expect(resolved.binaryPath).not.toBe(pathDecoy)
  })

  test('manifest 含 path-like 字段、平台不匹配或 checksum 不匹配时拒绝', async () => {
    const withPath = await createFixturePackage({
      manifestPatch: { binaryPath: '/Users/demo/codeinsights-native-search' },
    })
    const wrongPlatform = await createFixturePackage({
      manifestPatch: { platform: 'win32' },
    })
    const wrongChecksum = await createFixturePackage({
      manifestPatch: { binarySha256: 'f'.repeat(64) },
    })

    expect(() => resolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: withPath.nodeModulesRoot,
      moduleResolve: withPath.moduleResolve,
    })).toThrow(NativeSearchPackageResolutionError)
    expect(tryResolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: withPath.nodeModulesRoot,
      moduleResolve: withPath.moduleResolve,
    })).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'manifest_invalid' }),
    }))

    expect(tryResolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: wrongPlatform.nodeModulesRoot,
      moduleResolve: wrongPlatform.moduleResolve,
    })).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'manifest_invalid' }),
    }))

    expect(tryResolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: wrongChecksum.nodeModulesRoot,
      moduleResolve: wrongChecksum.moduleResolve,
    })).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'checksum_mismatch' }),
    }))
  })

  test('缺失 package、manifest 或 binary 时只返回脱敏 reason', async () => {
    const missingManifest = await createFixturePackage()
    const invalidManifest = await createFixturePackage()
    const missingBinary = await createFixturePackage({ writeBinary: false })

    const missingPackage = tryResolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: join(tmpdir(), 'codeinsights-native-missing-node-modules'),
      moduleResolve: () => {
        throw new Error('/Users/demo/node_modules missing')
      },
    })
    expect(missingPackage).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'package_missing' }),
    }))
    expect(JSON.stringify(missingPackage)).not.toContain('/Users/demo')

    await unlink(missingManifest.manifestPath)
    const manifestResult = tryResolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: missingManifest.nodeModulesRoot,
      moduleResolve: missingManifest.moduleResolve,
    })
    expect(manifestResult).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'manifest_missing' }),
    }))
    expect(JSON.stringify(manifestResult)).not.toContain(missingManifest.rootDir)

    await writeFile(invalidManifest.manifestPath, '{broken', 'utf-8')
    const invalidManifestResult = tryResolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: invalidManifest.nodeModulesRoot,
      moduleResolve: invalidManifest.moduleResolve,
    })
    expect(invalidManifestResult).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'manifest_invalid' }),
    }))
    expect(JSON.stringify(invalidManifestResult)).not.toContain(invalidManifest.rootDir)

    const binaryResult = tryResolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: missingBinary.nodeModulesRoot,
      moduleResolve: missingBinary.moduleResolve,
    })
    expect(binaryResult).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'binary_missing' }),
    }))
    expect(JSON.stringify(binaryResult)).not.toContain(missingBinary.rootDir)
  })

  test('非 Windows 平台 binary 不可执行时拒绝解析', async () => {
    if (process.platform === 'win32') return

    const notExecutable = await createFixturePackage({ chmodBinary: false })

    expect(tryResolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: notExecutable.nodeModulesRoot,
      moduleResolve: notExecutable.moduleResolve,
    })).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'binary_not_executable' }),
    }))
  })

  test('不支持的平台不会解析 package', () => {
    const result = tryResolveNativeSearchPackage({
      platform: 'freebsd' as NodeJS.Platform,
      arch: 'x64',
      moduleResolve: () => {
        throw new Error('resolver should not be called')
      },
    })

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'unsupported_platform' }),
    }))
  })

  test('拒绝解析到 app node_modules allowlist 外的同名 package', async () => {
    const allowed = await createFixturePackage()
    const outside = await createFixturePackage()

    const result = tryResolveNativeSearchPackage({
      platform: DEFAULT_PLATFORM,
      arch: DEFAULT_ARCH,
      appNodeModulesRoot: allowed.nodeModulesRoot,
      moduleResolve: outside.moduleResolve,
    })

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: 'package_missing' }),
    }))
    expect(JSON.stringify(result)).not.toContain(outside.rootDir)
  })
})

async function createFixturePackage(options: FixturePackageOptions = {}) {
  const platform = options.platform ?? DEFAULT_PLATFORM
  const arch = options.arch ?? DEFAULT_ARCH
  const plan = getNativeSearchOptionalPackagePlan(platform, arch)
  if (!plan) throw new Error(`missing fixture plan for ${platform}/${arch}`)

  const packageVersion = options.packageVersion ?? '0.0.2'
  const rootDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-package-resolver-'))
  const nodeModulesRoot = join(rootDir, 'node_modules')
  const packageRoot = join(nodeModulesRoot, ...plan.packageName.split('/'))
  const binaryName = options.binaryName ?? plan.binaryName
  const binaryPath = join(packageRoot, 'bin', binaryName)
  const packageJsonPath = join(packageRoot, 'package.json')
  const manifestPath = join(packageRoot, 'native-search-package.json')
  const binaryContent = options.binaryContent ?? '#!/bin/sh\necho native-search-fixture\n'
  const binarySha256 = createHash('sha256').update(binaryContent).digest('hex')
  const manifest = {
    ...buildNativeSearchPackageManifest({
      plan,
      packageVersion,
      binarySha256,
    }),
    binaryName,
    ...(options.manifestPatch ?? {}),
  }

  await mkdir(dirname(binaryPath), { recursive: true })
  await writeFile(packageJsonPath, `${JSON.stringify({
    name: plan.packageName,
    version: packageVersion,
  }, null, 2)}\n`, 'utf-8')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  if (options.writeBinary ?? true) {
    await writeFile(binaryPath, binaryContent, 'utf-8')
    if (options.chmodBinary ?? true) await chmod(binaryPath, 0o755)
  }

  return {
    rootDir,
    nodeModulesRoot,
    packageRoot,
    packageJsonPath,
    manifestPath,
    binaryPath,
    binarySha256,
    moduleResolve: (specifier: string) => {
      if (specifier === `${plan.packageName}/package.json`) return packageJsonPath
      throw new Error(`missing ${specifier}`)
    },
  }
}
