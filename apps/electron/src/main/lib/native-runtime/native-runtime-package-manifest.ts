import {
  NATIVE_RUNTIME_CACHE_SCHEMA_VERSION,
  NATIVE_RUNTIME_PROTOCOL_VERSION,
} from './native-runtime-diagnostics'

export interface NativeSearchOptionalPackagePlan {
  packageName: string
  platform: NodeJS.Platform
  arch: NodeJS.Architecture
  binaryName: string
}

export interface NativeSearchPackageManifest {
  schemaVersion: number
  packageName: string
  packageVersion: string
  protocolVersion: number
  cacheSchemaVersion: number
  platform: NodeJS.Platform
  arch: NodeJS.Architecture
  binaryName: string
  binarySha256: string
}

interface BuildNativeSearchPackageManifestOptions {
  plan: NativeSearchOptionalPackagePlan
  packageVersion: string
  binarySha256: string
}

export const NATIVE_SEARCH_PACKAGE_MANIFEST_SCHEMA_VERSION = 1

const NATIVE_SEARCH_PACKAGE_MANIFEST_KEYS = new Set([
  'schemaVersion',
  'packageName',
  'packageVersion',
  'protocolVersion',
  'cacheSchemaVersion',
  'platform',
  'arch',
  'binaryName',
  'binarySha256',
])

export const NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS: NativeSearchOptionalPackagePlan[] = [
  {
    packageName: '@codeinsights/native-search-darwin-arm64',
    platform: 'darwin',
    arch: 'arm64',
    binaryName: 'codeinsights-native-search',
  },
  {
    packageName: '@codeinsights/native-search-darwin-x64',
    platform: 'darwin',
    arch: 'x64',
    binaryName: 'codeinsights-native-search',
  },
  {
    packageName: '@codeinsights/native-search-win32-x64',
    platform: 'win32',
    arch: 'x64',
    binaryName: 'codeinsights-native-search.exe',
  },
  {
    packageName: '@codeinsights/native-search-linux-x64',
    platform: 'linux',
    arch: 'x64',
    binaryName: 'codeinsights-native-search',
  },
]

export function getNativeSearchOptionalPackagePlan(
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch,
): NativeSearchOptionalPackagePlan | undefined {
  return NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.find((plan) => (
    plan.platform === platform && plan.arch === arch
  ))
}

export function buildNativeSearchPackageManifest(
  options: BuildNativeSearchPackageManifestOptions,
): NativeSearchPackageManifest {
  return {
    schemaVersion: NATIVE_SEARCH_PACKAGE_MANIFEST_SCHEMA_VERSION,
    packageName: options.plan.packageName,
    packageVersion: options.packageVersion,
    protocolVersion: NATIVE_RUNTIME_PROTOCOL_VERSION,
    cacheSchemaVersion: NATIVE_RUNTIME_CACHE_SCHEMA_VERSION,
    platform: options.plan.platform,
    arch: options.plan.arch,
    binaryName: options.plan.binaryName,
    binarySha256: normalizeSha256(options.binarySha256),
  }
}

export function isNativeSearchPackageManifest(value: unknown): value is NativeSearchPackageManifest {
  if (!isRecord(value)) return false
  if (!hasOnlyNativeSearchPackageManifestKeys(value)) return false
  if (hasUnsafePathLikeKey(value)) return false
  if (value.schemaVersion !== NATIVE_SEARCH_PACKAGE_MANIFEST_SCHEMA_VERSION) return false
  if (typeof value.packageName !== 'string') return false
  if (typeof value.packageVersion !== 'string' || !isPackageVersion(value.packageVersion)) return false
  if (value.protocolVersion !== NATIVE_RUNTIME_PROTOCOL_VERSION) return false
  if (value.cacheSchemaVersion !== NATIVE_RUNTIME_CACHE_SCHEMA_VERSION) return false
  if (typeof value.platform !== 'string') return false
  if (typeof value.arch !== 'string') return false
  if (typeof value.binaryName !== 'string') return false
  if (typeof value.binarySha256 !== 'string' || !isSha256(value.binarySha256)) return false

  const expectedPlan = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.find((plan) => (
    plan.platform === value.platform && plan.arch === value.arch
  ))
  return expectedPlan?.packageName === value.packageName
    && expectedPlan.binaryName === value.binaryName
}

function normalizeSha256(value: string): string {
  return value.trim().toLowerCase()
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(normalizeSha256(value))
}

function isPackageVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)
}

function hasOnlyNativeSearchPackageManifestKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => NATIVE_SEARCH_PACKAGE_MANIFEST_KEYS.has(key))
}

function hasUnsafePathLikeKey(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => {
    const normalized = key.toLowerCase()
    return normalized === 'binarypath'
      || normalized === 'path'
      || normalized.endsWith('path')
      || normalized === 'home'
      || normalized === 'homedir'
      || normalized === 'homepath'
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
