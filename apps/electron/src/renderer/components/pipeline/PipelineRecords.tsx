import * as React from 'react'
import type {
  PipelineNodeKind,
  PipelineRecord,
  PipelineRecordsSearchMatch as SharedPipelineRecordsSearchMatch,
  PipelineRecordsSearchResult,
  PipelineStageArtifactRecord,
  PipelineVersion,
} from '@codeinsights/shared'
import {
  Archive,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clipboard,
  FileSearch,
  FolderOpen,
  GitCompareArrows,
  Loader2,
  Search,
  SquareTerminal,
} from 'lucide-react'
import { MessageResponse } from '@/components/ai-elements/message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  getPipelineNodeLabel,
  getPipelineNodeOrder,
} from './pipeline-display-model'
import {
  buildPipelineExternalFocusFilter,
  buildPipelineMarkdownReport,
  buildPipelineRecordFocusTarget,
  buildPipelineStageNavigationTarget,
  filterPipelineRecordGroups,
  filterPipelineRecords,
  slicePipelineRecordGroups,
  type PipelineRecordNavigationTarget,
  type PipelineRecordStageFilter,
  type PipelineRecordTab,
} from './pipeline-record-experience-model'
import {
  buildPipelineRecordGroups,
  buildPipelineRecordViewModel,
  type PipelineRecordGroup,
} from './pipeline-record-view-model'
import {
  buildPipelineReviewComparison,
  type PipelineReviewComparisonViewModel,
  type PipelineReviewRoundViewModel,
} from './pipeline-review-comparison-model'

const INITIAL_ARTIFACT_LIMIT = 60
const ARTIFACT_LOAD_STEP = 40
const INITIAL_LOG_LIMIT = 100
const LOG_LOAD_STEP = 100
const SEARCH_PAGE_SIZE = 50

export type PipelineRecordsFocusRequest =
  | { nonce: number; type: 'stage'; node: PipelineNodeKind }
  | { nonce: number; type: 'record'; recordId: string }

function createEmptySearchResult(
  sessionId: string,
  query = '',
): PipelineRecordsSearchResult {
  return {
    sessionId,
    query,
    matches: [],
    total: 0,
    nextOffset: 0,
    hasMore: false,
  }
}

const TONE_CLASS_MAP = {
  neutral: 'border-border-subtle bg-surface-card text-text-primary',
  success: 'border-status-success-border bg-status-success-bg text-text-primary',
  warning: 'border-status-waiting-border bg-status-waiting-bg text-text-primary',
  danger: 'border-status-danger-border bg-status-danger-bg text-text-primary',
  accent: 'border-status-running-border bg-status-running-bg text-text-primary',
} as const

const REVIEW_TONE_CLASS_MAP = {
  success: 'border-status-success-border bg-status-success-bg text-text-primary',
  warning: 'border-status-waiting-border bg-status-waiting-bg text-text-primary',
} as const

const RECORD_ACCENT_CLASS = {
  neutral: 'bg-status-neutral',
  success: 'bg-status-success',
  warning: 'bg-status-waiting',
  danger: 'bg-status-danger',
  accent: 'bg-status-running',
} as const

export interface PipelineStageFilterItem {
  value: PipelineRecordStageFilter
  label: string
}

export function buildPipelineStageFilters(version?: PipelineVersion): PipelineStageFilterItem[] {
  return [
    { value: 'all', label: '全部' },
    { value: 'task', label: '任务' },
    ...getPipelineNodeOrder(version).map((node) => ({
      value: node,
      label: getPipelineNodeLabel(node),
    })),
  ]
}

function buildPipelineStageFilterIndex(
  filters: PipelineStageFilterItem[],
): Partial<Record<PipelineRecordStageFilter, string>> {
  return filters.reduce(
    (accumulator, item, index) => ({
      ...accumulator,
      [item.value]: String(index).padStart(2, '0'),
    }),
    {},
  )
}

export interface PipelineLiveOutputViewModel {
  title: string
  body: string
  hasOutput: boolean
}

export function buildPipelineLiveOutputViewModel(
  node: PipelineNodeKind,
  output: string,
): PipelineLiveOutputViewModel {
  const nodeLabel = getPipelineNodeLabel(node)
  const normalizedOutput = output.trim()
  const hasModelOutput = normalizedOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => !line.startsWith('进度：'))

  if (hasModelOutput) {
    return {
      title: `${nodeLabel}节点正在输出`,
      body: output,
      hasOutput: true,
    }
  }

  return {
    title: `${nodeLabel}节点正在运行`,
    body: normalizedOutput
      ? output
      : [
          `${nodeLabel}节点已启动，正在准备模型与工作区。`,
          '模型执行工具或等待首个响应时可能暂时没有文本输出；这表示节点仍在运行，不代表应用已经卡死。',
        ].join('\n'),
    hasOutput: false,
  }
}

