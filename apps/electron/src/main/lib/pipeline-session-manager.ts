/**
 * Pipeline 会话管理器
 *
 * 负责 Pipeline 会话的 CRUD 操作和记录持久化。
 */

import { appendFileSync, createReadStream, existsSync, readFileSync, rmSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import type {
  PipelineNodeKind,
  PipelineRecord,
  PipelineRecordSearchStage,
  PipelineRecordsSummaryInput,
  PipelineRecordsSummaryResult,
  PipelineRecordsTailInput,
  PipelineRecordsTailResult,
  PipelineRecordsSearchInput,
  PipelineRecordsSearchMatch,
  PipelineRecordsSearchResult,
  PipelineSessionMeta,
  PipelineSessionRecordsSearchInput,
  PipelineSessionRecordsSearchMatch,
  PipelineSessionRecordsSearchResult,
  PipelineVersion,
} from '@codeinsights/shared'
import {
  applyPipelineRecord,
  buildPipelineSessionStatePatch,
  createInitialPipelineState,
  createPipelineStateFromSessionMeta,
} from '@codeinsights/shared'
import {
  getPipelineSessionRecordsPath,
  getPipelineSessionsDir,
  getPipelineSessionsIndexPath,
} from './config-paths'
import { readJsonFileSafe, writeJsonFileAtomic } from './safe-file'
import {
  getTypeScriptEventSearchService,
  getTypeScriptPipelineTailService,
} from './native-runtime/native-runtime-service'

interface PipelineSessionsIndex {
  version: number
  sessions: PipelineSessionMeta[]
}

const INDEX_VERSION = 1
const SEARCH_FIELD_LIMIT = 4000
const MAX_PIPELINE_QUERY_LENGTH = 500
const MAX_PIPELINE_CURSOR_LENGTH = 8192
const MAX_PIPELINE_TAIL_LIMIT = 500
const MAX_PIPELINE_SEARCH_LIMIT = 100

type PipelineErrorRecord = Extract<PipelineRecord, { type: 'error' }>

const NODE_LABELS: Record<PipelineNodeKind, string> = {
  explorer: '探索',
  planner: '计划',
  developer: '开发',
  reviewer: '审查',
  tester: '测试',
  committer: '提交',
}

function readIndex(): PipelineSessionsIndex {
  return readJsonFileSafe<PipelineSessionsIndex>(getPipelineSessionsIndexPath())
    ?? { version: INDEX_VERSION, sessions: [] }
}

function writeIndex(index: PipelineSessionsIndex): void {
  writeJsonFileAtomic(getPipelineSessionsIndexPath(), index)
}

function assertPipelineVersion(version: PipelineVersion | undefined): void {
  if (version !== undefined && version !== 1 && version !== 2) {
    throw new Error(`无效 Pipeline 版本: ${version}`)
  }
}

function asRuntimeObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`无效 ${label}`)
  }
  return value as Record<string, unknown>
}

function normalizeSessionId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 128) {
    throw new Error('无效 Pipeline 会话')
  }
  return value
}

function requirePipelineSession(sessionIdValue: unknown): PipelineSessionMeta {
  const sessionId = normalizeSessionId(sessionIdValue)
  const session = getPipelineSessionMeta(sessionId)
  if (!session) {
    throw new Error('无效 Pipeline 会话')
  }
  return session
}

function normalizeOptionalFiniteInteger(
  value: unknown,
  label: string,
  max: number,
): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`无效 Pipeline ${label}`)
  }
  return Math.min(max, Math.max(0, Math.floor(value)))
}

function normalizePositiveLimit(
  value: unknown,
  label: string,
  defaultValue: number,
  max: number,
): number {
  if (value === undefined) return defaultValue
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`无效 Pipeline ${label}`)
  }
  return Math.min(max, Math.max(1, Math.floor(value)))
}

function normalizeCursor(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PIPELINE_CURSOR_LENGTH) {
    throw new Error('无效 Pipeline tail cursor')
  }
  return value
}

function normalizeTailDirection(value: unknown): PipelineRecordsTailInput['direction'] {
  if (value === undefined) return undefined
  if (value === 'latest' || value === 'before' || value === 'after') return value
  throw new Error('无效 Pipeline tail direction')
}

