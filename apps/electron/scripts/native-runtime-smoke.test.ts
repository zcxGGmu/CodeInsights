import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  buildNativeSearchPackageManifest,
  getNativeSearchOptionalPackagePlan,
} from '../src/main/lib/native-runtime/native-runtime-package-manifest'
import {
  buildNativeRuntimeSmokeSummary,
  parseNativeRuntimeSmokeArgs,
  runNativeRuntimeSmoke,
} from './native-runtime-smoke'

const originalNativeSearchBinary = process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY

afterEach(() => {
  if (originalNativeSearchBinary == null) {
    delete process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY
  } else {
    process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY = originalNativeSearchBinary
  }
})

describe('native-runtime-smoke', () => {
  test('parseNativeRuntimeSmokeArgs 支持 smoke mode 与显式 binary', () => {
    const options = parseNativeRuntimeSmokeArgs([
      '--mode',
      'native-available',
      '--native-search-binary',
      '/tmp/native-search',
      '--query',
      '关键字',
    ])

    expect(options).toEqual({
      mode: 'native-available',
      nativeSearchBinary: '/tmp/native-search',
      query: '关键字',
    })
  })

  test('parseNativeRuntimeSmokeArgs 支持 packaged app node_modules root', () => {
    const options = parseNativeRuntimeSmokeArgs([
      '--mode',
      'packaged-app-layout',
      '--app-node-modules-root',
      '/Applications/CodeInsights.app/Contents/Resources/app.asar.unpacked/node_modules',
    ])

    expect(options).toEqual({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app.asar.unpacked/node_modules',
      query: '关键字',
    })
  })

  test('summary 不泄露 binary path 或 home path', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'native-available',
      nativeSearchBinary: '/Users/demo/native-search',
      appNodeModulesRoot: '/Users/demo/CodeInsights.app/Contents/Resources/app.asar.unpacked/node_modules',
      verification: {
        requiresPrebuiltPackagedApp: true,
        realPackagedBinaryVerified: false,
      },
      cases: [{
        name: 'native-available',
        status: 'passed',
        detail: '/Users/demo/native-search is ready',
      }],
    })

    const serialized = JSON.stringify(summary)
    expect(summary.nativeSearchBinaryProvided).toBe(true)
    expect(summary.appNodeModulesRootProvided).toBe(true)
    expect(summary.requiresPrebuiltPackagedApp).toBe(true)
    expect(summary.packagedAppLayoutVerified).toBe(false)
    expect(summary.packagedAppEvidenceVerified).toBe(false)
    expect(summary.packagedAppIdentityVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(serialized).not.toContain('/Users/demo/native-search')
    expect(serialized).not.toContain('CodeInsights.app')
    expect(serialized).toContain('[home]/native-search')
  })

  test('env binary 属于显式 opt-in，summary 仍脱敏路径', () => {
    process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY = '/Users/demo/native-search'
    const options = parseNativeRuntimeSmokeArgs(['--mode', 'native-available'])
    const summary = buildNativeRuntimeSmokeSummary({
      mode: options.mode,
      nativeSearchBinary: options.nativeSearchBinary,
      cases: [{
        name: 'native-available',
        status: 'skipped',
        detail: options.nativeSearchBinary,
      }],
    })

    expect(options.nativeSearchBinary).toBe('/Users/demo/native-search')
    expect(summary.nativeSearchBinaryProvided).toBe(true)
    expect(JSON.stringify(summary)).not.toContain('/Users/demo/native-search')
  })

  test('未显式提供 binary 时 native available smoke 标记 skipped，不从 PATH 查找', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'native-available',
      query: '关键字',
      env: {
        PATH: join('/tmp', 'fake-native-path'),
      },
    })

    expect(summary.mode).toBe('native-available')
    expect(summary.nativeSearchBinaryProvided).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'native-available',
      status: 'skipped',
    }))
  })

  test('native missing smoke 证明 missing_binary fallback 且 TS fallback 可用', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'native-missing',
      nativeSearchBinary: join('/tmp', 'missing-codeinsights-native-search'),
      query: '关键字',
    })

    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'native-missing',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).not.toContain('/tmp/missing-codeinsights-native-search')
  })

  test('packaged app layout smoke 未提供 packaged root 时 skipped，不证明真实 bundled binary', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'packaged-app-layout',
      query: '关键字',
    })

    expect(summary.mode).toBe('packaged-app-layout')
    expect(summary.appNodeModulesRootProvided).toBe(false)
    expect(summary.requiresPrebuiltPackagedApp).toBe(true)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.packagedAppLayoutVerified).toBe(false)
    expect(summary.packagedAppEvidenceVerified).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'packaged-app-layout',
      status: 'skipped',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('requiresPrebuiltPackagedApp=true')
    expect(JSON.stringify(summary)).toContain('realPackagedBinaryVerified=false')
    expect(JSON.stringify(summary)).not.toContain('/codeinsights-native-runtime-smoke-')
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
  })

  test('packaged app layout smoke 使用显式 asar.unpacked packaged root 验证 bundled package 布局', async () => {
    const fixture = createPackagedAppLayoutFixture('asar-unpacked')
    try {
      const summary = await runNativeRuntimeSmoke({
        mode: 'packaged-app-layout',
        query: '关键字',
        appNodeModulesRoot: fixture.nodeModulesRoot,
      })

      expect(summary.mode).toBe('packaged-app-layout')
      expect(summary.appNodeModulesRootProvided).toBe(true)
      expect(summary.requiresPrebuiltPackagedApp).toBe(true)
      expect(summary.bundledBinaryVerified).toBe(false)
      expect(summary.packagedAppLayoutVerified).toBe(true)
      expect(summary.packagedAppEvidenceVerified).toBe(true)
      expect(summary.packagedAppIdentityVerified).toBe(false)
      expect(summary.realPackagedBinaryVerified).toBe(false)
      expect(summary.fixtureBundledPackageVerified).toBe(false)
      expect(summary.usesTemporaryFixture).toBe(true)
      expect(summary.cases).toContainEqual(expect.objectContaining({
        name: 'packaged-app-layout',
        status: 'passed',
      }))
      expect(JSON.stringify(summary)).toContain('packagedAppLayoutVerified=true')
      expect(JSON.stringify(summary)).toContain('packagedAppEvidence=asar-unpacked')
      expect(JSON.stringify(summary)).toContain('realPackagedBinaryVerified=false')
      expect(JSON.stringify(summary)).not.toContain(fixture.rootDir)
      expect(JSON.stringify(summary)).not.toContain('binaryPath')
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app layout smoke 支持 asar false 的 app/node_modules 证据布局', async () => {
    const fixture = createPackagedAppLayoutFixture('unpacked-app')
    try {
      const summary = await runNativeRuntimeSmoke({
        mode: 'packaged-app-layout',
        query: '关键字',
        appNodeModulesRoot: fixture.nodeModulesRoot,
      })

      expect(summary.mode).toBe('packaged-app-layout')
      expect(summary.appNodeModulesRootProvided).toBe(true)
      expect(summary.requiresPrebuiltPackagedApp).toBe(true)
      expect(summary.bundledBinaryVerified).toBe(false)
      expect(summary.packagedAppLayoutVerified).toBe(true)
      expect(summary.packagedAppEvidenceVerified).toBe(true)
      expect(summary.packagedAppIdentityVerified).toBe(true)
      expect(summary.realPackagedBinaryVerified).toBe(false)
      expect(summary.usesTemporaryFixture).toBe(true)
      expect(summary.cases).toContainEqual(expect.objectContaining({
        name: 'packaged-app-layout',
        status: 'passed',
      }))
      expect(JSON.stringify(summary)).toContain('packagedAppEvidence=unpacked-app')
      expect(JSON.stringify(summary)).toContain('packagedAppIdentityVerified=true')
      expect(JSON.stringify(summary)).toContain('realPackagedBinaryVerified=false')
      expect(JSON.stringify(summary)).not.toContain(fixture.rootDir)
      expect(JSON.stringify(summary)).not.toContain('binaryPath')
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app layout smoke 不把缺失 CodeInsights identity 的 app/node_modules 标成真实 packaged binary', async () => {
    const fixture = createPackagedAppLayoutFixture('unpacked-app', {
      appPackagePatch: { name: '@demo/not-codeinsights' },
    })
    try {
      const summary = await runNativeRuntimeSmoke({
        mode: 'packaged-app-layout',
        query: '关键字',
        appNodeModulesRoot: fixture.nodeModulesRoot,
      })

      expect(summary.packagedAppLayoutVerified).toBe(true)
      expect(summary.packagedAppEvidenceVerified).toBe(true)
      expect(summary.packagedAppIdentityVerified).toBe(false)
      expect(summary.realPackagedBinaryVerified).toBe(false)
      expect(summary.bundledBinaryVerified).toBe(false)
      expect(JSON.stringify(summary)).toContain('packagedAppIdentityVerified=false')
      expect(JSON.stringify(summary)).not.toContain(fixture.rootDir)
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app layout smoke 失败路径只输出 reason code，不泄露 root', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-packaged-layout-empty-'))
    const nodeModulesRoot = join(rootDir, 'app.asar.unpacked', 'node_modules')
    mkdirSync(nodeModulesRoot, { recursive: true })

    try {
      const summary = await runNativeRuntimeSmoke({
        mode: 'packaged-app-layout',
        query: '关键字',
        appNodeModulesRoot: nodeModulesRoot,
      })

      const serialized = JSON.stringify(summary)
      expect(summary.appNodeModulesRootProvided).toBe(true)
      expect(summary.packagedAppLayoutVerified).toBe(false)
      expect(summary.realPackagedBinaryVerified).toBe(false)
      expect(summary.cases).toContainEqual(expect.objectContaining({
        name: 'packaged-app-layout',
        status: 'failed',
      }))
      expect(serialized).toContain('reason=manifest_missing')
      expect(serialized).not.toContain(rootDir)
      expect(serialized).not.toContain('app.asar.unpacked')
      expect(serialized).not.toContain('bin/codeinsights-native-search')
      expect(serialized).not.toContain('binaryPath')
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('protocol mismatch smoke 使用 fake sidecar 验证 version_mismatch fallback', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'protocol-mismatch',
      query: '关键字',
    })

    expect(summary.nativeSearchBinaryProvided).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'protocol-mismatch',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('fallbackReason=version_mismatch')
    expect(JSON.stringify(summary)).not.toContain('/Users/')
  })

  test('crash smoke 使用 fake sidecar 验证 crashed fallback', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'crash',
      query: '关键字',
    })

    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'crash',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('fallbackReason=crashed')
    expect(JSON.stringify(summary)).not.toContain('secret-token')
  })

  test('timeout smoke 使用 fake sidecar 验证 timeout fallback 且清理 pending', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'timeout',
      query: '关键字',
    })

    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'timeout',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('fallbackReason=timeout')
  })

  test('cache corruption smoke 使用隔离 config dir 验证 cache_corrupted 且不读取真实缓存', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'cache-corruption',
      query: '关键字',
    })

    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'cache-corruption',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('fallbackReason=cache_corrupted')
    expect(JSON.stringify(summary)).not.toContain('/codeinsights-native-runtime-smoke-')
  })

  test('packaged manifest smoke 只验证 optional package manifest 预检，不证明 bundled binary', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'packaged-manifest',
      query: '关键字',
    })

    expect(summary.mode).toBe('packaged-manifest')
    expect(summary.nativeSearchBinaryProvided).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'packaged-manifest-preflight',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'packaged-resolver-fixture',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('bundledBinaryVerified=false')
    expect(JSON.stringify(summary)).toContain('fixtureBundledPackageVerified=true')
    expect(JSON.stringify(summary)).toContain('realPackagedBinaryVerified=false')
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.fixtureBundledPackageVerified).toBe(true)
    expect(summary.usesTemporaryFixture).toBe(true)
    expect(summary.packagedAppLayoutVerified).toBe(false)
    expect(summary.packagedAppEvidenceVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(JSON.stringify(summary)).not.toContain('/Users/')
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
    expect(JSON.stringify(summary)).not.toContain('/codeinsights-native-runtime-smoke-')
  })
})

