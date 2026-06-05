import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'
import { redactNativeRuntimeText } from '../src/main/lib/native-runtime/native-runtime-diagnostics'
import {
  getNativeRuntimeCacheDir,
  getNativeRuntimeCacheManifestPath,
  readNativeRuntimeCacheManifest,
} from '../src/main/lib/native-runtime/native-runtime-cache-schema'
import {
  evaluateNativeSearchDefaultEnableReadiness,
  type NativeSearchDefaultEnableReadiness,
} from '../src/main/lib/native-runtime/native-runtime-default-enable-readiness'
import {
  buildNativeSearchPackageManifest,
  getNativeSearchOptionalDependencyExpectedVersions,
  getNativeSearchOptionalPackagePlan,
  isNativeSearchPackageManifest,
  NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS,
  validateNativeSearchOptionalPackagePublication,
  validateNativeSearchOptionalPackageSources,
  validateNativeSearchOptionalPackagePublishTarget,
  validateNativeSearchPackagingConfig,
  validateNativeSearchOptionalPackageInstallChain,
  buildNativeSearchOptionalPackageExecutionPlan,
  type NativeSearchOptionalPackageSourceBlocker,
  type NativeSearchOptionalPackageSourceValidationResult,
  type NativeSearchOptionalPackagePublishTargetBlocker,
  type NativeSearchOptionalPackagePublishTargetValidationResult,
  type NativeSearchOptionalPackagePublicationValidationResult,
  type NativeSearchPackagingConfigValidationResult,
  type NativeSearchOptionalPackageInstallChainValidationResult,
  type NativeSearchOptionalDependenciesValidationResult,
  type NativeSearchOptionalPackageExecutionPlan,
} from '../src/main/lib/native-runtime/native-runtime-package-manifest'
import {
  NativeSearchPackageResolutionError,
  resolveNativeSearchPackage,
} from '../src/main/lib/native-runtime/native-runtime-package-resolver'
import { NativeRuntimeSidecarManager } from '../src/main/lib/native-runtime/native-runtime-sidecar-manager'
import { TypeScriptEventSearchService } from '../src/main/lib/native-runtime/ts-event-search-service'

export type NativeRuntimeSmokeMode =
  | 'native-missing'
  | 'native-available'
  | 'protocol-mismatch'
  | 'crash'
  | 'timeout'
  | 'cache-corruption'
  | 'packaged-manifest'
  | 'packaged-app-layout'
  | 'optional-package-source'
  | 'optional-package-publish-target'

export interface NativeRuntimeSmokeOptions {
  mode: NativeRuntimeSmokeMode
  nativeSearchBinary?: string
  appNodeModulesRoot?: string
  nativeSearchPackageVersion?: string
  checkRegistry?: boolean
  query: string
  env?: NodeJS.ProcessEnv
}

export interface NativeRuntimeSmokeCase {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  detail?: string
}

export type PackagedBundledBinarySmokePlanStatus = 'blocked' | 'ready' | 'verified'

export type PackagedBundledBinarySmokePlanBlocker =
  | 'optional_packages_not_published'
  | 'optional_dependencies_not_declared'
  | 'optional_package_install_chain_not_verified'
  | 'packaging_config_not_verified'
  | 'prebuilt_packaged_app_required'
  | 'packaged_app_layout_not_verified'
  | 'packaged_app_evidence_not_verified'
  | 'packaged_app_identity_not_verified'
  | 'temporary_fixture_not_allowed'

export interface PackagedBundledBinarySmokePlan {
  schemaVersion: 1
  status: PackagedBundledBinarySmokePlanStatus
  blockedBy: PackagedBundledBinarySmokePlanBlocker[]
  requiredInputs: string[]
  nextAllowedActions: string[]
  forbiddenActions: string[]
  candidateCommand: string
}

export interface NativeRuntimeSmokeSummary {
  schemaVersion: number
  generatedAt: string
  mode: NativeRuntimeSmokeMode
  nativeSearchBinaryProvided: boolean
  appNodeModulesRootProvided: boolean
  bundledBinaryVerified: boolean
  fixtureBundledPackageVerified: boolean
  usesTemporaryFixture: boolean
  packagedAppLayoutVerified: boolean
  packagedAppEvidenceVerified: boolean
  packagedAppIdentityVerified: boolean
  optionalDependenciesDeclared: boolean
  optionalPackagePublicationChecked: boolean
  optionalPackagesPublished: boolean
  optionalDependenciesInstallChainVerified: boolean
  optionalDependenciesLockfileVerified: boolean
  optionalDependenciesInstalledPackagesVerified: boolean
  packagingConfigVerified: boolean
  missingOptionalDependencies: string[]
  invalidOptionalDependencies: string[]
  missingPublishedOptionalPackages: string[]
  invalidPublishedOptionalPackages: string[]
  unavailablePublishedOptionalPackages: string[]
  optionalPackagePublishTargetChecked: boolean
  optionalPackagePublishTargetReady: boolean
  optionalPackagePublishTargetVersion: string | null
  optionalPackagePublishTargetBlockers: NativeSearchOptionalPackagePublishTargetBlocker[]
  optionalPackageSourceChecked: boolean
  optionalPackageSourceReady: boolean
  optionalPackageSourceVersion: string | null
  optionalPackageSourceBlockers: NativeSearchOptionalPackageSourceBlocker[]
  optionalPackageSourceReadyPackages: string[]
  missingOptionalPackageSourcePackages: string[]
  invalidOptionalPackageSourcePackages: string[]
  plannedOptionalPackageSourceManifestsVerified: boolean
  publishTargetAvailablePackages: string[]
  publishedVersionCollisionPackages: string[]
  invalidPublishTargetPackages: string[]
  unavailablePublishTargetPackages: string[]
  nativeSearchVersionConsistencyVerified: boolean
  nativeSearchCargoVersion: string | null
  nativeSearchBinaryVersion: string | null
  plannedOptionalPackageManifestsVerified: boolean
  missingOptionalDependencyLockfilePackages: string[]
  missingInstalledOptionalDependencies: string[]
  invalidInstalledOptionalDependencies: string[]
  missingPackagingConfigPackages: string[]
  blockingPackagingConfigExcludes: string[]
  tooBroadPackagingConfigIncludes: string[]
  realPackagedBinaryVerified: boolean
  optionalPackageExecutionPlan: NativeSearchOptionalPackageExecutionPlan
  packagedBundledBinarySmokePlan: PackagedBundledBinarySmokePlan
  nativeSearchDefaultEnableReadiness: NativeSearchDefaultEnableReadiness
  requiresPrebuiltPackagedApp: boolean
  cases: NativeRuntimeSmokeCase[]
}

interface NativeRuntimeSmokeVerification {
  bundledBinaryVerified?: boolean
  fixtureBundledPackageVerified?: boolean
  usesTemporaryFixture?: boolean
  packagedAppLayoutVerified?: boolean
  packagedAppEvidenceVerified?: boolean
  packagedAppIdentityVerified?: boolean
  optionalDependenciesDeclared?: boolean
  optionalPackagePublicationChecked?: boolean
  optionalPackagesPublished?: boolean
  optionalDependenciesInstallChainVerified?: boolean
  optionalDependenciesLockfileVerified?: boolean
  optionalDependenciesInstalledPackagesVerified?: boolean
  packagingConfigVerified?: boolean
  missingOptionalDependencies?: string[]
  invalidOptionalDependencies?: string[]
  missingPublishedOptionalPackages?: string[]
  invalidPublishedOptionalPackages?: string[]
  unavailablePublishedOptionalPackages?: string[]
  optionalPackagePublishTargetChecked?: boolean
  optionalPackagePublishTargetReady?: boolean
  optionalPackagePublishTargetVersion?: string | null
  optionalPackagePublishTargetBlockers?: NativeSearchOptionalPackagePublishTargetBlocker[]
  optionalPackageSourceChecked?: boolean
  optionalPackageSourceReady?: boolean
  optionalPackageSourceVersion?: string | null
  optionalPackageSourceBlockers?: NativeSearchOptionalPackageSourceBlocker[]
  optionalPackageSourceReadyPackages?: string[]
  missingOptionalPackageSourcePackages?: string[]
  invalidOptionalPackageSourcePackages?: string[]
  plannedOptionalPackageSourceManifestsVerified?: boolean
  publishTargetAvailablePackages?: string[]
  publishedVersionCollisionPackages?: string[]
  invalidPublishTargetPackages?: string[]
  unavailablePublishTargetPackages?: string[]
  nativeSearchVersionConsistencyVerified?: boolean
  nativeSearchCargoVersion?: string | null
  nativeSearchBinaryVersion?: string | null
  plannedOptionalPackageManifestsVerified?: boolean
  missingOptionalDependencyLockfilePackages?: string[]
  missingInstalledOptionalDependencies?: string[]
  invalidInstalledOptionalDependencies?: string[]
  missingPackagingConfigPackages?: string[]
  blockingPackagingConfigExcludes?: string[]
  tooBroadPackagingConfigIncludes?: string[]
  realPackagedBinaryVerified?: boolean
  requiresPrebuiltPackagedApp?: boolean
}

const DEFAULT_OPTIONS: NativeRuntimeSmokeOptions = {
  mode: 'native-missing',
  query: '关键字',
}

