/**
 * Agent 会话管理器
 *
 * 负责 Agent 会话的 CRUD 操作和消息持久化。
 * - 会话索引：~/.codeinsights/agent-sessions.json（轻量元数据）
 * - 消息存储：~/.codeinsights/agent-sessions/{id}.jsonl（JSONL 格式，逐行追加）
 *
 * 照搬 conversation-manager.ts 的模式。
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, unlinkSync, rmSync, renameSync, readdirSync, copyFileSync } from 'node:fs'
import { writeJsonFileAtomic, readJsonFileSafe } from './safe-file'
import { randomUUID } from 'node:crypto'
import { join, resolve, dirname } from 'node:path'
import {
  getAgentSessionsIndexPath,
  getAgentSessionsDir,
  getAgentSessionMessagesPath,
  getAgentSessionEventsPath,
  getAgentSessionWorkspacePath,
  getAgentWorkspacePath,
  getSdkConfigDir,
} from './config-paths'
import { ensurePluginManifest, getAgentWorkspace } from './agent-workspace-manager'
import { getTypeScriptEventSearchService } from './native-runtime/native-runtime-service'
import {
  getMaterializedAgentRuntimeCwd,
  hasMaterializedAgentRuntime,
  materializeAgentRuntimeForNewSession,
} from './agent-runtime-materializer'

// 在模块加载时一次性设置 SDK 配置目录，避免在 forkSession 等异步调用中临时修改/恢复
// process.env 导致的并发安全问题（异步操作的 await 间隙其他代码可能读到错误值）
if (!process.env.CLAUDE_CONFIG_DIR) {
  process.env.CLAUDE_CONFIG_DIR = getSdkConfigDir()
}
import type { AgentSessionMeta, AgentMessage, SDKMessage, ForkSessionInput, AgentMessageSearchResult, AgentStreamEnvelope, CodingAgentRuntimeKind } from '@codeinsights/shared'
import { getConversationMessages } from './conversation-manager'
import { clearNanoBananaAgentHistory } from './chat-tools/nano-banana-mcp'
import { copyTreeWithoutSymlinks } from './agent-session-copy'

/**
 * 会话索引文件格式
 */
interface AgentSessionsIndex {
  /** 配置版本号 */
  version: number
  /** 会话元数据列表 */
  sessions: AgentSessionMeta[]
}

/** 当前索引版本 */
const INDEX_VERSION = 1

/**
 * 读取会话索引文件
 */
function readIndex(): AgentSessionsIndex {
  const indexPath = getAgentSessionsIndexPath()
  const data = readJsonFileSafe<AgentSessionsIndex>(indexPath)
  if (data) return data
  return { version: INDEX_VERSION, sessions: [] }
}

/**
 * 写入会话索引文件
 */
function writeIndex(index: AgentSessionsIndex): void {
  const indexPath = getAgentSessionsIndexPath()

  try {
    writeJsonFileAtomic(indexPath, index)
  } catch (error) {
    console.error('[Agent 会话] 写入索引文件失败:', error)
    throw new Error('写入 Agent 会话索引失败')
  }
}

/**
 * 读取期惰性归一化 Agent 会话 runtime 字段。
 *
 * 旧 Claude 会话可能只有 sdkSessionId；这里只返回内存态补齐，不主动批量改写索引文件。
 */
export function normalizeAgentSessionMeta(meta: AgentSessionMeta): AgentSessionMeta {
  const runtimeKind = meta.runtimeKind ?? meta.runtimeSession?.kind ?? 'claude-code'

  if (runtimeKind !== 'claude-code') {
    return {
      ...meta,
      runtimeKind,
      runtimeSession: meta.runtimeSession?.kind === runtimeKind ? meta.runtimeSession : undefined,
      sdkSessionId: undefined,
      forkSourceSdkSessionId: undefined,
      resumeAtMessageUuid: undefined,
    }
  }

  const runtimeSession = meta.sdkSessionId
    ? createRuntimeSessionRef('claude-code', meta.sdkSessionId, meta.createdAt, meta.updatedAt)
    : meta.runtimeSession?.kind === 'claude-code'
      ? meta.runtimeSession
      : undefined

  return {
    ...meta,
    runtimeKind,
    runtimeSession,
  }
}

function normalizeAgentSessionMetaForWrite(meta: AgentSessionMeta): AgentSessionMeta {
  const normalized = normalizeAgentSessionMeta(meta)
  if (normalized.runtimeKind === 'claude-code' && normalized.sdkSessionId) {
    return {
      ...normalized,
      runtimeSession: createRuntimeSessionRef(
        'claude-code',
        normalized.sdkSessionId,
        normalized.runtimeSession?.createdAt ?? normalized.createdAt,
        normalized.updatedAt,
      ),
    }
  }
  return normalized
}

function createRuntimeSessionRef(
  kind: CodingAgentRuntimeKind,
  externalSessionId: string,
  createdAt: number,
  updatedAt: number,
): NonNullable<AgentSessionMeta['runtimeSession']> {
  return {
    kind,
    externalSessionId,
    createdAt,
    updatedAt,
  }
}

/**
 * 获取所有会话（按 updatedAt 降序）
 */
