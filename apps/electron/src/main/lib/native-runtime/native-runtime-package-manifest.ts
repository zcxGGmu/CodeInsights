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
  presentPackages: string[]
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

export interface NativeSearchOptionalPackagePublicationValidationResult {
  published: boolean
  expectedPackages: string[]
  publishedPackages: string[]
  missingPackages: string[]
  invalidPackages: string[]
  unavailablePackages: string[]
}

export type NativeSearchOptionalPackagePublishTargetBlocker =
  | 'publish_target_version_required'
  | 'publish_target_version_invalid'
  | 'registry_check_required'
  | 'registry_unavailable'
  | 'publish_target_version_already_exists'
  | 'publish_target_package_metadata_invalid'
  | 'native_search_cargo_version_mismatch'
  | 'native_search_binary_version_not_release_ready'
  | 'native_search_binary_version_mismatch'

export interface NativeSearchOptionalPackagePublishTargetValidationResult {
  checked: boolean
  ready: boolean
  packageVersion: string | null
  blockers: NativeSearchOptionalPackagePublishTargetBlocker[]
  expectedPackages: string[]
  availablePackages: string[]
  publishedVersionCollisionPackages: string[]
  invalidPackages: string[]
  unavailablePackages: string[]
  nativeSearchVersionConsistencyVerified: boolean
  nativeSearchCargoVersion: string | null
  nativeSearchBinaryVersion: string | null
  plannedOptionalPackageManifestsVerified: boolean
}

export type NativeSearchOptionalPackageSourceBlocker =
  | 'package_source_version_required'
  | 'package_source_version_invalid'
  | 'package_source_manifest_missing'
  | 'package_source_package_json_invalid'
  | 'package_source_native_manifest_invalid'

export interface NativeSearchOptionalPackageSource {
  packageJson?: unknown
  nativeSearchPackageManifest?: unknown
}

export interface NativeSearchOptionalPackageSourceValidationResult {
  checked: boolean
  ready: boolean
  packageVersion: string | null
  blockers: NativeSearchOptionalPackageSourceBlocker[]
  expectedPackages: string[]
  readyPackages: string[]
  missingPackages: string[]
  invalidPackages: string[]
  plannedOptionalPackageManifestsVerified: boolean
}

export interface NativeSearchPackagingConfigValidationResult {
  verified: boolean
  expectedPackages: string[]
  includedPackages: string[]
  missingPackages: string[]
  blockingExcludes: string[]
  tooBroadIncludes: string[]
}

interface ValidateNativeSearchOptionalPackageInstallChainOptions {
  packageJson: unknown
  lockfileText?: string
  installedPackageManifests?: Record<string, unknown>
}

interface ValidateNativeSearchOptionalPackagePublicationOptions {
  registryMetadata?: Record<string, unknown>
  expectedPackageVersions?: Record<string, string>
  unavailablePackages?: string[]
}

interface ValidateNativeSearchOptionalPackagePublishTargetOptions {
  packageVersion?: string
  registryChecked?: boolean
  registryMetadata?: Record<string, unknown>
  unavailablePackages?: string[]
  cargoVersion?: string | null
  binaryVersion?: string | null
}

interface ValidateNativeSearchOptionalPackageSourcesOptions {
  packageVersion?: string
  packageSources?: Record<string, NativeSearchOptionalPackageSource | unknown>
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
  const presentPackages: string[] = []
  const missingPackages: string[] = []
  const invalidPackages: string[] = []

  for (const packageName of expectedPackages) {
    const value = optionalDependencies?.[packageName]
    if (value == null) {
      missingPackages.push(packageName)
      continue
    }
    presentPackages.push(packageName)
    if (!isValidOptionalDependencyVersionSpec(value, packageName)) {
      invalidPackages.push(packageName)
    }
  }

  return {
    declared: missingPackages.length === 0 && invalidPackages.length === 0,
    expectedPackages,
    presentPackages,
    missingPackages,
    invalidPackages,
  }
}

