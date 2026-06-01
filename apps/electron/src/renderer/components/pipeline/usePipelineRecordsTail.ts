import * as React from 'react'
import { useAtomValue } from 'jotai'
import type { PipelineNodeKind, PipelineRecord, PipelineRecordsSummaryResult } from '@codeinsights/shared'
import { pipelineRecordFocusIntentAtom } from '@/atoms/pipeline-atoms'
import type { PipelineRecordsFocusRequest } from './PipelineRecords'
import {
  mergePipelineRecordsTail,
  prependPipelineRecordsTail,
  resetPipelineRecordsTailLoadState,
  shouldApplyPipelineRecordsOlderLoad,
  shouldApplyPipelineRecordsTailLoad,
} from './pipeline-record-tail-model'

type PipelineErrorRecord = Extract<PipelineRecord, { type: 'error' }>

export interface UsePipelineRecordsTailResult {
  records: PipelineRecord[]
  recordsFocusRequest: PipelineRecordsFocusRequest | null
  latestUserInput?: string
  latestErrorRecord?: PipelineErrorRecord
  hasOlderRecords: boolean
  loadingOlderRecords: boolean
  loadOlderRecords: (options?: { untilRecordId?: string }) => Promise<void>
  requestStageFocus: (node: PipelineNodeKind) => void
  requestRecordFocus: (recordId: string) => void
}

function deriveRecordsSummary(records: PipelineRecord[]): {
  latestUserInput?: string
  latestErrorRecord?: PipelineErrorRecord
} {
  let latestUserInput: string | undefined
  let latestErrorRecord: PipelineErrorRecord | undefined

  for (const record of records) {
    if (record.type === 'user_input') {
      latestUserInput = record.content
    } else if (record.type === 'error') {
      latestErrorRecord = record
    }
  }

  return { latestUserInput, latestErrorRecord }
}