export function listAgentSessions(): AgentSessionMeta[] {
  const index = readIndex()
  return index.sessions.map(normalizeAgentSessionMeta).sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * 获取单个会话的元数据
 */
export function getAgentSessionMeta(id: string): AgentSessionMeta | undefined {
  const index = readIndex()
  const meta = index.sessions.find((s) => s.id === id)
  return meta ? normalizeAgentSessionMeta(meta) : undefined
}

/**
 * 创建新会话
 */
export function createAgentSession(
  title?: string,
  channelId?: string,
  workspaceId?: string,
): AgentSessionMeta {
  const index = readIndex()
  const now = Date.now()

  const meta: AgentSessionMeta = {
    id: randomUUID(),
    title: title || '新 Agent 会话',
    channelId,
    runtimeKind: 'claude-code',
    workspaceId,
    createdAt: now,
    updatedAt: now,
  }

  // 确保消息目录存在
  getAgentSessionsDir()

  // 若有工作区，新 session 物化 Claude runtime 目录；旧 session 路径不在这里迁移。
  if (workspaceId) {
    const ws = getAgentWorkspace(workspaceId)
    if (ws) {
      ensurePluginManifest(ws.slug, ws.name)
      materializeAgentRuntimeForNewSession({
        workspace: ws,
        sessionId: meta.id,
      })
    }
  }

  index.sessions.push(meta)
  writeIndex(index)

  console.log(`[Agent 会话] 已创建会话: ${meta.title} (${meta.id})`)
  return meta
}

/**
 * 读取会话的所有消息
 */
export function getAgentSessionMessages(id: string): AgentMessage[] {
  const filePath = getAgentSessionMessagesPath(id)

  if (!existsSync(filePath)) {
    return []
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const lines = raw.split('\n').filter((line) => line.trim())
    return lines.map((line) => JSON.parse(line) as AgentMessage)
  } catch (error) {
    console.error(`[Agent 会话] 读取消息失败 (${id}):`, error)
    return []
  }
}

/**
 * 追加一条消息到会话的 JSONL 文件
 */
export function appendAgentMessage(id: string, message: AgentMessage): void {
  const filePath = getAgentSessionMessagesPath(id)

  try {
    const line = JSON.stringify(message) + '\n'
    appendFileSync(filePath, line, 'utf-8')

    // 追加消息时更新 updatedAt，若已归档则自动恢复活跃
    const index = readIndex()
    const idx = index.sessions.findIndex((s) => s.id === id)
    if (idx !== -1) {
      const session = index.sessions[idx]!
      session.updatedAt = Date.now()
      if (session.archived) session.archived = false
      writeIndex(index)
    }
  } catch (error) {
    console.error(`[Agent 会话] 追加消息失败 (${id}):`, error)
    throw new Error('追加 Agent 消息失败')
  }
}

/**
 * 追加 SDKMessage 到会话的 JSONL 文件（Phase 4 新持久化格式）
 *
 * 每条 SDKMessage 单独一行 JSON。读取时通过 `type` 字段区分新旧格式。
 */
export function appendSDKMessages(id: string, messages: SDKMessage[]): void {
  if (messages.length === 0) return

  const filePath = getAgentSessionMessagesPath(id)

  try {
    const lines = messages.map((m) => JSON.stringify(m)).join('\n') + '\n'
    appendFileSync(filePath, lines, 'utf-8')
  } catch (error) {
    console.error(`[Agent 会话] 追加 SDKMessage 失败 (${id}):`, error)
    throw new Error('追加 SDKMessage 失败')
  }
}

/**
 * 追加 Agent runtime envelope 到旁路 events JSONL 文件。
 *
 * 这是阶段 2 双写路径；旧 SDKMessage JSONL 仍是当前 Renderer 与 resume 的主数据源。
 */
export function appendAgentRuntimeEvents(id: string, envelopes: AgentStreamEnvelope[]): void {
  if (envelopes.length === 0) return

  const filePath = getAgentSessionEventsPath(id)

  try {
    const lines = envelopes.map((envelope) => JSON.stringify(envelope)).join('\n') + '\n'
    appendFileSync(filePath, lines, 'utf-8')
  } catch (error) {
    console.error(`[Agent 会话] 追加 runtime events 失败 (${id}):`, error)
    throw new Error('追加 Agent runtime events 失败')
  }
}

/**
 * 读取 Agent runtime events（阶段 2 shadow replay / 后续 Renderer 切换使用）。
 */
export function getAgentSessionRuntimeEvents(id: string): AgentStreamEnvelope[] {
  const filePath = getAgentSessionEventsPath(id)

  if (!existsSync(filePath)) {
    return []
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const lines = raw.split('\n').filter((line) => line.trim())
    return lines.map((line) => JSON.parse(line) as AgentStreamEnvelope)
  } catch (error) {
    console.error(`[Agent 会话] 读取 runtime events 失败 (${id}):`, error)
    return []
  }
}

/**
 * 读取会话的所有 SDKMessage（兼容旧 AgentMessage 格式）
 *
 * 旧格式（有 `role` 字段）会被转换为近似的 SDKMessage。
 * 新格式（有 `type` 字段）直接返回。
 */
export function getAgentSessionSDKMessages(id: string): SDKMessage[] {
  const filePath = getAgentSessionMessagesPath(id)

  if (!existsSync(filePath)) {
    return []
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const lines = raw.split('\n').filter((line) => line.trim())
    return lines.map((line) => {
      const parsed = JSON.parse(line)
      // 旧格式检测：AgentMessage 有 `role` 字段，SDKMessage 有 `type` 字段
      if ('role' in parsed && !('type' in parsed)) {
        return convertLegacyMessage(parsed as AgentMessage)
      }
      return parsed as SDKMessage
    })
  } catch (error) {
    console.error(`[Agent 会话] 读取 SDKMessage 失败 (${id}):`, error)
    return []
  }
}

/**
 * 将旧的 AgentMessage 转换为近似的 SDKMessage（向后兼容）
 *
 * 不需要完美还原，只需在 UI 中可读即可。
 */
function convertLegacyMessage(legacy: AgentMessage): SDKMessage {
  if (legacy.role === 'user') {
    return {
      type: 'user',
      message: {
        content: [{ type: 'text', text: legacy.content }],
      },
      parent_tool_use_id: null,
      // 附加元数据供渲染器使用
      _legacy: true,
      _createdAt: legacy.createdAt,
    } as unknown as SDKMessage
  }

  if (legacy.role === 'assistant') {
    return {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: legacy.content }],
        model: legacy.model,
      },
      parent_tool_use_id: null,
      _legacy: true,
      _createdAt: legacy.createdAt,
    } as unknown as SDKMessage
  }

  if (legacy.role === 'status') {
    // 错误消息转换为 assistant error 格式
    return {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: legacy.content }],
      },
      parent_tool_use_id: null,
      error: { message: legacy.content, errorType: legacy.errorCode },
      _legacy: true,
      _createdAt: legacy.createdAt,
      _errorCode: legacy.errorCode,
      _errorTitle: legacy.errorTitle,
      _errorDetails: legacy.errorDetails,
      _errorCanRetry: legacy.errorCanRetry,
      _errorActions: legacy.errorActions,
    } as unknown as SDKMessage
  }

  // 其他类型，作为 system 消息返回
  return {
    type: 'system',
    subtype: 'init',
    _legacy: true,
    _createdAt: legacy.createdAt,
  } as unknown as SDKMessage
}

