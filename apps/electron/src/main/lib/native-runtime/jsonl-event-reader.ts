import { createReadStream, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'

export type JsonlEventReadIssueReason = 'missing_file' | 'invalid_json' | 'read_error'

export interface JsonlEventReadIssue {
  filePath: string
  reason: JsonlEventReadIssueReason
  lineNumber?: number
  message?: string
}

export interface JsonlEventRecord<TRecord> {
  filePath: string
  lineNumber: number
  raw: string
  record: TRecord
}

export interface JsonlEventReaderOptions {
  signal?: AbortSignal
  onIssue?: (issue: JsonlEventReadIssue) => void
}

export class JsonlEventReadAbortedError extends Error {
  constructor() {
    super('搜索已取消')
    this.name = 'JsonlEventReadAbortedError'
  }
}

export function throwIfJsonlEventReadAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new JsonlEventReadAbortedError()
  }
}

function issueMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 逐行读取 JSONL 事件。
 *
 * 坏行、缺失文件和读取失败通过 onIssue 汇报；取消请求直接抛出，
 * 避免旧搜索结果继续写入上层缓存或 UI 状态。
 */
export async function* iterateJsonlEvents<TRecord>(
  filePath: string,
  options: JsonlEventReaderOptions = {},
): AsyncGenerator<JsonlEventRecord<TRecord>> {
  throwIfJsonlEventReadAborted(options.signal)

  if (!existsSync(filePath)) {
    options.onIssue?.({ filePath, reason: 'missing_file' })
    return
  }

  const stream = createReadStream(filePath, { encoding: 'utf-8' })
  const reader = createInterface({
    input: stream,
    crlfDelay: Infinity,
  })

  let lineNumber = 0

  try {
    for await (const line of reader) {
      throwIfJsonlEventReadAborted(options.signal)
      lineNumber += 1

      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        yield {
          filePath,
          lineNumber,
          raw: line,
          record: JSON.parse(trimmed) as TRecord,
        }
      } catch (error) {
        options.onIssue?.({
          filePath,
          lineNumber,
          reason: 'invalid_json',
          message: issueMessage(error),
        })
      }
    }
  } catch (error) {
    if (error instanceof JsonlEventReadAbortedError) {
      throw error
    }
    options.onIssue?.({
      filePath,
      reason: 'read_error',
      message: issueMessage(error),
    })
  } finally {
    reader.close()
    stream.destroy()
  }
}

export async function findFirstJsonlEventMatch<TRecord, TResult>(
  filePath: string,
  buildResult: (event: JsonlEventRecord<TRecord>) => TResult | null | Promise<TResult | null>,
  options: JsonlEventReaderOptions = {},
): Promise<TResult | null> {
  for await (const event of iterateJsonlEvents<TRecord>(filePath, options)) {
    const result = await buildResult(event)
    if (result != null) {
      return result
    }
  }

  return null
}
