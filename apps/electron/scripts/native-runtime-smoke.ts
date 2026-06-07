import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative } from 'node:path'
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
  buildNativeSearchPackagingConfigAllowlistChangePlan,
  buildNativeSearchOptionalPackagePublicationInvocationPlan,
  buildNativeSearchOptionalPackagePublicationChangePlan,
  buildNativeSearchOptionalDependenciesInstallChainChangePlan,
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
  type NativeSearchPackagingConfigAllowlistChangePlan,
  type NativeSearchOptionalPackagePublicationInvocationPlan,
  type NativeSearchOptionalPackagePublicationChangePlan,
  type NativeSearchOptionalDependenciesInstallChainChangePlan,
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
  packagedAppRoot?: string
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

export type PackagedAppNodeModulesResolutionSource =
  | 'none'
  | 'explicit_app_node_modules_root'
  | 'packaged_app_root'

export type PackagedAppNodeModulesResolutionEvidence =
  | 'none'
  | 'explicit_app_node_modules_root'
  | 'macos_app_resources_app'
  | 'macos_app_asar_unpacked'
  | 'resources_app'
  | 'resources_app_asar_unpacked'
  | 'direct_app_root'
  | 'direct_asar_unpacked_root'

export type PackagedAppNodeModulesResolutionFailure =
  | 'app_node_modules_root_not_found'
  | 'packaged_app_root_not_found'
  | 'packaged_app_root_unrecognized'

export interface PackagedAppNodeModulesResolution {
  resolved: boolean
  source: PackagedAppNodeModulesResolutionSource
  evidence: PackagedAppNodeModulesResolutionEvidence
  appNodeModulesRoot?: string
  failureReason?: PackagedAppNodeModulesResolutionFailure
}

export type PackagedBundledBinarySmokeInvocationPlanStatus =
  | 'blocked'
  | 'ready_for_execution'
  | 'verified'

export type PackagedBundledBinarySmokeInvocationPlanBlocker =
  | PackagedBundledBinarySmokePlanBlocker
  | 'app_node_modules_root_unresolved'
  | 'packaged_app_root_required'
  | 'packaged_app_root_unresolved'

export interface PackagedBundledBinarySmokeExecutionDesign {
  schemaVersion: 1
  preferredInputMode: 'packaged_app_root'
  legacyInputMode: 'app_node_modules_root'
  registryCheckRequired: boolean
  realPackagedAppRequired: boolean
  temporaryFixtureAllowedAsRealEvidence: boolean
  createsPackagedApp: boolean
  publishesPackages: boolean
  installsDependencies: boolean
  modifiesBuilderConfig: boolean
  passCriteria: string[]
  failClosedCriteria: string[]
}

export interface PackagedBundledBinarySmokeInvocationPlan {
  schemaVersion: 1
  status: PackagedBundledBinarySmokeInvocationPlanStatus
  inputMode: 'packaged_app_root' | 'app_node_modules_root' | 'none'
  packagedAppRootProvided: boolean
  appNodeModulesRootProvided: boolean
  appNodeModulesRootResolved: boolean
  resolutionEvidence: PackagedAppNodeModulesResolutionEvidence
  blockedBy: PackagedBundledBinarySmokeInvocationPlanBlocker[]
  requiredInputs: string[]
  acceptanceEvidence: string[]
  executionDesign: PackagedBundledBinarySmokeExecutionDesign
  candidateCommand: string
  legacyCandidateCommand: string
  forbiddenActions: string[]
}

export type NativeSearchReleaseHandoffPlanStatus =
  | 'blocked'
  | 'ready_for_release_handoff'
  | 'verified'

export type NativeSearchReleaseHandoffPlanBlocker =
  | 'optional_package_publish_target_not_ready'
  | 'optional_package_source_not_ready'
  | 'optional_package_publication_invocation_not_ready'
  | 'optional_packages_not_published'
  | 'optional_dependencies_not_declared'
  | 'optional_package_install_chain_not_verified'
  | 'packaging_config_not_verified'
  | 'packaged_app_bundled_binary_not_verified'
  | 'default_enable_risk_review_not_completed'

export type NativeSearchReleaseHandoffPlanMissingEvidence =
  | 'optional_package_publish_target_registry_check'
  | 'optional_package_source_preflight'
  | 'optional_package_publication_registry_evidence'
  | 'optional_dependencies_declared_in_package_json'
  | 'optional_dependency_lockfile_resolved_entries'
  | 'optional_dependency_installed_package_manifests'
  | 'electron_builder_native_search_allowlist_verified'
  | 'real_packaged_app_bundled_binary_smoke'
  | 'default_enable_risk_review'

export interface NativeSearchReleaseHandoffGateBinding {
  schemaVersion: 1
  authoritativeNextGate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  publicationInvocationAllowedNextGate: 'optional_package_publication'
  packagedSmokeAllowedNextGate: 'packaged_app_bundled_binary_smoke'
  verifiedRequiresExecutionPlanVerified: boolean
  failClosedOnOutOfOrderEvidence: boolean
}

export type NativeSearchReleaseHandoffApprovalPacketStatus =
  | 'blocked'
  | 'ready_for_approval'
  | 'verified'

export type NativeSearchReleaseHandoffApprovalGate =
  | 'optional_package_publication'
  | 'optional_dependencies_declaration'
  | 'optional_package_install_chain'
  | 'packaging_config_allowlist'
  | 'packaged_app_bundled_binary_smoke'
  | 'default_enable_risk_review'

export type NativeSearchReleaseHandoffApprovalQueueItemStatus =
  | 'verified'
  | 'ready_for_approval'
  | 'blocked_current_gate'
  | 'blocked_until_prior_gate_verified'

export interface NativeSearchReleaseHandoffApprovalPacket {
  schemaVersion: 1
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  status: NativeSearchReleaseHandoffApprovalPacketStatus
  approvalRequired: boolean
  requiredApproval: string | null
  requiredEvidenceBeforeExecution: string[]
  allowedActionsAfterApproval: string[]
  candidateCommands: string[]
  doesNotAuthorize: string[]
  forbiddenActions: string[]
}

export interface NativeSearchReleaseHandoffApprovalQueueItem {
  schemaVersion: 1
  gate: NativeSearchReleaseHandoffApprovalGate
  status: NativeSearchReleaseHandoffApprovalQueueItemStatus
  currentGate: boolean
  prerequisiteGates: NativeSearchReleaseHandoffApprovalGate[]
  approvalRequired: boolean
  requiredApproval: string | null
  requiredEvidenceBeforeExecution: string[]
  allowedActionsAfterApproval: string[]
  candidateCommands: string[]
  doesNotAuthorize: string[]
  forbiddenActions: string[]
}

export interface NativeSearchReleaseHandoffGateExecutionEvidenceChecklistItem {
  schemaVersion: 1
  gate: NativeSearchReleaseHandoffApprovalGate
  status: NativeSearchReleaseHandoffApprovalQueueItemStatus
  currentGate: boolean
  executionEvidenceRequired: boolean
  requiredApproval: string | null
  requiredEvidenceAfterExecution: string[]
  postExecutionVerificationCommands: string[]
  fileWriteTargets: string[]
  remoteWriteRequired: boolean
  workspaceMutationRequired: boolean
  networkRequired: boolean
  expectedNextGateAfterVerification: NativeSearchOptionalPackageExecutionPlan['nextStage']
  expectedSummaryFlagsAfterExecution: string[]
  mustRemainUnverifiedAfterExecution: string[]
  successCriteria: string[]
  failClosedCriteria: string[]
  transitionFailClosedCriteria: string[]
  doesNotVerify: string[]
  forbiddenActions: string[]
}

export type NativeSearchReleaseHandoffExecutionInputPacketStatus =
  | 'blocked'
  | 'ready_after_approval'
  | 'verified'

export interface NativeSearchReleaseHandoffExecutionInputSideEffects {
  schemaVersion: 1
  remoteWriteRequired: boolean
  workspaceMutationRequired: boolean
  networkRequired: boolean
  fileWriteTargets: string[]
}

export interface NativeSearchReleaseHandoffExecutionInputPacket {
  schemaVersion: 1
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  status: NativeSearchReleaseHandoffExecutionInputPacketStatus
  approvalRequiredBeforeExecution: boolean
  requiredApproval: string | null
  requiredInputsBeforeExecution: string[]
  allowedActionsAfterApproval: string[]
  candidateCommandsAfterApproval: string[]
  postExecutionVerificationCommands: string[]
  sideEffects: NativeSearchReleaseHandoffExecutionInputSideEffects
  requiredEvidenceAfterExecution: string[]
  expectedNextGateAfterExecution: NativeSearchOptionalPackageExecutionPlan['nextStage']
  mustRemainUnverifiedAfterExecution: string[]
  doesNotVerify: string[]
  forbiddenActions: string[]
}

export type NativeSearchReleaseHandoffNoGoBoundaryViolationCode =
  | 'native_explicit_opt_in_not_required'
  | 'default_enable_candidate_true'
  | 'release_handoff_default_off_not_required_before_verified'
  | 'execution_packet_gate_mismatch'
  | 'blocked_gate_exposes_candidate_commands'
  | 'future_gate_exposes_candidate_commands'
  | 'blocked_gate_exposes_post_execution_commands'
  | 'future_gate_exposes_post_execution_commands'
  | 'blocked_execution_packet_exposes_candidate_commands'
  | 'blocked_execution_packet_exposes_post_execution_commands'
  | 'declaration_gate_exposes_install_command'
  | 'declaration_gate_has_unexpected_file_write_target'
  | 'install_chain_ready_missing_install_command'
  | 'install_chain_ready_missing_network_side_effect'
  | 'install_chain_ready_missing_workspace_mutation'
  | 'install_chain_ready_missing_lockfile_write_target'
  | 'packaged_smoke_command_not_packaged_app_root_placeholder'
  | 'packaged_smoke_ready_missing_post_execution_command'
  | 'default_enable_gate_not_blocked'
  | 'default_enable_gate_exposes_execution_commands'
  | 'ready_gate_exposes_unexpected_candidate_commands'
  | 'no_go_verified_flag_changed'
  | 'summary_leaks_sensitive_path_or_registry'

export interface NativeSearchReleaseHandoffNoGoBoundaryViolation {
  code: NativeSearchReleaseHandoffNoGoBoundaryViolationCode
  gate?: NativeSearchOptionalPackageExecutionPlan['nextStage']
  field?: string
}

export interface NativeSearchReleaseHandoffNoGoBoundaryAudit {
  schemaVersion: 1
  passed: boolean
  currentGate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  defaultOffRequired: boolean
  explicitOptInRequired: boolean
  defaultEnableCandidate: boolean
  violations: NativeSearchReleaseHandoffNoGoBoundaryViolation[]
}

export interface NativeSearchReleaseHandoffGateTransitionEvaluation {
  schemaVersion: 1
  gate: NativeSearchReleaseHandoffApprovalGate
  passed: boolean
  expectedNextGate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  actualNextGate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  missingExpectedSummaryFlags: string[]
  violatedMustRemainUnverifiedFlags: string[]
  noGoBoundaryViolations: string[]
  failedCriteria: string[]
}

export interface NativeSearchReleaseHandoffPlan {
  schemaVersion: 1
  status: NativeSearchReleaseHandoffPlanStatus
  nextGate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  releaseApprovalRequired: boolean
  defaultOffRequired: boolean
  verified: boolean
  readyForPublicationInvocation: boolean
  readyForOptionalDependenciesHandoff: boolean
  readyForPackagingConfigHandoff: boolean
  readyForPackagedSmokeHandoff: boolean
  readyForDefaultEnableRiskReview: boolean
  blockedBy: NativeSearchReleaseHandoffPlanBlocker[]
  missingEvidence: NativeSearchReleaseHandoffPlanMissingEvidence[]
  gateBinding: NativeSearchReleaseHandoffGateBinding
  currentGateApprovalPacket: NativeSearchReleaseHandoffApprovalPacket
  gateApprovalQueue: NativeSearchReleaseHandoffApprovalQueueItem[]
  gateExecutionEvidenceChecklist: NativeSearchReleaseHandoffGateExecutionEvidenceChecklistItem[]
  currentGateExecutionInputPacket: NativeSearchReleaseHandoffExecutionInputPacket
  requiredApprovals: string[]
  acceptanceEvidence: string[]
  candidateNextCommands: string[]
  doesNotVerify: string[]
  forbiddenActions: string[]
}