export function parseNativeRuntimeSmokeArgs(args: string[]): NativeRuntimeSmokeOptions {
  const options: NativeRuntimeSmokeOptions = { ...DEFAULT_OPTIONS }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--check-registry') {
      options.checkRegistry = true
      continue
    }

    const value = args[index + 1]
    if (!value) continue

    if (arg === '--mode') {
      options.mode = parseSmokeMode(value)
      index += 1
    } else if (arg === '--native-search-binary') {
      options.nativeSearchBinary = value
      index += 1
    } else if (arg === '--app-node-modules-root') {
      options.appNodeModulesRoot = value
      index += 1
    } else if (arg === '--native-search-package-version') {
      options.nativeSearchPackageVersion = value
      index += 1
    } else if (arg === '--query') {
      options.query = value
      index += 1
    }
  }

  if (!options.nativeSearchBinary) {
    const envBinary = process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY?.trim()
    if (envBinary) options.nativeSearchBinary = envBinary
  }

  return options
}

export function buildNativeRuntimeSmokeSummary(input: {
  mode: NativeRuntimeSmokeMode
  nativeSearchBinary?: string
  appNodeModulesRoot?: string
  verification?: NativeRuntimeSmokeVerification
  cases: NativeRuntimeSmokeCase[]
}): NativeRuntimeSmokeSummary {
  const verification = input.verification ?? {}
  const optionalDependenciesDeclared = Boolean(verification.optionalDependenciesDeclared)
  const optionalPackagePublicationChecked = Boolean(verification.optionalPackagePublicationChecked)
  const optionalPackagesPublished = optionalPackagePublicationChecked
    && Boolean(verification.optionalPackagesPublished)
  const optionalPackagePublishTargetChecked = Boolean(verification.optionalPackagePublishTargetChecked)
  const optionalPackagePublishTargetReady = optionalPackagePublishTargetChecked
    && Boolean(verification.optionalPackagePublishTargetReady)
  const optionalPackageSourceChecked = Boolean(verification.optionalPackageSourceChecked)
  const optionalPackageSourceReady = optionalPackageSourceChecked
    && Boolean(verification.optionalPackageSourceReady)
  const optionalDependenciesInstallChainVerified = optionalDependenciesDeclared
    && Boolean(verification.optionalDependenciesInstallChainVerified)
  const packagingConfigVerified = Boolean(verification.packagingConfigVerified)
  const packagedAppEvidenceVerified = Boolean(verification.packagedAppEvidenceVerified)
  const packagedAppIdentityVerified = Boolean(verification.packagedAppIdentityVerified)
  const usesTemporaryFixture = Boolean(verification.usesTemporaryFixture)
  const realPackagedBinaryVerified = !usesTemporaryFixture
    && optionalDependenciesInstallChainVerified
    && optionalPackagesPublished
    && packagingConfigVerified
    && packagedAppEvidenceVerified
    && packagedAppIdentityVerified
    && Boolean(verification.realPackagedBinaryVerified)
  const bundledBinaryVerified = realPackagedBinaryVerified
    && Boolean(verification.bundledBinaryVerified)
  const optionalPackageExecutionPlan = buildNativeSearchOptionalPackageExecutionPlan({
    optionalPackagePublishTargetChecked,
    optionalPackagePublishTargetReady,
    optionalPackageSourceChecked,
    optionalPackageSourceReady,
    optionalPackagesPublished,
    optionalDependenciesDeclared,
    optionalDependenciesInstallChainVerified,
    packagingConfigVerified,
    bundledBinaryVerified,
    defaultEnableRiskReviewCompleted: false,
  })
  const packagedBundledBinarySmokePlan = buildPackagedBundledBinarySmokePlan({
    appNodeModulesRootProvided: Boolean(input.appNodeModulesRoot),
    optionalPackagesPublished,
    optionalDependenciesDeclared,
    optionalDependenciesInstallChainVerified,
    packagingConfigVerified,
    packagedAppLayoutVerified: Boolean(verification.packagedAppLayoutVerified),
    packagedAppEvidenceVerified,
    packagedAppIdentityVerified,
    usesTemporaryFixture,
    realPackagedBinaryVerified,
    bundledBinaryVerified,
  })
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    nativeSearchBinaryProvided: Boolean(input.nativeSearchBinary),
    appNodeModulesRootProvided: Boolean(input.appNodeModulesRoot),
    bundledBinaryVerified,
    fixtureBundledPackageVerified: Boolean(verification.fixtureBundledPackageVerified),
    usesTemporaryFixture,
    packagedAppLayoutVerified: Boolean(verification.packagedAppLayoutVerified),
    packagedAppEvidenceVerified,
    packagedAppIdentityVerified,
    optionalDependenciesDeclared,
    optionalPackagePublicationChecked,
    optionalPackagesPublished,
    optionalDependenciesInstallChainVerified,
    optionalDependenciesLockfileVerified: optionalDependenciesDeclared
      && Boolean(verification.optionalDependenciesLockfileVerified),
    optionalDependenciesInstalledPackagesVerified: optionalDependenciesDeclared
      && Boolean(verification.optionalDependenciesInstalledPackagesVerified),
    packagingConfigVerified,
    missingOptionalDependencies: verification.missingOptionalDependencies ?? [],
    invalidOptionalDependencies: verification.invalidOptionalDependencies ?? [],
    missingPublishedOptionalPackages: verification.missingPublishedOptionalPackages ?? [],
    invalidPublishedOptionalPackages: verification.invalidPublishedOptionalPackages ?? [],
    unavailablePublishedOptionalPackages: verification.unavailablePublishedOptionalPackages ?? [],
    optionalPackagePublishTargetChecked,
    optionalPackagePublishTargetReady,
    optionalPackagePublishTargetVersion: verification.optionalPackagePublishTargetVersion ?? null,
    optionalPackagePublishTargetBlockers: verification.optionalPackagePublishTargetBlockers ?? [],
    optionalPackageSourceChecked,
    optionalPackageSourceReady,
    optionalPackageSourceVersion: verification.optionalPackageSourceVersion ?? null,
    optionalPackageSourceBlockers: verification.optionalPackageSourceBlockers ?? [],
    optionalPackageSourceReadyPackages: verification.optionalPackageSourceReadyPackages ?? [],
    missingOptionalPackageSourcePackages: verification.missingOptionalPackageSourcePackages ?? [],
    invalidOptionalPackageSourcePackages: verification.invalidOptionalPackageSourcePackages ?? [],
    plannedOptionalPackageSourceManifestsVerified: Boolean(verification.plannedOptionalPackageSourceManifestsVerified),
    publishTargetAvailablePackages: verification.publishTargetAvailablePackages ?? [],
    publishedVersionCollisionPackages: verification.publishedVersionCollisionPackages ?? [],
    invalidPublishTargetPackages: verification.invalidPublishTargetPackages ?? [],
    unavailablePublishTargetPackages: verification.unavailablePublishTargetPackages ?? [],
    nativeSearchVersionConsistencyVerified: Boolean(verification.nativeSearchVersionConsistencyVerified),
    nativeSearchCargoVersion: verification.nativeSearchCargoVersion ?? null,
    nativeSearchBinaryVersion: verification.nativeSearchBinaryVersion ?? null,
    plannedOptionalPackageManifestsVerified: Boolean(verification.plannedOptionalPackageManifestsVerified),
    missingOptionalDependencyLockfilePackages: verification.missingOptionalDependencyLockfilePackages ?? [],
    missingInstalledOptionalDependencies: verification.missingInstalledOptionalDependencies ?? [],
    invalidInstalledOptionalDependencies: verification.invalidInstalledOptionalDependencies ?? [],
    missingPackagingConfigPackages: verification.missingPackagingConfigPackages ?? [],
    blockingPackagingConfigExcludes: verification.blockingPackagingConfigExcludes ?? [],
    tooBroadPackagingConfigIncludes: verification.tooBroadPackagingConfigIncludes ?? [],
    realPackagedBinaryVerified,
    optionalPackageExecutionPlan,
    packagedBundledBinarySmokePlan,
    nativeSearchDefaultEnableReadiness: evaluateNativeSearchDefaultEnableReadiness({
      benchmarkEvaluated: false,
      benchmarkGatePassed: false,
      agentFacadeNativeExtractorDeclared: false,
      agentFacadeNativeParityEvaluated: false,
      optionalPackagesPublished,
      optionalDependenciesDeclared,
      optionalDependenciesInstallChainVerified,
      packagingConfigVerified,
      packagedAppEvidenceVerified,
      packagedAppIdentityVerified,
      realPackagedBinaryVerified,
      riskReviewCompleted: false,
    }),
    requiresPrebuiltPackagedApp: Boolean(verification.requiresPrebuiltPackagedApp),
    cases: input.cases.map((smokeCase) => ({
      ...smokeCase,
      detail: smokeCase.detail ? redactNativeRuntimeText(smokeCase.detail) : undefined,
    })),
  }
}

