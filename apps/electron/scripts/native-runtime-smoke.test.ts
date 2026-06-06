import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  buildNativeSearchPackageManifest,
  getNativeSearchOptionalPackagePlan,
  NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS,
} from '../src/main/lib/native-runtime/native-runtime-package-manifest'
import {
  buildPackagedPackagingConfigPreflightCase,
  buildNativeRuntimeSmokeSummary,
  getNativeRuntimeSmokeExitCode,
  parseNativeRuntimeSmokeArgs,
  resolvePackagedAppNodeModulesRoot,
  runNativeRuntimeSmoke,
} from './native-runtime-smoke'

const originalNativeSearchBinary = process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY
const originalFetch = globalThis.fetch

afterEach(() => {
  if (originalNativeSearchBinary == null) {
    delete process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY
  } else {
    process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY = originalNativeSearchBinary
  }
  globalThis.fetch = originalFetch
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
      '--check-registry',
    ])

    expect(options).toEqual({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app.asar.unpacked/node_modules',
      checkRegistry: true,
      query: '关键字',
    })
  })

  test('parseNativeRuntimeSmokeArgs 支持 packaged app root', () => {
    const options = parseNativeRuntimeSmokeArgs([
      '--mode',
      'packaged-app-layout',
      '--packaged-app-root',
      '/Applications/CodeInsights.app',
      '--check-registry',
    ])

    expect(options).toEqual({
      mode: 'packaged-app-layout',
      packagedAppRoot: '/Applications/CodeInsights.app',
      checkRegistry: true,
      query: '关键字',
    })
  })

  test('packaged app root resolver 支持 macOS .app 的 asar false 布局', () => {
    const fixture = createPackagedAppLayoutFixture('unpacked-app')
    try {
      const resolution = resolvePackagedAppNodeModulesRoot({
        packagedAppRoot: fixture.appRoot,
      })

      expect(resolution).toEqual({
        resolved: true,
        source: 'packaged_app_root',
        evidence: 'macos_app_resources_app',
        appNodeModulesRoot: fixture.nodeModulesRoot,
      })
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app root resolver 支持 macOS .app 的 asar.unpacked 布局', () => {
    const fixture = createPackagedAppLayoutFixture('macos-asar-unpacked')
    try {
      const resolution = resolvePackagedAppNodeModulesRoot({
        packagedAppRoot: fixture.appRoot,
      })

      expect(resolution).toEqual({
        resolved: true,
        source: 'packaged_app_root',
        evidence: 'macos_app_asar_unpacked',
        appNodeModulesRoot: fixture.nodeModulesRoot,
      })
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app root resolver 支持直接传 Resources/app', () => {
    const fixture = createPackagedAppLayoutFixture('unpacked-app')
    try {
      const resolution = resolvePackagedAppNodeModulesRoot({
        packagedAppRoot: fixture.resourcesAppRoot,
      })

      expect(resolution).toEqual({
        resolved: true,
        source: 'packaged_app_root',
        evidence: 'direct_app_root',
        appNodeModulesRoot: fixture.nodeModulesRoot,
      })
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app root resolver 支持直接传 Resources 目录', () => {
    const fixture = createPackagedAppLayoutFixture('unpacked-app')
    try {
      const resolution = resolvePackagedAppNodeModulesRoot({
        packagedAppRoot: dirname(fixture.resourcesAppRoot),
      })

      expect(resolution).toEqual({
        resolved: true,
        source: 'packaged_app_root',
        evidence: 'resources_app',
        appNodeModulesRoot: fixture.nodeModulesRoot,
      })
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app root resolver 旧显式 node_modules 参数优先', () => {
    const fixture = createPackagedAppLayoutFixture('unpacked-app')
    const explicitRoot = join(fixture.rootDir, 'explicit-node-modules')
    mkdirSync(explicitRoot, { recursive: true })

    try {
      const resolution = resolvePackagedAppNodeModulesRoot({
        packagedAppRoot: fixture.appRoot,
        appNodeModulesRoot: explicitRoot,
      })

      expect(resolution).toEqual({
        resolved: true,
        source: 'explicit_app_node_modules_root',
        evidence: 'explicit_app_node_modules_root',
        appNodeModulesRoot: explicitRoot,
      })
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app root resolver 不把缺失的旧显式 node_modules 参数标成 resolved', () => {
    const missingRoot = join(tmpdir(), 'codeinsights-native-missing-node-modules')
    const resolution = resolvePackagedAppNodeModulesRoot({
      appNodeModulesRoot: missingRoot,
    })

    expect(resolution).toEqual({
      resolved: false,
      source: 'explicit_app_node_modules_root',
      evidence: 'explicit_app_node_modules_root',
      failureReason: 'app_node_modules_root_not_found',
    })
    expect(JSON.stringify(resolution)).not.toContain(missingRoot)
  })

  test('packaged app root resolver 失败时只给 reason code', () => {
    const missingRoot = join(tmpdir(), 'codeinsights-native-missing.app')
    const resolution = resolvePackagedAppNodeModulesRoot({
      packagedAppRoot: missingRoot,
    })

    expect(resolution).toEqual({
      resolved: false,
      source: 'packaged_app_root',
      evidence: 'none',
      failureReason: 'packaged_app_root_not_found',
    })
    expect(JSON.stringify(resolution)).not.toContain(missingRoot)
  })

  test('parseNativeRuntimeSmokeArgs 支持 optional package publish target dry-run', () => {
    const options = parseNativeRuntimeSmokeArgs([
      '--mode',
      'optional-package-publish-target',
      '--native-search-package-version',
      '0.0.3',
      '--check-registry',
    ])

    expect(options).toEqual({
      mode: 'optional-package-publish-target',
      nativeSearchPackageVersion: '0.0.3',
      checkRegistry: true,
      query: '关键字',
    })
  })

  test('parseNativeRuntimeSmokeArgs 支持 optional package source preflight', () => {
    const options = parseNativeRuntimeSmokeArgs([
      '--mode',
      'optional-package-source',
      '--native-search-package-version',
      '0.0.3',
    ])

    expect(options).toEqual({
      mode: 'optional-package-source',
      nativeSearchPackageVersion: '0.0.3',
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
        optionalDependenciesDeclared: false,
        optionalDependenciesInstallChainVerified: false,
        missingOptionalDependencies: ['@codeinsights/native-search-darwin-arm64'],
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
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.missingOptionalDependencies).toEqual(['@codeinsights/native-search-darwin-arm64'])
    expect(summary.packagedAppLayoutVerified).toBe(false)
    expect(summary.packagedAppEvidenceVerified).toBe(false)
    expect(summary.packagedAppIdentityVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness).toMatchObject({
      evaluated: true,
      defaultEnableCandidate: false,
      explicitOptInRequired: true,
      blockers: [
        'native_benchmark_not_evaluated',
        'native_benchmark_gate_not_passed',
        'agent_facade_native_extractor_not_declared',
        'agent_facade_native_parity_not_evaluated',
        'optional_packages_not_published',
        'optional_dependencies_not_declared',
        'optional_package_install_chain_not_verified',
        'packaging_config_not_verified',
        'packaged_app_evidence_not_verified',
        'packaged_app_identity_not_verified',
        'packaged_app_bundled_binary_not_verified',
        'default_enable_risk_review_not_completed',
      ],
    })
    expect(serialized).not.toContain('/Users/demo/native-search')
    expect(serialized).not.toContain('CodeInsights.app')
    expect(serialized).toContain('[home]/native-search')
  })

  test('summary builder 不允许绕过 optionalDependencies gate 证明真实 packaged binary', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
      packagedAppNodeModulesResolution: createResolvedExplicitAppNodeModulesRoot(),
      verification: {
        bundledBinaryVerified: true,
        packagedAppLayoutVerified: true,
        packagedAppEvidenceVerified: true,
        packagedAppIdentityVerified: true,
        optionalDependenciesDeclared: false,
        optionalDependenciesInstallChainVerified: true,
        realPackagedBinaryVerified: true,
      },
      cases: [{
        name: 'packaged-app-layout',
        status: 'passed',
        detail: 'realPackagedBinaryVerified=true',
      }],
    })

    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toContain('optional_dependencies_not_declared')
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toContain('optional_packages_not_published')
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toContain('packaging_config_not_verified')
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toContain('packaged_app_bundled_binary_not_verified')
  })

  test('summary 输出 release-ready publish-target dry-run 字段且不改变真实 packaged gate', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'optional-package-publish-target',
      verification: {
        optionalPackagePublishTargetChecked: true,
        optionalPackagePublishTargetReady: true,
        optionalPackagePublishTargetVersion: '0.0.3',
        optionalPackagePublishTargetBlockers: [],
        publishTargetAvailablePackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
        publishedVersionCollisionPackages: [],
        invalidPublishTargetPackages: [],
        unavailablePublishTargetPackages: [],
        nativeSearchVersionConsistencyVerified: true,
        nativeSearchCargoVersion: '0.0.3',
        nativeSearchBinaryVersion: '0.0.3',
        plannedOptionalPackageManifestsVerified: true,
      },
      cases: [{
        name: 'optional-package-publish-target',
        status: 'passed',
        detail: 'optionalPackagePublishTargetReady=true',
      }],
    })

    expect(summary.optionalPackagePublishTargetChecked).toBe(true)
    expect(summary.optionalPackagePublishTargetReady).toBe(true)
    expect(summary.optionalPackagePublishTargetVersion).toBe('0.0.3')
    expect(summary.optionalPackagePublishTargetBlockers).toEqual([])
    expect(summary.publishTargetAvailablePackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.nativeSearchVersionConsistencyVerified).toBe(true)
    expect(summary.nativeSearchCargoVersion).toBe('0.0.3')
    expect(summary.nativeSearchBinaryVersion).toBe('0.0.3')
    expect(summary.plannedOptionalPackageManifestsVerified).toBe(true)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.packagedBundledBinarySmokePlan.status).toBe('blocked')
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.explicitOptInRequired).toBe(true)
    expect(JSON.stringify(summary)).not.toContain('/Users/')
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
  })

  test('summary 输出 optional package source preflight 字段且不改变真实 packaged gate', () => {
    const readyPackages = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'optional-package-source',
      verification: {
        optionalPackageSourceChecked: true,
        optionalPackageSourceReady: true,
        optionalPackageSourceVersion: '0.0.3',
        optionalPackageSourceBlockers: [],
        optionalPackageSourceReadyPackages: readyPackages,
        missingOptionalPackageSourcePackages: [],
        invalidOptionalPackageSourcePackages: [],
        plannedOptionalPackageSourceManifestsVerified: true,
      },
      cases: [{
        name: 'optional-package-source',
        status: 'passed',
        detail: 'optionalPackageSourceReady=true',
      }],
    })

    expect(summary.optionalPackageSourceChecked).toBe(true)
    expect(summary.optionalPackageSourceReady).toBe(true)
    expect(summary.optionalPackageSourceVersion).toBe('0.0.3')
    expect(summary.optionalPackageSourceBlockers).toEqual([])
    expect(summary.optionalPackageSourceReadyPackages).toEqual(readyPackages)
    expect(summary.missingOptionalPackageSourcePackages).toEqual([])
    expect(summary.invalidOptionalPackageSourcePackages).toEqual([])
    expect(summary.plannedOptionalPackageSourceManifestsVerified).toBe(true)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.packagedBundledBinarySmokePlan.status).toBe('blocked')
    expect(summary.optionalPackageExecutionPlan.nextStage).toBe('publish_target_preflight')
    expect(summary.optionalPackageExecutionPlan.readyForPublication).toBe(false)
    expect(summary.optionalPackageExecutionPlan.readyForOptionalDependencies).toBe(false)
    expect(summary.optionalPackageExecutionPlan.readyForDefaultEnableRiskReview).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.explicitOptInRequired).toBe(true)
    expect(JSON.stringify(summary)).not.toContain('/Users/')
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
  })

  test('summary 输出 optional package execution plan，ready source 和 publish target 只推进到 publication', () => {
    const readyPackages = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'optional-package-publish-target',
      verification: {
        optionalPackagePublishTargetChecked: true,
        optionalPackagePublishTargetReady: true,
        optionalPackagePublishTargetVersion: '0.0.3',
        optionalPackagePublishTargetBlockers: [],
        optionalPackageSourceChecked: true,
        optionalPackageSourceReady: true,
        optionalPackageSourceVersion: '0.0.3',
        optionalPackageSourceBlockers: [],
        optionalPackageSourceReadyPackages: readyPackages,
        plannedOptionalPackageSourceManifestsVerified: true,
        nativeSearchVersionConsistencyVerified: true,
        plannedOptionalPackageManifestsVerified: true,
      },
      cases: [{
        name: 'optional-package-execution-plan',
        status: 'passed',
        detail: 'source and publish target preflight ready',
      }],
    })

    expect(summary.optionalPackageExecutionPlan).toEqual(expect.objectContaining({
      schemaVersion: 1,
      nextStage: 'optional_package_publication',
      readyForPublication: true,
      readyForOptionalDependencies: false,
      readyForInstallChain: false,
      readyForPackagingConfigChange: false,
      readyForPackagedBundledBinarySmoke: false,
      readyForDefaultEnableRiskReview: false,
      verified: false,
    }))
    expect(summary.optionalPackageExecutionPlan.completedPrerequisites).toEqual([
      'publish_target_preflight',
      'package_source_preflight',
    ])
    expect(summary.optionalPackageExecutionPlan.observedEvidenceStages).toEqual([
      'publish_target_preflight',
      'package_source_preflight',
    ])
    expect(summary.optionalPackageExecutionPlan.blockedBy).toContain('optional_packages_not_published')
    expect(summary.optionalPackageExecutionPlan.blockedBy).toContain('optional_dependencies_not_declared')
    expect(summary.optionalPackageExecutionPlan.nextAllowedActions).toEqual([
      'publish_optional_packages_after_release_approval',
    ])
    expect(summary.optionalPackagePublicationChangePlan).toEqual(expect.objectContaining({
      schemaVersion: 1,
      status: 'ready_for_review',
      packageVersion: '0.0.3',
      publishTargetReady: true,
      packageSourceReady: true,
      optionalPackagesPublished: false,
      approvalRequired: true,
      blockedBy: [],
      candidateReviewAction: 'prepare_optional_package_publication_for_review',
    }))
    expect(summary.optionalPackagePublicationChangePlan.plannedPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => ({
        packageName: plan.packageName,
        packageVersion: '0.0.3',
      })),
    )
    expect(summary.optionalPackagePublicationChangePlan.candidatePublicationCommands).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => (
        `npm publish <native-search-package-source:${plan.packageName}> --access public`
      )),
    )
    expect(summary.optionalPackagePublicationInvocationPlan).toEqual(expect.objectContaining({
      schemaVersion: 1,
      status: 'ready_for_invocation',
      packageVersion: '0.0.3',
      approvalRequired: true,
      changePlanStatus: 'ready_for_review',
      readyPackages,
      excludedPackages: [],
      publishedPackages: [],
      blockedBy: [],
      candidateInvocationAction: 'invoke_optional_package_publication_after_release_approval',
    }))
    expect(summary.optionalPackagePublicationInvocationPlan.packages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => ({
        packageName: plan.packageName,
        packageVersion: '0.0.3',
        status: 'ready_for_invocation',
        blockedBy: [],
        candidatePublicationCommand: `npm publish <native-search-package-source:${plan.packageName}> --access public`,
      })),
    )
    expect(summary.optionalPackagePublicationInvocationPlan.candidatePublicationCommands).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => (
        `npm publish <native-search-package-source:${plan.packageName}> --access public`
      )),
    )
    expect(summary.optionalPackagePublicationInvocationPlan.forbiddenActions).toContain(
      'do_not_treat_invocation_plan_as_packages_published',
    )
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
    expect(JSON.stringify(summary.optionalPackageExecutionPlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.optionalPackageExecutionPlan)).not.toContain('binaryPath')
    expect(JSON.stringify(summary.optionalPackagePublicationChangePlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.optionalPackagePublicationChangePlan)).not.toContain('binaryPath')
    expect(JSON.stringify(summary.optionalPackagePublicationChangePlan)).not.toContain('registry.npmjs.org')
    expect(JSON.stringify(summary.optionalPackagePublicationInvocationPlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.optionalPackagePublicationInvocationPlan)).not.toContain('binaryPath')
    expect(JSON.stringify(summary.optionalPackagePublicationInvocationPlan)).not.toContain('registry.npmjs.org')
  })

  test('summary 输出 optionalDependencies install-chain dry-run plan 且不证明真实安装链路', () => {
    const expectedPackages = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'optional-package-publish-target',
      verification: {
        optionalPackagePublishTargetChecked: true,
        optionalPackagePublishTargetReady: true,
        optionalPackagePublishTargetVersion: '0.0.3',
        optionalPackageSourceChecked: true,
        optionalPackageSourceReady: true,
        optionalPackageSourceVersion: '0.0.3',
        missingOptionalDependencies: expectedPackages,
        missingOptionalDependencyLockfilePackages: expectedPackages,
        missingInstalledOptionalDependencies: expectedPackages,
      },
      cases: [{
        name: 'optional-package-publish-target',
        status: 'passed',
        detail: 'optionalPackagePublishTargetReady=true',
      }],
    })

    expect(summary.optionalDependenciesInstallChainChangePlan).toEqual({
      schemaVersion: 1,
      status: 'blocked',
      packageVersion: '0.0.3',
      optionalPackagesPublished: false,
      currentDeclarationVerified: false,
      currentInstallChainVerified: false,
      approvalRequired: true,
      plannedOptionalDependencies: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => ({
        packageName: plan.packageName,
        versionSpec: '0.0.3',
      })),
      missingOptionalDependencies: expectedPackages,
      invalidOptionalDependencies: [],
      missingLockfilePackages: expectedPackages,
      missingInstalledPackages: expectedPackages,
      invalidInstalledPackages: [],
      blockedBy: [
        'optional_packages_not_published',
        'optional_dependencies_not_declared',
        'optional_dependency_install_chain_not_verified',
        'optional_dependency_lockfile_not_verified',
        'optional_dependency_installed_packages_not_verified',
      ],
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
    })
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
    expect(JSON.stringify(summary.optionalDependenciesInstallChainChangePlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.optionalDependenciesInstallChainChangePlan)).not.toContain('binaryPath')
  })

  test('summary 默认输出 release handoff plan blocked 且不证明真实执行', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-manifest',
      verification: {
        optionalPackagePublicationChecked: false,
        optionalPackagesPublished: false,
        optionalDependenciesDeclared: false,
        optionalDependenciesInstallChainVerified: false,
        packagingConfigVerified: false,
        missingPackagingConfigPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
        blockingPackagingConfigExcludes: ['!node_modules/@codeinsights/**'],
      },
      cases: [{
        name: 'release-handoff',
        status: 'skipped',
        detail: 'default offline no-go',
      }],
    })

    expect(summary.nativeSearchReleaseHandoffPlan).toEqual(expect.objectContaining({
      schemaVersion: 1,
      status: 'blocked',
      nextGate: 'publish_target_preflight',
      releaseApprovalRequired: true,
      defaultOffRequired: true,
      verified: false,
      readyForPublicationInvocation: false,
      readyForOptionalDependenciesHandoff: false,
      readyForPackagingConfigHandoff: false,
      readyForPackagedSmokeHandoff: false,
      readyForDefaultEnableRiskReview: false,
      candidateNextCommands: [],
    }))
    expect(summary.nativeSearchReleaseHandoffPlan.gateBinding).toEqual({
      schemaVersion: 1,
      authoritativeNextGate: 'publish_target_preflight',
      publicationInvocationAllowedNextGate: 'optional_package_publication',
      packagedSmokeAllowedNextGate: 'packaged_app_bundled_binary_smoke',
      verifiedRequiresExecutionPlanVerified: true,
      failClosedOnOutOfOrderEvidence: true,
    })
    expect(summary.nativeSearchReleaseHandoffPlan.currentGateApprovalPacket).toEqual({
      schemaVersion: 1,
      gate: 'publish_target_preflight',
      status: 'blocked',
      approvalRequired: false,
      requiredApproval: null,
      requiredEvidenceBeforeExecution: [
        'optional_package_publish_target_registry_check',
        'optional_package_source_preflight',
        'optional_package_publication_registry_evidence',
        'optional_dependencies_declared_in_package_json',
        'optional_dependency_lockfile_resolved_entries',
        'optional_dependency_installed_package_manifests',
        'electron_builder_native_search_allowlist_verified',
        'real_packaged_app_bundled_binary_smoke',
        'default_enable_risk_review',
      ],
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
    })
    expect(summary.nativeSearchReleaseHandoffPlan.gateApprovalQueue.map((item) => ({
      gate: item.gate,
      status: item.status,
      currentGate: item.currentGate,
      approvalRequired: item.approvalRequired,
      candidateCommands: item.candidateCommands,
    }))).toEqual([
      {
        gate: 'optional_package_publication',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        candidateCommands: [],
      },
      {
        gate: 'optional_dependencies_declaration',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        candidateCommands: [],
      },
      {
        gate: 'optional_package_install_chain',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        candidateCommands: [],
      },
      {
        gate: 'packaging_config_allowlist',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        candidateCommands: [],
      },
      {
        gate: 'packaged_app_bundled_binary_smoke',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        candidateCommands: [],
      },
      {
        gate: 'default_enable_risk_review',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        candidateCommands: [],
      },
    ])
    expect(summary.nativeSearchReleaseHandoffPlan.blockedBy).toEqual([
      'optional_package_publish_target_not_ready',
      'optional_package_source_not_ready',
      'optional_package_publication_invocation_not_ready',
    ])
    expect(summary.nativeSearchReleaseHandoffPlan.missingEvidence).toEqual([
      'optional_package_publish_target_registry_check',
      'optional_package_source_preflight',
      'optional_package_publication_registry_evidence',
      'optional_dependencies_declared_in_package_json',
      'optional_dependency_lockfile_resolved_entries',
      'optional_dependency_installed_package_manifests',
      'electron_builder_native_search_allowlist_verified',
      'real_packaged_app_bundled_binary_smoke',
      'default_enable_risk_review',
    ])
    expect(summary.nativeSearchReleaseHandoffPlan.doesNotVerify).toEqual([
      'optional_packages_published',
      'optional_dependencies_declared',
      'optional_dependencies_installed',
      'packaging_config_verified',
      'packaged_binary_verified',
      'default_enable_candidate',
    ])
    expect(summary.nativeSearchReleaseHandoffPlan.forbiddenActions).toContain(
      'do_not_treat_release_handoff_as_package_published',
    )
    expect(summary.nativeSearchReleaseHandoffPlan.forbiddenActions).toContain(
      'do_not_enable_native_by_default_before_verified',
    )
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
    expect(JSON.stringify(summary.nativeSearchReleaseHandoffPlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.nativeSearchReleaseHandoffPlan)).not.toContain('binaryPath')
    expect(JSON.stringify(summary.nativeSearchReleaseHandoffPlan)).not.toContain('registry.npmjs.org')
  })

  test('summary 在 publication invocation ready 时只把 handoff 标成可交接，不证明已发布', () => {
    const readyPackages = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'optional-package-publish-target',
      verification: {
        optionalPackagePublishTargetChecked: true,
        optionalPackagePublishTargetReady: true,
        optionalPackagePublishTargetVersion: '0.0.3',
        optionalPackagePublishTargetBlockers: [],
        optionalPackageSourceChecked: true,
        optionalPackageSourceReady: true,
        optionalPackageSourceVersion: '0.0.3',
        optionalPackageSourceBlockers: [],
        optionalPackageSourceReadyPackages: readyPackages,
        plannedOptionalPackageSourceManifestsVerified: true,
        nativeSearchVersionConsistencyVerified: true,
        plannedOptionalPackageManifestsVerified: true,
      },
      cases: [{
        name: 'release-handoff',
        status: 'passed',
        detail: 'publication invocation ready',
      }],
    })

    expect(summary.optionalPackagePublicationInvocationPlan.status).toBe('ready_for_invocation')
    expect(summary.nativeSearchReleaseHandoffPlan).toEqual(expect.objectContaining({
      schemaVersion: 1,
      status: 'ready_for_release_handoff',
      nextGate: 'optional_package_publication',
      releaseApprovalRequired: true,
      defaultOffRequired: true,
      verified: false,
      readyForPublicationInvocation: true,
      readyForOptionalDependenciesHandoff: false,
      readyForPackagingConfigHandoff: false,
      readyForPackagedSmokeHandoff: false,
      readyForDefaultEnableRiskReview: false,
      blockedBy: [],
      candidateNextCommands: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => (
        `npm publish <native-search-package-source:${plan.packageName}> --access public`
      )),
    }))
    expect(summary.nativeSearchReleaseHandoffPlan.missingEvidence).toEqual([
      'optional_package_publication_registry_evidence',
      'optional_dependencies_declared_in_package_json',
      'optional_dependency_lockfile_resolved_entries',
      'optional_dependency_installed_package_manifests',
      'electron_builder_native_search_allowlist_verified',
      'real_packaged_app_bundled_binary_smoke',
      'default_enable_risk_review',
    ])
    expect(summary.nativeSearchReleaseHandoffPlan.requiredApprovals).toEqual([
      'release_approval',
      'npm_registry_publish_access',
      'package_json_optional_dependencies_change_approval',
      'install_chain_execution_approval',
      'electron_builder_allowlist_change_approval',
      'packaged_app_smoke_execution_approval',
      'default_enable_risk_review_approval',
    ])
    expect(summary.nativeSearchReleaseHandoffPlan.currentGateApprovalPacket).toEqual({
      schemaVersion: 1,
      gate: 'optional_package_publication',
      status: 'ready_for_approval',
      approvalRequired: true,
      requiredApproval: 'release_approval',
      requiredEvidenceBeforeExecution: [
        'release_approval_recorded',
        'npm_registry_auth_with_publish_access',
        'optional_package_publish_target_ready',
        'optional_package_source_ready',
      ],
      allowedActionsAfterApproval: [
        'run_candidate_npm_publish_commands',
        'run_packaged_manifest_registry_check_after_publish',
      ],
      candidateCommands: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => (
        `npm publish <native-search-package-source:${plan.packageName}> --access public`
      )),
      doesNotAuthorize: [
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
        'do_not_modify_package_json_before_publication_verified',
        'do_not_modify_bun_lock_before_publication_verified',
        'do_not_modify_electron_builder_yml_without_approval',
      ],
    })
    expect(summary.nativeSearchReleaseHandoffPlan.gateApprovalQueue.map((item) => ({
      gate: item.gate,
      status: item.status,
      currentGate: item.currentGate,
      approvalRequired: item.approvalRequired,
      requiredApproval: item.requiredApproval,
      candidateCommands: item.candidateCommands,
    }))).toEqual([
      {
        gate: 'optional_package_publication',
        status: 'ready_for_approval',
        currentGate: true,
        approvalRequired: true,
        requiredApproval: 'release_approval',
        candidateCommands: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => (
          `npm publish <native-search-package-source:${plan.packageName}> --access public`
        )),
      },
      {
        gate: 'optional_dependencies_declaration',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        requiredApproval: 'package_json_optional_dependencies_change_approval',
        candidateCommands: [],
      },
      {
        gate: 'optional_package_install_chain',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        requiredApproval: 'install_chain_execution_approval',
        candidateCommands: [],
      },
      {
        gate: 'packaging_config_allowlist',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        requiredApproval: 'electron_builder_allowlist_change_approval',
        candidateCommands: [],
      },
      {
        gate: 'packaged_app_bundled_binary_smoke',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        requiredApproval: 'packaged_app_smoke_execution_approval',
        candidateCommands: [],
      },
      {
        gate: 'default_enable_risk_review',
        status: 'blocked_until_prior_gate_verified',
        currentGate: false,
        approvalRequired: false,
        requiredApproval: 'default_enable_risk_review_approval',
        candidateCommands: [],
      },
    ])
    expect(summary.nativeSearchReleaseHandoffPlan.acceptanceEvidence).toContain(
      'registry_packument_contains_exact_expected_versions',
    )
    expect(summary.nativeSearchReleaseHandoffPlan.doesNotVerify).toEqual([
      'optional_packages_published',
      'optional_dependencies_declared',
      'optional_dependencies_installed',
      'packaging_config_verified',
      'packaged_binary_verified',
      'default_enable_candidate',
    ])
    expect(summary.nativeSearchReleaseHandoffPlan.forbiddenActions).toContain(
      'do_not_treat_ready_handoff_as_remote_write_completed',
    )
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
    expect(JSON.stringify(summary.nativeSearchReleaseHandoffPlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.nativeSearchReleaseHandoffPlan)).not.toContain('binaryPath')
    expect(JSON.stringify(summary.nativeSearchReleaseHandoffPlan)).not.toContain('registry.npmjs.org')
  })

  test('summary 顶层 ready 字段必须绑定 checked，避免和 execution plan 分叉', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'optional-package-publish-target',
      verification: {
        optionalPackagePublishTargetChecked: false,
        optionalPackagePublishTargetReady: true,
        optionalPackageSourceChecked: false,
        optionalPackageSourceReady: true,
      },
      cases: [{
        name: 'optional-package-ready-normalization',
        status: 'skipped',
        detail: 'checked=false; ready=true',
      }],
    })

    expect(summary.optionalPackagePublishTargetChecked).toBe(false)
    expect(summary.optionalPackagePublishTargetReady).toBe(false)
    expect(summary.optionalPackageSourceChecked).toBe(false)
    expect(summary.optionalPackageSourceReady).toBe(false)
    expect(summary.optionalPackageExecutionPlan.nextStage).toBe('publish_target_preflight')
    expect(summary.optionalPackageExecutionPlan.completedPrerequisites).toEqual([])
    expect(summary.optionalPackageExecutionPlan.observedEvidenceStages).toEqual([])
    expect(summary.optionalPackageExecutionPlan.readyForPublication).toBe(false)
    expect(summary.optionalPackageExecutionPlan.verified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
  })

  test('summary builder 不允许临时 fixture 证明真实 packaged binary', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
      packagedAppNodeModulesResolution: createResolvedExplicitAppNodeModulesRoot(),
      verification: {
        bundledBinaryVerified: true,
        usesTemporaryFixture: true,
        packagedAppLayoutVerified: true,
        packagedAppEvidenceVerified: true,
        packagedAppIdentityVerified: true,
        optionalDependenciesDeclared: true,
        optionalPackagePublicationChecked: true,
        optionalPackagesPublished: true,
        optionalDependenciesInstallChainVerified: true,
        optionalDependenciesLockfileVerified: true,
        optionalDependenciesInstalledPackagesVerified: true,
        packagingConfigVerified: true,
        realPackagedBinaryVerified: true,
      },
      cases: [{
        name: 'packaged-app-layout',
        status: 'passed',
        detail: 'usesTemporaryFixture=true; realPackagedBinaryVerified=true',
      }],
    })

    expect(summary.usesTemporaryFixture).toBe(true)
    expect(summary.optionalPackagesPublished).toBe(true)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(true)
    expect(summary.packagingConfigVerified).toBe(true)
    expect(summary.packagedAppEvidenceVerified).toBe(true)
    expect(summary.packagedAppIdentityVerified).toBe(true)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toContain('packaged_app_bundled_binary_not_verified')
  })

  test('summary builder 不允许绕过 packaged app evidence 和 identity gate', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
      packagedAppNodeModulesResolution: createResolvedExplicitAppNodeModulesRoot(),
      verification: {
        bundledBinaryVerified: true,
        packagedAppLayoutVerified: true,
        packagedAppEvidenceVerified: false,
        packagedAppIdentityVerified: false,
        optionalDependenciesDeclared: true,
        optionalPackagePublicationChecked: true,
        optionalPackagesPublished: true,
        optionalDependenciesInstallChainVerified: true,
        optionalDependenciesLockfileVerified: true,
        optionalDependenciesInstalledPackagesVerified: true,
        packagingConfigVerified: true,
        realPackagedBinaryVerified: true,
      },
      cases: [{
        name: 'packaged-app-layout',
        status: 'passed',
        detail: 'packagedAppEvidenceVerified=false; packagedAppIdentityVerified=false',
      }],
    })

    expect(summary.optionalDependenciesDeclared).toBe(true)
    expect(summary.optionalPackagesPublished).toBe(true)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(true)
    expect(summary.packagingConfigVerified).toBe(true)
    expect(summary.packagedAppEvidenceVerified).toBe(false)
    expect(summary.packagedAppIdentityVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toContain('packaged_app_evidence_not_verified')
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toContain('packaged_app_identity_not_verified')
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toContain('packaged_app_bundled_binary_not_verified')
  })

  test('summary 输出真实 packaged bundled binary smoke 执行计划并保持当前 no-go 为 blocked', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      verification: {
        requiresPrebuiltPackagedApp: true,
        optionalPackagePublicationChecked: true,
        optionalPackagesPublished: false,
        optionalDependenciesDeclared: false,
        optionalDependenciesInstallChainVerified: false,
        packagingConfigVerified: false,
        missingPackagingConfigPackages: ['@codeinsights/native-search-darwin-arm64'],
        blockingPackagingConfigExcludes: ['!node_modules/@codeinsights/**'],
      },
      cases: [{
        name: 'packaged-app-layout',
        status: 'skipped',
        detail: 'requiresPrebuiltPackagedApp=true',
      }],
    })

    expect(summary.packagedBundledBinarySmokePlan).toEqual({
      schemaVersion: 1,
      status: 'blocked',
      blockedBy: [
        'optional_packages_not_published',
        'optional_dependencies_not_declared',
        'optional_package_install_chain_not_verified',
        'packaging_config_not_verified',
        'prebuilt_packaged_app_required',
      ],
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
      candidateCommand: "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --packaged-app-root <packaged-app-root> --check-registry",
    })
    expect(summary.packagedBundledBinarySmokeInvocationPlan).toEqual({
      schemaVersion: 1,
      status: 'blocked',
      inputMode: 'none',
      packagedAppRootProvided: false,
      appNodeModulesRootProvided: false,
      appNodeModulesRootResolved: false,
      resolutionEvidence: 'none',
      blockedBy: [
        'optional_packages_not_published',
        'optional_dependencies_not_declared',
        'optional_package_install_chain_not_verified',
        'packaging_config_not_verified',
        'prebuilt_packaged_app_required',
        'packaged_app_root_required',
      ],
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
      executionDesign: {
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
      },
      candidateCommand: "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --packaged-app-root <packaged-app-root> --check-registry",
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
    })
    expect(JSON.stringify(summary.packagedBundledBinarySmokePlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.packagedBundledBinarySmokePlan)).not.toContain('binaryPath')
    expect(JSON.stringify(summary.packagedBundledBinarySmokeInvocationPlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.packagedBundledBinarySmokeInvocationPlan)).not.toContain('binaryPath')
  })

  test('summary 输出 builder allowlist dry-run plan 且不改变真实 packaged gate', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-manifest',
      verification: {
        packagingConfigVerified: false,
        missingPackagingConfigPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
        blockingPackagingConfigExcludes: ['!node_modules/@codeinsights/**'],
        tooBroadPackagingConfigIncludes: [],
      },
      cases: [{
        name: 'packaged-packaging-config-preflight',
        status: 'skipped',
        detail: 'packagingConfigVerified=false',
      }],
    })

    expect(summary.packagingConfigAllowlistChangePlan).toEqual({
      schemaVersion: 1,
      status: 'blocked',
      currentConfigVerified: false,
      approvalRequired: true,
      requiredIncludes: [
        'node_modules/@codeinsights/native-search-darwin-arm64/**/*',
        'node_modules/@codeinsights/native-search-darwin-x64/**/*',
        'node_modules/@codeinsights/native-search-win32-x64/**/*',
        'node_modules/@codeinsights/native-search-linux-x64/**/*',
      ],
      missingIncludes: [
        'node_modules/@codeinsights/native-search-darwin-arm64/**/*',
        'node_modules/@codeinsights/native-search-darwin-x64/**/*',
        'node_modules/@codeinsights/native-search-win32-x64/**/*',
        'node_modules/@codeinsights/native-search-linux-x64/**/*',
      ],
      blockingExcludes: ['!node_modules/@codeinsights/**'],
      tooBroadIncludes: [],
      removalCandidates: ['!node_modules/@codeinsights/**'],
      forbiddenIncludes: [
        'node_modules/**',
        'node_modules/**/*',
        'node_modules/@codeinsights/*',
        'node_modules/@codeinsights/**',
        'node_modules/@codeinsights/**/*',
        'node_modules/@codeinsights/native-search-*',
        'node_modules/@codeinsights/native-search-*/**/*',
      ],
      candidateYamlEditPlan: {
        schemaVersion: 1,
        targetFile: 'apps/electron/electron-builder.yml',
        modifiesFile: false,
        operationOrder: [
          'remove_blocking_native_search_excludes',
          'add_missing_exact_native_search_includes',
          'run_packaging_config_preflight',
        ],
        addIncludes: [
          'node_modules/@codeinsights/native-search-darwin-arm64/**/*',
          'node_modules/@codeinsights/native-search-darwin-x64/**/*',
          'node_modules/@codeinsights/native-search-win32-x64/**/*',
          'node_modules/@codeinsights/native-search-linux-x64/**/*',
        ],
        keepIncludes: [],
        removeRules: ['!node_modules/@codeinsights/**'],
        forbiddenIncludes: [
          'node_modules/**',
          'node_modules/**/*',
          'node_modules/@codeinsights/*',
          'node_modules/@codeinsights/**',
          'node_modules/@codeinsights/**/*',
          'node_modules/@codeinsights/native-search-*',
          'node_modules/@codeinsights/native-search-*/**/*',
        ],
        acceptanceEvidence: [
          'electron_builder_yml_reviewed_after_approval',
          'all_native_search_packages_have_exact_files_include',
          'blocking_codeinsights_node_modules_excludes_removed',
          'no_broad_node_modules_or_native_search_wildcard_include',
          'packaging_config_preflight_passes_after_edit',
        ],
      },
      candidateReviewAction: 'prepare_builder_allowlist_change_for_review',
      candidateVerificationCommands: [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest",
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --packaged-app-root <packaged-app-root> --check-registry",
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
    })
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.packagedBundledBinarySmokePlan.status).toBe('blocked')
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
    expect(JSON.stringify(summary.packagingConfigAllowlistChangePlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.packagingConfigAllowlistChangePlan)).not.toContain('binaryPath')
  })

  test('builder allowlist dry-run plan 没有真实 packaging config 细节时保守 blocked', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'optional-package-source',
      verification: {
        optionalPackageSourceChecked: true,
        optionalPackageSourceReady: true,
      },
      cases: [{
        name: 'optional-package-source',
        status: 'passed',
        detail: 'optionalPackageSourceReady=true',
      }],
    })

    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.packagingConfigAllowlistChangePlan.status).toBe('blocked')
    expect(summary.packagingConfigAllowlistChangePlan.missingIncludes.length).toBe(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.length,
    )
    expect(summary.packagingConfigAllowlistChangePlan.currentConfigVerified).toBe(false)
    expect(summary.packagingConfigAllowlistChangePlan.approvalRequired).toBe(true)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
  })

  test('builder allowlist dry-run plan ready_for_review 也不等于 packaged verified', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-manifest',
      verification: {
        packagingConfigVerified: true,
        missingPackagingConfigPackages: [],
        blockingPackagingConfigExcludes: [],
        tooBroadPackagingConfigIncludes: [],
      },
      cases: [{
        name: 'packaged-packaging-config-preflight',
        status: 'passed',
        detail: 'packagingConfigVerified=true',
      }],
    })

    expect(summary.packagingConfigAllowlistChangePlan.status).toBe('ready_for_review')
    expect(summary.packagingConfigAllowlistChangePlan.currentConfigVerified).toBe(true)
    expect(summary.packagingConfigAllowlistChangePlan.approvalRequired).toBe(true)
    expect(summary.packagingConfigAllowlistChangePlan.missingIncludes).toEqual([])
    expect(summary.packagingConfigAllowlistChangePlan.removalCandidates).toEqual([])
    expect(summary.packagingConfigAllowlistChangePlan.candidateYamlEditPlan).toEqual(expect.objectContaining({
      targetFile: 'apps/electron/electron-builder.yml',
      modifiesFile: false,
      addIncludes: [],
      removeRules: [],
    }))
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
  })

  test('packaged bundled binary smoke plan 仅在前置输入满足但尚未真实验证时进入 ready', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
      packagedAppNodeModulesResolution: createResolvedExplicitAppNodeModulesRoot(),
      verification: {
        packagedAppLayoutVerified: true,
        packagedAppEvidenceVerified: true,
        packagedAppIdentityVerified: true,
        optionalPackagePublicationChecked: true,
        optionalPackagesPublished: true,
        optionalDependenciesDeclared: true,
        optionalDependenciesInstallChainVerified: true,
        optionalDependenciesLockfileVerified: true,
        optionalDependenciesInstalledPackagesVerified: true,
        packagingConfigVerified: true,
        realPackagedBinaryVerified: false,
      },
      cases: [{
        name: 'packaged-app-layout',
        status: 'passed',
        detail: 'realPackagedBinaryVerified=false',
      }],
    })

    expect(summary.packagedBundledBinarySmokePlan.status).toBe('ready')
    expect(summary.packagedBundledBinarySmokePlan.blockedBy).toEqual([])
    expect(summary.packagedBundledBinarySmokeInvocationPlan.status).toBe('ready_for_execution')
    expect(summary.packagedBundledBinarySmokeInvocationPlan.appNodeModulesRootProvided).toBe(true)
    expect(summary.packagedBundledBinarySmokeInvocationPlan.appNodeModulesRootResolved).toBe(true)
    expect(summary.packagedBundledBinarySmokeInvocationPlan.blockedBy).toEqual([])
    expect(summary.packagedBundledBinarySmokeInvocationPlan.executionDesign).toEqual({
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
    })
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.nativeSearchReleaseHandoffPlan).toEqual(expect.objectContaining({
      status: 'blocked',
      nextGate: 'publish_target_preflight',
      defaultOffRequired: true,
      verified: false,
      readyForPublicationInvocation: false,
      readyForOptionalDependenciesHandoff: false,
      readyForPackagingConfigHandoff: false,
      readyForPackagedSmokeHandoff: false,
      readyForDefaultEnableRiskReview: false,
      blockedBy: [
        'optional_package_publish_target_not_ready',
        'optional_package_source_not_ready',
        'optional_package_publication_invocation_not_ready',
      ],
      candidateNextCommands: [],
    }))
    expect(summary.nativeSearchReleaseHandoffPlan.missingEvidence).toEqual([
      'optional_package_publish_target_registry_check',
      'optional_package_source_preflight',
      'optional_package_publication_registry_evidence',
      'optional_dependencies_declared_in_package_json',
      'optional_dependency_lockfile_resolved_entries',
      'optional_dependency_installed_package_manifests',
      'electron_builder_native_search_allowlist_verified',
      'real_packaged_app_bundled_binary_smoke',
      'default_enable_risk_review',
    ])
    expect(summary.nativeSearchReleaseHandoffPlan.doesNotVerify).toContain('packaged_binary_verified')
    expect(summary.nativeSearchReleaseHandoffPlan.doesNotVerify).toContain('default_enable_candidate')
  })

  test('packaged bundled binary smoke plan 只有真实 binary gate 通过才进入 verified', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
      packagedAppNodeModulesResolution: createResolvedExplicitAppNodeModulesRoot(),
      verification: {
        bundledBinaryVerified: true,
        packagedAppLayoutVerified: true,
        packagedAppEvidenceVerified: true,
        packagedAppIdentityVerified: true,
        optionalPackagePublicationChecked: true,
        optionalPackagesPublished: true,
        optionalDependenciesDeclared: true,
        optionalDependenciesInstallChainVerified: true,
        optionalDependenciesLockfileVerified: true,
        optionalDependenciesInstalledPackagesVerified: true,
        packagingConfigVerified: true,
        realPackagedBinaryVerified: true,
      },
      cases: [{
        name: 'packaged-app-layout',
        status: 'passed',
        detail: 'realPackagedBinaryVerified=true',
      }],
    })

    expect(summary.realPackagedBinaryVerified).toBe(true)
    expect(summary.bundledBinaryVerified).toBe(true)
    expect(summary.packagedBundledBinarySmokePlan.status).toBe('verified')
    expect(summary.packagedBundledBinarySmokePlan.blockedBy).toEqual([])
    expect(summary.packagedBundledBinarySmokeInvocationPlan.status).toBe('verified')
    expect(summary.packagedBundledBinarySmokeInvocationPlan.appNodeModulesRootResolved).toBe(true)
    expect(summary.packagedBundledBinarySmokeInvocationPlan.blockedBy).toEqual([])
    expect(summary.nativeSearchReleaseHandoffPlan).toEqual(expect.objectContaining({
      status: 'blocked',
      nextGate: 'publish_target_preflight',
      defaultOffRequired: true,
      verified: false,
      readyForPublicationInvocation: false,
      readyForOptionalDependenciesHandoff: false,
      readyForPackagingConfigHandoff: false,
      readyForPackagedSmokeHandoff: false,
      readyForDefaultEnableRiskReview: false,
      blockedBy: [
        'optional_package_publish_target_not_ready',
        'optional_package_source_not_ready',
        'optional_package_publication_invocation_not_ready',
      ],
      candidateNextCommands: [],
    }))
    expect(summary.nativeSearchReleaseHandoffPlan.missingEvidence).toEqual([
      'optional_package_publish_target_registry_check',
      'optional_package_source_preflight',
      'optional_package_publication_registry_evidence',
      'optional_dependencies_declared_in_package_json',
      'optional_dependency_lockfile_resolved_entries',
      'optional_dependency_installed_package_manifests',
      'electron_builder_native_search_allowlist_verified',
      'real_packaged_app_bundled_binary_smoke',
      'default_enable_risk_review',
    ])
    expect(summary.nativeSearchDefaultEnableReadiness.defaultEnableCandidate).toBe(false)
  })

  test('packaged bundled binary smoke plan verified 必须绑定 bundledBinaryVerified', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
      packagedAppNodeModulesResolution: createResolvedExplicitAppNodeModulesRoot(),
      verification: {
        bundledBinaryVerified: false,
        packagedAppLayoutVerified: true,
        packagedAppEvidenceVerified: true,
        packagedAppIdentityVerified: true,
        optionalPackagePublicationChecked: true,
        optionalPackagesPublished: true,
        optionalDependenciesDeclared: true,
        optionalDependenciesInstallChainVerified: true,
        optionalDependenciesLockfileVerified: true,
        optionalDependenciesInstalledPackagesVerified: true,
        packagingConfigVerified: true,
        realPackagedBinaryVerified: true,
      },
      cases: [{
        name: 'packaged-app-layout',
        status: 'passed',
        detail: 'realPackagedBinaryVerified=true; bundledBinaryVerified=false',
      }],
    })

    expect(summary.realPackagedBinaryVerified).toBe(true)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.packagedBundledBinarySmokePlan.status).not.toBe('verified')
    expect(summary.packagedBundledBinarySmokePlan.status).toBe('ready')
    expect(summary.packagedBundledBinarySmokeInvocationPlan.status).toBe('ready_for_execution')
  })

  test('packaged bundled binary smoke plan verified 仍必须没有其他 blocker', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      verification: {
        bundledBinaryVerified: true,
        packagedAppLayoutVerified: false,
        packagedAppEvidenceVerified: true,
        packagedAppIdentityVerified: true,
        optionalPackagePublicationChecked: true,
        optionalPackagesPublished: true,
        optionalDependenciesDeclared: true,
        optionalDependenciesInstallChainVerified: true,
        optionalDependenciesLockfileVerified: true,
        optionalDependenciesInstalledPackagesVerified: true,
        packagingConfigVerified: true,
        realPackagedBinaryVerified: true,
      },
      cases: [{
        name: 'packaged-app-layout',
        status: 'passed',
        detail: 'bundledBinaryVerified=true; appNodeModulesRootProvided=false',
      }],
    })

    expect(summary.bundledBinaryVerified).toBe(true)
    expect(summary.packagedBundledBinarySmokePlan.status).toBe('blocked')
    expect(summary.packagedBundledBinarySmokePlan.blockedBy).toEqual(['prebuilt_packaged_app_required'])
  })

  test('smoke exit code 在任意 case failed 时返回 1', () => {
    const passedSummary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      cases: [{
        name: 'packaged-app-layout',
        status: 'skipped',
        detail: 'requiresPrebuiltPackagedApp=true',
      }],
    })
    const failedSummary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      cases: [{
        name: 'packaged-app-layout',
        status: 'failed',
        detail: 'resolver=package_missing',
      }],
    })

    expect(getNativeRuntimeSmokeExitCode(passedSummary)).toBe(0)
    expect(getNativeRuntimeSmokeExitCode(failedSummary)).toBe(1)
  })

  test('packaging config 预检在 optional package opt-in 开始后必须失败而不是 skipped', () => {
    const result = {
      verified: false,
      expectedPackages: ['@codeinsights/native-search-darwin-arm64'],
      includedPackages: [],
      missingPackages: ['@codeinsights/native-search-darwin-arm64'],
      blockingExcludes: ['!node_modules/@codeinsights/**'],
      tooBroadIncludes: [],
    }

    expect(buildPackagedPackagingConfigPreflightCase(result, false)).toMatchObject({
      name: 'packaged-packaging-config-preflight',
      status: 'skipped',
    })
    expect(buildPackagedPackagingConfigPreflightCase(result, true)).toMatchObject({
      name: 'packaged-packaging-config-preflight',
      status: 'failed',
    })
  })

  test('CLI 在任意 case failed 时返回非零退出码', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-smoke-cli-'))
    const appNodeModulesRoot = join(rootDir, 'node_modules')
    mkdirSync(appNodeModulesRoot, { recursive: true })

    try {
      const result = Bun.spawnSync({
        cmd: [
          process.execPath,
          'run',
          'scripts/native-runtime-smoke.ts',
          '--mode',
          'packaged-app-layout',
          '--app-node-modules-root',
          appNodeModulesRoot,
        ],
        cwd: join(import.meta.dir, '..'),
        stdout: 'pipe',
        stderr: 'pipe',
      })

      expect(result.exitCode).toBe(1)
      expect(result.stdout.toString()).toContain('"status": "failed"')
      expect(result.stdout.toString()).toContain('"realPackagedBinaryVerified": false')
      expect(result.stderr.toString()).toBe('')
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
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
      expect(summary.optionalDependenciesDeclared).toBe(false)
      expect(summary.optionalPackagesPublished).toBe(false)
      expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
      expect(summary.missingOptionalDependencies.length).toBeGreaterThan(0)
      expect(summary.realPackagedBinaryVerified).toBe(false)
      expect(summary.usesTemporaryFixture).toBe(true)
      expect(summary.cases).toContainEqual(expect.objectContaining({
        name: 'packaged-app-layout',
        status: 'passed',
      }))
      expect(JSON.stringify(summary)).toContain('packagedAppEvidence=unpacked-app')
      expect(JSON.stringify(summary)).toContain('packagedAppIdentityVerified=true')
      expect(JSON.stringify(summary)).toContain('optionalDependenciesDeclared=false')
      expect(JSON.stringify(summary)).toContain('optionalPackagesPublished=false')
      expect(JSON.stringify(summary)).toContain('optionalDependenciesInstallChainVerified=false')
      expect(JSON.stringify(summary)).toContain('realPackagedBinaryVerified=false')
      expect(JSON.stringify(summary)).not.toContain(fixture.rootDir)
      expect(JSON.stringify(summary)).not.toContain('binaryPath')
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app layout smoke 支持 packaged app root 并推导 node_modules', async () => {
    const fixture = createPackagedAppLayoutFixture('unpacked-app')
    try {
      const summary = await runNativeRuntimeSmoke({
        mode: 'packaged-app-layout',
        query: '关键字',
        packagedAppRoot: fixture.appRoot,
      })

      expect(summary.mode).toBe('packaged-app-layout')
      expect(summary.packagedAppRootProvided).toBe(true)
      expect(summary.appNodeModulesRootProvided).toBe(false)
      expect(summary.packagedAppNodeModulesRootDerived).toBe(true)
      expect(summary.packagedAppRootResolutionEvidence).toBe('macos_app_resources_app')
      expect(summary.packagedAppLayoutVerified).toBe(true)
      expect(summary.packagedAppEvidenceVerified).toBe(true)
      expect(summary.packagedAppIdentityVerified).toBe(true)
      expect(summary.usesTemporaryFixture).toBe(true)
      expect(summary.realPackagedBinaryVerified).toBe(false)
      expect(summary.bundledBinaryVerified).toBe(false)
      expect(summary.cases).toContainEqual(expect.objectContaining({
        name: 'packaged-app-root-resolution',
        status: 'passed',
      }))
      expect(summary.cases).toContainEqual(expect.objectContaining({
        name: 'packaged-app-layout',
        status: 'passed',
      }))
      expect(summary.packagedBundledBinarySmokePlan.blockedBy).toEqual([
        'optional_packages_not_published',
        'optional_dependencies_not_declared',
        'optional_package_install_chain_not_verified',
        'packaging_config_not_verified',
        'temporary_fixture_not_allowed',
      ])
      expect(summary.packagedBundledBinarySmokeInvocationPlan).toMatchObject({
        status: 'blocked',
        inputMode: 'packaged_app_root',
        packagedAppRootProvided: true,
        appNodeModulesRootProvided: false,
        appNodeModulesRootResolved: true,
        resolutionEvidence: 'macos_app_resources_app',
        candidateCommand: "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --packaged-app-root <packaged-app-root> --check-registry",
      })
      expect(summary.packagedBundledBinarySmokeInvocationPlan.blockedBy).toEqual([
        'optional_packages_not_published',
        'optional_dependencies_not_declared',
        'optional_package_install_chain_not_verified',
        'packaging_config_not_verified',
        'temporary_fixture_not_allowed',
      ])
      expect(JSON.stringify(summary)).toContain('packagedAppRootResolutionEvidence=macos_app_resources_app')
      expect(JSON.stringify(summary)).not.toContain(fixture.rootDir)
      expect(JSON.stringify(summary)).not.toContain(fixture.nodeModulesRoot)
      expect(JSON.stringify(summary)).not.toContain('CodeInsights.app')
      expect(JSON.stringify(summary)).not.toContain('Resources/app')
      expect(JSON.stringify(summary)).not.toContain('binaryPath')
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app layout smoke 遇到无法解析的 packaged app root 时失败且不泄露路径', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-packaged-root-invalid-'))
    try {
      const summary = await runNativeRuntimeSmoke({
        mode: 'packaged-app-layout',
        query: '关键字',
        packagedAppRoot: rootDir,
      })

      expect(summary.packagedAppRootProvided).toBe(true)
      expect(summary.appNodeModulesRootProvided).toBe(false)
      expect(summary.packagedAppNodeModulesRootDerived).toBe(false)
      expect(summary.packagedAppRootResolutionEvidence).toBe('none')
      expect(summary.packagedAppLayoutVerified).toBe(false)
      expect(summary.realPackagedBinaryVerified).toBe(false)
      expect(summary.bundledBinaryVerified).toBe(false)
      expect(summary.cases).toContainEqual(expect.objectContaining({
        name: 'packaged-app-root-resolution',
        status: 'failed',
      }))
      expect(summary.cases).toContainEqual(expect.objectContaining({
        name: 'packaged-app-layout',
        status: 'skipped',
      }))
      expect(summary.packagedBundledBinarySmokeInvocationPlan).toMatchObject({
        status: 'blocked',
        inputMode: 'packaged_app_root',
        packagedAppRootProvided: true,
        appNodeModulesRootResolved: false,
        resolutionEvidence: 'none',
      })
      expect(summary.packagedBundledBinarySmokeInvocationPlan.blockedBy).toContain('packaged_app_root_unresolved')
      expect(getNativeRuntimeSmokeExitCode(summary)).toBe(1)
      expect(JSON.stringify(summary)).toContain('reason=packaged_app_root_unrecognized')
      expect(JSON.stringify(summary)).not.toContain(rootDir)
      expect(JSON.stringify(summary)).not.toContain('binaryPath')
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app layout smoke 不把缺失的旧 node_modules 参数标成 resolved', async () => {
    const missingRoot = join(tmpdir(), 'codeinsights-native-missing-node-modules')
    const summary = await runNativeRuntimeSmoke({
      mode: 'packaged-app-layout',
      query: '关键字',
      appNodeModulesRoot: missingRoot,
    })

    expect(summary.packagedAppRootProvided).toBe(false)
    expect(summary.appNodeModulesRootProvided).toBe(true)
    expect(summary.packagedAppNodeModulesRootDerived).toBe(false)
    expect(summary.packagedAppRootResolutionEvidence).toBe('explicit_app_node_modules_root')
    expect(summary.packagedAppLayoutVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.packagedBundledBinarySmokeInvocationPlan).toMatchObject({
      status: 'blocked',
      inputMode: 'app_node_modules_root',
      appNodeModulesRootProvided: true,
      appNodeModulesRootResolved: false,
      resolutionEvidence: 'explicit_app_node_modules_root',
    })
    expect(summary.packagedBundledBinarySmokeInvocationPlan.blockedBy).toContain('app_node_modules_root_unresolved')
    expect(JSON.stringify(summary)).not.toContain(missingRoot)
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
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
      name: 'packaged-optional-dependencies-preflight',
      status: 'skipped',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'packaged-optional-dependencies-install-chain-preflight',
      status: 'skipped',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'packaged-optional-package-publication-preflight',
      status: 'skipped',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'packaged-packaging-config-preflight',
      status: 'skipped',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('bundledBinaryVerified=false')
    expect(JSON.stringify(summary)).toContain('fixtureBundledPackageVerified=true')
    expect(JSON.stringify(summary)).toContain('optionalPackagePublicationChecked=false')
    expect(JSON.stringify(summary)).toContain('optionalPackagesPublished=false')
    expect(JSON.stringify(summary)).toContain('optionalDependenciesDeclared=false')
    expect(JSON.stringify(summary)).toContain('optionalDependenciesInstallChainVerified=false')
    expect(JSON.stringify(summary)).toContain('packagingConfigVerified=false')
    expect(JSON.stringify(summary)).toContain('realPackagedBinaryVerified=false')
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.fixtureBundledPackageVerified).toBe(true)
    expect(summary.usesTemporaryFixture).toBe(true)
    expect(summary.optionalPackagePublicationChecked).toBe(false)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.missingPublishedOptionalPackages).toEqual([])
    expect(summary.invalidPublishedOptionalPackages).toEqual([])
    expect(summary.existingInvalidPublishedOptionalPackages).toEqual([])
    expect(summary.unavailablePublishedOptionalPackages).toEqual([])
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.optionalDependenciesLockfileVerified).toBe(false)
    expect(summary.optionalDependenciesInstalledPackagesVerified).toBe(false)
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.missingOptionalDependencies.length).toBeGreaterThan(0)
    expect(summary.invalidOptionalDependencies).toEqual([])
    expect(summary.missingOptionalDependencyLockfilePackages.length).toBeGreaterThan(0)
    expect(summary.missingInstalledOptionalDependencies.length).toBeGreaterThan(0)
    expect(summary.invalidInstalledOptionalDependencies).toEqual([])
    expect(summary.missingPackagingConfigPackages.length).toBeGreaterThan(0)
    expect(summary.blockingPackagingConfigExcludes).toEqual(['!node_modules/@codeinsights/**'])
    expect(summary.packagedAppLayoutVerified).toBe(false)
    expect(summary.packagedAppEvidenceVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(JSON.stringify(summary)).not.toContain('/Users/')
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
    expect(JSON.stringify(summary)).not.toContain('/codeinsights-native-runtime-smoke-')
    expect(summary.nativeSearchDefaultEnableReadiness).toMatchObject({
      evaluated: true,
      defaultEnableCandidate: false,
      explicitOptInRequired: true,
      gates: {
        benchmarkEvaluated: false,
        benchmarkGatePassed: false,
        agentFacadeNativeExtractorDeclared: false,
        agentFacadeNativeParityEvaluated: false,
        optionalPackagesPublished: false,
        optionalDependenciesDeclared: false,
        optionalDependenciesInstallChainVerified: false,
        packagingConfigVerified: false,
        packagedAppEvidenceVerified: false,
        packagedAppIdentityVerified: false,
        realPackagedBinaryVerified: false,
        riskReviewCompleted: false,
      },
    })
  })

  test('packaged manifest 显式 registry 检查会把未发布 optional packages 标记为 failed gate', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch

    const summary = await runNativeRuntimeSmoke({
      mode: 'packaged-manifest',
      query: '关键字',
      checkRegistry: true,
    })

    expect(summary.optionalPackagePublicationChecked).toBe(true)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.missingPublishedOptionalPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.optionalPackagePublicationChangePlan).toEqual(expect.objectContaining({
      status: 'blocked',
      packageVersion: '0.0.3',
      publishTargetReady: false,
      packageSourceReady: false,
      optionalPackagesPublished: false,
      missingPublishedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      blockedBy: [
        'optional_package_publish_target_not_ready',
        'optional_package_source_not_ready',
        'optional_packages_not_published',
      ],
    }))
    expect(summary.optionalPackagePublicationChangePlan.plannedPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => ({
        packageName: plan.packageName,
        packageVersion: '0.0.3',
      })),
    )
    expect(summary.invalidPublishedOptionalPackages).toEqual([])
    expect(summary.unavailablePublishedOptionalPackages).toEqual([])
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'packaged-optional-package-publication-preflight',
      status: 'failed',
    }))
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(1)
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toContain('optional_packages_not_published')
    expect(JSON.stringify(summary)).not.toContain('registry.npmjs.org')
    expect(JSON.stringify(summary)).not.toContain('/Users/')
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
  })

  test('packaged manifest registry 检查必须绑定 install-chain plan 目标版本', async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      const plan = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.find((candidate) => (
        url.includes(encodeURIComponent(candidate.packageName))
      ))
      if (!plan) return new Response('{}', { status: 404 })

      return Response.json({
        name: plan.packageName,
        'dist-tags': {
          latest: '0.0.4',
        },
        versions: {
          '0.0.4': {
            name: plan.packageName,
            version: '0.0.4',
            os: [plan.platform],
            cpu: [plan.arch],
            bin: {
              'codeinsights-native-search': `bin/${plan.binaryName}`,
            },
          },
        },
      })
    }) as unknown as typeof fetch

    const summary = await runNativeRuntimeSmoke({
      mode: 'packaged-manifest',
      query: '关键字',
      checkRegistry: true,
    })

    expect(summary.optionalDependenciesInstallChainChangePlan.packageVersion).toBe('0.0.3')
    expect(summary.optionalPackagePublicationChecked).toBe(true)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.missingPublishedOptionalPackages).toEqual([])
    expect(summary.invalidPublishedOptionalPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.existingInvalidPublishedOptionalPackages).toEqual([])
    expect(summary.optionalDependenciesInstallChainChangePlan.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesInstallChainChangePlan.blockedBy).toContain('optional_packages_not_published')
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(1)
  })

  test('packaged manifest registry 检查保留 partial publication 证据', async () => {
    const [publishedPlan, ...missingPlans] = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS
    if (!publishedPlan) throw new Error('native search optional package plan should exist')
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      if (!url.includes(encodeURIComponent(publishedPlan.packageName))) {
        return new Response('{}', { status: 404 })
      }

      return Response.json({
        name: publishedPlan.packageName,
        versions: {
          '0.0.3': {
            name: publishedPlan.packageName,
            version: '0.0.3',
            os: [publishedPlan.platform],
            cpu: [publishedPlan.arch],
            bin: {
              'codeinsights-native-search': `bin/${publishedPlan.binaryName}`,
            },
          },
        },
      })
    }) as unknown as typeof fetch

    const summary = await runNativeRuntimeSmoke({
      mode: 'packaged-manifest',
      query: '关键字',
      checkRegistry: true,
    })

    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.publishedOptionalPackages).toEqual([publishedPlan.packageName])
    expect(summary.missingPublishedOptionalPackages).toEqual(
      missingPlans.map((plan) => plan.packageName),
    )
    expect(summary.optionalPackagePublicationChangePlan.publishedPackages).toEqual([publishedPlan.packageName])
    expect(summary.optionalPackagePublicationChangePlan.blockedBy).toContain('optional_package_publication_partial')
    expect(summary.optionalPackagePublicationChangePlan.candidatePublicationCommands).not.toContain(
      `npm publish <native-search-package-source:${publishedPlan.packageName}> --access public`,
    )
    expect(summary.optionalPackagePublicationChangePlan.candidatePublicationCommands).toEqual(
      missingPlans.map((plan) => (
        `npm publish <native-search-package-source:${plan.packageName}> --access public`
      )),
    )
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(1)
    expect(JSON.stringify(summary)).not.toContain('registry.npmjs.org')
    expect(JSON.stringify(summary)).not.toContain('/Users/')
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
  })

  test('optional package publish-target 默认离线必须保持 not ready', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'optional-package-publish-target',
      query: '关键字',
      nativeSearchPackageVersion: '0.0.3',
    })

    expect(summary.optionalPackagePublishTargetChecked).toBe(false)
    expect(summary.optionalPackagePublishTargetReady).toBe(false)
    expect(summary.optionalPackagePublishTargetVersion).toBe('0.0.3')
    expect(summary.optionalPackagePublishTargetBlockers).toContain('registry_check_required')
    expect(summary.optionalPackagePublicationChangePlan.status).toBe('blocked')
    expect(summary.optionalPackagePublicationChangePlan.packageVersion).toBe('0.0.3')
    expect(summary.optionalPackagePublicationChangePlan.publishTargetReady).toBe(false)
    expect(summary.optionalPackagePublicationChangePlan.packageSourceReady).toBe(true)
    expect(summary.optionalPackagePublicationChangePlan.optionalPackagesPublished).toBe(false)
    expect(summary.optionalPackagePublicationChangePlan.blockedBy).toEqual([
      'optional_package_publish_target_not_ready',
      'optional_packages_not_published',
    ])
    expect(summary.optionalPackagePublicationInvocationPlan.status).toBe('blocked')
    expect(summary.optionalPackagePublicationInvocationPlan.approvalRequired).toBe(false)
    expect(summary.optionalPackagePublicationInvocationPlan.readyPackages).toEqual([])
    expect(summary.optionalPackagePublicationInvocationPlan.blockedBy).toEqual([
      'optional_package_publication_plan_not_ready',
      'optional_package_publish_target_not_ready',
    ])
    expect(summary.optionalPackagePublicationInvocationPlan.candidatePublicationCommands).toEqual([])
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'optional-package-publish-target',
      status: 'skipped',
    }))
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(0)
  })

  test('optional package source preflight 只验证本地计划 source，不证明 package 已发布', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'optional-package-source',
      query: '关键字',
      nativeSearchPackageVersion: '0.0.3',
    })

    expect(summary.optionalPackageSourceChecked).toBe(true)
    expect(summary.optionalPackageSourceReady).toBe(true)
    expect(summary.optionalPackageSourceVersion).toBe('0.0.3')
    expect(summary.optionalPackageSourceReadyPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.optionalPackageSourceBlockers).toEqual([])
    expect(summary.missingOptionalPackageSourcePackages).toEqual([])
    expect(summary.invalidOptionalPackageSourcePackages).toEqual([])
    expect(summary.plannedOptionalPackageSourceManifestsVerified).toBe(true)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'optional-package-source',
      status: 'passed',
    }))
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(0)
    expect(summary.optionalPackagePublicationChecked).toBe(false)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.packagedBundledBinarySmokePlan.status).toBe('blocked')
    expect(JSON.stringify(summary)).not.toContain('registry.npmjs.org')
    expect(JSON.stringify(summary)).not.toContain('/Users/')
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
  })

  test('optional package source preflight 缺少版本时 failed', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'optional-package-source',
      query: '关键字',
    })

    expect(summary.optionalPackageSourceChecked).toBe(true)
    expect(summary.optionalPackageSourceReady).toBe(false)
    expect(summary.optionalPackageSourceVersion).toBe(null)
    expect(summary.optionalPackageSourceBlockers).toContain('package_source_version_required')
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'optional-package-source',
      status: 'failed',
    }))
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(1)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
  })

  test('optional package publish-target 显式 registry 下 404 且 release source version 时 ready', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch

    const summary = await runNativeRuntimeSmoke({
      mode: 'optional-package-publish-target',
      query: '关键字',
      nativeSearchPackageVersion: '0.0.3',
      checkRegistry: true,
    })

    expect(summary.optionalPackagePublishTargetChecked).toBe(true)
    expect(summary.optionalPackagePublishTargetReady).toBe(true)
    expect(summary.optionalPackagePublishTargetVersion).toBe('0.0.3')
    expect(summary.publishTargetAvailablePackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.publishedVersionCollisionPackages).toEqual([])
    expect(summary.invalidPublishTargetPackages).toEqual([])
    expect(summary.unavailablePublishTargetPackages).toEqual([])
    expect(summary.nativeSearchCargoVersion).toBe('0.0.3')
    expect(summary.nativeSearchBinaryVersion).toBe('0.0.3')
    expect(summary.nativeSearchVersionConsistencyVerified).toBe(true)
    expect(summary.optionalPackagePublishTargetBlockers).toEqual([])
    expect(summary.optionalPackagePublicationChangePlan.status).toBe('ready_for_review')
    expect(summary.optionalPackagePublicationChangePlan.packageVersion).toBe('0.0.3')
    expect(summary.optionalPackagePublicationChangePlan.publishTargetReady).toBe(true)
    expect(summary.optionalPackagePublicationChangePlan.packageSourceReady).toBe(true)
    expect(summary.optionalPackagePublicationChangePlan.optionalPackagesPublished).toBe(false)
    expect(summary.optionalPackagePublicationChangePlan.blockedBy).toEqual([])
    expect(summary.optionalPackagePublicationChangePlan.candidatePreflightCommands).toEqual([
      "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version 0.0.3 --check-registry",
      "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-source --native-search-package-version 0.0.3",
      "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest --check-registry",
    ])
    expect(summary.optionalPackagePublicationInvocationPlan.status).toBe('ready_for_invocation')
    expect(summary.optionalPackagePublicationInvocationPlan.packageVersion).toBe('0.0.3')
    expect(summary.optionalPackagePublicationInvocationPlan.approvalRequired).toBe(true)
    expect(summary.optionalPackagePublicationInvocationPlan.readyPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.optionalPackagePublicationInvocationPlan.publishedPackages).toEqual([])
    expect(summary.optionalPackagePublicationInvocationPlan.blockedBy).toEqual([])
    expect(summary.optionalPackagePublicationInvocationPlan.candidatePublicationCommands).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => (
        `npm publish <native-search-package-source:${plan.packageName}> --access public`
      )),
    )
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'optional-package-publish-target',
      status: 'passed',
    }))
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(0)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.optionalDependenciesDeclared).toBe(false)
    expect(summary.optionalDependenciesInstallChainVerified).toBe(false)
    expect(summary.packagingConfigVerified).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.packagedBundledBinarySmokePlan.status).toBe('blocked')
    expect(JSON.stringify(summary)).not.toContain('registry.npmjs.org')
    expect(JSON.stringify(summary)).not.toContain('/Users/')
  })

  test('optional package publish-target 目标版本已存在时 failed', async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      const plan = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.find((candidate) => (
        url.includes(encodeURIComponent(candidate.packageName))
      ))
      if (!plan) return new Response('{}', { status: 404 })
      return Response.json({
        name: plan.packageName,
        versions: {
          '0.0.3': {
            name: plan.packageName,
            version: '0.0.3',
            os: [plan.platform],
            cpu: [plan.arch],
            bin: {
              'codeinsights-native-search': `bin/${plan.binaryName}`,
            },
          },
        },
      })
    }) as unknown as typeof fetch

    const summary = await runNativeRuntimeSmoke({
      mode: 'optional-package-publish-target',
      query: '关键字',
      nativeSearchPackageVersion: '0.0.3',
      checkRegistry: true,
    })

    expect(summary.publishedVersionCollisionPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.optionalPackagePublishTargetBlockers).toContain('publish_target_version_already_exists')
    expect(summary.optionalPackagePublishTargetReady).toBe(false)
    expect(summary.optionalPackagePublicationChangePlan.publishedPackages).toEqual([])
    expect(summary.optionalPackagePublicationChangePlan.publishTargetCollisionPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.optionalPackagePublicationChangePlan.commandExcludedPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.optionalPackagePublicationChangePlan.candidatePublicationCommands).toEqual([])
    expect(summary.optionalPackagePublicationInvocationPlan.status).toBe('blocked')
    expect(summary.optionalPackagePublicationInvocationPlan.readyPackages).toEqual([])
    expect(summary.optionalPackagePublicationInvocationPlan.excludedPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.optionalPackagePublicationInvocationPlan.blockedBy).toEqual([
      'optional_package_publication_plan_not_ready',
      'optional_package_publish_target_not_ready',
      'optional_package_invocation_commands_unavailable',
    ])
    expect(summary.optionalPackagePublicationInvocationPlan.candidatePublicationCommands).toEqual([])
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(1)
  })

  test('packaged app layout 显式 registry 检查会把未发布 optional packages 标记为 failed gate', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch
    const fixture = createPackagedAppLayoutFixture('unpacked-app')

    try {
      const summary = await runNativeRuntimeSmoke({
        mode: 'packaged-app-layout',
        query: '关键字',
        appNodeModulesRoot: fixture.nodeModulesRoot,
        checkRegistry: true,
      })

      expect(summary.optionalPackagePublicationChecked).toBe(true)
      expect(summary.optionalPackagesPublished).toBe(false)
      expect(summary.missingPublishedOptionalPackages).toEqual(
        NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      )
      expect(summary.realPackagedBinaryVerified).toBe(false)
      expect(summary.cases).toContainEqual(expect.objectContaining({
        name: 'packaged-optional-package-publication-preflight',
        status: 'failed',
      }))
      expect(getNativeRuntimeSmokeExitCode(summary)).toBe(1)
      expect(JSON.stringify(summary)).not.toContain(fixture.rootDir)
      expect(JSON.stringify(summary)).not.toContain('registry.npmjs.org')
      expect(JSON.stringify(summary)).not.toContain('binaryPath')
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })

  test('packaged app layout registry 检查必须绑定 install-chain plan 目标版本', async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      const plan = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.find((candidate) => (
        url.includes(encodeURIComponent(candidate.packageName))
      ))
      if (!plan) return new Response('{}', { status: 404 })

      return Response.json({
        name: plan.packageName,
        'dist-tags': {
          latest: '0.0.4',
        },
        versions: {
          '0.0.4': {
            name: plan.packageName,
            version: '0.0.4',
            os: [plan.platform],
            cpu: [plan.arch],
            bin: {
              'codeinsights-native-search': `bin/${plan.binaryName}`,
            },
          },
        },
      })
    }) as unknown as typeof fetch
    const fixture = createPackagedAppLayoutFixture('unpacked-app')

    try {
      const summary = await runNativeRuntimeSmoke({
        mode: 'packaged-app-layout',
        query: '关键字',
        appNodeModulesRoot: fixture.nodeModulesRoot,
        checkRegistry: true,
      })

      expect(summary.optionalDependenciesInstallChainChangePlan.packageVersion).toBe('0.0.3')
      expect(summary.optionalPackagePublicationChecked).toBe(true)
      expect(summary.optionalPackagesPublished).toBe(false)
      expect(summary.missingPublishedOptionalPackages).toEqual([])
      expect(summary.invalidPublishedOptionalPackages).toEqual(
        NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      )
      expect(summary.existingInvalidPublishedOptionalPackages).toEqual([])
      expect(summary.optionalDependenciesInstallChainChangePlan.optionalPackagesPublished).toBe(false)
      expect(summary.optionalDependenciesInstallChainChangePlan.blockedBy).toContain('optional_packages_not_published')
      expect(summary.realPackagedBinaryVerified).toBe(false)
      expect(summary.bundledBinaryVerified).toBe(false)
      expect(getNativeRuntimeSmokeExitCode(summary)).toBe(1)
      expect(JSON.stringify(summary)).not.toContain(fixture.rootDir)
      expect(JSON.stringify(summary)).not.toContain('registry.npmjs.org')
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true })
    }
  })
})