export interface NativeRuntimeSmokeSummary {
  schemaVersion: number
  generatedAt: string
  mode: NativeRuntimeSmokeMode
  nativeSearchBinaryProvided: boolean
  packagedAppRootProvided: boolean
  appNodeModulesRootProvided: boolean
  packagedAppNodeModulesRootDerived: boolean
  packagedAppRootResolutionEvidence: PackagedAppNodeModulesResolutionEvidence
  bundledBinaryVerified: boolean
  fixtureBundledPackageVerified: boolean
  usesTemporaryFixture: boolean
  packagedAppLayoutVerified: boolean
  packagedAppEvidenceVerified: boolean
  packagedAppIdentityVerified: boolean
  optionalDependenciesDeclared: boolean
  optionalPackagePublicationChecked: boolean
  optionalPackagesPublished: boolean
  optionalPackagePublicationChangePlan: NativeSearchOptionalPackagePublicationChangePlan
  optionalPackagePublicationInvocationPlan: NativeSearchOptionalPackagePublicationInvocationPlan
  optionalDependenciesInstallChainVerified: boolean
  optionalDependenciesLockfileVerified: boolean
  optionalDependenciesInstalledPackagesVerified: boolean
  packagingConfigVerified: boolean
  missingOptionalDependencies: string[]
  invalidOptionalDependencies: string[]
  optionalDependenciesInstallChainChangePlan: NativeSearchOptionalDependenciesInstallChainChangePlan
  publishedOptionalPackages: string[]
  missingPublishedOptionalPackages: string[]
  invalidPublishedOptionalPackages: string[]
  existingInvalidPublishedOptionalPackages: string[]
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
  packagingConfigAllowlistChangePlan: NativeSearchPackagingConfigAllowlistChangePlan
  optionalPackageExecutionPlan: NativeSearchOptionalPackageExecutionPlan
  packagedBundledBinarySmokePlan: PackagedBundledBinarySmokePlan
  packagedBundledBinarySmokeInvocationPlan: PackagedBundledBinarySmokeInvocationPlan
  nativeSearchReleaseHandoffPlan: NativeSearchReleaseHandoffPlan
  nativeSearchDefaultEnableReadiness: NativeSearchDefaultEnableReadiness
  requiresPrebuiltPackagedApp: boolean
  cases: NativeRuntimeSmokeCase[]
}

interface EvaluateNativeSearchReleaseHandoffGateTransitionInput {
  gate: NativeSearchReleaseHandoffApprovalGate
  beforeSummary: NativeRuntimeSmokeSummary
  afterSummary: NativeRuntimeSmokeSummary
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
  optionalDependenciesInstallChainPlanVersion?: string | null
  packagingConfigVerified?: boolean
  missingOptionalDependencies?: string[]
  invalidOptionalDependencies?: string[]
  missingPublishedOptionalPackages?: string[]
  publishedOptionalPackages?: string[]
  invalidPublishedOptionalPackages?: string[]
  existingInvalidPublishedOptionalPackages?: string[]
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

export function evaluateNativeSearchReleaseHandoffGateTransition(
  input: EvaluateNativeSearchReleaseHandoffGateTransitionInput,
): NativeSearchReleaseHandoffGateTransitionEvaluation {
  const checklist = input.beforeSummary.nativeSearchReleaseHandoffPlan.gateExecutionEvidenceChecklist
    .find((item) => item.gate === input.gate)
  const expectedNextGate = checklist?.expectedNextGateAfterVerification
    ?? getNativeSearchReleaseHandoffGateExpectedNextGate(input.gate)
  const actualNextGate = input.afterSummary.nativeSearchReleaseHandoffPlan.nextGate
  const beforeGateReadinessFailures = getNativeSearchReleaseHandoffTransitionReadinessFailures({
    gate: input.gate,
    checklist,
    beforeSummary: input.beforeSummary,
  })
  const missingExpectedSummaryFlags = (checklist?.expectedSummaryFlagsAfterExecution ?? [])
    .filter((flag) => !isNativeRuntimeSmokeSummaryFlagSatisfied(input.afterSummary, flag))
  const violatedMustRemainUnverifiedFlags = (checklist?.mustRemainUnverifiedAfterExecution ?? [])
    .filter((flag) => isNativeRuntimeSmokeSummaryFlagSatisfied(input.afterSummary, flag))
  const gateSpecificBoundaryViolations = getNativeSearchReleaseHandoffGateSpecificBoundaryViolations(
    input.gate,
    input.afterSummary,
  )
  const noGoBoundaryViolations = [
    ...violatedMustRemainUnverifiedFlags.map((flag) => `must_remain_unverified:${flag}`),
    ...gateSpecificBoundaryViolations,
  ]
  const failedCriteria = uniqueStrings([
    ...beforeGateReadinessFailures,
    ...(actualNextGate !== expectedNextGate ? ['expected_next_gate_not_reached'] : []),
    ...(missingExpectedSummaryFlags.length > 0 ? ['expected_summary_flags_missing_after_execution'] : []),
    ...(violatedMustRemainUnverifiedFlags.length > 0 ? ['must_remain_unverified_flag_changed'] : []),
    ...(noGoBoundaryViolations.length > 0 ? ['no_go_boundary_violation'] : []),
    ...(input.gate === 'default_enable_risk_review' ? ['default_enable_risk_review_not_supported_in_current_smoke'] : []),
  ])

  return {
    schemaVersion: 1,
    gate: input.gate,
    passed: failedCriteria.length === 0,
    expectedNextGate,
    actualNextGate,
    missingExpectedSummaryFlags,
    violatedMustRemainUnverifiedFlags,
    noGoBoundaryViolations,
    failedCriteria,
  }
}

export function evaluateNativeSearchReleaseHandoffNoGoBoundary(
  summary: NativeRuntimeSmokeSummary,
): NativeSearchReleaseHandoffNoGoBoundaryAudit {
  const plan = summary.nativeSearchReleaseHandoffPlan
  const packet = plan.currentGateExecutionInputPacket
  const violations: NativeSearchReleaseHandoffNoGoBoundaryViolation[] = []

  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    !summary.nativeSearchDefaultEnableReadiness.explicitOptInRequired,
    'native_explicit_opt_in_not_required',
    undefined,
    'nativeSearchDefaultEnableReadiness.explicitOptInRequired',
  )
  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate,
    'default_enable_candidate_true',
    undefined,
    'nativeSearchDefaultEnableReadiness.defaultEnableCandidate',
  )
  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    !plan.defaultOffRequired && !plan.verified,
    'release_handoff_default_off_not_required_before_verified',
    plan.nextGate,
    'nativeSearchReleaseHandoffPlan.defaultOffRequired',
  )
  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    packet.gate !== plan.nextGate,
    'execution_packet_gate_mismatch',
    packet.gate,
    'currentGateExecutionInputPacket.gate',
  )

  for (const evidence of getNativeSearchReleaseHandoffNoGoOrderedEvidence(summary)) {
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      evidence.value && !summary.optionalPackageExecutionPlan.completedPrerequisites.includes(evidence.stage),
      'no_go_verified_flag_changed',
      undefined,
      evidence.field,
    )
  }

  for (const item of plan.gateApprovalQueue) {
    if (item.status === 'blocked_current_gate' && item.candidateCommands.length > 0) {
      addNativeSearchReleaseHandoffNoGoViolation(
        violations,
        true,
        'blocked_gate_exposes_candidate_commands',
        item.gate,
        'gateApprovalQueue.candidateCommands',
      )
    }
    if (item.status === 'blocked_until_prior_gate_verified' && item.candidateCommands.length > 0) {
      addNativeSearchReleaseHandoffNoGoViolation(
        violations,
        true,
        'future_gate_exposes_candidate_commands',
        item.gate,
        'gateApprovalQueue.candidateCommands',
      )
    }
  }

  for (const item of plan.gateExecutionEvidenceChecklist) {
    if (item.status === 'blocked_current_gate' && item.postExecutionVerificationCommands.length > 0) {
      addNativeSearchReleaseHandoffNoGoViolation(
        violations,
        true,
        'blocked_gate_exposes_post_execution_commands',
        item.gate,
        'gateExecutionEvidenceChecklist.postExecutionVerificationCommands',
      )
    }
    if (item.status === 'blocked_until_prior_gate_verified' && item.postExecutionVerificationCommands.length > 0) {
      addNativeSearchReleaseHandoffNoGoViolation(
        violations,
        true,
        'future_gate_exposes_post_execution_commands',
        item.gate,
        'gateExecutionEvidenceChecklist.postExecutionVerificationCommands',
      )
    }
  }

  const expectedCurrentGateApprovalCommands = getNativeSearchReleaseHandoffNoGoExpectedApprovalCommands(
    summary,
    plan.currentGateApprovalPacket.gate,
  )
  if (plan.currentGateApprovalPacket.status === 'ready_for_approval' && expectedCurrentGateApprovalCommands) {
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      !sameStringSet(plan.currentGateApprovalPacket.candidateCommands, expectedCurrentGateApprovalCommands),
      'ready_gate_exposes_unexpected_candidate_commands',
      plan.currentGateApprovalPacket.gate,
      'currentGateApprovalPacket.candidateCommands',
    )
  }
  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    plan.currentGateApprovalPacket.status === 'blocked'
      && plan.currentGateApprovalPacket.candidateCommands.length > 0,
    'blocked_gate_exposes_candidate_commands',
    plan.currentGateApprovalPacket.gate,
    'currentGateApprovalPacket.candidateCommands',
  )

  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    packet.status === 'blocked' && packet.candidateCommandsAfterApproval.length > 0,
    'blocked_execution_packet_exposes_candidate_commands',
    packet.gate,
    'currentGateExecutionInputPacket.candidateCommandsAfterApproval',
  )
  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    packet.status === 'blocked' && packet.postExecutionVerificationCommands.length > 0,
    'blocked_execution_packet_exposes_post_execution_commands',
    packet.gate,
    'currentGateExecutionInputPacket.postExecutionVerificationCommands',
  )

  const expectedPacketCommands = packet.status === 'ready_after_approval'
    ? getNativeSearchReleaseHandoffNoGoExpectedPacketCommands(packet.gate)
    : null
  if (expectedPacketCommands) {
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      !sameStringSet(packet.candidateCommandsAfterApproval, expectedPacketCommands),
      'ready_gate_exposes_unexpected_candidate_commands',
      packet.gate,
      'currentGateExecutionInputPacket.candidateCommandsAfterApproval',
    )
  }

  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    packet.gate === 'optional_dependencies_declaration'
      && packet.candidateCommandsAfterApproval.includes('bun install --frozen-lockfile'),
    'declaration_gate_exposes_install_command',
    packet.gate,
    'currentGateExecutionInputPacket.candidateCommandsAfterApproval',
  )
  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    packet.gate === 'optional_dependencies_declaration'
      && !sameStringSet(packet.sideEffects.fileWriteTargets, ['apps/electron/package.json']),
    'declaration_gate_has_unexpected_file_write_target',
    packet.gate,
    'currentGateExecutionInputPacket.sideEffects.fileWriteTargets',
  )

  if (packet.gate === 'optional_package_install_chain' && packet.status === 'ready_after_approval') {
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      !packet.candidateCommandsAfterApproval.includes('bun install --frozen-lockfile'),
      'install_chain_ready_missing_install_command',
      packet.gate,
      'currentGateExecutionInputPacket.candidateCommandsAfterApproval',
    )
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      !packet.sideEffects.networkRequired,
      'install_chain_ready_missing_network_side_effect',
      packet.gate,
      'currentGateExecutionInputPacket.sideEffects.networkRequired',
    )
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      !packet.sideEffects.workspaceMutationRequired,
      'install_chain_ready_missing_workspace_mutation',
      packet.gate,
      'currentGateExecutionInputPacket.sideEffects.workspaceMutationRequired',
    )
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      !packet.sideEffects.fileWriteTargets.includes('bun.lock'),
      'install_chain_ready_missing_lockfile_write_target',
      packet.gate,
      'currentGateExecutionInputPacket.sideEffects.fileWriteTargets',
    )
  }

  if (packet.gate === 'packaged_app_bundled_binary_smoke' && packet.status === 'ready_after_approval') {
    const packagedSmokeCommands = [
      ...packet.candidateCommandsAfterApproval,
      ...packet.postExecutionVerificationCommands,
    ]
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      !packet.postExecutionVerificationCommands.includes(getNativeSearchPackagedSmokePlaceholderCommand()),
      'packaged_smoke_ready_missing_post_execution_command',
      packet.gate,
      'currentGateExecutionInputPacket.postExecutionVerificationCommands',
    )
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      packagedSmokeCommands.some((command) => !command.includes('<packaged-app-root>')),
      'packaged_smoke_command_not_packaged_app_root_placeholder',
      packet.gate,
      'currentGateExecutionInputPacket.candidateCommandsAfterApproval',
    )
  }

  if (packet.gate === 'default_enable_risk_review') {
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      packet.status !== 'blocked',
      'default_enable_gate_not_blocked',
      packet.gate,
      'currentGateExecutionInputPacket.status',
    )
    addNativeSearchReleaseHandoffNoGoViolation(
      violations,
      packet.candidateCommandsAfterApproval.length > 0 || packet.postExecutionVerificationCommands.length > 0,
      'default_enable_gate_exposes_execution_commands',
      packet.gate,
      'currentGateExecutionInputPacket.candidateCommandsAfterApproval',
    )
  }

  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    summary.bundledBinaryVerified && summary.packagedBundledBinarySmokePlan.status !== 'verified',
    'no_go_verified_flag_changed',
    undefined,
    'bundledBinaryVerified',
  )
  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    summary.realPackagedBinaryVerified && summary.packagedBundledBinarySmokeInvocationPlan.status !== 'verified',
    'no_go_verified_flag_changed',
    undefined,
    'realPackagedBinaryVerified',
  )
  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    summary.optionalPackageExecutionPlan.verified
      && !summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate,
    'no_go_verified_flag_changed',
    undefined,
    'optionalPackageExecutionPlan.verified',
  )

  const summaryJson = JSON.stringify(summary)
  addNativeSearchReleaseHandoffNoGoViolation(
    violations,
    summaryJson.includes('/Users/')
      || summaryJson.includes('binaryPath')
      || summaryJson.includes('registry.npmjs.org'),
    'summary_leaks_sensitive_path_or_registry',
    undefined,
    'summary',
  )

  return {
    schemaVersion: 1,
    passed: violations.length === 0,
    currentGate: plan.nextGate,
    defaultOffRequired: plan.defaultOffRequired,
    explicitOptInRequired: summary.nativeSearchDefaultEnableReadiness.explicitOptInRequired,
    defaultEnableCandidate: summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate,
    violations,
  }
}

