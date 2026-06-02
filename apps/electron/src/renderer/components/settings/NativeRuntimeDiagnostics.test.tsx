import { describe, expect, test } from 'bun:test'
import type { NativeRuntimeDiagnostics } from '@codeinsights/shared'
import {
  buildNativeRuntimeDiagnosticsCopy,
  buildNativeRuntimeDiagnosticsViewModel,
  resolveNativeRuntimeClearCacheAction,
} from './NativeRuntimeDiagnostics'

function diagnostics(overrides: Partial<NativeRuntimeDiagnostics> = {}): NativeRuntimeDiagnostics {
  return {
    status: {
      available: true,
      nativeEnabled: false,
      implementation: 'typescript',
      protocolVersion: 1,
      cacheSchemaVersion: 1,
      binaryPath: '/Users/demo/.codeinsights/native-cache/native-helper',
      capabilities: ['diagnostics', 'workspace-index'],
      fallbackReason: 'disabled',
      lastError: {
        code: 'disabled',
        message: 'Native runtime 默认关闭，Bearer secret',
        detail: 'Authorization: Bearer secret https://user:pass@example.com/repo.git /Users/demo/.codeinsights',
        recoverable: true,
      },
      checkedAt: 1764590400000,
    },
    protocolVersion: 1,
    cacheSchemaVersion: 1,
    capabilities: [
      { capability: 'diagnostics', available: true, implementation: 'typescript' },
      { capability: 'workspace-index', available: true, implementation: 'typescript' },
    ],
    fallbackReason: 'disabled',
    lastError: {
      code: 'disabled',
      message: 'Native runtime 默认关闭，Bearer secret',
      detail: 'Authorization: Bearer secret https://user:pass@example.com/repo.git /Users/demo/.codeinsights',
      recoverable: true,
    },
    checkedAt: 1764590400000,
    ...overrides,
  }
}

describe('NativeRuntimeDiagnostics model', () => {
  test('TypeScript fallback diagnostics 映射为 warning 状态和能力行', () => {
    const model = buildNativeRuntimeDiagnosticsViewModel(diagnostics())

    expect(model.statusLabel).toBe('TypeScript fallback')
    expect(model.statusTone).toBe('warning')
    expect(model.implementationLabel).toBe('TypeScript')
    expect(model.fallbackLabel).toBe('已禁用 native runtime')
    expect(model.capabilityRows.map((row) => [row.label, row.availableLabel])).toEqual([
      ['Diagnostics', '可用'],
      ['Workspace Index', '可用'],
    ])
  })

  test('复制 diagnostics 时不包含 binaryPath、home path、token 或 credentialed URL', () => {
    const copied = buildNativeRuntimeDiagnosticsCopy(diagnostics())

    expect(copied).not.toContain('binaryPath')
    expect(copied).not.toContain('/Users/demo')
    expect(copied).not.toContain('Bearer secret')
    expect(copied).not.toContain('user:pass')
    expect(copied).toContain('[redacted]')
    expect(copied).toContain('workspace-index')
  })

  test('clear cache 操作需要二次确认且 loading 时禁用', () => {
    expect(resolveNativeRuntimeClearCacheAction({ confirming: false, loading: false })).toEqual({
      label: '清理缓存',
      disabled: false,
      destructive: false,
    })
    expect(resolveNativeRuntimeClearCacheAction({ confirming: true, loading: false })).toEqual({
      label: '确认清理',
      disabled: false,
      destructive: true,
    })
    expect(resolveNativeRuntimeClearCacheAction({ confirming: true, loading: true })).toEqual({
      label: '正在清理',
      disabled: true,
      destructive: true,
    })
  })
})
