import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { redactNativeRuntimeText } from '../src/main/lib/native-runtime/native-runtime-diagnostics'
import { NativeRuntimeSidecarManager } from '../src/main/lib/native-runtime/native-runtime-sidecar-manager'
import { TypeScriptEventSearchService } from '../src/main/lib/native-runtime/ts-event-search-service'
import { TypeScriptPipelineTailService } from '../src/main/lib/native-runtime/ts-pipeline-tail-service'
import { TypeScriptWorkspaceIndexService } from '../src/main/lib/native-runtime/ts-workspace-index-service'

export interface BenchmarkOptions {
  records: number
  payloadBytes: number
  workspaceFiles: number
  logBytes: number
  iterations: number
  keepArtifacts: boolean
  nativeSearchBinary?: string
}

interface BenchmarkCaseInput {
  name: string
  dataScale: BenchmarkDataScale
  samplesMs: number[]
  eventLoopBaselineSamplesMs: number[]
  eventLoopDelaySamplesMs: number[]
  memoryDeltaBytes: number
}

interface BenchmarkRunInput {
  startedAt: string
  artifactDir: string
  keepArtifacts: boolean
  options: BenchmarkOptions
  cases: BenchmarkCaseInput[]
}

interface BenchmarkDataScale {
  records?: number
  files?: number
  bytes?: number
}

interface BenchmarkSummaryOptions extends Omit<BenchmarkOptions, 'nativeSearchBinary'> {
  nativeSearchBinaryProvided: boolean
}

interface BenchmarkCaseSummary extends BenchmarkDataScale {
  name: string
  samplesMs: number[]
  p50Ms: number
  p95Ms: number
  p99Ms: number
  /**
   * 兼容旧 Review 的字段，语义等同于 eventLoopDelayMaxMs。
   */
  eventLoopDelayMs: number
  eventLoopDelayMaxMs: number
  eventLoopDelayP95Ms: number
  eventLoopDelaySamplesMs: number[]
  /**
   * 每轮 run 前单独采样的 idle setTimeout(0) delay，用于估计测量口径自身成本。
   */
  eventLoopBaselineMs: number
  eventLoopBaselineP95Ms: number
  eventLoopWorkDelayMs: number
  eventLoopWorkDelayP95Ms: number
  eventLoopWorkDelaySamplesMs: number[]
  memoryDeltaBytes: number
}

interface BenchmarkSummary {
  schemaVersion: number
  generatedAt: string
  implementation: 'typescript' | 'typescript+rust-sidecar'
  environment: {
    platform: string
    arch: string
    bunVersion: string
  }
  options: BenchmarkSummaryOptions
  artifactDir?: string
  nativeSearchGate: BenchmarkNativeSearchGate
  agentFacadeSearch: BenchmarkAgentFacadeSearch
  cases: BenchmarkCaseSummary[]
}

type BenchmarkNativeSearchSource = 'chat' | 'agent'

type BenchmarkNativeSearchGateBlocker =
  | 'native_binary_not_provided'
  | 'native_search_comparison_incomplete'
  | 'chat_p95_not_improved'
  | 'agent_p95_not_improved'
  | 'chat_event_loop_delay_p95_regressed'
  | 'agent_event_loop_delay_p95_regressed'
  | 'chat_event_loop_work_delay_p95_regressed'
  | 'agent_event_loop_work_delay_p95_regressed'
  | 'optional_package_install_chain_not_evaluated'
  | 'packaged_app_bundled_binary_not_evaluated'

interface BenchmarkNativeSearchComparison {
  source: BenchmarkNativeSearchSource
  typescriptCaseName: string
  nativeCaseName: string
  p95DeltaMs: number
  p95Ratio: number
  eventLoopDelayP95DeltaMs: number
  eventLoopWorkDelayP95DeltaMs: number
  p95Improved: boolean
  eventLoopDelayP95NotRegressed: boolean
  eventLoopWorkDelayP95NotRegressed: boolean
}

interface BenchmarkNativeSearchGate {
  evaluated: boolean
  benchmarkGatePassed: boolean
  defaultEnableCandidate: boolean
  benchmarkBlockers: BenchmarkNativeSearchGateBlocker[]
  defaultEnableBlockers: BenchmarkNativeSearchGateBlocker[]
  blockers: BenchmarkNativeSearchGateBlocker[]
  comparisons: BenchmarkNativeSearchComparison[]
}

