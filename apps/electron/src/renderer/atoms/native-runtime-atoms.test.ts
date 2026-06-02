import { describe, expect, test } from 'bun:test'
import { createStore } from 'jotai'
import type {
  NativeRuntimeDiagnostics,
  NativeRuntimeOperationProgress,
  NativeRuntimeStatus,
} from '@codeinsights/shared'
import {
  nativeRuntimeActiveOperationsAtom,
  nativeRuntimeDiagnosticsAtom,
  nativeRuntimeLastErrorAtom,
  nativeRuntimeOperationMapAtom,
  nativeRuntimeStatusAtom,
  nativeRuntimeTailLoadingMapAtom,
  nativeRuntimeWorkspaceIndexingMapAtom,
  setNativeRuntimeDiagnosticsAtom,
  setNativeRuntimeOperationProgressAtom,
  setNativeRuntimeSearchRequestAtom,
  setNativeRuntimeStatusAtom,
  setNativeRuntimeTailLoadingAtom,
  clearNativeRuntimeSearchRequestAtom,
  nativeRuntimeSearchRequestMapAtom,
} from './native-runtime-atoms'

function status(overrides: Partial<NativeRuntimeStatus> = {}): NativeRuntimeStatus {
  return {
    available: true,
    nativeEnabled: false,
    implementation: 'typescript',
    protocolVersion: 1,
    cacheSchemaVersion: 1,
    capabilities: ['diagnostics', 'workspace-index'],
    fallbackReason: 'disabled',
    checkedAt: 1764590400000,
    ...overrides,
  }
}

function diagnostics(overrides: Partial<NativeRuntimeDiagnostics> = {}): NativeRuntimeDiagnostics {
  const baseStatus = status()
  return {
    status: baseStatus,
    protocolVersion: 1,
    cacheSchemaVersion: 1,
    capabilities: [
      { capability: 'diagnostics', available: true, implementation: 'typescript' },
      { capability: 'workspace-index', available: true, implementation: 'typescript' },
    ],
    fallbackReason: 'disabled',
    checkedAt: baseStatus.checkedAt,
    ...overrides,
  }
}

function progress(overrides: Partial<NativeRuntimeOperationProgress> = {}): NativeRuntimeOperationProgress {
  return {
    operationId: 'operation-1',
    requestId: 'request-1',
    workspaceId: 'workspace-1',
    kind: 'index_rebuild',
    phase: 'indexing',
    startedAt: 1764590400000,
    completed: 1,
    total: 3,
    source: 'typescript',
    ...overrides,
  }
}

describe('native-runtime-atoms', () => {
  test('status 和 diagnostics 写入后可派生 lastError', () => {
    const store = createStore()
    const nextStatus = status({
      lastError: {
        code: 'disabled',
        message: 'Native runtime 已关闭',
        recoverable: true,
      },
    })

    store.set(setNativeRuntimeStatusAtom, nextStatus)
    store.set(setNativeRuntimeDiagnosticsAtom, diagnostics({ status: nextStatus, lastError: nextStatus.lastError }))

    expect(store.get(nativeRuntimeStatusAtom)).toBe(nextStatus)
    expect(store.get(nativeRuntimeDiagnosticsAtom)?.status).toBe(nextStatus)
    expect(store.get(nativeRuntimeLastErrorAtom)?.message).toBe('Native runtime 已关闭')
  })

  test('operation progress 按 operationId 存储，并按 workspaceId 派生索引状态', () => {
    const store = createStore()

    store.set(setNativeRuntimeOperationProgressAtom, progress({ completed: 1, total: 4 }))
    store.set(setNativeRuntimeOperationProgressAtom, progress({
      operationId: 'operation-2',
      requestId: 'request-2',
      workspaceId: 'workspace-2',
      phase: 'completed',
      completed: 2,
      total: 2,
      completedAt: 1764590401000,
    }))

    expect(store.get(nativeRuntimeOperationMapAtom).size).toBe(2)
    expect(store.get(nativeRuntimeActiveOperationsAtom).map((item) => item.operationId)).toEqual(['operation-1'])
    expect(store.get(nativeRuntimeWorkspaceIndexingMapAtom).get('workspace-1')?.phase).toBe('indexing')
    expect(store.get(nativeRuntimeWorkspaceIndexingMapAtom).get('workspace-2')?.phase).toBe('completed')
  })

  test('搜索 request 和 Pipeline tail loading 按 requestId / sessionId 隔离并可清理', () => {
    const store = createStore()

    store.set(setNativeRuntimeSearchRequestAtom, {
      requestId: 'search-1',
      query: '构建',
      status: 'loading',
      source: 'workspace',
      startedAt: 1,
    })
    store.set(setNativeRuntimeSearchRequestAtom, {
      requestId: 'search-2',
      query: '测试',
      status: 'error',
      source: 'pipeline',
      startedAt: 2,
      error: '搜索失败',
    })
    store.set(setNativeRuntimeTailLoadingAtom, {
      sessionId: 'pipeline-session-1',
      loading: true,
    })
    store.set(setNativeRuntimeTailLoadingAtom, {
      sessionId: 'pipeline-session-2',
      loading: false,
      error: '读取失败',
    })
    store.set(clearNativeRuntimeSearchRequestAtom, 'search-1')

    expect([...store.get(nativeRuntimeSearchRequestMapAtom).keys()]).toEqual(['search-2'])
    expect(store.get(nativeRuntimeTailLoadingMapAtom).get('pipeline-session-1')?.loading).toBe(true)
    expect(store.get(nativeRuntimeTailLoadingMapAtom).get('pipeline-session-2')?.error).toBe('读取失败')
  })
})