function formatRecordTime(createdAt: number): string {
  return new Date(createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const success = document.execCommand('copy')
    if (!success) {
      throw new Error('复制命令未成功执行')
    }
    return Promise.resolve()
  } finally {
    document.body.removeChild(textarea)
  }
}

function hasLazyArtifactContent(
  record: PipelineRecord,
): record is PipelineStageArtifactRecord & { artifactContentRef: NonNullable<PipelineStageArtifactRecord['artifactContentRef']> } {
  return record.type === 'stage_artifact' && Boolean(record.artifactContentRef)
}

async function hydratePipelineRecordsForReport(records: PipelineRecord[]): Promise<PipelineRecord[]> {
  return Promise.all(records.map(async (record) => {
    if (!hasLazyArtifactContent(record)) return record

    try {
      const content = await window.electronAPI.readPipelineArtifactContent({
        sessionId: record.sessionId,
        ref: record.artifactContentRef,
      })
      return {
        ...record,
        artifact: {
          ...record.artifact,
          content,
        },
      }
    } catch (error) {
      console.warn('[PipelineRecords] 读取 Pipeline 产物正文失败，报告使用预览内容:', error)
      return record
    }
  }))
}

const RecordCard = React.memo(function RecordCard({
  expanded,
  highlighted,
  onRegisterElement,
  onToggleExpanded,
  record,
}: {
  expanded: boolean
  highlighted: boolean
  onRegisterElement: (recordId: string, element: HTMLElement | null) => void
  onToggleExpanded: (recordId: string) => void
  record: PipelineRecord
}): React.ReactElement {
  const viewModel = React.useMemo(() => buildPipelineRecordViewModel(record), [record])
  const toneClass = TONE_CLASS_MAP[viewModel.tone]
  const shouldLazyLoadDetails = hasLazyArtifactContent(record)
  const hasDetails = Boolean(viewModel.details) || shouldLazyLoadDetails
  const artifactFiles = viewModel.artifactFiles ?? []
  const [artifactOpenFailed, setArtifactOpenFailed] = React.useState(false)
  const [lazyDetails, setLazyDetails] = React.useState<string | null>(null)
  const [lazyDetailsLoading, setLazyDetailsLoading] = React.useState(false)
  const [lazyDetailsFailed, setLazyDetailsFailed] = React.useState(false)
  const artifactOpenTimer = React.useRef<number | null>(null)
  const registerElement = React.useCallback((element: HTMLElement | null) => {
    onRegisterElement(record.id, element)
  }, [onRegisterElement, record.id])
  React.useEffect(() => () => {
    if (artifactOpenTimer.current !== null) {
      window.clearTimeout(artifactOpenTimer.current)
    }
  }, [])
  React.useEffect(() => {
    setLazyDetails(null)
    setLazyDetailsLoading(false)
    setLazyDetailsFailed(false)
  }, [record.id])

  const openArtifactsDir = React.useCallback(async (): Promise<void> => {
    try {
      setArtifactOpenFailed(false)
      const opened = await window.electronAPI.openPipelineArtifactsDir(record.sessionId)
      if (!opened) {
        throw new Error('系统未能打开 Pipeline 产物目录')
      }
    } catch (error) {
      console.error('[PipelineRecords] 打开 Pipeline 产物目录失败:', error)
      setArtifactOpenFailed(true)
      if (artifactOpenTimer.current !== null) {
        window.clearTimeout(artifactOpenTimer.current)
      }
      artifactOpenTimer.current = window.setTimeout(() => setArtifactOpenFailed(false), 2200)
    }
  }, [record.sessionId])
  const loadArtifactDetails = React.useCallback(async (): Promise<void> => {
    if (!hasLazyArtifactContent(record) || lazyDetails !== null || lazyDetailsLoading) return

    try {
      setLazyDetailsFailed(false)
      setLazyDetailsLoading(true)
      const content = await window.electronAPI.readPipelineArtifactContent({
        sessionId: record.sessionId,
        ref: record.artifactContentRef,
      })
      setLazyDetails(content)
    } catch (error) {
      console.error('[PipelineRecords] 读取 Pipeline 产物正文失败:', error)
      setLazyDetailsFailed(true)
    } finally {
      setLazyDetailsLoading(false)
    }
  }, [lazyDetails, lazyDetailsLoading, record])
  const toggleDetails = React.useCallback(() => {
    if (!expanded && shouldLazyLoadDetails) {
      void loadArtifactDetails()
    }
    onToggleExpanded(record.id)
  }, [expanded, loadArtifactDetails, onToggleExpanded, record.id, shouldLazyLoadDetails])
  const displayedDetails = lazyDetails ?? viewModel.details ?? ''

  return (
    <article
      id={`pipeline-record-${record.id}`}
      ref={registerElement}
      className={cn(
        'pipeline-record-card relative overflow-hidden rounded-panel border px-4 py-3 pl-5 shadow-card transition-[box-shadow,transform,border-color] duration-normal hover:-translate-y-0.5 hover:shadow-panel',
        toneClass,
        highlighted ? 'pipeline-record-highlight ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
      )}
    >
      <span
        className={cn('absolute left-0 top-0 h-full w-1', RECORD_ACCENT_CLASS[viewModel.tone])}
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-full border border-border-subtle/60 bg-background/75 px-2.5 py-1 text-[11px] font-semibold text-text-primary shadow-sm backdrop-blur">
            {viewModel.badge}
          </span>
          <span className="text-xs font-medium text-text-tertiary">
            {record.type}
          </span>
        </div>
        <div className="font-mono text-[11px] tabular-nums text-text-tertiary">
          {formatRecordTime(record.createdAt)}
        </div>
      </div>

      <div className="mt-2 break-words text-sm font-semibold text-text-primary [overflow-wrap:anywhere]">
        {viewModel.title}
      </div>

      {viewModel.summary ? (
        <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary [overflow-wrap:anywhere]">
          {viewModel.summary}
        </div>
      ) : null}

      {viewModel.bullets?.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-text-secondary">
          {viewModel.bullets.map((item) => (
            <li key={item} className="break-words [overflow-wrap:anywhere]">{item}</li>
          ))}
        </ul>
      ) : null}

      {artifactFiles.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
            已落盘
          </span>
          {artifactFiles.map((file) => (
            <span
              key={file.relativePath}
              className="rounded-full bg-background/80 px-2.5 py-1 font-mono text-[11px] tabular-nums text-text-tertiary"
            >
              {file.displayName}
            </span>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openArtifactsDir}
            className="bg-background/80 hover:bg-background"
          >
            <FolderOpen size={15} />
            {artifactOpenFailed ? '打开失败' : '打开产物目录'}
          </Button>
        </div>
      ) : null}

      {hasDetails ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={toggleDetails}
            className="bg-background/80 hover:bg-background"
          >
            {expanded ? '收起全文' : '展开全文'}
          </Button>
          {expanded ? (
            <MessageResponse className="mt-3 rounded-card bg-background/80 px-4 py-3 text-sm leading-6">
              {lazyDetailsLoading
                ? '正在读取完整产物正文...'
                : lazyDetailsFailed
                  ? displayedDetails || '完整产物正文读取失败，请打开产物目录查看。'
                  : displayedDetails}
            </MessageResponse>
          ) : null}
        </div>
      ) : null}
    </article>
  )
})