type BenchmarkAgentFacadeDefaultEnableBlocker =
  | 'agent_facade_case_missing'
  | 'agent_facade_native_text_fields_not_declared'

interface BenchmarkAgentFacadeSearch {
  evaluated: boolean
  caseName: string
  implementation: 'typescript' | 'not_evaluated'
  productionAgentNativeTextFieldsDeclared: boolean
  nativeEligible: boolean
  directNativeBenchmarkCaseName: string
  defaultEnableBlockers: BenchmarkAgentFacadeDefaultEnableBlocker[]
}

const DEFAULT_OPTIONS: BenchmarkOptions = {
  records: 1000,
  payloadBytes: 256,
  workspaceFiles: 2000,
  logBytes: 1024 * 1024,
  iterations: 3,
  keepArtifacts: false,
}

export function parseBenchmarkArgs(args: string[]): BenchmarkOptions {
  const options = { ...DEFAULT_OPTIONS }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--keep-artifacts') {
      options.keepArtifacts = true
      continue
    }

    const value = args[index + 1]
    if (!value) continue

    if (arg === '--records') {
      options.records = parsePositiveInteger(value, options.records)
      index += 1
    } else if (arg === '--payload-bytes') {
      options.payloadBytes = parsePositiveInteger(value, options.payloadBytes)
      index += 1
    } else if (arg === '--workspace-files') {
      options.workspaceFiles = parsePositiveInteger(value, options.workspaceFiles)
      index += 1
    } else if (arg === '--log-bytes') {
      options.logBytes = parsePositiveInteger(value, options.logBytes)
      index += 1
    } else if (arg === '--iterations') {
      options.iterations = parsePositiveInteger(value, options.iterations)
      index += 1
    } else if (arg === '--native-search-binary') {
      options.nativeSearchBinary = value
      index += 1
    }
  }

  return options
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

export function percentile(samples: number[], percentileValue: number): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentileValue * sorted.length) - 1),
  )
  return Number(sorted[rank]!.toFixed(3))
}

export function buildBenchmarkSummary(input: BenchmarkRunInput): BenchmarkSummary {
  const cases = input.cases.map(buildBenchmarkCaseSummary)
  const nativeSearchBinaryProvided = Boolean(input.options.nativeSearchBinary)
  return {
    schemaVersion: 1,
    generatedAt: input.startedAt,
    implementation: input.options.nativeSearchBinary ? 'typescript+rust-sidecar' : 'typescript',
    environment: {
      platform: process.platform,
      arch: process.arch,
      bunVersion: Bun.version,
    },
    options: {
      records: input.options.records,
      payloadBytes: input.options.payloadBytes,
      workspaceFiles: input.options.workspaceFiles,
      logBytes: input.options.logBytes,
      iterations: input.options.iterations,
      keepArtifacts: input.options.keepArtifacts,
      nativeSearchBinaryProvided,
    },
    ...(input.keepArtifacts ? { artifactDir: input.artifactDir } : {}),
    nativeSearchGate: buildNativeSearchGate(cases, nativeSearchBinaryProvided),
    agentFacadeSearch: buildAgentFacadeSearch(cases),
    cases,
  }
}

function buildBenchmarkCaseSummary(benchmarkCase: BenchmarkCaseInput): BenchmarkCaseSummary {
  const eventLoopDelayMaxMs = maxSample(benchmarkCase.eventLoopDelaySamplesMs)
  const eventLoopBaselineMaxMs = maxSample(benchmarkCase.eventLoopBaselineSamplesMs)
  const eventLoopDelayP95Ms = percentile(benchmarkCase.eventLoopDelaySamplesMs, 0.95)
  const eventLoopBaselineP95Ms = percentile(benchmarkCase.eventLoopBaselineSamplesMs, 0.95)
  const eventLoopWorkDelaySamplesMs = benchmarkCase.eventLoopDelaySamplesMs.map((delay, index) => (
    Math.max(0, delay - (benchmarkCase.eventLoopBaselineSamplesMs[index] ?? 0))
  ))
  return {
    name: benchmarkCase.name,
    ...benchmarkCase.dataScale,
    samplesMs: benchmarkCase.samplesMs.map(roundMillis),
    p50Ms: percentile(benchmarkCase.samplesMs, 0.5),
    p95Ms: percentile(benchmarkCase.samplesMs, 0.95),
    p99Ms: percentile(benchmarkCase.samplesMs, 0.99),
    eventLoopDelayMs: roundMillis(eventLoopDelayMaxMs),
    eventLoopDelayMaxMs: roundMillis(eventLoopDelayMaxMs),
    eventLoopDelayP95Ms,
    eventLoopDelaySamplesMs: benchmarkCase.eventLoopDelaySamplesMs.map(roundMillis),
    eventLoopBaselineMs: roundMillis(eventLoopBaselineMaxMs),
    eventLoopBaselineP95Ms,
    eventLoopWorkDelayMs: maxSample(eventLoopWorkDelaySamplesMs),
    eventLoopWorkDelayP95Ms: percentile(eventLoopWorkDelaySamplesMs, 0.95),
    eventLoopWorkDelaySamplesMs: eventLoopWorkDelaySamplesMs.map(roundMillis),
    memoryDeltaBytes: benchmarkCase.memoryDeltaBytes,
  }
}

