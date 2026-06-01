import type { PipelineRecord } from '@codeinsights/shared'

export interface PipelineRecordsTailLoadState {
  loadId: number
  latestLoadId: number
  afterIndex: number
  currentCursor: number
}

export interface PipelineRecordsTailCursorState {
  cursor: number
  latestLoadId: number
}

export interface PipelineRecordsOlderLoadState {
  loadId: number
  latestLoadId: number
  loadSessionId: string
  currentSessionId: string
}

export function resetPipelineRecordsTailLoadState({
  latestLoadId,
}: PipelineRecordsTailCursorState): PipelineRecordsTailCursorState {
  return {
    cursor: 0,
    latestLoadId: latestLoadId + 1,
  }
}

export function shouldApplyPipelineRecordsTailLoad({
  loadId,
  latestLoadId,
  afterIndex,
  currentCursor,
}: PipelineRecordsTailLoadState): boolean {
  if (loadId !== latestLoadId) return false
  if (afterIndex === 0 && currentCursor > 0) return false
  return true
}

export function shouldApplyPipelineRecordsOlderLoad({
  loadId,
  latestLoadId,
  loadSessionId,
  currentSessionId,
}: PipelineRecordsOlderLoadState): boolean {
  return loadId === latestLoadId && loadSessionId === currentSessionId
}

export function mergePipelineRecordsTail(
  prev: PipelineRecord[],
  recordsBatch: PipelineRecord[],
  afterIndex: number,
): PipelineRecord[] {
  if (afterIndex === 0) {
    return recordsBatch
  }

  const existingIds = new Set(prev.map((record) => record.id))
  const nextRecords = recordsBatch.filter((record) => !existingIds.has(record.id))
  return nextRecords.length > 0 ? [...prev, ...nextRecords] : prev
}

export function prependPipelineRecordsTail(
  prev: PipelineRecord[],
  recordsBatch: PipelineRecord[],
): PipelineRecord[] {
  const existingIds = new Set(prev.map((record) => record.id))
  const nextRecords = recordsBatch.filter((record) => !existingIds.has(record.id))
  return nextRecords.length > 0 ? [...nextRecords, ...prev] : prev
}