/**
 * 更新会话元数据
 */
export function updateAgentSessionMeta(
  id: string,
  updates: Partial<Pick<AgentSessionMeta, 'title' | 'channelId' | 'runtimeKind' | 'runtimeSession' | 'sdkSessionId' | 'workspaceId' | 'pinned' | 'archived' | 'attachedDirectories' | 'forkSourceDir' | 'forkSourceSdkSessionId' | 'resumeAtMessageUuid' | 'manualWorking' | 'stoppedByUser'>>,
): AgentSessionMeta {
  const index = readIndex()
  const idx = index.sessions.findIndex((s) => s.id === id)

  if (idx === -1) {
    throw new Error(`Agent 会话不存在: ${id}`)
  }

  const existing = normalizeAgentSessionMeta(index.sessions[idx]!)
  // 非手动归档操作时，若会话已归档则自动恢复为活跃（仅更新 stoppedByUser 不触发解归档）
  const isStoppedByUserOnly = Object.keys(updates).every((k) => k === 'stoppedByUser')
  const autoUnarchive = existing.archived && !('archived' in updates) && !isStoppedByUserOnly
  let updated: AgentSessionMeta = {
    ...existing,
    ...updates,
    ...(autoUnarchive ? { archived: false } : {}),
    updatedAt: Date.now(),
  }
  if (
    'sdkSessionId' in updates
    && updates.sdkSessionId === undefined
    && !('runtimeSession' in updates)
    && updated.runtimeKind === 'claude-code'
  ) {
    updated = { ...updated, runtimeSession: undefined }
  }
  updated = normalizeAgentSessionMetaForWrite(updated)

  index.sessions[idx] = updated
  writeIndex(index)

  console.log(`[Agent 会话] 已更新会话: ${updated.title} (${updated.id})`)
  return updated
}

/**
 * 删除会话
 */
export function deleteAgentSession(id: string): void {
  const index = readIndex()
  const idx = index.sessions.findIndex((s) => s.id === id)

  if (idx === -1) {
    console.warn(`[Agent 会话] 会话不存在，跳过删除: ${id}`)
    return
  }

  const removed = index.sessions.splice(idx, 1)[0]!
  writeIndex(index)

  // 删除消息文件
  const filePath = getAgentSessionMessagesPath(id)
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
    } catch (error) {
      console.warn(`[Agent 会话] 删除消息文件失败 (${id}):`, error)
    }
  }

  // 清理 session 工作目录
  if (removed.workspaceId) {
    const ws = getAgentWorkspace(removed.workspaceId)
    if (ws) {
      try {
        const sessionDir = getAgentSessionWorkspacePath(ws.slug, id)
        if (existsSync(sessionDir)) {
          rmSync(sessionDir, { recursive: true, force: true })
          console.log(`[Agent 会话] 已清理 session 工作目录: ${sessionDir}`)
        }
      } catch (error) {
        console.warn(`[Agent 会话] 清理 session 工作目录失败 (${id}):`, error)
      }
    }
  }

  console.log(`[Agent 会话] 已删除会话: ${removed.title} (${removed.id})`)

  // 清理 Nano Banana 生图历史
  clearNanoBananaAgentHistory(id)
}

/**
 * 迁移 Agent 会话到另一个工作区
 *
 * 操作步骤：
 * 1. 验证会话和目标工作区存在
 * 2. 源 == 目标 → no-op
 * 3. 移动会话工作目录到目标工作区
 * 4. 更新元数据（workspaceId + 清空 sdkSessionId）
 * 5. JSONL 消息文件保持原位（全局目录）
 */
export function moveSessionToWorkspace(sessionId: string, targetWorkspaceId: string): AgentSessionMeta {
  const index = readIndex()
  const idx = index.sessions.findIndex((s) => s.id === sessionId)
  if (idx === -1) {
    throw new Error(`Agent 会话不存在: ${sessionId}`)
  }

  const session = normalizeAgentSessionMeta(index.sessions[idx]!)

  // 源 == 目标 → 直接返回
  if (session.workspaceId === targetWorkspaceId) return session

  const targetWs = getAgentWorkspace(targetWorkspaceId)
  if (!targetWs) {
    throw new Error(`目标工作区不存在: ${targetWorkspaceId}`)
  }

  // 移动工作目录（如果源工作区存在）
  if (session.workspaceId) {
    const sourceWs = getAgentWorkspace(session.workspaceId)
    if (sourceWs) {
      const srcDir = join(getAgentWorkspacePath(sourceWs.slug), sessionId)
      if (existsSync(srcDir)) {
        const destDir = join(getAgentWorkspacePath(targetWs.slug), sessionId)
        // 清理已存在的空目标目录，防止 renameSync 抛出 ENOTEMPTY/EEXIST
        if (existsSync(destDir)) {
          try {
            const contents = readdirSync(destDir)
            if (contents.length === 0) {
              rmSync(destDir, { recursive: true })
              console.log(`[Agent 会话] 已清理空目标目录: ${destDir}`)
            } else {
              // 目标目录非空，合并：先移除目标，再移动源
              rmSync(destDir, { recursive: true })
              console.log(`[Agent 会话] 已清理非空目标目录（以源目录为准）: ${destDir}`)
            }
          } catch (cleanupError) {
            console.warn(`[Agent 会话] 清理目标目录失败，跳过目录迁移:`, cleanupError)
          }
        }
        renameSync(srcDir, destDir)
        console.log(`[Agent 会话] 已移动工作目录: ${srcDir} → ${destDir}`)
      }
    }
  }

  // 确保目标工作区下有 session 目录
  getAgentSessionWorkspacePath(targetWs.slug, sessionId)

  // 更新元数据
  const updated: AgentSessionMeta = {
    ...session,
    workspaceId: targetWorkspaceId,
    sdkSessionId: undefined, // SDK 上下文与工作区 cwd 绑定，必须清空
    runtimeSession: undefined,
    updatedAt: Date.now(),
  }
  index.sessions[idx] = updated
  writeIndex(index)

  console.log(`[Agent 会话] 已迁移会话到工作区: ${updated.title} → ${targetWs.name}`)
  return updated
}