const NATIVE_SEARCH_RELEASE_HANDOFF_APPROVAL_GATES: NativeSearchReleaseHandoffApprovalGate[] = [
  'optional_package_publication',
  'optional_dependencies_declaration',
  'optional_package_install_chain',
  'packaging_config_allowlist',
  'packaged_app_bundled_binary_smoke',
  'default_enable_risk_review',
]

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
    } else if (arg === '--packaged-app-root') {
      options.packagedAppRoot = value
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

export function resolvePackagedAppNodeModulesRoot(input: {
  packagedAppRoot?: string
  appNodeModulesRoot?: string
}): PackagedAppNodeModulesResolution {
  if (input.appNodeModulesRoot) {
    if (!existsSync(input.appNodeModulesRoot)) {
      return {
        resolved: false,
        source: 'explicit_app_node_modules_root',
        evidence: 'explicit_app_node_modules_root',
        failureReason: 'app_node_modules_root_not_found',
      }
    }

    return {
      resolved: true,
      source: 'explicit_app_node_modules_root',
      evidence: 'explicit_app_node_modules_root',
      appNodeModulesRoot: input.appNodeModulesRoot,
    }
  }

  if (!input.packagedAppRoot) {
    return {
      resolved: false,
      source: 'none',
      evidence: 'none',
    }
  }

  if (!existsSync(input.packagedAppRoot)) {
    return {
      resolved: false,
      source: 'packaged_app_root',
      evidence: 'none',
      failureReason: 'packaged_app_root_not_found',
    }
  }

  const candidates = getPackagedAppNodeModulesRootCandidates(input.packagedAppRoot)
  for (const candidate of candidates) {
    if (existsSync(candidate.appNodeModulesRoot)) {
      return {
        resolved: true,
        source: 'packaged_app_root',
        evidence: candidate.evidence,
        appNodeModulesRoot: candidate.appNodeModulesRoot,
      }
    }
  }

  return {
    resolved: false,
    source: 'packaged_app_root',
    evidence: 'none',
    failureReason: 'packaged_app_root_unrecognized',
  }
}

export function buildNativeRuntimeSmokeSummary(input: {
  mode: NativeRuntimeSmokeMode
  nativeSearchBinary?: string
  packagedAppRoot?: string
  appNodeModulesRoot?: string
  packagedAppNodeModulesResolution?: PackagedAppNodeModulesResolution
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
  const optionalPackagePublicationPlanVersion = verification.optionalPackagePublishTargetVersion
    ?? verification.optionalPackageSourceVersion
    ?? verification.optionalDependenciesInstallChainPlanVersion
    ?? null
  const optionalDependenciesInstallChainVerified = optionalDependenciesDeclared
    && Boolean(verification.optionalDependenciesInstallChainVerified)
  const optionalDependenciesLockfileVerified = optionalDependenciesDeclared
    && Boolean(verification.optionalDependenciesLockfileVerified)
  const optionalDependenciesInstalledPackagesVerified = optionalDependenciesDeclared
    && Boolean(verification.optionalDependenciesInstalledPackagesVerified)
  const packagingConfigVerified = Boolean(verification.packagingConfigVerified)
  const packagedAppEvidenceVerified = Boolean(verification.packagedAppEvidenceVerified)
  const packagedAppIdentityVerified = Boolean(verification.packagedAppIdentityVerified)
  const usesTemporaryFixture = Boolean(verification.usesTemporaryFixture)
  const missingPackagingConfigPackages = verification.missingPackagingConfigPackages
    ?? (packagingConfigVerified ? [] : NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName))
  const blockingPackagingConfigExcludes = verification.blockingPackagingConfigExcludes ?? []
  const tooBroadPackagingConfigIncludes = verification.tooBroadPackagingConfigIncludes ?? []
  const expectedOptionalDependencyPackages = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
  const missingOptionalDependencies = verification.missingOptionalDependencies ?? []
  const invalidOptionalDependencies = verification.invalidOptionalDependencies ?? []
  const missingOptionalDependencyLockfilePackages = verification.missingOptionalDependencyLockfilePackages ?? []
  const missingInstalledOptionalDependencies = verification.missingInstalledOptionalDependencies ?? []
  const invalidInstalledOptionalDependencies = verification.invalidInstalledOptionalDependencies ?? []
  const missingPublishedOptionalPackages = verification.missingPublishedOptionalPackages ?? []
  const publishedOptionalPackages = verification.publishedOptionalPackages ?? []
  const invalidPublishedOptionalPackages = verification.invalidPublishedOptionalPackages ?? []
  const existingInvalidPublishedOptionalPackages = verification.existingInvalidPublishedOptionalPackages ?? []
  const unavailablePublishedOptionalPackages = verification.unavailablePublishedOptionalPackages ?? []
  const optionalDependenciesInstallChainPlanVersion = verification.optionalDependenciesInstallChainPlanVersion
    ?? verification.optionalPackagePublishTargetVersion
    ?? verification.optionalPackageSourceVersion
    ?? null
  const planMissingOptionalDependencies = verification.missingOptionalDependencies
    ?? (optionalDependenciesDeclared ? [] : expectedOptionalDependencyPackages)
  const planMissingLockfilePackages = verification.missingOptionalDependencyLockfilePackages
    ?? (optionalDependenciesLockfileVerified ? [] : expectedOptionalDependencyPackages)
  const planMissingInstalledPackages = verification.missingInstalledOptionalDependencies
    ?? (optionalDependenciesInstalledPackagesVerified ? [] : expectedOptionalDependencyPackages)
  const optionalPackagePublicationChangePlan = buildNativeSearchOptionalPackagePublicationChangePlan({
    packageVersion: optionalPackagePublicationPlanVersion,
    publishTarget: {
      checked: optionalPackagePublishTargetChecked,
      ready: optionalPackagePublishTargetReady,
      packageVersion: verification.optionalPackagePublishTargetVersion ?? null,
      blockers: verification.optionalPackagePublishTargetBlockers ?? [],
      expectedPackages: expectedOptionalDependencyPackages,
      availablePackages: verification.publishTargetAvailablePackages ?? [],
      publishedVersionCollisionPackages: verification.publishedVersionCollisionPackages ?? [],
      invalidPackages: verification.invalidPublishTargetPackages ?? [],
      unavailablePackages: verification.unavailablePublishTargetPackages ?? [],
      nativeSearchVersionConsistencyVerified: Boolean(verification.nativeSearchVersionConsistencyVerified),
      nativeSearchCargoVersion: verification.nativeSearchCargoVersion ?? null,
      nativeSearchBinaryVersion: verification.nativeSearchBinaryVersion ?? null,
      plannedOptionalPackageManifestsVerified: Boolean(verification.plannedOptionalPackageManifestsVerified),
    },
    packageSource: {
      checked: optionalPackageSourceChecked,
      ready: optionalPackageSourceReady,
      packageVersion: verification.optionalPackageSourceVersion ?? null,
      blockers: verification.optionalPackageSourceBlockers ?? [],
      expectedPackages: expectedOptionalDependencyPackages,
      readyPackages: verification.optionalPackageSourceReadyPackages ?? [],
      missingPackages: verification.missingOptionalPackageSourcePackages ?? [],
      invalidPackages: verification.invalidOptionalPackageSourcePackages ?? [],
      plannedOptionalPackageManifestsVerified: Boolean(verification.plannedOptionalPackageSourceManifestsVerified),
    },
    publication: {
      published: optionalPackagesPublished,
      expectedPackages: expectedOptionalDependencyPackages,
      publishedPackages: publishedOptionalPackages.length > 0
        ? publishedOptionalPackages
        : optionalPackagesPublished ? expectedOptionalDependencyPackages : [],
      missingPackages: missingPublishedOptionalPackages,
      invalidPackages: invalidPublishedOptionalPackages,
      existingInvalidPackages: existingInvalidPublishedOptionalPackages,
      unavailablePackages: unavailablePublishedOptionalPackages,
    },
  })
  const optionalPackagePublicationInvocationPlan = buildNativeSearchOptionalPackagePublicationInvocationPlan(
    optionalPackagePublicationChangePlan,
  )
  const optionalDependenciesInstallChainChangePlan = buildNativeSearchOptionalDependenciesInstallChainChangePlan({
    packageVersion: optionalDependenciesInstallChainPlanVersion,
    publication: {
      published: optionalPackagesPublished,
      expectedPackages: expectedOptionalDependencyPackages,
      publishedPackages: publishedOptionalPackages.length > 0
        ? publishedOptionalPackages
        : optionalPackagesPublished ? expectedOptionalDependencyPackages : [],
      missingPackages: missingPublishedOptionalPackages,
      invalidPackages: invalidPublishedOptionalPackages,
      existingInvalidPackages: existingInvalidPublishedOptionalPackages,
      unavailablePackages: unavailablePublishedOptionalPackages,
    },
    installChain: {
      verified: optionalDependenciesInstallChainVerified,
      optionalDependencies: {
        declared: optionalDependenciesDeclared,
        expectedPackages: expectedOptionalDependencyPackages,
        presentPackages: expectedOptionalDependencyPackages.filter((packageName) => (
          !planMissingOptionalDependencies.includes(packageName)
        )),
        missingPackages: planMissingOptionalDependencies,
        invalidPackages: invalidOptionalDependencies,
      },
      lockfileVerified: optionalDependenciesLockfileVerified,
      installedPackagesVerified: optionalDependenciesInstalledPackagesVerified,
      missingLockfilePackages: planMissingLockfilePackages,
      missingInstalledPackages: planMissingInstalledPackages,
      invalidInstalledPackages: invalidInstalledOptionalDependencies,
    },
  })
  const packagingConfigAllowlistChangePlan = buildNativeSearchPackagingConfigAllowlistChangePlan({
    verified: packagingConfigVerified,
    expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    includedPackages: [],
    missingPackages: missingPackagingConfigPackages,
    blockingExcludes: blockingPackagingConfigExcludes,
    tooBroadIncludes: tooBroadPackagingConfigIncludes,
  })
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
  const packagedAppNodeModulesResolution = input.packagedAppNodeModulesResolution
    ?? resolvePackagedAppNodeModulesRoot({
      packagedAppRoot: input.packagedAppRoot,
      appNodeModulesRoot: input.appNodeModulesRoot,
    })
  const packagedBundledBinarySmokePlan = buildPackagedBundledBinarySmokePlan({
    appNodeModulesRootProvided: packagedAppNodeModulesResolution.resolved,
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
  const packagedBundledBinarySmokeInvocationPlan = buildPackagedBundledBinarySmokeInvocationPlan({
    packagedAppRootProvided: Boolean(input.packagedAppRoot),
    appNodeModulesRootProvided: Boolean(input.appNodeModulesRoot),
    appNodeModulesRootResolved: packagedAppNodeModulesResolution.resolved,
    resolutionEvidence: packagedAppNodeModulesResolution.evidence,
    plan: packagedBundledBinarySmokePlan,
    bundledBinaryVerified,
  })
  const nativeSearchReleaseHandoffPlan = buildNativeSearchReleaseHandoffPlan({
    optionalPackagePublicationInvocationPlan,
    optionalDependenciesInstallChainChangePlan,
    packagingConfigAllowlistChangePlan,
    packagedBundledBinarySmokeInvocationPlan,
    optionalPackageExecutionPlan,
  })
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    nativeSearchBinaryProvided: Boolean(input.nativeSearchBinary),
    packagedAppRootProvided: Boolean(input.packagedAppRoot),
    appNodeModulesRootProvided: Boolean(input.appNodeModulesRoot),
    packagedAppNodeModulesRootDerived: packagedAppNodeModulesResolution.source === 'packaged_app_root'
      && packagedAppNodeModulesResolution.resolved,
    packagedAppRootResolutionEvidence: packagedAppNodeModulesResolution.evidence,
    bundledBinaryVerified,
    fixtureBundledPackageVerified: Boolean(verification.fixtureBundledPackageVerified),
    usesTemporaryFixture,
    packagedAppLayoutVerified: Boolean(verification.packagedAppLayoutVerified),
    packagedAppEvidenceVerified,
    packagedAppIdentityVerified,
    optionalDependenciesDeclared,
    optionalPackagePublicationChecked,
    optionalPackagesPublished,
    optionalPackagePublicationChangePlan,
    optionalPackagePublicationInvocationPlan,
    optionalDependenciesInstallChainVerified,
    optionalDependenciesLockfileVerified,
    optionalDependenciesInstalledPackagesVerified,
    packagingConfigVerified,
    missingOptionalDependencies,
    invalidOptionalDependencies,
    optionalDependenciesInstallChainChangePlan,
    publishedOptionalPackages,
    missingPublishedOptionalPackages,
    invalidPublishedOptionalPackages,
    existingInvalidPublishedOptionalPackages,
    unavailablePublishedOptionalPackages,
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
    missingOptionalDependencyLockfilePackages,
    missingInstalledOptionalDependencies,
    invalidInstalledOptionalDependencies,
    missingPackagingConfigPackages,
    blockingPackagingConfigExcludes,
    tooBroadPackagingConfigIncludes,
    realPackagedBinaryVerified,
    packagingConfigAllowlistChangePlan,
    optionalPackageExecutionPlan,
    packagedBundledBinarySmokePlan,
    packagedBundledBinarySmokeInvocationPlan,
    nativeSearchReleaseHandoffPlan,
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
    candidateCommand: getNativeSearchPackagedSmokePlaceholderCommand(),
  }
}

function buildNativeSearchReleaseHandoffPlan(input: {
  optionalPackagePublicationInvocationPlan: NativeSearchOptionalPackagePublicationInvocationPlan
  optionalDependenciesInstallChainChangePlan: NativeSearchOptionalDependenciesInstallChainChangePlan
  packagingConfigAllowlistChangePlan: NativeSearchPackagingConfigAllowlistChangePlan
  packagedBundledBinarySmokeInvocationPlan: PackagedBundledBinarySmokeInvocationPlan
  optionalPackageExecutionPlan: NativeSearchOptionalPackageExecutionPlan
}): NativeSearchReleaseHandoffPlan {
  const readyForPublicationInvocation = input.optionalPackageExecutionPlan.nextStage === 'optional_package_publication'
    && input.optionalPackagePublicationInvocationPlan.status === 'ready_for_invocation'
  const readyForOptionalDependenciesHandoff = input.optionalPackageExecutionPlan.nextStage === 'optional_dependencies_declaration'
    && input.optionalPackageExecutionPlan.readyForOptionalDependencies
  const readyForInstallChainHandoff = input.optionalPackageExecutionPlan.nextStage === 'optional_package_install_chain'
    && input.optionalPackageExecutionPlan.readyForInstallChain
  const readyForPackagingConfigHandoff = input.optionalPackageExecutionPlan.nextStage === 'packaging_config_allowlist'
    && input.optionalPackageExecutionPlan.readyForPackagingConfigChange
  const readyForPackagedSmokeHandoff = input.optionalPackageExecutionPlan.nextStage === 'packaged_app_bundled_binary_smoke'
    && input.packagedBundledBinarySmokeInvocationPlan.status === 'ready_for_execution'
  const readyForDefaultEnableRiskReview = input.optionalPackageExecutionPlan.readyForDefaultEnableRiskReview
  const verified = input.optionalPackageExecutionPlan.verified
  const blockedBy = getNativeSearchReleaseHandoffBlockers({
    optionalPackagePublicationInvocationPlan: input.optionalPackagePublicationInvocationPlan,
    optionalPackageExecutionPlan: input.optionalPackageExecutionPlan,
    readyForPublicationInvocation,
    readyForOptionalDependenciesHandoff,
    readyForInstallChainHandoff,
    readyForPackagingConfigHandoff,
    readyForPackagedSmokeHandoff,
    verified,
  })
  const status: NativeSearchReleaseHandoffPlanStatus = verified
    ? 'verified'
    : blockedBy.length === 0 ? 'ready_for_release_handoff' : 'blocked'
  const missingEvidence = getNativeSearchReleaseHandoffMissingEvidence(input)
  const candidateNextCommands = getNativeSearchReleaseHandoffCandidateCommands(input)
  const currentGateApprovalPacket = buildNativeSearchReleaseHandoffApprovalPacket({
    nextGate: input.optionalPackageExecutionPlan.nextStage,
    status,
    missingEvidence,
    candidateNextCommands,
  })
  const gateApprovalQueue = buildNativeSearchReleaseHandoffApprovalQueue({
    nextGate: input.optionalPackageExecutionPlan.nextStage,
    currentGateApprovalPacket,
  })
  const gateExecutionEvidenceChecklist = buildNativeSearchReleaseHandoffGateExecutionEvidenceChecklist(gateApprovalQueue)
  const currentGateExecutionInputPacket = buildNativeSearchReleaseHandoffExecutionInputPacket({
    nextGate: input.optionalPackageExecutionPlan.nextStage,
    currentGateApprovalPacket,
    gateExecutionEvidenceChecklist,
  })

  return {
    schemaVersion: 1,
    status,
    nextGate: input.optionalPackageExecutionPlan.nextStage,
    releaseApprovalRequired: !verified,
    defaultOffRequired: !verified,
    verified,
    readyForPublicationInvocation,
    readyForOptionalDependenciesHandoff,
    readyForPackagingConfigHandoff,
    readyForPackagedSmokeHandoff,
    readyForDefaultEnableRiskReview,
    blockedBy,
    missingEvidence,
    gateBinding: {
      schemaVersion: 1,
      authoritativeNextGate: input.optionalPackageExecutionPlan.nextStage,
      publicationInvocationAllowedNextGate: 'optional_package_publication',
      packagedSmokeAllowedNextGate: 'packaged_app_bundled_binary_smoke',
      verifiedRequiresExecutionPlanVerified: true,
      failClosedOnOutOfOrderEvidence: true,
    },
    currentGateApprovalPacket,
    gateApprovalQueue,
    gateExecutionEvidenceChecklist,
    currentGateExecutionInputPacket,
    requiredApprovals: [
      'release_approval',
      'npm_registry_publish_access',
      'package_json_optional_dependencies_change_approval',
      'install_chain_execution_approval',
      'electron_builder_allowlist_change_approval',
      'packaged_app_smoke_execution_approval',
      'default_enable_risk_review_approval',
    ],
    acceptanceEvidence: uniqueStrings([
      ...input.optionalPackagePublicationInvocationPlan.acceptanceEvidence,
      ...input.packagedBundledBinarySmokeInvocationPlan.acceptanceEvidence,
      'optional_dependencies_declared_in_package_json',
      'optional_dependency_lockfile_resolved_entries_present',
      'optional_dependency_installed_package_manifests_valid',
      'electron_builder_allowlist_includes_exact_native_search_packages',
      'native_search_default_enable_readiness_verified',
    ]),
    candidateNextCommands: [...candidateNextCommands],
    doesNotVerify: [
      'optional_packages_published',
      'optional_dependencies_declared',
      'optional_dependencies_installed',
      'packaging_config_verified',
      'packaged_binary_verified',
      'default_enable_candidate',
    ],
    forbiddenActions: [
      'do_not_treat_release_handoff_as_package_published',
      'do_not_treat_ready_handoff_as_remote_write_completed',
      'do_not_run_npm_publish_without_release_approval',
      'do_not_modify_package_json_before_publication_verified',
      'do_not_modify_bun_lock_before_install_chain_approval',
      'do_not_modify_electron_builder_yml_without_approval',
      'do_not_create_packaged_native_binary_from_handoff_plan',
      'do_not_treat_release_handoff_as_packaged_binary_verified',
      'do_not_enable_native_by_default_before_verified',
    ],
  }
}

function buildNativeSearchReleaseHandoffExecutionInputPacket(input: {
  nextGate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  currentGateApprovalPacket: NativeSearchReleaseHandoffApprovalPacket
  gateExecutionEvidenceChecklist: NativeSearchReleaseHandoffGateExecutionEvidenceChecklistItem[]
}): NativeSearchReleaseHandoffExecutionInputPacket {
  const checklist = isNativeSearchReleaseHandoffApprovalGate(input.nextGate)
    ? input.gateExecutionEvidenceChecklist.find((item) => item.gate === input.nextGate)
    : undefined
  const readyAfterApproval = input.currentGateApprovalPacket.status === 'ready_for_approval'
    && checklist?.currentGate === true
    && checklist.status === 'ready_for_approval'
  const verified = input.currentGateApprovalPacket.status === 'verified'
  const status: NativeSearchReleaseHandoffExecutionInputPacketStatus = verified
    ? 'verified'
    : readyAfterApproval ? 'ready_after_approval' : 'blocked'

  return {
    schemaVersion: 1,
    gate: input.nextGate,
    status,
    approvalRequiredBeforeExecution: readyAfterApproval,
    requiredApproval: readyAfterApproval ? input.currentGateApprovalPacket.requiredApproval : null,
    requiredInputsBeforeExecution: input.currentGateApprovalPacket.requiredEvidenceBeforeExecution,
    allowedActionsAfterApproval: readyAfterApproval
      ? input.currentGateApprovalPacket.allowedActionsAfterApproval
      : [],
    candidateCommandsAfterApproval: readyAfterApproval
      ? getNativeSearchReleaseHandoffPostApprovalCandidateCommands({
        gate: input.nextGate,
        currentGateApprovalPacket: input.currentGateApprovalPacket,
      })
      : [],
    postExecutionVerificationCommands: readyAfterApproval && checklist
      ? [...checklist.postExecutionVerificationCommands]
      : [],
    sideEffects: {
      schemaVersion: 1,
      remoteWriteRequired: checklist?.remoteWriteRequired ?? false,
      workspaceMutationRequired: checklist?.workspaceMutationRequired ?? false,
      networkRequired: checklist?.networkRequired ?? false,
      fileWriteTargets: checklist ? [...checklist.fileWriteTargets] : [],
    },
    requiredEvidenceAfterExecution: readyAfterApproval && checklist
      ? [...checklist.requiredEvidenceAfterExecution]
      : [],
    expectedNextGateAfterExecution: checklist?.expectedNextGateAfterVerification ?? input.nextGate,
    mustRemainUnverifiedAfterExecution: readyAfterApproval && checklist
      ? [...checklist.mustRemainUnverifiedAfterExecution]
      : [],
    doesNotVerify: checklist ? [...checklist.doesNotVerify] : [],
    forbiddenActions: uniqueStrings([
      ...input.currentGateApprovalPacket.forbiddenActions,
      ...(checklist?.forbiddenActions ?? []),
      'do_not_execute_candidate_commands_before_required_approval',
      'do_not_treat_execution_input_packet_as_completed_evidence',
    ]),
  }
}

function isNativeSearchReleaseHandoffApprovalGate(
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage'],
): gate is NativeSearchReleaseHandoffApprovalGate {
  return NATIVE_SEARCH_RELEASE_HANDOFF_APPROVAL_GATES.includes(gate as NativeSearchReleaseHandoffApprovalGate)
}

function getNativeSearchReleaseHandoffPostApprovalCandidateCommands(input: {
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  currentGateApprovalPacket: NativeSearchReleaseHandoffApprovalPacket
}): string[] {
  switch (input.gate) {
    case 'optional_package_publication':
    case 'packaged_app_bundled_binary_smoke':
      return [...input.currentGateApprovalPacket.candidateCommands]
    case 'optional_package_install_chain':
      return ['bun install --frozen-lockfile']
    case 'optional_dependencies_declaration':
    case 'packaging_config_allowlist':
    case 'default_enable_risk_review':
    case 'publish_target_preflight':
    case 'package_source_preflight':
    case 'complete':
      return []
  }
}

function buildNativeSearchReleaseHandoffApprovalPacket(input: {
  nextGate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  status: NativeSearchReleaseHandoffPlanStatus
  missingEvidence: NativeSearchReleaseHandoffPlanMissingEvidence[]
  candidateNextCommands: string[]
}): NativeSearchReleaseHandoffApprovalPacket {
  if (input.status === 'verified') {
    return {
      schemaVersion: 1,
      gate: input.nextGate,
      status: 'verified',
      approvalRequired: false,
      requiredApproval: null,
      requiredEvidenceBeforeExecution: [],
      allowedActionsAfterApproval: [],
      candidateCommands: [],
      doesNotAuthorize: [],
      forbiddenActions: [
        'do_not_treat_approval_packet_as_default_enable_without_risk_review',
      ],
    }
  }

  if (input.status === 'blocked') {
    return {
      schemaVersion: 1,
      gate: input.nextGate,
      status: 'blocked',
      approvalRequired: false,
      requiredApproval: null,
      requiredEvidenceBeforeExecution: [...input.missingEvidence],
      allowedActionsAfterApproval: [],
      candidateCommands: [],
      doesNotAuthorize: [
        'npm_publish',
        'package_json_optional_dependencies_change',
        'bun_lock_or_install_chain_change',
        'electron_builder_yml_change',
        'packaged_app_creation_or_packaged_binary_creation',
        'default_enable_native',
      ],
      forbiddenActions: [
        'do_not_execute_candidate_commands_without_required_approval',
        'do_not_skip_authoritative_next_gate',
        'do_not_treat_approval_packet_as_completed_evidence',
        'do_not_treat_blocked_packet_as_approved',
      ],
    }
  }

  return {
    schemaVersion: 1,
    gate: input.nextGate,
    status: 'ready_for_approval',
    approvalRequired: true,
    requiredApproval: getNativeSearchReleaseHandoffRequiredApproval(input.nextGate),
    requiredEvidenceBeforeExecution: getNativeSearchReleaseHandoffApprovalEvidence(input.nextGate),
    allowedActionsAfterApproval: getNativeSearchReleaseHandoffAllowedActions(input.nextGate),
    candidateCommands: [...input.candidateNextCommands],
    doesNotAuthorize: getNativeSearchReleaseHandoffUnauthorizedActions(input.nextGate),
    forbiddenActions: getNativeSearchReleaseHandoffApprovalForbiddenActions(input.nextGate),
  }
}

function buildNativeSearchReleaseHandoffApprovalQueue(input: {
  nextGate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  currentGateApprovalPacket: NativeSearchReleaseHandoffApprovalPacket
}): NativeSearchReleaseHandoffApprovalQueueItem[] {
  const nextGateIndex = NATIVE_SEARCH_RELEASE_HANDOFF_APPROVAL_GATES
    .indexOf(input.nextGate as NativeSearchReleaseHandoffApprovalGate)

  return NATIVE_SEARCH_RELEASE_HANDOFF_APPROVAL_GATES.map((gate, gateIndex) => {
    const currentGate = gate === input.nextGate
    const status = getNativeSearchReleaseHandoffApprovalQueueItemStatus({
      currentGate,
      gateIndex,
      nextGate: input.nextGate,
      nextGateIndex,
      packetStatus: input.currentGateApprovalPacket.status,
    })
    const readyCurrentGate = currentGate && status === 'ready_for_approval'

    return {
      schemaVersion: 1,
      gate,
      status,
      currentGate,
      prerequisiteGates: NATIVE_SEARCH_RELEASE_HANDOFF_APPROVAL_GATES.slice(0, gateIndex),
      approvalRequired: readyCurrentGate,
      requiredApproval: getNativeSearchReleaseHandoffRequiredApproval(gate),
      requiredEvidenceBeforeExecution: status === 'verified'
        ? []
        : readyCurrentGate
          ? [...input.currentGateApprovalPacket.requiredEvidenceBeforeExecution]
          : getNativeSearchReleaseHandoffApprovalEvidence(gate),
      allowedActionsAfterApproval: readyCurrentGate
        ? [...input.currentGateApprovalPacket.allowedActionsAfterApproval]
        : [],
      candidateCommands: readyCurrentGate
        ? [...input.currentGateApprovalPacket.candidateCommands]
        : [],
      doesNotAuthorize: status === 'verified'
        ? []
        : readyCurrentGate
          ? [...input.currentGateApprovalPacket.doesNotAuthorize]
          : getNativeSearchReleaseHandoffUnauthorizedActions(gate),
      forbiddenActions: readyCurrentGate
        ? [...input.currentGateApprovalPacket.forbiddenActions]
        : getNativeSearchReleaseHandoffApprovalQueueForbiddenActions(status),
    }
  })
}

function buildNativeSearchReleaseHandoffGateExecutionEvidenceChecklist(
  gateApprovalQueue: NativeSearchReleaseHandoffApprovalQueueItem[],
): NativeSearchReleaseHandoffGateExecutionEvidenceChecklistItem[] {
  return gateApprovalQueue.map((item) => {
    const readyCurrentGate = item.currentGate && item.status === 'ready_for_approval'

    return {
      schemaVersion: 1,
      gate: item.gate,
      status: item.status,
      currentGate: item.currentGate,
      executionEvidenceRequired: item.status !== 'verified',
      requiredApproval: item.requiredApproval,
      requiredEvidenceAfterExecution: getNativeSearchReleaseHandoffGateExecutionEvidence(item.gate),
      postExecutionVerificationCommands: readyCurrentGate
        ? getNativeSearchReleaseHandoffGatePostExecutionVerificationCommands(item.gate)
        : [],
      fileWriteTargets: getNativeSearchReleaseHandoffGateFileWriteTargets(item.gate),
      remoteWriteRequired: item.gate === 'optional_package_publication',
      workspaceMutationRequired: [
        'optional_dependencies_declaration',
        'optional_package_install_chain',
        'packaging_config_allowlist',
      ].includes(item.gate),
      networkRequired: [
        'optional_package_publication',
        'optional_package_install_chain',
        'packaged_app_bundled_binary_smoke',
        'default_enable_risk_review',
      ].includes(item.gate),
      expectedNextGateAfterVerification: getNativeSearchReleaseHandoffGateExpectedNextGate(item.gate),
      expectedSummaryFlagsAfterExecution: getNativeSearchReleaseHandoffGateExpectedSummaryFlags(item.gate),
      mustRemainUnverifiedAfterExecution: getNativeSearchReleaseHandoffGateMustRemainUnverified(item.gate),
      successCriteria: [
        ...getNativeSearchReleaseHandoffGateExecutionEvidence(item.gate),
        'no_no_go_boundary_violation',
      ],
      failClosedCriteria: getNativeSearchReleaseHandoffGateFailClosedCriteria(item.gate),
      transitionFailClosedCriteria: [
        'expected_next_gate_not_reached',
        'expected_summary_flags_missing_after_execution',
        'must_remain_unverified_flag_changed',
        'no_go_boundary_violation',
      ],
      doesNotVerify: getNativeSearchReleaseHandoffGateExecutionDoesNotVerify(item.gate),
      forbiddenActions: uniqueStrings([
        ...item.forbiddenActions,
        'do_not_treat_execution_checklist_as_completed_evidence',
      ]),
    }
  })
}

function getNativeSearchReleaseHandoffGateExecutionEvidence(
  gate: NativeSearchReleaseHandoffApprovalGate,
): string[] {
  switch (gate) {
    case 'optional_package_publication':
      return [
        'npm_publish_commands_exit_zero_for_all_ready_packages',
        'registry_packument_contains_exact_expected_versions',
        'registry_metadata_matches_platform_arch_and_binary',
        'summary_optionalPackagesPublished_true_after_registry_check',
      ]
    case 'optional_dependencies_declaration':
      return [
        'apps_electron_package_json_contains_exact_native_search_optional_dependencies',
        'native_search_optional_dependency_specs_are_exact_versions',
        'summary_optionalDependenciesDeclared_true',
      ]
    case 'optional_package_install_chain':
      return [
        'bun_install_completed_after_optional_dependencies_declaration',
        'optional_dependency_lockfile_resolved_entries_present',
        'optional_dependency_installed_package_manifests_valid',
        'summary_optionalDependenciesInstallChainVerified_true',
      ]
    case 'packaging_config_allowlist':
      return [
        'apps_electron_electron_builder_yml_reviewed_after_approval',
        'all_native_search_packages_have_exact_files_include',
        'blocking_codeinsights_node_modules_excludes_removed',
        'summary_packagingConfigVerified_true',
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        'real_packaged_app_root_used',
        'packaged_app_identity_matches_codeinsights_electron',
        'realPackagedBinaryVerified_true',
        'summary_bundledBinaryVerified_true',
      ]
    case 'default_enable_risk_review':
      return [
        'native_search_default_enable_readiness_verified',
        'summary_bundledBinaryVerified_true',
        'default_enable_risk_review_approved',
      ]
  }
}

function getNativeSearchReleaseHandoffGateExpectedNextGate(
  gate: NativeSearchReleaseHandoffApprovalGate,
): NativeSearchOptionalPackageExecutionPlan['nextStage'] {
  switch (gate) {
    case 'optional_package_publication':
      return 'optional_dependencies_declaration'
    case 'optional_dependencies_declaration':
      return 'optional_package_install_chain'
    case 'optional_package_install_chain':
      return 'packaging_config_allowlist'
    case 'packaging_config_allowlist':
      return 'packaged_app_bundled_binary_smoke'
    case 'packaged_app_bundled_binary_smoke':
      return 'default_enable_risk_review'
    case 'default_enable_risk_review':
      return 'complete'
  }
}

function getNativeSearchReleaseHandoffGateExpectedSummaryFlags(
  gate: NativeSearchReleaseHandoffApprovalGate,
): string[] {
  switch (gate) {
    case 'optional_package_publication':
      return [
        'optionalPackagePublicationChecked=true',
        'optionalPackagesPublished=true',
      ]
    case 'optional_dependencies_declaration':
      return [
        'optionalDependenciesDeclared=true',
      ]
    case 'optional_package_install_chain':
      return [
        'optionalDependenciesInstallChainVerified=true',
        'optionalDependenciesLockfileVerified=true',
        'optionalDependenciesInstalledPackagesVerified=true',
      ]
    case 'packaging_config_allowlist':
      return [
        'packagingConfigVerified=true',
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        'realPackagedBinaryVerified=true',
        'bundledBinaryVerified=true',
        'usesTemporaryFixture=false',
      ]
    case 'default_enable_risk_review':
      return [
        'nativeSearchDefaultEnableReadiness.defaultEnableCandidate=true',
        'optionalPackageExecutionPlan.verified=true',
      ]
  }
}

function getNativeSearchReleaseHandoffGateMustRemainUnverified(
  gate: NativeSearchReleaseHandoffApprovalGate,
): string[] {
  switch (gate) {
    case 'optional_package_publication':
      return [
        'optionalDependenciesDeclared',
        'optionalDependenciesInstallChainVerified',
        'optionalDependenciesLockfileVerified',
        'optionalDependenciesInstalledPackagesVerified',
        'packagingConfigVerified',
        'realPackagedBinaryVerified',
        'bundledBinaryVerified',
        'nativeSearchDefaultEnableReadiness.defaultEnableCandidate',
      ]
    case 'optional_dependencies_declaration':
      return [
        'optionalDependenciesInstallChainVerified',
        'optionalDependenciesLockfileVerified',
        'optionalDependenciesInstalledPackagesVerified',
        'packagingConfigVerified',
        'realPackagedBinaryVerified',
        'bundledBinaryVerified',
        'nativeSearchDefaultEnableReadiness.defaultEnableCandidate',
      ]
    case 'optional_package_install_chain':
      return [
        'packagingConfigVerified',
        'realPackagedBinaryVerified',
        'bundledBinaryVerified',
        'nativeSearchDefaultEnableReadiness.defaultEnableCandidate',
      ]
    case 'packaging_config_allowlist':
      return [
        'realPackagedBinaryVerified',
        'bundledBinaryVerified',
        'nativeSearchDefaultEnableReadiness.defaultEnableCandidate',
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        'nativeSearchDefaultEnableReadiness.defaultEnableCandidate',
      ]
    case 'default_enable_risk_review':
      return []
  }
}

function getNativeSearchReleaseHandoffGatePostExecutionVerificationCommands(
  gate: NativeSearchReleaseHandoffApprovalGate,
): string[] {
  switch (gate) {
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
        getNativeSearchPackagedSmokePlaceholderCommand(),
      ]
    case 'default_enable_risk_review':
      return [
        "bun run --filter='@codeinsights/electron' native-runtime:benchmark",
        getNativeSearchPackagedSmokePlaceholderCommand(),
      ]
  }
}

function getNativeSearchReleaseHandoffGateFileWriteTargets(
  gate: NativeSearchReleaseHandoffApprovalGate,
): string[] {
  switch (gate) {
    case 'optional_dependencies_declaration':
      return ['apps/electron/package.json']
    case 'optional_package_install_chain':
      return ['bun.lock', 'apps/electron/node_modules/@codeinsights/native-search-*']
    case 'packaging_config_allowlist':
      return ['apps/electron/electron-builder.yml']
    case 'optional_package_publication':
    case 'packaged_app_bundled_binary_smoke':
    case 'default_enable_risk_review':
      return []
  }
}

function getNativeSearchReleaseHandoffGateFailClosedCriteria(
  gate: NativeSearchReleaseHandoffApprovalGate,
): string[] {
  switch (gate) {
    case 'optional_package_publication':
      return [
        'missing_release_approval',
        'registry_packument_missing_expected_version',
        'registry_metadata_invalid',
      ]
    case 'optional_dependencies_declaration':
      return [
        'optional_packages_not_published',
        'optional_dependency_spec_is_not_exact_version',
        'unexpected_native_search_optional_dependency_package',
      ]
    case 'optional_package_install_chain':
      return [
        'optional_dependencies_not_declared',
        'lockfile_resolved_entry_missing',
        'installed_package_manifest_invalid',
      ]
    case 'packaging_config_allowlist':
      return [
        'missing_exact_native_search_include',
        'blocking_codeinsights_node_modules_exclude_present',
        'broad_node_modules_include_present',
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        'packaged_app_root_missing_or_unresolved',
        'temporary_fixture_used_as_real_evidence',
        'bundledBinaryVerified_not_true',
      ]
    case 'default_enable_risk_review':
      return [
        'native_search_default_enable_readiness_not_verified',
        'bundledBinaryVerified_not_true',
        'risk_review_not_approved',
      ]
  }
}

function getNativeSearchReleaseHandoffGateExecutionDoesNotVerify(
  gate: NativeSearchReleaseHandoffApprovalGate,
): string[] {
  switch (gate) {
    case 'optional_package_publication':
      return [
        'optional_dependencies_declared',
        'optional_dependencies_installed',
        'packaging_config_verified',
        'packaged_binary_verified',
        'default_enable_candidate',
      ]
    case 'optional_dependencies_declaration':
      return [
        'optional_package_install_chain_verified',
        'packaging_config_verified',
        'packaged_binary_verified',
        'default_enable_candidate',
      ]
    case 'optional_package_install_chain':
      return [
        'packaging_config_verified',
        'packaged_binary_verified',
        'default_enable_candidate',
      ]
    case 'packaging_config_allowlist':
      return [
        'packaged_binary_verified',
        'default_enable_candidate',
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        'default_enable_candidate',
      ]
    case 'default_enable_risk_review':
      return [
        'remote_publication_or_install_chain',
      ]
  }
}

function getNativeSearchReleaseHandoffApprovalQueueItemStatus(input: {
  currentGate: boolean
  gateIndex: number
  nextGate: NativeSearchOptionalPackageExecutionPlan['nextStage']
  nextGateIndex: number
  packetStatus: NativeSearchReleaseHandoffApprovalPacketStatus
}): NativeSearchReleaseHandoffApprovalQueueItemStatus {
  if (input.nextGate === 'complete') return 'verified'
  if (input.nextGateIndex >= 0 && input.gateIndex < input.nextGateIndex) return 'verified'
  if (!input.currentGate) return 'blocked_until_prior_gate_verified'
  if (input.packetStatus === 'ready_for_approval') return 'ready_for_approval'
  if (input.packetStatus === 'verified') return 'verified'
  return 'blocked_current_gate'
}

function getNativeSearchReleaseHandoffApprovalQueueForbiddenActions(
  status: NativeSearchReleaseHandoffApprovalQueueItemStatus,
): string[] {
  if (status === 'verified') {
    return [
      'do_not_reexecute_verified_gate_without_new_release_approval',
      'do_not_treat_verified_gate_as_default_enable_candidate',
    ]
  }

  return [
    'do_not_execute_candidate_commands_without_required_approval',
    'do_not_execute_gate_until_prior_gates_verified',
    'do_not_skip_authoritative_next_gate',
    'do_not_treat_approval_queue_item_as_completed_evidence',
  ]
}

function getNativeSearchReleaseHandoffRequiredApproval(
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage'],
): string | null {
  switch (gate) {
    case 'optional_package_publication':
      return 'release_approval'
    case 'optional_dependencies_declaration':
      return 'package_json_optional_dependencies_change_approval'
    case 'optional_package_install_chain':
      return 'install_chain_execution_approval'
    case 'packaging_config_allowlist':
      return 'electron_builder_allowlist_change_approval'
    case 'packaged_app_bundled_binary_smoke':
      return 'packaged_app_smoke_execution_approval'
    case 'default_enable_risk_review':
      return 'default_enable_risk_review_approval'
    case 'publish_target_preflight':
    case 'package_source_preflight':
    case 'complete':
      return null
  }
}

function getNativeSearchReleaseHandoffApprovalEvidence(
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage'],
): string[] {
  switch (gate) {
    case 'optional_package_publication':
      return [
        'release_approval_recorded',
        'npm_registry_auth_with_publish_access',
        'optional_package_publish_target_ready',
        'optional_package_source_ready',
      ]
    case 'optional_dependencies_declaration':
      return [
        'optional_packages_published_for_expected_version',
        'package_json_optional_dependencies_change_approval',
      ]
    case 'optional_package_install_chain':
      return [
        'optional_dependencies_declared_in_package_json',
        'install_chain_execution_approval',
      ]
    case 'packaging_config_allowlist':
      return [
        'optional_dependency_lockfile_resolved_entries_present',
        'optional_dependency_installed_package_manifests_valid',
        'electron_builder_allowlist_change_approval',
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        'optional_packages_published_for_expected_version',
        'optional_dependencies_install_chain_verified',
        'builder_allowlist_includes_native_search_packages',
        'prebuilt_packaged_app_root',
        'packaged_app_identity',
        'packaged_app_smoke_execution_approval',
      ]
    case 'default_enable_risk_review':
      return [
        'summary_bundledBinaryVerified_true',
        'native_search_default_enable_readiness_verified',
        'default_enable_risk_review_approval',
      ]
    case 'publish_target_preflight':
    case 'package_source_preflight':
    case 'complete':
      return []
  }
}

function getNativeSearchReleaseHandoffAllowedActions(
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage'],
): string[] {
  switch (gate) {
    case 'optional_package_publication':
      return [
        'run_candidate_npm_publish_commands',
        'run_packaged_manifest_registry_check_after_publish',
      ]
    case 'optional_dependencies_declaration':
      return [
        'edit_apps_electron_package_json_optional_dependencies',
        'review_native_search_optional_dependency_specs',
      ]
    case 'optional_package_install_chain':
      return [
        'run_bun_install_for_native_search_optional_dependencies',
        'verify_bun_lock_resolved_entries',
        'verify_installed_package_manifests',
      ]
    case 'packaging_config_allowlist':
      return [
        'edit_apps_electron_electron_builder_yml_allowlist',
        'run_packaging_config_preflight',
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        'run_packaged_app_layout_smoke_with_packaged_app_root',
        'verify_summary_bundledBinaryVerified_true',
      ]
    case 'default_enable_risk_review':
      return [
        'perform_default_enable_risk_review',
      ]
    case 'publish_target_preflight':
    case 'package_source_preflight':
    case 'complete':
      return []
  }
}

function getNativeSearchReleaseHandoffUnauthorizedActions(
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage'],
): string[] {
  switch (gate) {
    case 'optional_package_publication':
      return [
        'package_json_optional_dependencies_change',
        'bun_lock_or_install_chain_change',
        'electron_builder_yml_change',
        'packaged_app_creation_or_packaged_binary_creation',
        'default_enable_native',
      ]
    case 'optional_dependencies_declaration':
      return [
        'npm_publish',
        'bun_lock_or_install_chain_change',
        'electron_builder_yml_change',
        'packaged_app_creation_or_packaged_binary_creation',
        'default_enable_native',
      ]
    case 'optional_package_install_chain':
      return [
        'npm_publish',
        'package_json_optional_dependencies_change',
        'electron_builder_yml_change',
        'packaged_app_creation_or_packaged_binary_creation',
        'default_enable_native',
      ]
    case 'packaging_config_allowlist':
      return [
        'npm_publish',
        'package_json_optional_dependencies_change',
        'bun_lock_or_install_chain_change',
        'packaged_app_creation_or_packaged_binary_creation',
        'default_enable_native',
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        'npm_publish',
        'package_json_optional_dependencies_change',
        'bun_lock_or_install_chain_change',
        'electron_builder_yml_change',
        'packaged_app_creation_or_packaged_binary_creation',
        'default_enable_native',
      ]
    case 'default_enable_risk_review':
      return [
        'npm_publish',
        'package_json_optional_dependencies_change',
        'bun_lock_or_install_chain_change',
        'electron_builder_yml_change',
        'packaged_app_creation_or_packaged_binary_creation',
      ]
    case 'publish_target_preflight':
    case 'package_source_preflight':
    case 'complete':
      return [
        'npm_publish',
        'package_json_optional_dependencies_change',
        'bun_lock_or_install_chain_change',
        'electron_builder_yml_change',
        'packaged_app_creation_or_packaged_binary_creation',
        'default_enable_native',
      ]
  }
}

function getNativeSearchReleaseHandoffApprovalForbiddenActions(
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage'],
): string[] {
  const base = [
    'do_not_execute_candidate_commands_without_required_approval',
    'do_not_skip_authoritative_next_gate',
    'do_not_treat_approval_packet_as_completed_evidence',
  ]

  switch (gate) {
    case 'optional_package_publication':
      return [
        ...base,
        'do_not_modify_package_json_before_publication_verified',
        'do_not_modify_bun_lock_before_publication_verified',
        'do_not_modify_electron_builder_yml_without_approval',
      ]
    case 'optional_dependencies_declaration':
      return [
        ...base,
        'do_not_modify_package_json_before_publication_verified',
        'do_not_run_install_chain_before_optional_dependencies_approval',
        'do_not_modify_electron_builder_yml_without_approval',
      ]
    case 'optional_package_install_chain':
      return [
        ...base,
        'do_not_run_install_chain_before_install_chain_approval',
        'do_not_modify_electron_builder_yml_without_approval',
      ]
    case 'packaging_config_allowlist':
      return [
        ...base,
        'do_not_modify_electron_builder_yml_without_approval',
        'do_not_use_broad_node_modules_include',
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [
        ...base,
        'do_not_create_packaged_native_binary_from_approval_packet',
        'do_not_use_temporary_fixture_as_real_packaged_binary_evidence',
      ]
    case 'default_enable_risk_review':
      return [
        ...base,
        'do_not_enable_native_by_default_before_verified',
      ]
    case 'publish_target_preflight':
    case 'package_source_preflight':
    case 'complete':
      return base
  }
}

function getNativeSearchReleaseHandoffBlockers(input: {
  optionalPackagePublicationInvocationPlan: NativeSearchOptionalPackagePublicationInvocationPlan
  optionalPackageExecutionPlan: NativeSearchOptionalPackageExecutionPlan
  readyForPublicationInvocation: boolean
  readyForOptionalDependenciesHandoff: boolean
  readyForInstallChainHandoff: boolean
  readyForPackagingConfigHandoff: boolean
  readyForPackagedSmokeHandoff: boolean
  verified: boolean
}): NativeSearchReleaseHandoffPlanBlocker[] {
  if (input.verified) return []

  if (
    input.optionalPackageExecutionPlan.nextStage === 'optional_package_publication'
    && input.readyForPublicationInvocation
  ) {
    return []
  }

  if (
    input.optionalPackageExecutionPlan.nextStage === 'optional_dependencies_declaration'
    && input.readyForOptionalDependenciesHandoff
  ) {
    return []
  }

  if (
    input.optionalPackageExecutionPlan.nextStage === 'optional_package_install_chain'
    && input.readyForInstallChainHandoff
  ) {
    return []
  }

  if (
    input.optionalPackageExecutionPlan.nextStage === 'packaging_config_allowlist'
    && input.readyForPackagingConfigHandoff
  ) {
    return []
  }

  if (
    input.optionalPackageExecutionPlan.nextStage === 'packaged_app_bundled_binary_smoke'
    && input.readyForPackagedSmokeHandoff
  ) {
    return []
  }

  const blockers: NativeSearchReleaseHandoffPlanBlocker[] = []
  const blocksPublicationPreflight = input.optionalPackageExecutionPlan.nextStage === 'publish_target_preflight'
    || input.optionalPackageExecutionPlan.nextStage === 'package_source_preflight'
  if (
    blocksPublicationPreflight
    && input.optionalPackageExecutionPlan.blockedBy.includes('optional_package_publish_target_not_ready')
  ) {
    blockers.push('optional_package_publish_target_not_ready')
  }
  if (
    blocksPublicationPreflight
    && input.optionalPackageExecutionPlan.blockedBy.includes('optional_package_source_not_ready')
  ) {
    blockers.push('optional_package_source_not_ready')
  }
  if (!input.readyForPublicationInvocation && input.optionalPackagePublicationInvocationPlan.status !== 'not_required_already_published') {
    blockers.push('optional_package_publication_invocation_not_ready')
  }
  if (
    input.optionalPackageExecutionPlan.nextStage === 'optional_package_publication'
    && input.optionalPackageExecutionPlan.blockedBy.includes('optional_packages_not_published')
  ) {
    blockers.push('optional_packages_not_published')
  }
  if (
    input.optionalPackageExecutionPlan.nextStage === 'optional_dependencies_declaration'
    && input.optionalPackageExecutionPlan.blockedBy.includes('optional_dependencies_not_declared')
  ) {
    blockers.push('optional_dependencies_not_declared')
  }
  if (
    input.optionalPackageExecutionPlan.nextStage === 'optional_package_install_chain'
    && input.optionalPackageExecutionPlan.blockedBy.includes('optional_package_install_chain_not_verified')
  ) {
    blockers.push('optional_package_install_chain_not_verified')
  }
  if (
    input.optionalPackageExecutionPlan.nextStage === 'packaging_config_allowlist'
    && input.optionalPackageExecutionPlan.blockedBy.includes('packaging_config_not_verified')
  ) {
    blockers.push('packaging_config_not_verified')
  }
  if (
    input.optionalPackageExecutionPlan.nextStage === 'packaged_app_bundled_binary_smoke'
    && input.optionalPackageExecutionPlan.blockedBy.includes('packaged_app_bundled_binary_not_verified')
  ) {
    blockers.push('packaged_app_bundled_binary_not_verified')
  }
  if (
    input.optionalPackageExecutionPlan.nextStage === 'default_enable_risk_review'
    && input.optionalPackageExecutionPlan.blockedBy.includes('default_enable_risk_review_not_completed')
  ) {
    blockers.push('default_enable_risk_review_not_completed')
  }

  return blockers.filter((blocker, index) => blockers.indexOf(blocker) === index)
}

function getNativeSearchReleaseHandoffMissingEvidence(input: {
  optionalPackagePublicationInvocationPlan: NativeSearchOptionalPackagePublicationInvocationPlan
  optionalDependenciesInstallChainChangePlan: NativeSearchOptionalDependenciesInstallChainChangePlan
  packagingConfigAllowlistChangePlan: NativeSearchPackagingConfigAllowlistChangePlan
  packagedBundledBinarySmokeInvocationPlan: PackagedBundledBinarySmokeInvocationPlan
  optionalPackageExecutionPlan: NativeSearchOptionalPackageExecutionPlan
}): NativeSearchReleaseHandoffPlanMissingEvidence[] {
  const missing: NativeSearchReleaseHandoffPlanMissingEvidence[] = []

  if (!input.optionalPackageExecutionPlan.completedPrerequisites.includes('publish_target_preflight')) {
    missing.push('optional_package_publish_target_registry_check')
  }
  if (!input.optionalPackageExecutionPlan.completedPrerequisites.includes('package_source_preflight')) {
    missing.push('optional_package_source_preflight')
  }
  if (input.optionalPackagePublicationInvocationPlan.status !== 'not_required_already_published') {
    missing.push('optional_package_publication_registry_evidence')
  }
  if (!input.optionalPackageExecutionPlan.completedPrerequisites.includes('optional_dependencies_declaration')) {
    missing.push('optional_dependencies_declared_in_package_json')
  }
  if (!input.optionalPackageExecutionPlan.completedPrerequisites.includes('optional_package_install_chain')) {
    missing.push('optional_dependency_lockfile_resolved_entries')
    missing.push('optional_dependency_installed_package_manifests')
  }
  if (!input.optionalPackageExecutionPlan.completedPrerequisites.includes('packaging_config_allowlist')) {
    missing.push('electron_builder_native_search_allowlist_verified')
  }
  if (!input.optionalPackageExecutionPlan.completedPrerequisites.includes('packaged_app_bundled_binary_smoke')) {
    missing.push('real_packaged_app_bundled_binary_smoke')
  }
  if (!input.optionalPackageExecutionPlan.completedPrerequisites.includes('default_enable_risk_review')) {
    missing.push('default_enable_risk_review')
  }

  return missing.filter((item, index) => missing.indexOf(item) === index)
}

function getNativeSearchReleaseHandoffCandidateCommands(input: {
  optionalPackagePublicationInvocationPlan: NativeSearchOptionalPackagePublicationInvocationPlan
  optionalDependenciesInstallChainChangePlan: NativeSearchOptionalDependenciesInstallChainChangePlan
  packagingConfigAllowlistChangePlan: NativeSearchPackagingConfigAllowlistChangePlan
  packagedBundledBinarySmokeInvocationPlan: PackagedBundledBinarySmokeInvocationPlan
  optionalPackageExecutionPlan: NativeSearchOptionalPackageExecutionPlan
}): string[] {
  switch (input.optionalPackageExecutionPlan.nextStage) {
    case 'optional_package_publication':
      return input.optionalPackagePublicationInvocationPlan.status === 'ready_for_invocation'
        ? [...input.optionalPackagePublicationInvocationPlan.candidatePublicationCommands]
        : []
    case 'optional_dependencies_declaration':
    case 'optional_package_install_chain':
      return [...input.optionalDependenciesInstallChainChangePlan.candidateVerificationCommands]
    case 'packaging_config_allowlist':
      return [...input.packagingConfigAllowlistChangePlan.candidateVerificationCommands]
    case 'packaged_app_bundled_binary_smoke':
      return input.packagedBundledBinarySmokeInvocationPlan.status === 'ready_for_execution'
        ? [input.packagedBundledBinarySmokeInvocationPlan.candidateCommand]
        : []
    case 'publish_target_preflight':
    case 'package_source_preflight':
      return []
    case 'default_enable_risk_review':
    case 'complete':
      return [...input.optionalPackageExecutionPlan.candidateCommands]
  }
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index)
}

function getNativeSearchPackagedSmokePlaceholderCommand(): string {
  return "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --packaged-app-root <packaged-app-root> --check-registry"
}

function sameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  if (leftSet.size !== left.length || rightSet.size !== right.length) return false
  if (leftSet.size !== rightSet.size) return false
  return Array.from(leftSet).every((value) => rightSet.has(value))
}