export function getNativeSearchOptionalDependencyExpectedVersions(
  packageJson: unknown,
): Record<string, string> {
  const versions: Record<string, string> = {}
  for (const packageName of getNativeSearchOptionalDependencyNames()) {
    const versionSpec = getOptionalDependencyVersionSpec(packageJson, packageName)
    const exactVersion = extractExactPackageVersion(versionSpec, packageName)
    if (exactVersion) versions[packageName] = exactVersion
  }
  return versions
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

export function validateNativeSearchOptionalPackagePublication(
  options: ValidateNativeSearchOptionalPackagePublicationOptions,
): NativeSearchOptionalPackagePublicationValidationResult {
  const expectedPackages = getNativeSearchOptionalDependencyNames()
  const registryMetadata = options.registryMetadata ?? {}
  const expectedPackageVersions = options.expectedPackageVersions ?? {}
  const unavailablePackages = normalizePackageNameList(options.unavailablePackages ?? [], expectedPackages)
  const publishedPackages: string[] = []
  const missingPackages: string[] = []
  const invalidPackages: string[] = []

  for (const plan of NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS) {
    if (unavailablePackages.includes(plan.packageName)) continue

    const metadata = registryMetadata[plan.packageName]
    if (metadata == null) {
      missingPackages.push(plan.packageName)
      continue
    }

    if (!isNativeSearchRegistryPackument(metadata, plan, expectedPackageVersions[plan.packageName])) {
      invalidPackages.push(plan.packageName)
      continue
    }

    publishedPackages.push(plan.packageName)
  }

  return {
    published: publishedPackages.length === expectedPackages.length
      && missingPackages.length === 0
      && invalidPackages.length === 0
      && unavailablePackages.length === 0,
    expectedPackages,
    publishedPackages,
    missingPackages,
    invalidPackages,
    unavailablePackages,
  }
}

export function validateNativeSearchOptionalPackagePublishTarget(
  options: ValidateNativeSearchOptionalPackagePublishTargetOptions,
): NativeSearchOptionalPackagePublishTargetValidationResult {
  const expectedPackages = getNativeSearchOptionalDependencyNames()
  const packageVersion = normalizeOptionalString(options.packageVersion)
  const cargoVersion = normalizeOptionalString(options.cargoVersion)
  const binaryVersion = normalizeOptionalString(options.binaryVersion)
  const registryChecked = options.registryChecked === true
  const unavailablePackages = registryChecked
    ? normalizePackageNameList(options.unavailablePackages ?? [], expectedPackages)
    : []
  const availablePackages: string[] = []
  const publishedVersionCollisionPackages: string[] = []
  const invalidPackages: string[] = []
  const blockers: NativeSearchOptionalPackagePublishTargetBlocker[] = []

  const releaseVersionValid = packageVersion != null && isReleasePackageVersion(packageVersion)
  if (packageVersion == null) {
    blockers.push('publish_target_version_required')
  } else if (!releaseVersionValid) {
    blockers.push('publish_target_version_invalid')
  }

  if (!registryChecked) {
    blockers.push('registry_check_required')
  } else if (releaseVersionValid) {
    const registryMetadata = options.registryMetadata ?? {}
    for (const plan of NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS) {
      if (unavailablePackages.includes(plan.packageName)) continue

      const metadata = registryMetadata[plan.packageName]
      if (metadata == null) {
        availablePackages.push(plan.packageName)
        continue
      }

      const targetState = getNativeSearchPublishTargetRegistryState(metadata, plan, packageVersion)
      if (targetState === 'available') {
        availablePackages.push(plan.packageName)
      } else if (targetState === 'collision') {
        publishedVersionCollisionPackages.push(plan.packageName)
      } else {
        invalidPackages.push(plan.packageName)
      }
    }
  }

  if (unavailablePackages.length > 0) blockers.push('registry_unavailable')
  if (publishedVersionCollisionPackages.length > 0) blockers.push('publish_target_version_already_exists')
  if (invalidPackages.length > 0) blockers.push('publish_target_package_metadata_invalid')

  if (cargoVersion !== packageVersion) {
    blockers.push('native_search_cargo_version_mismatch')
  }

  if (binaryVersion !== packageVersion) {
    if (packageVersion != null && binaryVersion === `${packageVersion}-dev`) {
      blockers.push('native_search_binary_version_not_release_ready')
    } else {
      blockers.push('native_search_binary_version_mismatch')
    }
  } else if (binaryVersion != null && !isReleasePackageVersion(binaryVersion)) {
    blockers.push('native_search_binary_version_not_release_ready')
  }

  const plannedOptionalPackageManifestsVerified = releaseVersionValid
    && NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.every((plan) => (
      isNativeSearchPackageManifest(buildNativeSearchPackageManifest({
        plan,
        packageVersion,
        binarySha256: '0'.repeat(64),
      }))
    ))
  const nativeSearchVersionConsistencyVerified = releaseVersionValid
    && cargoVersion === packageVersion
    && binaryVersion === packageVersion
    && binaryVersion != null
    && isReleasePackageVersion(binaryVersion)

  return {
    checked: registryChecked,
    ready: registryChecked
      && releaseVersionValid
      && blockers.length === 0
      && availablePackages.length === expectedPackages.length
      && plannedOptionalPackageManifestsVerified
      && nativeSearchVersionConsistencyVerified,
    packageVersion: packageVersion ?? null,
    blockers: uniqueBlockers(blockers),
    expectedPackages,
    availablePackages,
    publishedVersionCollisionPackages,
    invalidPackages,
    unavailablePackages,
    nativeSearchVersionConsistencyVerified,
    nativeSearchCargoVersion: cargoVersion,
    nativeSearchBinaryVersion: binaryVersion,
    plannedOptionalPackageManifestsVerified,
  }
}

export function validateNativeSearchOptionalPackageSources(
  options: ValidateNativeSearchOptionalPackageSourcesOptions,
): NativeSearchOptionalPackageSourceValidationResult {
  const expectedPackages = getNativeSearchOptionalDependencyNames()
  const packageVersion = normalizeOptionalString(options.packageVersion)
  const releaseVersionValid = packageVersion != null && isReleasePackageVersion(packageVersion)
  const packageSources = options.packageSources ?? {}
  const readyPackages: string[] = []
  const missingPackages: string[] = []
  const invalidPackages: string[] = []
  const blockers: NativeSearchOptionalPackageSourceBlocker[] = []
  let hasInvalidPackageJson = false
  let hasInvalidNativeManifest = false

  if (packageVersion == null) {
    blockers.push('package_source_version_required')
  } else if (!releaseVersionValid) {
    blockers.push('package_source_version_invalid')
  }

  for (const plan of NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS) {
    const source = packageSources[plan.packageName]
    if (!isNativeSearchOptionalPackageSource(source)) {
      missingPackages.push(plan.packageName)
      continue
    }

    const packageJsonValid = releaseVersionValid
      && packageVersion != null
      && isNativeSearchOptionalPackageSourcePackageJson(source.packageJson, plan, packageVersion)
    const nativeManifestValid = releaseVersionValid
      && packageVersion != null
      && isNativeSearchOptionalPackageSourceManifest(source.nativeSearchPackageManifest, plan, packageVersion)

    if (!packageJsonValid || !nativeManifestValid) {
      invalidPackages.push(plan.packageName)
      if (!packageJsonValid) hasInvalidPackageJson = true
      if (!nativeManifestValid) hasInvalidNativeManifest = true
      continue
    }

    readyPackages.push(plan.packageName)
  }

  if (missingPackages.length > 0) blockers.push('package_source_manifest_missing')
  if (hasInvalidPackageJson) blockers.push('package_source_package_json_invalid')
  if (hasInvalidNativeManifest) blockers.push('package_source_native_manifest_invalid')

  const plannedOptionalPackageManifestsVerified = releaseVersionValid
    && readyPackages.length === expectedPackages.length
    && missingPackages.length === 0
    && invalidPackages.length === 0

  return {
    checked: true,
    ready: blockers.length === 0 && plannedOptionalPackageManifestsVerified,
    packageVersion: packageVersion ?? null,
    blockers: uniqueSourceBlockers(blockers),
    expectedPackages,
    readyPackages,
    missingPackages,
    invalidPackages,
    plannedOptionalPackageManifestsVerified,
  }
}

export function validateNativeSearchPackagingConfig(
  builderConfigText: string,
): NativeSearchPackagingConfigValidationResult {
  const expectedPackages = getNativeSearchOptionalDependencyNames()
  const filesRules = extractElectronBuilderFilesRules(builderConfigText)
  const plans = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS
  const blockingExcludes = filesRules
    .filter((rule) => rule.startsWith('!') && blocksNativeSearchRequiredPath(rule))
  const tooBroadIncludes = filesRules
    .filter((rule) => !rule.startsWith('!') && isTooBroadNativeSearchInclude(rule))
  const includedPackages = plans.filter((plan) => (
    getNativeSearchRequiredPackagePaths(plan).every((requiredPath) => (
      filesRules.some((rule) => !rule.startsWith('!') && explicitlyIncludesNativeSearchPath(rule, plan, requiredPath))
    ))
  )).map((plan) => plan.packageName)
  const missingPackages = plans.map((plan) => plan.packageName).filter((packageName) => (
    !includedPackages.includes(packageName)
  ))

  return {
    verified: missingPackages.length === 0 && blockingExcludes.length === 0 && tooBroadIncludes.length === 0,
    expectedPackages,
    includedPackages,
    missingPackages,
    blockingExcludes,
    tooBroadIncludes,
  }
}

function normalizePackageNameList(values: string[], expectedPackages: string[]): string[] {
  return values.filter((value, index) => (
    expectedPackages.includes(value) && values.indexOf(value) === index
  ))
}

function isNativeSearchRegistryPackument(
  value: unknown,
  plan: NativeSearchOptionalPackagePlan,
  expectedVersion?: string,
): boolean {
  if (!isRecord(value)) return false
  if (value.name !== plan.packageName) return false
  if (!isRecord(value.versions)) return false

  if (expectedVersion != null) {
    if (!isPackageVersion(expectedVersion)) return false
    const expectedManifest = value.versions[expectedVersion]
    return isRecord(expectedManifest)
      && isNativeSearchRegistryVersionManifest(expectedManifest, plan, expectedVersion)
  }

  if (!isRecord(value['dist-tags'])) return false
  const latest = value['dist-tags'].latest
  if (typeof latest !== 'string' || !isPackageVersion(latest)) return false
  const latestManifest = value.versions[latest]
  return isRecord(latestManifest)
    && isNativeSearchRegistryVersionManifest(latestManifest, plan, latest)
}

function getNativeSearchPublishTargetRegistryState(
  value: unknown,
  plan: NativeSearchOptionalPackagePlan,
  packageVersion: string,
): 'available' | 'collision' | 'invalid' {
  if (!isRecord(value)) return 'invalid'
  if (value.name !== plan.packageName) return 'invalid'
  if (!isRecord(value.versions)) return 'invalid'

  const targetManifest = value.versions[packageVersion]
  if (targetManifest == null) return 'available'
  return isRecord(targetManifest) ? 'collision' : 'invalid'
}

function isNativeSearchRegistryVersionManifest(
  value: Record<string, unknown>,
  plan: NativeSearchOptionalPackagePlan,
  version: string,
): boolean {
  return value.name === plan.packageName
    && value.version === version
    && packageManifestTargetsPlatform(value.os, plan.platform)
    && packageManifestTargetsArch(value.cpu, plan.arch)
    && packageManifestHasExpectedBinary(value.bin, plan.binaryName)
}

function packageManifestTargetsPlatform(value: unknown, platform: NodeJS.Platform): boolean {
  return Array.isArray(value)
    && value.length === 1
    && value[0] === platform
}

function packageManifestTargetsArch(value: unknown, arch: NodeJS.Architecture): boolean {
  return Array.isArray(value)
    && value.length === 1
    && value[0] === arch
}

function packageManifestHasExpectedBinary(value: unknown, binaryName: string): boolean {
  if (!isRecord(value)) return false
  const binaryPath = value['codeinsights-native-search']
  return binaryPath === `bin/${binaryName}`
}

function isNativeSearchOptionalPackageSource(value: unknown): value is NativeSearchOptionalPackageSource {
  return isRecord(value)
    && Object.prototype.hasOwnProperty.call(value, 'packageJson')
    && Object.prototype.hasOwnProperty.call(value, 'nativeSearchPackageManifest')
}

function isNativeSearchOptionalPackageSourcePackageJson(
  value: unknown,
  plan: NativeSearchOptionalPackagePlan,
  packageVersion: string,
): boolean {
  if (!isRecord(value)) return false
  if (hasUnsafePathLikeKey(value)) return false
  if (value.name !== plan.packageName) return false
  if (value.version !== packageVersion) return false
  if (value.private !== false) return false
  if (typeof value.description !== 'string' || value.description.trim().length === 0) return false
  if (typeof value.license !== 'string' || value.license.trim().length === 0) return false
  if (!packageManifestTargetsPlatform(value.os, plan.platform)) return false
  if (!packageManifestTargetsArch(value.cpu, plan.arch)) return false
  if (!packageManifestHasExpectedBinary(value.bin, plan.binaryName)) return false
  if (!packageManifestHasExpectedFiles(value.files, plan.binaryName)) return false
  if (!isRecord(value.publishConfig) || value.publishConfig.access !== 'public') return false
  if (hasInstallLifecycleScripts(value.scripts)) return false
  if (hasRuntimeDependencyField(value)) return false
  return true
}

function isNativeSearchOptionalPackageSourceManifest(
  value: unknown,
  plan: NativeSearchOptionalPackagePlan,
  packageVersion: string,
): boolean {
  return isNativeSearchPackageManifest(value)
    && value.packageName === plan.packageName
    && value.packageVersion === packageVersion
    && value.platform === plan.platform
    && value.arch === plan.arch
    && value.binaryName === plan.binaryName
}

function packageManifestHasExpectedFiles(value: unknown, binaryName: string): boolean {
  if (!Array.isArray(value)) return false
  const expectedFiles = [
    'package.json',
    'native-search-package.json',
    `bin/${binaryName}`,
  ]
  if (value.length !== expectedFiles.length) return false
  return expectedFiles.every((expectedFile) => value.includes(expectedFile))
    && value.every((file) => typeof file === 'string' && expectedFiles.includes(file))
}

function hasInstallLifecycleScripts(value: unknown): boolean {
  if (!isRecord(value)) return false
  return [
    'preinstall',
    'install',
    'postinstall',
    'prepublish',
    'prepublishOnly',
    'prepare',
    'prepack',
    'postpack',
    'publish',
    'postpublish',
  ].some((scriptName) => Object.prototype.hasOwnProperty.call(value, scriptName))
}

function hasRuntimeDependencyField(value: Record<string, unknown>): boolean {
  return [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'bundledDependencies',
    'bundleDependencies',
  ].some((fieldName) => Object.prototype.hasOwnProperty.call(value, fieldName))
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

function extractElectronBuilderFilesRules(builderConfigText: string): string[] {
  const rules: string[] = []
  const lines = builderConfigText.split(/\r?\n/)
  let inFilesBlock = false
  let filesIndent = 0

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) continue

    const indent = line.search(/\S/)
    if (indent === 0 && /^files:\s*(?:#.*)?$/.test(trimmedLine)) {
      inFilesBlock = true
      filesIndent = indent
      continue
    }

    if (!inFilesBlock) continue
    if (indent <= filesIndent && /^[A-Za-z0-9_-]+:/.test(trimmedLine)) break

    const listItem = trimmedLine.match(/^-\s*(.+)$/)
    if (!listItem?.[1]) continue
    rules.push(normalizeElectronBuilderFilesRule(listItem[1]))
  }

  return rules.filter((rule) => rule.length > 0)
}

function normalizeElectronBuilderFilesRule(value: string): string {
  const withoutComment = stripYamlInlineComment(value.trim())
  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"'))
    || (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1).trim()
  }
  return withoutComment
}