function createPackagedAppLayoutFixture(
  layout: 'asar-unpacked' | 'unpacked-app',
  options: {
    appPackagePatch?: Record<string, unknown>
  } = {},
): {
  rootDir: string
  nodeModulesRoot: string
} {
  const plan = getNativeSearchOptionalPackagePlan()
  if (!plan) throw new Error('当前平台缺少 native search optional package plan')

  const rootDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-packaged-layout-test-'))
  const appRoot = layout === 'asar-unpacked'
    ? join(rootDir, 'app.asar.unpacked')
    : join(rootDir, 'CodeInsights.app', 'Contents', 'Resources', 'app')
  const nodeModulesRoot = join(appRoot, 'node_modules')
  const packageRoot = join(nodeModulesRoot, ...plan.packageName.split('/'))
  const binaryPath = join(packageRoot, 'bin', plan.binaryName)
  const binaryContent = '#!/bin/sh\necho codeinsights native packaged layout\n'
  const binarySha256 = createHash('sha256').update(binaryContent).digest('hex')
  const manifest = buildNativeSearchPackageManifest({
    plan,
    packageVersion: '0.0.2',
    binarySha256,
  })

  mkdirSync(dirname(binaryPath), { recursive: true })
  if (layout === 'asar-unpacked') {
    writeFileSync(join(rootDir, 'app.asar'), 'asar placeholder\n', 'utf-8')
  } else {
    writeFileSync(join(appRoot, 'package.json'), `${JSON.stringify({
      name: '@codeinsights/electron',
      version: '0.0.144',
      main: 'dist/main.cjs',
      ...(options.appPackagePatch ?? {}),
    }, null, 2)}\n`, 'utf-8')
  }
  writeFileSync(join(packageRoot, 'package.json'), `${JSON.stringify({
    name: plan.packageName,
    version: '0.0.2',
  }, null, 2)}\n`, 'utf-8')
  writeFileSync(join(packageRoot, 'native-search-package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  writeFileSync(binaryPath, binaryContent, 'utf-8')
  chmodSync(binaryPath, 0o755)

  return { rootDir, nodeModulesRoot }
}
