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
  getNativeSearchOptionalPackagePlan,
  isNativeSearchPackageManifest,
  NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS,
  validateNativeSearchPackagingConfig,
  validateNativeSearchOptionalPackageInstallChain,
  type NativeSearchPackagingConfigValidationResult,
  type NativeSearchOptionalPackageInstallChainValidationResult,
  type NativeSearchOptionalDependenciesValidationResult,
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

export interface NativeRuntimeSmokeOptions {
  mode: NativeRuntimeSmokeMode
  nativeSearchBinary?: string
  appNodeModulesRoot?: string
  query: string
  env?: NodeJS.ProcessEnv
}

export interface NativeRuntimeSmokeCase {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  detail?: string
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
  optionalDependenciesInstallChainVerified: boolean
  optionalDependenciesLockfileVerified: boolean
  optionalDependenciesInstalledPackagesVerified: boolean
  packagingConfigVerified: boolean
  missingOptionalDependencies: string[]
  invalidOptionalDependencies: string[]
  missingOptionalDependencyLockfilePackages: string[]
  missingInstalledOptionalDependencies: string[]
  invalidInstalledOptionalDependencies: string[]
  missingPackagingConfigPackages: string[]
  blockingPackagingConfigExcludes: string[]
  tooBroadPackagingConfigIncludes: string[]
  realPackagedBinaryVerified: boolean
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
  optionalDependenciesInstallChainVerified?: boolean
  optionalDependenciesLockfileVerified?: boolean
  optionalDependenciesInstalledPackagesVerified?: boolean
  packagingConfigVerified?: boolean
  missingOptionalDependencies?: string[]
  invalidOptionalDependencies?: string[]
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
  const optionalDependenciesInstallChainVerified = optionalDependenciesDeclared
    && Boolean(verification.optionalDependenciesInstallChainVerified)
  const packagingConfigVerified = Boolean(verification.packagingConfigVerified)
  const packagedAppEvidenceVerified = Boolean(verification.packagedAppEvidenceVerified)
  const packagedAppIdentityVerified = Boolean(verification.packagedAppIdentityVerified)
  const realPackagedBinaryVerified = optionalDependenciesInstallChainVerified
    && packagingConfigVerified
    && packagedAppEvidenceVerified
    && packagedAppIdentityVerified
    && Boolean(verification.realPackagedBinaryVerified)
  const bundledBinaryVerified = realPackagedBinaryVerified
    && Boolean(verification.bundledBinaryVerified)
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    nativeSearchBinaryProvided: Boolean(input.nativeSearchBinary),
    appNodeModulesRootProvided: Boolean(input.appNodeModulesRoot),
    bundledBinaryVerified,
    fixtureBundledPackageVerified: Boolean(verification.fixtureBundledPackageVerified),
    usesTemporaryFixture: Boolean(verification.usesTemporaryFixture),
    packagedAppLayoutVerified: Boolean(verification.packagedAppLayoutVerified),
    packagedAppEvidenceVerified,
    packagedAppIdentityVerified,
    optionalDependenciesDeclared,
    optionalDependenciesInstallChainVerified,
    optionalDependenciesLockfileVerified: optionalDependenciesDeclared
      && Boolean(verification.optionalDependenciesLockfileVerified),
    optionalDependenciesInstalledPackagesVerified: optionalDependenciesDeclared
      && Boolean(verification.optionalDependenciesInstalledPackagesVerified),
    packagingConfigVerified,
    missingOptionalDependencies: verification.missingOptionalDependencies ?? [],
    invalidOptionalDependencies: verification.invalidOptionalDependencies ?? [],
    missingOptionalDependencyLockfilePackages: verification.missingOptionalDependencyLockfilePackages ?? [],
    missingInstalledOptionalDependencies: verification.missingInstalledOptionalDependencies ?? [],
    invalidInstalledOptionalDependencies: verification.invalidInstalledOptionalDependencies ?? [],
    missingPackagingConfigPackages: verification.missingPackagingConfigPackages ?? [],
    blockingPackagingConfigExcludes: verification.blockingPackagingConfigExcludes ?? [],
    tooBroadPackagingConfigIncludes: verification.tooBroadPackagingConfigIncludes ?? [],
    realPackagedBinaryVerified,
    nativeSearchDefaultEnableReadiness: evaluateNativeSearchDefaultEnableReadiness({
      benchmarkEvaluated: false,
      benchmarkGatePassed: false,
      agentFacadeNativeExtractorDeclared: false,
      agentFacadeNativeParityEvaluated: false,
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
      const packagingConfig = readCurrentNativeSearchPackagingConfig()
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
      }
    } else if (options.mode === 'packaged-app-layout') {
      const packagedAppResult = runPackagedAppLayoutCase(options.appNodeModulesRoot)
      cases.push(packagedAppResult.case)
      verification = {
        bundledBinaryVerified: packagedAppResult.realPackagedBinaryVerified,
        fixtureBundledPackageVerified: false,
        usesTemporaryFixture: packagedAppResult.usesTemporaryFixture,
        packagedAppLayoutVerified: packagedAppResult.layoutVerified,
        packagedAppEvidenceVerified: packagedAppResult.packagedAppEvidenceVerified,
        packagedAppIdentityVerified: packagedAppResult.packagedAppIdentityVerified,
        optionalDependenciesDeclared: packagedAppResult.optionalDependenciesDeclared,
        optionalDependenciesInstallChainVerified: packagedAppResult.optionalDependenciesInstallChainVerified,
        optionalDependenciesLockfileVerified: packagedAppResult.optionalDependenciesLockfileVerified,
        optionalDependenciesInstalledPackagesVerified: packagedAppResult.optionalDependenciesInstalledPackagesVerified,
        packagingConfigVerified: packagedAppResult.packagingConfigVerified,
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
  optionalDependenciesDeclared: boolean
  optionalDependenciesInstallChainVerified: boolean
  optionalDependenciesLockfileVerified: boolean
  optionalDependenciesInstalledPackagesVerified: boolean
  packagingConfigVerified: boolean
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

function runPackagedAppLayoutCase(appNodeModulesRoot: string | undefined): PackagedAppLayoutCaseResult {
  const optionalDependenciesInstallChain = readCurrentNativeSearchOptionalPackageInstallChain()
  const optionalDependenciesResult = optionalDependenciesInstallChain.optionalDependencies
  const packagingConfig = readCurrentNativeSearchPackagingConfig()
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