function buildPackagedBundledBinarySmokePlan(input: {
  appNodeModulesRootProvided: boolean
  optionalPackagesPublished: boolean
  optionalDependenciesDeclared: boolean
  optionalDependenciesInstallChainVerified: boolean
  packagingConfigVerified: boolean
  packagedAppLayoutVerified: boolean
  packagedAppEvidenceVerified: boolean
  packagedAppIdentityVerified: boolean
  usesTemporaryFixture: boolean
  realPackagedBinaryVerified: boolean
  bundledBinaryVerified: boolean
}): PackagedBundledBinarySmokePlan {
  const blockedBy: PackagedBundledBinarySmokePlanBlocker[] = []

  if (!input.optionalPackagesPublished) blockedBy.push('optional_packages_not_published')
  if (!input.optionalDependenciesDeclared) blockedBy.push('optional_dependencies_not_declared')
  if (!input.optionalDependenciesInstallChainVerified) blockedBy.push('optional_package_install_chain_not_verified')
  if (!input.packagingConfigVerified) blockedBy.push('packaging_config_not_verified')

  if (!input.appNodeModulesRootProvided) {
    blockedBy.push('prebuilt_packaged_app_required')
  } else {
    if (!input.packagedAppLayoutVerified) blockedBy.push('packaged_app_layout_not_verified')
    if (!input.packagedAppEvidenceVerified) blockedBy.push('packaged_app_evidence_not_verified')
    if (!input.packagedAppIdentityVerified) blockedBy.push('packaged_app_identity_not_verified')
    if (input.usesTemporaryFixture) blockedBy.push('temporary_fixture_not_allowed')
  }

  return {
    schemaVersion: 1,
    status: input.bundledBinaryVerified && blockedBy.length === 0
      ? 'verified'
      : blockedBy.length === 0 ? 'ready' : 'blocked',
    blockedBy,
    requiredInputs: [
      'published_optional_packages',
      'native_search_optional_dependencies',
      'optional_dependency_install_chain',
      'electron_builder_native_search_allowlist',
      'prebuilt_packaged_app_node_modules_root',
      'packaged_app_identity',
      'bundled_native_search_binary',
    ],
    nextAllowedActions: [
      'publish_optional_packages_after_release_approval',
      'declare_optional_dependencies_after_packages_are_published',
      'run_install_chain_after_optional_dependencies_are_declared',
      'prepare_builder_allowlist_change_for_review',
      'run_candidate_command_against_real_packaged_app',
    ],
    forbiddenActions: [
      'do_not_enable_native_by_default_before_verified',
      'do_not_use_temporary_fixture_as_real_packaged_binary_evidence',
      'do_not_use_system_path_for_native_binary',
      'do_not_output_binary_path_or_packaged_root',
      'do_not_modify_electron_builder_yml_without_approval',
      'do_not_add_native_search_optional_dependencies_before_publication',
    ],
    candidateCommand: "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --app-node-modules-root <packaged-app-node_modules> --check-registry",
  }
}

export function getNativeRuntimeSmokeExitCode(summary: NativeRuntimeSmokeSummary): 0 | 1 {
  return summary.cases.some((smokeCase) => smokeCase.status === 'failed') ? 1 : 0
}

export async function runNativeRuntimeSmoke(options: NativeRuntimeSmokeOptions): Promise<NativeRuntimeSmokeSummary> {
  const rootDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-smoke-'))
  const previousConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  const cases: NativeRuntimeSmokeCase[] = []
  let verification: NativeRuntimeSmokeVerification = {}

  try {
    process.env.CODEINSIGHTS_CONFIG_DIR = join(rootDir, 'config')
    mkdirSync(process.env.CODEINSIGHTS_CONFIG_DIR, { recursive: true })
    const fixturePath = join(rootDir, 'chat.jsonl')
    writeFileSync(fixturePath, `${JSON.stringify({
      id: 'msg-1',
      role: 'assistant',
      content: `这里包含${options.query}`,
      createdAt: 1,
    })}\n`, 'utf-8')

    cases.push(await runTypeScriptFallbackCase(fixturePath, options.query))

    if (options.mode === 'native-missing') {
      cases.push(await runNativeMissingCase(options.nativeSearchBinary ?? join(rootDir, 'missing-native-search')))
    } else if (options.mode === 'native-available') {
      cases.push(await runNativeAvailableCase(options.nativeSearchBinary, fixturePath, options.query, options.env))
    } else if (options.mode === 'protocol-mismatch') {
      cases.push(await runFakeSidecarFallbackCase({
        mode: options.mode,
        scenario: 'protocol-mismatch',
        fixturePath,
        query: options.query,
        expectedFallbackReason: 'version_mismatch',
      }))
    } else if (options.mode === 'crash') {
      cases.push(await runFakeSidecarFallbackCase({
        mode: options.mode,
        scenario: 'crash',
        fixturePath,
        query: options.query,
        expectedFallbackReason: 'crashed',
      }))
    } else if (options.mode === 'timeout') {
      cases.push(await runFakeSidecarFallbackCase({
        mode: options.mode,
        scenario: 'timeout',
        fixturePath,
        query: options.query,
        expectedFallbackReason: 'timeout',
      }))
    } else if (options.mode === 'cache-corruption') {
      cases.push(await runCacheCorruptionCase())
    } else if (options.mode === 'packaged-manifest') {
      cases.push(runPackagedManifestPreflightCase())
      const optionalDependenciesInstallChain = readCurrentNativeSearchOptionalPackageInstallChain()
      const optionalDependenciesResult = optionalDependenciesInstallChain.optionalDependencies
      const optionalPackagePublication = await readNativeSearchOptionalPackagePublication(options.checkRegistry === true)
      const packagingConfig = readCurrentNativeSearchPackagingConfig()
      cases.push(buildPackagedOptionalPackagePublicationPreflightCase(
        optionalPackagePublication,
        options.checkRegistry === true,
      ))
      cases.push(runPackagedOptionalDependenciesPreflightCase(optionalDependenciesResult))
      cases.push(runPackagedOptionalDependenciesInstallChainPreflightCase(optionalDependenciesInstallChain))
      cases.push(buildPackagedPackagingConfigPreflightCase(
        packagingConfig,
        optionalDependenciesResult.presentPackages.length > 0,
      ))
      cases.push(runPackagedResolverFixtureCase(rootDir))
      verification = {
        bundledBinaryVerified: false,
        fixtureBundledPackageVerified: true,
        usesTemporaryFixture: true,
        optionalPackagePublicationChecked: options.checkRegistry === true,
        optionalPackagesPublished: optionalPackagePublication.published,
        optionalDependenciesDeclared: optionalDependenciesResult.declared,
        optionalDependenciesInstallChainVerified: optionalDependenciesInstallChain.verified,
        optionalDependenciesLockfileVerified: optionalDependenciesInstallChain.lockfileVerified,
        optionalDependenciesInstalledPackagesVerified: optionalDependenciesInstallChain.installedPackagesVerified,
        packagingConfigVerified: packagingConfig.verified,
        missingPublishedOptionalPackages: options.checkRegistry === true
          ? optionalPackagePublication.missingPackages
          : [],
        invalidPublishedOptionalPackages: options.checkRegistry === true
          ? optionalPackagePublication.invalidPackages
          : [],
        unavailablePublishedOptionalPackages: options.checkRegistry === true
          ? optionalPackagePublication.unavailablePackages
          : [],
        missingOptionalDependencies: optionalDependenciesResult.missingPackages,
        invalidOptionalDependencies: optionalDependenciesResult.invalidPackages,
        missingOptionalDependencyLockfilePackages: optionalDependenciesInstallChain.missingLockfilePackages,
        missingInstalledOptionalDependencies: optionalDependenciesInstallChain.missingInstalledPackages,
        invalidInstalledOptionalDependencies: optionalDependenciesInstallChain.invalidInstalledPackages,
        missingPackagingConfigPackages: packagingConfig.missingPackages,
        blockingPackagingConfigExcludes: packagingConfig.blockingExcludes,
        tooBroadPackagingConfigIncludes: packagingConfig.tooBroadIncludes,
        realPackagedBinaryVerified: false,
      }
    } else if (options.mode === 'optional-package-publish-target') {
      const publishTarget = await readNativeSearchOptionalPackagePublishTarget(
        options.nativeSearchPackageVersion,
        options.checkRegistry === true,
      )
      const packageSource = readNativeSearchOptionalPackageSource(options.nativeSearchPackageVersion)
      cases.push(buildOptionalPackagePublishTargetPreflightCase(publishTarget))
      cases.push(buildOptionalPackageSourcePreflightCase(packageSource))
      verification = {
        optionalPackagePublishTargetChecked: publishTarget.checked,
        optionalPackagePublishTargetReady: publishTarget.ready,
        optionalPackagePublishTargetVersion: publishTarget.packageVersion,
        optionalPackagePublishTargetBlockers: publishTarget.blockers,
        optionalPackageSourceChecked: packageSource.checked,
        optionalPackageSourceReady: packageSource.ready,
        optionalPackageSourceVersion: packageSource.packageVersion,
        optionalPackageSourceBlockers: packageSource.blockers,
        optionalPackageSourceReadyPackages: packageSource.readyPackages,
        missingOptionalPackageSourcePackages: packageSource.missingPackages,
        invalidOptionalPackageSourcePackages: packageSource.invalidPackages,
        plannedOptionalPackageSourceManifestsVerified: packageSource.plannedOptionalPackageManifestsVerified,
        publishTargetAvailablePackages: publishTarget.availablePackages,
        publishedVersionCollisionPackages: publishTarget.publishedVersionCollisionPackages,
        invalidPublishTargetPackages: publishTarget.invalidPackages,
        unavailablePublishTargetPackages: publishTarget.unavailablePackages,
        nativeSearchVersionConsistencyVerified: publishTarget.nativeSearchVersionConsistencyVerified,
        nativeSearchCargoVersion: publishTarget.nativeSearchCargoVersion,
        nativeSearchBinaryVersion: publishTarget.nativeSearchBinaryVersion,
        plannedOptionalPackageManifestsVerified: publishTarget.plannedOptionalPackageManifestsVerified,
        realPackagedBinaryVerified: false,
      }
    } else if (options.mode === 'optional-package-source') {
      const packageSource = readNativeSearchOptionalPackageSource(options.nativeSearchPackageVersion)
      cases.push(buildOptionalPackageSourcePreflightCase(packageSource))
      verification = {
        optionalPackageSourceChecked: packageSource.checked,
        optionalPackageSourceReady: packageSource.ready,
        optionalPackageSourceVersion: packageSource.packageVersion,
        optionalPackageSourceBlockers: packageSource.blockers,
        optionalPackageSourceReadyPackages: packageSource.readyPackages,
        missingOptionalPackageSourcePackages: packageSource.missingPackages,
        invalidOptionalPackageSourcePackages: packageSource.invalidPackages,
        plannedOptionalPackageSourceManifestsVerified: packageSource.plannedOptionalPackageManifestsVerified,
        realPackagedBinaryVerified: false,
      }
    } else if (options.mode === 'packaged-app-layout') {
      const optionalPackagePublication = await readNativeSearchOptionalPackagePublication(options.checkRegistry === true)
      const packagedAppResult = runPackagedAppLayoutCase(
        options.appNodeModulesRoot,
        options.checkRegistry === true,
        optionalPackagePublication,
      )
      cases.push(buildPackagedOptionalPackagePublicationPreflightCase(
        optionalPackagePublication,
        options.checkRegistry === true,
      ))
      cases.push(packagedAppResult.case)
      verification = {
        bundledBinaryVerified: packagedAppResult.realPackagedBinaryVerified,
        fixtureBundledPackageVerified: false,
        usesTemporaryFixture: packagedAppResult.usesTemporaryFixture,
        packagedAppLayoutVerified: packagedAppResult.layoutVerified,
        packagedAppEvidenceVerified: packagedAppResult.packagedAppEvidenceVerified,
        packagedAppIdentityVerified: packagedAppResult.packagedAppIdentityVerified,
        optionalPackagePublicationChecked: packagedAppResult.optionalPackagePublicationChecked,
        optionalPackagesPublished: packagedAppResult.optionalPackagesPublished,
        optionalDependenciesDeclared: packagedAppResult.optionalDependenciesDeclared,
        optionalDependenciesInstallChainVerified: packagedAppResult.optionalDependenciesInstallChainVerified,
        optionalDependenciesLockfileVerified: packagedAppResult.optionalDependenciesLockfileVerified,
        optionalDependenciesInstalledPackagesVerified: packagedAppResult.optionalDependenciesInstalledPackagesVerified,
        packagingConfigVerified: packagedAppResult.packagingConfigVerified,
        missingPublishedOptionalPackages: packagedAppResult.missingPublishedOptionalPackages,
        invalidPublishedOptionalPackages: packagedAppResult.invalidPublishedOptionalPackages,
        unavailablePublishedOptionalPackages: packagedAppResult.unavailablePublishedOptionalPackages,
        missingOptionalDependencies: packagedAppResult.missingOptionalDependencies,
        invalidOptionalDependencies: packagedAppResult.invalidOptionalDependencies,
        missingOptionalDependencyLockfilePackages: packagedAppResult.missingOptionalDependencyLockfilePackages,
        missingInstalledOptionalDependencies: packagedAppResult.missingInstalledOptionalDependencies,
        invalidInstalledOptionalDependencies: packagedAppResult.invalidInstalledOptionalDependencies,
        missingPackagingConfigPackages: packagedAppResult.missingPackagingConfigPackages,
        blockingPackagingConfigExcludes: packagedAppResult.blockingPackagingConfigExcludes,
        tooBroadPackagingConfigIncludes: packagedAppResult.tooBroadPackagingConfigIncludes,
        realPackagedBinaryVerified: packagedAppResult.realPackagedBinaryVerified,
        requiresPrebuiltPackagedApp: true,
      }
    } else {
      cases.push({
        name: options.mode,
        status: 'skipped',
        detail: `${options.mode} smoke 尚未接入真实 packaged fixture，本轮只保留计划入口。`,
      })
    }

    return buildNativeRuntimeSmokeSummary({
      mode: options.mode,
      nativeSearchBinary: options.nativeSearchBinary,
      appNodeModulesRoot: options.appNodeModulesRoot,
      verification,
      cases,
    })
  } finally {
    if (previousConfigDir == null) {
      delete process.env.CODEINSIGHTS_CONFIG_DIR
    } else {
      process.env.CODEINSIGHTS_CONFIG_DIR = previousConfigDir
    }
    rmSync(rootDir, { recursive: true, force: true })
  }
}

