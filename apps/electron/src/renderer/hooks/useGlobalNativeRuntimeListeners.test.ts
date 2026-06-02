import { describe, expect, test } from 'bun:test'
import { createStore } from 'jotai'
import type {
  NativeRuntimeDiagnostics,
  NativeRuntimeOperationProgress,
  NativeRuntimeStatus,
} from '@codeinsights/shared'
import {
  nativeRuntimeDiagnosticsAtom,
  nativeRuntimeOperationMapAtom,
  nativeRuntimeStatusAtom,
} from '@/atoms/native-runtime-atoms'
import {
  attachNativeRuntimeListeners,
  type NativeRuntimeListenerApi,
} from './useGlobalNativeRuntimeListeners'

function status(checkedAt: number): NativeRuntimeStatus {
  return {
    available: true,
    nativeEnabled: false,
    implementation: 'typescript',
    protocolVersion: 1,
    cacheSchemaVersion: 1,
    capabilities: ['diagnostics'],
    fallbackReason: 'disabled',
    checkedAt,
  }
}

function diagnostics(checkedAt: number): NativeRuntimeDiagnostics {
  return {
    status: status(checkedAt),
    protocolVersion: 1,
    cacheSchemaVersion: 1,
    capabilities: [{ capability: 'diagnostics', available: true, implementation: 'typescript' }],
    fallbackReason: 'disabled',
    checkedAt,
  }
}

function progress(phase: NativeRuntimeOperationProgress['phase']): NativeRuntimeOperationProgress {
  return {
    operationId: 'operation-1',
    requestId: 'request-1',
    workspaceId: 'workspace-1',
    kind: 'index_rebuild',
    phase,
    startedAt: 1764590400000,
    source: 'typescript',
  }
}

function createApi(): NativeRuntimeListenerApi & {
  emitStatus: (payload: NativeRuntimeStatus) => void
  emitProgress: (payload: NativeRuntimeOperationProgress) => void
  statusListeners: Array<(payload: NativeRuntimeStatus) => void>
  progressListeners: Array<(payload: NativeRuntimeOperationProgress) => void>
} {
  const statusListeners: Array<(payload: NativeRuntimeStatus) => void> = []
  const progressListeners: Array<(payload: NativeRuntimeOperationProgress) => void> = []

  return {
    statusListeners,
    progressListeners,
    getNativeRuntimeStatus: async () => status(1),
    getNativeRuntimeDiagnostics: async () => diagnostics(2),
    onNativeRuntimeStatusChanged: (callback) => {
      statusListeners.push(callback)
      return () => {
        const index = statusListeners.indexOf(callback)
        if (index >= 0) statusListeners.splice(index, 1)
      }
    },
    onNativeRuntimeProgress: (callback) => {
      progressListeners.push(callback)
      return () => {
        const index = progressListeners.indexOf(callback)
        if (index >= 0) progressListeners.splice(index, 1)
      }
    },
    emitStatus: (payload) => {
      for (const listener of [...statusListeners]) listener(payload)
    },
    emitProgress: (payload) => {
      for (const listener of [...progressListeners]) listener(payload)
    },
  }
}

describe('attachNativeRuntimeListeners', () => {
  test('初始化 status / diagnostics，并接收后续 status 与 progress 事件', async () => {
    const store = createStore()
    const api = createApi()

    const detach = attachNativeRuntimeListeners(store, api)
    await Promise.resolve()
    await Promise.resolve()
    api.emitStatus(status(3))
    api.emitProgress(progress('indexing'))

    expect(store.get(nativeRuntimeStatusAtom)?.checkedAt).toBe(3)
    expect(store.get(nativeRuntimeDiagnosticsAtom)?.checkedAt).toBe(2)
    expect(store.get(nativeRuntimeOperationMapAtom).get('operation-1')?.phase).toBe('indexing')

    detach()
  })

  test('detach 后不再写入状态，避免重复挂载污染全局 atoms', async () => {
    const store = createStore()
    const api = createApi()

    const detach = attachNativeRuntimeListeners(store, api)
    detach()
    api.emitStatus(status(4))
    api.emitProgress(progress('completed'))

    expect(api.statusListeners).toHaveLength(0)
    expect(api.progressListeners).toHaveLength(0)
    expect(store.get(nativeRuntimeStatusAtom)).toBeNull()
    expect(store.get(nativeRuntimeOperationMapAtom).size).toBe(0)
  })
})