function stripYamlInlineComment(value: string): string {
  let quote: '"' | "'" | null = null
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? null : quote ?? char
      continue
    }
    if (char === '#' && quote == null && /\s/.test(value[index - 1] ?? ' ')) {
      return value.slice(0, index).trim()
    }
  }
  return value.trim()
}

function blocksNativeSearchRequiredPath(rule: string): boolean {
  const normalizedRule = normalizeGlobRule(rule.slice(1))
  return NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.some((plan) => (
    getNativeSearchRequiredPackagePaths(plan).some((requiredPath) => (
      globRuleMatchesPathOrAncestor(normalizedRule, requiredPath)
    ))
  ))
}

function explicitlyIncludesNativeSearchPath(
  rule: string,
  plan: NativeSearchOptionalPackagePlan,
  requiredPath: string,
): boolean {
  const normalizedRule = normalizeGlobRule(rule)
  const packageRoot = getNativeSearchPackageRoot(plan)

  return normalizedRule === packageRoot
    || normalizedRule === `${packageRoot}/**`
    || normalizedRule === `${packageRoot}/**/*`
    || normalizedRule === requiredPath
}

function isTooBroadNativeSearchInclude(rule: string): boolean {
  const normalizedRule = normalizeGlobRule(rule)
  return normalizedRule === 'node_modules/**'
    || normalizedRule === 'node_modules/**/*'
    || normalizedRule === 'node_modules/@codeinsights/*'
    || normalizedRule === 'node_modules/@codeinsights/**'
    || normalizedRule === 'node_modules/@codeinsights/**/*'
    || normalizedRule.startsWith('node_modules/@codeinsights/native-search-*')
}

