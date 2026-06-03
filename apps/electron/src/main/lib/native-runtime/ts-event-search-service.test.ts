import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  TypeScriptEventSearchService,
  type NativeEventSearchSidecar,
} from './ts-event-search-service'
import { NativeRuntimeSidecarError } from './native-runtime-sidecar-manager'

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

  test('source 显式声明 nativeTextFields 时可使用 sidecar search 并生成 legacy result', async () => {
    const chatPath = createTempJsonl('chat.jsonl', [
      JSON.stringify({ id: 'chat-skip', role: 'user', content: '没有命中', createdAt: 1 }),
      JSON.stringify({ id: 'chat-hit', role: 'assistant', content: '这里包含关键字和上下文', createdAt: 2 }),
    ])
    const sidecar: NativeEventSearchSidecar = {
      search: async (input) => ({
        requestId: input.requestId,
        query: input.query,
        matches: [{
          id: 'chat-hit',
          sourceKind: 'chat_message',
          title: 'Chat 会话',
          snippet: '这里包含关键字和上下文',
          matchedRanges: [{ start: 4, length: 3 }],
          score: 1,
          sessionId: 'chat-1',
          recordId: 'chat-hit',
          cursor: '2',
        }],
        hasMore: false,
        indexState: 'ready',
        implementation: 'rust-sidecar',
        searchedAt: 1764590404000,
      }),
    }
    const service = new TypeScriptEventSearchService({ nativeSearch: sidecar })

    const result = await service.searchFirstMatchPerSource<MessageFixture, LegacyMessageResult>({
      requestId: 'req-native-chat-search',
      query: '关键字',
      limit: 10,
      sources: [{
        sourceKind: 'chat_message',
        sourceId: 'chat-1',
        title: 'Chat 会话',
        filePath: chatPath,
        nativeTextFields: ['content'],
        getRecordId: (record) => record.id,
        getRecordText: (record) => record.content,
        toLegacyResult: ({ source, record, snippet }) => ({
          ownerId: source.sourceId,
          ownerTitle: source.title,
          messageId: record.id,
          ...snippet,
        }),
      }],
    })

    expect(result.searchResult.implementation).toBe('rust-sidecar')
    expect(result.results.map((item) => item.messageId)).toEqual(['chat-hit'])
    expect(result.results[0]?.snippet).toContain('关键字')
  })

  test('native search contract violation 时回退 TypeScript 搜索并保留旧结果', async () => {
    const chatPath = createTempJsonl('chat.jsonl', [
      JSON.stringify({ id: 'chat-hit', role: 'assistant', content: '这里包含关键字和上下文', createdAt: 2 }),
    ])
    const sidecar: NativeEventSearchSidecar = {
      search: async () => {
        throw new NativeRuntimeSidecarError('contract_violation', 'bad native result')
      },
    }
    const service = new TypeScriptEventSearchService({ nativeSearch: sidecar })

    const result = await service.searchFirstMatchPerSource<MessageFixture, LegacyMessageResult>({
      requestId: 'req-native-fallback-search',
      query: '关键字',
      limit: 10,
      sources: [{
        sourceKind: 'chat_message',
        sourceId: 'chat-1',
        title: 'Chat 会话',
        filePath: chatPath,
        nativeTextFields: ['content'],
        getRecordId: (record) => record.id,
        getRecordText: (record) => record.content,
        toLegacyResult: ({ source, record, snippet }) => ({
          ownerId: source.sourceId,
          ownerTitle: source.title,
          messageId: record.id,
          ...snippet,
        }),
      }],
    })

    expect(result.searchResult.implementation).toBe('typescript')
    expect(result.results.map((item) => item.messageId)).toEqual(['chat-hit'])
  })

  test('native 命中只用于定位 cursor，legacy snippet 仍由 TypeScript 规则生成', async () => {
    const content = `${'a'.repeat(60)}KeyWord${'b'.repeat(60)}`
    const chatPath = createTempJsonl('chat.jsonl', [
      JSON.stringify({ id: 'chat-hit', role: 'assistant', content, createdAt: 2 }),
    ])
    const sidecar: NativeEventSearchSidecar = {
      search: async (input) => ({
        requestId: input.requestId,
        query: input.query,
        matches: [{
          id: 'chat-hit',
          sourceKind: 'chat_message',
          title: 'Chat 会话',
          snippet: 'native-short',
          matchedRanges: [{ start: 0, length: 6 }],
          score: 1,
          sessionId: 'chat-1',
          recordId: 'chat-hit',
          cursor: '1',
        }],
        hasMore: false,
        indexState: 'ready',
        implementation: 'rust-sidecar',
        searchedAt: 1764590404000,
      }),
    }
    const service = new TypeScriptEventSearchService({ nativeSearch: sidecar })

    const result = await service.searchMatchesInSource<MessageFixture, LegacyMessageResult>({
      requestId: 'req-native-legacy-snippet',
      query: 'keyword',
      limit: 10,
      filePath: chatPath,
      sourceKind: 'chat_message',
      sourceId: 'chat-1',
      title: 'Chat 会话',
      nativeTextFields: ['content'],
      getRecordId: (record) => record.id,
      getRecordText: (record) => record.content,
      toLegacyResult: ({ source, record, snippet }) => ({
        ownerId: source.sourceId,
        ownerTitle: source.title,
        messageId: record.id,
        ...snippet,
      }),
    })

    expect(result.searchResult.implementation).toBe('rust-sidecar')
    expect(result.matches[0]?.snippet.startsWith('...')).toBe(true)
    expect(result.matches[0]?.snippet).not.toBe('native-short')
    expect(result.matches[0]?.matchStart).toBe(43)
    expect(result.searchResult.matches[0]?.matchedRanges).toEqual([{ start: 43, length: 7 }])
  })

  test('native path_denied 这类拒绝错误不会被 TypeScript fallback 绕过', async () => {
    const chatPath = createTempJsonl('chat.jsonl', [
      JSON.stringify({ id: 'chat-hit', role: 'assistant', content: '这里包含关键字', createdAt: 2 }),
    ])
    const sidecar: NativeEventSearchSidecar = {
      search: async () => {
        throw new NativeRuntimeSidecarError('path_denied', 'native 拒绝读取路径')
      },
    }
    const service = new TypeScriptEventSearchService({ nativeSearch: sidecar })

    try {
      await service.searchMatchesInSource<MessageFixture, LegacyMessageResult>({
        requestId: 'req-native-path-denied',
        query: '关键字',
        limit: 10,
        filePath: chatPath,
        sourceKind: 'chat_message',
        sourceId: 'chat-1',
        title: 'Chat 会话',
        nativeTextFields: ['content'],
        getRecordId: (record) => record.id,
        getRecordText: (record) => record.content,
        toLegacyResult: ({ source, record, snippet }) => ({
          ownerId: source.sourceId,
          ownerTitle: source.title,
          messageId: record.id,
          ...snippet,
        }),
      })
      throw new Error('search should preserve native rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(NativeRuntimeSidecarError)
      expect((error as NativeRuntimeSidecarError).code).toBe('path_denied')
    }
  })
})