function normalizeSearchQuery(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('无效 Pipeline 搜索 query')
  }
  return value.slice(0, MAX_PIPELINE_QUERY_LENGTH)
}

function isPipelineRecordSearchStage(value: unknown): value is PipelineRecordSearchStage {
  return value === 'all'
    || value === 'task'
    || value === 'explorer'
    || value === 'planner'
    || value === 'developer'
    || value === 'reviewer'
    || value === 'tester'
    || value === 'committer'
}

function normalizePipelineRecordsTailInput(input: PipelineRecordsTailInput): PipelineRecordsTailInput {
  const raw = asRuntimeObject(input, 'Pipeline records tail input')
  const session = requirePipelineSession(raw.sessionId)
  return {
    sessionId: session.id,
    afterIndex: normalizeOptionalFiniteInteger(raw.afterIndex, 'tail afterIndex', Number.MAX_SAFE_INTEGER),
    cursor: normalizeCursor(raw.cursor),
    direction: normalizeTailDirection(raw.direction),
    limit: normalizePositiveLimit(raw.limit, 'tail limit', 200, MAX_PIPELINE_TAIL_LIMIT),
  }
}

function normalizePipelineRecordsSearchInput(input: PipelineRecordsSearchInput): PipelineRecordsSearchInput {
  const raw = asRuntimeObject(input, 'Pipeline records search input')
  const session = requirePipelineSession(raw.sessionId)
  const stage = raw.stage === undefined ? 'all' : raw.stage
  if (!isPipelineRecordSearchStage(stage)) {
    throw new Error('无效 Pipeline 搜索 stage')
  }

  return {
    sessionId: session.id,
    query: normalizeSearchQuery(raw.query),
    stage,
    offset: normalizeOptionalFiniteInteger(raw.offset, '搜索 offset', Number.MAX_SAFE_INTEGER),
    limit: normalizePositiveLimit(raw.limit, '搜索 limit', 50, MAX_PIPELINE_SEARCH_LIMIT),
  }
}

function normalizePipelineSessionRecordsSearchInput(
  input: PipelineSessionRecordsSearchInput,
): PipelineSessionRecordsSearchInput {
  const raw = asRuntimeObject(input, 'Pipeline session records search input')
  const includeArchived = raw.includeArchived
  if (includeArchived !== undefined && typeof includeArchived !== 'boolean') {
    throw new Error('无效 Pipeline 搜索 includeArchived')
  }

  return {
    query: normalizeSearchQuery(raw.query),
    limit: normalizePositiveLimit(raw.limit, '搜索 limit', 20, 30),
    includeArchived,
  }
}

function normalizePipelineRecordsSummaryInput(input: PipelineRecordsSummaryInput): PipelineRecordsSummaryInput {
  const raw = asRuntimeObject(input, 'Pipeline records summary input')
  const session = requirePipelineSession(raw.sessionId)
  return { sessionId: session.id }
}

