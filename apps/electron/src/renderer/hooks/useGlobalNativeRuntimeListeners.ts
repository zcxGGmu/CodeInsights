import { useEffect } from 'react'
import { useStore } from 'jotai'
import type {
  NativeRuntimeDiagnostics,
  NativeRuntimeOperationState,
  NativeRuntimeStatus,
} from '@codeinsights/shared'
import {
  setNativeRuntimeDiagnosticsAtom,
  setNativeRuntimeOperationProgressAtom,
  setNativeRuntimeStatusAtom,
} from '@/atoms/native-runtime-atoms'

export interface NativeRuntimeListenerApi {
  getNativeRuntimeStatus: () => Promise<NativeRuntimeStatus>
  getNativeRuntimeDiagnostics: () => Promise<NativeRuntimeDiagnostics>
  onNativeRuntimeStatusChanged: (callback: (status: NativeRuntimeStatus) => void) => () => void
  onNativeRuntimeProgress: (callback: (state: NativeRuntimeOperationState) => void) => () => void
}

export type NativeRuntimeStore = ReturnType<typeof useStore>

export function attachNativeRuntimeListeners(
  store: NativeRuntimeStore,
  api: NativeRuntimeListenerApi,
): () => void {
  let disposed = false

  api.getNativeRuntimeStatus()
    .then((status) => {
      if (!disposed) store.set(setNativeRuntimeStatusAtom, status)
    })
    .catch((error: unknown) => {
      console.error('[NativeRuntime] 初始化 status 失败:', error)
    })

  api.getNativeRuntimeDiagnostics()
    .then((diagnostics) => {
      if (!disposed) store.set(setNativeRuntimeDiagnosticsAtom, diagnostics)
    })
    .catch((error: unknown) => {
      console.error('[NativeRuntime] 初始化 diagnostics 失败:', error)
    })

  const offStatus = api.onNativeRuntimeStatusChanged((status) => {
    if (!disposed) store.set(setNativeRuntimeStatusAtom, status)
  })
  const offProgress = api.onNativeRuntimeProgress((state) => {
    if (!disposed) store.set(setNativeRuntimeOperationProgressAtom, state)
  })

  return () => {
    disposed = true
    offStatus()
    offProgress()
  }
}

export function useGlobalNativeRuntimeListeners(): void {
  const store = useStore()

  useEffect(() => {
    return attachNativeRuntimeListeners(store, window.electronAPI)
  }, [store])
}
