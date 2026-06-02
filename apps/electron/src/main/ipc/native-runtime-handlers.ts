import { BrowserWindow, ipcMain } from 'electron'
import {
  NATIVE_RUNTIME_IPC_CHANNELS,
  type NativeRuntimeClearCacheInput,
  type NativeRuntimeDiagnostics,
  type NativeRuntimeOperationState,
  type NativeRuntimeRebuildIndexInput,
  type NativeRuntimeStatus,
} from '@codeinsights/shared'
import { nativeRuntimeService } from '../lib/native-runtime/native-runtime-service'
import {
  sanitizeNativeRuntimeDiagnostics,
  sanitizeNativeRuntimeOperationState,
  sanitizeNativeRuntimeStatus,
} from '../lib/native-runtime/native-runtime-diagnostics'

let nativeRuntimeEventsBound = false

function assertRequestId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 120) {
    throw new Error('无效的 requestId')
  }
  return value
}

function assertWorkspaceId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 160) {
    throw new Error('无效的 workspaceId')
  }
  return value
}

function parseRebuildInput(input: unknown): NativeRuntimeRebuildIndexInput {
  if (!input || typeof input !== 'object') {
    throw new Error('无效的 rebuildIndex 请求')
  }
  const record = input as Record<string, unknown>
  return {
    requestId: assertRequestId(record.requestId),
    workspaceId: assertWorkspaceId(record.workspaceId),
  }
}

function parseClearCacheInput(input: unknown): NativeRuntimeClearCacheInput {
  if (!input || typeof input !== 'object') {
    throw new Error('无效的 clearCache 请求')
  }
  const record = input as Record<string, unknown>
  return {
    requestId: assertRequestId(record.requestId),
  }
}

function parseOperationId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 180) {
    throw new Error('无效的 operationId')
  }
  return value
}

function broadcastNativeRuntimeEvent(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed?.()) {
      window.webContents.send(channel, payload)
    }
  }
}

function bindNativeRuntimeEvents(): void {
  if (nativeRuntimeEventsBound) return
  nativeRuntimeEventsBound = true

  nativeRuntimeService.onProgress((state) => {
    broadcastNativeRuntimeEvent(
      NATIVE_RUNTIME_IPC_CHANNELS.ON_PROGRESS,
      sanitizeNativeRuntimeOperationState(state),
    )
  })
  nativeRuntimeService.onStatusChanged((status) => {
    broadcastNativeRuntimeEvent(
      NATIVE_RUNTIME_IPC_CHANNELS.ON_STATUS_CHANGED,
      sanitizeNativeRuntimeStatus(status),
    )
  })
}

export function registerNativeRuntimeIpcHandlers(): void {
  bindNativeRuntimeEvents()

  ipcMain.handle(
    NATIVE_RUNTIME_IPC_CHANNELS.GET_STATUS,
    async (): Promise<NativeRuntimeStatus> => {
      return sanitizeNativeRuntimeStatus(await nativeRuntimeService.getStatus())
    },
  )

  ipcMain.handle(
    NATIVE_RUNTIME_IPC_CHANNELS.GET_DIAGNOSTICS,
    async (): Promise<NativeRuntimeDiagnostics> => {
      return sanitizeNativeRuntimeDiagnostics(await nativeRuntimeService.getDiagnostics())
    },
  )

  ipcMain.handle(
    NATIVE_RUNTIME_IPC_CHANNELS.REBUILD_INDEX,
    async (_event, input: unknown): Promise<NativeRuntimeOperationState> => {
      const operation = await nativeRuntimeService.rebuildIndex(parseRebuildInput(input))
      return sanitizeNativeRuntimeOperationState(operation)
    },
  )

  ipcMain.handle(
    NATIVE_RUNTIME_IPC_CHANNELS.CLEAR_CACHE,
    async (_event, input: unknown): Promise<NativeRuntimeOperationState> => {
      const operation = await nativeRuntimeService.clearCache(parseClearCacheInput(input))
      return sanitizeNativeRuntimeOperationState(operation)
    },
  )

  ipcMain.handle(
    NATIVE_RUNTIME_IPC_CHANNELS.GET_OPERATION_STATE,
    async (_event, operationId: unknown): Promise<NativeRuntimeOperationState | null> => {
      const operation = await nativeRuntimeService.getOperationState(parseOperationId(operationId))
      return operation ? sanitizeNativeRuntimeOperationState(operation) : null
    },
  )

  ipcMain.handle(
    NATIVE_RUNTIME_IPC_CHANNELS.CANCEL_OPERATION,
    async (_event, operationId: unknown): Promise<NativeRuntimeOperationState | null> => {
      const operation = await nativeRuntimeService.cancelOperation(parseOperationId(operationId))
      return operation ? sanitizeNativeRuntimeOperationState(operation) : null
    },
  )
}