function getNativeSearchReleaseHandoffNoGoOrderedEvidence(summary: NativeRuntimeSmokeSummary): Array<{
  stage: NativeSearchReleaseHandoffApprovalGate
  field: string
  value: boolean
}> {
  return [
    {
      stage: 'optional_package_publication',
      field: 'optionalPackagesPublished',
      value: summary.optionalPackagesPublished,
    },
    {
      stage: 'optional_dependencies_declaration',
      field: 'optionalDependenciesDeclared',
      value: summary.optionalDependenciesDeclared,
    },
    {
      stage: 'optional_package_install_chain',
      field: 'optionalDependenciesInstallChainVerified',
      value: summary.optionalDependenciesInstallChainVerified,
    },
    {
      stage: 'optional_package_install_chain',
      field: 'optionalDependenciesLockfileVerified',
      value: summary.optionalDependenciesLockfileVerified,
    },
    {
      stage: 'optional_package_install_chain',
      field: 'optionalDependenciesInstalledPackagesVerified',
      value: summary.optionalDependenciesInstalledPackagesVerified,
    },
    {
      stage: 'packaging_config_allowlist',
      field: 'packagingConfigVerified',
      value: summary.packagingConfigVerified,
    },
    {
      stage: 'packaged_app_bundled_binary_smoke',
      field: 'realPackagedBinaryVerified',
      value: summary.realPackagedBinaryVerified,
    },
    {
      stage: 'packaged_app_bundled_binary_smoke',
      field: 'bundledBinaryVerified',
      value: summary.bundledBinaryVerified,
    },
  ]
}

