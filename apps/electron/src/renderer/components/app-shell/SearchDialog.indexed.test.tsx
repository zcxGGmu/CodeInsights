import { describe, expect, test } from 'bun:test'
import {
  buildSearchDialogContentGroups,
  buildSearchDialogContentResults,
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
      ['chat', 'chat-content-hit', 'message-2'],
      ['agent', 'agent-content-hit', 'agent-message-1'],
    ])
    expect(results[0]?.matchStart).toBe(13)
    expect(results[0]?.matchLength).toBe(2)

    const groups = buildSearchDialogContentGroups(results)
    expect(groups.map((group) => [group.type, group.label, group.results.length])).toEqual([
      ['pipeline', 'Pipeline 记录', 1],
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
})
