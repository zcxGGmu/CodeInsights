import { describe, expect, test } from 'bun:test'
import {
  buildSearchDialogContentGroups,
  buildSearchDialogContentResults,
  buildSearchDialogRuntimeStatus,
  filterSearchDialogResultsBySource,
  limitSearchDialogContentGroups,
  resolveSearchDialogResultIndex,
  shouldApplySearchDialogContentResults,
} from './SearchDialog'

describe('SearchDialog indexed content model', () => {
  test('把 Chat / Agent / Pipeline 内容结果归一化并按来源分组', () => {
    const results = buildSearchDialogContentResults({
      query: '构建',
      titleIds: new Set(['chat-title-hit', 'pipeline-content-hit']),
      chatResults: [
        {
          conversationId: 'chat-title-hit',
          conversationTitle: '标题已命中',
          messageId: 'message-1',
          role: 'user',
          snippet: '标题重复内容',
          matchStart: 0,
          matchLength: 2,
        },
        {
          conversationId: 'chat-content-hit',
          conversationTitle: 'Chat 内容命中',
          messageId: 'message-2',
          role: 'assistant',
          snippet: '这里有构建失败',
          matchStart: 3,
          matchLength: 2,
        },
      ],
      agentResults: [
        {
          sessionId: 'agent-content-hit',
          sessionTitle: 'Agent 内容命中',
          messageId: 'agent-message-1',
          role: 'assistant',
          snippet: 'Agent 发现构建失败',
          matchStart: 8,
          matchLength: 2,
        },
      ],
      workspaceResults: [
        {
          name: 'build-report.md',
          path: 'docs/build-report.md',
          type: 'file',
          size: 1024,
          mtimeMs: 1764590400000,
        },
      ],
      pipelineResults: [
        {
          sessionId: 'pipeline-content-hit',
          sessionTitle: 'Pipeline 内容命中',
          archived: false,
          recordId: 'pipeline-record-1',
          recordType: 'node_output',
          stage: 'developer',
          title: '开发输出',
          snippet: 'Pipeline 记录包含构建失败',
          matchStart: 13,
          matchLength: 2,
          createdAt: 1,
        },
      ],
    })

    expect(results.map((result) => [result.type, result.id, result.recordId])).toEqual([
      ['pipeline', 'pipeline-content-hit', 'pipeline-record-1'],
      ['workspace', 'docs/build-report.md', 'docs/build-report.md'],
      ['chat', 'chat-content-hit', 'message-2'],
      ['agent', 'agent-content-hit', 'agent-message-1'],
    ])
    expect(results[0]?.matchStart).toBe(13)
    expect(results[0]?.matchLength).toBe(2)

    const groups = buildSearchDialogContentGroups(results)
    expect(groups.map((group) => [group.type, group.label, group.results.length])).toEqual([
      ['pipeline', 'Pipeline 记录', 1],
      ['workspace', 'Workspace 文件', 1],
      ['chat', 'Chat 消息', 1],
      ['agent', 'Agent 消息', 1],
    ])
  })

  test('request generation 只允许最新内容搜索结果落地', () => {
    expect(shouldApplySearchDialogContentResults({
      requestId: 1,
      latestRequestId: 2,
      open: true,
    })).toBe(false)
    expect(shouldApplySearchDialogContentResults({
      requestId: 2,
      latestRequestId: 2,
      open: false,
    })).toBe(false)
    expect(shouldApplySearchDialogContentResults({
      requestId: 2,
      latestRequestId: 2,
      open: true,
    })).toBe(true)
  })

  test('source filter 同时过滤内容结果并保留全部模式', () => {
    const results = buildSearchDialogContentResults({
      query: '构建',
      titleIds: new Set(),
      chatResults: [{
        conversationId: 'chat-hit',
        conversationTitle: 'Chat',
        messageId: 'message-1',
        role: 'user',
        snippet: '构建',
        matchStart: 0,
        matchLength: 2,
      }],
      agentResults: [{
        sessionId: 'agent-hit',
        sessionTitle: 'Agent',
        messageId: 'message-2',
        role: 'assistant',
        snippet: '构建',
        matchStart: 0,
        matchLength: 2,
      }],
      pipelineResults: [{
        sessionId: 'pipeline-hit',
        sessionTitle: 'Pipeline',
        archived: false,
        recordId: 'record-1',
        recordType: 'node_output',
        stage: 'developer',
        title: '开发输出',
        snippet: '构建',
        matchStart: 0,
        matchLength: 2,
        createdAt: 1,
      }],
      workspaceResults: [{
        name: 'build.md',
        path: 'docs/build.md',
        type: 'file',
      }],
    })

    expect(filterSearchDialogResultsBySource(results, 'all')).toHaveLength(4)
    expect(filterSearchDialogResultsBySource(results, 'workspace').map((result) => result.id)).toEqual(['docs/build.md'])
    expect(filterSearchDialogResultsBySource(results, 'agent').map((result) => result.id)).toEqual(['agent-hit'])
  })

  test('source filter 后内容结果索引只按可见标题数量偏移', () => {
    expect(resolveSearchDialogResultIndex({
      visibleTitleCount: 0,
      contentGroupOffset: 0,
      contentResultOffset: 0,
    })).toBe(0)

    expect(resolveSearchDialogResultIndex({
      visibleTitleCount: 2,
      contentGroupOffset: 3,
      contentResultOffset: 1,
    })).toBe(6)
  })

  test('内容分组限制每组展示数量并返回更多结果计数', () => {
    const groups = buildSearchDialogContentGroups([
      {
        id: 'workspace-1',
        title: 'a.ts',
        type: 'workspace',
        snippet: 'a.ts',
        matchStart: 0,
        matchLength: 1,
      },
      {
        id: 'workspace-2',
        title: 'b.ts',
        type: 'workspace',
        snippet: 'b.ts',
        matchStart: 0,
        matchLength: 1,
      },
      {
        id: 'workspace-3',
        title: 'c.ts',
        type: 'workspace',
        snippet: 'c.ts',
        matchStart: 0,
        matchLength: 1,
      },
    ])

    const limited = limitSearchDialogContentGroups(groups, 2)

    expect(limited[0]?.results.map((result) => result.id)).toEqual(['workspace-1', 'workspace-2'])
    expect(limited[0]?.hiddenCount).toBe(1)
  })

  test('native runtime 状态在搜索界面只生成简短 fallback / rebuilding 文案', () => {
    const status = {
      available: true,
      nativeEnabled: false,
      implementation: 'typescript' as const,
      protocolVersion: 1,
      cacheSchemaVersion: 1,
      capabilities: ['diagnostics' as const, 'workspace-index' as const],
      fallbackReason: 'disabled' as const,
      checkedAt: 1,
    }
    const fallback = buildSearchDialogRuntimeStatus({
      status,
      activeOperations: [],
      lastError: null,
    })
    const rebuilding = buildSearchDialogRuntimeStatus({
      status,
      activeOperations: [{
        operationId: 'operation-1',
        requestId: 'request-1',
        workspaceId: 'workspace-1',
        kind: 'index_rebuild',
        phase: 'indexing',
        startedAt: 1,
        source: 'typescript',
      }],
      lastError: null,
    })

    expect(fallback.label).toBe('TypeScript fallback')
    expect(fallback.tone).toBe('fallback')
    expect(rebuilding.label).toBe('索引重建中')
    expect(rebuilding.tone).toBe('rebuilding')
  })
})
