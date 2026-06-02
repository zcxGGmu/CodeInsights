import { describe, expect, test } from 'bun:test'
import {
  buildNativeRuntimeDiagnostics,
  buildNativeRuntimeStatus,
  getNativeRuntimeDiagnostics,
  sanitizeNativeRuntimeDiagnostics,
  sanitizeNativeRuntimeStatus,
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
    expect(status.capabilities).toEqual(['diagnostics', 'jsonl-tail', 'workspace-index'])
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
    expect(diagnostics.capabilities.map((item) => item.capability)).toEqual([
      'diagnostics',
      'jsonl-tail',
      'workspace-index',
    ])
  })

  test('异步入口返回同一份 diagnostics 结构', async () => {
    const diagnostics = await getNativeRuntimeDiagnostics()

    expect(diagnostics.status.implementation).toBe('typescript')
    expect(diagnostics.status.nativeEnabled).toBe(false)
    expect(diagnostics.status.capabilities).toContain('diagnostics')
  })

  test('状态与 diagnostics 推送前会移除路径并脱敏错误详情', () => {
    const unsafeStatus = {
      ...buildNativeRuntimeStatus({ checkedAt: 1764590403000 }),
      binaryPath: '/Users/demo/.codeinsights/native-cache/native-helper',
      lastError: {
        code: 'io_error' as const,
        message: '读取失败 /Users/demo/.codeinsights/token Bearer secret-token',
        detail: 'Authorization: Bearer secret-token https://user:pass@example.com/repo.git',
        recoverable: true,
      },
    }
    const status = sanitizeNativeRuntimeStatus(unsafeStatus)
    const diagnostics = sanitizeNativeRuntimeDiagnostics({
      ...buildNativeRuntimeDiagnostics({ checkedAt: 1764590403000 }),
      status: unsafeStatus,
      lastError: unsafeStatus.lastError,
    })

    expect(status.binaryPath).toBeUndefined()
    expect(status.lastError?.message).not.toContain('/Users/demo')
    expect(status.lastError?.message).not.toContain('secret-token')
    expect(diagnostics.status.binaryPath).toBeUndefined()
    expect(diagnostics.lastError?.detail).not.toContain('user:pass')
    expect(diagnostics.lastError?.detail).toContain('[redacted]')
  })
})