export function listPipelineSessions(): PipelineSessionMeta[] {
  return readIndex().sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getPipelineSessionMeta(id: string): PipelineSessionMeta | undefined {
  return readIndex().sessions.find((session) => session.id === id)
}

export function createPipelineSession(
  title?: string,
  channelId?: string,
  workspaceId?: string,
  version?: PipelineVersion,
): PipelineSessionMeta {
  assertPipelineVersion(version)
  const index = readIndex()
  const now = Date.now()
  const state = createInitialPipelineState(randomUUID(), now, { version })

  const meta: PipelineSessionMeta = {
    id: state.sessionId,
    ...(version ? { version } : {}),
    title: title || '新 Pipeline 会话',
    channelId,
    workspaceId,
    currentNode: state.currentNode,
    status: state.status,
    reviewIteration: state.reviewIteration,
    pendingGate: state.pendingGate,
    createdAt: now,
    updatedAt: now,
  }

  index.sessions.push(meta)
  writeIndex(index)
  getPipelineSessionsDir()
  return meta
}

export function updatePipelineSessionMeta(
  id: string,
  patch: Partial<Omit<PipelineSessionMeta, 'id' | 'createdAt'>>,
): PipelineSessionMeta {
  const index = readIndex()
  const target = index.sessions.find((session) => session.id === id)
  if (!target) {
    throw new Error(`未找到 Pipeline 会话: ${id}`)
  }

  Object.assign(target, patch, { updatedAt: Date.now() })
  writeIndex(index)
  return target
}

export function deletePipelineSession(id: string): void {
  const index = readIndex()
  index.sessions = index.sessions.filter((session) => session.id !== id)
  writeIndex(index)

  const recordsPath = getPipelineSessionRecordsPath(id)
  if (existsSync(recordsPath)) {
    unlinkSync(recordsPath)
  }

  rmSync(getPipelineSessionRecordsPath(id).replace(/\.jsonl$/, ''), {
    recursive: true,
    force: true,
  })
}

export function appendPipelineRecord(
  sessionId: string,
  record: PipelineRecord,
): void {
  const current = requirePipelineSession(sessionId)
  appendFileSync(
    getPipelineSessionRecordsPath(current.id),
    JSON.stringify(record) + '\n',
    'utf-8',
  )

  const nextState = applyPipelineRecord(
    createPipelineStateFromSessionMeta(current),
    record,
  )
  updatePipelineSessionMeta(current.id, buildPipelineSessionStatePatch(nextState))
}

export function getPipelineRecords(sessionId: string): PipelineRecord[] {
  const session = requirePipelineSession(sessionId)
  const filePath = getPipelineSessionRecordsPath(session.id)
  if (!existsSync(filePath)) return []

  const raw = readFileSync(filePath, 'utf-8')
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as PipelineRecord)
}

export function getPipelineRecordsTail(
  input: PipelineRecordsTailInput,
): PipelineRecordsTailResult {
  const safeInput = normalizePipelineRecordsTailInput(input)
  const tailService = getTypeScriptPipelineTailService()
  const recordsPath = getPipelineSessionRecordsPath(safeInput.sessionId)

  if (safeInput.direction || safeInput.cursor) {
    const result = tailService.readTail({
      requestId: `pipeline-tail-${safeInput.sessionId}-${Date.now()}`,
      filePath: recordsPath,
      sessionId: safeInput.sessionId,
      direction: safeInput.direction ?? 'after',
      cursor: safeInput.cursor,
      limit: safeInput.limit,
    })

    return {
      sessionId: safeInput.sessionId,
      records: result.records,
      nextIndex: result.nextIndex,
      hasMore: result.hasMore,
      previousCursor: result.previousCursor,
      nextCursor: result.nextCursor,
      cursorInvalid: result.cursorInvalid,
    }
  }

  const result = tailService.readLegacyAfterIndex({
    requestId: `pipeline-tail-${safeInput.sessionId}-${Date.now()}`,
    filePath: recordsPath,
    sessionId: safeInput.sessionId,
    afterIndex: safeInput.afterIndex,
    limit: safeInput.limit,
  })

  return {
    sessionId: safeInput.sessionId,
    records: result.records,
    nextIndex: result.nextIndex,
    hasMore: result.hasMore,
    previousCursor: result.previousCursor,
    nextCursor: result.nextCursor,
    cursorInvalid: result.cursorInvalid,
  }
}

export function searchPipelineRecords(
  sessionId: string,
  query: string,
): PipelineRecord[] {
  const session = requirePipelineSession(sessionId)
  const normalized = normalizeSearchQuery(query).trim().toLowerCase()
  if (!normalized) return []

  return getPipelineRecords(session.id).filter((record) =>
    JSON.stringify(record).toLowerCase().includes(normalized),
  )
}

export async function getPipelineRecordsSummary(
  input: PipelineRecordsSummaryInput,
): Promise<PipelineRecordsSummaryResult> {
  const safeInput = normalizePipelineRecordsSummaryInput(input)
  let latestUserInput: string | undefined
  let latestErrorRecord: PipelineErrorRecord | undefined

  await forEachPipelineRecord(safeInput.sessionId, (record) => {
    if (record.type === 'user_input') {
      latestUserInput = record.content
      return
    }
    if (record.type === 'error') {
      latestErrorRecord = record
    }
  })

  return {
    sessionId: safeInput.sessionId,
    latestUserInput,
    latestErrorRecord,
  }
}