function buildNativeSearchGate(
  cases: BenchmarkCaseSummary[],
  nativeSearchBinaryProvided: boolean,
): BenchmarkNativeSearchGate {
  const benchmarkBlockers: BenchmarkNativeSearchGateBlocker[] = []
  const defaultEnableBlockers: BenchmarkNativeSearchGateBlocker[] = [
    'optional_package_install_chain_not_evaluated',
    'packaged_app_bundled_binary_not_evaluated',
  ]

  if (!nativeSearchBinaryProvided) {
    benchmarkBlockers.push('native_binary_not_provided')
    return {
      evaluated: false,
      benchmarkGatePassed: false,
      defaultEnableCandidate: false,
      benchmarkBlockers,
      defaultEnableBlockers,
      blockers: [...benchmarkBlockers, ...defaultEnableBlockers],
      comparisons: [],
    }
  }

  const comparisons = [
    buildNativeSearchComparison('chat', 'chat-search-large-history', 'native-chat-search-large-history', cases),
    buildNativeSearchComparison('agent', 'agent-runtime-search', 'native-agent-runtime-search', cases),
  ].filter((comparison): comparison is BenchmarkNativeSearchComparison => comparison != null)
  const evaluated = comparisons.length === 2

  if (!evaluated) {
    benchmarkBlockers.push('native_search_comparison_incomplete')
  }

  for (const comparison of comparisons) {
    appendNativeSearchComparisonBlockers(comparison, benchmarkBlockers)
  }

  const benchmarkGatePassed = evaluated
    && comparisons.every((comparison) => (
      comparison.p95Improved
      && comparison.eventLoopDelayP95NotRegressed
      && comparison.eventLoopWorkDelayP95NotRegressed
    ))

  return {
    evaluated,
    benchmarkGatePassed,
    defaultEnableCandidate: false,
    benchmarkBlockers,
    defaultEnableBlockers,
    blockers: [...benchmarkBlockers, ...defaultEnableBlockers],
    comparisons,
  }
}

function buildAgentFacadeSearch(cases: BenchmarkCaseSummary[]): BenchmarkAgentFacadeSearch {
  const caseName = 'agent-runtime-production-facade-search'
  const directNativeBenchmarkCaseName = 'native-agent-runtime-search'
  const facadeCase = cases.find((benchmarkCase) => benchmarkCase.name === caseName)

  if (!facadeCase) {
    return {
      evaluated: false,
      caseName,
      implementation: 'not_evaluated',
      productionAgentNativeTextFieldsDeclared: false,
      nativeEligible: false,
      directNativeBenchmarkCaseName,
      defaultEnableBlockers: ['agent_facade_case_missing'],
    }
  }

  return {
    evaluated: true,
    caseName,
    implementation: 'typescript',
    productionAgentNativeTextFieldsDeclared: false,
    nativeEligible: false,
    directNativeBenchmarkCaseName,
    defaultEnableBlockers: ['agent_facade_native_text_fields_not_declared'],
  }
}