export function usePipelineRecordsTail(
  sessionId: string,
  refreshVersion: number,
): UsePipelineRecordsTailResult {
  const focusIntent = useAtomValue(pipelineRecordFocusIntentAtom)
  const [records, setRecords] = React.useState<PipelineRecord[]>([])
  const [recordsFocusRequest, setRecordsFocusRequest] = React.useState<PipelineRecordsFocusRequest | null>(null)
  const [recordsSummary, setRecordsSummary] = React.useState<PipelineRecordsSummaryResult | null>(null)
  const [hasOlderRecords, setHasOlderRecords] = React.useState(false)
  const [loadingOlderRecords, setLoadingOlderRecords] = React.useState(false)
  const recordsCursorRef = React.useRef(0)
  const olderCursorRef = React.useRef<string | null>(null)
  const latestCursorRef = React.useRef<string | null>(null)
  const recordsLoadSeqRef = React.useRef(0)
  const olderLoadSeqRef = React.useRef(0)
  const summaryLoadSeqRef = React.useRef(0)
  const recordsFocusSeqRef = React.useRef(0)
  const handledFocusIntentNonceRef = React.useRef(0)
  const recordsRef = React.useRef<PipelineRecord[]>([])
  const sessionIdRef = React.useRef(sessionId)

  React.useEffect(() => {
    recordsRef.current = records
  }, [records])

  React.useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  React.useEffect(() => {
    const reset = resetPipelineRecordsTailLoadState({
      cursor: recordsCursorRef.current,
      latestLoadId: recordsLoadSeqRef.current,
    })
    recordsCursorRef.current = reset.cursor
    olderCursorRef.current = null
    latestCursorRef.current = null
    recordsLoadSeqRef.current = reset.latestLoadId
    olderLoadSeqRef.current += 1
    setRecords([])
    setRecordsSummary(null)
    setHasOlderRecords(false)
    setLoadingOlderRecords(false)
  }, [sessionId])

  React.useEffect(() => {
    let cancelled = false
    const loadId = summaryLoadSeqRef.current + 1
    summaryLoadSeqRef.current = loadId

    window.electronAPI.getPipelineRecordsSummary({ sessionId }).then((summary) => {
      if (cancelled || summaryLoadSeqRef.current !== loadId) return
      setRecordsSummary(summary)
    }).catch((error) => {
      console.error('[PipelineRecordsTail] 读取 Pipeline 记录摘要失败:', error)
      if (!cancelled && summaryLoadSeqRef.current === loadId) {
        setRecordsSummary(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [sessionId, refreshVersion])

  React.useEffect(() => {
    let cancelled = false

    async function loadRecordsTail(): Promise<void> {
      const loadId = recordsLoadSeqRef.current + 1
      recordsLoadSeqRef.current = loadId
      const afterIndex = recordsCursorRef.current
      const hasCursor = Boolean(latestCursorRef.current)
      const result = await window.electronAPI.getPipelineRecordsTail(hasCursor
        ? {
            sessionId,
            direction: 'after',
            cursor: latestCursorRef.current ?? undefined,
            limit: 300,
          }
        : {
            sessionId,
            direction: 'latest',
            limit: 300,
          })
      const recordsBatch = [...result.records]

      if (cancelled) return
      if (!shouldApplyPipelineRecordsTailLoad({
        loadId,
        latestLoadId: recordsLoadSeqRef.current,
        afterIndex,
        currentCursor: recordsCursorRef.current,
      })) {
        return
      }

      if (result.nextCursor) {
        latestCursorRef.current = result.nextCursor
      }
      if (!hasCursor && result.previousCursor) {
        olderCursorRef.current = result.previousCursor
      }
      if (!hasCursor) {
        setHasOlderRecords(result.hasMore)
      }
      recordsCursorRef.current = hasCursor ? recordsCursorRef.current + recordsBatch.length : recordsBatch.length
      setRecords((prev) => result.cursorInvalid || !hasCursor
        ? recordsBatch
        : mergePipelineRecordsTail(prev, recordsBatch, prev.length))
    }

    loadRecordsTail().catch((error) => {
      console.error('[PipelineRecordsTail] 读取 Pipeline 记录失败:', error)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, refreshVersion])

  const requestStageFocus = React.useCallback((node: PipelineNodeKind): void => {
    recordsFocusSeqRef.current += 1
    setRecordsFocusRequest({
      nonce: recordsFocusSeqRef.current,
      type: 'stage',
      node,
    })
  }, [])

  const requestRecordFocus = React.useCallback((recordId: string): void => {
    recordsFocusSeqRef.current += 1
    setRecordsFocusRequest({
      nonce: recordsFocusSeqRef.current,
      type: 'record',
      recordId,
    })
  }, [])

  const loadOlderRecords = React.useCallback(async (options: { untilRecordId?: string } = {}): Promise<void> => {
    const cursor = olderCursorRef.current
    if (!cursor || loadingOlderRecords) return

    const loadSessionId = sessionId
    const loadId = olderLoadSeqRef.current + 1
    olderLoadSeqRef.current = loadId
    const isCurrentLoad = (): boolean => shouldApplyPipelineRecordsOlderLoad({
      loadId,
      latestLoadId: olderLoadSeqRef.current,
      loadSessionId,
      currentSessionId: sessionIdRef.current,
    })

    setLoadingOlderRecords(true)
    try {
      let nextCursor: string | null = cursor
      let shouldContinue = true

      while (nextCursor && shouldContinue) {
        const result = await window.electronAPI.getPipelineRecordsTail({
          sessionId: loadSessionId,
          direction: 'before',
          cursor: nextCursor,
          limit: 300,
        })
        if (!isCurrentLoad()) return

        if (result.cursorInvalid) {
          if (result.nextCursor) latestCursorRef.current = result.nextCursor
          if (result.previousCursor) olderCursorRef.current = result.previousCursor
          setRecords(result.records)
          recordsCursorRef.current = result.records.length
          setHasOlderRecords(result.hasMore)
          return
        }

        setRecords((prev) => prependPipelineRecordsTail(prev, result.records))
        recordsCursorRef.current += result.records.length
        olderCursorRef.current = result.previousCursor ?? null
        nextCursor = result.previousCursor ?? null
        setHasOlderRecords(result.hasMore)

        if (!options.untilRecordId) return
        const hasTarget = [...result.records, ...recordsRef.current].some((record) => record.id === options.untilRecordId)
        shouldContinue = !hasTarget && result.hasMore
      }
    } catch (error) {
      console.error('[PipelineRecordsTail] 读取更早 Pipeline 记录失败:', error)
    } finally {
      if (isCurrentLoad()) {
        setLoadingOlderRecords(false)
      }
    }
  }, [loadingOlderRecords, sessionId])

  React.useEffect(() => {
    if (!focusIntent || focusIntent.sessionId !== sessionId) return
    if (handledFocusIntentNonceRef.current === focusIntent.nonce) return

    const hasRecord = records.some((record) => record.id === focusIntent.recordId)
    if (hasRecord) {
      handledFocusIntentNonceRef.current = focusIntent.nonce
      requestRecordFocus(focusIntent.recordId)
      return
    }

    if (!olderCursorRef.current) return
    handledFocusIntentNonceRef.current = focusIntent.nonce
    void loadOlderRecords({ untilRecordId: focusIntent.recordId }).then(() => {
      requestRecordFocus(focusIntent.recordId)
    })
  }, [focusIntent, loadOlderRecords, records, requestRecordFocus, sessionId])

  const derivedSummary = React.useMemo(() => deriveRecordsSummary(records), [records])
  const latestUserInput = recordsSummary?.latestUserInput ?? derivedSummary.latestUserInput
  const latestErrorRecord = recordsSummary?.latestErrorRecord ?? derivedSummary.latestErrorRecord

  return {
    records,
    recordsFocusRequest,
    latestUserInput,
    latestErrorRecord,
    hasOlderRecords,
    loadingOlderRecords,
    loadOlderRecords,
    requestStageFocus,
    requestRecordFocus,
  }
}