/**
 * 迁移 Chat 对话记录到 Agent 会话
 *
 * 读取 Chat 对话的消息，转换为 AgentMessage 格式，
 * 追加到目标 Agent 会话的 JSONL 文件中。
 *
 * 仅迁移 user 和 assistant 角色的消息文本内容，
 * 工具活动、推理、附件等 Chat 特有字段不迁移。
 */
export function migrateChatToAgentSession(conversationId: string, agentSessionId: string): void {
  const chatMessages = getConversationMessages(conversationId)

  if (chatMessages.length === 0) {
    console.log(`[Agent 会话] Chat 对话无消息，跳过迁移 (${conversationId})`)
    return
  }

  let count = 0
  for (const cm of chatMessages) {
    // 仅迁移 user 和 assistant 消息
    if (cm.role !== 'user' && cm.role !== 'assistant') continue
    if (!cm.content.trim()) continue

    const agentMsg: AgentMessage = {
      id: randomUUID(),
      role: cm.role,
      content: cm.content,
      createdAt: cm.createdAt,
      model: cm.role === 'assistant' ? cm.model : undefined,
    }

    appendAgentMessage(agentSessionId, agentMsg)
    count++
  }

  console.log(`[Agent 会话] 已迁移 ${count} 条消息到 Agent 会话 (${conversationId} → ${agentSessionId})`)
}

/**
 * 分叉 Agent 会话（SDK 原生 fork）
 *
 * 直接调用 SDK 的 forkSession() 独立函数完成 JSONL 复制和 UUID 重映射，
 * 新会话立即获得 sdkSessionId，无需延迟到首次发消息。
 *
 * forkSourceDir 记录源会话的工作目录，仅作为元数据参考保留。
 * SDK session JSONL 已在 fork 创建时复制到新会话的 project-hash 目录下，
 * orchestrator 无需在运行时切换 cwd。
 *
 * process.env.CLAUDE_CONFIG_DIR 已在模块加载时设置，无需在此处临时修改。
 *
 * @returns 新创建的会话元数据
 */
export async function forkAgentSession(input: ForkSessionInput): Promise<AgentSessionMeta> {
  const { sessionId, upToMessageUuid } = input

  // 1. 获取源会话元数据
  const sourceMeta = getAgentSessionMeta(sessionId)
  if (!sourceMeta) {
    throw new Error(`源 Agent 会话不存在: ${sessionId}`)
  }

  if (!sourceMeta.sdkSessionId) {
    throw new Error('该会话没有 SDK session，无法分叉')
  }

  // 2. 确定源会话的工作目录（SDK 需要从此目录的项目空间读取 session 文件）
  let sourceDir: string | undefined
  if (sourceMeta.workspaceId) {
    const ws = getAgentWorkspace(sourceMeta.workspaceId)
    if (ws) {
      sourceDir = hasMaterializedAgentRuntime(ws.slug, sessionId)
        ? getMaterializedAgentRuntimeCwd(ws.slug, sessionId)
        : getAgentSessionWorkspacePath(ws.slug, sessionId)
    }
  }

  // 2.5 确定目标消息所属的 SDK session ID
  // 当会话经历过 "session not found" 恢复后，sdkSessionId 会被替换为新的，
  // 但旧消息仍保留在 CodeInsights JSONL 中，其 session_id 指向旧的 SDK session。
  // 这里从 JSONL 中查找目标消息的实际 session_id，确保 fork 调用使用正确的 SDK session。
  let forkSourceSdkSessionId = sourceMeta.sdkSessionId
  if (upToMessageUuid) {
    const allMessages = getAgentSessionSDKMessages(sessionId)
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const m = allMessages[i]!
      if ('uuid' in m && (m as { uuid?: string }).uuid === upToMessageUuid) {
        const msgSessionId = (m as { session_id?: string }).session_id
        if (msgSessionId && msgSessionId !== sourceMeta.sdkSessionId) {
          console.log(`[Agent 会话] fork 目标消息属于旧 SDK session ${msgSessionId}（当前为 ${sourceMeta.sdkSessionId}），使用消息所属 session 进行 fork`)
          forkSourceSdkSessionId = msgSessionId
        }
        break
      }
    }
  }

  // 3. 调用 SDK 原生 forkSession
  // process.env.CLAUDE_CONFIG_DIR 已在模块加载时设置，SDK 会自动读取
  const sdk = await import('@anthropic-ai/claude-agent-sdk')
  let forkResult: Awaited<ReturnType<typeof sdk.forkSession>>
  try {
    forkResult = await sdk.forkSession(forkSourceSdkSessionId, {
      upToMessageId: upToMessageUuid,
      dir: sourceDir,
    })
  } catch (err) {
    // 指定 dir 失败时，让 SDK 自动搜索所有项目目录
    if (sourceDir) {
      console.warn(`[Agent 会话] forkSession 指定 dir 失败，改用全局搜索:`, err)
      forkResult = await sdk.forkSession(forkSourceSdkSessionId, {
        upToMessageId: upToMessageUuid,
      })
    } else {
      throw err
    }
  }

  // 4. 创建 CodeInsights 新会话，立即设置 sdkSessionId
  const forkTitle = `${sourceMeta.title} (fork)`
  const newMeta = createAgentSession(
    forkTitle,
    sourceMeta.channelId,
    sourceMeta.workspaceId,
  )

  const updatedForkMeta = updateAgentSessionMeta(newMeta.id, {
    sdkSessionId: forkResult.sessionId,
    forkSourceDir: sourceDir,
    forkSourceSdkSessionId: forkSourceSdkSessionId,
  })
  // 同步返回值（updateAgentSessionMeta 已写入磁盘，这里让调用方拿到最新值）
  Object.assign(newMeta, updatedForkMeta)

  // 4.5 将 SDK session JSONL 复制到 fork 自己的 project-hash 目录
  // SDK forkSession() 在源 cwd 的 project-hash 下创建 JSONL（如 projects/<hash-of-sourceDir>/<newId>.jsonl），
  // 但 fork 会话的 cwd 是新的 session 目录（不同 project-hash），resume 时 SDK 会找不到。
  // 这里直接将 JSONL 复制到 fork 目标 cwd 的 project-hash 下，让后续每轮 resume 都能直接命中。
  if (sourceDir && sourceMeta.workspaceId) {
    const ws = getAgentWorkspace(sourceMeta.workspaceId)
    if (ws) {
      const destCwd = hasMaterializedAgentRuntime(ws.slug, newMeta.id)
        ? getMaterializedAgentRuntimeCwd(ws.slug, newMeta.id)
        : getAgentSessionWorkspacePath(ws.slug, newMeta.id)
      const sourceJsonl = findSdkSessionJsonl(forkResult.sessionId)
      if (sourceJsonl) {
        // SDK 使用简单的字符替换计算 project-hash：path.replace(/[^a-zA-Z0-9]/g, '-')
        const destProjectHash = destCwd.replace(/[^a-zA-Z0-9]/g, '-')
        const sdkProjectsDir = join(getSdkConfigDir(), 'projects', destProjectHash)
        if (!existsSync(sdkProjectsDir)) mkdirSync(sdkProjectsDir, { recursive: true })
        const destJsonl = join(sdkProjectsDir, `${forkResult.sessionId}.jsonl`)
        try {
          copyFileSync(sourceJsonl, destJsonl)
          console.log(`[Agent 会话] 已将 SDK session JSONL 复制到 fork 目标目录: ${destJsonl}`)
        } catch (err) {
          console.warn(`[Agent 会话] 复制 SDK session JSONL 失败，fork 后首轮可能触发上下文回填:`, err)
        }
      } else {
        console.warn(`[Agent 会话] 未找到 SDK session JSONL (${forkResult.sessionId})，fork 后首轮可能触发上下文回填`)
      }
    }
  }

  // 5. 复制源会话工作区文件到新会话目录（排除 .claude/ 和 .context/，它们会自动创建）
  if (sourceDir && sourceMeta.workspaceId) {
    const ws = getAgentWorkspace(sourceMeta.workspaceId)
    if (ws) {
      const destDir = hasMaterializedAgentRuntime(ws.slug, newMeta.id)
        ? getMaterializedAgentRuntimeCwd(ws.slug, newMeta.id)
        : getAgentSessionWorkspacePath(ws.slug, newMeta.id)
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
      try {
        const entries = readdirSync(sourceDir)
        for (const entry of entries) {
          if (entry === '.claude' || entry === '.context' || entry === '.DS_Store' || entry === '.git') continue
          const srcPath = join(sourceDir, entry)
          const destPath = join(destDir, entry)
          copyTreeWithoutSymlinks(srcPath, destPath)
        }
        const copiedCount = entries.filter(e => e !== '.claude' && e !== '.context' && e !== '.DS_Store' && e !== '.git').length
        console.log(`[Agent 会话] 已复制工作区文件: ${sourceDir} → ${destDir} (${copiedCount} 个条目)`)
      } catch (err) {
        console.warn(`[Agent 会话] 复制工作区文件失败:`, err)
      }
    }
  }

  // 6. 复制截断后的 SDKMessages 到新会话的 JSONL（用于 UI 展示历史）
  const sourceMessages = getAgentSessionSDKMessages(sessionId)
  let messagesToCopy: SDKMessage[]

  if (upToMessageUuid) {
    const cutIndex = sourceMessages.findIndex(
      (m) => 'uuid' in m && (m as { uuid?: string }).uuid === upToMessageUuid,
    )
    messagesToCopy = cutIndex >= 0 ? sourceMessages.slice(0, cutIndex + 1) : sourceMessages
  } else {
    messagesToCopy = sourceMessages
  }

  if (messagesToCopy.length > 0) {
    appendSDKMessages(newMeta.id, messagesToCopy)
  }

  console.log(`[Agent 会话] 分叉会话已创建（SDK 原生 fork）: ${sourceMeta.title} → ${forkTitle} (${messagesToCopy.length} 条消息, sdkSessionId=${forkResult.sessionId})`)
  return newMeta
}