function buildNativeSearchComparison(
  source: BenchmarkNativeSearchSource,
  typescriptCaseName: string,
  nativeCaseName: string,
  cases: BenchmarkCaseSummary[],
): BenchmarkNativeSearchComparison | undefined {
  const typescriptCase = cases.find((benchmarkCase) => benchmarkCase.name === typescriptCaseName)
  const nativeCase = cases.find((benchmarkCase) => benchmarkCase.name === nativeCaseName)
  if (!typescriptCase || !nativeCase) return undefined

  const p95DeltaMs = roundMillis(nativeCase.p95Ms - typescriptCase.p95Ms)
  const eventLoopDelayP95DeltaMs = roundMillis(nativeCase.eventLoopDelayP95Ms - typescriptCase.eventLoopDelayP95Ms)
  const eventLoopWorkDelayP95DeltaMs = roundMillis(
    nativeCase.eventLoopWorkDelayP95Ms - typescriptCase.eventLoopWorkDelayP95Ms,
  )

  return {
    source,
    typescriptCaseName,
    nativeCaseName,
    p95DeltaMs,
    p95Ratio: typescriptCase.p95Ms > 0
      ? roundMillis(nativeCase.p95Ms / typescriptCase.p95Ms)
      : 0,
    eventLoopDelayP95DeltaMs,
    eventLoopWorkDelayP95DeltaMs,
    p95Improved: p95DeltaMs < 0,
    eventLoopDelayP95NotRegressed: eventLoopDelayP95DeltaMs <= 0,
    eventLoopWorkDelayP95NotRegressed: eventLoopWorkDelayP95DeltaMs <= 0,
  }
}

function appendNativeSearchComparisonBlockers(
  comparison: BenchmarkNativeSearchComparison,
  blockers: BenchmarkNativeSearchGateBlocker[],
): void {
  if (!comparison.p95Improved) {
    blockers.push(comparison.source === 'chat' ? 'chat_p95_not_improved' : 'agent_p95_not_improved')
  }
  if (!comparison.eventLoopDelayP95NotRegressed) {
    blockers.push(
      comparison.source === 'chat'
        ? 'chat_event_loop_delay_p95_regressed'
        : 'agent_event_loop_delay_p95_regressed',
    )
  }
  if (!comparison.eventLoopWorkDelayP95NotRegressed) {
    blockers.push(
      comparison.source === 'chat'
        ? 'chat_event_loop_work_delay_p95_regressed'
        : 'agent_event_loop_work_delay_p95_regressed',
    )
  }
}

function roundMillis(value: number): number {
  return Number(value.toFixed(3))
}

function maxSample(samples: number[]): number {
  if (samples.length === 0) return 0
  return roundMillis(Math.max(...samples))
}