function getNativeSearchReleaseHandoffNoGoExpectedApprovalCommands(
  _summary: NativeRuntimeSmokeSummary,
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage'],
): string[] | null {
  switch (gate) {
    case 'optional_package_publication':
      return NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => (
        `npm publish <native-search-package-source:${plan.packageName}> --access public`
      ))
    case 'optional_dependencies_declaration':
    case 'optional_package_install_chain':
      return [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest --check-registry",
        'bun install --frozen-lockfile --dry-run',
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest",
      ]
    case 'packaging_config_allowlist':
      return [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest",
        getNativeSearchPackagedSmokePlaceholderCommand(),
      ]
    case 'packaged_app_bundled_binary_smoke':
      return [getNativeSearchPackagedSmokePlaceholderCommand()]
    case 'default_enable_risk_review':
    case 'publish_target_preflight':
    case 'package_source_preflight':
    case 'complete':
      return []
  }
}

function getNativeSearchReleaseHandoffNoGoExpectedPacketCommands(
  gate: NativeSearchOptionalPackageExecutionPlan['nextStage'],
): string[] | null {
  switch (gate) {
    case 'optional_package_publication':
      return null
    case 'packaged_app_bundled_binary_smoke':
      return [getNativeSearchPackagedSmokePlaceholderCommand()]
    case 'optional_package_install_chain':
      return ['bun install --frozen-lockfile']
    case 'optional_dependencies_declaration':
    case 'packaging_config_allowlist':
    case 'default_enable_risk_review':
    case 'publish_target_preflight':
    case 'package_source_preflight':
    case 'complete':
      return []
  }
}