async function forEachPipelineRecord(
  sessionId: string,
  handleRecord: (record: PipelineRecord) => void | Promise<void>,
): Promise<void> {
  const session = requirePipelineSession(sessionId)
  const filePath = getPipelineSessionRecordsPath(session.id)
  if (!existsSync(filePath)) return

  const lines = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })

  for await (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let record: PipelineRecord
    try {
      record = JSON.parse(trimmed) as PipelineRecord
    } catch {
      // 搜索和索引读取应容忍坏行，避免单条损坏记录阻断整个会话检索。
      continue
    }
    await handleRecord(record)
  }
}

function hasRecordNode(record: PipelineRecord): record is PipelineRecord & { node: PipelineNodeKind } {
  return 'node' in record
}

function getRecordSearchStage(record: PipelineRecord): PipelineRecordSearchStage {
  if (record.type === 'user_input') return 'task'
  if (record.type === 'node_transition') return record.toNode
  if (hasRecordNode(record)) return record.node
  return 'all'
}

function getRecordSearchTab(
  record: PipelineRecord,
  stageArtifactNodes: ReadonlySet<PipelineNodeKind>,
): PipelineRecordsSearchMatch['tab'] {
  if (record.type === 'user_input' || record.type === 'stage_artifact') return 'artifacts'
  if (record.type === 'node_output' || record.type === 'review_result') {
    return stageArtifactNodes.has(record.node) ? 'logs' : 'artifacts'
  }
  return 'logs'
}

function getNodeLabel(node: PipelineNodeKind): string {
  return NODE_LABELS[node]
}

function getRecordSearchTitle(record: PipelineRecord): string {
  switch (record.type) {
    case 'user_input':
      return '任务输入'
    case 'node_transition':
      return `进入${getNodeLabel(record.toNode)}节点`
    case 'node_output':
      return `${getNodeLabel(record.node)}输出`
    case 'stage_artifact':
      return `${getNodeLabel(record.node)}阶段产物`
    case 'review_result':
      return record.approved ? '审查通过' : '审查需要修改'
    case 'gate_requested':
      return `${getNodeLabel(record.node)}等待人工审核`
    case 'gate_decision':
      return `${getNodeLabel(record.node)}审核结果`
    case 'status_change':
      return `状态变更: ${record.status}`
    case 'error':
      return record.node ? `${getNodeLabel(record.node)}执行失败` : 'Pipeline 执行失败'
    default:
      return 'Pipeline 记录'
  }
}

function normalizeSearchText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function boundedSearchField(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.slice(0, SEARCH_FIELD_LIMIT)
}

function getStageArtifactSearchFields(
  artifact: Extract<PipelineRecord, { type: 'stage_artifact' }>['artifact'],
): string[] {
  switch (artifact.node) {
    case 'explorer':
      return [
        artifact.summary,
        boundedSearchField(artifact.content),
        ...artifact.findings,
        ...artifact.keyFiles,
        ...artifact.nextSteps,
      ].filter((field): field is string => Boolean(field))
    case 'planner':
      return [
        artifact.summary,
        boundedSearchField(artifact.content),
        ...artifact.steps,
        ...artifact.risks,
        ...artifact.verification,
      ].filter((field): field is string => Boolean(field))
    case 'developer':
      return [
        artifact.summary,
        boundedSearchField(artifact.content),
        ...artifact.changes,
        ...artifact.tests,
        ...artifact.risks,
      ].filter((field): field is string => Boolean(field))
    case 'reviewer':
      return [
        artifact.summary,
        boundedSearchField(artifact.content),
        artifact.approved ? '审查通过' : '审查需要修改',
        ...artifact.issues,
      ].filter((field): field is string => Boolean(field))
    case 'tester':
      return [
        artifact.summary,
        boundedSearchField(artifact.content),
        ...artifact.commands,
        ...artifact.results,
        ...artifact.blockers,
      ].filter((field): field is string => Boolean(field))
    case 'committer':
      return [
        artifact.summary,
        boundedSearchField(artifact.content),
        artifact.commitMessage,
        artifact.prTitle,
        artifact.prBody,
        artifact.submissionStatus,
        ...artifact.risks,
      ].filter((field): field is string => Boolean(field))
  }
}

