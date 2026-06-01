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
  PipelineRecordsTailInput,
  PipelineRecordsTailResult,
  PipelineRecordsSearchInput,
  PipelineRecordsSearchMatch,
  PipelineRecordsSearchResult,
  PipelineSessionMeta,
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
import { getTypeScriptEventSearchService } from './native-runtime/native-runtime-service'

interface PipelineSessionsIndex {
  version: number
  sessions: PipelineSessionMeta[]
}

const INDEX_VERSION = 1
const SEARCH_FIELD_LIMIT = 4000

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
  appendFileSync(
    getPipelineSessionRecordsPath(sessionId),
    JSON.stringify(record) + '\n',
    'utf-8',
  )

  const current = getPipelineSessionMeta(sessionId)
  if (!current) return

  const nextState = applyPipelineRecord(
    createPipelineStateFromSessionMeta(current),
    record,
  )
  updatePipelineSessionMeta(sessionId, buildPipelineSessionStatePatch(nextState))
}

export function getPipelineRecords(sessionId: string): PipelineRecord[] {
  const filePath = getPipelineSessionRecordsPath(sessionId)
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
  const records = getPipelineRecords(input.sessionId)
  const afterIndex = Math.min(
    records.length,
    Math.max(0, Math.floor(input.afterIndex ?? 0)),
  )
  const limit = Math.min(
    500,
    Math.max(1, Math.floor(input.limit ?? 200)),
  )
  const nextRecords = records.slice(afterIndex, afterIndex + limit)
  const nextIndex = afterIndex + nextRecords.length

  return {
    sessionId: input.sessionId,
    records: nextRecords,
    nextIndex,
    hasMore: nextIndex < records.length,
  }
}

export function searchPipelineRecords(
  sessionId: string,
  query: string,
): PipelineRecord[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  return getPipelineRecords(sessionId).filter((record) =>
    JSON.stringify(record).toLowerCase().includes(normalized),
  )
}

async function forEachPipelineRecord(
  sessionId: string,
  handleRecord: (record: PipelineRecord) => void | Promise<void>,
): Promise<void> {
  const filePath = getPipelineSessionRecordsPath(sessionId)
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
  const normalized = input.query.trim().toLowerCase()
  const stage = input.stage ?? 'all'
  const offset = Math.max(0, Math.floor(input.offset ?? 0))
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 50)))

  if (!normalized) {
    return {
      sessionId: input.sessionId,
      query: input.query,
      matches: [],
      total: 0,
      nextOffset: 0,
      hasMore: false,
    }
  }

  const stageArtifactNodes = await collectStageArtifactNodes(input.sessionId)
  const searchService = getTypeScriptEventSearchService()
  const searchResult = await searchService.searchMatchesInSource<PipelineRecord, PipelineRecordsSearchMatch>({
    requestId: `pipeline-search-${input.sessionId}-${Date.now()}`,
    query: normalized,
    filePath: getPipelineSessionRecordsPath(input.sessionId),
    sourceKind: 'pipeline_record',
    sourceId: input.sessionId,
    title: getPipelineSessionMeta(input.sessionId)?.title ?? 'Pipeline 会话',
    offset,
    limit,
    filterRecord: (record) => recordMatchesSearchStage(record, stage),
    getRecordId: (record) => record.id,
    getRecordText: (record) => stringifyRecordForSearch(record),
    getRecordCreatedAt: (record) => record.createdAt,
    toLegacyResult: ({ record, text }) => toSearchMatch(record, input.query, text, stageArtifactNodes),
  })

  return {
    sessionId: input.sessionId,
    query: input.query,
    matches: searchResult.matches,
    total: searchResult.total,
    nextOffset: searchResult.nextOffset,
    hasMore: searchResult.hasMore,
  }
}
