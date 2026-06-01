import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  JsonlEventReadAbortedError,
  findFirstJsonlEventMatch,
  iterateJsonlEvents,
} from './jsonl-event-reader'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

function createTempJsonl(lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'codeinsights-jsonl-reader-'))
  tempDirs.push(dir)
  const filePath = join(dir, 'events.jsonl')
  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return filePath
}

describe('jsonl-event-reader', () => {
  test('逐行读取 JSONL，跳过坏行并记录诊断', async () => {
    const issues: string[] = []
    const filePath = createTempJsonl([
      JSON.stringify({ id: 'first', content: '第一条' }),
      '{bad json',
      '',
      JSON.stringify({ id: 'second', content: '第二条' }),
    ])

    const records: Array<{ id: string; lineNumber: number }> = []
    for await (const event of iterateJsonlEvents<{ id: string }>(filePath, {
      onIssue: (issue) => issues.push(`${issue.reason}:${issue.lineNumber ?? 0}`),
    })) {
      records.push({ id: event.record.id, lineNumber: event.lineNumber })
    }

    expect(records).toEqual([
      { id: 'first', lineNumber: 1 },
      { id: 'second', lineNumber: 4 },
    ])
    expect(issues).toEqual(['invalid_json:2'])
  })

  test('缺失文件按空结果处理并记录 missing_file', async () => {
    const issues: string[] = []
    const missingPath = join(tmpdir(), `codeinsights-missing-${Date.now()}.jsonl`)
    const records: unknown[] = []

    for await (const event of iterateJsonlEvents(missingPath, {
      onIssue: (issue) => issues.push(issue.reason),
    })) {
      records.push(event.record)
    }

    expect(records).toEqual([])
    expect(issues).toEqual(['missing_file'])
  })

  test('findFirstJsonlEventMatch 返回第一条命中并复用 reader 容错', async () => {
    const filePath = createTempJsonl([
      '{bad json',
      JSON.stringify({ id: 'skip', content: '没有命中' }),
      JSON.stringify({ id: 'match-1', content: '包含关键字' }),
      JSON.stringify({ id: 'match-2', content: '也包含关键字' }),
    ])

    const result = await findFirstJsonlEventMatch<{ id: string; content: string }, string>(
      filePath,
      async ({ record }) => record.content.includes('关键字') ? record.id : null,
    )

    expect(result).toBe('match-1')
  })

  test('AbortSignal 已取消时抛出可识别的取消错误', async () => {
    const filePath = createTempJsonl([
      JSON.stringify({ id: 'first' }),
    ])
    const controller = new AbortController()
    controller.abort()

    await expect(async () => {
      for await (const _event of iterateJsonlEvents(filePath, { signal: controller.signal })) {
        // 不应进入循环体
      }
    }).toThrow(JsonlEventReadAbortedError)
  })
})