interface FakeSidecarFallbackCaseOptions {
  mode: NativeRuntimeSmokeMode
  scenario: 'protocol-mismatch' | 'crash' | 'timeout'
  fixturePath: string
  query: string
  expectedFallbackReason: 'version_mismatch' | 'crashed' | 'timeout'
}

async function runTypeScriptFallbackCase(filePath: string, query: string): Promise<NativeRuntimeSmokeCase> {
  const service = new TypeScriptEventSearchService()
  const result = await service.searchMatchesInSource<Record<string, unknown>, string>({
    requestId: 'native-runtime-smoke-ts-fallback',
    query,
    filePath,
    sourceKind: 'chat_message',
    sourceId: 'smoke-chat',
    title: 'Smoke Chat',
    limit: 10,
    getRecordId: (record) => typeof record.id === 'string' ? record.id : '',
    getRecordText: (record) => typeof record.content === 'string' ? record.content : null,
    toLegacyResult: ({ record }) => typeof record.id === 'string' ? record.id : '',
  })

  return {
    name: 'typescript-fallback-search',
    status: result.searchResult.matches.length > 0 ? 'passed' : 'failed',
    detail: `TS fallback matches=${result.searchResult.matches.length}`,
  }
}

async function runNativeMissingCase(binaryPath: string): Promise<NativeRuntimeSmokeCase> {
  const manager = new NativeRuntimeSidecarManager({ binaryPath })
  const status = await manager.getStatus()
  await manager.shutdown().catch(() => false)
  return {
    name: 'native-missing',
    status: status.fallbackReason === 'missing_binary' ? 'passed' : 'failed',
    detail: `fallbackReason=${status.fallbackReason ?? 'none'}`,
  }
}

async function runFakeSidecarFallbackCase(options: FakeSidecarFallbackCaseOptions): Promise<NativeRuntimeSmokeCase> {
  const fakeSidecarPath = createFakeNativeRuntimeSidecar(options.scenario)
  const manager = new NativeRuntimeSidecarManager({
    binaryPath: process.execPath,
    args: [fakeSidecarPath, options.scenario],
    requestTimeoutMs: 160,
    statusTimeoutMs: 2_000,
    shutdownTimeoutMs: 160,
  })

  try {
    if (options.scenario === 'protocol-mismatch') {
      const status = await manager.getStatus()
      return buildFallbackSmokeCase(options.mode, status.fallbackReason, options.expectedFallbackReason)
    }

    const status = await manager.getStatus()
    if (!status.nativeEnabled) {
      return {
        name: options.mode,
        status: 'failed',
        detail: `fake sidecar status fallbackReason=${status.fallbackReason ?? 'none'}`,
      }
    }

    try {
      await manager.search({
        requestId: `native-runtime-smoke-${options.mode}`,
        query: options.query,
        limit: 10,
        sources: [{
          sourceKind: 'chat_message',
          sourceId: 'smoke-chat',
          sessionId: 'smoke-chat',
          title: 'Smoke Chat',
          filePath: options.fixturePath,
          textFields: ['content'],
          idField: 'id',
        }],
      })
    } catch {
      const fallbackStatus = await manager.getStatus()
      return buildFallbackSmokeCase(options.mode, fallbackStatus.fallbackReason, options.expectedFallbackReason)
    }

    return {
      name: options.mode,
      status: 'failed',
      detail: 'fake sidecar search 未触发 fallback',
    }
  } finally {
    await manager.shutdown().catch(() => false)
    rmSync(dirname(fakeSidecarPath), { recursive: true, force: true })
  }
}

async function runCacheCorruptionCase(): Promise<NativeRuntimeSmokeCase> {
  mkdirSync(getNativeRuntimeCacheDir(), { recursive: true })
  writeFileSync(getNativeRuntimeCacheManifestPath(), '{broken native cache manifest', 'utf-8')
  const result = readNativeRuntimeCacheManifest()
  if (result.ok) {
    return {
      name: 'cache-corruption',
      status: 'failed',
      detail: '损坏 manifest 被错误识别为可用',
    }
  }

  return buildFallbackSmokeCase('cache-corruption', result.error.code, 'cache_corrupted')
}

