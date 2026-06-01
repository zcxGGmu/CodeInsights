import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentSessionMeta, SDKMessage } from '@codeinsights/shared'

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

interface AgentSessionsIndexFixture {
  version: number
  sessions: AgentSessionMeta[]
}

const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
let tempConfigDir = ''

beforeEach(() => {
  tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-agent-sessions-'))
  process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
})

afterEach(() => {
  if (originalConfigDir === undefined) {
    delete process.env.CODEINSIGHTS_CONFIG_DIR
  } else {
    process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
  }
  if (originalClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir
  }
  if (tempConfigDir) {
    rmSync(tempConfigDir, { recursive: true, force: true })
    tempConfigDir = ''
  }
})

async function loadSessionManager(): Promise<typeof import('./agent-session-manager')> {
  return import('./agent-session-manager')
}

function writeSessionIndex(sessions: AgentSessionMeta[]): void {
  writeFileSync(
    join(tempConfigDir, 'agent-sessions.json'),
    JSON.stringify({ version: 1, sessions } satisfies AgentSessionsIndexFixture, null, 2),
    'utf-8',
  )
}

function readSessionIndex(): AgentSessionsIndexFixture {
  return JSON.parse(readFileSync(join(tempConfigDir, 'agent-sessions.json'), 'utf-8')) as AgentSessionsIndexFixture
}

