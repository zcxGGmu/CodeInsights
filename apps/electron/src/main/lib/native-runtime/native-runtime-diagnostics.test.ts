import { describe, expect, test } from 'bun:test'
import {
  buildNativeRuntimeDiagnostics,
  buildNativeRuntimeStatus,
  getNativeRuntimeDiagnostics,
} from './native-runtime-diagnostics'

describe('native-runtime-diagnostics', () => {
  test('默认使用 TypeScript fallback 且 native 保持关闭', () => {
    const status = buildNativeRuntimeStatus({ checkedAt: 1764590401000 })

    expect(status).toMatchObject({
      available: true,
      nativeEnabled: false,
      implementation: 'typescript',
      protocolVersion: 1,
      cacheSchemaVersion: 1,
      fallbackReason: 'disabled',
      checkedAt: 1764590401000,
    })
    expect(status.capabilities).toEqual(['diagnostics'])
    expect(status.binaryPath).toBeUndefined()
  })

  test('diagnostics 暴露能力清单和可恢复 fallback 原因', () => {
    const diagnostics = buildNativeRuntimeDiagnostics({ checkedAt: 1764590402000 })

    expect(diagnostics.status.implementation).toBe('typescript')
    expect(diagnostics.status.nativeEnabled).toBe(false)
    expect(diagnostics.fallbackReason).toBe('disabled')
    expect(diagnostics.lastError).toMatchObject({
      code: 'disabled',
      recoverable: true,
    })
    expect(diagnostics.capabilities).toEqual([
      {
        capability: 'diagnostics',
        available: true,
        implementation: 'typescript',
      },
    ])
  })

  test('异步入口返回同一份 diagnostics 结构', async () => {
    const diagnostics = await getNativeRuntimeDiagnostics()

    expect(diagnostics.status.implementation).toBe('typescript')
    expect(diagnostics.status.nativeEnabled).toBe(false)
    expect(diagnostics.status.capabilities).toContain('diagnostics')
  })
})
