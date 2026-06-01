import { afterEach, describe, expect, test } from 'bun:test'
import { appendFileSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TypeScriptPipelineTailService } from './ts-pipeline-tail-service'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

function createTempJsonl(lines: string[], trailingNewline = true): string {
  const dir = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-tail-'))
  tempDirs.push(dir)
  const filePath = join(dir, 'records.jsonl')
  writeFileSync(filePath, `${lines.join('\n')}${trailingNewline ? '\n' : ''}`, 'utf-8')
  return filePath
}

function recordLine(id: string, createdAt: number): string {
  return JSON.stringify({
    id,
    sessionId: 'session-tail',
    type: 'user_input',
    content: `任务 ${id}`,
    createdAt,
  })
}

function staleCursor(sessionId: string, byteOffset: number): string {
  return Buffer.from(JSON.stringify({
    schemaVersion: 999,
    fileKind: 'pipeline-records',
    sessionId,
    byteOffset,
  }), 'utf-8').toString('base64url')
}

describe('TypeScriptPipelineTailService', () => {
  test('latest / before / after 使用不含绝对路径的 byte cursor', async () => {
    const filePath = createTempJsonl([
      recordLine('record-0', 0),
      recordLine('record-1', 1),
      recordLine('record-2', 2),
      recordLine('record-3', 3),
      recordLine('record-4', 4),
    ])
    const service = new TypeScriptPipelineTailService()

    const latest = await service.readTail({
      requestId: 'tail-latest',
      filePath,
      sessionId: 'session-tail',
      direction: 'latest',
      limit: 2,
    })

    expect(latest.records.map((record) => record.id)).toEqual(['record-3', 'record-4'])
    expect(latest.hasMore).toBe(true)
    expect(typeof latest.previousCursor).toBe('string')
    expect(typeof latest.nextCursor).toBe('string')
    expect(latest.previousCursor).not.toContain(filePath)
    expect(latest.nextCursor).not.toContain(filePath)

    const older = await service.readTail({
      requestId: 'tail-before',
      filePath,
      sessionId: 'session-tail',
      direction: 'before',
      cursor: latest.previousCursor,
      limit: 2,
    })

    expect(older.records.map((record) => record.id)).toEqual(['record-1', 'record-2'])
    expect(older.hasMore).toBe(true)

    appendFileSync(filePath, recordLine('record-5', 5) + '\n', 'utf-8')
    const appended = await service.readTail({
      requestId: 'tail-after',
      filePath,
      sessionId: 'session-tail',
      direction: 'after',
      cursor: latest.nextCursor,
      limit: 5,
    })

    expect(appended.records.map((record) => record.id)).toEqual(['record-5'])
    expect(appended.hasMore).toBe(false)
  })

  test('跳过坏行、空行和 append 中的部分写入', async () => {
    const filePath = createTempJsonl([
      recordLine('record-1', 1),
      '{bad json',
      '',
      recordLine('record-2', 2),
      '{"id":"partial"',
    ], false)
    const service = new TypeScriptPipelineTailService()

    const result = await service.readTail({
      requestId: 'tail-tolerant',
      filePath,
      sessionId: 'session-tail',
      direction: 'latest',
      limit: 10,
    })

    expect(result.records.map((record) => record.id)).toEqual(['record-1', 'record-2'])
    expect(result.diagnostics.invalidJsonLines).toBe(1)
    expect(result.diagnostics.partialLines).toBe(1)
  })

  test('cursor schema mismatch 会回退到 latest 并标记 cursorInvalid', async () => {
    const filePath = createTempJsonl([
      recordLine('record-1', 1),
      recordLine('record-2', 2),
      recordLine('record-3', 3),
    ])
    const service = new TypeScriptPipelineTailService()

    const result = await service.readTail({
      requestId: 'tail-invalid-cursor',
      filePath,
      sessionId: 'session-tail',
      direction: 'before',
      cursor: staleCursor('session-tail', 1),
      limit: 2,
    })

    expect(result.cursorInvalid).toBe(true)
    expect(result.records.map((record) => record.id)).toEqual(['record-2', 'record-3'])
  })

  test('文件截断后使用旧 cursor 会安全回退到 latest', async () => {
    const filePath = createTempJsonl([
      recordLine('record-1', 1),
      recordLine('record-2', 2),
      recordLine('record-3', 3),
    ])
    const service = new TypeScriptPipelineTailService()
    const latest = await service.readTail({
      requestId: 'tail-before-truncate',
      filePath,
      sessionId: 'session-tail',
      direction: 'latest',
      limit: 2,
    })

    truncateSync(filePath, 0)
    appendFileSync(filePath, recordLine('record-new', 10) + '\n', 'utf-8')

    const result = await service.readTail({
      requestId: 'tail-after-truncate',
      filePath,
      sessionId: 'session-tail',
      direction: 'after',
      cursor: latest.nextCursor,
      limit: 5,
    })

    expect(result.cursorInvalid).toBe(true)
    expect(result.records.map((record) => record.id)).toEqual(['record-new'])
  })

  test('文件截断后重新写入更大内容仍会校验 cursor anchor', async () => {
    const filePath = createTempJsonl([
      recordLine('record-1', 1),
      recordLine('record-2', 2),
      recordLine('record-3', 3),
    ])
    const service = new TypeScriptPipelineTailService()
    const latest = await service.readTail({
      requestId: 'tail-before-rewrite',
      filePath,
      sessionId: 'session-tail',
      direction: 'latest',
      limit: 1,
    })

    truncateSync(filePath, 0)
    appendFileSync(filePath, [
      recordLine('record-new-1', 10),
      recordLine('record-new-2', 11),
      recordLine('record-new-3', 12),
      recordLine('record-new-4', 13),
      recordLine('record-new-5', 14),
    ].join('\n') + '\n', 'utf-8')

    const result = await service.readTail({
      requestId: 'tail-after-rewrite',
      filePath,
      sessionId: 'session-tail',
      direction: 'after',
      cursor: latest.nextCursor,
      limit: 5,
    })

    expect(result.cursorInvalid).toBe(true)
    expect(result.records.map((record) => record.id)).toEqual([
      'record-new-1',
      'record-new-2',
      'record-new-3',
      'record-new-4',
      'record-new-5',
    ])
  })

  test('50000 records latest tail 只返回目标窗口并保留更早记录提示', async () => {
    const lines: string[] = []
    for (let index = 0; index < 50000; index += 1) {
      lines.push(recordLine(`record-${index}`, index))
    }
    const filePath = createTempJsonl(lines)
    const service = new TypeScriptPipelineTailService()

    const result = await service.readTail({
      requestId: 'tail-large',
      filePath,
      sessionId: 'session-tail',
      direction: 'latest',
      limit: 3,
    })

    expect(result.records.map((record) => record.id)).toEqual([
      'record-49997',
      'record-49998',
      'record-49999',
    ])
    expect(result.hasMore).toBe(true)
  })
})