export async function runBenchmark(options: BenchmarkOptions): Promise<BenchmarkSummary> {
  const startedAt = new Date().toISOString()
  const artifactDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-benchmark-'))
  const eventSearchService = new TypeScriptEventSearchService()
  const pipelineTailService = new TypeScriptPipelineTailService()
  const workspaceIndexService = new TypeScriptWorkspaceIndexService()
  const nativeSearchManager = options.nativeSearchBinary
    ? new NativeRuntimeSidecarManager({
      binaryPath: options.nativeSearchBinary,
      requestTimeoutMs: 120_000,
      statusTimeoutMs: 120_000,
      shutdownTimeoutMs: 5_000,
    })
    : undefined

  try {
    const fixtures = generateFixtures(artifactDir, options)
    const cases: BenchmarkCaseInput[] = []

    cases.push(await measureCase(
      'chat-search-large-history',
      { records: options.records, bytes: fixtures.chatBytes },
      options.iterations,
      async () => {
        const result = await eventSearchService.searchMatchesInSource<BenchmarkMessageRecord, number>({
          requestId: 'benchmark-chat-search',
          query: '关键字',
          filePath: fixtures.chatJsonlPath,
          sourceKind: 'chat_message',
          sourceId: 'chat-session-demo',
          title: 'Chat benchmark',
          limit: 100,
          getRecordId: (record) => record.id,
          getRecordText: (record) => record.content,
          toLegacyResult: () => 1,
        })
        return result.total
      },
    ))

    cases.push(await measureCase(
      'agent-runtime-search',
      { records: options.records, bytes: fixtures.agentBytes },
      options.iterations,
      async () => {
        const result = await eventSearchService.searchMatchesInSource<BenchmarkAgentRecord, number>({
          requestId: 'benchmark-agent-search',
          query: 'tool_result',
          filePath: fixtures.agentJsonlPath,
          sourceKind: 'agent_message',
          sourceId: 'agent-session-demo',
          title: 'Agent benchmark',
          limit: 100,
          getRecordId: (record) => String(record.seq),
          getRecordText: (record) => `${record.type}\n${record.content}`,
          toLegacyResult: () => 1,
        })
        return result.total
      },
    ))

    cases.push(await measureCase(
      'agent-runtime-production-facade-search',
      { records: options.records, bytes: fixtures.agentSdkBytes },
      options.iterations,
      async () => {
        const result = await eventSearchService.searchFirstMatchPerSource<BenchmarkAgentSdkRecord, number>({
          requestId: 'benchmark-agent-facade-search',
          query: 'sdk_keyword',
          limit: 100,
          sources: [{
            sourceKind: 'agent_message',
            sourceId: 'agent-session-demo',
            title: 'Agent SDK facade benchmark',
            filePath: fixtures.agentSdkJsonlPath,
            getRecordId: getBenchmarkSearchableAgentMessageId,
            getRecordText: getBenchmarkSearchableAgentText,
            toLegacyResult: () => 1,
          }],
        })
        return result.results.length
      },
    ))

    if (nativeSearchManager) {
      await nativeSearchManager.getStatus()

      cases.push(await measureCase(
        'native-sidecar-status-cache-overhead',
        {},
        options.iterations,
        async () => {
          const status = await nativeSearchManager.getStatus()
          return status.nativeEnabled ? 1 : 0
        },
      ))

      cases.push(await measureCase(
        'native-chat-search-large-history',
        { records: options.records, bytes: fixtures.chatBytes },
        options.iterations,
        async () => {
          const result = await nativeSearchManager.search({
            requestId: 'benchmark-native-chat-search',
            query: '关键字',
            limit: 100,
            sources: [{
              sourceKind: 'chat_message',
              sourceId: 'chat-session-demo',
              sessionId: 'chat-session-demo',
              title: 'Chat benchmark',
              filePath: fixtures.chatJsonlPath,
              textFields: ['content'],
              idField: 'id',
            }],
          })
          return result.matches.length
        },
      ))

      cases.push(await measureCase(
        'native-agent-runtime-search',
        { records: options.records, bytes: fixtures.agentBytes },
        options.iterations,
        async () => {
          const result = await nativeSearchManager.search({
            requestId: 'benchmark-native-agent-search',
            query: 'tool_result',
            limit: 100,
            sources: [{
              sourceKind: 'agent_message',
              sourceId: 'agent-session-demo',
              sessionId: 'agent-session-demo',
              title: 'Agent benchmark',
              filePath: fixtures.agentJsonlPath,
              textFields: ['type', 'content'],
              idField: 'seq',
            }],
          })
          return result.matches.length
        },
      ))
    }

    cases.push(await measureCase(
      'pipeline-tail-large-records',
      { records: options.records, bytes: fixtures.pipelineBytes },
      options.iterations,
      () => pipelineTailService.readTail({
        requestId: 'benchmark-pipeline-tail',
        filePath: fixtures.pipelineJsonlPath,
        sessionId: 'pipeline-session-demo',
        direction: 'latest',
        limit: 200,
      }).records.length,
    ))

    cases.push(await measureCase(
      'workspace-file-name-index-cold-build',
      { files: options.workspaceFiles, bytes: fixtures.workspaceBytes },
      options.iterations,
      async () => {
        const service = new TypeScriptWorkspaceIndexService()
        const result = await service.searchWorkspaceFiles({
          requestId: 'benchmark-workspace-cold',
          workspaceId: 'workspace-benchmark',
          rootPath: fixtures.workspaceRootPath,
          query: 'target',
          limit: 100,
          forceRebuild: true,
        })
        return result.total
      },
    ))

    await workspaceIndexService.searchWorkspaceFiles({
      requestId: 'benchmark-workspace-warm-prime',
      workspaceId: 'workspace-benchmark',
      rootPath: fixtures.workspaceRootPath,
      query: 'target',
      limit: 100,
      forceRebuild: true,
    })

    cases.push(await measureCase(
      'workspace-file-name-search',
      { files: options.workspaceFiles, bytes: fixtures.workspaceBytes },
      options.iterations,
      async () => {
        const result = await workspaceIndexService.searchWorkspaceFiles({
          requestId: 'benchmark-workspace-warm',
          workspaceId: 'workspace-benchmark',
          rootPath: fixtures.workspaceRootPath,
          query: 'target',
          limit: 100,
        })
        return result.total
      },
    ))

    cases.push(await measureCase(
      'large-log-preview',
      { bytes: options.logBytes },
      options.iterations,
      () => readLargeLogPreview(fixtures.largeLogPath),
    ))

    return buildBenchmarkSummary({
      startedAt,
      artifactDir,
      keepArtifacts: options.keepArtifacts,
      options,
      cases,
    })
  } finally {
    if (!options.keepArtifacts) {
      rmSync(artifactDir, { recursive: true, force: true })
    }
    await nativeSearchManager?.shutdown().catch(() => false)
  }
}