function runPackagedManifestPreflightCase(): NativeRuntimeSmokeCase {
  const fixturePackageVersion = '0.0.2'
  const fixtureSha256 = '0'.repeat(64)
  const invalidPlan = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.find((plan) => {
    const manifest = buildNativeSearchPackageManifest({
      plan,
      packageVersion: fixturePackageVersion,
      binarySha256: fixtureSha256,
    })
    return !isNativeSearchPackageManifest(manifest)
  })

  if (invalidPlan) {
    return {
      name: 'packaged-manifest-preflight',
      status: 'failed',
      detail: `optional package manifest schema invalid: ${invalidPlan.packageName}`,
    }
  }

  const currentPlan = getNativeSearchOptionalPackagePlan()
  return {
    name: 'packaged-manifest-preflight',
    status: 'passed',
    detail: [
      `optionalPackagePlans=${NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.length}`,
      `currentPackage=${currentPlan?.packageName ?? 'unsupported'}`,
      'bundledBinaryVerified=false',
      'realPackagedBinaryVerified=false',
    ].join('; '),
  }
}

function runPackagedOptionalDependenciesPreflightCase(
  result: NativeSearchOptionalDependenciesValidationResult,
): NativeRuntimeSmokeCase {
  if (result.declared) {
    return {
      name: 'packaged-optional-dependencies-preflight',
      status: 'passed',
      detail: [
        'optionalDependenciesDeclared=true',
        `nativeSearchOptionalDependencies=${result.expectedPackages.length}`,
      ].join('; '),
    }
  }

  return {
    name: 'packaged-optional-dependencies-preflight',
    status: result.invalidPackages.length > 0 ? 'failed' : 'skipped',
    detail: [
      'optionalDependenciesDeclared=false',
      `missingOptionalDependencies=${result.missingPackages.join(',') || 'none'}`,
      `invalidOptionalDependencies=${result.invalidPackages.join(',') || 'none'}`,
      'realPackagedBinaryVerified=false',
    ].join('; '),
  }
}

function buildPackagedOptionalPackagePublicationPreflightCase(
  result: NativeSearchOptionalPackagePublicationValidationResult,
  registryChecked: boolean,
): NativeRuntimeSmokeCase {
  if (!registryChecked) {
    return {
      name: 'packaged-optional-package-publication-preflight',
      status: 'skipped',
      detail: 'optionalPackagePublicationChecked=false; optionalPackagesPublished=false; realPackagedBinaryVerified=false',
    }
  }

  if (result.published) {
    return {
      name: 'packaged-optional-package-publication-preflight',
      status: 'passed',
      detail: [
        'optionalPackagePublicationChecked=true',
        'optionalPackagesPublished=true',
        `publishedOptionalPackages=${result.publishedPackages.length}`,
      ].join('; '),
    }
  }

  return {
    name: 'packaged-optional-package-publication-preflight',
    status: 'failed',
    detail: [
      'optionalPackagePublicationChecked=true',
      'optionalPackagesPublished=false',
      `missingPublishedOptionalPackages=${result.missingPackages.join(',') || 'none'}`,
      `invalidPublishedOptionalPackages=${result.invalidPackages.join(',') || 'none'}`,
      `unavailablePublishedOptionalPackages=${result.unavailablePackages.join(',') || 'none'}`,
      'realPackagedBinaryVerified=false',
    ].join('; '),
  }
}

function buildOptionalPackagePublishTargetPreflightCase(
  result: NativeSearchOptionalPackagePublishTargetValidationResult,
): NativeRuntimeSmokeCase {
  if (!result.checked) {
    return {
      name: 'optional-package-publish-target',
      status: 'skipped',
      detail: [
        'optionalPackagePublishTargetChecked=false',
        'optionalPackagePublishTargetReady=false',
        `optionalPackagePublishTargetVersion=${result.packageVersion ?? 'none'}`,
        `optionalPackagePublishTargetBlockers=${result.blockers.join(',') || 'none'}`,
        'optionalPackagesPublished=false',
        'realPackagedBinaryVerified=false',
      ].join('; '),
    }
  }

  return {
    name: 'optional-package-publish-target',
    status: result.ready ? 'passed' : 'failed',
    detail: [
      'optionalPackagePublishTargetChecked=true',
      `optionalPackagePublishTargetReady=${String(result.ready)}`,
      `optionalPackagePublishTargetVersion=${result.packageVersion ?? 'none'}`,
      `optionalPackagePublishTargetBlockers=${result.blockers.join(',') || 'none'}`,
      `publishTargetAvailablePackages=${result.availablePackages.join(',') || 'none'}`,
      `publishedVersionCollisionPackages=${result.publishedVersionCollisionPackages.join(',') || 'none'}`,
      `invalidPublishTargetPackages=${result.invalidPackages.join(',') || 'none'}`,
      `unavailablePublishTargetPackages=${result.unavailablePackages.join(',') || 'none'}`,
      `nativeSearchVersionConsistencyVerified=${String(result.nativeSearchVersionConsistencyVerified)}`,
      `nativeSearchCargoVersion=${result.nativeSearchCargoVersion ?? 'none'}`,
      `nativeSearchBinaryVersion=${result.nativeSearchBinaryVersion ?? 'none'}`,
      `plannedOptionalPackageManifestsVerified=${String(result.plannedOptionalPackageManifestsVerified)}`,
      'optionalPackagesPublished=false',
      'realPackagedBinaryVerified=false',
    ].join('; '),
  }
}

function buildOptionalPackageSourcePreflightCase(
  result: NativeSearchOptionalPackageSourceValidationResult,
): NativeRuntimeSmokeCase {
  return {
    name: 'optional-package-source',
    status: result.ready ? 'passed' : 'failed',
    detail: [
      'optionalPackageSourceChecked=true',
      `optionalPackageSourceReady=${String(result.ready)}`,
      `optionalPackageSourceVersion=${result.packageVersion ?? 'none'}`,
      `optionalPackageSourceBlockers=${result.blockers.join(',') || 'none'}`,
      `optionalPackageSourceReadyPackages=${result.readyPackages.join(',') || 'none'}`,
      `missingOptionalPackageSourcePackages=${result.missingPackages.join(',') || 'none'}`,
      `invalidOptionalPackageSourcePackages=${result.invalidPackages.join(',') || 'none'}`,
      `plannedOptionalPackageSourceManifestsVerified=${String(result.plannedOptionalPackageManifestsVerified)}`,
      'optionalPackagesPublished=false',
      'realPackagedBinaryVerified=false',
    ].join('; '),
  }
}

function runPackagedOptionalDependenciesInstallChainPreflightCase(
  result: NativeSearchOptionalPackageInstallChainValidationResult,
): NativeRuntimeSmokeCase {
  if (result.verified) {
    return {
      name: 'packaged-optional-dependencies-install-chain-preflight',
      status: 'passed',
      detail: [
        'optionalDependenciesInstallChainVerified=true',
        `nativeSearchOptionalDependencies=${result.optionalDependencies.expectedPackages.length}`,
      ].join('; '),
    }
  }

  const installChainBroken = !result.lockfileVerified || !result.installedPackagesVerified
  return {
    name: 'packaged-optional-dependencies-install-chain-preflight',
    status: result.optionalDependencies.declared && installChainBroken ? 'failed' : 'skipped',
    detail: [
      'optionalDependenciesInstallChainVerified=false',
      `lockfileVerified=${String(result.lockfileVerified)}`,
      `installedPackagesVerified=${String(result.installedPackagesVerified)}`,
      `missingLockfilePackages=${result.missingLockfilePackages.join(',') || 'none'}`,
      `missingInstalledPackages=${result.missingInstalledPackages.join(',') || 'none'}`,
      `invalidInstalledPackages=${result.invalidInstalledPackages.join(',') || 'none'}`,
      'realPackagedBinaryVerified=false',
    ].join('; '),
  }
}

export function buildPackagedPackagingConfigPreflightCase(
  result: NativeSearchPackagingConfigValidationResult,
  optionalPackageOptInStarted: boolean,
): NativeRuntimeSmokeCase {
  return {
    name: 'packaged-packaging-config-preflight',
    status: result.verified ? 'passed' : optionalPackageOptInStarted ? 'failed' : 'skipped',
    detail: [
      `packagingConfigVerified=${String(result.verified)}`,
      `missingPackagingConfigPackages=${result.missingPackages.join(',') || 'none'}`,
      `blockingPackagingConfigExcludes=${result.blockingExcludes.join(',') || 'none'}`,
      `tooBroadPackagingConfigIncludes=${result.tooBroadIncludes.join(',') || 'none'}`,
      'realPackagedBinaryVerified=false',
    ].join('; '),
  }
}

function runPackagedResolverFixtureCase(rootDir: string): NativeRuntimeSmokeCase {
  const fixture = createNativeSearchPackageFixture(rootDir)
  const resolved = resolveNativeSearchPackage({
    platform: fixture.plan.platform,
    arch: fixture.plan.arch,
    isPackaged: true,
    appNodeModulesRoot: fixture.nodeModulesRoot,
    moduleResolve: (specifier) => {
      if (specifier === `${fixture.plan.packageName}/package.json`) {
        return fixture.packageJsonPath
      }
      throw new Error(`missing ${specifier}`)
    },
  })

  const passed = resolved.source === 'bundled'
    && resolved.packageName === fixture.plan.packageName
    && resolved.binaryName === fixture.plan.binaryName
    && resolved.binarySha256 === fixture.binarySha256
    && resolved.binaryPath === fixture.binaryPath

  return {
    name: 'packaged-resolver-fixture',
    status: passed ? 'passed' : 'failed',
    detail: [
      `currentPackage=${fixture.plan.packageName}`,
      'fixtureBundledPackageVerified=true',
      'usesTemporaryFixture=true',
      'realPackagedBinaryVerified=false',
    ].join('; '),
  }
}

