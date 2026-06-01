import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import type { PipelineRecord, PipelineRecordsTailDirection } from '@codeinsights/shared'

const CURSOR_SCHEMA_VERSION = 1
const CHUNK_SIZE = 64 * 1024
const MAX_TAIL_LIMIT = 500

interface PipelineTailCursor {
  schemaVersion: number
  fileKind: 'pipeline-records'
  sessionId: string
  byteOffset: number
  recordId?: string
  createdAt?: number
}

export interface TypeScriptPipelineTailDiagnostics {
  invalidJsonLines: number
  missingFiles: number
  partialLines: number
  cursorInvalid: number
  readErrors: number
}

export interface TypeScriptPipelineTailReadInput {
  requestId: string
  filePath: string
  sessionId: string
  direction: PipelineRecordsTailDirection
  cursor?: string
  afterIndex?: number
  limit?: number
}

export interface TypeScriptPipelineTailReadResult {
  requestId: string
  sessionId: string
  records: PipelineRecord[]
  nextIndex: number
  hasMore: boolean
  previousCursor?: string
  nextCursor?: string
  cursorInvalid?: boolean
  diagnostics: TypeScriptPipelineTailDiagnostics
  implementation: 'typescript'
  readAt: number
}

interface ParsedPipelineLine {
  record: PipelineRecord
  startOffset: number
  nextOffset: number
}

interface ForwardScanResult {
  lines: ParsedPipelineLine[]
  stoppedByLimit: boolean
}

function createDiagnostics(): TypeScriptPipelineTailDiagnostics {
  return {
    invalidJsonLines: 0,
    missingFiles: 0,
    partialLines: 0,
    cursorInvalid: 0,
    readErrors: 0,
  }
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(MAX_TAIL_LIMIT, Math.max(1, Math.floor(limit ?? 200)))
}

function encodeCursor(input: Omit<PipelineTailCursor, 'schemaVersion' | 'fileKind'>): string {
  return Buffer.from(JSON.stringify({
    schemaVersion: CURSOR_SCHEMA_VERSION,
    fileKind: 'pipeline-records',
    ...input,
  }), 'utf-8').toString('base64url')
}

function decodeCursor(
  cursor: string | undefined,
  sessionId: string,
  safeEndOffset: number,
  diagnostics: TypeScriptPipelineTailDiagnostics,
): PipelineTailCursor | null {
  if (!cursor) return null

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as Partial<PipelineTailCursor>
    const byteOffset = parsed.byteOffset
    const valid = parsed.schemaVersion === CURSOR_SCHEMA_VERSION
      && parsed.fileKind === 'pipeline-records'
      && parsed.sessionId === sessionId
      && typeof byteOffset === 'number'
      && Number.isFinite(byteOffset)
      && byteOffset >= 0
      && byteOffset <= safeEndOffset

    if (!valid) {
      diagnostics.cursorInvalid += 1
      return null
    }

    return {
      schemaVersion: CURSOR_SCHEMA_VERSION,
      fileKind: 'pipeline-records',
      sessionId,
      byteOffset: Math.floor(byteOffset),
      recordId: typeof parsed.recordId === 'string' ? parsed.recordId : undefined,
      createdAt: typeof parsed.createdAt === 'number' && Number.isFinite(parsed.createdAt)
        ? parsed.createdAt
        : undefined,
    }
  } catch {
    diagnostics.cursorInvalid += 1
    return null
  }
}

function readFileSlice(filePath: string, start: number, length: number): Buffer {
  const fd = openSync(filePath, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const bytesRead = readSync(fd, buffer, 0, length, start)
    return bytesRead === length ? buffer : buffer.subarray(0, bytesRead)
  } finally {
    closeSync(fd)
  }
}

function findSafeEndOffset(
  filePath: string,
  fileSize: number,
  diagnostics: TypeScriptPipelineTailDiagnostics,
): number {
  if (fileSize <= 0) return 0

  const lastByte = readFileSlice(filePath, fileSize - 1, 1)
  if (lastByte[0] === 0x0a) return fileSize

  diagnostics.partialLines += 1

  let position = fileSize
  while (position > 0) {
    const readSize = Math.min(CHUNK_SIZE, position)
    position -= readSize
    const buffer = readFileSlice(filePath, position, readSize)
    const newlineIndex = buffer.lastIndexOf(0x0a)
    if (newlineIndex >= 0) {
      return position + newlineIndex + 1
    }
  }

  return 0
}

