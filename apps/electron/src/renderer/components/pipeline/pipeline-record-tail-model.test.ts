import { describe, expect, test } from 'bun:test'
import type { PipelineRecord } from '@codeinsights/shared'
import {
  mergePipelineRecordsTail,
  prependPipelineRecordsTail,
  resetPipelineRecordsTailLoadState,
  shouldApplyPipelineRecordsOlderLoad,
  shouldApplyPipelineRecordsTailLoad,
} from './pipeline-record-tail-model'

function userRecord(id: string): PipelineRecord {
  return {
    id,
    sessionId: 'session-1',
    type: 'user_input',
    content: id,
    createdAt: 1,
  }
}

describe('pipeline-record-tail-model', () => {
  test('只允许最新 tail 请求提交，避免旧请求覆盖新 records', () => {
    expect(shouldApplyPipelineRecordsTailLoad({
      loadId: 1,
      latestLoadId: 2,
      afterIndex: 0,
      currentCursor: 0,
    })).toBe(false)

    expect(shouldApplyPipelineRecordsTailLoad({
      loadId: 2,
      latestLoadId: 2,
      afterIndex: 0,
      currentCursor: 2,
    })).toBe(false)

    expect(shouldApplyPipelineRecordsTailLoad({
      loadId: 2,
      latestLoadId: 2,
      afterIndex: 2,
      currentCursor: 2,
    })).toBe(true)
  })

  test('增量 records 合并按 id 去重并追加', () => {
    const prev = [userRecord('record-1'), userRecord('record-2')]
    const merged = mergePipelineRecordsTail(prev, [
      userRecord('record-2'),
      userRecord('record-3'),
    ], 2)

    expect(merged.map((record) => record.id)).toEqual(['record-1', 'record-2', 'record-3'])
  })

  test('更早 records 合并按 id 去重并前置', () => {
    const prev = [userRecord('record-3'), userRecord('record-4')]
    const merged = prependPipelineRecordsTail(prev, [
      userRecord('record-1'),
      userRecord('record-3'),
      userRecord('record-2'),
    ])

    expect(merged.map((record) => record.id)).toEqual(['record-1', 'record-2', 'record-3', 'record-4'])
  })

  test('切换 session 后重置 cursor 并让旧 tail load 失效', () => {
    const reset = resetPipelineRecordsTailLoadState({
      cursor: 12,
      latestLoadId: 4,
    })

    expect(reset).toEqual({
      cursor: 0,
      latestLoadId: 5,
    })
    expect(shouldApplyPipelineRecordsTailLoad({
      loadId: 4,
      latestLoadId: reset.latestLoadId,
      afterIndex: 12,
      currentCursor: reset.cursor,
    })).toBe(false)
  })

  test('更早 records 请求只允许当前 session 的最新 load 落地', () => {
    expect(shouldApplyPipelineRecordsOlderLoad({
      loadId: 2,
      latestLoadId: 3,
      loadSessionId: 'session-a',
      currentSessionId: 'session-a',
    })).toBe(false)

    expect(shouldApplyPipelineRecordsOlderLoad({
      loadId: 3,
      latestLoadId: 3,
      loadSessionId: 'session-a',
      currentSessionId: 'session-b',
    })).toBe(false)

    expect(shouldApplyPipelineRecordsOlderLoad({
      loadId: 3,
      latestLoadId: 3,
      loadSessionId: 'session-a',
      currentSessionId: 'session-a',
    })).toBe(true)
  })
})
