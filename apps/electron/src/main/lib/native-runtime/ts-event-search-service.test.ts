import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TypeScriptEventSearchService } from './ts-event-search-service'

interface MessageFixture {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

interface LegacyMessageResult {
  ownerId: string
  ownerTitle: string
  messageId: string
  snippet: string
  matchStart: number
  matchLength: number
}

interface PipelineFixture {
  id: string
  type: 'node_output' | 'error'
  node: 'developer' | 'tester'
  summary?: string
  content?: string
  error?: string
  createdAt: number
}

interface PipelineResultFixture {
  recordId: string
  title: string
  snippet: string
  createdAt: number
}

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

function createTempJsonl(filename: string, lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'codeinsights-event-search-'))
  tempDirs.push(dir)
  const filePath = join(dir, filename)
  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return filePath
}

describe('TypeScriptEventSearchService', () => {
  test('按 source 搜索第一条命中并同时生成 NativeRuntime search result', async () => {
    const chatPath = createTempJsonl('chat.jsonl', [
      JSON.stringify({ id: 'chat-skip', role: 'user', content: '没有命中', createdAt: 1 }),
      '{bad json',
      JSON.stringify({ id: 'chat-hit', role: 'assistant', content: '这里包含关键字和上下文', createdAt: 2 }),
    ])
    const agentPath = createTempJsonl('agent.jsonl', [
      JSON.stringify({ id: 'agent-hit', role: 'assistant', content: 'Agent 也包含关键字', createdAt: 3 }),
    ])

    const service = new TypeScriptEventSearchService()
    const result = await service.searchFirstMatchPerSource<MessageFixture, LegacyMessageResult>({
      requestId: 'req-search-1',
      query: '关键字',
      limit: 10,
      sources: [
        {
          sourceKind: 'chat_message',
          sourceId: 'chat-1',
          title: 'Chat 会话',
          filePath: chatPath,
          updatedAt: 20,
          getRecordId: (record) => record.id,
          getRecordText: (record) => record.content,
          toLegacyResult: ({ source, record, snippet }) => ({
            ownerId: source.sourceId,
            ownerTitle: source.title,
            messageId: record.id,
            ...snippet,
          }),
        },
        {
          sourceKind: 'agent_message',
          sourceId: 'agent-1',
          title: 'Agent 会话',
          filePath: agentPath,
          updatedAt: 10,
          getRecordId: (record) => record.id,
          getRecordText: (record) => record.content,
          toLegacyResult: ({ source, record, snippet }) => ({
            ownerId: source.sourceId,
            ownerTitle: source.title,
            messageId: record.id,
            ...snippet,
          }),
        },
      ],
    })

    expect(result.results.map((item) => item.messageId)).toEqual(['chat-hit', 'agent-hit'])
    expect(result.diagnostics.invalidJsonLines).toBe(1)
    expect(result.searchResult).toMatchObject({
      requestId: 'req-search-1',
      query: '关键字',
      hasMore: false,
      indexState: 'fallback',
      implementation: 'typescript',
    })
    expect(result.searchResult.matches.map((match) => [match.sourceKind, match.id])).toEqual([
      ['chat_message', 'chat-hit'],
      ['agent_message', 'agent-hit'],
    ])
    expect(result.searchResult.matches[0]?.matchedRanges).toEqual([{ start: result.results[0]!.matchStart, length: 3 }])
  })

  test('搜索单个 source 支持分页、过滤和稳定 total', async () => {
    const pipelinePath = createTempJsonl('pipeline.jsonl', [
      JSON.stringify({ id: 'dev-1', type: 'node_output', node: 'developer', summary: '构建失败', content: 'ts 类型错误', createdAt: 1 }),
      JSON.stringify({ id: 'tester-1', type: 'node_output', node: 'tester', summary: '构建失败', content: '测试失败', createdAt: 2 }),
      JSON.stringify({ id: 'dev-2', type: 'error', node: 'developer', error: '构建失败：缺少导出', createdAt: 3 }),
    ])

    const service = new TypeScriptEventSearchService()
    const firstPage = await service.searchMatchesInSource<PipelineFixture, PipelineResultFixture>({
      requestId: 'req-pipeline-1',
      query: '构建失败',
      filePath: pipelinePath,
      sourceKind: 'pipeline_record',
      sourceId: 'pipeline-1',
      title: 'Pipeline 会话',
      offset: 0,
      limit: 1,
      filterRecord: (record) => record.node === 'developer',
      getRecordId: (record) => record.id,
      getRecordText: (record) => [record.summary, record.content, record.error].filter(Boolean).join('\n'),
      toLegacyResult: ({ record, snippet }) => ({
        recordId: record.id,
        title: record.type,
        snippet: snippet.snippet,
        createdAt: record.createdAt,
      }),
    })

    expect(firstPage.total).toBe(2)
    expect(firstPage.matches.map((match) => match.recordId)).toEqual(['dev-1'])
    expect(firstPage.nextOffset).toBe(1)
    expect(firstPage.hasMore).toBe(true)
    expect(firstPage.searchResult.matches.map((match) => match.id)).toEqual(['dev-1'])
  })

  test('取消后不返回旧结果', async () => {
    const chatPath = createTempJsonl('chat.jsonl', [
      JSON.stringify({ id: 'chat-hit', role: 'assistant', content: '包含关键字', createdAt: 1 }),
    ])
    const controller = new AbortController()
    controller.abort()

    const service = new TypeScriptEventSearchService()
    await expect(service.searchFirstMatchPerSource<MessageFixture, LegacyMessageResult>({
      requestId: 'req-abort',
      query: '关键字',
      limit: 10,
      signal: controller.signal,
      sources: [
        {
          sourceKind: 'chat_message',
          sourceId: 'chat-1',
          title: 'Chat 会话',
          filePath: chatPath,
          getRecordId: (record) => record.id,
          getRecordText: (record) => record.content,
          toLegacyResult: ({ source, record, snippet }) => ({
            ownerId: source.sourceId,
            ownerTitle: source.title,
            messageId: record.id,
            ...snippet,
          }),
        },
      ],
    })).rejects.toThrow('搜索已取消')
  })
})