interface PackagedAppLayoutCaseResult {
  case: NativeRuntimeSmokeCase
  layoutVerified: boolean
  packagedAppEvidenceVerified: boolean
  packagedAppIdentityVerified: boolean
  optionalPackagePublicationChecked: boolean
  optionalPackagesPublished: boolean
  optionalDependenciesDeclared: boolean
  optionalDependenciesInstallChainVerified: boolean
  optionalDependenciesLockfileVerified: boolean
  optionalDependenciesInstalledPackagesVerified: boolean
  packagingConfigVerified: boolean
  missingPublishedOptionalPackages: string[]
  invalidPublishedOptionalPackages: string[]
  unavailablePublishedOptionalPackages: string[]
  missingOptionalDependencies: string[]
  invalidOptionalDependencies: string[]
  missingOptionalDependencyLockfilePackages: string[]
  missingInstalledOptionalDependencies: string[]
  invalidInstalledOptionalDependencies: string[]
  missingPackagingConfigPackages: string[]
  blockingPackagingConfigExcludes: string[]
  tooBroadPackagingConfigIncludes: string[]
  realPackagedBinaryVerified: boolean
  usesTemporaryFixture: boolean
}

function runPackagedAppLayoutCase(
  appNodeModulesRoot: string | undefined,
  registryChecked: boolean,
  optionalPackagePublication: NativeSearchOptionalPackagePublicationValidationResult,
): PackagedAppLayoutCaseResult {
  const optionalDependenciesInstallChain = readCurrentNativeSearchOptionalPackageInstallChain()
  const optionalDependenciesResult = optionalDependenciesInstallChain.optionalDependencies
  const packagingConfig = readCurrentNativeSearchPackagingConfig()
  const publicationFields = buildPackagedAppPublicationFields(registryChecked, optionalPackagePublication)
  if (!appNodeModulesRoot) {
    return {
      case: {
        name: 'packaged-app-layout',
        status: 'skipped',
        detail: '未提供 --app-node-modules-root；requiresPrebuiltPackagedApp=true; realPackagedBinaryVerified=false',
      },
      layoutVerified: false,
      packagedAppEvidenceVerified: false,
      packagedAppIdentityVerified: false,
      ...publicationFields,
      optionalDependenciesDeclared: optionalDependenciesResult.declared,
      optionalDependenciesInstallChainVerified: optionalDependenciesInstallChain.verified,
      optionalDependenciesLockfileVerified: optionalDependenciesInstallChain.lockfileVerified,
      optionalDependenciesInstalledPackagesVerified: optionalDependenciesInstallChain.installedPackagesVerified,
      packagingConfigVerified: packagingConfig.verified,
      missingOptionalDependencies: optionalDependenciesResult.missingPackages,
      invalidOptionalDependencies: optionalDependenciesResult.invalidPackages,
      missingOptionalDependencyLockfilePackages: optionalDependenciesInstallChain.missingLockfilePackages,
      missingInstalledOptionalDependencies: optionalDependenciesInstallChain.missingInstalledPackages,
      invalidInstalledOptionalDependencies: optionalDependenciesInstallChain.invalidInstalledPackages,
      missingPackagingConfigPackages: packagingConfig.missingPackages,
      blockingPackagingConfigExcludes: packagingConfig.blockingExcludes,
      tooBroadPackagingConfigIncludes: packagingConfig.tooBroadIncludes,
      realPackagedBinaryVerified: false,
      usesTemporaryFixture: false,
    }
  }

  if (!existsSync(appNodeModulesRoot)) {
    return {
      case: {
        name: 'packaged-app-layout',
        status: 'skipped',
        detail: 'packaged app node_modules root 不存在；requiresPrebuiltPackagedApp=true; realPackagedBinaryVerified=false',
      },
      layoutVerified: false,
      packagedAppEvidenceVerified: false,
      packagedAppIdentityVerified: false,
      ...publicationFields,
      optionalDependenciesDeclared: optionalDependenciesResult.declared,
      optionalDependenciesInstallChainVerified: optionalDependenciesInstallChain.verified,
      optionalDependenciesLockfileVerified: optionalDependenciesInstallChain.lockfileVerified,
      optionalDependenciesInstalledPackagesVerified: optionalDependenciesInstallChain.installedPackagesVerified,
      packagingConfigVerified: packagingConfig.verified,
      missingOptionalDependencies: optionalDependenciesResult.missingPackages,
      invalidOptionalDependencies: optionalDependenciesResult.invalidPackages,
      missingOptionalDependencyLockfilePackages: optionalDependenciesInstallChain.missingLockfilePackages,
      missingInstalledOptionalDependencies: optionalDependenciesInstallChain.missingInstalledPackages,
      invalidInstalledOptionalDependencies: optionalDependenciesInstallChain.invalidInstalledPackages,
      missingPackagingConfigPackages: packagingConfig.missingPackages,
      blockingPackagingConfigExcludes: packagingConfig.blockingExcludes,
      tooBroadPackagingConfigIncludes: packagingConfig.tooBroadIncludes,
      realPackagedBinaryVerified: false,
      usesTemporaryFixture: false,
    }
  }

  const plan = getNativeSearchOptionalPackagePlan()
  if (!plan) {
    return {
      case: {
        name: 'packaged-app-layout',
        status: 'skipped',
        detail: '当前平台暂无 optional package plan；requiresPrebuiltPackagedApp=true; realPackagedBinaryVerified=false',
      },
      layoutVerified: false,
      packagedAppEvidenceVerified: false,
      packagedAppIdentityVerified: false,
      ...publicationFields,
      optionalDependenciesDeclared: optionalDependenciesResult.declared,
      optionalDependenciesInstallChainVerified: optionalDependenciesInstallChain.verified,
      optionalDependenciesLockfileVerified: optionalDependenciesInstallChain.lockfileVerified,
      optionalDependenciesInstalledPackagesVerified: optionalDependenciesInstallChain.installedPackagesVerified,
      packagingConfigVerified: packagingConfig.verified,
      missingOptionalDependencies: optionalDependenciesResult.missingPackages,
      invalidOptionalDependencies: optionalDependenciesResult.invalidPackages,
      missingOptionalDependencyLockfilePackages: optionalDependenciesInstallChain.missingLockfilePackages,
      missingInstalledOptionalDependencies: optionalDependenciesInstallChain.missingInstalledPackages,
      invalidInstalledOptionalDependencies: optionalDependenciesInstallChain.invalidInstalledPackages,
      missingPackagingConfigPackages: packagingConfig.missingPackages,
      blockingPackagingConfigExcludes: packagingConfig.blockingExcludes,
      tooBroadPackagingConfigIncludes: packagingConfig.tooBroadIncludes,
      realPackagedBinaryVerified: false,
      usesTemporaryFixture: false,
    }
  }

  const result = resolvePackagedAppLayout(appNodeModulesRoot, plan)
  const usesTemporaryFixture = isPathInside(appNodeModulesRoot, tmpdir())
  const packagedAppEvidence = classifyPackagedAppEvidence(appNodeModulesRoot)
  const packagedAppEvidenceVerified = packagedAppEvidence !== 'none'
  const packagedAppIdentityVerified = verifyPackagedAppIdentity(appNodeModulesRoot, packagedAppEvidence)
  if (!result.ok) {
    return {
      case: {
        name: 'packaged-app-layout',
        status: 'failed',
        detail: [
          `package=${result.packageName ?? plan.packageName}`,
          `reason=${result.reason}`,
          'requiresPrebuiltPackagedApp=true',
          'realPackagedBinaryVerified=false',
        ].join('; '),
      },
      layoutVerified: false,
      packagedAppEvidenceVerified,
      packagedAppIdentityVerified,
      ...publicationFields,
      optionalDependenciesDeclared: optionalDependenciesResult.declared,
      optionalDependenciesInstallChainVerified: optionalDependenciesInstallChain.verified,
      optionalDependenciesLockfileVerified: optionalDependenciesInstallChain.lockfileVerified,
      optionalDependenciesInstalledPackagesVerified: optionalDependenciesInstallChain.installedPackagesVerified,
      packagingConfigVerified: packagingConfig.verified,
      missingOptionalDependencies: optionalDependenciesResult.missingPackages,
      invalidOptionalDependencies: optionalDependenciesResult.invalidPackages,
      missingOptionalDependencyLockfilePackages: optionalDependenciesInstallChain.missingLockfilePackages,
      missingInstalledOptionalDependencies: optionalDependenciesInstallChain.missingInstalledPackages,
      invalidInstalledOptionalDependencies: optionalDependenciesInstallChain.invalidInstalledPackages,
      missingPackagingConfigPackages: packagingConfig.missingPackages,
      blockingPackagingConfigExcludes: packagingConfig.blockingExcludes,
      tooBroadPackagingConfigIncludes: packagingConfig.tooBroadIncludes,
      realPackagedBinaryVerified: false,
      usesTemporaryFixture,
    }
  }

  const realPackagedBinaryVerified = packagedAppEvidenceVerified
    && packagedAppIdentityVerified
    && optionalPackagePublication.published
    && optionalDependenciesInstallChain.verified
    && packagingConfig.verified
    && !usesTemporaryFixture
  return {
    case: {
      name: 'packaged-app-layout',
      status: 'passed',
      detail: [
        `package=${result.packageName}`,
        'source=bundled',
        'packagedAppLayoutVerified=true',
        `packagedAppEvidence=${packagedAppEvidence}`,
        `packagedAppEvidenceVerified=${String(packagedAppEvidenceVerified)}`,
        `packagedAppIdentityVerified=${String(packagedAppIdentityVerified)}`,
        `optionalPackagesPublished=${String(optionalPackagePublication.published)}`,
        `optionalDependenciesDeclared=${String(optionalDependenciesResult.declared)}`,
        `optionalDependenciesInstallChainVerified=${String(optionalDependenciesInstallChain.verified)}`,
        `packagingConfigVerified=${String(packagingConfig.verified)}`,
        `usesTemporaryFixture=${String(usesTemporaryFixture)}`,
        `realPackagedBinaryVerified=${String(realPackagedBinaryVerified)}`,
      ].join('; '),
    },
    layoutVerified: true,
    packagedAppEvidenceVerified,
    packagedAppIdentityVerified,
    ...publicationFields,
    optionalDependenciesDeclared: optionalDependenciesResult.declared,
    optionalDependenciesInstallChainVerified: optionalDependenciesInstallChain.verified,
    optionalDependenciesLockfileVerified: optionalDependenciesInstallChain.lockfileVerified,
    optionalDependenciesInstalledPackagesVerified: optionalDependenciesInstallChain.installedPackagesVerified,
    packagingConfigVerified: packagingConfig.verified,
    missingOptionalDependencies: optionalDependenciesResult.missingPackages,
    invalidOptionalDependencies: optionalDependenciesResult.invalidPackages,
    missingOptionalDependencyLockfilePackages: optionalDependenciesInstallChain.missingLockfilePackages,
    missingInstalledOptionalDependencies: optionalDependenciesInstallChain.missingInstalledPackages,
    invalidInstalledOptionalDependencies: optionalDependenciesInstallChain.invalidInstalledPackages,
    missingPackagingConfigPackages: packagingConfig.missingPackages,
    blockingPackagingConfigExcludes: packagingConfig.blockingExcludes,
    tooBroadPackagingConfigIncludes: packagingConfig.tooBroadIncludes,
    realPackagedBinaryVerified,
    usesTemporaryFixture,
  }
}

