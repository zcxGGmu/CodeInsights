import type {
  NativeRuntimeSearchMatch,
  NativeRuntimeSearchResult,
  NativeRuntimeSearchSourceKind,
} from '@codeinsights/shared'
import { buildSearchSnippet, type SearchSnippetResult } from '../jsonl-search'
import {
  findFirstJsonlEventMatch,
  iterateJsonlEvents,
  throwIfJsonlEventReadAborted,
  type JsonlEventReadIssue,
  type JsonlEventRecord,
} from './jsonl-event-reader'

export interface EventSearchDiagnostics {
  invalidJsonLines: number
  missingFiles: number
  readErrors: number
}

export interface EventSearchSource<TRecord, TResult> {
  sourceKind: NativeRuntimeSearchSourceKind
  sourceId: string
  title: string
  filePath: string
  updatedAt?: number
  workspaceId?: string
  getRecordId: (record: TRecord, event: JsonlEventRecord<TRecord>) => string
  getRecordText: (record: TRecord, event: JsonlEventRecord<TRecord>) => string | null
  getRecordCreatedAt?: (record: TRecord, event: JsonlEventRecord<TRecord>) => number | undefined
  filterRecord?: (record: TRecord, event: JsonlEventRecord<TRecord>) => boolean
  toLegacyResult: (input: EventSearchLegacyResultInput<TRecord>) => TResult
}

export interface EventSearchLegacyResultInput<TRecord> {
  source: EventSearchSource<TRecord, unknown>
  record: TRecord
  event: JsonlEventRecord<TRecord>
  text: string
  snippet: SearchSnippetResult
}

export interface SearchFirstMatchPerSourceInput<TRecord, TResult> {
  requestId: string
  query: string
  limit: number
  sources: Array<EventSearchSource<TRecord, TResult>>
  signal?: AbortSignal
}

export interface SearchFirstMatchPerSourceResult<TResult> {
  results: TResult[]
  searchResult: NativeRuntimeSearchResult
  diagnostics: EventSearchDiagnostics
}

export interface SearchMatchesInSourceInput<TRecord, TResult>
  extends EventSearchSource<TRecord, TResult> {
  requestId: string
  query: string
  offset?: number
  limit: number
  signal?: AbortSignal
}

export interface SearchMatchesInSourceResult<TResult> {
  matches: TResult[]
  total: number
  nextOffset: number
  hasMore: boolean
  searchResult: NativeRuntimeSearchResult
  diagnostics: EventSearchDiagnostics
}

interface EventSearchMatchBundle<TResult> {
  legacyResult: TResult
  nativeMatch: NativeRuntimeSearchMatch
}

function createDiagnostics(): EventSearchDiagnostics {
  return {
    invalidJsonLines: 0,
    missingFiles: 0,
    readErrors: 0,
  }
}

function applyIssue(diagnostics: EventSearchDiagnostics, issue: JsonlEventReadIssue): void {
  if (issue.reason === 'invalid_json') {
    diagnostics.invalidJsonLines += 1
    return
  }
  if (issue.reason === 'missing_file') {
    diagnostics.missingFiles += 1
    return
  }
  diagnostics.readErrors += 1
}

function normalizeLimit(limit: number, max: number): number {
  return Math.min(max, Math.max(1, Math.floor(limit)))
}

function normalizeOffset(offset: number | undefined): number {
  return Math.max(0, Math.floor(offset ?? 0))
}

function createEmptySearchResult(
  requestId: string,
  query: string,
  searchedAt = Date.now(),
): NativeRuntimeSearchResult {
  return {
    requestId,
    query,
    matches: [],
    hasMore: false,
    indexState: 'fallback',
    implementation: 'typescript',
    searchedAt,
  }
}

function buildNativeMatch<TRecord, TResult>(
  source: EventSearchSource<TRecord, TResult>,
  event: JsonlEventRecord<TRecord>,
  record: TRecord,
  text: string,
  snippet: SearchSnippetResult,
): NativeRuntimeSearchMatch {
  const id = source.getRecordId(record, event)
  const updatedAt = source.getRecordCreatedAt?.(record, event) ?? source.updatedAt

  return {
    id,
    sourceKind: source.sourceKind,
    title: source.title,
    snippet: snippet.snippet,
    matchedRanges: [{ start: snippet.matchStart, length: snippet.matchLength }],
    score: 1,
    sessionId: source.sourceId,
    workspaceId: source.workspaceId,
    recordId: id,
    cursor: String(event.lineNumber),
    updatedAt,
  }
}

