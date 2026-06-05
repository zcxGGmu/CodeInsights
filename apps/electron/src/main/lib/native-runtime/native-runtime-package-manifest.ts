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

export interface NativeSearchPlannedOptionalDependency {
  packageName: string
  versionSpec: string
}

export type NativeSearchOptionalDependenciesInstallChainChangePlanStatus =
  | 'blocked'
  | 'ready_for_review'

export type NativeSearchOptionalDependenciesInstallChainChangePlanBlocker =
  | 'optional_dependency_plan_version_required'
  | 'optional_dependency_plan_version_invalid'
  | 'optional_packages_not_published'
  | 'optional_dependencies_not_declared'
  | 'optional_dependencies_invalid'
  | 'optional_dependency_install_chain_not_verified'
  | 'optional_dependency_lockfile_not_verified'
  | 'optional_dependency_installed_packages_not_verified'

export interface NativeSearchOptionalDependenciesInstallChainChangePlan {
  schemaVersion: 1
  status: NativeSearchOptionalDependenciesInstallChainChangePlanStatus
  packageVersion: string | null
  optionalPackagesPublished: boolean
  currentDeclarationVerified: boolean
  currentInstallChainVerified: boolean
  approvalRequired: boolean
  plannedOptionalDependencies: NativeSearchPlannedOptionalDependency[]
  missingOptionalDependencies: string[]
  invalidOptionalDependencies: string[]
  missingLockfilePackages: string[]
  missingInstalledPackages: string[]
  invalidInstalledPackages: string[]
  blockedBy: NativeSearchOptionalDependenciesInstallChainChangePlanBlocker[]
  candidateReviewAction: string
  candidateVerificationCommands: string[]
  forbiddenActions: string[]
}

export interface NativeSearchOptionalPackagePublicationValidationResult {
  published: boolean
  expectedPackages: string[]
  publishedPackages: string[]
  missingPackages: string[]
  invalidPackages: string[]
  unavailablePackages: string[]
}

export interface NativeSearchPlannedOptionalPackagePublication {
  packageName: string
  packageVersion: string
}

export type NativeSearchOptionalPackagePublicationChangePlanStatus =
  | 'blocked'
  | 'ready_for_review'

export type NativeSearchOptionalPackagePublicationChangePlanBlocker =
  | 'optional_package_publication_version_required'
  | 'optional_package_publication_version_invalid'
  | 'optional_package_publish_target_not_ready'
  | 'optional_package_source_not_ready'
  | 'optional_packages_not_published'
  | 'optional_packages_already_published'
  | 'optional_package_publication_partial'
  | 'optional_package_publication_metadata_invalid'
  | 'optional_package_publication_state_unavailable'

