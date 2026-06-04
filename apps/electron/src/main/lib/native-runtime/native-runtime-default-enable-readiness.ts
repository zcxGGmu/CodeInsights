export type NativeSearchDefaultEnableBlocker =
  | 'native_benchmark_not_evaluated'
  | 'native_benchmark_gate_not_passed'
  | 'agent_facade_native_extractor_not_declared'
  | 'agent_facade_native_parity_not_evaluated'
  | 'optional_packages_not_published'
  | 'optional_dependencies_not_declared'
  | 'optional_package_install_chain_not_verified'
  | 'packaging_config_not_verified'
  | 'packaged_app_evidence_not_verified'
  | 'packaged_app_identity_not_verified'
  | 'packaged_app_bundled_binary_not_verified'
  | 'default_enable_risk_review_not_completed'

export interface NativeSearchDefaultEnableGates {
  benchmarkEvaluated: boolean
  benchmarkGatePassed: boolean
  agentFacadeNativeExtractorDeclared: boolean
  agentFacadeNativeParityEvaluated: boolean
  optionalPackagesPublished: boolean
  optionalDependenciesDeclared: boolean
  optionalDependenciesInstallChainVerified: boolean
  packagingConfigVerified: boolean
  packagedAppEvidenceVerified: boolean
  packagedAppIdentityVerified: boolean
  realPackagedBinaryVerified: boolean
  riskReviewCompleted: boolean
}

export interface NativeSearchDefaultEnableReadiness {
  schemaVersion: 1
  evaluated: boolean
  defaultEnableCandidate: boolean
  explicitOptInRequired: boolean
  blockers: NativeSearchDefaultEnableBlocker[]
  gates: NativeSearchDefaultEnableGates
}

export function evaluateNativeSearchDefaultEnableReadiness(
  gates: NativeSearchDefaultEnableGates,
): NativeSearchDefaultEnableReadiness {
  const blockers: NativeSearchDefaultEnableBlocker[] = []

  if (!gates.benchmarkEvaluated) blockers.push('native_benchmark_not_evaluated')
  if (!gates.benchmarkGatePassed) blockers.push('native_benchmark_gate_not_passed')
  if (!gates.agentFacadeNativeExtractorDeclared) blockers.push('agent_facade_native_extractor_not_declared')
  if (!gates.agentFacadeNativeParityEvaluated) blockers.push('agent_facade_native_parity_not_evaluated')
  if (!gates.optionalPackagesPublished) blockers.push('optional_packages_not_published')
  if (!gates.optionalDependenciesDeclared) blockers.push('optional_dependencies_not_declared')
  if (!gates.optionalDependenciesInstallChainVerified) blockers.push('optional_package_install_chain_not_verified')
  if (!gates.packagingConfigVerified) blockers.push('packaging_config_not_verified')
  if (!gates.packagedAppEvidenceVerified) blockers.push('packaged_app_evidence_not_verified')
  if (!gates.packagedAppIdentityVerified) blockers.push('packaged_app_identity_not_verified')
  if (!gates.realPackagedBinaryVerified) blockers.push('packaged_app_bundled_binary_not_verified')
  if (!gates.riskReviewCompleted) blockers.push('default_enable_risk_review_not_completed')

  const defaultEnableCandidate = blockers.length === 0
  return {
    schemaVersion: 1,
    evaluated: true,
    defaultEnableCandidate,
    explicitOptInRequired: !defaultEnableCandidate,
    blockers,
    gates,
  }
}
