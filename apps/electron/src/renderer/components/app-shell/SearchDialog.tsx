/**
 * SearchDialog - 全局搜索 Dialog
 *
 * 浮动搜索面板，支持：
 * - 即时标题匹配（纯前端过滤）
 * - 渐进式消息内容搜索（debounce 后 IPC 调用）
 * - 匹配文字高亮
 * - 键盘导航（上下箭头 + Enter + Esc）
 * - 同时搜索 Pipeline、Chat 和 Agent 模式
 */

import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Search, X, MessageSquare, Bot, Archive, Loader2, GitBranch, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { searchDialogOpenAtom } from '@/atoms/search-atoms'
import { conversationsAtom } from '@/atoms/chat-atoms'
import { pipelineSessionsAtom } from '@/atoms/pipeline-atoms'
import {
  agentSessionsAtom,
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  workspaceAttachedDirectoriesMapAtom,
} from '@/atoms/agent-atoms'
import { activeViewAtom } from '@/atoms/active-view'
import { pipelineRecordFocusIntentAtom } from '@/atoms/pipeline-atoms'
import {
  clearNativeRuntimeSearchRequestAtom,
  nativeRuntimeActiveOperationsAtom,
  nativeRuntimeLastErrorAtom,
  nativeRuntimeStatusAtom,
  setNativeRuntimeSearchRequestAtom,
} from '@/atoms/native-runtime-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import type {
  AgentMessageSearchResult,
  FileIndexEntry,
  MessageSearchResult,
  NativeRuntimeError,
  NativeRuntimeOperationState,
  NativeRuntimeStatus,
  PipelineSessionRecordsSearchMatch,
} from '@codeinsights/shared'

/** 标题搜索结果项 */
interface TitleResult {
  id: string
  title: string
  type: 'pipeline' | 'chat' | 'agent'
  archived?: boolean
  updatedAt: number
}

/** 内容搜索结果项（统一格式） */
export interface SearchDialogContentResult {
  id: string
  title: string
  type: 'pipeline' | 'workspace' | 'chat' | 'agent'
  snippet: string
  matchStart: number
  matchLength: number
  archived?: boolean
  recordId?: string
  recordTitle?: string
  stage?: string
  filePath?: string
  size?: number
  mtimeMs?: number
}

export interface SearchDialogContentGroup {
  type: SearchDialogContentResult['type']
  label: string
  results: SearchDialogContentResult[]
}

export type SearchDialogSourceFilter = 'all' | SearchDialogContentResult['type']

export interface LimitedSearchDialogContentGroup extends SearchDialogContentGroup {
  hiddenCount: number
}

export interface BuildSearchDialogContentResultsInput {
  query: string
  titleIds: ReadonlySet<string>
  chatResults: MessageSearchResult[]
  agentResults: AgentMessageSearchResult[]
  pipelineResults: PipelineSessionRecordsSearchMatch[]
  workspaceResults?: FileIndexEntry[]
}

export interface SearchDialogContentRequestState {
  requestId: number
  latestRequestId: number
  open: boolean
}

function resolveSnippetMatch(snippet: string, query: string): { matchStart: number; matchLength: number } {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return { matchStart: -1, matchLength: 0 }

  const matchStart = snippet.toLowerCase().indexOf(normalizedQuery)
  return {
    matchStart,
    matchLength: matchStart >= 0 ? query.trim().length : 0,
  }
}