/**
 * 截断 Agent 会话的 SDK 消息到指定 UUID（inclusive）
 *
 * 保留 uuid 匹配消息及之前的所有消息，删除之后的消息。
 * 通过 writeFileSync 全量重写 JSONL 文件。
 *
 * @returns 截断后保留的消息列表
 */
export function truncateSDKMessages(id: string, upToUuidInclusive: string): SDKMessage[] {
  const messages = getAgentSessionSDKMessages(id)
  const cutIndex = messages.findIndex(
    (m) => 'uuid' in m && (m as { uuid?: string }).uuid === upToUuidInclusive,
  )
  if (cutIndex < 0) {
    throw new Error(`[Agent 会话] 截断失败: 未找到 uuid=${upToUuidInclusive}, sessionId=${id}`)
  }
  const kept = messages.slice(0, cutIndex + 1)

  const filePath = getAgentSessionMessagesPath(id)
  const content = kept.map((m) => JSON.stringify(m)).join('\n') + (kept.length > 0 ? '\n' : '')
  writeFileSync(filePath, content, 'utf-8')

  console.log(`[Agent 会话] 消息已截断: sessionId=${id}, 保留 ${kept.length}/${messages.length} 条`)
  return kept
}

/**
 * 从 SDK session JSONL 中查找指定 assistant message 之后最近的 user message UUID
 *
 * SDK session JSONL（~/.codeinsights/sdk-config/projects/...）中的消息都带有 uuid，
 * 但 CodeInsights 自己构造的 user message 没有 uuid。此函数直接读取 SDK 的 JSONL
 * 来解析 rewindFiles 所需的 user message UUID。
 *
 * 对于 fork 会话：CodeInsights JSONL 中的 UUID 来自**源会话**（fork 时直接复制），
 * 而 forked SDK JSONL 中的 UUID 已被重映射。因此 fork 会话需要搜索**源**
 * SDK JSONL 来匹配 assistant UUID。通过 forkSourceSdkSessionId 参数指定。
 *
 * @param sdkSessionId SDK session UUID
 * @param assistantMessageUuid 要回退到的 assistant message UUID
 * @param projectDir SDK 项目目录路径（session 运行时的 cwd）
 * @param forkSourceSdkSessionId 源会话 SDK session ID（fork 会话时传入）
 * @returns user message UUID，找不到时返回 undefined
 */
