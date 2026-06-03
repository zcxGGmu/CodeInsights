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
})