function addNativeSearchReleaseHandoffNoGoViolation(
  violations: NativeSearchReleaseHandoffNoGoBoundaryViolation[],
  condition: boolean,
  code: NativeSearchReleaseHandoffNoGoBoundaryViolationCode,
  gate?: NativeSearchOptionalPackageExecutionPlan['nextStage'],
  field?: string,
): void {
  if (!condition) return
  const violation: NativeSearchReleaseHandoffNoGoBoundaryViolation = { code }
  if (gate) violation.gate = gate
  if (field) violation.field = field
  if (violations.some((item) => (
    item.code === violation.code
    && item.gate === violation.gate
    && item.field === violation.field
  ))) {
    return
  }
  violations.push(violation)
}

function getNativeSearchReleaseHandoffTransitionReadinessFailures(input: {
  gate: NativeSearchReleaseHandoffApprovalGate
  checklist: NativeSearchReleaseHandoffGateExecutionEvidenceChecklistItem | undefined
  beforeSummary: NativeRuntimeSmokeSummary
}): string[] {
  const failures: string[] = []

  if (input.beforeSummary.nativeSearchReleaseHandoffPlan.nextGate !== input.gate) {
    failures.push('before_next_gate_mismatch')
  }
  if (input.checklist?.currentGate !== true) {
    failures.push('before_gate_not_current')
  }
  if (input.checklist?.status !== 'ready_for_approval') {
    failures.push('before_gate_not_ready_for_approval')
  }

  return failures
}

