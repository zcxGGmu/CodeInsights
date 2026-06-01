import { afterEach, describe, expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

mock.module('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '',
  },
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => [],
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

import { attachWorkspaceDirectory, createAgentWorkspace } from './agent-workspace-manager'
import { getAgentSessionsIndexPath, getAgentSessionWorkspacePath, getWorkspaceFilesDir } from './config-paths'
import { resolveWorkspaceSearchScope } from './agent-workspace-search-scope'

const tempDirs: string[] = []
const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR

afterEach(() => {
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
  const dir = mkdtempSync(join(tmpdir(), 'codeinsights-workspace-search-scope-'))
  tempDirs.push(dir)
  process.env.CODEINSIGHTS_CONFIG_DIR = dir
  return dir
}

function writeSessionsIndex(sessions: Array<{
  id: string
  title: string
  workspaceId: string
  attachedDirectories?: string[]
}>): void {
  writeFileSync(
    getAgentSessionsIndexPath(),
    JSON.stringify({
      version: 2,
      sessions: sessions.map((session) => ({
        ...session,
        createdAt: 1764590400000,
        updatedAt: 1764590400000,
      })),
    }, null, 2),
    'utf-8',
  )
}

describe('resolveWorkspaceSearchScope', () => {
  test('只允许已登记 workspace files 根路径，并过滤未登记附加目录', async () => {
    useTempConfigDir()
    const workspace = createAgentWorkspace('Scope Workspace')
    const workspaceFilesPath = getWorkspaceFilesDir(workspace.slug)
    const allowedAttached = mkdtempSync(join(tmpdir(), 'codeinsights-scope-allowed-'))
    const deniedAttached = mkdtempSync(join(tmpdir(), 'codeinsights-scope-denied-'))
    tempDirs.push(allowedAttached, deniedAttached)
    attachWorkspaceDirectory(workspace.slug, allowedAttached)

    const scope = await resolveWorkspaceSearchScope(workspaceFilesPath, [
      allowedAttached,
      deniedAttached,
    ])

    expect(scope).toEqual({
      workspaceId: workspace.id,
      rootPath: workspaceFilesPath,
      additionalPaths: [resolve(allowedAttached)],
    })
  })

  test('允许已登记 session cwd，并合并工作区与会话附加目录白名单', async () => {
    useTempConfigDir()
    const workspace = createAgentWorkspace('Scope Session Workspace')
    const sessionId = 'session-scope-1'
    const sessionPath = getAgentSessionWorkspacePath(workspace.slug, sessionId)
    const workspaceFilesPath = getWorkspaceFilesDir(workspace.slug)
    const sessionAttached = mkdtempSync(join(tmpdir(), 'codeinsights-scope-session-attached-'))
    const deniedAttached = mkdtempSync(join(tmpdir(), 'codeinsights-scope-session-denied-'))
    tempDirs.push(sessionAttached, deniedAttached)
    writeSessionsIndex([
      {
        id: sessionId,
        title: 'Scope Session',
        workspaceId: workspace.id,
        attachedDirectories: [sessionAttached],
      },
    ])

    const scope = await resolveWorkspaceSearchScope(sessionPath, [
      workspaceFilesPath,
      sessionAttached,
      deniedAttached,
    ])

    expect(scope.workspaceId).toBe(sessionId)
    expect(scope.rootPath).toBe(sessionPath)
    expect(scope.additionalPaths).toEqual([
      resolve(workspaceFilesPath),
      resolve(sessionAttached),
    ])
  })

  test('拒绝 renderer 传入的任意未登记 rootPath', async () => {
    useTempConfigDir()
    createAgentWorkspace('Scope Reject Workspace')
    const arbitraryPath = mkdtempSync(join(tmpdir(), 'codeinsights-scope-arbitrary-'))
    tempDirs.push(arbitraryPath)
    mkdirSync(join(arbitraryPath, 'nested'), { recursive: true })

    await expect(resolveWorkspaceSearchScope(arbitraryPath, [])).rejects.toThrow('工作区搜索路径不在允许范围内')
  })
})