export interface NativeSearchOptionalPackagePublicationChangePlan {
  schemaVersion: 1
  status: NativeSearchOptionalPackagePublicationChangePlanStatus
  packageVersion: string | null
  publishTargetReady: boolean
  packageSourceReady: boolean
  optionalPackagesPublished: boolean
  approvalRequired: boolean
  plannedPackages: NativeSearchPlannedOptionalPackagePublication[]
  publishedPackages: string[]
  missingPublishedPackages: string[]
  invalidPublishedPackages: string[]
  unavailablePublishedPackages: string[]
  blockedBy: NativeSearchOptionalPackagePublicationChangePlanBlocker[]
  candidateReviewAction: string
  candidatePreflightCommands: string[]
  candidatePublicationCommands: string[]
  forbiddenActions: string[]
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

export type NativeSearchPackagingConfigAllowlistChangePlanStatus =
  | 'blocked'
  | 'ready_for_review'

export interface NativeSearchPackagingConfigAllowlistChangePlan {
  schemaVersion: 1
  status: NativeSearchPackagingConfigAllowlistChangePlanStatus
  currentConfigVerified: boolean
  approvalRequired: boolean
  requiredIncludes: string[]
  missingIncludes: string[]
  blockingExcludes: string[]
  tooBroadIncludes: string[]
  removalCandidates: string[]
  forbiddenIncludes: string[]
  candidateReviewAction: string
  candidateVerificationCommands: string[]
  forbiddenActions: string[]
}

export type NativeSearchOptionalPackageExecutionStage =
  | 'publish_target_preflight'
  | 'package_source_preflight'
  | 'optional_package_publication'
  | 'optional_dependencies_declaration'
  | 'optional_package_install_chain'
  | 'packaging_config_allowlist'
  | 'packaged_app_bundled_binary_smoke'
  | 'default_enable_risk_review'
  | 'complete'

export type NativeSearchOptionalPackageExecutionBlocker =
  | 'optional_package_publish_target_not_ready'
  | 'optional_package_source_not_ready'
  | 'optional_packages_not_published'
  | 'optional_dependencies_not_declared'
  | 'optional_package_install_chain_not_verified'
  | 'packaging_config_not_verified'
  | 'packaged_app_bundled_binary_not_verified'
  | 'default_enable_risk_review_not_completed'

export interface NativeSearchOptionalPackageExecutionPlan {
  schemaVersion: 1
  nextStage: NativeSearchOptionalPackageExecutionStage
  completedPrerequisites: NativeSearchOptionalPackageExecutionStage[]
  observedEvidenceStages: NativeSearchOptionalPackageExecutionStage[]
  blockedBy: NativeSearchOptionalPackageExecutionBlocker[]
  readyForPublication: boolean
  readyForOptionalDependencies: boolean
  readyForInstallChain: boolean
  readyForPackagingConfigChange: boolean
  readyForPackagedBundledBinarySmoke: boolean
  readyForDefaultEnableRiskReview: boolean
  verified: boolean
  nextAllowedActions: string[]
  candidateCommands: string[]
  forbiddenActions: string[]
}

interface ValidateNativeSearchOptionalPackageInstallChainOptions {
  packageJson: unknown
  lockfileText?: string
  installedPackageManifests?: Record<string, unknown>
}

interface BuildNativeSearchOptionalDependenciesInstallChainChangePlanOptions {
  packageVersion?: string | null
  publication: NativeSearchOptionalPackagePublicationValidationResult
  installChain: NativeSearchOptionalPackageInstallChainValidationResult
}

interface BuildNativeSearchOptionalPackagePublicationChangePlanOptions {
  packageVersion?: string | null
  publishTarget: NativeSearchOptionalPackagePublishTargetValidationResult
  packageSource: NativeSearchOptionalPackageSourceValidationResult
  publication: NativeSearchOptionalPackagePublicationValidationResult
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

interface BuildNativeSearchOptionalPackageExecutionPlanOptions {
  optionalPackagePublishTargetChecked?: boolean
  optionalPackagePublishTargetReady?: boolean
  optionalPackageSourceChecked?: boolean
  optionalPackageSourceReady?: boolean
  optionalPackagesPublished?: boolean
  optionalDependenciesDeclared?: boolean
  optionalDependenciesInstallChainVerified?: boolean
  packagingConfigVerified?: boolean
  bundledBinaryVerified?: boolean
  defaultEnableRiskReviewCompleted?: boolean
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

export function buildNativeSearchOptionalDependenciesInstallChainChangePlan(
  options: BuildNativeSearchOptionalDependenciesInstallChainChangePlanOptions,
): NativeSearchOptionalDependenciesInstallChainChangePlan {
  const packageVersion = normalizeOptionalString(options.packageVersion)
  const packageVersionValid = packageVersion != null && isReleasePackageVersion(packageVersion)
  const optionalDependencies = options.installChain.optionalDependencies
  const blockers: NativeSearchOptionalDependenciesInstallChainChangePlanBlocker[] = []

  if (packageVersion == null) {
    blockers.push('optional_dependency_plan_version_required')
  } else if (!packageVersionValid) {
    blockers.push('optional_dependency_plan_version_invalid')
  }

  if (!options.publication.published) blockers.push('optional_packages_not_published')
  if (!optionalDependencies.declared) blockers.push('optional_dependencies_not_declared')
  if (optionalDependencies.invalidPackages.length > 0) blockers.push('optional_dependencies_invalid')
  if (!options.installChain.verified) blockers.push('optional_dependency_install_chain_not_verified')
  if (!options.installChain.lockfileVerified) blockers.push('optional_dependency_lockfile_not_verified')
  if (!options.installChain.installedPackagesVerified) {
    blockers.push('optional_dependency_installed_packages_not_verified')
  }

  return {
    schemaVersion: 1,
    status: blockers.length === 0 ? 'ready_for_review' : 'blocked',
    packageVersion,
    optionalPackagesPublished: options.publication.published,
    currentDeclarationVerified: optionalDependencies.declared,
    currentInstallChainVerified: options.installChain.verified,
    approvalRequired: true,
    plannedOptionalDependencies: packageVersionValid && packageVersion != null
      ? NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => ({
        packageName: plan.packageName,
        versionSpec: packageVersion,
      }))
      : [],
    missingOptionalDependencies: optionalDependencies.missingPackages,
    invalidOptionalDependencies: optionalDependencies.invalidPackages,
    missingLockfilePackages: options.installChain.missingLockfilePackages,
    missingInstalledPackages: options.installChain.missingInstalledPackages,
    invalidInstalledPackages: options.installChain.invalidInstalledPackages,
    blockedBy: uniqueInstallChainPlanBlockers(blockers),
    candidateReviewAction: 'prepare_optional_dependencies_install_chain_change_for_review',
    candidateVerificationCommands: [
      "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest --check-registry",
      'bun install --frozen-lockfile --dry-run',
      "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest",
    ],
    forbiddenActions: [
      'do_not_modify_package_json_without_publication_approval',
      'do_not_modify_bun_lock_without_install_chain_approval',
      'do_not_run_install_before_optional_packages_are_published',
      'do_not_add_native_search_optional_dependencies_before_publication',
      'do_not_treat_change_plan_as_optional_dependencies_declared',
      'do_not_treat_change_plan_as_install_chain_verified',
      'do_not_treat_change_plan_as_packaged_binary_verified',
      'do_not_enable_native_by_default_before_verified',
    ],
  }
}

export function buildNativeSearchOptionalPackagePublicationChangePlan(
  options: BuildNativeSearchOptionalPackagePublicationChangePlanOptions,
): NativeSearchOptionalPackagePublicationChangePlan {
  const packageVersion = normalizeOptionalString(options.packageVersion)
  const packageVersionValid = packageVersion != null && isReleasePackageVersion(packageVersion)
  const publishTargetVersionMatches = options.publishTarget.packageVersion === packageVersion
  const packageSourceVersionMatches = options.packageSource.packageVersion === packageVersion
  const publishTargetReady = options.publishTarget.checked
    && options.publishTarget.ready
    && publishTargetVersionMatches
  const packageSourceReady = options.packageSource.checked
    && options.packageSource.ready
    && packageSourceVersionMatches
  const optionalPackagesPublished = options.publication.published
  const blockers: NativeSearchOptionalPackagePublicationChangePlanBlocker[] = []

  if (packageVersion == null) {
    blockers.push('optional_package_publication_version_required')
  } else if (!packageVersionValid) {
    blockers.push('optional_package_publication_version_invalid')
  }

  if (optionalPackagesPublished) {
    blockers.push('optional_packages_already_published')
  } else {
    if (!publishTargetReady) blockers.push('optional_package_publish_target_not_ready')
    if (!packageSourceReady) blockers.push('optional_package_source_not_ready')
    if (!publishTargetReady || !packageSourceReady) {
      blockers.push('optional_packages_not_published')
    }
  }

  if (options.publication.publishedPackages.length > 0 && !optionalPackagesPublished) {
    blockers.push('optional_package_publication_partial')
  }
  if (options.publication.invalidPackages.length > 0) {
    blockers.push('optional_package_publication_metadata_invalid')
  }
  if (options.publication.unavailablePackages.length > 0) {
    blockers.push('optional_package_publication_state_unavailable')
  }

  return {
    schemaVersion: 1,
    status: blockers.length === 0 ? 'ready_for_review' : 'blocked',
    packageVersion,
    publishTargetReady,
    packageSourceReady,
    optionalPackagesPublished,
    approvalRequired: true,
    plannedPackages: packageVersionValid && packageVersion != null
      ? NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => ({
        packageName: plan.packageName,
        packageVersion,
      }))
      : [],
    publishedPackages: options.publication.publishedPackages,
    missingPublishedPackages: options.publication.missingPackages,
    invalidPublishedPackages: options.publication.invalidPackages,
    unavailablePublishedPackages: options.publication.unavailablePackages,
    blockedBy: uniquePublicationChangePlanBlockers(blockers),
    candidateReviewAction: 'prepare_optional_package_publication_for_review',
    candidatePreflightCommands: packageVersionValid && packageVersion != null
      ? [
        `bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version ${packageVersion} --check-registry`,
        `bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-source --native-search-package-version ${packageVersion}`,
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest --check-registry",
      ]
      : [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version <native-search-package-version> --check-registry",
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-source --native-search-package-version <native-search-package-version>",
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest --check-registry",
      ],
    candidatePublicationCommands: blockers.includes('optional_packages_already_published')
      ? []
      : NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS
        .filter((plan) => !options.publication.publishedPackages.includes(plan.packageName))
        .map((plan) => (
          `npm publish <native-search-package-source:${plan.packageName}> --access public`
        )),
    forbiddenActions: [
      'do_not_run_npm_publish_without_release_approval',
      'do_not_run_npm_pack_as_part_of_this_change_plan',
      'do_not_modify_package_json_before_publication_verified',
      'do_not_modify_bun_lock_before_publication_verified',
      'do_not_modify_electron_builder_yml_without_approval',
      'do_not_treat_publication_plan_as_packages_published',
      'do_not_treat_publication_plan_as_install_chain_verified',
      'do_not_treat_publication_plan_as_packaged_binary_verified',
      'do_not_enable_native_by_default_before_verified',
    ],
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

export function buildNativeSearchPackagingConfigAllowlistChangePlan(
  validation: NativeSearchPackagingConfigValidationResult,
): NativeSearchPackagingConfigAllowlistChangePlan {
  const requiredIncludes = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => getNativeSearchPackageIncludeRule(plan))
  const missingIncludes = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS
    .filter((plan) => validation.missingPackages.includes(plan.packageName))
    .map((plan) => getNativeSearchPackageIncludeRule(plan))
  const removalCandidates = uniqueStrings([
    ...validation.blockingExcludes,
    ...validation.tooBroadIncludes,
  ])
  const blocked = !validation.verified
    || validation.missingPackages.length > 0
    || validation.blockingExcludes.length > 0
    || validation.tooBroadIncludes.length > 0

  return {
    schemaVersion: 1,
    status: blocked ? 'blocked' : 'ready_for_review',
    currentConfigVerified: validation.verified,
    approvalRequired: true,
    requiredIncludes,
    missingIncludes,
    blockingExcludes: validation.blockingExcludes,
    tooBroadIncludes: validation.tooBroadIncludes,
    removalCandidates,
    forbiddenIncludes: [
      'node_modules/**',
      'node_modules/**/*',
      'node_modules/@codeinsights/*',
      'node_modules/@codeinsights/**',
      'node_modules/@codeinsights/**/*',
      'node_modules/@codeinsights/native-search-*',
      'node_modules/@codeinsights/native-search-*/**/*',
    ],
    candidateReviewAction: 'prepare_builder_allowlist_change_for_review',
    candidateVerificationCommands: [
      "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest",
      "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --app-node-modules-root <packaged-app-node_modules> --check-registry",
    ],
    forbiddenActions: [
      'do_not_modify_electron_builder_yml_without_approval',
      'do_not_use_broad_node_modules_include',
      'do_not_run_electron_builder_until_publication_and_install_chain_pass',
      'do_not_add_native_search_optional_dependencies_before_publication',
      'do_not_treat_allowlist_plan_as_packaging_config_verified',
      'do_not_treat_allowlist_plan_as_packaged_binary_verified',
      'do_not_enable_native_by_default_before_verified',
    ],
  }
}

export function buildNativeSearchOptionalPackageExecutionPlan(
  options: BuildNativeSearchOptionalPackageExecutionPlanOptions,
): NativeSearchOptionalPackageExecutionPlan {
  const optionalPackagePublishTargetReady = Boolean(options.optionalPackagePublishTargetChecked)
    && Boolean(options.optionalPackagePublishTargetReady)
  const optionalPackageSourceReady = Boolean(options.optionalPackageSourceChecked)
    && Boolean(options.optionalPackageSourceReady)
  const optionalPackagesPublished = Boolean(options.optionalPackagesPublished)
  const optionalDependenciesDeclared = Boolean(options.optionalDependenciesDeclared)
  const optionalDependenciesInstallChainVerified = Boolean(options.optionalDependenciesInstallChainVerified)
  const packagingConfigVerified = Boolean(options.packagingConfigVerified)
  const bundledBinaryVerified = Boolean(options.bundledBinaryVerified)
  const defaultEnableRiskReviewCompleted = Boolean(options.defaultEnableRiskReviewCompleted)

  const observedEvidenceStages: NativeSearchOptionalPackageExecutionStage[] = []
  if (optionalPackagePublishTargetReady) observedEvidenceStages.push('publish_target_preflight')
  if (optionalPackageSourceReady) observedEvidenceStages.push('package_source_preflight')
  if (optionalPackagesPublished) observedEvidenceStages.push('optional_package_publication')
  if (optionalDependenciesDeclared) observedEvidenceStages.push('optional_dependencies_declaration')
  if (optionalDependenciesInstallChainVerified) observedEvidenceStages.push('optional_package_install_chain')
  if (packagingConfigVerified) observedEvidenceStages.push('packaging_config_allowlist')
  if (bundledBinaryVerified) observedEvidenceStages.push('packaged_app_bundled_binary_smoke')
  if (defaultEnableRiskReviewCompleted) observedEvidenceStages.push('default_enable_risk_review')

  const blockedBy: NativeSearchOptionalPackageExecutionBlocker[] = []
  if (!optionalPackagePublishTargetReady) blockedBy.push('optional_package_publish_target_not_ready')
  if (!optionalPackageSourceReady) blockedBy.push('optional_package_source_not_ready')
  if (!optionalPackagesPublished) blockedBy.push('optional_packages_not_published')
  if (!optionalDependenciesDeclared) blockedBy.push('optional_dependencies_not_declared')
  if (!optionalDependenciesInstallChainVerified) blockedBy.push('optional_package_install_chain_not_verified')
  if (!packagingConfigVerified) blockedBy.push('packaging_config_not_verified')
  if (!bundledBinaryVerified) blockedBy.push('packaged_app_bundled_binary_not_verified')
  if (!defaultEnableRiskReviewCompleted) blockedBy.push('default_enable_risk_review_not_completed')

  const readyForPublication = optionalPackagePublishTargetReady && optionalPackageSourceReady
  const readyForOptionalDependencies = readyForPublication && optionalPackagesPublished
  const readyForInstallChain = readyForOptionalDependencies && optionalDependenciesDeclared
  const readyForPackagingConfigChange = readyForInstallChain && optionalDependenciesInstallChainVerified
  const readyForPackagedBundledBinarySmoke = readyForPackagingConfigChange && packagingConfigVerified
  const readyForDefaultEnableRiskReview = readyForPackagedBundledBinarySmoke && bundledBinaryVerified
  const verified = readyForDefaultEnableRiskReview && defaultEnableRiskReviewCompleted
  const nextStage = getNativeSearchOptionalPackageExecutionNextStage({
    optionalPackagePublishTargetReady,
    optionalPackageSourceReady,
    optionalPackagesPublished,
    optionalDependenciesDeclared,
    optionalDependenciesInstallChainVerified,
    packagingConfigVerified,
    bundledBinaryVerified,
    defaultEnableRiskReviewCompleted,
  })

  return {
    schemaVersion: 1,
    nextStage,
    completedPrerequisites: getNativeSearchOptionalPackageCompletedPrerequisites(nextStage),
    observedEvidenceStages,
    blockedBy,
    readyForPublication,
    readyForOptionalDependencies,
    readyForInstallChain,
    readyForPackagingConfigChange,
    readyForPackagedBundledBinarySmoke,
    readyForDefaultEnableRiskReview,
    verified,
    nextAllowedActions: getNativeSearchOptionalPackageExecutionNextActions(nextStage),
    candidateCommands: getNativeSearchOptionalPackageExecutionCandidateCommands(nextStage),
    forbiddenActions: [
      'do_not_treat_publish_target_ready_as_package_published',
      'do_not_treat_package_source_ready_as_npm_pack_or_publication',
      'do_not_declare_optional_dependencies_before_publication',
      'do_not_run_install_chain_before_optional_dependencies_are_declared',
      'do_not_modify_electron_builder_yml_without_approval',
      'do_not_use_temporary_fixture_as_real_packaged_binary_evidence',
      'do_not_enable_native_by_default_before_verified',
    ],
  }
}

function normalizePackageNameList(values: string[], expectedPackages: string[]): string[] {
  return values.filter((value, index) => (
    expectedPackages.includes(value) && values.indexOf(value) === index
  ))
}

function getNativeSearchOptionalPackageExecutionNextStage(options: {
  optionalPackagePublishTargetReady: boolean
  optionalPackageSourceReady: boolean
  optionalPackagesPublished: boolean
  optionalDependenciesDeclared: boolean
  optionalDependenciesInstallChainVerified: boolean
  packagingConfigVerified: boolean
  bundledBinaryVerified: boolean
  defaultEnableRiskReviewCompleted: boolean
}): NativeSearchOptionalPackageExecutionStage {
  if (!options.optionalPackagePublishTargetReady) return 'publish_target_preflight'
  if (!options.optionalPackageSourceReady) return 'package_source_preflight'
  if (!options.optionalPackagesPublished) return 'optional_package_publication'
  if (!options.optionalDependenciesDeclared) return 'optional_dependencies_declaration'
  if (!options.optionalDependenciesInstallChainVerified) return 'optional_package_install_chain'
  if (!options.packagingConfigVerified) return 'packaging_config_allowlist'
  if (!options.bundledBinaryVerified) return 'packaged_app_bundled_binary_smoke'
  if (!options.defaultEnableRiskReviewCompleted) return 'default_enable_risk_review'
  return 'complete'
}

function getNativeSearchOptionalPackageCompletedPrerequisites(
  stage: NativeSearchOptionalPackageExecutionStage,
): NativeSearchOptionalPackageExecutionStage[] {
  const orderedStages: NativeSearchOptionalPackageExecutionStage[] = [
    'publish_target_preflight',
    'package_source_preflight',
    'optional_package_publication',
    'optional_dependencies_declaration',
    'optional_package_install_chain',
    'packaging_config_allowlist',
    'packaged_app_bundled_binary_smoke',
    'default_enable_risk_review',
  ]
  const stageIndex = orderedStages.indexOf(stage)
  return stageIndex < 0 ? orderedStages : orderedStages.slice(0, stageIndex)
}

function getNativeSearchOptionalPackageExecutionNextActions(
  stage: NativeSearchOptionalPackageExecutionStage,
): string[] {
  switch (stage) {
    case 'publish_target_preflight':
      return ['run_optional_package_publish_target_dry_run_with_explicit_registry_check']
    case 'package_source_preflight':
      return ['run_optional_package_source_preflight']
    case 'optional_package_publication':
      return ['publish_optional_packages_after_release_approval']
    case 'optional_dependencies_declaration':
      return ['declare_native_search_optional_dependencies_after_publication']
    case 'optional_package_install_chain':
      return ['run_install_chain_after_optional_dependencies_are_declared']
    case 'packaging_config_allowlist':
      return ['prepare_electron_builder_native_search_allowlist_change_for_review']
    case 'packaged_app_bundled_binary_smoke':
      return ['run_packaged_app_bundled_binary_smoke_against_prebuilt_app']
    case 'default_enable_risk_review':
      return ['complete_default_enable_risk_review_after_packaged_smoke']
    case 'complete':
      return []
  }
}

function getNativeSearchOptionalPackageExecutionCandidateCommands(
  stage: NativeSearchOptionalPackageExecutionStage,
): string[] {
  switch (stage) {
    case 'publish_target_preflight':
      return [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version <native-search-package-version> --check-registry",
      ]
    case 'package_source_preflight':
      return [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-source --native-search-package-version <native-search-package-version>",
      ]
    case 'optional_package_publication':
      return [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest --check-registry",
      ]
    case 'optional_dependencies_declaration':
    case 'optional_package_install_chain':
    case 'packaging_config_allowlist':
      return [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest",
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --app-node-modules-root <packaged-app-node_modules> --check-registry",
      ]
    case 'default_enable_risk_review':
      return [
        "bun run --filter='@codeinsights/electron' native-runtime:benchmark",
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --app-node-modules-root <packaged-app-node_modules> --check-registry",
      ]
    case 'complete':
      return []
  }
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

function getNativeSearchPackageIncludeRule(plan: NativeSearchOptionalPackagePlan): string {
  return `${getNativeSearchPackageRoot(plan)}/**/*`
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

function uniqueInstallChainPlanBlockers(
  blockers: NativeSearchOptionalDependenciesInstallChainChangePlanBlocker[],
): NativeSearchOptionalDependenciesInstallChainChangePlanBlocker[] {
  return blockers.filter((blocker, index) => blockers.indexOf(blocker) === index)
}

function uniquePublicationChangePlanBlockers(
  blockers: NativeSearchOptionalPackagePublicationChangePlanBlocker[],
): NativeSearchOptionalPackagePublicationChangePlanBlocker[] {
  return blockers.filter((blocker, index) => blockers.indexOf(blocker) === index)
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index)
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