function parsePipelineLine(
  lineBuffer: Buffer,
  startOffset: number,
  nextOffset: number,
  diagnostics: TypeScriptPipelineTailDiagnostics,
): ParsedPipelineLine | null {
  const line = lineBuffer.toString('utf-8').trim()
  if (!line) return null

  try {
    return {
      record: JSON.parse(line) as PipelineRecord,
      startOffset,
      nextOffset,
    }
  } catch {
    diagnostics.invalidJsonLines += 1
    return null
  }
}

function scanForward(
  filePath: string,
  startOffset: number,
  endOffset: number,
  maxRecords: number,
  diagnostics: TypeScriptPipelineTailDiagnostics,
  options: { skipFirstSegment: boolean },
): ForwardScanResult {
  const lines: ParsedPipelineLine[] = []
  if (endOffset <= startOffset || maxRecords <= 0) {
    return { lines, stoppedByLimit: false }
  }

  const fd = openSync(filePath, 'r')
  try {
    let position = startOffset
    let pending = Buffer.alloc(0)
    let pendingStartOffset = startOffset
    let skipNextSegment = options.skipFirstSegment

    while (position < endOffset) {
      const readSize = Math.min(CHUNK_SIZE, endOffset - position)
      const chunk = Buffer.alloc(readSize)
      const bytesRead = readSync(fd, chunk, 0, readSize, position)
      if (bytesRead <= 0) break
      position += bytesRead

      const chunkSlice = bytesRead === readSize ? chunk : chunk.subarray(0, bytesRead)
      const combined = pending.length > 0 ? Buffer.concat([pending, chunkSlice]) : chunkSlice
      const combinedStartOffset = pendingStartOffset
      let segmentStart = 0

      while (segmentStart < combined.length) {
        const newlineIndex = combined.indexOf(0x0a, segmentStart)
        if (newlineIndex < 0) break

        const lineStartOffset = combinedStartOffset + segmentStart
        const nextOffset = combinedStartOffset + newlineIndex + 1
        if (skipNextSegment) {
          skipNextSegment = false
        } else {
          const parsed = parsePipelineLine(
            combined.subarray(segmentStart, newlineIndex),
            lineStartOffset,
            nextOffset,
            diagnostics,
          )
          if (parsed) {
            lines.push(parsed)
            if (lines.length >= maxRecords) {
              return { lines, stoppedByLimit: true }
            }
          }
        }
        segmentStart = newlineIndex + 1
      }

      pending = combined.subarray(segmentStart)
      pendingStartOffset = combinedStartOffset + segmentStart
    }

    return { lines, stoppedByLimit: false }
  } catch (error) {
    diagnostics.readErrors += 1
    throw error
  } finally {
    closeSync(fd)
  }
}

interface BackwardScanResult {
  lines: ParsedPipelineLine[]
  hasMoreBefore: boolean
}

function scanBackward(
  filePath: string,
  endOffset: number,
  maxRecords: number,
  diagnostics: TypeScriptPipelineTailDiagnostics,
): BackwardScanResult {
  const lines: ParsedPipelineLine[] = []
  if (endOffset <= 0 || maxRecords <= 0) {
    return { lines, hasMoreBefore: false }
  }

  const fd = openSync(filePath, 'r')
  try {
    let position = endOffset
    let carry = Buffer.alloc(0)

    while (position > 0 && lines.length < maxRecords) {
      const readSize = Math.min(CHUNK_SIZE, position)
      position -= readSize
      const chunk = Buffer.alloc(readSize)
      const bytesRead = readSync(fd, chunk, 0, readSize, position)
      if (bytesRead <= 0) break

      const chunkSlice = bytesRead === readSize ? chunk : chunk.subarray(0, bytesRead)
      const combined = carry.length > 0 ? Buffer.concat([chunkSlice, carry]) : chunkSlice
      let segmentEnd = combined.length

      while (segmentEnd > 0 && lines.length < maxRecords) {
        const newlineIndex = combined.lastIndexOf(0x0a, segmentEnd - 1)
        if (newlineIndex < 0) break

        const lineStart = newlineIndex + 1
        const parsed = parsePipelineLine(
          combined.subarray(lineStart, segmentEnd),
          position + lineStart,
          position + segmentEnd,
          diagnostics,
        )
        if (parsed) {
          lines.push(parsed)
        }
        segmentEnd = newlineIndex
      }

      carry = combined.subarray(0, segmentEnd)
    }

    if (position === 0 && carry.length > 0 && lines.length < maxRecords) {
      const parsed = parsePipelineLine(carry, 0, carry.length, diagnostics)
      if (parsed) {
        lines.push(parsed)
      }
    }

    lines.reverse()
    return {
      lines,
      hasMoreBefore: position > 0 || lines.length >= maxRecords,
    }
  } catch (error) {
    diagnostics.readErrors += 1
    throw error
  } finally {
    closeSync(fd)
  }
}