function getRecordSearchFields(record: PipelineRecord): string[] {
  switch (record.type) {
    case 'user_input':
      return [record.id, record.type, getRecordSearchTitle(record), record.content]
    case 'node_transition':
      return [
        record.id,
        record.type,
        getRecordSearchTitle(record),
        record.fromNode ? getNodeLabel(record.fromNode) : undefined,
        getNodeLabel(record.toNode),
      ].filter((field): field is string => Boolean(field))
    case 'node_output':
      return [
        record.id,
        record.type,
        getNodeLabel(record.node),
        getRecordSearchTitle(record),
        record.summary,
        boundedSearchField(record.content),
      ].filter((field): field is string => Boolean(field))
    case 'stage_artifact':
      return [
        record.id,
        record.type,
        getNodeLabel(record.node),
        getRecordSearchTitle(record),
        ...getStageArtifactSearchFields(record.artifact),
      ].filter((field): field is string => Boolean(field))
    case 'review_result':
      return [
        record.id,
        record.type,
        getNodeLabel(record.node),
        getRecordSearchTitle(record),
        record.summary,
        ...(record.issues ?? []),
      ]
    case 'gate_requested':
      return [
        record.id,
        record.type,
        getNodeLabel(record.node),
        getRecordSearchTitle(record),
        record.summary,
      ].filter((field): field is string => Boolean(field))
    case 'gate_decision':
      return [
        record.id,
        record.type,
        getNodeLabel(record.node),
        getRecordSearchTitle(record),
        record.action,
        record.feedback,
      ].filter((field): field is string => Boolean(field))
    case 'status_change':
      return [
        record.id,
        record.type,
        getRecordSearchTitle(record),
        record.status,
        record.reason,
      ].filter((field): field is string => Boolean(field))
    case 'error':
      return [
        record.id,
        record.type,
        record.node ? getNodeLabel(record.node) : undefined,
        getRecordSearchTitle(record),
        boundedSearchField(record.error),
      ].filter((field): field is string => Boolean(field))
  }
}

function stringifyRecordForSearch(record: PipelineRecord): string {
  return normalizeSearchText(getRecordSearchFields(record).join('\n'))
}

function buildSearchSnippet(searchText: string, query: string): string {
  const normalizedQuery = query.trim().toLowerCase()
  const lowerText = searchText.toLowerCase()
  const matchIndex = normalizedQuery ? lowerText.indexOf(normalizedQuery) : -1
  const start = matchIndex >= 0 ? Math.max(0, matchIndex - 48) : 0
  const snippet = searchText.slice(start, start + 140)
  const prefix = start > 0 ? '...' : ''
  const suffix = start + 140 < searchText.length ? '...' : ''
  return `${prefix}${snippet}${suffix}`
}

function recordMatchesSearchStage(
  record: PipelineRecord,
  stage: PipelineRecordSearchStage,
): boolean {
  if (stage === 'all') return true
  return getRecordSearchStage(record) === stage
}

function toSearchMatch(
  record: PipelineRecord,
  query: string,
  searchText: string,
  stageArtifactNodes: ReadonlySet<PipelineNodeKind>,
): PipelineRecordsSearchMatch {
  return {
    recordId: record.id,
    recordType: record.type,
    tab: getRecordSearchTab(record, stageArtifactNodes),
    stage: getRecordSearchStage(record),
    title: getRecordSearchTitle(record),
    snippet: buildSearchSnippet(searchText, query),
    createdAt: record.createdAt,
  }
}

function buildPipelineContentSearchMatch(
  meta: PipelineSessionMeta,
  record: PipelineRecord,
  query: string,
  searchText: string,
): PipelineSessionRecordsSearchMatch {
  const snippet = buildSearchSnippet(searchText, query)
  const matchStart = snippet.toLowerCase().indexOf(query.trim().toLowerCase())
  return {
    sessionId: meta.id,
    sessionTitle: meta.title,
    archived: meta.archived,
    recordId: record.id,
    recordType: record.type,
    stage: getRecordSearchStage(record),
    title: getRecordSearchTitle(record),
    snippet,
    matchStart,
    matchLength: matchStart >= 0 ? query.trim().length : 0,
    createdAt: record.createdAt,
  }
}