function getNativeSearchReleaseHandoffGateSpecificBoundaryViolations(
  gate: NativeSearchReleaseHandoffApprovalGate,
  summary: NativeRuntimeSmokeSummary,
): string[] {
  if (gate !== 'packaged_app_bundled_binary_smoke') return []

  const violations: string[] = []
  if (summary.packagedBundledBinarySmokePlan.status !== 'verified') {
    violations.push('packaged_smoke_plan_not_verified')
  }
  if (summary.packagedBundledBinarySmokePlan.blockedBy.length > 0) {
    violations.push('packaged_smoke_plan_blocked')
  }
  if (summary.packagedBundledBinarySmokeInvocationPlan.status !== 'verified') {
    violations.push('packaged_smoke_invocation_not_verified')
  }
  if (summary.packagedBundledBinarySmokeInvocationPlan.blockedBy.length > 0) {
    violations.push('packaged_smoke_invocation_blocked')
  }
  if (!summary.packagedBundledBinarySmokeInvocationPlan.appNodeModulesRootResolved) {
    violations.push('packaged_app_node_modules_root_unresolved')
  }
  if (!summary.packagedAppLayoutVerified) {
    violations.push('packaged_app_layout_not_verified')
  }
  if (!summary.packagedAppEvidenceVerified) {
    violations.push('packaged_app_evidence_not_verified')
  }
  if (!summary.packagedAppIdentityVerified) {
    violations.push('packaged_app_identity_not_verified')
  }

  return violations
}

function isNativeRuntimeSmokeSummaryFlagSatisfied(
  summary: NativeRuntimeSmokeSummary,
  flag: string,
): boolean {
  const [path, rawExpectedValue] = flag.split('=')
  const value = getNativeRuntimeSmokeSummaryFlagValue(summary, path ?? '')
  if (rawExpectedValue == null) return value === true
  if (rawExpectedValue === 'true') return value === true
  if (rawExpectedValue === 'false') return value === false
  return false
}

