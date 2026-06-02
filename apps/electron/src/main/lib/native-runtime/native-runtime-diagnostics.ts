import type {
  NativeCapability,
  NativeRuntimeCapabilityDiagnostic,
  NativeRuntimeDiagnostics,
  NativeRuntimeError,
  NativeRuntimeOperationState,
  NativeRuntimeStatus,
} from '@codeinsights/shared'

export const NATIVE_RUNTIME_PROTOCOL_VERSION = 1
export const NATIVE_RUNTIME_CACHE_SCHEMA_VERSION = 1

const TYPESCRIPT_FALLBACK_CAPABILITIES: NativeCapability[] = ['diagnostics', 'jsonl-tail', 'workspace-index']

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
    capabilities: [...TYPESCRIPT_FALLBACK_CAPABILITIES],
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

function redactNativeRuntimeText(value: string): string {
  return value
    .replace(/Bearer\s+[^"'`\s<>]+/gi, 'Bearer [redacted]')
    .replace(/Authorization:\s*[^"'`\n\r]+/gi, 'Authorization: [redacted]')
    .replace(/https?:\/\/([^:@/\s]+):([^@/\s]+)@/gi, (match) => {
      const protocol = match.startsWith('https://') ? 'https://' : 'http://'
      return `${protocol}[redacted]@`
    })
    .replace(/\/Users\/[^/\s]+/g, '[home]')
    .replace(/\/home\/[^/\s]+/g, '[home]')
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, '[home]')
}

function sanitizeError(error: NativeRuntimeError | undefined): NativeRuntimeError | undefined {
  if (!error) return undefined
  return {
    ...error,
    message: redactNativeRuntimeText(error.message),
    detail: error.detail ? redactNativeRuntimeText(error.detail) : undefined,
  }
}

export function sanitizeNativeRuntimeStatus(status: NativeRuntimeStatus): NativeRuntimeStatus {
  const { binaryPath: _binaryPath, ...safeStatus } = status
  return {
    ...safeStatus,
    lastError: sanitizeError(status.lastError),
  }
}

export function sanitizeNativeRuntimeDiagnostics(
  diagnostics: NativeRuntimeDiagnostics,
): NativeRuntimeDiagnostics {
  return {
    ...diagnostics,
    status: sanitizeNativeRuntimeStatus(diagnostics.status),
    lastError: sanitizeError(diagnostics.lastError),
  }
}

export function sanitizeNativeRuntimeOperationState(
  state: NativeRuntimeOperationState,
): NativeRuntimeOperationState {
  return {
    ...state,
    message: state.message ? redactNativeRuntimeText(state.message) : undefined,
    error: sanitizeError(state.error),
  }
}
