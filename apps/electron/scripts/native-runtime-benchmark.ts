import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

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

async function runBenchmark(options: BenchmarkOptions): Promise<BenchmarkSummary> {
  const startedAt = new Date().toISOString()
  const artifactDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-benchmark-'))

  try {
    const fixtures = generateFixtures(artifactDir, options)
    const cases: BenchmarkCaseInput[] = []

    cases.push(await measureCase(
      'chat-search-large-history',
      { records: options.records, bytes: fixtures.chatBytes },
      options.iterations,
      () => scanJsonlForQuery(fixtures.chatJsonlPath, '关键字'),
    ))

    cases.push(await measureCase(
      'agent-runtime-search',
      { records: options.records, bytes: fixtures.agentBytes },
      options.iterations,
      () => scanJsonlForQuery(fixtures.agentJsonlPath, 'tool_result'),
    ))

    cases.push(await measureCase(
      'pipeline-tail-large-records',
      { records: options.records, bytes: fixtures.pipelineBytes },
      options.iterations,
      () => tailJsonlByFullParse(fixtures.pipelineJsonlPath, Math.max(0, options.records - 200), 200),
    ))

    cases.push(await measureCase(
      'workspace-file-name-search',
      { files: options.workspaceFiles, bytes: fixtures.workspaceBytes },
      options.iterations,
      () => searchWorkspacePathList(fixtures.workspaceListPath, 'target'),
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
  workspaceListPath: string
  workspaceBytes: number
  largeLogPath: string
}

function generateFixtures(rootDir: string, options: BenchmarkOptions): GeneratedFixtures {
  mkdirSync(rootDir, { recursive: true })

  const chatJsonlPath = join(rootDir, 'chat-search-large-history.jsonl')
  const agentJsonlPath = join(rootDir, 'agent-runtime-search.jsonl')
  const pipelineJsonlPath = join(rootDir, 'pipeline-tail-large-records.jsonl')
  const workspaceListPath = join(rootDir, 'workspace-file-name-search.txt')
  const largeLogPath = join(rootDir, 'large-log-preview.log')

  const payload = buildPayload(options.payloadBytes)
  writeFileSync(chatJsonlPath, buildChatJsonl(options.records, payload), 'utf-8')
  writeFileSync(agentJsonlPath, buildAgentJsonl(options.records, payload), 'utf-8')
  writeFileSync(pipelineJsonlPath, buildPipelineJsonl(options.records, payload), 'utf-8')
  writeFileSync(workspaceListPath, buildWorkspacePathList(options.workspaceFiles), 'utf-8')
  writeFileSync(largeLogPath, buildLargeLog(options.logBytes), 'utf-8')

  return {
    chatJsonlPath,
    chatBytes: readFileSync(chatJsonlPath).byteLength,
    agentJsonlPath,
    agentBytes: readFileSync(agentJsonlPath).byteLength,
    pipelineJsonlPath,
    pipelineBytes: readFileSync(pipelineJsonlPath).byteLength,
    workspaceListPath,
    workspaceBytes: readFileSync(workspaceListPath).byteLength,
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

function buildWorkspacePathList(files: number): string {
  const lines: string[] = []
  for (let index = 0; index < files; index += 1) {
    const marker = index % 17 === 0 ? 'target-' : ''
    lines.push(`packages/demo-${index % 23}/src/${marker}file-${index}.ts`)
  }
  return `${lines.join('\n')}\n`
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
  run: () => number,
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
    run()
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

function scanJsonlForQuery(filePath: string, query: string): number {
  const queryLower = query.toLowerCase()
  const raw = readFileSync(filePath, 'utf-8')
  let matches = 0

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    const parsed = JSON.parse(line) as { content?: string; type?: string }
    if (
      parsed.content?.toLowerCase().includes(queryLower)
      || parsed.type?.toLowerCase().includes(queryLower)
    ) {
      matches += 1
    }
  }

  return matches
}

function tailJsonlByFullParse(filePath: string, afterIndex: number, limit: number): number {
  const raw = readFileSync(filePath, 'utf-8')
  const records = raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown)

  return records.slice(afterIndex, afterIndex + limit).length
}

function searchWorkspacePathList(filePath: string, query: string): number {
  const queryLower = query.toLowerCase()
  return readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter((line) => line.toLowerCase().includes(queryLower))
    .length
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
