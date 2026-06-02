import { afterEach, describe, expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NATIVE_RUNTIME_IPC_CHANNELS } from '@codeinsights/shared'

type IpcHandler = (_event: unknown, ...args: unknown[]) => Promise<unknown> | unknown

const handlers = new Map<string, IpcHandler>()
const sentEvents: Array<{ channel: string; payload: unknown }> = []

mock.module('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: IpcHandler): void => {
      handlers.set(channel, handler)
    },
  },
  BrowserWindow: {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, payload: unknown): void => {
            sentEvents.push({ channel, payload })
          },
        },
      },
    ],
  },
  app: {
    isPackaged: false,
    getPath: () => '',
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const tempDirs: string[] = []
const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR

afterEach(() => {
  handlers.clear()
  sentEvents.splice(0)
  if (originalConfigDir == null) {
    delete process.env.CODEINSIGHTS_CONFIG_DIR
  } else {
    process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function useTempConfigDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-ipc-'))
  tempDirs.push(dir)
  process.env.CODEINSIGHTS_CONFIG_DIR = dir
  return dir
}

describe('native-runtime-handlers', () => {
  test('注册 diagnostics/status/rebuild/clear cache 通道', async () => {
    const { registerNativeRuntimeIpcHandlers } = await import('./native-runtime-handlers')

    registerNativeRuntimeIpcHandlers()

    expect([...handlers.keys()]).toEqual(expect.arrayContaining([
      NATIVE_RUNTIME_IPC_CHANNELS.GET_STATUS,
      NATIVE_RUNTIME_IPC_CHANNELS.GET_DIAGNOSTICS,
      NATIVE_RUNTIME_IPC_CHANNELS.REBUILD_INDEX,
      NATIVE_RUNTIME_IPC_CHANNELS.CLEAR_CACHE,
      NATIVE_RUNTIME_IPC_CHANNELS.GET_OPERATION_STATE,
      NATIVE_RUNTIME_IPC_CHANNELS.CANCEL_OPERATION,
    ]))
  })

  test('rebuildIndex 只接受 workspaceId，由主进程派生 workspace-files 路径并广播进度', async () => {
    useTempConfigDir()
    const { createAgentWorkspace } = await import('../lib/agent-workspace-manager')
    const { getWorkspaceFilesDir } = await import('../lib/config-paths')
    const { registerNativeRuntimeIpcHandlers } = await import('./native-runtime-handlers')

    const workspace = createAgentWorkspace('Diagnostics Workspace')
    const workspaceFilesDir = getWorkspaceFilesDir(workspace.slug)
    mkdirSync(join(workspaceFilesDir, 'src'), { recursive: true })
    writeFileSync(join(workspaceFilesDir, 'src', 'diagnostics.ts'), '', 'utf-8')
    registerNativeRuntimeIpcHandlers()

    const handler = handlers.get(NATIVE_RUNTIME_IPC_CHANNELS.REBUILD_INDEX)
    const operation = await handler?.({}, {
      requestId: 'ipc-rebuild',
      workspaceId: workspace.id,
      rootPath: '/tmp/renderer-must-not-control-root',
    })

    expect(operation).toMatchObject({
      requestId: 'ipc-rebuild',
      kind: 'index_rebuild',
      phase: 'completed',
      workspaceId: workspace.id,
    })
    expect(sentEvents.some((event) => event.channel === NATIVE_RUNTIME_IPC_CHANNELS.ON_PROGRESS)).toBe(true)
  })

  test('无效 IPC input 会在 main process 边界被拒绝', async () => {
    const { registerNativeRuntimeIpcHandlers } = await import('./native-runtime-handlers')
    registerNativeRuntimeIpcHandlers()

    const rebuildHandler = handlers.get(NATIVE_RUNTIME_IPC_CHANNELS.REBUILD_INDEX)
    const clearHandler = handlers.get(NATIVE_RUNTIME_IPC_CHANNELS.CLEAR_CACHE)

    await expect(rebuildHandler?.({}, { requestId: '', workspaceId: 'workspace-1' })).rejects.toThrow('无效的 requestId')
    await expect(rebuildHandler?.({}, { requestId: 'req-1', workspaceId: '' })).rejects.toThrow('无效的 workspaceId')
    await expect(clearHandler?.({}, { requestId: 42 })).rejects.toThrow('无效的 requestId')
  })
})