function getNativeRuntimeSmokeSummaryFlagValue(
  summary: NativeRuntimeSmokeSummary,
  path: string,
): boolean | undefined {
  switch (path) {
    case 'optionalPackagePublicationChecked':
      return summary.optionalPackagePublicationChecked
    case 'optionalPackagesPublished':
      return summary.optionalPackagesPublished
    case 'optionalDependenciesDeclared':
      return summary.optionalDependenciesDeclared
    case 'optionalDependenciesInstallChainVerified':
      return summary.optionalDependenciesInstallChainVerified
    case 'optionalDependenciesLockfileVerified':
      return summary.optionalDependenciesLockfileVerified
    case 'optionalDependenciesInstalledPackagesVerified':
      return summary.optionalDependenciesInstalledPackagesVerified
    case 'packagingConfigVerified':
      return summary.packagingConfigVerified
    case 'realPackagedBinaryVerified':
      return summary.realPackagedBinaryVerified
    case 'bundledBinaryVerified':
      return summary.bundledBinaryVerified
    case 'usesTemporaryFixture':
      return summary.usesTemporaryFixture
    case 'nativeSearchDefaultEnableReadiness.defaultEnableCandidate':
      return summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate
    case 'optionalPackageExecutionPlan.verified':
      return summary.optionalPackageExecutionPlan.verified
    default:
      return undefined
  }
}

function buildPackagedBundledBinarySmokeInvocationPlan(input: {
  packagedAppRootProvided: boolean
  appNodeModulesRootProvided: boolean
  appNodeModulesRootResolved: boolean
  resolutionEvidence: PackagedAppNodeModulesResolutionEvidence
  plan: PackagedBundledBinarySmokePlan
  bundledBinaryVerified: boolean
}): PackagedBundledBinarySmokeInvocationPlan {
  const blockedBy: PackagedBundledBinarySmokeInvocationPlanBlocker[] = [
    ...input.plan.blockedBy,
  ]

  if (!input.appNodeModulesRootResolved) {
    if (input.appNodeModulesRootProvided) {
      blockedBy.push('app_node_modules_root_unresolved')
    } else {
      blockedBy.push(input.packagedAppRootProvided
        ? 'packaged_app_root_unresolved'
        : 'packaged_app_root_required')
    }
  }

  const inputMode = input.packagedAppRootProvided
    ? 'packaged_app_root'
    : input.appNodeModulesRootProvided ? 'app_node_modules_root' : 'none'
  const status = input.bundledBinaryVerified && blockedBy.length === 0
    ? 'verified'
    : blockedBy.length === 0 ? 'ready_for_execution' : 'blocked'

  return {
    schemaVersion: 1,
    status,
    inputMode,
    packagedAppRootProvided: input.packagedAppRootProvided,
    appNodeModulesRootProvided: input.appNodeModulesRootProvided,
    appNodeModulesRootResolved: input.appNodeModulesRootResolved,
    resolutionEvidence: input.resolutionEvidence,
    blockedBy: uniquePackagedBundledBinarySmokeInvocationBlockers(blockedBy),
    requiredInputs: [
      'published_optional_packages',
      'native_search_optional_dependencies',
      'optional_dependency_install_chain',
      'electron_builder_native_search_allowlist',
      'prebuilt_packaged_app_root',
      'packaged_app_identity',
      'bundled_native_search_binary',
    ],
    acceptanceEvidence: [
      'packaged_app_root_resolves_to_app_node_modules',
      'packaged_app_evidence_is_unpacked_app_or_asar_unpacked',
      'packaged_app_identity_matches_codeinsights_electron',
      'native_search_optional_package_manifest_valid',
      'native_search_binary_is_executable',
      'native_search_binary_sha256_matches_manifest',
      'optional_packages_published_for_expected_version',
      'optional_dependencies_install_chain_verified',
      'builder_allowlist_includes_native_search_packages',
      'summary_bundledBinaryVerified_true',
    ],
    executionDesign: buildPackagedBundledBinarySmokeExecutionDesign(),
    candidateCommand: getNativeSearchPackagedSmokePlaceholderCommand(),
    legacyCandidateCommand: "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --app-node-modules-root <packaged-app-node_modules> --check-registry",
    forbiddenActions: [
      'do_not_enable_native_by_default_before_verified',
      'do_not_use_temporary_fixture_as_real_packaged_binary_evidence',
      'do_not_use_system_path_for_native_binary',
      'do_not_output_binary_path_packaged_root_or_node_modules_root',
      'do_not_modify_electron_builder_yml_without_approval',
      'do_not_add_native_search_optional_dependencies_before_publication',
      'do_not_treat_invocation_plan_as_packaged_binary_verified',
    ],
  }
}

function buildPackagedBundledBinarySmokeExecutionDesign(): PackagedBundledBinarySmokeExecutionDesign {
  return {
    schemaVersion: 1,
    preferredInputMode: 'packaged_app_root',
    legacyInputMode: 'app_node_modules_root',
    registryCheckRequired: true,
    realPackagedAppRequired: true,
    temporaryFixtureAllowedAsRealEvidence: false,
    createsPackagedApp: false,
    publishesPackages: false,
    installsDependencies: false,
    modifiesBuilderConfig: false,
    passCriteria: [
      'packaged_app_root_resolves_to_app_node_modules',
      'packaged_app_identity_matches_codeinsights_electron',
      'optional_packages_published_for_expected_version',
      'optional_dependencies_install_chain_verified',
      'builder_allowlist_includes_native_search_packages',
      'summary_bundledBinaryVerified_true',
    ],
    failClosedCriteria: [
      'missing_or_unresolved_packaged_app_root',
      'temporary_fixture_used_as_real_evidence',
      'optional_packages_not_published',
      'optional_dependencies_not_installed',
      'builder_allowlist_not_verified',
      'bundledBinaryVerified_not_true',
    ],
  }
}

function uniquePackagedBundledBinarySmokeInvocationBlockers(
  blockers: PackagedBundledBinarySmokeInvocationPlanBlocker[],
): PackagedBundledBinarySmokeInvocationPlanBlocker[] {
  return blockers.filter((blocker, index) => blockers.indexOf(blocker) === index)
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
    const packagedAppNodeModulesResolution = resolvePackagedAppNodeModulesRoot({
      packagedAppRoot: options.packagedAppRoot,
      appNodeModulesRoot: options.appNodeModulesRoot,
    })

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
      const optionalDependenciesInstallChainPlanVersion = readNativeSearchSourceBinaryVersion()
      const optionalDependenciesInstallChain = readCurrentNativeSearchOptionalPackageInstallChain()
      const optionalDependenciesResult = optionalDependenciesInstallChain.optionalDependencies
      const optionalPackagePublication = await readNativeSearchOptionalPackagePublication(
        options.checkRegistry === true,
        buildNativeSearchOptionalDependencyExpectedVersions(optionalDependenciesInstallChainPlanVersion),
      )
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
        publishedOptionalPackages: options.checkRegistry === true
          ? optionalPackagePublication.publishedPackages
          : [],
        invalidPublishedOptionalPackages: options.checkRegistry === true
          ? optionalPackagePublication.invalidPackages
          : [],
        existingInvalidPublishedOptionalPackages: options.checkRegistry === true
          ? optionalPackagePublication.existingInvalidPackages ?? []
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
        optionalDependenciesInstallChainPlanVersion,
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
      const optionalDependenciesInstallChainPlanVersion = readNativeSearchSourceBinaryVersion()
      const optionalPackagePublication = await readNativeSearchOptionalPackagePublication(
        options.checkRegistry === true,
        buildNativeSearchOptionalDependencyExpectedVersions(optionalDependenciesInstallChainPlanVersion),
      )
      if (options.packagedAppRoot) {
        cases.push(buildPackagedAppRootResolutionCase(packagedAppNodeModulesResolution))
      }
      const packagedAppResult = runPackagedAppLayoutCase(
        packagedAppNodeModulesResolution.appNodeModulesRoot ?? options.appNodeModulesRoot,
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
        publishedOptionalPackages: packagedAppResult.publishedOptionalPackages,
        invalidPublishedOptionalPackages: packagedAppResult.invalidPublishedOptionalPackages,
        existingInvalidPublishedOptionalPackages: packagedAppResult.existingInvalidPublishedOptionalPackages,
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
        optionalDependenciesInstallChainPlanVersion,
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
      packagedAppRoot: options.packagedAppRoot,
      appNodeModulesRoot: options.appNodeModulesRoot,
      packagedAppNodeModulesResolution,
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

function getPackagedAppNodeModulesRootCandidates(packagedAppRoot: string): Array<{
  evidence: PackagedAppNodeModulesResolutionEvidence
  appNodeModulesRoot: string
}> {
  const candidates: Array<{
    evidence: PackagedAppNodeModulesResolutionEvidence
    appNodeModulesRoot: string
  }> = []
  const baseName = basename(packagedAppRoot)
  const lowerBaseName = baseName.toLowerCase()

  if (extname(packagedAppRoot).toLowerCase() === '.app') {
    const resourcesRoot = join(packagedAppRoot, 'Contents', 'Resources')
    candidates.push(
      {
        evidence: 'macos_app_resources_app',
        appNodeModulesRoot: join(resourcesRoot, 'app', 'node_modules'),
      },
      {
        evidence: 'macos_app_asar_unpacked',
        appNodeModulesRoot: join(resourcesRoot, 'app.asar.unpacked', 'node_modules'),
      },
    )
  }

  if (lowerBaseName === 'resources') {
    candidates.push(
      {
        evidence: 'resources_app',
        appNodeModulesRoot: join(packagedAppRoot, 'app', 'node_modules'),
      },
      {
        evidence: 'resources_app_asar_unpacked',
        appNodeModulesRoot: join(packagedAppRoot, 'app.asar.unpacked', 'node_modules'),
      },
    )
  }

  if (baseName === 'app') {
    candidates.push({
      evidence: 'direct_app_root',
      appNodeModulesRoot: join(packagedAppRoot, 'node_modules'),
    })
  }

  if (baseName === 'app.asar.unpacked') {
    candidates.push({
      evidence: 'direct_asar_unpacked_root',
      appNodeModulesRoot: join(packagedAppRoot, 'node_modules'),
    })
  }

  return candidates
}

function buildPackagedAppRootResolutionCase(
  resolution: PackagedAppNodeModulesResolution,
): NativeRuntimeSmokeCase {
  if (resolution.resolved) {
    return {
      name: 'packaged-app-root-resolution',
      status: 'passed',
      detail: [
        `packagedAppRootResolutionEvidence=${resolution.evidence}`,
        'appNodeModulesRootResolved=true',
      ].join('; '),
    }
  }

  return {
    name: 'packaged-app-root-resolution',
    status: 'failed',
    detail: [
      `packagedAppRootResolutionEvidence=${resolution.evidence}`,
      `reason=${resolution.failureReason ?? 'packaged_app_root_unrecognized'}`,
      'appNodeModulesRootResolved=false',
      'realPackagedBinaryVerified=false',
    ].join('; '),
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
  publishedOptionalPackages: string[]
  missingPublishedOptionalPackages: string[]
  invalidPublishedOptionalPackages: string[]
  existingInvalidPublishedOptionalPackages: string[]
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
        detail: '未提供 --packaged-app-root 或 --app-node-modules-root；requiresPrebuiltPackagedApp=true; realPackagedBinaryVerified=false',
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
  | 'publishedOptionalPackages'
  | 'missingPublishedOptionalPackages'
  | 'invalidPublishedOptionalPackages'
  | 'existingInvalidPublishedOptionalPackages'
  | 'unavailablePublishedOptionalPackages'
> {
  return {
    optionalPackagePublicationChecked: registryChecked,
    optionalPackagesPublished: registryChecked && optionalPackagePublication.published,
    publishedOptionalPackages: registryChecked ? optionalPackagePublication.publishedPackages : [],
    missingPublishedOptionalPackages: registryChecked ? optionalPackagePublication.missingPackages : [],
    invalidPublishedOptionalPackages: registryChecked ? optionalPackagePublication.invalidPackages : [],
    existingInvalidPublishedOptionalPackages: registryChecked
      ? optionalPackagePublication.existingInvalidPackages ?? []
      : [],
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
  expectedPackageVersions?: Record<string, string>,
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
    expectedPackageVersions: expectedPackageVersions ?? readCurrentNativeSearchOptionalDependencyExpectedVersions(),
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

function buildNativeSearchOptionalDependencyExpectedVersions(packageVersion: string | null): Record<string, string> {
  const exactVersion = typeof packageVersion === 'string' ? packageVersion.trim() : ''
  if (exactVersion.length === 0) return readCurrentNativeSearchOptionalDependencyExpectedVersions()

  return Object.fromEntries(
    NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [plan.packageName, exactVersion]),
  )
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
