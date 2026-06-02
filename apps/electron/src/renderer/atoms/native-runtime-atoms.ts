import { atom } from 'jotai'
import type {
  NativeRuntimeDiagnostics,
  NativeRuntimeError,
  NativeRuntimeOperationState,
  NativeRuntimeSearchScope,
  NativeRuntimeStatus,
} from '@codeinsights/shared'
import { isNativeRuntimeTerminalOperationStatus } from '@codeinsights/shared'

export interface NativeRuntimeSearchRequestState {
  requestId: string
  query: string
  status: 'loading' | 'success' | 'error'
  source: NativeRuntimeSearchScope
  startedAt: number
  completedAt?: number
  error?: string
}

export interface NativeRuntimeTailLoadingState {
  sessionId: string
  loading: boolean
  error?: string
}

export const nativeRuntimeStatusAtom = atom<NativeRuntimeStatus | null>(null)
export const nativeRuntimeDiagnosticsAtom = atom<NativeRuntimeDiagnostics | null>(null)
export const nativeRuntimeOperationMapAtom = atom<Map<string, NativeRuntimeOperationState>>(new Map())
export const nativeRuntimeWorkspaceIndexingMapAtom = atom<Map<string, NativeRuntimeOperationState>>(new Map())
export const nativeRuntimeSearchRequestMapAtom = atom<Map<string, NativeRuntimeSearchRequestState>>(new Map())
export const nativeRuntimeTailLoadingMapAtom = atom<Map<string, NativeRuntimeTailLoadingState>>(new Map())

export const nativeRuntimeActiveOperationsAtom = atom((get) => {
  return [...get(nativeRuntimeOperationMapAtom).values()]
    .filter((operation) => !isNativeRuntimeTerminalOperationStatus(operation.phase))
})

export const nativeRuntimeLastErrorAtom = atom<NativeRuntimeError | null>((get) => {
  const diagnostics = get(nativeRuntimeDiagnosticsAtom)
  if (diagnostics?.lastError) return diagnostics.lastError
  const status = get(nativeRuntimeStatusAtom)
  return status?.lastError ?? null
})

export const setNativeRuntimeStatusAtom = atom(
  null,
  (_get, set, status: NativeRuntimeStatus | null) => {
    set(nativeRuntimeStatusAtom, status)
  },
)

export const setNativeRuntimeDiagnosticsAtom = atom(
  null,
  (_get, set, diagnostics: NativeRuntimeDiagnostics | null) => {
    set(nativeRuntimeDiagnosticsAtom, diagnostics)
    if (diagnostics) set(nativeRuntimeStatusAtom, diagnostics.status)
  },
)

export const setNativeRuntimeOperationProgressAtom = atom(
  null,
  (get, set, operation: NativeRuntimeOperationState) => {
    set(nativeRuntimeOperationMapAtom, (prev) => {
      const next = new Map(prev)
      next.set(operation.operationId, operation)
      return next
    })

    if (operation.kind === 'index_rebuild' && operation.workspaceId) {
      set(nativeRuntimeWorkspaceIndexingMapAtom, (prev) => {
        const next = new Map(prev)
        next.set(operation.workspaceId!, operation)
        return next
      })
    }

    if (operation.error) {
      const status = get(nativeRuntimeStatusAtom)
      if (status) {
        set(nativeRuntimeStatusAtom, {
          ...status,
          lastError: operation.error,
          checkedAt: Date.now(),
        })
      }
    }
  },
)

export const setNativeRuntimeSearchRequestAtom = atom(
  null,
  (_get, set, state: NativeRuntimeSearchRequestState) => {
    set(nativeRuntimeSearchRequestMapAtom, (prev) => {
      const next = new Map(prev)
      next.set(state.requestId, state)
      return next
    })
  },
)

export const clearNativeRuntimeSearchRequestAtom = atom(
  null,
  (_get, set, requestId: string) => {
    set(nativeRuntimeSearchRequestMapAtom, (prev) => {
      const next = new Map(prev)
      next.delete(requestId)
      return next
    })
  },
)

export const setNativeRuntimeTailLoadingAtom = atom(
  null,
  (_get, set, state: NativeRuntimeTailLoadingState) => {
    set(nativeRuntimeTailLoadingMapAtom, (prev) => {
      const next = new Map(prev)
      next.set(state.sessionId, state)
      return next
    })
  },
)