function cursorMatchesLine(cursor: PipelineTailCursor, line: ParsedPipelineLine | undefined): boolean {
  if (!cursor.recordId) return true
  if (!line) return false
  if (line.record.id !== cursor.recordId) return false
  if (typeof cursor.createdAt === 'number' && line.record.createdAt !== cursor.createdAt) return false
  return true
}

function validateCursorAnchor(
  filePath: string,
  cursor: PipelineTailCursor,
  direction: PipelineRecordsTailDirection,
  safeEndOffset: number,
  diagnostics: TypeScriptPipelineTailDiagnostics,
): boolean {
  if (!cursor.recordId) return true

  const anchor = direction === 'after'
    ? scanBackward(filePath, cursor.byteOffset, 1, diagnostics).lines[0]
    : scanForward(
        filePath,
        cursor.byteOffset,
        safeEndOffset,
        1,
        diagnostics,
        { skipFirstSegment: false },
      ).lines[0]

  if (cursorMatchesLine(cursor, anchor)) return true

  diagnostics.cursorInvalid += 1
  return false
}

function buildCursor(
  sessionId: string,
  line: ParsedPipelineLine | undefined,
  fallbackOffset: number,
  boundary: 'start' | 'end',
): string {
  if (!line) {
    return encodeCursor({ sessionId, byteOffset: fallbackOffset })
  }

  return encodeCursor({
    sessionId,
    byteOffset: boundary === 'start' ? line.startOffset : line.nextOffset,
    recordId: line.record.id,
    createdAt: line.record.createdAt,
  })
}

function buildResult(input: {
  requestId: string
  sessionId: string
  records: ParsedPipelineLine[]
  nextIndex: number
  hasMore: boolean
  diagnostics: TypeScriptPipelineTailDiagnostics
  fallbackOffset: number
  cursorInvalid?: boolean
}): TypeScriptPipelineTailReadResult {
  const first = input.records[0]
  const last = input.records[input.records.length - 1]
  return {
    requestId: input.requestId,
    sessionId: input.sessionId,
    records: input.records.map((line) => line.record),
    nextIndex: input.nextIndex,
    hasMore: input.hasMore,
    previousCursor: buildCursor(input.sessionId, first, input.fallbackOffset, 'start'),
    nextCursor: buildCursor(input.sessionId, last, input.fallbackOffset, 'end'),
    ...(input.cursorInvalid ? { cursorInvalid: true } : {}),
    diagnostics: input.diagnostics,
    implementation: 'typescript',
    readAt: Date.now(),
  }
}