function RecordGroupSection({
  expandedRecordIds,
  group,
  highlightedRecordId,
  onRegisterElement,
  onToggleExpanded,
}: {
  expandedRecordIds: Set<string>
  group: PipelineRecordGroup
  highlightedRecordId?: string
  onRegisterElement: (recordId: string, element: HTMLElement | null) => void
  onToggleExpanded: (recordId: string) => void
}): React.ReactElement {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-card border border-border-subtle/50 bg-surface-muted/55 px-3 py-2">
        <h3 className="text-sm font-semibold text-text-primary">{group.title}</h3>
        <span className="rounded-full bg-surface-card px-2 py-0.5 text-xs tabular-nums text-text-secondary">
          {group.records.length}
        </span>
      </div>
      <div className="space-y-2">
        {group.records.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            expanded={expandedRecordIds.has(record.id)}
            highlighted={highlightedRecordId === record.id}
            onRegisterElement={onRegisterElement}
            onToggleExpanded={onToggleExpanded}
          />
        ))}
      </div>
    </section>
  )
}

function LiveOutputPanel({
  node,
  output,
}: {
  node: PipelineNodeKind
  output: string
}): React.ReactElement {
  const viewModel = buildPipelineLiveOutputViewModel(node, output)

  return (
    <section
      aria-live="polite"
      className="pipeline-live-panel pipeline-scan-panel rounded-panel border border-status-running-border bg-status-running-bg px-4 py-3 text-text-primary shadow-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.18em] text-status-running-fg">实时输出</div>
          <h3 className="mt-1 text-sm font-semibold text-text-primary">{viewModel.title}</h3>
        </div>
        <div className="pipeline-status-pulse flex items-center gap-2 rounded-full border border-status-running-border bg-background/70 px-3 py-1 text-xs font-medium text-status-running-fg">
          <Loader2 size={13} className="animate-spin" />
          运行中
        </div>
      </div>
      <div className="mt-3 rounded-card border border-border-subtle/50 bg-background/80 px-3 py-3 font-mono shadow-inner">
        {viewModel.hasOutput ? (
          <MessageResponse className="text-sm">
            {viewModel.body}
          </MessageResponse>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
            {viewModel.body}
          </div>
        )}
      </div>
    </section>
  )
}

