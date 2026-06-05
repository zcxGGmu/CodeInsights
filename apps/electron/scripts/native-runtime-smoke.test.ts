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

  test('summary 输出 publish-target dry-run 字段且不改变真实 packaged gate', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'optional-package-publish-target',
      verification: {
        optionalPackagePublishTargetChecked: true,
        optionalPackagePublishTargetReady: false,
        optionalPackagePublishTargetVersion: '0.0.3',
        optionalPackagePublishTargetBlockers: ['native_search_binary_version_not_release_ready'],
        publishTargetAvailablePackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
        publishedVersionCollisionPackages: [],
        invalidPublishTargetPackages: [],
        unavailablePublishTargetPackages: [],
        nativeSearchVersionConsistencyVerified: false,
        nativeSearchCargoVersion: '0.0.3',
        nativeSearchBinaryVersion: '0.0.3-dev',
        plannedOptionalPackageManifestsVerified: true,
      },
      cases: [{
        name: 'optional-package-publish-target',
        status: 'failed',
        detail: 'native_search_binary_version_not_release_ready',
      }],
    })

    expect(summary.optionalPackagePublishTargetChecked).toBe(true)
    expect(summary.optionalPackagePublishTargetReady).toBe(false)
    expect(summary.optionalPackagePublishTargetVersion).toBe('0.0.3')
    expect(summary.optionalPackagePublishTargetBlockers).toEqual(['native_search_binary_version_not_release_ready'])
    expect(summary.publishTargetAvailablePackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.nativeSearchVersionConsistencyVerified).toBe(false)
    expect(summary.nativeSearchCargoVersion).toBe('0.0.3')
    expect(summary.nativeSearchBinaryVersion).toBe('0.0.3-dev')
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

  test('summary builder 不允许临时 fixture 证明真实 packaged binary', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
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
      candidateCommand: "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --app-node-modules-root <packaged-app-node_modules> --check-registry",
    })
    expect(JSON.stringify(summary.packagedBundledBinarySmokePlan)).not.toContain('/Users/')
    expect(JSON.stringify(summary.packagedBundledBinarySmokePlan)).not.toContain('binaryPath')
  })

  test('packaged bundled binary smoke plan 仅在前置输入满足但尚未真实验证时进入 ready', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
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
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
  })

  test('packaged bundled binary smoke plan 只有真实 binary gate 通过才进入 verified', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
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
  })

  test('packaged bundled binary smoke plan verified 必须绑定 bundledBinaryVerified', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'packaged-app-layout',
      appNodeModulesRoot: '/Applications/CodeInsights.app/Contents/Resources/app/node_modules',
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
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
    expect(summary.bundledBinaryVerified).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'optional-package-publish-target',
      status: 'skipped',
    }))
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(0)
  })

  test('optional package publish-target 显式 registry 下 404 可发布但 dev binary 仍 no-go', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch

    const summary = await runNativeRuntimeSmoke({
      mode: 'optional-package-publish-target',
      query: '关键字',
      nativeSearchPackageVersion: '0.0.3',
      checkRegistry: true,
    })

    expect(summary.optionalPackagePublishTargetChecked).toBe(true)
    expect(summary.optionalPackagePublishTargetReady).toBe(false)
    expect(summary.optionalPackagePublishTargetVersion).toBe('0.0.3')
    expect(summary.publishTargetAvailablePackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(summary.publishedVersionCollisionPackages).toEqual([])
    expect(summary.invalidPublishTargetPackages).toEqual([])
    expect(summary.unavailablePublishTargetPackages).toEqual([])
    expect(summary.nativeSearchCargoVersion).toBe('0.0.3')
    expect(summary.nativeSearchBinaryVersion).toBe('0.0.3-dev')
    expect(summary.optionalPackagePublishTargetBlockers).toEqual(['native_search_binary_version_not_release_ready'])
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'optional-package-publish-target',
      status: 'failed',
    }))
    expect(getNativeRuntimeSmokeExitCode(summary)).toBe(1)
    expect(summary.optionalPackagesPublished).toBe(false)
    expect(summary.realPackagedBinaryVerified).toBe(false)
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
})

function createPackagedAppLayoutFixture(
  layout: 'asar-unpacked' | 'unpacked-app',
  options: {
    appPackagePatch?: Record<string, unknown>
  } = {},
): {
  rootDir: string
  nodeModulesRoot: string
} {
  const plan = getNativeSearchOptionalPackagePlan()
  if (!plan) throw new Error('当前平台缺少 native search optional package plan')

  const rootDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-packaged-layout-test-'))
  const appRoot = layout === 'asar-unpacked'
    ? join(rootDir, 'app.asar.unpacked')
    : join(rootDir, 'CodeInsights.app', 'Contents', 'Resources', 'app')
  const nodeModulesRoot = join(appRoot, 'node_modules')
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
  } else {
    writeFileSync(join(appRoot, 'package.json'), `${JSON.stringify({
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

  return { rootDir, nodeModulesRoot }
}
