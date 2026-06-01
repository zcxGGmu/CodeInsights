import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getTypeScriptEventSearchService,
  nativeRuntimeService,
} from './native-runtime-service'
import { TypeScriptEventSearchService } from './ts-event-search-service'
import { appendPipelineRecord, createPipelineSession } from '../pipeline-session-manager'

const tempDirs: string[] = []
const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR

afterEach(() => {
  if (originalConfigDir == null) {
    delete process.env.CODEINSIGHTS_CONFIG_DIR
  } else {
    process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
  }

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('native-runtime-service', () => {
  test('默认 facade 暴露 TypeScript diagnostics 和 EventSearchService', async () => {
    const status = await nativeRuntimeService.getStatus()

    expect(status).toMatchObject({
      available: true,
      nativeEnabled: false,
      implementation: 'typescript',
      fallbackReason: 'disabled',
    })
    expect(getTypeScriptEventSearchService()).toBeInstanceOf(TypeScriptEventSearchService)
  })

  test('通用 native search IPC 尚未注册时不静默返回空结果', async () => {
    await expect(nativeRuntimeService.search({
      requestId: 'req-native-search',
      query: '关键字',
      scope: ['chat'],
      limit: 10,
    })).rejects.toThrow('Native Runtime search 尚未接入 TypeScript facade')
  })

  test('tailJsonl backward 返回请求方向上的下一 cursor', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-service-'))
    tempDirs.push(configDir)
    process.env.CODEINSIGHTS_CONFIG_DIR = configDir
    const session = createPipelineSession('native tail cursor 测试', 'channel-1', 'workspace-1')

    for (let index = 0; index < 5; index += 1) {
      appendPipelineRecord(session.id, {
        id: `record-${index}`,
        sessionId: session.id,
        type: 'user_input',
        content: `任务 ${index}`,
        createdAt: index,
      })
    }

    const latest = await nativeRuntimeService.tailJsonl({
      requestId: 'tail-backward-latest',
      fileKind: 'pipeline-records',
      sessionId: session.id,
      direction: 'backward',
      limit: 2,
    })
    const older = await nativeRuntimeService.tailJsonl({
      requestId: 'tail-backward-older',
      fileKind: 'pipeline-records',
      sessionId: session.id,
      direction: 'backward',
      cursor: latest.nextCursor,
      limit: 2,
    })

    expect(latest.records.map((record) => (record as { id: string }).id)).toEqual(['record-3', 'record-4'])
    expect(older.records.map((record) => (record as { id: string }).id)).toEqual(['record-1', 'record-2'])
  })

  test('indexWorkspace 使用 shared contract rootPath 构建 TypeScript workspace index', async () => {
    const root = mkdtempSync(join(tmpdir(), 'codeinsights-native-runtime-workspace-index-'))
    tempDirs.push(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'target.ts'), '', 'utf-8')

    const result = await nativeRuntimeService.indexWorkspace({
      requestId: 'workspace-index-contract',
      workspaceId: 'workspace-1',
      rootPath: root,
      force: true,
    })

    expect(result).toMatchObject({
      requestId: 'workspace-index-contract',
      workspaceId: 'workspace-1',
      indexedFiles: 1,
      status: 'ready',
      implementation: 'typescript',
    })
  })
})
