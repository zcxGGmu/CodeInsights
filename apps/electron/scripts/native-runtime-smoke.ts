import { createHash } from 'node:crypto'
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { redactNativeRuntimeText } from '../src/main/lib/native-runtime/native-runtime-diagnostics'
import {
  getNativeRuntimeCacheDir,
  getNativeRuntimeCacheManifestPath,
  readNativeRuntimeCacheManifest,
} from '../src/main/lib/native-runtime/native-runtime-cache-schema'
import {
  buildNativeSearchPackageManifest,
  getNativeSearchOptionalPackagePlan,
  isNativeSearchPackageManifest,
  NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS,
} from '../src/main/lib/native-runtime/native-runtime-package-manifest'
import { resolveNativeSearchPackage } from '../src/main/lib/native-runtime/native-runtime-package-resolver'
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

export interface NativeRuntimeSmokeOptions {
  mode: NativeRuntimeSmokeMode
  nativeSearchBinary?: string
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
  cases: NativeRuntimeSmokeCase[]
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
  cases: NativeRuntimeSmokeCase[]
}): NativeRuntimeSmokeSummary {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    nativeSearchBinaryProvided: Boolean(input.nativeSearchBinary),
    cases: input.cases.map((smokeCase) => ({
      ...smokeCase,
      detail: smokeCase.detail ? redactNativeRuntimeText(smokeCase.detail) : undefined,
    })),
  }
}

export async function runNativeRuntimeSmoke(options: NativeRuntimeSmokeOptions): Promise<NativeRuntimeSmokeSummary> {
  const rootDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-smoke-'))
  const previousConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  const cases: NativeRuntimeSmokeCase[] = []

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
      cases.push(runPackagedResolverFixtureCase(rootDir))
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
  ) {
    return value
  }
  return DEFAULT_OPTIONS.mode
}

if (import.meta.main) {
  try {
    const summary = await runNativeRuntimeSmoke(parseNativeRuntimeSmokeArgs(process.argv.slice(2)))
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[Native Runtime Smoke] ${redactNativeRuntimeText(message)}\n`)
    process.exitCode = 1
  }
}
