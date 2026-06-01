import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  appendPipelineRecord,
  createPipelineSession,
  getPipelineRecords,
  getPipelineRecordsTail,
  getPipelineSessionMeta,
  listPipelineSessions,
  searchPipelineRecordsPage,
} from './pipeline-session-manager'

describe('pipeline-session-manager', () => {
  const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  let tempConfigDir = ''

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-session-'))
    process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
  })

  afterEach(() => {
    if (originalConfigDir == null) {
      delete process.env.CODEINSIGHTS_CONFIG_DIR
    } else {
      process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
    }

    rmSync(tempConfigDir, { recursive: true, force: true })
  })

  test('创建会话后可追加并读取 JSONL 记录', () => {
    const session = createPipelineSession('测试会话', 'channel-1', 'workspace-1')

    appendPipelineRecord(session.id, {
      id: 'record-1',
      sessionId: session.id,
      type: 'user_input',
      content: '请帮我找一个 RISC-V 贡献点',
      createdAt: Date.now(),
    })

    const records = getPipelineRecords(session.id)
    expect(records).toHaveLength(1)
    expect(records[0]?.type).toBe('user_input')
  })

  test('创建 v2 会话会持久化 version，旧调用保持 v1 兼容语义', () => {
    const legacy = createPipelineSession('旧 Pipeline', 'channel-1', 'workspace-1')
    const contribution = createPipelineSession('贡献 Pipeline', 'channel-1', 'workspace-1', 2)

    expect(legacy.version).toBeUndefined()
    expect(contribution.version).toBe(2)
    expect(getPipelineSessionMeta(contribution.id)?.version).toBe(2)
  })

  test('拒绝非法 Pipeline version', () => {
    expect(() => createPipelineSession(
      '非法版本',
      'channel-1',
      'workspace-1',
      3 as 1,
    )).toThrow('无效 Pipeline 版本')
  })

  test('updatedAt 新的会话排在前面', async () => {
    const first = createPipelineSession('旧会话', 'channel-1', 'workspace-1')
    await new Promise((resolve) => setTimeout(resolve, 2))
    const second = createPipelineSession('新会话', 'channel-1', 'workspace-1')

    const sessions = listPipelineSessions()
    expect(sessions[0]?.id).toBe(second.id)
    expect(sessions[1]?.id).toBe(first.id)
  })

  test('getPipelineRecordsTail 会按 append 顺序返回增量 records', () => {
    const session = createPipelineSession('增量记录测试', 'channel-1', 'workspace-1')

    for (let index = 0; index < 3; index += 1) {
      appendPipelineRecord(session.id, {
        id: `record-${index}`,
        sessionId: session.id,
        type: 'user_input',
        content: `任务 ${index}`,
        createdAt: index + 1,
      })
    }

    const firstPage = getPipelineRecordsTail({
      sessionId: session.id,
      afterIndex: 0,
      limit: 2,
    })
    const secondPage = getPipelineRecordsTail({
      sessionId: session.id,
      afterIndex: firstPage.nextIndex,
      limit: 2,
    })

    expect(firstPage.records.map((record) => record.id)).toEqual(['record-0', 'record-1'])
    expect(firstPage.nextIndex).toBe(2)
    expect(firstPage.hasMore).toBe(true)
    expect(secondPage.records.map((record) => record.id)).toEqual(['record-2'])
    expect(secondPage.nextIndex).toBe(3)
    expect(secondPage.hasMore).toBe(false)
  })

  test('getPipelineRecordsTail 对空会话返回稳定 cursor', () => {
    const session = createPipelineSession('空记录测试', 'channel-1', 'workspace-1')

    const result = getPipelineRecordsTail({
      sessionId: session.id,
      afterIndex: 20,
      limit: 20,
    })

    expect(result).toMatchObject({
      sessionId: session.id,
      records: [],
      nextIndex: 0,
      hasMore: false,
    })
  })

  test('appendPipelineRecord 复用 shared replay patch 更新 pendingGate 和终态', () => {
    const session = createPipelineSession('replay patch 测试', 'channel-1', 'workspace-1')

    appendPipelineRecord(session.id, {
      id: 'gate-request',
      sessionId: session.id,
      type: 'gate_requested',
      node: 'tester',
      gateId: 'gate-1',
      title: '测试待确认',
      summary: '验证通过',
      feedbackHint: '确认后完成',
      iteration: 1,
      createdAt: 1,
    })

    const waitingMeta = getPipelineSessionMeta(session.id)
    expect(waitingMeta?.status).toBe('waiting_human')
    expect(waitingMeta?.pendingGate).toMatchObject({
      gateId: 'gate-1',
      title: '测试待确认',
      iteration: 1,
    })

    appendPipelineRecord(session.id, {
      id: 'gate-decision',
      sessionId: session.id,
      type: 'gate_decision',
      node: 'tester',
      action: 'approve',
      createdAt: 2,
    })

    const completedMeta = getPipelineSessionMeta(session.id)
    expect(completedMeta?.status).toBe('completed')
    expect(completedMeta?.lastApprovedNode).toBe('tester')
    expect(completedMeta?.pendingGate).toBeNull()
  })

  test('searchPipelineRecordsPage 支持阶段过滤和稳定分页', async () => {
    const session = createPipelineSession('搜索分页测试', 'channel-1', 'workspace-1')

    appendPipelineRecord(session.id, {
      id: 'input-1',
      sessionId: session.id,
      type: 'user_input',
      content: '优化 Pipeline 搜索',
      createdAt: 1,
    })
    appendPipelineRecord(session.id, {
      id: 'developer-output',
      sessionId: session.id,
      type: 'node_output',
      node: 'developer',
      summary: '构建失败',
      content: '构建失败：ts 类型错误',
      createdAt: 2,
    })
    appendPipelineRecord(session.id, {
      id: 'developer-error',
      sessionId: session.id,
      type: 'error',
      node: 'developer',
      error: '构建失败：缺少导出',
      createdAt: 3,
    })
    appendPipelineRecord(session.id, {
      id: 'tester-output',
      sessionId: session.id,
      type: 'node_output',
      node: 'tester',
      summary: '构建失败回归验证',
      content: '测试节点也提到了构建失败',
      createdAt: 4,
    })

    const firstPage = await searchPipelineRecordsPage({
      sessionId: session.id,
      query: '构建失败',
      stage: 'developer',
      offset: 0,
      limit: 1,
    })
    const secondPage = await searchPipelineRecordsPage({
      sessionId: session.id,
      query: '构建失败',
      stage: 'developer',
      offset: firstPage.nextOffset,
      limit: 1,
    })

    expect(firstPage.total).toBe(2)
    expect(firstPage.hasMore).toBe(true)
    expect(firstPage.matches.map((match) => match.recordId)).toEqual(['developer-output'])
    expect(secondPage.matches.map((match) => match.recordId)).toEqual(['developer-error'])
    expect(secondPage.hasMore).toBe(false)
  })

  test('searchPipelineRecordsPage 只返回定位摘要，不回传整条大 record 内容', async () => {
    const session = createPipelineSession('搜索摘要测试', 'channel-1', 'workspace-1')
    const longContent = `搜索命中 ${'很长的上下文'.repeat(200)}`

    appendPipelineRecord(session.id, {
      id: 'large-output',
      sessionId: session.id,
      type: 'node_output',
      node: 'developer',
      summary: '搜索命中',
      content: longContent,
      createdAt: 1,
    })

    const result = await searchPipelineRecordsPage({
      sessionId: session.id,
      query: '搜索命中',
      limit: 20,
    })

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.snippet.length).toBeLessThan(180)
    expect(JSON.stringify(result)).not.toContain(longContent)
  })

  test('searchPipelineRecordsPage 跳过坏 JSONL 行并继续返回命中', async () => {
    const session = createPipelineSession('坏行搜索测试', 'channel-1', 'workspace-1')

    appendFileSync(
      join(tempConfigDir, 'pipeline-sessions', `${session.id}.jsonl`),
      '{bad json\n',
      'utf-8',
    )
    appendPipelineRecord(session.id, {
      id: 'valid-output',
      sessionId: session.id,
      type: 'node_output',
      node: 'developer',
      summary: '构建失败',
      content: '坏行后仍然可以搜索构建失败',
      createdAt: 1,
    })

    const result = await searchPipelineRecordsPage({
      sessionId: session.id,
      query: '构建失败',
      limit: 20,
    })

    expect(result.matches.map((match) => match.recordId)).toEqual(['valid-output'])
  })

  test('searchPipelineRecordsPage 的 tab 归属与前端阶段产物 fallback 规则一致', async () => {
    const session = createPipelineSession('搜索页签归属测试', 'channel-1', 'workspace-1')

    appendPipelineRecord(session.id, {
      id: 'developer-output',
      sessionId: session.id,
      type: 'node_output',
      node: 'developer',
      summary: 'fallback 产物',
      content: 'fallback 产物详情',
      createdAt: 1,
    })
    appendPipelineRecord(session.id, {
      id: 'tester-output',
      sessionId: session.id,
      type: 'node_output',
      node: 'tester',
      summary: '已有结构化产物时留在日志',
      content: '已有结构化产物时留在日志详情',
      createdAt: 2,
    })
    appendPipelineRecord(session.id, {
      id: 'tester-artifact',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'tester',
      artifact: {
        node: 'tester',
        summary: 'tester 阶段产物',
        commands: [],
        results: [],
        blockers: [],
        content: 'tester 阶段产物详情',
      },
      createdAt: 3,
    })

    const result = await searchPipelineRecordsPage({
      sessionId: session.id,
      query: '产物',
      limit: 20,
    })

    expect(result.matches.map((match) => [match.recordId, match.tab])).toEqual([
      ['developer-output', 'artifacts'],
      ['tester-output', 'logs'],
      ['tester-artifact', 'artifacts'],
    ])
  })
})