export function buildSearchDialogContentResults(
  input: BuildSearchDialogContentResultsInput,
): SearchDialogContentResult[] {
  const pipelineContent: SearchDialogContentResult[] = input.pipelineResults
    .map((result) => {
      const match = resolveSnippetMatch(result.snippet, input.query)
      return {
        id: result.sessionId,
        title: result.sessionTitle,
        type: 'pipeline' as const,
        snippet: result.snippet,
        matchStart: match.matchStart,
        matchLength: match.matchLength,
        archived: result.archived,
        recordId: result.recordId,
        recordTitle: result.title,
        stage: result.stage,
      }
    })

  const workspaceContent: SearchDialogContentResult[] = (input.workspaceResults ?? [])
    .map((result) => {
      const snippet = result.path
      const match = resolveSnippetMatch(`${result.name}\n${snippet}`, input.query)
      return {
        id: result.path,
        title: result.name,
        type: 'workspace' as const,
        snippet,
        matchStart: match.matchStart > result.name.length
          ? match.matchStart - result.name.length - 1
          : resolveSnippetMatch(snippet, input.query).matchStart,
        matchLength: match.matchLength,
        recordId: result.path,
        filePath: result.path,
        size: result.size,
        mtimeMs: result.mtimeMs,
      }
    })

  const chatContent: SearchDialogContentResult[] = input.chatResults
    .filter((result) => !input.titleIds.has(result.conversationId))
    .map((result) => ({
      id: result.conversationId,
      title: result.conversationTitle,
      type: 'chat' as const,
      snippet: result.snippet,
      matchStart: result.matchStart,
      matchLength: result.matchLength,
      archived: result.archived,
      recordId: result.messageId,
    }))

  const agentContent: SearchDialogContentResult[] = input.agentResults
    .filter((result) => !input.titleIds.has(result.sessionId))
    .map((result) => ({
      id: result.sessionId,
      title: result.sessionTitle,
      type: 'agent' as const,
      snippet: result.snippet,
      matchStart: result.matchStart,
      matchLength: result.matchLength,
      archived: result.archived,
      recordId: result.messageId,
    }))

  return [...pipelineContent, ...workspaceContent, ...chatContent, ...agentContent]
}

export function buildSearchDialogContentGroups(
  results: SearchDialogContentResult[],
): SearchDialogContentGroup[] {
  const labels: Record<SearchDialogContentResult['type'], string> = {
    pipeline: 'Pipeline 记录',
    workspace: 'Workspace 文件',
    chat: 'Chat 消息',
    agent: 'Agent 消息',
  }
  const order: Array<SearchDialogContentResult['type']> = ['pipeline', 'workspace', 'chat', 'agent']

  return order
    .map((type) => ({
      type,
      label: labels[type],
      results: results.filter((result) => result.type === type),
    }))
    .filter((group) => group.results.length > 0)
}

export function filterSearchDialogResultsBySource(
  results: SearchDialogContentResult[],
  source: SearchDialogSourceFilter,
): SearchDialogContentResult[] {
  if (source === 'all') return results
  return results.filter((result) => result.type === source)
}

export function limitSearchDialogContentGroups(
  groups: SearchDialogContentGroup[],
  limitPerGroup: number,
): LimitedSearchDialogContentGroup[] {
  return groups.map((group) => {
    const results = group.results.slice(0, limitPerGroup)
    return {
      ...group,
      results,
      hiddenCount: Math.max(0, group.results.length - results.length),
    }
  })
}

export function resolveSearchDialogResultIndex(input: {
  visibleTitleCount: number
  contentGroupOffset: number
  contentResultOffset: number
}): number {
  return input.visibleTitleCount + input.contentGroupOffset + input.contentResultOffset
}

export interface SearchDialogRuntimeStatusModel {
  label: string
  tone: 'indexed' | 'fallback' | 'rebuilding' | 'unavailable' | 'error'
}

export function buildSearchDialogRuntimeStatus(input: {
  status: NativeRuntimeStatus | null
  activeOperations: NativeRuntimeOperationState[]
  lastError: NativeRuntimeError | null
}): SearchDialogRuntimeStatusModel {
  const rebuilding = input.activeOperations.some((operation) => operation.kind === 'index_rebuild')
  if (rebuilding) {
    return { label: '索引重建中', tone: 'rebuilding' }
  }
  if (input.lastError && input.lastError.code !== 'disabled') {
    return { label: '索引状态异常', tone: 'error' }
  }
  if (!input.status) {
    return { label: '索引状态未知', tone: 'unavailable' }
  }
  if (!input.status.nativeEnabled || input.status.implementation === 'typescript') {
    return { label: 'TypeScript fallback', tone: 'fallback' }
  }
  return { label: 'Indexed', tone: 'indexed' }
}

export function shouldApplySearchDialogContentResults(
  state: SearchDialogContentRequestState,
): boolean {
  return state.open && state.requestId === state.latestRequestId
}

/**
 * 高亮文本中的匹配部分
 */
function HighlightText({ text, query }: { text: string; query: string }): React.ReactElement {
  if (!query) return <>{text}</>

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts: React.ReactNode[] = []
  let lastIndex = 0

  let idx = lowerText.indexOf(lowerQuery)
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx))
    }
    parts.push(
      <mark key={idx} className="bg-primary/20 text-foreground rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
    )
    lastIndex = idx + query.length
    idx = lowerText.indexOf(lowerQuery, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <>{parts}</>
}