describe('agent-session-manager runtime metadata', () => {
  test('读取旧 Claude 会话时惰性补齐 runtime 字段且不立即写回', async () => {
    writeSessionIndex([
      {
        id: 'legacy-session',
        title: '旧 Claude 会话',
        sdkSessionId: 'sdk-session-1',
        createdAt: 100,
        updatedAt: 200,
      },
    ])
    const { getAgentSessionMeta, listAgentSessions } = await loadSessionManager()

    const meta = getAgentSessionMeta('legacy-session')

    expect(meta?.runtimeKind).toBe('claude-code')
    expect(meta?.runtimeSession).toEqual({
      kind: 'claude-code',
      externalSessionId: 'sdk-session-1',
      createdAt: 100,
      updatedAt: 200,
    })
    expect(listAgentSessions()[0]?.runtimeKind).toBe('claude-code')
    expect(readSessionIndex().sessions[0]?.runtimeKind).toBeUndefined()
  })

  test('更新旧 Claude 会话时写回 runtimeSession 并保留 sdkSessionId 兼容字段', async () => {
    writeSessionIndex([
      {
        id: 'legacy-session',
        title: '旧 Claude 会话',
        sdkSessionId: 'sdk-session-1',
        createdAt: 100,
        updatedAt: 200,
      },
    ])
    const { updateAgentSessionMeta } = await loadSessionManager()

    const updated = updateAgentSessionMeta('legacy-session', { title: '已更新' })

    expect(updated.runtimeKind).toBe('claude-code')
    expect(updated.runtimeSession?.externalSessionId).toBe('sdk-session-1')
    expect(updated.sdkSessionId).toBe('sdk-session-1')
    const stored = readSessionIndex().sessions[0]
    expect(stored?.runtimeKind).toBe('claude-code')
    expect(stored?.runtimeSession?.externalSessionId).toBe('sdk-session-1')
    expect(stored?.sdkSessionId).toBe('sdk-session-1')
  })

  test('Claude 会话捕获 sdkSessionId 时同步写入 runtimeSession', async () => {
    const { createAgentSession, updateAgentSessionMeta } = await loadSessionManager()
    const session = createAgentSession('新 Agent 会话')

    const updated = updateAgentSessionMeta(session.id, { sdkSessionId: 'sdk-session-new' })

    expect(session.runtimeKind).toBe('claude-code')
    expect(updated.runtimeKind).toBe('claude-code')
    expect(updated.runtimeSession?.kind).toBe('claude-code')
    expect(updated.runtimeSession?.externalSessionId).toBe('sdk-session-new')
    expect(updated.sdkSessionId).toBe('sdk-session-new')
  })

  test('清除 Claude sdkSessionId 时同步清除 runtimeSession', async () => {
    const { createAgentSession, updateAgentSessionMeta } = await loadSessionManager()
    const session = createAgentSession('待清理会话')
    updateAgentSessionMeta(session.id, { sdkSessionId: 'sdk-session-stale' })

    const cleared = updateAgentSessionMeta(session.id, { sdkSessionId: undefined })

    expect(cleared.runtimeKind).toBe('claude-code')
    expect(cleared.sdkSessionId).toBeUndefined()
    expect(cleared.runtimeSession).toBeUndefined()
    const stored = readSessionIndex().sessions.find((item) => item.id === session.id)
    expect(stored?.sdkSessionId).toBeUndefined()
    expect(stored?.runtimeSession).toBeUndefined()
  })

  test('只有 runtimeSession 的 Codex 会话会推断为 codex', async () => {
    writeSessionIndex([
      {
        id: 'codex-session',
        title: 'Codex 会话',
        runtimeSession: {
          kind: 'codex',
          externalSessionId: 'codex-thread-1',
          createdAt: 100,
          updatedAt: 200,
        },
        createdAt: 100,
        updatedAt: 200,
      },
    ])
    const { getAgentSessionMeta } = await loadSessionManager()

    const meta = getAgentSessionMeta('codex-session')

    expect(meta?.runtimeKind).toBe('codex')
    expect(meta?.runtimeSession?.externalSessionId).toBe('codex-thread-1')
    expect(meta?.sdkSessionId).toBeUndefined()
  })

  test('Codex 会话只写 runtimeSession，不写 sdkSessionId', async () => {
    const { createAgentSession, updateAgentSessionMeta } = await loadSessionManager()
    const session = createAgentSession('Codex 会话')
    const now = Date.now()

    const updated = updateAgentSessionMeta(session.id, {
      runtimeKind: 'codex',
      runtimeSession: {
        kind: 'codex',
        externalSessionId: 'codex-thread-1',
        createdAt: now,
        updatedAt: now,
      },
    })

    expect(updated.runtimeKind).toBe('codex')
    expect(updated.runtimeSession?.externalSessionId).toBe('codex-thread-1')
    expect(updated.sdkSessionId).toBeUndefined()
    const stored = readSessionIndex().sessions.find((item) => item.id === session.id)
    expect(stored?.runtimeKind).toBe('codex')
    expect(stored?.runtimeSession?.externalSessionId).toBe('codex-thread-1')
    expect(stored?.sdkSessionId).toBeUndefined()
  })

  test('opencode 会话保留 runtimeSession snapshot 且清理 Claude legacy 字段', async () => {
    writeSessionIndex([
      {
        id: 'opencode-session',
        title: 'opencode 会话',
        runtimeKind: 'opencode',
        sdkSessionId: 'legacy-sdk-should-drop',
        forkSourceSdkSessionId: 'legacy-fork-should-drop',
        resumeAtMessageUuid: 'legacy-message-should-drop',
        runtimeSession: {
          kind: 'opencode',
          externalSessionId: 'ses_opencode_1',
          channelId: null,
          model: 'provider/model',
          agent: 'build',
          authSource: 'native',
          workingDirectory: '/tmp/workspace',
          runtimeConfigHash: 'runtime-hash',
          authSourceHash: 'auth-hash',
          permissionPolicyHash: 'permission-hash',
          createdAt: 100,
          updatedAt: 200,
        },
        createdAt: 100,
        updatedAt: 200,
      },
    ])
    const { getAgentSessionMeta, updateAgentSessionMeta } = await loadSessionManager()

    const meta = getAgentSessionMeta('opencode-session')
    expect(meta?.runtimeKind).toBe('opencode')
    expect(meta?.runtimeSession?.externalSessionId).toBe('ses_opencode_1')
    expect(meta?.runtimeSession?.runtimeConfigHash).toBe('runtime-hash')
    expect(meta?.sdkSessionId).toBeUndefined()
    expect(meta?.forkSourceSdkSessionId).toBeUndefined()
    expect(meta?.resumeAtMessageUuid).toBeUndefined()

    const updated = updateAgentSessionMeta('opencode-session', { title: '已更新 opencode 会话' })
    expect(updated.runtimeSession?.kind).toBe('opencode')
    expect(updated.runtimeSession?.authSourceHash).toBe('auth-hash')
    const stored = readSessionIndex().sessions[0]
    expect(stored?.runtimeSession?.kind).toBe('opencode')
    expect(stored?.runtimeSession?.permissionPolicyHash).toBe('permission-hash')
    expect(stored?.sdkSessionId).toBeUndefined()
  })

  test('只有 runtimeSession 的 opencode 会话会推断为 opencode 并保留绑定快照', async () => {
    writeSessionIndex([
      {
        id: 'opencode-session-ref-only',
        title: 'opencode runtimeSession only',
        runtimeSession: {
          kind: 'opencode',
          externalSessionId: 'ses_opencode_ref_only',
          channelId: 'opencode-channel',
          model: 'provider/model',
          agent: 'build',
          authSource: 'channel',
          workingDirectory: '/tmp/opencode-workspace',
          runtimeConfigHash: 'runtime-hash',
          authSourceHash: 'auth-hash',
          permissionPolicyHash: 'permission-hash',
          createdAt: 100,
          updatedAt: 200,
        },
        sdkSessionId: 'legacy-sdk-should-drop',
        createdAt: 100,
        updatedAt: 200,
      },
    ])
    const { getAgentSessionMeta, updateAgentSessionMeta } = await loadSessionManager()

    const meta = getAgentSessionMeta('opencode-session-ref-only')
    expect(meta?.runtimeKind).toBe('opencode')
    expect(meta?.runtimeSession).toMatchObject({
      kind: 'opencode',
      externalSessionId: 'ses_opencode_ref_only',
      channelId: 'opencode-channel',
      model: 'provider/model',
      agent: 'build',
      authSource: 'channel',
      workingDirectory: '/tmp/opencode-workspace',
      runtimeConfigHash: 'runtime-hash',
      authSourceHash: 'auth-hash',
      permissionPolicyHash: 'permission-hash',
    })
    expect(meta?.sdkSessionId).toBeUndefined()

    const updated = updateAgentSessionMeta('opencode-session-ref-only', { manualWorking: true })
    expect(updated.runtimeKind).toBe('opencode')
    expect(updated.runtimeSession?.externalSessionId).toBe('ses_opencode_ref_only')
    expect(readSessionIndex().sessions[0]?.sdkSessionId).toBeUndefined()
  })

  test('旧 Claude 会话切到 Codex 时清理 Claude legacy 字段', async () => {
    writeSessionIndex([
      {
        id: 'legacy-session',
        title: '旧 Claude 会话',
        sdkSessionId: 'sdk-session-1',
        forkSourceSdkSessionId: 'fork-source-sdk',
        resumeAtMessageUuid: 'message-1',
        createdAt: 100,
        updatedAt: 200,
      },
    ])
    const { updateAgentSessionMeta } = await loadSessionManager()
    const now = Date.now()

    const updated = updateAgentSessionMeta('legacy-session', {
      runtimeKind: 'codex',
      runtimeSession: {
        kind: 'codex',
        externalSessionId: 'codex-thread-1',
        createdAt: now,
        updatedAt: now,
      },
    })

    expect(updated.runtimeKind).toBe('codex')
    expect(updated.runtimeSession?.externalSessionId).toBe('codex-thread-1')
    expect(updated.sdkSessionId).toBeUndefined()
    expect(updated.forkSourceSdkSessionId).toBeUndefined()
    expect(updated.resumeAtMessageUuid).toBeUndefined()
    const stored = readSessionIndex().sessions[0]
    expect(stored?.runtimeKind).toBe('codex')
    expect(stored?.runtimeSession?.externalSessionId).toBe('codex-thread-1')
    expect(stored?.sdkSessionId).toBeUndefined()
    expect(stored?.forkSourceSdkSessionId).toBeUndefined()
    expect(stored?.resumeAtMessageUuid).toBeUndefined()
  })
})

