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

export interface NativeSearchOptionalDependenciesValidationResult {
  declared: boolean
  expectedPackages: string[]
  missingPackages: string[]
  invalidPackages: string[]
}

export interface NativeSearchOptionalPackageInstallChainValidationResult {
  verified: boolean
  optionalDependencies: NativeSearchOptionalDependenciesValidationResult
  lockfileVerified: boolean
  installedPackagesVerified: boolean
  missingLockfilePackages: string[]
  missingInstalledPackages: string[]
  invalidInstalledPackages: string[]
}

interface ValidateNativeSearchOptionalPackageInstallChainOptions {
  packageJson: unknown
  lockfileText?: string
  installedPackageManifests?: Record<string, unknown>
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

export function getNativeSearchOptionalDependencyNames(): string[] {
  return NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
}

export function validateNativeSearchOptionalDependencies(
  packageJson: unknown,
): NativeSearchOptionalDependenciesValidationResult {
  const expectedPackages = getNativeSearchOptionalDependencyNames()
  const optionalDependencies = isRecord(packageJson)
    && isRecord(packageJson.optionalDependencies)
    ? packageJson.optionalDependencies
    : undefined
  const missingPackages: string[] = []
  const invalidPackages: string[] = []

  for (const packageName of expectedPackages) {
    const value = optionalDependencies?.[packageName]
    if (value == null) {
      missingPackages.push(packageName)
      continue
    }
    if (!isValidOptionalDependencyVersionSpec(value, packageName)) {
      invalidPackages.push(packageName)
    }
  }

  return {
    declared: missingPackages.length === 0 && invalidPackages.length === 0,
    expectedPackages,
    missingPackages,
    invalidPackages,
  }
}

export function validateNativeSearchOptionalPackageInstallChain(
  options: ValidateNativeSearchOptionalPackageInstallChainOptions,
): NativeSearchOptionalPackageInstallChainValidationResult {
  const optionalDependencies = validateNativeSearchOptionalDependencies(options.packageJson)
  const lockfileText = options.lockfileText ?? ''
  const installedPackageManifests = options.installedPackageManifests ?? {}
  const missingLockfilePackages: string[] = []
  const missingInstalledPackages: string[] = []
  const invalidInstalledPackages: string[] = []

  for (const packageName of optionalDependencies.expectedPackages) {
    const versionSpec = getOptionalDependencyVersionSpec(options.packageJson, packageName)
    if (!lockfileContainsResolvedPackageEntry(lockfileText, packageName, versionSpec)) {
      missingLockfilePackages.push(packageName)
    }

    const installedManifest = installedPackageManifests[packageName]
    if (!isRecord(installedManifest)) {
      missingInstalledPackages.push(packageName)
      continue
    }

    if (!isInstalledPackageManifestConsistent(
      installedManifest,
      packageName,
      versionSpec,
    )) {
      invalidInstalledPackages.push(packageName)
    }
  }

  const lockfileVerified = missingLockfilePackages.length === 0
  const installedPackagesVerified = missingInstalledPackages.length === 0
    && invalidInstalledPackages.length === 0

  return {
    verified: optionalDependencies.declared && lockfileVerified && installedPackagesVerified,
    optionalDependencies,
    lockfileVerified,
    installedPackagesVerified,
    missingLockfilePackages,
    missingInstalledPackages,
    invalidInstalledPackages,
  }
}

function isValidOptionalDependencyVersionSpec(value: unknown, expectedPackageName: string): value is string {
  if (typeof value !== 'string') return false

  const normalizedValue = value.trim()
  const normalizedLowerValue = normalizedValue.toLowerCase()
  if (normalizedLowerValue.length === 0) return false
  if (normalizedLowerValue.startsWith('npm:')) {
    return isValidNpmAliasSpec(normalizedValue, expectedPackageName)
  }
  if (
    normalizedLowerValue.startsWith('file:')
    || normalizedLowerValue.startsWith('link:')
    || normalizedLowerValue.startsWith('workspace:')
    || normalizedLowerValue.startsWith('git:')
    || normalizedLowerValue.startsWith('git+')
    || normalizedLowerValue.startsWith('github:')
    || normalizedLowerValue.startsWith('http:')
    || normalizedLowerValue.startsWith('https:')
    || normalizedLowerValue.startsWith('.')
    || normalizedLowerValue.startsWith('/')
    || normalizedLowerValue.startsWith('~/.')
    || normalizedLowerValue.includes('/')
    || normalizedLowerValue.includes('\\')
  ) {
    return false
  }

  return isPackageVersion(normalizedValue)
}

function isValidNpmAliasSpec(value: string, expectedPackageName: string): boolean {
  const aliasPrefix = `npm:${expectedPackageName}@`
  if (!value.startsWith(aliasPrefix)) return false

  return isValidPlainRegistrySpecifier(value.slice(aliasPrefix.length))
}

function isValidPlainRegistrySpecifier(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  if (normalizedValue.length === 0) return false
  return !(
    normalizedValue.startsWith('file:')
    || normalizedValue.startsWith('link:')
    || normalizedValue.startsWith('workspace:')
    || normalizedValue.startsWith('git:')
    || normalizedValue.startsWith('git+')
    || normalizedValue.startsWith('github:')
    || normalizedValue.startsWith('http:')
    || normalizedValue.startsWith('https:')
    || normalizedValue.startsWith('.')
    || normalizedValue.startsWith('/')
    || normalizedValue.startsWith('~/.')
    || normalizedValue.includes('/')
    || normalizedValue.includes('\\')
  ) && isPackageVersion(normalizedValue)
}

function lockfileContainsResolvedPackageEntry(
  lockfileText: string,
  packageName: string,
  versionSpec: string | undefined,
): boolean {
  const exactVersion = extractExactPackageVersion(versionSpec, packageName)
  if (!exactVersion) return false

  const escapedPackageName = escapeRegExp(packageName)
  const escapedVersion = escapeRegExp(exactVersion)
  return new RegExp(
    `"${escapedPackageName}"\\s*:\\s*\\[\\s*"${escapedPackageName}@${escapedVersion}"`,
  ).test(lockfileText)
}

function getOptionalDependencyVersionSpec(
  packageJson: unknown,
  packageName: string,
): string | undefined {
  if (!isRecord(packageJson) || !isRecord(packageJson.optionalDependencies)) return undefined
  const value = packageJson.optionalDependencies[packageName]
  return typeof value === 'string' ? value.trim() : undefined
}

function isInstalledPackageManifestConsistent(
  packageManifest: Record<string, unknown>,
  packageName: string,
  versionSpec: string | undefined,
): boolean {
  if (packageManifest.name !== packageName) return false
  if (typeof packageManifest.version !== 'string' || !isPackageVersion(packageManifest.version)) return false

  const expectedVersion = extractExactPackageVersion(versionSpec, packageName)
  return expectedVersion == null || packageManifest.version === expectedVersion
}

function extractExactPackageVersion(
  versionSpec: string | undefined,
  packageName: string,
): string | undefined {
  if (!versionSpec) return undefined
  const trimmedSpec = versionSpec.trim()
  const aliasPrefix = `npm:${packageName}@`
  const candidateVersion = trimmedSpec.startsWith(aliasPrefix)
    ? trimmedSpec.slice(aliasPrefix.length)
    : trimmedSpec
  return isPackageVersion(candidateVersion) ? candidateVersion : undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
