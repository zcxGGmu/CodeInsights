import { describe, expect, test } from 'bun:test'
import {
  evaluateNativeSearchDefaultEnableReadiness,
} from './native-runtime-default-enable-readiness'

describe('native-runtime-default-enable-readiness', () => {
  test('当前仓库缺少真实 packaged / optional gate 时必须保持显式 opt-in', () => {
    const readiness = evaluateNativeSearchDefaultEnableReadiness({
      benchmarkEvaluated: true,
      benchmarkGatePassed: true,
      agentFacadeNativeExtractorDeclared: true,
      agentFacadeNativeParityEvaluated: true,
      optionalDependenciesDeclared: false,
      optionalDependenciesInstallChainVerified: false,
      packagedAppEvidenceVerified: false,
      packagedAppIdentityVerified: false,
      realPackagedBinaryVerified: false,
      riskReviewCompleted: false,
    })

    expect(readiness).toEqual({
      schemaVersion: 1,
      evaluated: true,
      defaultEnableCandidate: false,
      explicitOptInRequired: true,
      blockers: [
        'optional_dependencies_not_declared',
        'optional_package_install_chain_not_verified',
        'packaged_app_evidence_not_verified',
        'packaged_app_identity_not_verified',
        'packaged_app_bundled_binary_not_verified',
        'default_enable_risk_review_not_completed',
      ],
      gates: {
        benchmarkEvaluated: true,
        benchmarkGatePassed: true,
        agentFacadeNativeExtractorDeclared: true,
        agentFacadeNativeParityEvaluated: true,
        optionalDependenciesDeclared: false,
        optionalDependenciesInstallChainVerified: false,
        packagedAppEvidenceVerified: false,
        packagedAppIdentityVerified: false,
        realPackagedBinaryVerified: false,
        riskReviewCompleted: false,
      },
    })
    expect(JSON.stringify(readiness)).not.toContain('/Users/')
    expect(JSON.stringify(readiness)).not.toContain('binaryPath')
  })

  test('未评估 benchmark 和 Agent parity 时不能被 packaged gate 绕过', () => {
    const readiness = evaluateNativeSearchDefaultEnableReadiness({
      benchmarkEvaluated: false,
      benchmarkGatePassed: false,
      agentFacadeNativeExtractorDeclared: true,
      agentFacadeNativeParityEvaluated: false,
      optionalDependenciesDeclared: true,
      optionalDependenciesInstallChainVerified: true,
      packagedAppEvidenceVerified: true,
      packagedAppIdentityVerified: true,
      realPackagedBinaryVerified: true,
      riskReviewCompleted: true,
    })

    expect(readiness.defaultEnableCandidate).toBe(false)
    expect(readiness.explicitOptInRequired).toBe(true)
    expect(readiness.blockers).toEqual([
      'native_benchmark_not_evaluated',
      'native_benchmark_gate_not_passed',
      'agent_facade_native_parity_not_evaluated',
    ])
  })

  test('所有 gate 和风险复核通过后才允许成为默认启用候选', () => {
    const readiness = evaluateNativeSearchDefaultEnableReadiness({
      benchmarkEvaluated: true,
      benchmarkGatePassed: true,
      agentFacadeNativeExtractorDeclared: true,
      agentFacadeNativeParityEvaluated: true,
      optionalDependenciesDeclared: true,
      optionalDependenciesInstallChainVerified: true,
      packagedAppEvidenceVerified: true,
      packagedAppIdentityVerified: true,
      realPackagedBinaryVerified: true,
      riskReviewCompleted: true,
    })

    expect(readiness.defaultEnableCandidate).toBe(true)
    expect(readiness.explicitOptInRequired).toBe(false)
    expect(readiness.blockers).toEqual([])
  })
})