/**
 * 高亮 snippet 中的匹配部分（使用预计算位置）
 */
function HighlightSnippet({ snippet, matchStart, matchLength }: {
  snippet: string
  matchStart: number
  matchLength: number
}): React.ReactElement {
  if (matchStart < 0 || matchStart >= snippet.length) return <>{snippet}</>

  const before = snippet.slice(0, matchStart)
  const match = snippet.slice(matchStart, matchStart + matchLength)
  const after = snippet.slice(matchStart + matchLength)

  return (
    <>
      {before}
      <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">{match}</mark>
      {after}
    </>
  )
}

export function SearchDialog(): React.ReactElement {
  const [open, setOpen] = useAtom(searchDialogOpenAtom)
  const pipelineSessions = useAtomValue(pipelineSessionsAtom)
  const conversations = useAtomValue(conversationsAtom)
  const agentSessions = useAtomValue(agentSessionsAtom)
  const agentWorkspaces = useAtomValue(agentWorkspacesAtom)
  const currentAgentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaceAttachedDirectoriesMap = useAtomValue(workspaceAttachedDirectoriesMapAtom)
  const nativeRuntimeStatus = useAtomValue(nativeRuntimeStatusAtom)
  const nativeRuntimeActiveOperations = useAtomValue(nativeRuntimeActiveOperationsAtom)
  const nativeRuntimeLastError = useAtomValue(nativeRuntimeLastErrorAtom)
  const setActiveView = useSetAtom(activeViewAtom)
  const setPipelineRecordFocusIntent = useSetAtom(pipelineRecordFocusIntentAtom)
  const setNativeRuntimeSearchRequest = useSetAtom(setNativeRuntimeSearchRequestAtom)
  const clearNativeRuntimeSearchRequest = useSetAtom(clearNativeRuntimeSearchRequestAtom)
  const openSession = useOpenSession()

  const workspaceNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const w of agentWorkspaces) map.set(w.id, w.name)
    return map
  }, [agentWorkspaces])

  const getAgentWorkspaceName = React.useCallback((sessionId: string): string | undefined => {
    const session = agentSessions.find((s) => s.id === sessionId)
    if (!session?.workspaceId) return undefined
    return workspaceNameMap.get(session.workspaceId)
  }, [agentSessions, workspaceNameMap])

  const [query, setQuery] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [contentResults, setContentResults] = React.useState<SearchDialogContentResult[]>([])
  const [contentLoading, setContentLoading] = React.useState(false)
  const [sourceFilter, setSourceFilter] = React.useState<SearchDialogSourceFilter>('all')
  const [contentExpanded, setContentExpanded] = React.useState(false)
  const [workspaceSearchBasePaths, setWorkspaceSearchBasePaths] = React.useState<string[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const isComposingRef = React.useRef(false)
  const commitTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const contentSearchSeqRef = React.useRef(0)
  const pipelineFocusSeqRef = React.useRef(0)
  const currentWorkspace = React.useMemo(
    () => agentWorkspaces.find((workspace) => workspace.id === currentAgentWorkspaceId) ?? null,
    [agentWorkspaces, currentAgentWorkspaceId],
  )
  const runtimeStatusModel = React.useMemo(() => buildSearchDialogRuntimeStatus({
    status: nativeRuntimeStatus,
    activeOperations: nativeRuntimeActiveOperations,
    lastError: nativeRuntimeLastError,
  }), [nativeRuntimeStatus, nativeRuntimeActiveOperations, nativeRuntimeLastError])

  /**
   * 提交搜索词（微 debounce 60ms）
   *
   * 为什么需要这一层：中文输入法下 compositionend 和 onChange 的触发顺序
   * 在 Chrome / Firefox / Safari 之间不一致。微 debounce 保证无论事件顺序如何，
   * 最终都能拿到用户确认后的完整文本，避免逐字输入时搜索结果跳动。
   * 60ms 对人眼不可感知，但足以合并同一次 composition 的所有事件。
   */
  const commitSearchQuery = React.useCallback((value: string) => {
    clearTimeout(commitTimerRef.current)
    commitTimerRef.current = setTimeout(() => setSearchQuery(value), 60)
  }, [])

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (!isComposingRef.current) {
      commitSearchQuery(value)
    }
  }, [commitSearchQuery])

  const handleCompositionStart = React.useCallback(() => {
    isComposingRef.current = true
  }, [])

  const handleCompositionEnd = React.useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false
    // 不直接读 e.currentTarget.value（在部分浏览器中可能拿到中间态），
    // 而是通过 commitSearchQuery 让微 debounce 等 onChange 也触发后再提交
    commitSearchQuery(e.currentTarget.value)
  }, [commitSearchQuery])

  const handleClearQuery = React.useCallback(() => {
    clearTimeout(commitTimerRef.current)
    setQuery('')
    setSearchQuery('')
    setContentResults([])
    setWorkspaceSearchBasePaths([])
    setContentLoading(false)
  }, [])

  // 标题搜索：即时响应，纯内存过滤，基于 searchQuery 避免输入法抖动
  const titleResults = React.useMemo((): TitleResult[] => {
    if (!searchQuery) return []
    const q = searchQuery.toLowerCase()

    const pipelineMatches: TitleResult[] = pipelineSessions
      .filter((s) => s.title.toLowerCase().includes(q))
      .map((s) => ({ id: s.id, title: s.title, type: 'pipeline' as const, archived: s.archived, updatedAt: s.updatedAt }))

    const chatMatches: TitleResult[] = conversations
      .filter((c) => c.title.toLowerCase().includes(q))
      .map((c) => ({ id: c.id, title: c.title, type: 'chat' as const, archived: c.archived, updatedAt: c.updatedAt }))

    const agentMatches: TitleResult[] = agentSessions
      .filter((s) => s.title.toLowerCase().includes(q))
      .map((s) => ({ id: s.id, title: s.title, type: 'agent' as const, archived: s.archived, updatedAt: s.updatedAt }))

    return [...pipelineMatches, ...chatMatches, ...agentMatches]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
  }, [searchQuery, pipelineSessions, conversations, agentSessions])

  // 内容搜索：debounce 300ms 后 IPC 调用，基于 searchQuery
  React.useEffect(() => {
    if (!open || !searchQuery || searchQuery.length < 2) {
      contentSearchSeqRef.current += 1
      setContentResults([])
      setWorkspaceSearchBasePaths([])
      setContentLoading(false)
      setContentExpanded(false)
      return
    }

    const requestId = contentSearchSeqRef.current + 1
    contentSearchSeqRef.current = requestId
    const nativeRequestId = `search-dialog-${requestId}`
    setNativeRuntimeSearchRequest({
      requestId: nativeRequestId,
      query: searchQuery,
      status: 'loading',
      source: 'workspace',
      startedAt: Date.now(),
    })
    setContentLoading(true)
    setContentResults([])
    setContentExpanded(false)

    const timer = setTimeout(async () => {
      try {
        const [chatResults, agentResults, pipelineResult] = await Promise.all([
          window.electronAPI.searchConversationMessages(searchQuery),
          window.electronAPI.searchAgentSessionMessages(searchQuery),
          window.electronAPI.searchPipelineSessionRecords({
            query: searchQuery,
            limit: 20,
          }),
        ])
        const workspaceSearch = currentWorkspace
          ? await (async () => {
            const workspaceFilesPath = await window.electronAPI.getWorkspaceFilesPath(currentWorkspace.slug)
            const configuredDirs = workspaceAttachedDirectoriesMap.get(currentWorkspace.id)
              ?? await window.electronAPI.getWorkspaceDirectories(currentWorkspace.slug)
            const basePaths = [workspaceFilesPath, ...configuredDirs]
            const result = await window.electronAPI.searchWorkspaceFiles(
              workspaceFilesPath,
              searchQuery,
              20,
              configuredDirs.length > 0 ? configuredDirs : undefined,
            )
            return { result, basePaths }
          })().catch((error) => {
            console.error('[搜索] 工作区文件搜索失败:', error)
            return { result: { entries: [], total: 0 }, basePaths: [] }
          })
          : { result: { entries: [], total: 0 }, basePaths: [] }
        if (!shouldApplySearchDialogContentResults({
          requestId,
          latestRequestId: contentSearchSeqRef.current,
          open,
        })) return

        setWorkspaceSearchBasePaths(workspaceSearch.basePaths)
        const titleIds = new Set(titleResults.map((t) => t.id))
        setContentResults(buildSearchDialogContentResults({
          query: searchQuery,
          titleIds,
          chatResults: chatResults as MessageSearchResult[],
          agentResults: agentResults as AgentMessageSearchResult[],
          pipelineResults: pipelineResult.matches,
          workspaceResults: workspaceSearch.result.entries,
        }))
        setNativeRuntimeSearchRequest({
          requestId: nativeRequestId,
          query: searchQuery,
          status: 'success',
          source: 'workspace',
          startedAt: Date.now(),
          completedAt: Date.now(),
        })
      } catch (error) {
        console.error('[搜索] 内容搜索失败:', error)
        if (shouldApplySearchDialogContentResults({
          requestId,
          latestRequestId: contentSearchSeqRef.current,
          open,
        })) {
          setContentResults([])
          setNativeRuntimeSearchRequest({
            requestId: nativeRequestId,
            query: searchQuery,
            status: 'error',
            source: 'workspace',
            startedAt: Date.now(),
            completedAt: Date.now(),
            error: error instanceof Error ? error.message : '搜索失败',
          })
        }
      } finally {
        if (shouldApplySearchDialogContentResults({
          requestId,
          latestRequestId: contentSearchSeqRef.current,
          open,
        })) setContentLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      clearNativeRuntimeSearchRequest(nativeRequestId)
    }
  }, [open, searchQuery, titleResults, currentWorkspace, workspaceAttachedDirectoriesMap, setNativeRuntimeSearchRequest, clearNativeRuntimeSearchRequest])

  const filteredTitleResults = React.useMemo(
    () => sourceFilter === 'all'
      ? titleResults
      : titleResults.filter((result) => result.type === sourceFilter),
    [sourceFilter, titleResults],
  )
  const filteredContentResults = React.useMemo(
    () => filterSearchDialogResultsBySource(contentResults, sourceFilter),
    [contentResults, sourceFilter],
  )
  // 全部结果列表
  const allResults = React.useMemo(
    () => [...filteredTitleResults, ...filteredContentResults.map((c) => ({ ...c, updatedAt: 0 }))],
    [filteredTitleResults, filteredContentResults]
  )
  const contentGroups = React.useMemo(
    () => buildSearchDialogContentGroups(filteredContentResults),
    [filteredContentResults],
  )
  const visibleContentGroups = React.useMemo(
    () => limitSearchDialogContentGroups(contentGroups, contentExpanded ? Number.MAX_SAFE_INTEGER : 6),
    [contentExpanded, contentGroups],
  )
  const hiddenContentCount = React.useMemo(
    () => visibleContentGroups.reduce((sum, group) => sum + group.hiddenCount, 0),
    [visibleContentGroups],
  )

  // 重置选中索引
  React.useEffect(() => {
    setSelectedIndex(0)
    setContentExpanded(false)
  }, [searchQuery, sourceFilter])

  // 导航到对话/会话
  const navigateToResult = React.useCallback((result: TitleResult | SearchDialogContentResult) => {
    setOpen(false)

    if (result.type === 'pipeline') {
      setActiveView('conversations')
      const session = pipelineSessions.find((s) => s.id === result.id)
      const title = session?.title ?? result.title
      if ('recordId' in result && result.recordId) {
        pipelineFocusSeqRef.current += 1
        setPipelineRecordFocusIntent({
          nonce: pipelineFocusSeqRef.current,
          sessionId: result.id,
          recordId: result.recordId,
        })
      }
      openSession('pipeline', result.id, title)
    } else if (result.type === 'workspace') {
      const path = 'filePath' in result && result.filePath ? result.filePath : result.id
      window.electronAPI.previewFile(path, workspaceSearchBasePaths).catch((error) => {
        console.error('[搜索] 打开工作区文件失败:', error)
      })
    } else if (result.type === 'chat') {
      setActiveView('conversations')
      const conv = conversations.find((c) => c.id === result.id)
      const title = conv?.title ?? result.title
      openSession('chat', result.id, title)
    } else {
      setActiveView('conversations')
      const session = agentSessions.find((s) => s.id === result.id)
      const title = session?.title ?? result.title
      openSession('agent', result.id, title)
    }
  }, [setOpen, setActiveView, openSession, pipelineSessions, conversations, agentSessions, setPipelineRecordFocusIntent, workspaceSearchBasePaths])

  // 键盘导航
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      e.preventDefault()
      navigateToResult(allResults[selectedIndex]!)
    }
  }, [allResults, selectedIndex, navigateToResult])

  // 自动滚动选中项到可视区域
  React.useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.querySelector(`[data-index="${selectedIndex}"]`)
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // 全局快捷键 Cmd+F 已迁移到 GlobalShortcuts 组件统一管理

  // 打开时重置状态并聚焦
  React.useEffect(() => {
    if (open) {
      clearTimeout(commitTimerRef.current)
      setQuery('')
      setSearchQuery('')
      setContentResults([])
      setWorkspaceSearchBasePaths([])
      setContentLoading(false)
      setSourceFilter('all')
      setContentExpanded(false)
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        hideClose
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">搜索对话</DialogTitle>
        {/* 搜索输入框 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <Search size={16} className="text-foreground/40 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="搜索对话和会话..."
            className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-foreground/40 outline-none"
          />
          {query && (
            <button
              onClick={handleClearQuery}
              className="p-0.5 rounded text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-foreground/[0.06] text-[11px] text-foreground/40 font-mono">
            ESC
          </kbd>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-2">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {([
              ['all', '全部'],
              ['pipeline', 'Pipeline'],
              ['workspace', 'Workspace'],
              ['chat', 'Chat'],
              ['agent', 'Agent'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSourceFilter(value)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  sourceFilter === value
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/45 hover:bg-foreground/[0.04] hover:text-foreground/70',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className={cn(
            'shrink-0 rounded-md px-2 py-1 text-[11px] font-medium',
            runtimeStatusModel.tone === 'rebuilding' && 'bg-amber-500/10 text-amber-700',
            runtimeStatusModel.tone === 'fallback' && 'bg-sky-500/10 text-sky-700',
            runtimeStatusModel.tone === 'error' && 'bg-destructive/10 text-destructive',
            runtimeStatusModel.tone === 'indexed' && 'bg-emerald-500/10 text-emerald-700',
            runtimeStatusModel.tone === 'unavailable' && 'bg-foreground/[0.06] text-foreground/45',
          )}>
            {runtimeStatusModel.label}
          </span>
        </div>

        {/* 搜索结果 */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {!query && (
            <div className="py-12 text-center text-[13px] text-foreground/40">
              输入关键词搜索对话标题和消息内容
            </div>
          )}

          {searchQuery && filteredTitleResults.length === 0 && filteredContentResults.length === 0 && !contentLoading && (
            <div className="py-12 text-center text-[13px] text-foreground/40">
              未找到匹配结果
            </div>
          )}

          {/* 标题匹配区域 */}
          {filteredTitleResults.length > 0 && (
            <div className="py-1 animate-in fade-in duration-150">
              <div className="px-4 pt-2 pb-1 text-[11px] font-medium text-foreground/40 select-none">
                标题匹配
              </div>
              {filteredTitleResults.map((result, idx) => (
                <button
                  key={`title-${result.id}`}
                  data-index={idx}
                  onClick={() => navigateToResult(result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors',
                    selectedIndex === idx
                      ? 'bg-primary/10'
                      : 'hover:bg-foreground/[0.04]',
                    result.archived && 'opacity-60'
                  )}
                >
                  {result.type === 'pipeline' ? (
                    <GitBranch size={14} className="flex-shrink-0 text-amber-600/70" />
                  ) : result.type === 'chat' ? (
                    <MessageSquare size={14} className="flex-shrink-0 text-foreground/40" />
                  ) : (
                    <Bot size={14} className="flex-shrink-0 text-blue-500/70" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-[13px] text-foreground/80">
                    <HighlightText text={result.title} query={searchQuery} />
                  </span>
                  {result.type === 'agent' && (() => {
                    const wsName = getAgentWorkspaceName(result.id)
                    return wsName ? (
                      <span className="flex-shrink-0 px-1.5 py-0 rounded-full bg-foreground/[0.06] text-[10px] leading-4 text-foreground/40 font-medium truncate max-w-[80px]">
                        {wsName}
                      </span>
                    ) : null
                  })()}
                  {result.archived && (
                    <Archive size={12} className="flex-shrink-0 text-foreground/30" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 内容匹配区域 */}
          {(filteredContentResults.length > 0 || (contentLoading && searchQuery.length >= 2)) && (
            <div className="py-1 border-t border-border/30 animate-in fade-in duration-150">
              <div className="px-4 pt-2 pb-1 flex items-center gap-2 text-[11px] font-medium text-foreground/40 select-none">
                <span>内容匹配</span>
                {contentLoading && <Loader2 size={12} className="animate-spin text-foreground/30" />}
              </div>
              {(() => {
                let contentOffset = 0
                return visibleContentGroups.map((group) => {
                  const groupOffset = contentOffset
                  contentOffset += group.results.length
                  return (
                    <div key={group.type}>
                      <div className="px-4 pb-1 pt-1 text-[10px] font-semibold text-foreground/35">
                        {group.label}
                      </div>
                      {group.results.map((result, i) => {
                        const globalIdx = resolveSearchDialogResultIndex({
                          visibleTitleCount: filteredTitleResults.length,
                          contentGroupOffset: groupOffset,
                          contentResultOffset: i,
                        })
                        return (
                          <button
                            key={`content-${result.type}-${result.id}-${result.recordId ?? 'session'}`}
                            data-index={globalIdx}
                            onClick={() => navigateToResult(result)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={cn(
                              'w-full flex flex-col gap-0.5 px-4 py-2 text-left transition-colors',
                              selectedIndex === globalIdx
                                ? 'bg-primary/10'
                                : 'hover:bg-foreground/[0.04]',
                              result.archived && 'opacity-60'
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              {result.type === 'pipeline' ? (
                                <GitBranch size={14} className="flex-shrink-0 text-amber-600/70" />
                              ) : result.type === 'workspace' ? (
                                <FileText size={14} className="flex-shrink-0 text-emerald-600/70" />
                              ) : result.type === 'chat' ? (
                                <MessageSquare size={14} className="flex-shrink-0 text-foreground/40" />
                              ) : (
                                <Bot size={14} className="flex-shrink-0 text-blue-500/70" />
                              )}
                              <span className="flex-1 min-w-0 truncate text-[13px] text-foreground/80">
                                {result.title}
                              </span>
                              {result.type === 'pipeline' && result.recordTitle ? (
                                <span className="flex-shrink-0 px-1.5 py-0 rounded-full bg-amber-500/10 text-[10px] leading-4 text-amber-700 font-medium truncate max-w-[90px]">
                                  {result.recordTitle}
                                </span>
                              ) : result.type === 'workspace' && result.size != null ? (
                                <span className="flex-shrink-0 px-1.5 py-0 rounded-full bg-emerald-500/10 text-[10px] leading-4 text-emerald-700 font-medium">
                                  {Math.max(1, Math.round(result.size / 1024))}KB
                                </span>
                              ) : null}
                              {result.type === 'agent' && (() => {
                                const wsName = getAgentWorkspaceName(result.id)
                                return wsName ? (
                                  <span className="flex-shrink-0 px-1.5 py-0 rounded-full bg-foreground/[0.06] text-[10px] leading-4 text-foreground/40 font-medium truncate max-w-[80px]">
                                    {wsName}
                                  </span>
                                ) : null
                              })()}
                              {result.archived && (
                                <Archive size={12} className="flex-shrink-0 text-foreground/30" />
                              )}
                            </div>
                            <div className="pl-[22px] text-[12px] text-foreground/50 truncate">
                              <HighlightSnippet
                                snippet={result.snippet}
                                matchStart={result.matchStart}
                                matchLength={result.matchLength}
                              />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              })()}
              {hiddenContentCount > 0 && (
                <button
                  type="button"
                  onClick={() => setContentExpanded(true)}
                  className="mx-4 my-2 w-[calc(100%-2rem)] rounded-md bg-foreground/[0.04] px-3 py-2 text-[12px] font-medium text-foreground/55 hover:bg-foreground/[0.07] hover:text-foreground/75 transition-colors"
                >
                  显示更多结果（{hiddenContentCount}）
                </button>
              )}
            </div>
          )}
        </div>

        {/* 底部快捷键提示 */}
        {allResults.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border/30 text-[11px] text-foreground/30">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] font-mono">↑↓</kbd>
              <span>选择</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] font-mono">↵</kbd>
              <span>打开</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] font-mono">Esc</kbd>
              <span>关闭</span>
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