function ReviewRoundRow({
  onFocusRecord,
  round,
}: {
  onFocusRecord: (recordId: string) => void
  round: PipelineReviewRoundViewModel
}): React.ReactElement {
  const toneClass = REVIEW_TONE_CLASS_MAP[round.tone]
  const Icon = round.approved ? CircleCheck : CircleAlert

  return (
    <div className={`rounded-card border px-3 py-3 ${toneClass}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon size={16} />
            <span className="text-sm font-semibold">{round.roundLabel}</span>
            <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium">
              {round.statusLabel}
            </span>
            <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium opacity-75">
              {round.modelStatusLabel}
            </span>
            <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium">
              {round.issueCountLabel}
            </span>
          </div>
          <p className="mt-2 break-words text-sm leading-6 opacity-90 [overflow-wrap:anywhere]">{round.summary}</p>
          {round.issues.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 opacity-85">
              {round.issues.slice(0, 3).map((issue) => (
                <li key={issue} className="break-words [overflow-wrap:anywhere]">
                  {issue}
                </li>
              ))}
            </ul>
          ) : null}
          {round.feedback ? (
            <div className="mt-2 break-words rounded-card bg-background/70 px-3 py-2 text-xs leading-5 [overflow-wrap:anywhere]">
              人工反馈：{round.feedback}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {round.decisionLabel ? (
            <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium">
              {round.decisionLabel}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`定位${round.roundLabel}审查记录`}
            onClick={() => onFocusRecord(round.sourceRecordId)}
          >
            定位记录
          </Button>
        </div>
      </div>
    </div>
  )
}

function PipelineReviewComparisonPanel({
  comparison,
  onFocusRecord,
}: {
  comparison: PipelineReviewComparisonViewModel
  onFocusRecord: (recordId: string) => void
}): React.ReactElement {
  const latestToneClass = REVIEW_TONE_CLASS_MAP[comparison.summary.latestTone]

  return (
    <section className="rounded-panel border border-border-subtle bg-surface-card px-4 py-4 shadow-card">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-text-tertiary">
            <GitCompareArrows size={14} />
            REVIEW 对比
          </div>
          <h3 className="mt-1 text-base font-semibold text-text-primary">多轮审查结论</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-1 font-medium ${latestToneClass}`}>
            {comparison.summary.latestStatusLabel}
          </span>
          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-text-secondary">
            共 {comparison.summary.totalRounds} 轮
          </span>
          <span className="rounded-full bg-status-success-bg px-2.5 py-1 font-medium text-status-success-fg">
            通过 {comparison.summary.approvedRounds}
          </span>
          <span className="rounded-full bg-status-waiting-bg px-2.5 py-1 font-medium text-status-waiting-fg">
            修改 {comparison.summary.rejectedRounds}
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {comparison.rounds.map((round) => (
          <ReviewRoundRow
            key={round.sourceRecordId}
            round={round}
            onFocusRecord={onFocusRecord}
          />
        ))}
      </div>
    </section>
  )
}

function EmptyRecordState({
  hasQuery,
  tab,
}: {
  hasQuery: boolean
  tab: PipelineRecordTab
}): React.ReactElement {
  const defaultText = tab === 'artifacts' ? '暂无阶段产物' : '暂无运行日志'
  const title = hasQuery ? '没有匹配记录' : defaultText
  const description = hasQuery
    ? '调整搜索词或切换阶段筛选后再查看。'
    : tab === 'artifacts'
      ? 'Pipeline 完成阶段输出后，结构化产物会在这里归档。'
      : '节点运行事件和系统记录会在这里沉淀为可追溯轨迹。'

  return (
    <div className="pipeline-empty-state rounded-panel border border-dashed border-border-subtle bg-surface-card px-4 py-10 text-center shadow-inner">
      <div className="mx-auto flex size-12 items-center justify-center rounded-card border border-border-subtle bg-background/70 text-status-running-fg shadow-sm">
        <Archive size={22} aria-hidden="true" />
      </div>
      <div className="mt-4 text-sm font-semibold text-text-primary">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  )
}

