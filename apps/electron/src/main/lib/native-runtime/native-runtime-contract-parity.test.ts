import { afterEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NativeRuntimeSidecarManager } from './native-runtime-sidecar-manager'
import { TypeScriptEventSearchService } from './ts-event-search-service'

interface ParityRecord {
  id: string
  content: string
  createdAt: number
}

interface AgentSdkParityContentBlock {
  type?: unknown
  text?: unknown
  id?: unknown
  name?: unknown
  input?: unknown
}

interface AgentSdkParityRecord extends Record<string, unknown> {
  id?: string
  uuid?: string
  content?: unknown
  message?: {
    id?: unknown
    role?: unknown
    content?: unknown
  }
}

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function createTempJsonl(lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'codeinsights-native-parity-'))
  tempDirs.push(dir)
  const filePath = join(dir, 'events.jsonl')
  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return filePath
}

function resolveCargoPath(): string | null {
  if (process.env.CARGO && existsSync(process.env.CARGO)) {
    return process.env.CARGO
  }
  try {
    const cargoPath = execFileSync('/bin/sh', ['-lc', 'command -v cargo'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return cargoPath || null
  } catch {
    return null
  }
}

function getAgentParityRecordId(record: AgentSdkParityRecord): string {
  if (typeof record.id === 'string' && record.id) return record.id
  if (typeof record.uuid === 'string' && record.uuid) return record.uuid
  const message = record.message
  if (message && typeof message.id === 'string') return message.id
  return ''
}

function getAgentParitySearchText(record: AgentSdkParityRecord): string | null {
  if (typeof record.content === 'string') return record.content

  const message = record.message
  if (!message || !Array.isArray(message.content)) return null
  const text = (message.content as AgentSdkParityContentBlock[])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n')
  return text || null
}

describe('Rust search sidecar contract parity', () => {
  test('真实 Rust sidecar 与 TypeScript fallback 在 JSONL literal search 上保持命中和 UTF-16 range 一致', async () => {
    const cargoPath = resolveCargoPath()
    expect(cargoPath).toBeTruthy()

    const filePath = createTempJsonl([
      JSON.stringify({ id: 'skip-1', content: '没有命中', createdAt: 1 }),
      '{bad json',
      JSON.stringify({
        id: 'hit-1',
        content: '前缀🙂关键字 Bearer secret-token',
        createdAt: 2,
      }),
    ])
    const source = {
      sourceKind: 'chat_message' as const,
      sourceId: 'chat-parity',
      title: 'Chat parity',
      filePath,
      nativeTextFields: ['content'],
      nativeIdField: 'id',
      getRecordId: (record: ParityRecord) => record.id,
      getRecordText: (record: ParityRecord) => record.content,
      toLegacyResult: ({ record }: { record: ParityRecord }) => record.id,
    }
    const tsService = new TypeScriptEventSearchService()
    const tsResult = await tsService.searchMatchesInSource<ParityRecord, string>({
      requestId: 'parity-ts',
      query: '关键字',
      limit: 10,
      ...source,
    })
    const cargoTargetDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-parity-cargo-target-'))
    tempDirs.push(cargoTargetDir)
    const manager = new NativeRuntimeSidecarManager({
      binaryPath: cargoPath!,
      args: ['run', '--manifest-path', join(process.cwd(), 'native/search/Cargo.toml'), '--quiet', '--'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        CARGO_TARGET_DIR: cargoTargetDir,
      },
      statusTimeoutMs: 120_000,
      requestTimeoutMs: 5_000,
      shutdownTimeoutMs: 2_000,
    })

    try {
      const rustResult = await manager.search({
        requestId: 'parity-rust',
        query: '关键字',
        limit: 10,
        sources: [{
          sourceKind: source.sourceKind,
          sourceId: source.sourceId,
          sessionId: source.sourceId,
          title: source.title,
          filePath,
          textFields: source.nativeTextFields,
          idField: source.nativeIdField,
        }],
      })

      expect(tsResult.searchResult.matches.map((match) => match.id)).toEqual(['hit-1'])
      expect(rustResult.matches.map((match) => match.id)).toEqual(['hit-1'])
      expect(rustResult.matches[0]?.matchedRanges).toEqual(tsResult.searchResult.matches[0]?.matchedRanges)
      expect(rustResult.matches[0]?.snippet).toContain('Bearer [redacted]')
      expect(rustResult.matches[0]?.snippet).not.toContain('secret-token')
      expect(rustResult.implementation).toBe('rust-sidecar')
    } finally {
      await manager.shutdown().catch(() => false)
    }
  }, 120_000)

  test('真实 Rust sidecar 与 TypeScript fallback 在 Agent SDK nested text extractor 上保持命中一致', async () => {
    const cargoPath = resolveCargoPath()
    expect(cargoPath).toBeTruthy()

    const filePath = createTempJsonl([
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'tool-only',
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'Read', input: { query: 'sdk_keyword' } },
          ],
        },
        session_id: 'agent-parity',
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'sdk-hit',
          role: 'assistant',
          content: [
            { type: 'text', text: '前缀🙂 sdk_keyword Bearer nested-secret' },
            { type: 'tool_use', id: 'tool-2', name: 'Read', input: {} },
          ],
        },
        session_id: 'agent-parity',
      }),
    ])
    const source = {
      sourceKind: 'agent_message' as const,
      sourceId: 'agent-parity',
      title: 'Agent SDK parity',
      filePath,
      nativeTextExtractor: 'agent_message_search_text' as const,
      getRecordId: getAgentParityRecordId,
      getRecordText: getAgentParitySearchText,
      toLegacyResult: ({ record }: { record: AgentSdkParityRecord }) => getAgentParityRecordId(record),
    }
    const tsService = new TypeScriptEventSearchService()
    const tsResult = await tsService.searchMatchesInSource<AgentSdkParityRecord, string>({
      requestId: 'agent-parity-ts',
      query: 'sdk_keyword',
      limit: 10,
      ...source,
    })
    const cargoTargetDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-agent-parity-cargo-target-'))
    tempDirs.push(cargoTargetDir)
    const manager = new NativeRuntimeSidecarManager({
      binaryPath: cargoPath!,
      args: ['run', '--manifest-path', join(process.cwd(), 'native/search/Cargo.toml'), '--quiet', '--'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        CARGO_TARGET_DIR: cargoTargetDir,
      },
      statusTimeoutMs: 120_000,
      requestTimeoutMs: 5_000,
      shutdownTimeoutMs: 2_000,
    })

    try {
      const directRustResult = await manager.search({
        requestId: 'agent-parity-direct-rust',
        query: 'sdk_keyword',
        limit: 10,
        sources: [{
          sourceKind: source.sourceKind,
          sourceId: source.sourceId,
          sessionId: source.sourceId,
          title: source.title,
          filePath,
          textExtractor: source.nativeTextExtractor,
        }],
      })
      const nativeService = new TypeScriptEventSearchService({ nativeSearch: manager })
      const rustResult = await nativeService.searchMatchesInSource<AgentSdkParityRecord, string>({
        requestId: 'agent-parity-rust',
        query: 'sdk_keyword',
        limit: 10,
        ...source,
      })

      expect(tsResult.matches).toEqual(['sdk-hit'])
      expect(rustResult.matches).toEqual(tsResult.matches)
      expect(rustResult.searchResult.implementation).toBe('rust-sidecar')
      expect(rustResult.searchResult.matches[0]?.matchedRanges).toEqual(
        tsResult.searchResult.matches[0]?.matchedRanges,
      )
      expect(directRustResult.matches).toHaveLength(1)
      expect(directRustResult.matches[0]?.snippet).toContain('Bearer [redacted]')
      expect(directRustResult.matches[0]?.snippet).not.toContain('nested-secret')
    } finally {
      await manager.shutdown().catch(() => false)
    }
  }, 120_000)
})