async function findFirstMatchInSource<TRecord, TResult>(
  source: EventSearchSource<TRecord, TResult>,
  query: string,
  queryLower: string,
  diagnostics: EventSearchDiagnostics,
  signal?: AbortSignal,
): Promise<EventSearchMatchBundle<TResult> | null> {
  return findFirstJsonlEventMatch<TRecord, EventSearchMatchBundle<TResult>>(
    source.filePath,
    async (event) => {
      if (source.filterRecord && !source.filterRecord(event.record, event)) {
        return null
      }

      const text = source.getRecordText(event.record, event)
      if (!text) return null

      const snippet = buildSearchSnippet(text, query, queryLower)
      if (!snippet) return null

      return {
        legacyResult: source.toLegacyResult({
          source: source as EventSearchSource<TRecord, unknown>,
          record: event.record,
          event,
          text,
          snippet,
        }),
        nativeMatch: buildNativeMatch(source, event, event.record, text, snippet),
      }
    },
    {
      signal,
      onIssue: (issue) => applyIssue(diagnostics, issue),
    },
  )
}

export class TypeScriptEventSearchService {
  async searchFirstMatchPerSource<TRecord, TResult>(
    input: SearchFirstMatchPerSourceInput<TRecord, TResult>,
  ): Promise<SearchFirstMatchPerSourceResult<TResult>> {
    throwIfJsonlEventReadAborted(input.signal)

    const query = input.query
    const searchedAt = Date.now()
    const diagnostics = createDiagnostics()
    const result = createEmptySearchResult(input.requestId, input.query, searchedAt)
    const limit = normalizeLimit(input.limit, 100)

    if (query.length === 0) {
      return { results: [], searchResult: result, diagnostics }
    }

    const queryLower = query.toLowerCase()
    const results: TResult[] = []
    const matches: NativeRuntimeSearchMatch[] = []

    for (const source of input.sources) {
      throwIfJsonlEventReadAborted(input.signal)
      if (results.length >= limit) break

      const match = await findFirstMatchInSource(
        source,
        query,
        queryLower,
        diagnostics,
        input.signal,
      )
      if (!match) continue

      results.push(match.legacyResult)
      matches.push(match.nativeMatch)
    }

    return {
      results,
      searchResult: {
        ...result,
        matches,
        hasMore: results.length >= limit && input.sources.length > results.length,
      },
      diagnostics,
    }
  }

  async searchMatchesInSource<TRecord, TResult>(
    input: SearchMatchesInSourceInput<TRecord, TResult>,
  ): Promise<SearchMatchesInSourceResult<TResult>> {
    throwIfJsonlEventReadAborted(input.signal)

    const query = input.query.trim()
    const searchedAt = Date.now()
    const diagnostics = createDiagnostics()
    const result = createEmptySearchResult(input.requestId, input.query, searchedAt)
    const offset = normalizeOffset(input.offset)
    const limit = normalizeLimit(input.limit, 100)

    if (query.length === 0) {
      return {
        matches: [],
        total: 0,
        nextOffset: 0,
        hasMore: false,
        searchResult: result,
        diagnostics,
      }
    }

    const queryLower = query.toLowerCase()
    const matches: TResult[] = []
    const nativeMatches: NativeRuntimeSearchMatch[] = []
    let total = 0

    for await (const event of iterateJsonlEvents<TRecord>(input.filePath, {
      signal: input.signal,
      onIssue: (issue) => applyIssue(diagnostics, issue),
    })) {
      throwIfJsonlEventReadAborted(input.signal)
      if (input.filterRecord && !input.filterRecord(event.record, event)) continue

      const text = input.getRecordText(event.record, event)
      if (!text) continue

      const snippet = buildSearchSnippet(text, query, queryLower)
      if (!snippet) continue

      if (total >= offset && matches.length < limit) {
        matches.push(input.toLegacyResult({
          source: input as EventSearchSource<TRecord, unknown>,
          record: event.record,
          event,
          text,
          snippet,
        }))
        nativeMatches.push(buildNativeMatch(input, event, event.record, text, snippet))
      }

      total += 1
    }

    const nextOffset = offset + matches.length

    return {
      matches,
      total,
      nextOffset,
      hasMore: nextOffset < total,
      searchResult: {
        ...result,
        matches: nativeMatches,
        hasMore: nextOffset < total,
      },
      diagnostics,
    }
  }
}