export function PipelineRecords({
  focusRequest,
  records,
  liveNode,
  liveOutput,
  sessionId,
  sessionTitle,
  showLiveOutput,
  version,
  hasOlderRecords = false,
  loadingOlderRecords = false,
  onLoadOlderRecords,
}: {
  focusRequest?: PipelineRecordsFocusRequest | null
  records: PipelineRecord[]
  liveNode?: PipelineNodeKind
  liveOutput?: string
  sessionId: string
  sessionTitle?: string
  showLiveOutput?: boolean
  version?: PipelineVersion
  hasOlderRecords?: boolean
  loadingOlderRecords?: boolean
  onLoadOlderRecords?: () => Promise<void> | void
}): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<PipelineRecordTab>('artifacts')
  const [stageFilter, setStageFilter] = React.useState<PipelineRecordStageFilter>('all')
  const [query, setQuery] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [searchPageOffset, setSearchPageOffset] = React.useState(0)
  const [searchResult, setSearchResult] = React.useState<PipelineRecordsSearchResult>(() =>
    createEmptySearchResult(sessionId),
  )
  const [artifactLimit, setArtifactLimit] = React.useState(INITIAL_ARTIFACT_LIMIT)
  const [logLimit, setLogLimit] = React.useState(INITIAL_LOG_LIMIT)
  const [expandedRecordIds, setExpandedRecordIds] = React.useState<Set<string>>(new Set())
  const [activeMatchIndex, setActiveMatchIndex] = React.useState(0)
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle')
  const [focusedRecordId, setFocusedRecordId] = React.useState<string | null>(null)
  const recordElements = React.useRef(new Map<string, HTMLElement>())
  const searchLoadSeqRef = React.useRef(0)
  const handledFocusNonceRef = React.useRef(0)
  const normalizedQuery = debouncedQuery.trim()

  const stageFilters = React.useMemo(() => buildPipelineStageFilters(version), [version])
  const stageFilterIndex = React.useMemo(() => buildPipelineStageFilterIndex(stageFilters), [stageFilters])
  const groups = React.useMemo(() => buildPipelineRecordGroups(records, { version }), [records, version])
  const filter = React.useMemo(() => ({
    stage: stageFilter,
    query: debouncedQuery,
  }), [debouncedQuery, stageFilter])
  const filteredArtifacts = React.useMemo(() =>
    filterPipelineRecordGroups(groups.artifacts, filter), [filter, groups.artifacts])
  const filteredLogs = React.useMemo(() =>
    filterPipelineRecords(groups.logs, filter), [filter, groups.logs])
  const visibleArtifacts = React.useMemo(() =>
    slicePipelineRecordGroups(filteredArtifacts, artifactLimit), [artifactLimit, filteredArtifacts])
  const visibleLogs = React.useMemo(() => {
    const startIndex = Math.max(0, filteredLogs.length - logLimit)
    return filteredLogs.slice(startIndex)
  }, [filteredLogs, logLimit])
  const hasMoreLogs = visibleLogs.length < filteredLogs.length
  const reviewComparison = React.useMemo(() =>
    buildPipelineReviewComparison(records), [records])
  const searchMatches: SharedPipelineRecordsSearchMatch[] = searchResult.matches
  const activeMatch = searchMatches[activeMatchIndex]
  const highlightedRecordId = activeMatch?.recordId ?? focusedRecordId

  React.useEffect(() => {
    setActiveTab('artifacts')
    setStageFilter('all')
    setQuery('')
    setDebouncedQuery('')
    setSearchPageOffset(0)
    setSearchResult(createEmptySearchResult(sessionId))
    setArtifactLimit(INITIAL_ARTIFACT_LIMIT)
    setLogLimit(INITIAL_LOG_LIMIT)
    setExpandedRecordIds(new Set())
    setActiveMatchIndex(0)
    setFocusedRecordId(null)
    handledFocusNonceRef.current = 0
    recordElements.current.clear()
  }, [sessionId])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [query])

  React.useEffect(() => {
    setSearchPageOffset(0)
    setActiveMatchIndex(0)
  }, [debouncedQuery, sessionId, stageFilter])

  React.useEffect(() => {
    if (stageFilters.some((item) => item.value === stageFilter)) return
    setStageFilter('all')
  }, [stageFilter, stageFilters])

  React.useEffect(() => {
    const searchId = searchLoadSeqRef.current + 1
    searchLoadSeqRef.current = searchId

    if (!normalizedQuery) {
      setSearchResult(createEmptySearchResult(sessionId, debouncedQuery))
      return
    }

    window.electronAPI.searchPipelineRecords({
      sessionId,
      query: debouncedQuery,
      stage: stageFilter,
      offset: searchPageOffset,
      limit: SEARCH_PAGE_SIZE,
    }).then((result) => {
      if (searchLoadSeqRef.current !== searchId) return
      setSearchResult(result)
    }).catch((error: unknown) => {
      console.error('[PipelineRecords] 搜索 Pipeline 记录失败:', error)
      if (searchLoadSeqRef.current === searchId) {
        setSearchResult(createEmptySearchResult(sessionId, debouncedQuery))
      }
    })
  }, [debouncedQuery, normalizedQuery, searchPageOffset, sessionId, stageFilter])

  React.useEffect(() => {
    setActiveMatchIndex((prev) => {
      if (searchMatches.length === 0) return 0
      return Math.min(prev, searchMatches.length - 1)
    })
  }, [searchMatches.length])

  React.useEffect(() => {
    const recordIds = new Set(records.map((record) => record.id))
    setExpandedRecordIds((prev) => {
      const next = new Set([...prev].filter((id) => recordIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [records])

  const registerRecordElement = React.useCallback((recordId: string, element: HTMLElement | null): void => {
    if (element) {
      recordElements.current.set(recordId, element)
    } else {
      recordElements.current.delete(recordId)
    }
  }, [])

  const toggleExpanded = React.useCallback((recordId: string): void => {
    setExpandedRecordIds((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) {
        next.delete(recordId)
      } else {
        next.add(recordId)
      }
      return next
    })
  }, [])

  const scrollToRecord = React.useCallback((recordId: string): void => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        recordElements.current.get(recordId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      })
    })
  }, [])

  const focusNavigationTarget = React.useCallback((
    target: PipelineRecordNavigationTarget,
    options: { clearQuery?: boolean } = {},
  ): void => {
    setActiveTab(target.tab)
    if (options.clearQuery) {
      const nextFilter = buildPipelineExternalFocusFilter({
        query,
        stage: stageFilter,
        targetStage: target.stage,
      })
      setQuery(nextFilter.query)
      setDebouncedQuery(nextFilter.query)
      setStageFilter(nextFilter.stage)
      setSearchPageOffset(0)
      setSearchResult(createEmptySearchResult(sessionId, nextFilter.query))
      setActiveMatchIndex(0)
    } else {
      setStageFilter(target.stage)
    }
    setFocusedRecordId(target.recordId)
    if (target.tab === 'artifacts') {
      setArtifactLimit(Math.max(records.length, INITIAL_ARTIFACT_LIMIT))
    } else {
      setLogLimit(Math.max(records.length, INITIAL_LOG_LIMIT))
    }
    scrollToRecord(target.recordId)
  }, [query, records.length, scrollToRecord, sessionId, stageFilter])

  React.useEffect(() => {
    if (!focusRequest) return
    if (handledFocusNonceRef.current === focusRequest.nonce) return

    const target = focusRequest.type === 'stage'
      ? buildPipelineStageNavigationTarget(records, focusRequest.node, { version })
      : buildPipelineRecordFocusTarget(records, focusRequest.recordId, { version })

    if (target) {
      handledFocusNonceRef.current = focusRequest.nonce
      focusNavigationTarget(target, { clearQuery: true })
      return
    }

    if (focusRequest.type === 'stage') {
      const nextFilter = buildPipelineExternalFocusFilter({
        query,
        stage: stageFilter,
        targetStage: focusRequest.node,
      })
      setActiveTab('artifacts')
      setQuery(nextFilter.query)
      setDebouncedQuery(nextFilter.query)
      setStageFilter(nextFilter.stage)
      setSearchPageOffset(0)
      setSearchResult(createEmptySearchResult(sessionId, nextFilter.query))
      setActiveMatchIndex(0)
      setFocusedRecordId(null)
    }
  }, [focusNavigationTarget, focusRequest, query, records, sessionId, stageFilter, version])

  const jumpToMatch = React.useCallback((nextIndex: number): void => {
    const match = searchMatches[nextIndex]
    if (!match) return

    setActiveMatchIndex(nextIndex)
    focusNavigationTarget(match)
  }, [focusNavigationTarget, searchMatches])

  const focusReviewRecord = React.useCallback((recordId: string): void => {
    focusNavigationTarget({
      recordId,
      tab: 'artifacts',
      stage: 'reviewer',
    })
  }, [focusNavigationTarget])

  const handleCopyReport = React.useCallback(async (): Promise<void> => {
    try {
      const reportRecords = await hydratePipelineRecordsForReport(records)
      const report = buildPipelineMarkdownReport({
        title: sessionTitle ? `${sessionTitle} - Pipeline 报告` : 'Pipeline 会话报告',
        records: reportRecords,
        generatedAt: Date.now(),
        version,
      })
      await copyTextToClipboard(report)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch (error) {
      console.error('[PipelineRecords] 复制报告失败:', error)
      setCopyStatus('failed')
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    }
  }, [records, sessionTitle, version])

  const handleTabChange = React.useCallback((value: string): void => {
    setActiveTab(value === 'logs' ? 'logs' : 'artifacts')
  }, [])

  const currentVisibleCount = activeTab === 'artifacts'
    ? visibleArtifacts.visibleCount
    : visibleLogs.length
  const currentTotalCount = activeTab === 'artifacts'
    ? visibleArtifacts.totalCount
    : filteredLogs.length
  const showReviewComparison = Boolean(activeTab === 'artifacts'
    && reviewComparison?.shouldShowPanel
    && !normalizedQuery
    && (stageFilter === 'all' || stageFilter === 'reviewer'))
  const hasPreviousSearchPage = searchPageOffset > 0
  const searchResultStart = searchPageOffset + 1
  const searchResultEnd = searchPageOffset + searchMatches.length

  return (
    <section className="space-y-3">
      {showLiveOutput && liveNode ? (
        <LiveOutputPanel node={liveNode} output={liveOutput ?? ''} />
      ) : null}

      <div className="pipeline-records-console pipeline-glow-card flex flex-col gap-4 rounded-panel border border-border-subtle/70 bg-surface-card/92 px-4 py-4 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-card border border-status-running-border/70 bg-status-running-bg text-status-running-fg shadow-[0_0_24px_hsl(var(--status-running)/0.18)]">
              <Boxes size={21} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-[0.18em] text-text-tertiary">任务档案 / 运行轨迹</div>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">产物与运行日志</h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                聚合阶段产物、审核反馈和节点事件，形成可检索的 Pipeline 运行档案。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="pipeline-metric-pill tabular-nums">
              <span className="text-text-tertiary">记录</span>
              <span className="font-semibold text-text-primary">{records.length}</span>
            </span>
            <span className="pipeline-metric-pill tabular-nums">
              <span className="text-text-tertiary">显示</span>
              <span className="font-semibold text-text-primary">{currentVisibleCount}/{currentTotalCount}</span>
            </span>
            {searchResult.total > 0 ? (
              <span className="pipeline-metric-pill border-status-running-border bg-status-running-bg text-status-running-fg tabular-nums">
                <span>命中</span>
                <span className="font-semibold">{searchResult.total}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="pipeline-search-deck grid gap-3 rounded-panel border border-border-subtle/60 bg-background/50 p-3 shadow-inner xl:grid-cols-[minmax(260px,1fr)_auto]">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-status-running-fg"
            />
            <Input
              type="search"
              aria-label="搜索 Pipeline 记录"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索阶段产物、审核反馈或运行日志"
              className="h-11 border-border-subtle/70 bg-surface-card/80 pl-10 text-sm shadow-sm focus-visible:ring-focus"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (searchMatches.length === 0) return
                const nextIndex = activeMatchIndex === 0 ? searchMatches.length - 1 : activeMatchIndex - 1
                jumpToMatch(nextIndex)
              }}
              disabled={searchMatches.length === 0}
              aria-label="跳转到上一个搜索结果"
              className="bg-surface-card/80"
            >
              <ChevronLeft size={15} />
              上一个
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (searchMatches.length === 0) return
                const nextIndex = activeMatchIndex >= searchMatches.length - 1 ? 0 : activeMatchIndex + 1
                jumpToMatch(nextIndex)
              }}
              disabled={searchMatches.length === 0}
              aria-label="跳转到下一个搜索结果"
              className="bg-surface-card/80"
            >
              下一个
              <ChevronRight size={15} />
            </Button>
            {normalizedQuery ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchPageOffset((prev) => Math.max(0, prev - SEARCH_PAGE_SIZE))
                    setActiveMatchIndex(0)
                  }}
                  disabled={!hasPreviousSearchPage}
                  aria-label="加载上一页搜索结果"
                  className="bg-surface-card/80"
                >
                  上页结果
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchPageOffset(searchResult.nextOffset)
                    setActiveMatchIndex(0)
                  }}
                  disabled={!searchResult.hasMore}
                  aria-label="加载下一页搜索结果"
                  className="bg-surface-card/80"
                >
                  下页结果
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyReport}
              className="bg-status-running text-white shadow-[0_0_18px_hsl(var(--status-running)/0.18)] hover:bg-status-running/90"
            >
              {copyStatus === 'copied' ? <Check size={15} /> : <Clipboard size={15} />}
              {copyStatus === 'copied' ? '已复制' : copyStatus === 'failed' ? '复制失败' : '复制报告'}
            </Button>
          </div>
        </div>

        <div className="pipeline-stage-segmented flex flex-wrap gap-1 rounded-panel border border-border-subtle/60 bg-background/35 p-1.5" role="group" aria-label="按阶段筛选记录">
          {stageFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={stageFilter === item.value}
              onClick={() => setStageFilter(item.value)}
              className={cn(
                'inline-flex min-h-9 items-center gap-2 rounded-control border px-3 py-1.5 text-xs font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                stageFilter === item.value
                  ? 'border-status-running-border bg-status-running-bg text-status-running-fg shadow-[0_0_18px_hsl(var(--status-running)/0.16)]'
                  : 'border-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary',
              )}
            >
              <span className="font-mono text-[10px] opacity-70">{stageFilterIndex[item.value]}</span>
              {item.label}
            </button>
          ))}
        </div>

        {activeMatch ? (
          <button
            type="button"
            onClick={() => jumpToMatch(activeMatchIndex)}
            className="rounded-card bg-surface-muted px-3 py-2 text-left text-xs leading-5 text-text-secondary transition-colors hover:bg-surface-muted/80"
          >
            <span className="font-medium text-text-primary">
              {searchPageOffset + activeMatchIndex + 1}/{searchResult.total} · {activeMatch.title}
            </span>
            <span className="ml-2">{activeMatch.snippet}</span>
            {searchResult.total > searchMatches.length ? (
              <span className="ml-2 text-text-tertiary">
                当前页 {searchResultStart}-{searchResultEnd}
              </span>
            ) : null}
          </button>
        ) : normalizedQuery ? (
          <div className="rounded-card bg-surface-muted px-3 py-2 text-xs text-text-secondary">
            未找到匹配内容
          </div>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="pipeline-records-tabs rounded-panel border border-border-subtle/70 bg-surface-card p-3 shadow-card">
        <TabsList className="h-auto rounded-card bg-background/55 p-1 shadow-inner">
          <TabsTrigger value="artifacts" className="gap-2 px-4 py-2 data-[state=active]:bg-status-running-bg data-[state=active]:text-status-running-fg">
            <FileSearch size={15} aria-hidden="true" />
            阶段产物
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 px-4 py-2 data-[state=active]:bg-status-running-bg data-[state=active]:text-status-running-fg">
            <SquareTerminal size={15} aria-hidden="true" />
            运行日志
          </TabsTrigger>
        </TabsList>

        <TabsContent value="artifacts" className="mt-3 space-y-4">
          {activeTab === 'artifacts' ? (
            <>
              {showReviewComparison && reviewComparison ? (
                <PipelineReviewComparisonPanel
                  comparison={reviewComparison}
                  onFocusRecord={focusReviewRecord}
                />
              ) : null}
              {visibleArtifacts.groups.map((group) => (
                <RecordGroupSection
                  key={group.id}
                  group={group}
                  expandedRecordIds={expandedRecordIds}
                  highlightedRecordId={activeTab === 'artifacts' ? highlightedRecordId ?? undefined : undefined}
                  onRegisterElement={registerRecordElement}
                  onToggleExpanded={toggleExpanded}
                />
              ))}
              {visibleArtifacts.groups.length === 0 ? (
                <EmptyRecordState hasQuery={Boolean(normalizedQuery)} tab="artifacts" />
              ) : null}
              {visibleArtifacts.hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setArtifactLimit((prev) => prev + ARTIFACT_LOAD_STEP)}
                >
                  显示更多阶段产物
                </Button>
              ) : hasOlderRecords ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loadingOlderRecords}
                  onClick={() => { void onLoadOlderRecords?.() }}
                >
                  {loadingOlderRecords ? <Loader2 size={15} className="animate-spin" /> : null}
                  加载更早记录
                </Button>
              ) : null}
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="logs" className="mt-3 space-y-2">
          {activeTab === 'logs' ? (
            <>
              {hasMoreLogs ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setLogLimit((prev) => prev + LOG_LOAD_STEP)}
                >
                  加载更早日志
                </Button>
              ) : hasOlderRecords ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loadingOlderRecords}
                  onClick={() => { void onLoadOlderRecords?.() }}
                >
                  {loadingOlderRecords ? <Loader2 size={15} className="animate-spin" /> : null}
                  加载更早记录
                </Button>
              ) : null}
              {visibleLogs.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  expanded={expandedRecordIds.has(record.id)}
                  highlighted={activeTab === 'logs' && highlightedRecordId === record.id}
                  onRegisterElement={registerRecordElement}
                  onToggleExpanded={toggleExpanded}
                />
              ))}
              {visibleLogs.length === 0 ? (
                <EmptyRecordState hasQuery={Boolean(normalizedQuery)} tab="logs" />
              ) : null}
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  )
}
