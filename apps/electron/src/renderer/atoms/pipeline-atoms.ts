import { atom } from 'jotai'
import type {
  PipelineGateRequest,
  PipelineNodeKind,
  PipelinePreflightAcknowledgement,
  PipelinePreflightResult,
  PipelineSessionMeta,
  PipelineStateSnapshot,
  PipelineStreamErrorPayload,
  PipelineStreamPayload,
} from '@codeinsights/shared'
import type { SessionIndicatorStatus } from './agent-atoms'

export const pipelineSessionsAtom = atom<PipelineSessionMeta[]>([])
export const currentPipelineSessionIdAtom = atom<string | null>(null)
export const pipelineCodexChannelIdAtom = atom<string | null>(null)

export interface PipelineRecordFocusIntent {
  nonce: number
  sessionId: string
  recordId: string
}

export const pipelineRecordFocusIntentAtom = atom<PipelineRecordFocusIntent | null>(null)

export type PipelineSidebarViewMode = 'active' | 'archived'
export const pipelineSidebarViewModeAtom = atom<PipelineSidebarViewMode>('active')

export const currentPipelineSessionAtom = atom<PipelineSessionMeta | null>((get) => {
  const currentId = get(currentPipelineSessionIdAtom)
  if (!currentId) return null
  return get(pipelineSessionsAtom).find((session) => session.id === currentId) ?? null
})

export const pipelineRecordRefreshAtom = atom<Map<string, number>>(new Map())
export const pipelineSessionStateMapAtom = atom<Map<string, PipelineStateSnapshot>>(new Map())
export const pipelinePendingGatesAtom = atom<Map<string, PipelineGateRequest>>(new Map())
export const pipelineStreamErrorsAtom = atom<Map<string, string>>(new Map())
export interface PipelinePreflightState {
  result: PipelinePreflightResult | null
  acknowledgement: PipelinePreflightAcknowledgement | null
  loading: boolean
  error: string | null
  workspaceId?: string
  updatedAt?: number
}

export const pipelinePreflightStateMapAtom = atom<Map<string, PipelinePreflightState>>(new Map())
export type PipelineLiveOutputState = Map<string, Map<PipelineNodeKind, string>>
export const pipelineLiveOutputAtom = atom<PipelineLiveOutputState>(new Map())

const PIPELINE_NODE_LIVE_OUTPUT_LABELS: Record<PipelineNodeKind, string> = {
  explorer: '探索',
  planner: '计划',
  developer: '开发',
  reviewer: '审查',
  tester: '测试',
  committer: '提交',
}

function buildNodeLiveOutputSeed(node: PipelineNodeKind): string {
  const label = PIPELINE_NODE_LIVE_OUTPUT_LABELS[node]
  return [
    `进度：${label}节点已启动，正在准备模型与工作区。`,
    '进度：模型执行工具或等待首个响应时可能暂时没有文本输出。',
  ].join('\n') + '\n'
}

export const pipelineRunningSessionIdsAtom = atom<Set<string>>((get) => {
  const states = get(pipelineSessionStateMapAtom)
  const result = new Set<string>()
  for (const [sessionId, state] of states.entries()) {
    if (state.status === 'running' || state.status === 'waiting_human') {
      result.add(sessionId)
    }
  }
  return result
})

export const pipelineSessionIndicatorMapAtom = atom<Map<string, SessionIndicatorStatus>>((get) => {
  const states = get(pipelineSessionStateMapAtom)
  const map = new Map<string, SessionIndicatorStatus>()

  for (const [sessionId, state] of states.entries()) {
    if (state.status === 'running') {
      map.set(sessionId, 'running')
    } else if (state.status === 'waiting_human') {
      map.set(sessionId, 'blocked')
    } else if (state.status === 'node_failed' || state.status === 'recovery_failed') {
      map.set(sessionId, 'failed')
    } else if (state.status === 'completed') {
      map.set(sessionId, 'completed')
    } else {
      map.set(sessionId, 'idle')
    }
  }

  return map
})