async function collectStageArtifactNodes(sessionId: string): Promise<Set<PipelineNodeKind>> {
  const stageArtifactNodes = new Set<PipelineNodeKind>()
  await forEachPipelineRecord(sessionId, (record) => {
    if (record.type === 'stage_artifact') {
      stageArtifactNodes.add(record.node)
    }
  })
  return stageArtifactNodes
}

export async function searchPipelineRecordsPage(
  input: PipelineRecordsSearchInput,
): Promise<PipelineRecordsSearchResult> {
  const safeInput = normalizePipelineRecordsSearchInput(input)
  const normalized = safeInput.query.trim().toLowerCase()
  const stage = safeInput.stage ?? 'all'
  const offset = safeInput.offset ?? 0
  const limit = safeInput.limit ?? 50

  if (!normalized) {
    return {
      sessionId: safeInput.sessionId,
      query: safeInput.query,
      matches: [],
      total: 0,
      nextOffset: 0,
      hasMore: false,
    }
  }

  const stageArtifactNodes = await collectStageArtifactNodes(safeInput.sessionId)
  const searchService = getTypeScriptEventSearchService()
  const searchResult = await searchService.searchMatchesInSource<PipelineRecord, PipelineRecordsSearchMatch>({
    requestId: `pipeline-search-${safeInput.sessionId}-${Date.now()}`,
    query: normalized,
    filePath: getPipelineSessionRecordsPath(safeInput.sessionId),
    sourceKind: 'pipeline_record',
    sourceId: safeInput.sessionId,
    title: getPipelineSessionMeta(safeInput.sessionId)?.title ?? 'Pipeline 会话',
    offset,
    limit,
    filterRecord: (record) => recordMatchesSearchStage(record, stage),
    getRecordId: (record) => record.id,
    getRecordText: (record) => stringifyRecordForSearch(record),
    getRecordCreatedAt: (record) => record.createdAt,
    toLegacyResult: ({ record, text }) => toSearchMatch(record, safeInput.query, text, stageArtifactNodes),
  })

  return {
    sessionId: safeInput.sessionId,
    query: safeInput.query,
    matches: searchResult.matches,
    total: searchResult.total,
    nextOffset: searchResult.nextOffset,
    hasMore: searchResult.hasMore,
  }
}

export async function searchPipelineSessionRecords(
  input: PipelineSessionRecordsSearchInput,
): Promise<PipelineSessionRecordsSearchResult> {
  const safeInput = normalizePipelineSessionRecordsSearchInput(input)
  const query = safeInput.query.trim()
  const limit = safeInput.limit ?? 20

  if (query.length < 2) {
    return {
      query: safeInput.query,
      matches: [],
      total: 0,
      hasMore: false,
    }
  }

  const sessions = listPipelineSessions()
    .filter((session) => safeInput.includeArchived || !session.archived)
  const searchService = getTypeScriptEventSearchService()
  const result = await searchService.searchFirstMatchPerSource<PipelineRecord, PipelineSessionRecordsSearchMatch>({
    requestId: `pipeline-global-search-${Date.now()}`,
    query,
    limit,
    sources: sessions.map((session) => ({
      filePath: getPipelineSessionRecordsPath(session.id),
      sourceKind: 'pipeline_record',
      sourceId: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      workspaceId: session.workspaceId,
      getRecordId: (record) => record.id,
      getRecordText: (record) => stringifyRecordForSearch(record),
      getRecordCreatedAt: (record) => record.createdAt,
      toLegacyResult: ({ record, text }) => buildPipelineContentSearchMatch(
        session,
        record,
        query,
        text,
      ),
    })),
  })

  return {
    query: safeInput.query,
    matches: result.results,
    total: result.results.length,
    hasMore: result.searchResult.hasMore,
  }
}
