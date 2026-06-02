import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NATIVE_RUNTIME_FEATURE_FLAGS,
  NATIVE_RUNTIME_IPC_CHANNELS,
  isNativeRuntimeTerminalOperationStatus,
  type NativeRuntimeDiagnostics,
  type NativeRuntimeFileChunkReadInput,
  type NativeRuntimeFileChunkReadResult,
  type NativeRuntimeOperationProgress,
  type NativeRuntimeSearchInput,
  type NativeRuntimeSearchResult,
  type NativeRuntimeTailInput,
  type NativeRuntimeTailResult,
  type NativeRuntimeWorkspaceIndexInput,
  type NativeRuntimeWorkspaceIndexResult,
} from './native-runtime'
import { NATIVE_RUNTIME_IPC_CHANNELS as ROOT_NATIVE_RUNTIME_IPC_CHANNELS } from '@codeinsights/shared'

const fixturesDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/native-runtime',
)

function readFixture<TFixture>(name: string): TFixture {
  return JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf-8')) as TFixture
}

describe('native runtime shared contract', () => {
  test('IPC channel names stay under the native-runtime namespace', () => {
    expect(NATIVE_RUNTIME_IPC_CHANNELS.GET_STATUS).toBe('native-runtime:get-status')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.GET_DIAGNOSTICS).toBe('native-runtime:get-diagnostics')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.REBUILD_INDEX).toBe('native-runtime:rebuild-index')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.CLEAR_CACHE).toBe('native-runtime:clear-cache')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.SEARCH).toBe('native-runtime:search')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.TAIL_JSONL).toBe('native-runtime:tail-jsonl')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.READ_FILE_CHUNK).toBe('native-runtime:read-file-chunk')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.GET_OPERATION_STATE).toBe('native-runtime:get-operation-state')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.CANCEL_OPERATION).toBe('native-runtime:cancel-operation')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.ON_PROGRESS).toBe('native-runtime:on-progress')
    expect(NATIVE_RUNTIME_IPC_CHANNELS.ON_STATUS_CHANGED).toBe('native-runtime:on-status-changed')
  })

  test('native runtime IPC channels are available from the shared package root', () => {
    expect(ROOT_NATIVE_RUNTIME_IPC_CHANNELS.GET_DIAGNOSTICS).toBe(NATIVE_RUNTIME_IPC_CHANNELS.GET_DIAGNOSTICS)
    expect(ROOT_NATIVE_RUNTIME_IPC_CHANNELS.ON_PROGRESS).toBe(NATIVE_RUNTIME_IPC_CHANNELS.ON_PROGRESS)
  })

  test('feature flags default to explicit native runtime names', () => {
    expect(NATIVE_RUNTIME_FEATURE_FLAGS.RUNTIME).toBe('CODEINSIGHTS_NATIVE_RUNTIME')
    expect(NATIVE_RUNTIME_FEATURE_FLAGS.SEARCH).toBe('CODEINSIGHTS_NATIVE_SEARCH')
  })

  test('contract fixtures cover search, tail, diagnostics, operations and file chunks', () => {
    const searchInput = readFixture<NativeRuntimeSearchInput>('search-input.json')
    const searchResult = readFixture<NativeRuntimeSearchResult>('search-result.json')
    const tailInput = readFixture<NativeRuntimeTailInput>('tail-input.json')
    const tailResult = readFixture<NativeRuntimeTailResult>('tail-result.json')
    const diagnostics = readFixture<NativeRuntimeDiagnostics>('diagnostics.json')
    const operation = readFixture<NativeRuntimeOperationProgress>('operation-progress.json')
    const workspaceIndexInput = readFixture<NativeRuntimeWorkspaceIndexInput>('workspace-index-input.json')
    const workspaceIndex = readFixture<NativeRuntimeWorkspaceIndexResult>('workspace-index-result.json')
    const fileChunkInput = readFixture<NativeRuntimeFileChunkReadInput>('file-chunk-input.json')
    const fileChunkResult = readFixture<NativeRuntimeFileChunkReadResult>('file-chunk-result.json')

    expect(searchInput.scope).toContain('pipeline')
    expect(searchInput.requestId).toBe(searchResult.requestId)
    expect(searchResult.matches[0]?.sourceKind).toBe('pipeline_record')
    expect(searchResult.matches[0]?.matchedRanges[0]).toEqual({ start: 12, length: 3 })

    expect(tailInput.fileKind).toBe('pipeline-records')
    expect(tailResult.records[0]).toMatchObject({ type: 'node_output' })
    expect(tailResult.implementation).toBe('typescript')

    expect(diagnostics.status.implementation).toBe('typescript')
    expect(diagnostics.status.nativeEnabled).toBe(false)
    expect(diagnostics.fallbackReason).toBe('disabled')

    expect(operation.kind).toBe('index_rebuild')
    expect(operation.phase).toBe('completed')
    expect(isNativeRuntimeTerminalOperationStatus(operation.phase)).toBe(true)

    expect(workspaceIndexInput.rootPath).toContain('/agent-workspaces/')
    expect(workspaceIndexInput.additionalPaths?.[0]).toContain('/project')
    expect(workspaceIndex.status).toBe('ready')
    expect(workspaceIndex.ignoreSummary.directories).toContain('node_modules')

    expect(fileChunkInput.pathToken).toBe('workspace-file:demo-log')
    expect(fileChunkResult.nextOffset).toBe(64)
    expect(fileChunkResult.binaryDetected).toBe(false)
  })

  test('terminal operation helper only accepts final phases', () => {
    expect(isNativeRuntimeTerminalOperationStatus('completed')).toBe(true)
    expect(isNativeRuntimeTerminalOperationStatus('failed')).toBe(true)
    expect(isNativeRuntimeTerminalOperationStatus('cancelled')).toBe(true)
    expect(isNativeRuntimeTerminalOperationStatus('indexing')).toBe(false)
    expect(isNativeRuntimeTerminalOperationStatus('queued')).toBe(false)
  })
})