export function upsertPipelineSession(
  sessions: PipelineSessionMeta[],
  next: PipelineSessionMeta,
): PipelineSessionMeta[] {
  const existing = sessions.find((session) => session.id === next.id)
  if (!existing) {
    return [next, ...sessions]
  }

  return sessions
    .map((session) => (session.id === next.id ? { ...session, ...next } : session))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function applyPipelineStreamState(
  prev: PipelineStateSnapshot | undefined,
  payload: PipelineStreamPayload,
): PipelineStateSnapshot | undefined {
  const { event } = payload
  if (!prev && event.type !== 'status_change' && event.type !== 'gate_waiting') {
    return prev
  }

  switch (event.type) {
    case 'status_change':
      return prev
        ? {
            ...prev,
            currentNode: event.currentNode,
            status: event.status,
            pendingGate: event.status === 'waiting_human' ? prev.pendingGate : null,
            updatedAt: event.createdAt,
          }
        : undefined
    case 'gate_waiting':
      return prev
        ? {
            ...prev,
            currentNode: event.request.node,
            status: 'waiting_human',
            reviewIteration: event.request.iteration,
            pendingGate: event.request,
            updatedAt: event.createdAt,
          }
        : {
            sessionId: payload.sessionId,
            currentNode: event.request.node,
            status: 'waiting_human',
            reviewIteration: event.request.iteration,
            pendingGate: event.request,
            updatedAt: event.createdAt,
          }
    case 'gate_resolved':
      return prev
        ? {
            ...prev,
            pendingGate: null,
            status: 'running',
            updatedAt: event.createdAt,
          }
        : prev
    case 'error':
      return prev
        ? {
            ...prev,
            status: 'node_failed',
            updatedAt: event.createdAt,
          }
        : prev
    case 'node_start':
      return prev
        ? {
            ...prev,
            currentNode: event.node,
            status: 'running',
            updatedAt: event.createdAt,
          }
        : prev
    case 'node_complete':
      return prev
        ? {
            ...prev,
            currentNode: event.node,
            stageOutputs: event.artifact
              ? {
                  ...(prev.stageOutputs ?? {}),
                  [event.node]: event.artifact,
                }
              : prev.stageOutputs,
            updatedAt: event.createdAt,
          }
        : prev
    case 'text_delta':
    default:
      return prev
  }
}

export function applyPipelineStreamErrorState(
  prev: PipelineStateSnapshot | undefined,
  payload: PipelineStreamErrorPayload,
  createdAt = Date.now(),
): PipelineStateSnapshot | undefined {
  if (!prev) return prev

  return {
    ...prev,
    sessionId: payload.sessionId,
    status: 'node_failed',
    pendingGate: null,
    updatedAt: createdAt,
  }
}

function isTerminalStatus(status: PipelineStateSnapshot['status']): boolean {
  return status === 'completed'
    || status === 'terminated'
}

function updateLiveNode(
  prev: PipelineLiveOutputState,
  sessionId: string,
  node: PipelineNodeKind,
  nextValue: string | null,
): PipelineLiveOutputState {
  const next = new Map(prev)
  const sessionOutput = new Map(next.get(sessionId) ?? new Map<PipelineNodeKind, string>())

  if (nextValue === null) {
    sessionOutput.delete(node)
  } else {
    sessionOutput.set(node, nextValue)
  }

  if (sessionOutput.size === 0) {
    next.delete(sessionId)
  } else {
    next.set(sessionId, sessionOutput)
  }

  return next
}

export function applyPipelineLiveOutput(
  prev: PipelineLiveOutputState,
  payload: PipelineStreamPayload,
): PipelineLiveOutputState {
  const { event, sessionId } = payload

  switch (event.type) {
    case 'node_start':
      return updateLiveNode(prev, sessionId, event.node, buildNodeLiveOutputSeed(event.node))
    case 'text_delta': {
      const current = prev.get(sessionId)?.get(event.node) ?? ''
      return updateLiveNode(prev, sessionId, event.node, current + event.delta)
    }
    case 'node_complete':
      return updateLiveNode(prev, sessionId, event.node, null)
    case 'gate_waiting':
      return updateLiveNode(prev, sessionId, event.request.node, null)
    case 'status_change':
      if (!isTerminalStatus(event.status)) return prev
      if (!prev.has(sessionId)) return prev
      {
        const next = new Map(prev)
        next.delete(sessionId)
        return next
      }
    default:
      return prev
  }
}

export function getPipelineLiveOutput(
  state: PipelineLiveOutputState,
  sessionId: string,
  node: PipelineNodeKind,
): string {
  return state.get(sessionId)?.get(node) ?? ''
}

export function hasPipelineLiveOutputNode(
  state: PipelineLiveOutputState,
  sessionId: string,
  node: PipelineNodeKind,
): boolean {
  return state.get(sessionId)?.has(node) ?? false
}

export function clearPipelineLiveOutputForSession(
  state: PipelineLiveOutputState,
  sessionId: string,
): PipelineLiveOutputState {
  if (!state.has(sessionId)) return state
  const next = new Map(state)
  next.delete(sessionId)
  return next
}
