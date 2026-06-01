import { describe, expect, test } from 'bun:test'
import {
  getTypeScriptEventSearchService,
  nativeRuntimeService,
} from './native-runtime-service'
import { TypeScriptEventSearchService } from './ts-event-search-service'

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
})