function buildPackagedAppPublicationFields(
  registryChecked: boolean,
  optionalPackagePublication: NativeSearchOptionalPackagePublicationValidationResult,
): Pick<
  PackagedAppLayoutCaseResult,
  | 'optionalPackagePublicationChecked'
  | 'optionalPackagesPublished'
  | 'missingPublishedOptionalPackages'
  | 'invalidPublishedOptionalPackages'
  | 'unavailablePublishedOptionalPackages'
> {
  return {
    optionalPackagePublicationChecked: registryChecked,
    optionalPackagesPublished: registryChecked && optionalPackagePublication.published,
    missingPublishedOptionalPackages: registryChecked ? optionalPackagePublication.missingPackages : [],
    invalidPublishedOptionalPackages: registryChecked ? optionalPackagePublication.invalidPackages : [],
    unavailablePublishedOptionalPackages: registryChecked ? optionalPackagePublication.unavailablePackages : [],
  }
}

function readCurrentNativeSearchOptionalPackageInstallChain(): NativeSearchOptionalPackageInstallChainValidationResult {
  try {
    const packageJson = JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf-8')) as unknown
    return validateNativeSearchOptionalPackageInstallChain({
      packageJson,
      lockfileText: readCurrentLockfileText(),
      installedPackageManifests: readCurrentInstalledNativeSearchPackageManifests(),
    })
  } catch {
    return validateNativeSearchOptionalPackageInstallChain({
      packageJson: {},
      lockfileText: '',
      installedPackageManifests: {},
    })
  }
}

async function readNativeSearchOptionalPackagePublication(
  checkRegistry: boolean,
): Promise<NativeSearchOptionalPackagePublicationValidationResult> {
  if (!checkRegistry) {
    return validateNativeSearchOptionalPackagePublication({})
  }

  const registryMetadata: Record<string, unknown> = {}
  const unavailablePackages: string[] = []
  for (const plan of NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS) {
    try {
      const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(plan.packageName)}`, {
        headers: {
          accept: 'application/vnd.npm.install-v1+json, application/json',
        },
      })
      if (response.status === 404) continue
      if (!response.ok) {
        unavailablePackages.push(plan.packageName)
        continue
      }
      registryMetadata[plan.packageName] = await response.json() as unknown
    } catch {
      unavailablePackages.push(plan.packageName)
    }
  }

  return validateNativeSearchOptionalPackagePublication({
    registryMetadata,
    expectedPackageVersions: readCurrentNativeSearchOptionalDependencyExpectedVersions(),
    unavailablePackages,
  })
}

async function readNativeSearchOptionalPackagePublishTarget(
  packageVersion: string | undefined,
  checkRegistry: boolean,
): Promise<NativeSearchOptionalPackagePublishTargetValidationResult> {
  const registryResult = checkRegistry
    ? await readNativeSearchOptionalPackageRegistryMetadata()
    : { registryMetadata: {}, unavailablePackages: [] }

  return validateNativeSearchOptionalPackagePublishTarget({
    packageVersion,
    registryChecked: checkRegistry,
    registryMetadata: registryResult.registryMetadata,
    unavailablePackages: registryResult.unavailablePackages,
    cargoVersion: readNativeSearchCargoVersion(),
    binaryVersion: readNativeSearchSourceBinaryVersion(),
  })
}

function readNativeSearchOptionalPackageSource(
  packageVersion: string | undefined,
): NativeSearchOptionalPackageSourceValidationResult {
  const normalizedPackageVersion = typeof packageVersion === 'string' ? packageVersion.trim() : undefined
  const packageSources = Object.fromEntries(
    NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [
      plan.packageName,
      {
        packageJson: buildNativeSearchOptionalPackageSourcePackageJson(plan, normalizedPackageVersion ?? '0.0.0'),
        nativeSearchPackageManifest: buildNativeSearchPackageManifest({
          plan,
          packageVersion: normalizedPackageVersion ?? '0.0.0',
          binarySha256: '0'.repeat(64),
        }),
      },
    ]),
  )

  return validateNativeSearchOptionalPackageSources({
    packageVersion,
    packageSources,
  })
}

function buildNativeSearchOptionalPackageSourcePackageJson(
  plan: (typeof NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS)[number],
  packageVersion: string,
): Record<string, unknown> {
  return {
    name: plan.packageName,
    version: packageVersion,
    description: `CodeInsights native search sidecar for ${plan.platform} ${plan.arch}`,
    private: false,
    license: 'MIT',
    os: [plan.platform],
    cpu: [plan.arch],
    bin: {
      'codeinsights-native-search': `bin/${plan.binaryName}`,
    },
    files: [
      'package.json',
      'native-search-package.json',
      `bin/${plan.binaryName}`,
    ],
    publishConfig: {
      access: 'public',
    },
  }
}

async function readNativeSearchOptionalPackageRegistryMetadata(): Promise<{
  registryMetadata: Record<string, unknown>
  unavailablePackages: string[]
}> {
  const registryMetadata: Record<string, unknown> = {}
  const unavailablePackages: string[] = []
  for (const plan of NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS) {
    try {
      const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(plan.packageName)}`, {
        headers: {
          accept: 'application/vnd.npm.install-v1+json, application/json',
        },
      })
      if (response.status === 404) continue
      if (!response.ok) {
        unavailablePackages.push(plan.packageName)
        continue
      }
      registryMetadata[plan.packageName] = await response.json() as unknown
    } catch {
      unavailablePackages.push(plan.packageName)
    }
  }

  return { registryMetadata, unavailablePackages }
}

function readCurrentNativeSearchOptionalDependencyExpectedVersions(): Record<string, string> {
  try {
    const packageJson = JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf-8')) as unknown
    return getNativeSearchOptionalDependencyExpectedVersions(packageJson)
  } catch {
    return {}
  }
}

function readNativeSearchCargoVersion(): string | null {
  try {
    const cargoToml = readFileSync(join(import.meta.dir, '..', '..', '..', 'native', 'search', 'Cargo.toml'), 'utf-8')
    return cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null
  } catch {
    return null
  }
}

function readNativeSearchSourceBinaryVersion(): string | null {
  try {
    const libSource = readFileSync(join(import.meta.dir, '..', '..', '..', 'native', 'search', 'src', 'lib.rs'), 'utf-8')
    return libSource.match(/BINARY_VERSION:\s*&str\s*=\s*"([^"]+)"/)?.[1] ?? null
  } catch {
    return null
  }
}

function readCurrentLockfileText(): string {
  try {
    return readFileSync(join(import.meta.dir, '..', '..', '..', 'bun.lock'), 'utf-8')
  } catch {
    return ''
  }
}