export class TypeScriptPipelineTailService {
  readTail(input: TypeScriptPipelineTailReadInput): TypeScriptPipelineTailReadResult {
    const diagnostics = createDiagnostics()
    const limit = normalizeLimit(input.limit)

    if (!existsSync(input.filePath)) {
      diagnostics.missingFiles += 1
      return buildResult({
        requestId: input.requestId,
        sessionId: input.sessionId,
        records: [],
        nextIndex: 0,
        hasMore: false,
        diagnostics,
        fallbackOffset: 0,
      })
    }

    const fileSize = statSync(input.filePath).size
    const safeEndOffset = findSafeEndOffset(input.filePath, fileSize, diagnostics)

    if (input.direction === 'after') {
      const cursor = decodeCursor(input.cursor, input.sessionId, safeEndOffset, diagnostics)
      if ((!cursor && input.cursor) || (cursor && !validateCursorAnchor(
        input.filePath,
        cursor,
        'after',
        safeEndOffset,
        diagnostics,
      ))) {
        return this.readWindowBeforeEnd({
          requestId: input.requestId,
          filePath: input.filePath,
          sessionId: input.sessionId,
          endOffset: safeEndOffset,
          limit,
          diagnostics,
          cursorInvalid: true,
        })
      }
      return this.readAfterCursor({
        requestId: input.requestId,
        filePath: input.filePath,
        sessionId: input.sessionId,
        startOffset: cursor?.byteOffset ?? 0,
        endOffset: safeEndOffset,
        limit,
        diagnostics,
      })
    }

    if (input.direction === 'before') {
      const cursor = decodeCursor(input.cursor, input.sessionId, safeEndOffset, diagnostics)
      const anchorValid = cursor
        ? validateCursorAnchor(input.filePath, cursor, 'before', safeEndOffset, diagnostics)
        : false
      const endOffset = cursor && anchorValid ? cursor.byteOffset : safeEndOffset
      const cursorInvalid = Boolean(input.cursor && (!cursor || !anchorValid))
      return this.readWindowBeforeEnd({
        requestId: input.requestId,
        filePath: input.filePath,
        sessionId: input.sessionId,
        endOffset,
        limit,
        diagnostics,
        cursorInvalid,
      })
    }

    return this.readWindowBeforeEnd({
      requestId: input.requestId,
      filePath: input.filePath,
      sessionId: input.sessionId,
      endOffset: safeEndOffset,
      limit,
      diagnostics,
    })
  }

  readLegacyAfterIndex(input: Omit<TypeScriptPipelineTailReadInput, 'direction'>): TypeScriptPipelineTailReadResult {
    const diagnostics = createDiagnostics()
    const limit = normalizeLimit(input.limit)
    const afterIndex = Math.max(0, Math.floor(input.afterIndex ?? 0))

    if (!existsSync(input.filePath)) {
      diagnostics.missingFiles += 1
      return buildResult({
        requestId: input.requestId,
        sessionId: input.sessionId,
        records: [],
        nextIndex: 0,
        hasMore: false,
        diagnostics,
        fallbackOffset: 0,
      })
    }

    const fileSize = statSync(input.filePath).size
    const safeEndOffset = findSafeEndOffset(input.filePath, fileSize, diagnostics)
    const scan = scanForward(
      input.filePath,
      0,
      safeEndOffset,
      afterIndex + limit + 1,
      diagnostics,
      { skipFirstSegment: false },
    )
    const startIndex = Math.min(afterIndex, scan.lines.length)
    const selected = scan.lines.slice(startIndex, startIndex + limit)
    const nextIndex = startIndex + selected.length

    return buildResult({
      requestId: input.requestId,
      sessionId: input.sessionId,
      records: selected,
      nextIndex,
      hasMore: scan.lines.length > startIndex + selected.length || scan.stoppedByLimit,
      diagnostics,
      fallbackOffset: safeEndOffset,
    })
  }

  private readAfterCursor(input: {
    requestId: string
    filePath: string
    sessionId: string
    startOffset: number
    endOffset: number
    limit: number
    diagnostics: TypeScriptPipelineTailDiagnostics
  }): TypeScriptPipelineTailReadResult {
    const scan = scanForward(
      input.filePath,
      input.startOffset,
      input.endOffset,
      input.limit + 1,
      input.diagnostics,
      { skipFirstSegment: false },
    )
    const selected = scan.lines.slice(0, input.limit)

    return buildResult({
      requestId: input.requestId,
      sessionId: input.sessionId,
      records: selected,
      nextIndex: 0,
      hasMore: scan.lines.length > selected.length || scan.stoppedByLimit,
      diagnostics: input.diagnostics,
      fallbackOffset: input.endOffset,
    })
  }

  private readWindowBeforeEnd(input: {
    requestId: string
    filePath: string
    sessionId: string
    endOffset: number
    limit: number
    diagnostics: TypeScriptPipelineTailDiagnostics
    cursorInvalid?: boolean
  }): TypeScriptPipelineTailReadResult {
    const scan = scanBackward(
      input.filePath,
      input.endOffset,
      input.limit + 1,
      input.diagnostics,
    )
    const selected = scan.lines.slice(-input.limit)

    return buildResult({
      requestId: input.requestId,
      sessionId: input.sessionId,
      records: selected,
      nextIndex: 0,
      hasMore: scan.hasMoreBefore || scan.lines.length > selected.length,
      diagnostics: input.diagnostics,
      fallbackOffset: input.endOffset,
      cursorInvalid: input.cursorInvalid,
    })
  }
}