describe('agent-session-manager search', () => {
  test('搜索兼容旧 AgentMessage 和新 SDKMessage 格式', async () => {
    const {
      appendAgentMessage,
      appendSDKMessages,
      createAgentSession,
      searchAgentSessionMessages,
    } = await loadSessionManager()
    const legacy = createAgentSession('旧格式搜索')
    const sdk = createAgentSession('SDK 格式搜索')

    appendAgentMessage(legacy.id, {
      id: 'legacy-hit',
      role: 'assistant',
      content: '旧格式包含关键字',
      createdAt: 1,
    })
    appendSDKMessages(sdk.id, [
      {
        type: 'assistant',
        message: {
          id: 'sdk-hit',
          role: 'assistant',
          content: [
            { type: 'text', text: 'SDK 文本包含关键字' },
            { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
          ],
        },
        session_id: 'sdk-session',
      } satisfies SDKMessage,
    ])

    const results = await searchAgentSessionMessages('关键字')

    expect(results.map((result) => result.messageId)).toEqual(['legacy-hit', 'sdk-hit'])
    expect(results.map((result) => result.role)).toEqual(['assistant', 'assistant'])
    expect(results.every((result) => result.matchLength === 3)).toBe(true)
  })

  test('搜索保持每个 Agent 会话第一条命中和最多 30 条的旧行为', async () => {
    const {
      appendAgentMessage,
      createAgentSession,
      searchAgentSessionMessages,
    } = await loadSessionManager()

    for (let index = 0; index < 35; index += 1) {
      const session = createAgentSession(`Agent 搜索 ${index}`)
      appendAgentMessage(session.id, {
        id: `agent-first-${index}`,
        role: 'user',
        content: `第一条包含关键字 ${index}`,
        createdAt: 1,
      })
      appendAgentMessage(session.id, {
        id: `agent-second-${index}`,
        role: 'assistant',
        content: `第二条也包含关键字 ${index}`,
        createdAt: 2,
      })
    }

    const results = await searchAgentSessionMessages('关键字')

    expect(results).toHaveLength(30)
    expect(results[0]?.messageId).toBe('agent-first-0')
    expect(results.some((result) => result.messageId.startsWith('agent-second'))).toBe(false)
  })

  test('未知 role 仍回退为 assistant', async () => {
    const {
      createAgentSession,
      searchAgentSessionMessages,
    } = await loadSessionManager()
    const session = createAgentSession('未知 role 搜索')
    writeFileSync(
      join(tempConfigDir, 'agent-sessions', `${session.id}.jsonl`),
      JSON.stringify({
        id: 'unknown-role-hit',
        role: 'custom-role',
        content: '包含关键字',
        createdAt: 1,
      }) + '\n',
      'utf-8',
    )

    const results = await searchAgentSessionMessages('关键字')

    expect(results[0]).toMatchObject({
      messageId: 'unknown-role-hit',
      role: 'assistant',
    })
  })
})
