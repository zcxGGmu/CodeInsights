import { createHash } from 'node:crypto'
import { accessSync, constants, existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { redactNativeRuntimeText } from './native-runtime-diagnostics'
import {
  getNativeSearchOptionalPackagePlan,
  isNativeSearchPackageManifest,
  type NativeSearchPackageManifest,
} from './native-runtime-package-manifest'

export type NativeSearchPackageResolutionErrorCode =
  | 'unsupported_platform'
  | 'package_missing'
  | 'manifest_missing'
  | 'manifest_invalid'
  | 'binary_missing'
  | 'binary_not_executable'
  | 'checksum_mismatch'

export interface ResolvedNativeSearchPackage {
  binaryPath: string
  source: 'bundled'
  packageName: string
  packageVersion: string
  platform: NodeJS.Platform
  arch: NodeJS.Architecture
  binaryName: string
  binarySha256: string
}

export interface NativeSearchPackageResolutionFailure {
  code: NativeSearchPackageResolutionErrorCode
  message: string
  packageName?: string
}

export type NativeSearchPackageResolutionResult =
  | { ok: true; package: ResolvedNativeSearchPackage }
  | { ok: false; error: NativeSearchPackageResolutionFailure }

export interface ResolveNativeSearchPackageOptions {
  platform?: NodeJS.Platform
  arch?: NodeJS.Architecture
  isPackaged?: boolean
  appNodeModulesRoot?: string
  moduleResolve?: (specifier: string) => string
}

const NATIVE_SEARCH_PACKAGE_MANIFEST_FILE = 'native-search-package.json'
const NATIVE_SEARCH_PACKAGE_BINARY_DIR = 'bin'

export class NativeSearchPackageResolutionError extends Error {
  readonly code: NativeSearchPackageResolutionErrorCode
  readonly packageName?: string

  constructor(
    code: NativeSearchPackageResolutionErrorCode,
    message: string,
    packageName?: string,
  ) {
    super(redactNativeRuntimeText(message))
    this.name = 'NativeSearchPackageResolutionError'
    this.code = code
    this.packageName = packageName
  }
}

export function resolveNativeSearchPackage(
  options: ResolveNativeSearchPackageOptions = {},
): ResolvedNativeSearchPackage {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const plan = getNativeSearchOptionalPackagePlan(platform, arch)

  if (!plan) {
    throw new NativeSearchPackageResolutionError(
      'unsupported_platform',
      `当前平台暂未提供 native search optional package: ${platform}/${arch}`,
    )
  }

  const moduleResolve = options.moduleResolve ?? createDefaultModuleResolve()
  const appNodeModulesRoot = options.appNodeModulesRoot ?? getDefaultAppNodeModulesRoot()
  const packageJsonPath = resolvePackageJson(moduleResolve, plan.packageName)
  validatePathInsideAppNodeModules(packageJsonPath, appNodeModulesRoot, plan.packageName)
  const packageRoot = dirname(packageJsonPath)
  const manifest = readPackageManifest(packageRoot, plan.packageName)
  const binaryPath = applyNativeSearchAsarUnpackedPath(
    join(packageRoot, NATIVE_SEARCH_PACKAGE_BINARY_DIR, manifest.binaryName),
    Boolean(options.isPackaged),
  )

  validatePackageManifest(manifest, plan.packageName, platform, arch)
  validatePathInsideAppNodeModules(
    binaryPath,
    applyNativeSearchAsarUnpackedPath(appNodeModulesRoot, Boolean(options.isPackaged)),
    plan.packageName,
  )
  validateBinaryPath(binaryPath, plan.packageName)
  validateBinarySha256(binaryPath, manifest)

  return {
    binaryPath,
    source: 'bundled',
    packageName: manifest.packageName,
    packageVersion: manifest.packageVersion,
    platform: manifest.platform,
    arch: manifest.arch,
    binaryName: manifest.binaryName,
    binarySha256: manifest.binarySha256,
  }
}

export function tryResolveNativeSearchPackage(
  options: ResolveNativeSearchPackageOptions = {},
): NativeSearchPackageResolutionResult {
  try {
    return { ok: true, package: resolveNativeSearchPackage(options) }
  } catch (error) {
    if (error instanceof NativeSearchPackageResolutionError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.packageName ? { packageName: error.packageName } : {}),
        },
      }
    }

    return {
      ok: false,
      error: {
        code: 'manifest_invalid',
        message: redactNativeRuntimeText(error instanceof Error ? error.message : 'native search package 解析失败'),
      },
    }
  }
}