export function resolveUserUuidFromSDK(
  sdkSessionId: string,
  assistantMessageUuid: string,
  projectDir?: string,
  forkSourceSdkSessionId?: string,
): string | undefined {
  // 优先搜索当前 session JSONL
  let sessionFilePath = findSdkSessionJsonl(sdkSessionId, projectDir)

  // 当前 session JSONL 中未找到 assistant UUID（作为消息 .uuid 字段）时，尝试源会话（fork 场景）
  let usingSourceSession = false
  if (sessionFilePath && forkSourceSdkSessionId) {
    try {
      const lines = readFileSync(sessionFilePath, 'utf-8').split('\n').filter(Boolean)
      const hasUuidAsField = lines.some((line) => {
        try {
          const m = JSON.parse(line)
          return m.uuid === assistantMessageUuid
        } catch { return false }
      })
      if (!hasUuidAsField) {
        // CodeInsights JSONL 中的 UUID 来自源会话，forked JSONL 中已重映射
        const sourceFilePath = findSdkSessionJsonl(forkSourceSdkSessionId, projectDir)
        if (sourceFilePath) {
          console.log(`[Agent 会话] resolveUserUuid: fork 会话 UUID 不匹配（非 .uuid 字段），切换到源会话 ${forkSourceSdkSessionId}`)
          sessionFilePath = sourceFilePath
          usingSourceSession = true
        }
      }
    } catch { /* fall through to main logic */ }
  } else if (!sessionFilePath && forkSourceSdkSessionId) {
    // 当前 session JSONL 完全找不到，直接尝试源会话
    sessionFilePath = findSdkSessionJsonl(forkSourceSdkSessionId, projectDir)
    if (sessionFilePath) {
      usingSourceSession = true
      console.log(`[Agent 会话] resolveUserUuid: 当前 JSONL 未找到，使用源会话 ${forkSourceSdkSessionId}`)
    }
  }

  if (!sessionFilePath) {
    console.warn(`[Agent 会话] 未找到 SDK session JSONL: sdkSessionId=${sdkSessionId}`)
    return undefined
  }

  // 读取并解析 SDK JSONL
  try {
    const lines = readFileSync(sessionFilePath, 'utf-8').split('\n').filter(Boolean)
    const messages = lines.map((l) => JSON.parse(l) as Record<string, unknown>)

    // 找到 assistant message 的位置
    const assistantIdx = messages.findIndex((m) => m.uuid === assistantMessageUuid)
    if (assistantIdx < 0) {
      console.warn(`[Agent 会话] SDK JSONL 中未找到 assistant uuid=${assistantMessageUuid}${usingSourceSession ? ' (源会话)' : ''}`)
      return undefined
    }

    // rewindFiles(userMessageId) 恢复文件到该 user message 发送时的快照状态。
    // 回退到某个 assistant turn = 恢复到"该 turn 完成后"的文件状态
    // = 下一轮用户消息发送时的快照（因为快照记录的是 user 消息发出时的文件状态，
    //   而 assistant turn 完成后到下一条 user 消息之间没有其他文件变化）。
    //
    // 策略：向后找第一条非 tool_result 的 user message。
    // 如果找不到（最后一个 turn），返回 '__LAST_TURN__' 特殊标记 —— 因为当前文件系统
    // 已经是最后一个 turn 完成后的状态，不需要文件回退。

    const isRealUserMessage = (m: Record<string, unknown>): boolean => {
      if (m.type !== 'user' || !m.uuid) return false
      const content = (m.message as { content?: Array<{ type: string }> } | undefined)?.content
      const hasToolResult = Array.isArray(content) && content.some((b) => b.type === 'tool_result')
      return !hasToolResult
    }

    // 向后找下一条真实 user message
    for (let i = assistantIdx + 1; i < messages.length; i++) {
      const m = messages[i]!
      if (isRealUserMessage(m)) {
        console.log(`[Agent 会话] 解析到下一轮 user uuid=${m.uuid} (assistant uuid=${assistantMessageUuid}${usingSourceSession ? ', 源会话' : ''})`)
        return m.uuid as string
      }
    }

    // 最后一个 turn — 当前文件系统已是该 turn 完成后的状态，无需文件回退
    console.log(`[Agent 会话] 最后一个 turn，无需文件回退 (assistant uuid=${assistantMessageUuid})`)
    return '__LAST_TURN__'
  } catch (err) {
    console.warn(`[Agent 会话] 读取 SDK session JSONL 失败:`, err)
    return undefined
  }
}

/**
 * 在 SDK 项目目录中查找指定 session 的 JSONL 文件。
 *
 * @param sdkSessionId SDK session ID
 * @param projectDir 项目目录（可选，优先在此目录的哈希下查找）
 * @returns JSONL 文件路径，找不到返回 undefined
 */
function findSdkSessionJsonl(sdkSessionId: string, _projectDir?: string): string | undefined {
  const sdkConfigDir = getSdkConfigDir()

  // 遍历所有项目目录查找匹配的 session JSONL
  // （SDK 的目录命名规则与 CodeInsights 不完全一致，直接遍历最可靠）
  const projectsDir = join(sdkConfigDir, 'projects')
  if (existsSync(projectsDir)) {
    for (const dir of readdirSync(projectsDir)) {
      const candidate = join(projectsDir, dir, `${sdkSessionId}.jsonl`)
      if (existsSync(candidate)) return candidate
    }
  }

  return undefined
}

/**
 * 直接从 SDK JSONL 的 file-history-snapshot 恢复文件到指定 user message 时的状态。
 *
 * 绕过 SDK 的 rewindFiles API（避免分支加载问题），直接：
 * 1. 读取 SDK JSONL 中的所有 file-history-snapshot
 * 2. 构建目标 user message 时的文件状态表
 * 3. 从 file-history 备份目录恢复文件
 *
 * 对于 fork 出的会话：resolveUserUuidFromSDK 已从源 SDK JSONL 解析出源空间的 user UUID，
 * 因此 userMessageUuid 可能在源 JSONL 中而非 forked JSONL 中。当在当前 JSONL 中找不到
 * 目标 UUID 时，自动 fallback 到源会话的 JSONL 和 file-history 备份。
 *
 * @param sdkSessionId  SDK session ID
 * @param userMessageUuid  目标 user message UUID（恢复到此时的文件状态）
 * @param cwd  会话工作目录（文件的基准路径）
 * @param projectDir  项目目录（可选，用于定位 SDK JSONL）
 * @param forkSourceSdkSessionId  源会话 SDK session ID（可选，fork 会话回退时使用）
 * @param attachedDirectories  附加的外部目录列表（绝对路径，SDK 会将这些目录下的文件以绝对路径记录在 snapshot 中）
 */