function readCurrentNativeSearchPackagingConfig(): NativeSearchPackagingConfigValidationResult {
  try {
    return validateNativeSearchPackagingConfig(readFileSync(join(import.meta.dir, '..', 'electron-builder.yml'), 'utf-8'))
  } catch {
    return validateNativeSearchPackagingConfig('')
  }
}

function readCurrentInstalledNativeSearchPackageManifests(): Record<string, unknown> {
  const manifests: Record<string, unknown> = {}
  for (const plan of NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS) {
    const packageJsonPath = join(import.meta.dir, '..', 'node_modules', ...plan.packageName.split('/'), 'package.json')
    try {
      manifests[plan.packageName] = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as unknown
    } catch {
      // 只读预检：缺失安装包只记录 package name，不输出路径。
    }
  }
  return manifests
}

function resolvePackagedAppLayout(
  appNodeModulesRoot: string,
  plan: NonNullable<ReturnType<typeof getNativeSearchOptionalPackagePlan>>,
): { ok: true; packageName: string } | { ok: false; packageName?: string; reason: string } {
  try {
    const packageJsonPath = join(appNodeModulesRoot, ...plan.packageName.split('/'), 'package.json')
    const resolved = resolveNativeSearchPackage({
      platform: plan.platform,
      arch: plan.arch,
      isPackaged: true,
      appNodeModulesRoot,
      moduleResolve: (specifier) => {
        if (specifier === `${plan.packageName}/package.json`) return packageJsonPath
        throw new Error(`missing ${specifier}`)
      },
    })

    return { ok: true, packageName: resolved.packageName }
  } catch (error) {
    if (error instanceof NativeSearchPackageResolutionError) {
      return {
        ok: false,
        packageName: error.packageName ?? plan.packageName,
        reason: error.code,
      }
    }

    return {
      ok: false,
      packageName: plan.packageName,
      reason: 'layout_invalid',
    }
  }
}

function classifyPackagedAppEvidence(appNodeModulesRoot: string): 'asar-unpacked' | 'unpacked-app' | 'none' {
  if (basename(appNodeModulesRoot) !== 'node_modules') return 'none'
  const unpackedRoot = dirname(appNodeModulesRoot)
  if (basename(unpackedRoot) === 'app.asar.unpacked' && existsSync(join(dirname(unpackedRoot), 'app.asar'))) {
    return 'asar-unpacked'
  }

  if (
    basename(unpackedRoot) === 'app'
    && basename(dirname(unpackedRoot)).toLowerCase() === 'resources'
    && existsSync(join(unpackedRoot, 'package.json'))
  ) {
    return 'unpacked-app'
  }

  return 'none'
}

function verifyPackagedAppIdentity(
  appNodeModulesRoot: string,
  evidence: 'asar-unpacked' | 'unpacked-app' | 'none',
): boolean {
  if (evidence !== 'unpacked-app') return false

  try {
    const packageJson = JSON.parse(readFileSync(join(dirname(appNodeModulesRoot), 'package.json'), 'utf-8')) as unknown
    return isRecord(packageJson)
      && packageJson.name === '@codeinsights/electron'
      && packageJson.main === 'dist/main.cjs'
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPathInside(path: string, root: string): boolean {
  const relativePath = relative(root, path)
  return relativePath === ''
    || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

function buildFallbackSmokeCase(
  name: NativeRuntimeSmokeMode,
  actualFallbackReason: string | undefined,
  expectedFallbackReason: string,
): NativeRuntimeSmokeCase {
  return {
    name,
    status: actualFallbackReason === expectedFallbackReason ? 'passed' : 'failed',
    detail: `fallbackReason=${actualFallbackReason ?? 'none'}`,
  }
}

async function runNativeAvailableCase(
  binaryPath: string | undefined,
  filePath: string,
  query: string,
  env?: NodeJS.ProcessEnv,
): Promise<NativeRuntimeSmokeCase> {
  if (!binaryPath) {
    return {
      name: 'native-available',
      status: 'skipped',
      detail: '未提供显式 native-search binary；smoke 不从系统 PATH 查找。',
    }
  }

  const manager = new NativeRuntimeSidecarManager({ binaryPath, env })
  try {
    const status = await manager.getStatus()
    if (!status.nativeEnabled) {
      return {
        name: 'native-available',
        status: 'failed',
        detail: `native status fallbackReason=${status.fallbackReason ?? 'none'}`,
      }
    }

    const result = await manager.search({
      requestId: 'native-runtime-smoke-native-search',
      query,
      limit: 10,
      sources: [{
        sourceKind: 'chat_message',
        sourceId: 'smoke-chat',
        sessionId: 'smoke-chat',
        title: 'Smoke Chat',
        filePath,
        textFields: ['content'],
        idField: 'id',
      }],
    })

    return {
      name: 'native-available',
      status: result.matches.length > 0 ? 'passed' : 'failed',
      detail: `implementation=${status.implementation}; matches=${result.matches.length}`,
    }
  } finally {
    await manager.shutdown().catch(() => false)
  }
}

function createFakeNativeRuntimeSidecar(scenario: 'protocol-mismatch' | 'crash' | 'timeout'): string {
  const scriptDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-fake-sidecar-'))
  const scriptPath = join(scriptDir, 'fake-sidecar.js')
  writeFileSync(scriptPath, `
const scenario = process.argv[2] ?? '${scenario}'
let buffer = ''

function send(value) {
  process.stdout.write(JSON.stringify(value) + '\\n')
}

function handle(line) {
  const request = JSON.parse(line)
  if (request.method === 'status') {
    send({
      jsonrpc: '2.0',
      id: request.id,
      ok: true,
      result: {
        implementation: 'rust-sidecar',
        binaryVersion: '0.0.0-smoke',
        protocolVersion: scenario === 'protocol-mismatch' ? 999 : 1,
        cacheSchemaVersion: 1,
        capabilities: ['diagnostics', 'indexed-search'],
      },
    })
    return
  }

  if (request.method === 'search') {
    if (scenario === 'crash') process.exit(42)
    if (scenario === 'timeout') return
  }

  if (request.method === 'shutdown') {
    send({ jsonrpc: '2.0', id: request.id, ok: true, result: { accepted: true } })
    process.exit(0)
  }
}

process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  while (buffer.includes('\\n')) {
    const index = buffer.indexOf('\\n')
    const line = buffer.slice(0, index)
    buffer = buffer.slice(index + 1)
    if (line.trim()) handle(line)
  }
})
`, 'utf-8')
  return scriptPath
}

function createNativeSearchPackageFixture(rootDir: string): {
  plan: NonNullable<ReturnType<typeof getNativeSearchOptionalPackagePlan>>
  nodeModulesRoot: string
  packageJsonPath: string
  binaryPath: string
  binarySha256: string
} {
  const plan = getNativeSearchFixturePlan()
  const nodeModulesRoot = join(rootDir, 'fixture-node-modules')
  const packageRoot = join(nodeModulesRoot, ...plan.packageName.split('/'))
  const packageJsonPath = join(packageRoot, 'package.json')
  const manifestPath = join(packageRoot, 'native-search-package.json')
  const binaryPath = join(packageRoot, 'bin', plan.binaryName)
  const binaryContent = '#!/bin/sh\necho codeinsights native search fixture\n'
  const binarySha256 = createHash('sha256').update(binaryContent).digest('hex')
  const manifest = buildNativeSearchPackageManifest({
    plan,
    packageVersion: '0.0.2',
    binarySha256,
  })

  mkdirSync(dirname(binaryPath), { recursive: true })
  writeFileSync(packageJsonPath, `${JSON.stringify({
    name: plan.packageName,
    version: '0.0.2',
  }, null, 2)}\n`, 'utf-8')
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  writeFileSync(binaryPath, binaryContent, 'utf-8')
  chmodSync(binaryPath, 0o755)

  return {
    plan,
    nodeModulesRoot,
    packageJsonPath,
    binaryPath,
    binarySha256,
  }
}

function getNativeSearchFixturePlan(): NonNullable<ReturnType<typeof getNativeSearchOptionalPackagePlan>> {
  const currentPlan = getNativeSearchOptionalPackagePlan()
  if (currentPlan) return currentPlan
  const fallbackPlan = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]
  if (!fallbackPlan) {
    throw new Error('native search optional package 平台矩阵为空')
  }
  return fallbackPlan
}

function parseSmokeMode(value: string): NativeRuntimeSmokeMode {
  if (
    value === 'native-missing'
    || value === 'native-available'
    || value === 'protocol-mismatch'
    || value === 'crash'
    || value === 'timeout'
    || value === 'cache-corruption'
    || value === 'packaged-manifest'
    || value === 'packaged-app-layout'
    || value === 'optional-package-source'
    || value === 'optional-package-publish-target'
  ) {
    return value
  }
  return DEFAULT_OPTIONS.mode
}

if (import.meta.main) {
  try {
    const summary = await runNativeRuntimeSmoke(parseNativeRuntimeSmokeArgs(process.argv.slice(2)))
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    process.exitCode = getNativeRuntimeSmokeExitCode(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[Native Runtime Smoke] ${redactNativeRuntimeText(message)}\n`)
    process.exitCode = 1
  }
}