function getNativeSearchRequiredPackagePaths(plan: NativeSearchOptionalPackagePlan): string[] {
  const packageRoot = getNativeSearchPackageRoot(plan)
  return [
    `${packageRoot}/package.json`,
    `${packageRoot}/native-search-package.json`,
    `${packageRoot}/bin/${plan.binaryName}`,
  ]
}

function getNativeSearchPackageRoot(plan: NativeSearchOptionalPackagePlan): string {
  return `node_modules/${plan.packageName}`
}

function globRuleMatchesPathOrAncestor(rule: string, requiredPath: string): boolean {
  const pathSegments = requiredPath.split('/')
  for (let length = pathSegments.length; length >= 1; length -= 1) {
    if (globRuleMatchesPath(rule, pathSegments.slice(0, length).join('/'))) return true
  }
  return false
}

function globRuleMatchesPath(rule: string, path: string): boolean {
  return globRuleToRegExp(rule).test(path)
}

function globRuleToRegExp(rule: string): RegExp {
  let source = '^'
  for (let index = 0; index < rule.length; index += 1) {
    const char = rule[index]
    const nextChar = rule[index + 1]
    if (char === '*') {
      if (nextChar === '*') {
        source += '.*'
        index += 1
      } else {
        source += '[^/]*'
      }
      continue
    }
    source += escapeRegExp(char ?? '')
  }
  return new RegExp(`${source}$`)
}

function normalizeGlobRule(rule: string): string {
  return rule.trim().replace(/\\/g, '/').replace(/\/+$/, '')
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

function isReleasePackageVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value)
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function uniqueBlockers(
  blockers: NativeSearchOptionalPackagePublishTargetBlocker[],
): NativeSearchOptionalPackagePublishTargetBlocker[] {
  return blockers.filter((blocker, index) => blockers.indexOf(blocker) === index)
}

function uniqueSourceBlockers(
  blockers: NativeSearchOptionalPackageSourceBlocker[],
): NativeSearchOptionalPackageSourceBlocker[] {
  return blockers.filter((blocker, index) => blockers.indexOf(blocker) === index)
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
