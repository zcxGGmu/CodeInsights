import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
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
}

interface BenchmarkCaseInput {
  name: string
  dataScale: BenchmarkDataScale
  samplesMs: number[]
  eventLoopDelayMs: number
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

interface BenchmarkCaseSummary extends BenchmarkDataScale {
  name: string
  samplesMs: number[]
  p50Ms: number
  p95Ms: number
  p99Ms: number
  eventLoopDelayMs: number
  memoryDeltaBytes: number
}

interface BenchmarkSummary {
  schemaVersion: number
  generatedAt: string
  implementation: 'typescript'
  environment: {
    platform: string
    arch: string
    bunVersion: string
  }
  options: BenchmarkOptions
  artifactDir?: string
  cases: BenchmarkCaseSummary[]
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
  return {
    schemaVersion: 1,
    generatedAt: input.startedAt,
    implementation: 'typescript',
    environment: {
      platform: process.platform,
      arch: process.arch,
      bunVersion: Bun.version,
    },
    options: input.options,
    ...(input.keepArtifacts ? { artifactDir: input.artifactDir } : {}),
    cases: input.cases.map((benchmarkCase) => ({
      name: benchmarkCase.name,
      ...benchmarkCase.dataScale,
      samplesMs: benchmarkCase.samplesMs.map((sample) => Number(sample.toFixed(3))),
      p50Ms: percentile(benchmarkCase.samplesMs, 0.5),
      p95Ms: percentile(benchmarkCase.samplesMs, 0.95),
      p99Ms: percentile(benchmarkCase.samplesMs, 0.99),
      eventLoopDelayMs: Number(benchmarkCase.eventLoopDelayMs.toFixed(3)),
      memoryDeltaBytes: benchmarkCase.memoryDeltaBytes,
    })),
  }
}

export async function runBenchmark(options: BenchmarkOptions): Promise<BenchmarkSummary> {
  const startedAt = new Date().toISOString()
  const artifactDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-benchmark-'))
  const eventSearchService = new TypeScriptEventSearchService()
  const pipelineTailService = new TypeScriptPipelineTailService()
  const workspaceIndexService = new TypeScriptWorkspaceIndexService()

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
  }
}

interface GeneratedFixtures {
  chatJsonlPath: string
  chatBytes: number
  agentJsonlPath: string
  agentBytes: number
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

function generateFixtures(rootDir: string, options: BenchmarkOptions): GeneratedFixtures {
  mkdirSync(rootDir, { recursive: true })

  const chatJsonlPath = join(rootDir, 'chat-search-large-history.jsonl')
  const agentJsonlPath = join(rootDir, 'agent-runtime-search.jsonl')
  const pipelineJsonlPath = join(rootDir, 'pipeline-tail-large-records.jsonl')
  const workspaceRootPath = join(rootDir, 'workspace-file-name-search')
  const largeLogPath = join(rootDir, 'large-log-preview.log')

  const payload = buildPayload(options.payloadBytes)
  writeFileSync(chatJsonlPath, buildChatJsonl(options.records, payload), 'utf-8')
  writeFileSync(agentJsonlPath, buildAgentJsonl(options.records, payload), 'utf-8')
  writeFileSync(pipelineJsonlPath, buildPipelineJsonl(options.records, payload), 'utf-8')
  const workspaceBytes = buildWorkspaceTree(workspaceRootPath, options.workspaceFiles)
  writeFileSync(largeLogPath, buildLargeLog(options.logBytes), 'utf-8')

  return {
    chatJsonlPath,
    chatBytes: readFileSync(chatJsonlPath).byteLength,
    agentJsonlPath,
    agentBytes: readFileSync(agentJsonlPath).byteLength,
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
  const eventLoopDelays: number[] = []
  let maxMemoryDeltaBytes = 0

  for (let index = 0; index < iterations; index += 1) {
    const memoryBefore = process.memoryUsage.rss()
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
    eventLoopDelayMs: Math.max(...eventLoopDelays),
    memoryDeltaBytes: maxMemoryDeltaBytes,
  }
}

function readLargeLogPreview(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8')
  return content.slice(0, 64 * 1024).length
}

if (import.meta.main) {
  const options = parseBenchmarkArgs(process.argv.slice(2))
  const summary = await runBenchmark(options)
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}