function createPackagedAppLayoutFixture(
  layout: 'asar-unpacked' | 'macos-asar-unpacked' | 'unpacked-app',
  options: {
    appPackagePatch?: Record<string, unknown>
  } = {},
): {
  rootDir: string
  appRoot: string
  resourcesAppRoot: string
  nodeModulesRoot: string
} {
  const plan = getNativeSearchOptionalPackagePlan()
  if (!plan) throw new Error('当前平台缺少 native search optional package plan')

  const rootDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-packaged-layout-test-'))
  const macosAppRoot = join(rootDir, 'CodeInsights.app')
  const resourcesRoot = join(macosAppRoot, 'Contents', 'Resources')
  const resourcesAppRoot = join(resourcesRoot, 'app')
  const asarUnpackedRoot = layout === 'asar-unpacked'
    ? join(rootDir, 'app.asar.unpacked')
    : join(resourcesRoot, 'app.asar.unpacked')
  const packageRootForLayout = layout === 'unpacked-app' ? resourcesAppRoot : asarUnpackedRoot
  const nodeModulesRoot = join(packageRootForLayout, 'node_modules')
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
  } else if (layout === 'macos-asar-unpacked') {
    mkdirSync(resourcesRoot, { recursive: true })
    writeFileSync(join(resourcesRoot, 'app.asar'), 'asar placeholder\n', 'utf-8')
  } else {
    writeFileSync(join(resourcesAppRoot, 'package.json'), `${JSON.stringify({
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

  return {
    rootDir,
    appRoot: macosAppRoot,
    resourcesAppRoot,
    nodeModulesRoot,
  }
}

function createResolvedExplicitAppNodeModulesRoot(): {
  resolved: true
  source: 'explicit_app_node_modules_root'
  evidence: 'explicit_app_node_modules_root'
  appNodeModulesRoot: string
} {
  return {
    resolved: true,
    source: 'explicit_app_node_modules_root',
    evidence: 'explicit_app_node_modules_root',
    appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
  }
}