interface GeneratedFixtures {
  chatJsonlPath: string
  chatBytes: number
  agentJsonlPath: string
  agentBytes: number
  agentSdkJsonlPath: string
  agentSdkBytes: number
  pipelineJsonlPath: string
  pipelineBytes: number
  workspaceRootPath: string
  workspaceBytes: number
  largeLogPath: string
}

interface BenchmarkMessageRecord {
  id: string
  content: string
}

interface BenchmarkAgentRecord {
  seq: number
  type: string
  content: string
}

interface BenchmarkAgentSdkContentBlock {
  type?: unknown
  text?: unknown
}

interface BenchmarkAgentSdkMessage {
  id?: unknown
  content?: unknown
}

interface BenchmarkAgentSdkRecord extends Record<string, unknown> {
  id?: string
  uuid?: string
  message?: BenchmarkAgentSdkMessage
  content?: unknown
}

function generateFixtures(rootDir: string, options: BenchmarkOptions): GeneratedFixtures {
  mkdirSync(rootDir, { recursive: true })

  const chatJsonlPath = join(rootDir, 'chat-search-large-history.jsonl')
  const agentJsonlPath = join(rootDir, 'agent-runtime-search.jsonl')
  const agentSdkJsonlPath = join(rootDir, 'agent-runtime-production-facade-search.jsonl')
  const pipelineJsonlPath = join(rootDir, 'pipeline-tail-large-records.jsonl')
  const workspaceRootPath = join(rootDir, 'workspace-file-name-search')
  const largeLogPath = join(rootDir, 'large-log-preview.log')

  const payload = buildPayload(options.payloadBytes)
  writeFileSync(chatJsonlPath, buildChatJsonl(options.records, payload), 'utf-8')
  writeFileSync(agentJsonlPath, buildAgentJsonl(options.records, payload), 'utf-8')
  writeFileSync(agentSdkJsonlPath, buildAgentSdkJsonl(options.records, payload), 'utf-8')
  writeFileSync(pipelineJsonlPath, buildPipelineJsonl(options.records, payload), 'utf-8')
  const workspaceBytes = buildWorkspaceTree(workspaceRootPath, options.workspaceFiles)
  writeFileSync(largeLogPath, buildLargeLog(options.logBytes), 'utf-8')

  return {
    chatJsonlPath,
    chatBytes: readFileSync(chatJsonlPath).byteLength,
    agentJsonlPath,
    agentBytes: readFileSync(agentJsonlPath).byteLength,
    agentSdkJsonlPath,
    agentSdkBytes: readFileSync(agentSdkJsonlPath).byteLength,
    pipelineJsonlPath,
    pipelineBytes: readFileSync(pipelineJsonlPath).byteLength,
    workspaceRootPath,
    workspaceBytes,
    largeLogPath,
  }
}

function buildPayload(payloadBytes: number): string {
  return 'x'.repeat(Math.max(16, payloadBytes))
}

