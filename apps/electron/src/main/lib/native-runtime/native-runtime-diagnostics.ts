import type {
  NativeCapability,
  NativeRuntimeCapabilityDiagnostic,
  NativeRuntimeDiagnostics,
  NativeRuntimeError,
  NativeRuntimeStatus,
} from '@codeinsights/shared'

export const NATIVE_RUNTIME_PROTOCOL_VERSION = 1
export const NATIVE_RUNTIME_CACHE_SCHEMA_VERSION = 1

const TYPESCRIPT_CAPABILITIES: NativeCapability[] = ['diagnostics']

const DISABLED_FALLBACK_ERROR: NativeRuntimeError = {
  code: 'disabled',
  message: 'Native runtime 默认关闭，当前使用 TypeScript fallback。',
  recoverable: true,
}

interface BuildDiagnosticsOptions {
  checkedAt?: number
}

export function buildNativeRuntimeStatus(
  options: BuildDiagnosticsOptions = {},
): NativeRuntimeStatus {
  const checkedAt = options.checkedAt ?? Date.now()

  return {
    available: true,
    nativeEnabled: false,
    implementation: 'typescript',
    protocolVersion: NATIVE_RUNTIME_PROTOCOL_VERSION,
    cacheSchemaVersion: NATIVE_RUNTIME_CACHE_SCHEMA_VERSION,
    capabilities: [...TYPESCRIPT_CAPABILITIES],
    fallbackReason: 'disabled',
    lastError: DISABLED_FALLBACK_ERROR,
    checkedAt,
  }
}

export function buildNativeRuntimeDiagnostics(
  options: BuildDiagnosticsOptions = {},
): NativeRuntimeDiagnostics {
  const status = buildNativeRuntimeStatus(options)
  const capabilities: NativeRuntimeCapabilityDiagnostic[] = status.capabilities.map((capability) => ({
    capability,
    available: true,
    implementation: status.implementation,
  }))

  return {
    status,
    protocolVersion: NATIVE_RUNTIME_PROTOCOL_VERSION,
    cacheSchemaVersion: NATIVE_RUNTIME_CACHE_SCHEMA_VERSION,
    capabilities,
    fallbackReason: status.fallbackReason,
    lastError: status.lastError,
    checkedAt: status.checkedAt,
  }
}

export async function getNativeRuntimeDiagnostics(): Promise<NativeRuntimeDiagnostics> {
  return buildNativeRuntimeDiagnostics()
}