export function rewindFilesFromSnapshot(
  sdkSessionId: string,
  userMessageUuid: string,
  cwd: string,
  projectDir?: string,
  forkSourceSdkSessionId?: string,
  attachedDirectories?: string[],
): { canRewind: boolean; error?: string; filesChanged?: string[]; insertions?: number; deletions?: number } {
  const sdkConfigDir = getSdkConfigDir()

  // 1. 查找 SDK session JSONL（优先当前 session，找不到目标 UUID 时 fallback 到源会话）
  let sessionFilePath = findSdkSessionJsonl(sdkSessionId, projectDir)
  let effectiveSdkSessionId = sdkSessionId
  let isForkFallback = false

  // 2. 读取所有消息，构建到目标 user message 为止的文件状态
  try {
    let messages: Record<string, unknown>[] = []
    if (sessionFilePath) {
      const lines = readFileSync(sessionFilePath, 'utf-8').split('\n').filter(Boolean)
      messages = lines.map((l) => JSON.parse(l) as Record<string, unknown>)
    }

    // 找到目标 user message 的位置
    let targetIdx = messages.findIndex((m) => m.uuid === userMessageUuid)

    // Fork 场景：userMessageUuid 来自源会话（resolveUserUuidFromSDK 已做过 fallback），
    // 在 forked JSONL 中找不到 → 直接切换到源会话 JSONL
    if (targetIdx < 0 && forkSourceSdkSessionId) {
      console.log(`[Agent 会话] rewindFilesFromSnapshot: 目标 UUID 在当前 JSONL 中未找到，切换到源会话 ${forkSourceSdkSessionId}`)
      const sourceFilePath = findSdkSessionJsonl(forkSourceSdkSessionId, projectDir)
      if (!sourceFilePath) {
        return { canRewind: false, error: '未找到源会话 SDK session JSONL（fork 回退需要源会话数据）' }
      }
      const sourceLines = readFileSync(sourceFilePath, 'utf-8').split('\n').filter(Boolean)
      messages = sourceLines.map((l) => JSON.parse(l) as Record<string, unknown>)
      targetIdx = messages.findIndex((m) => m.uuid === userMessageUuid)
      effectiveSdkSessionId = forkSourceSdkSessionId
      isForkFallback = true

      if (targetIdx < 0) {
        return { canRewind: false, error: `源会话 SDK JSONL 中也未找到 user message uuid=${userMessageUuid}` }
      }
      console.log(`[Agent 会话] rewindFilesFromSnapshot: 在源会话中找到目标 UUID (idx=${targetIdx})`)
    } else if (targetIdx < 0) {
      return { canRewind: false, error: `SDK JSONL 中未找到 user message uuid=${userMessageUuid}` }
    }

    // 查找目标 user message 对应的 snapshot（isSnapshotUpdate: false 且 messageId 匹配）
    // SDK 的 file-history-snapshot 有两种：
    // - isSnapshotUpdate: false — user message 发出时的完整文件追踪状态
    // - isSnapshotUpdate: true — assistant 工具修改文件前的增量备份
    // 只使用 user message snapshot 来构建目标时刻的文件状态。
    const fileState = new Map<string, string | null>()
    let targetSnapshotFound = false

    for (const m of messages) {
      if (m.type !== 'file-history-snapshot') continue
      if (m.isSnapshotUpdate) continue
      const snapshot = m.snapshot as {
        messageId?: string
        trackedFileBackups?: Record<string, { backupFileName: string | null }>
      } | undefined
      if (snapshot?.messageId === userMessageUuid && snapshot.trackedFileBackups) {
        for (const [filePath, info] of Object.entries(snapshot.trackedFileBackups)) {
          fileState.set(filePath, info.backupFileName)
        }
        targetSnapshotFound = true
      }
    }

    // 同时收集 target snapshot 对应的增量更新（isSnapshotUpdate: true 且 snapshot.messageId 匹配）
    // 这些记录了 target user message 那轮 assistant 操作前的文件备份
    if (targetSnapshotFound) {
      for (const m of messages) {
        if (m.type !== 'file-history-snapshot' || !m.isSnapshotUpdate) continue
        const snapshot = m.snapshot as {
          messageId?: string
          trackedFileBackups?: Record<string, { backupFileName: string | null }>
        } | undefined
        if (snapshot?.messageId === userMessageUuid && snapshot.trackedFileBackups) {
          // 增量更新可能记录了更多被追踪的文件，但不覆盖已有状态
          for (const [filePath, info] of Object.entries(snapshot.trackedFileBackups)) {
            if (!fileState.has(filePath)) {
              fileState.set(filePath, info.backupFileName)
            }
          }
        }
      }
    }

    // 处理 target 之后新创建的文件（它们在 target 时不存在，需要删除）
    for (let i = targetIdx + 1; i < messages.length; i++) {
      const m = messages[i]!
      if (m.type !== 'file-history-snapshot') continue

      const snapshot = m.snapshot as {
        trackedFileBackups?: Record<string, { backupFileName: string | null }>
      } | undefined
      if (!snapshot?.trackedFileBackups) continue

      for (const [filePath, info] of Object.entries(snapshot.trackedFileBackups)) {
        // 如果这个文件在 target 时不存在（没被追踪），且 backupFileName 为 null（新创建的），标记删除
        if (!fileState.has(filePath) && info.backupFileName === null) {
          fileState.set(filePath, null) // null = 文件应该不存在
        }
      }
    }

    if (fileState.size === 0) {
      if (!targetSnapshotFound) {
        console.log(`[Agent 会话] rewindFilesFromSnapshot: 目标消息无文件快照记录`)
        return { canRewind: false, error: '目标消息无文件快照记录（会话可能在启用文件检查点前创建）' }
      }
      console.log(`[Agent 会话] rewindFilesFromSnapshot: 快照存在但无文件变化`)
      return { canRewind: true, filesChanged: [] }
    }

    // 3. 恢复文件（fork 会话使用源会话的 file-history 备份）
    const fileHistoryDir = join(sdkConfigDir, 'file-history', effectiveSdkSessionId)
    const filesChanged: string[] = []

    const resolvedCwd = resolve(cwd)
    // 预计算允许写入的目录列表（cwd + attachedDirectories）
    const allowedDirs = [resolvedCwd, ...(attachedDirectories || []).map((d) => resolve(d))]

    for (const [filePath, backupFileName] of fileState) {
      // SDK 对 cwd 内文件使用相对路径，对 additionalDirectories 内文件使用绝对路径
      const isAbsolute = filePath.startsWith('/')
      const fullPath = isAbsolute ? resolve(filePath) : resolve(cwd, filePath)

      // 路径安全检查：文件必须位于 cwd 或 attachedDirectories 之内
      const isInAllowedDir = allowedDirs.some((dir) => fullPath.startsWith(dir + '/') || fullPath === dir)
      if (!isInAllowedDir) {
        console.warn(`[Agent 会话] rewindFiles: 拒绝路径越界 ${filePath}`)
        continue
      }

      if (backupFileName === null) {
        // 文件在 target 时不存在 → 删除
        if (existsSync(fullPath)) {
          try {
            unlinkSync(fullPath)
            filesChanged.push(filePath)
            console.log(`[Agent 会话] rewindFiles: 删除 ${filePath}`)
          } catch (err) {
            console.warn(`[Agent 会话] rewindFiles: 删除失败 ${filePath}:`, err)
          }
        }
      } else {
        // 文件在 target 时存在 → 用备份恢复
        const backupPath = resolve(fileHistoryDir, backupFileName)
        // backupPath 越界检查
        if (!backupPath.startsWith(resolve(fileHistoryDir) + '/') && backupPath !== resolve(fileHistoryDir)) {
          console.warn(`[Agent 会话] rewindFiles: 拒绝备份路径越界 ${backupFileName}`)
          continue
        }
        if (!existsSync(backupPath)) {
          console.warn(`[Agent 会话] rewindFiles: 备份文件不存在 ${backupPath}`)
          continue
        }
        try {
          const backupContent = readFileSync(backupPath)
          // 确保目录存在
          const dir = dirname(fullPath)
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
          writeFileSync(fullPath, backupContent)
          filesChanged.push(filePath)
          console.log(`[Agent 会话] rewindFiles: 恢复 ${filePath} ← ${backupFileName}${isForkFallback ? ' (from source session)' : ''}`)
        } catch (err) {
          console.warn(`[Agent 会话] rewindFiles: 恢复失败 ${filePath}:`, err)
        }
      }
    }

    console.log(`[Agent 会话] rewindFilesFromSnapshot 完成: ${filesChanged.length} 个文件已恢复${isForkFallback ? ' (fork fallback)' : ''}`)
    return { canRewind: true, filesChanged }
  } catch (err) {
    return { canRewind: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * 自动归档超过指定天数未更新的 Agent 会话
 *
 * 置顶会话不会被归档。
 *
 * @param daysThreshold 天数阈值
 * @returns 本次归档的会话数量
 */
export function autoArchiveAgentSessions(daysThreshold: number): number {
  const index = readIndex()
  const threshold = Date.now() - daysThreshold * 86_400_000
  let count = 0

  for (const session of index.sessions) {
    if (!session.pinned && !session.archived && session.updatedAt < threshold) {
      session.archived = true
      count++
    }
  }

  if (count > 0) {
    writeIndex(index)
    console.log(`[Agent 会话] 自动归档 ${count} 个会话（阈值: ${daysThreshold} 天）`)
  }

  return count
}

function getSearchableAgentRole(parsed: Record<string, unknown>): AgentMessageSearchResult['role'] {
  const message = parsed.message
  const roleCandidate = typeof parsed.role === 'string'
    ? parsed.role
    : typeof message === 'object'
      && message !== null
      && typeof (message as { role?: unknown }).role === 'string'
      ? (message as { role: string }).role
      : 'assistant'

  if (
    roleCandidate === 'user'
    || roleCandidate === 'assistant'
    || roleCandidate === 'status'
    || roleCandidate === 'tool'
  ) {
    return roleCandidate
  }

  return 'assistant'
}

function getSearchableAgentMessageId(parsed: Record<string, unknown>): string {
  if (typeof parsed.id === 'string' && parsed.id) return parsed.id
  if (typeof parsed.uuid === 'string' && parsed.uuid) return parsed.uuid

  const message = parsed.message
  if (
    typeof message === 'object'
    && message !== null
    && typeof (message as { id?: unknown }).id === 'string'
  ) {
    return (message as { id: string }).id
  }

  return ''
}

function getSearchableAgentText(parsed: Record<string, unknown>): string | null {
  if (typeof parsed.content === 'string') {
    return parsed.content
  }

  const message = parsed.message
  if (
    typeof message === 'object'
    && message !== null
    && Array.isArray((message as { content?: unknown }).content)
  ) {
    const content = (message as { content: Array<{ type?: string; text?: string }> }).content
    const text = content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('\n')

    return text || null
  }

  return null
}

/**
 * 搜索 Agent 会话消息内容
 *
 * 遍历所有会话的 JSONL 文件，逐行搜索 content 字段。
 * 每个会话最多返回 1 条最佳匹配，总计最多 30 条结果。
 *
 * @param query 搜索关键词
 * @returns 匹配结果列表
 */
export async function searchAgentSessionMessages(query: string): Promise<AgentMessageSearchResult[]> {
  if (!query || query.length < 2) return []

  const index = readIndex()
  const searchService = getTypeScriptEventSearchService()
  const result = await searchService.searchFirstMatchPerSource<Record<string, unknown>, AgentMessageSearchResult>({
    requestId: `agent-search-${Date.now()}`,
    query,
    limit: 30,
    sources: index.sessions.map((session) => ({
      sourceKind: 'agent_message',
      sourceId: session.id,
      title: session.title,
      filePath: getAgentSessionMessagesPath(session.id),
      updatedAt: session.updatedAt,
      nativeTextExtractor: 'agent_message_search_text',
      getRecordId: getSearchableAgentMessageId,
      getRecordText: getSearchableAgentText,
      toLegacyResult: ({ source, record, snippet }) => ({
        sessionId: source.sourceId,
        sessionTitle: source.title,
        messageId: getSearchableAgentMessageId(record),
        role: getSearchableAgentRole(record),
        archived: session.archived,
        ...snippet,
      }),
    })),
  })

  return result.results
}