function buildChatJsonl(records: number, payload: string): string {
  const lines: string[] = []
  for (let index = 0; index < records; index += 1) {
    lines.push(JSON.stringify({
      id: `chat-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `${index % 10 === 0 ? '关键字 ' : ''}chat message ${index} ${payload}`,
      createdAt: 1764590400000 + index,
    }))
  }
  return `${lines.join('\n')}\n`
}

function buildAgentJsonl(records: number, payload: string): string {
  const lines: string[] = []
  for (let index = 0; index < records; index += 1) {
    lines.push(JSON.stringify({
      seq: index,
      type: index % 5 === 0 ? 'tool_result' : 'text_delta',
      sessionId: 'agent-session-demo',
      content: `agent event ${index} ${payload}`,
      createdAt: 1764590400000 + index,
    }))
  }
  return `${lines.join('\n')}\n`
}

function buildAgentSdkJsonl(records: number, payload: string): string {
  const lines: string[] = []
  for (let index = 0; index < records; index += 1) {
    lines.push(JSON.stringify({
      type: 'assistant',
      message: {
        id: `sdk-${index}`,
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `${index % 10 === 0 ? 'sdk_keyword ' : ''}agent sdk message ${index} ${payload}`,
          },
          {
            type: 'tool_use',
            id: `tool-${index}`,
            name: 'Read',
            input: {},
          },
        ],
      },
      session_id: 'agent-session-demo',
    }))
  }
  return `${lines.join('\n')}\n`
}

function getBenchmarkSearchableAgentMessageId(record: BenchmarkAgentSdkRecord): string {
  if (typeof record.id === 'string' && record.id) return record.id
  if (typeof record.uuid === 'string' && record.uuid) return record.uuid

  const message = record.message
  if (message && typeof message.id === 'string') return message.id

  return ''
}

function getBenchmarkSearchableAgentText(record: BenchmarkAgentSdkRecord): string | null {
  if (typeof record.content === 'string') return record.content

  const message = record.message
  if (!message || !Array.isArray(message.content)) return null

  const text = (message.content as BenchmarkAgentSdkContentBlock[])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n')

  return text || null
}

function buildPipelineJsonl(records: number, payload: string): string {
  const lines: string[] = []
  for (let index = 0; index < records; index += 1) {
    lines.push(JSON.stringify({
      id: `record-${index}`,
      sessionId: 'pipeline-session-demo',
      type: 'node_output',
      node: index % 2 === 0 ? 'planner' : 'tester',
      content: `pipeline record ${index} ${payload}`,
      createdAt: 1764590400000 + index,
    }))
  }
  return `${lines.join('\n')}\n`
}

function buildWorkspaceTree(rootPath: string, files: number): number {
  mkdirSync(rootPath, { recursive: true })
  let bytes = 0
  for (let index = 0; index < files; index += 1) {
    const marker = index % 17 === 0 ? 'target-' : ''
    const relativePath = `packages/demo-${index % 23}/src/${marker}file-${index}.ts`
    const filePath = join(rootPath, relativePath)
    mkdirSync(join(filePath, '..'), { recursive: true })
    writeFileSync(filePath, '', 'utf-8')
    bytes += relativePath.length + 1
  }
  return bytes
}

function buildLargeLog(bytes: number): string {
  const line = '2026-06-01T12:00:00.000Z INFO benchmark log line for large preview\n'
  const chunks: string[] = []
  let total = 0
  while (total < bytes) {
    chunks.push(line)
    total += line.length
  }
  return chunks.join('').slice(0, bytes)
}

async function measureCase(
  name: string,
  dataScale: BenchmarkDataScale,
  iterations: number,
  run: () => number | Promise<number>,
): Promise<BenchmarkCaseInput> {
  const samplesMs: number[] = []
  const eventLoopBaselineDelays: number[] = []
  const eventLoopDelays: number[] = []
  let maxMemoryDeltaBytes = 0

  for (let index = 0; index < iterations; index += 1) {
    const memoryBefore = process.memoryUsage.rss()
    eventLoopBaselineDelays.push(await measureEventLoopDelay())

    const delayStart = performance.now()
    const delay = new Promise<number>((resolve) => {
      setTimeout(() => resolve(performance.now() - delayStart), 0)
    })

    const startedAt = performance.now()
    await run()
    samplesMs.push(performance.now() - startedAt)
    eventLoopDelays.push(await delay)
    maxMemoryDeltaBytes = Math.max(0, process.memoryUsage.rss() - memoryBefore, maxMemoryDeltaBytes)
  }

  return {
    name,
    dataScale,
    samplesMs,
    eventLoopBaselineSamplesMs: eventLoopBaselineDelays,
    eventLoopDelaySamplesMs: eventLoopDelays,
    memoryDeltaBytes: maxMemoryDeltaBytes,
  }
}

async function measureEventLoopDelay(): Promise<number> {
  const delayStart = performance.now()
  return await new Promise<number>((resolve) => {
    setTimeout(() => resolve(performance.now() - delayStart), 0)
  })
}

function readLargeLogPreview(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8')
  return content.slice(0, 64 * 1024).length
}

if (import.meta.main) {
  try {
    const options = parseBenchmarkArgs(process.argv.slice(2))
    const summary = await runBenchmark(options)
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[Native Runtime Benchmark] ${redactNativeRuntimeText(message)}\n`)
    process.exitCode = 1
  }
}