export function applyNativeSearchAsarUnpackedPath(binaryPath: string, isPackaged: boolean): string {
  if (!isPackaged || !binaryPath.includes('.asar')) return binaryPath
  return binaryPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
}

function createDefaultModuleResolve(): (specifier: string) => string {
  const filename = typeof __filename === 'string'
    ? __filename
    : join(process.cwd(), 'package.json')
  const cjsRequire = createRequire(filename)
  return (specifier: string) => cjsRequire.resolve(specifier)
}

function getDefaultAppNodeModulesRoot(): string {
  const filename = typeof __filename === 'string'
    ? __filename
    : join(process.cwd(), 'dist', 'main.cjs')
  return join(dirname(dirname(filename)), 'node_modules')
}

function resolvePackageJson(
  moduleResolve: (specifier: string) => string,
  packageName: string,
): string {
  try {
    return moduleResolve(`${packageName}/package.json`)
  } catch {
    throw new NativeSearchPackageResolutionError(
      'package_missing',
      `native search optional package 不存在: ${packageName}`,
      packageName,
    )
  }
}

function validatePathInsideAppNodeModules(
  path: string,
  appNodeModulesRoot: string,
  packageName: string,
): void {
  if (!existsSync(appNodeModulesRoot)) {
    throw new NativeSearchPackageResolutionError(
      'package_missing',
      `native search bundled package 根不存在: ${packageName}`,
      packageName,
    )
  }
  const realRoot = realpathSync(appNodeModulesRoot)
  if (!existsSync(path)) {
    return
  }

  const realPath = realpathSync(path)
  if (!isPathInside(realPath, realRoot)) {
    throw new NativeSearchPackageResolutionError(
      'package_missing',
      `native search optional package 不在 bundled package 根内: ${packageName}`,
      packageName,
    )
  }
}

function isPathInside(path: string, root: string): boolean {
  const relativePath = relative(root, path)
  return relativePath === ''
    || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

function readPackageManifest(packageRoot: string, packageName: string): NativeSearchPackageManifest {
  const manifestPath = join(packageRoot, NATIVE_SEARCH_PACKAGE_MANIFEST_FILE)
  if (!existsSync(manifestPath)) {
    throw new NativeSearchPackageResolutionError(
      'manifest_missing',
      `native search optional package manifest 不存在: ${packageName}`,
      packageName,
    )
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as unknown
    if (!isNativeSearchPackageManifest(manifest)) {
      throw new NativeSearchPackageResolutionError(
        'manifest_invalid',
        `native search optional package manifest schema 无效: ${packageName}`,
        packageName,
      )
    }
    return manifest
  } catch (error) {
    if (error instanceof NativeSearchPackageResolutionError) throw error
    throw new NativeSearchPackageResolutionError(
      'manifest_invalid',
      `native search optional package manifest 读取失败: ${packageName}`,
      packageName,
    )
  }
}

function validatePackageManifest(
  manifest: NativeSearchPackageManifest,
  packageName: string,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): void {
  if (
    manifest.packageName !== packageName ||
    manifest.platform !== platform ||
    manifest.arch !== arch
  ) {
    throw new NativeSearchPackageResolutionError(
      'manifest_invalid',
      `native search optional package manifest 与当前平台不匹配: ${packageName}`,
      packageName,
    )
  }
}

function validateBinaryPath(binaryPath: string, packageName: string): void {
  if (!existsSync(binaryPath)) {
    throw new NativeSearchPackageResolutionError(
      'binary_missing',
      `native search optional package binary 不存在: ${packageName}`,
      packageName,
    )
  }

  try {
    accessSync(binaryPath, constants.X_OK)
  } catch {
    if (process.platform !== 'win32') {
      throw new NativeSearchPackageResolutionError(
        'binary_not_executable',
        `native search optional package binary 不可执行: ${packageName}`,
        packageName,
      )
    }
  }
}

function validateBinarySha256(
  binaryPath: string,
  manifest: NativeSearchPackageManifest,
): void {
  const actualSha256 = createHash('sha256').update(readFileSync(binaryPath)).digest('hex')
  if (actualSha256 !== manifest.binarySha256) {
    throw new NativeSearchPackageResolutionError(
      'checksum_mismatch',
      `native search optional package binary fingerprint 不匹配: ${manifest.packageName}`,
      manifest.packageName,
    )
  }
}
