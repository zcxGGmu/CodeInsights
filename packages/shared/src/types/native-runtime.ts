/**
 * Native Runtime DTO / IPC 契约草案。
 *
 * Phase 0 仅定义 TypeScript fallback 与未来 native helper 的共享数据边界，
 * 不代表 Rust / Go sidecar 已经实现。
 */

export type NativeImplementationKind = 'typescript' | 'rust-sidecar' | 'rust-napi' | 'go-sidecar'

export type NativeCapability =
  | 'diagnostics'
  | 'indexed-search'
  | 'jsonl-tail'
  | 'workspace-index'
  | 'file-chunk-read'
  | 'path-safety'
  | 'git-output-parse'

export type NativeRuntimeFallbackReason =
  | 'disabled'
  | 'missing_binary'
  | 'version_mismatch'
  | 'contract_violation'
  | 'timeout'
  | 'crashed'
  | 'cache_corrupted'
  | 'unsupported_platform'

export type NativeRuntimeErrorCode =
  | NativeRuntimeFallbackReason
  | 'invalid_input'
  | 'operation_cancelled'
  | 'path_denied'
  | 'io_error'
  | 'unknown'

export type NativeRuntimeIndexState = 'ready' | 'building' | 'stale' | 'fallback'

export type NativeRuntimeOperationKind =
  | 'index_rebuild'
  | 'workspace_scan'
  | 'file_search'
  | 'cache_cleanup'
  | 'jsonl_tail'
  | 'file_chunk_read'

export type NativeRuntimeOperationPhase =
  | 'queued'
  | 'scanning'
  | 'indexing'
  | 'reading'
  | 'writing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type NativeRuntimeSearchScope = 'chat' | 'agent' | 'pipeline' | 'workspace' | 'patch-work'

export type NativeRuntimeSearchSourceKind =
  | NativeRuntimeSearchScope
  | 'chat_message'
  | 'agent_message'
  | 'pipeline_record'
  | 'workspace_file'
  | 'patch_work_file'

export type NativeRuntimeTailFileKind =
  | 'chat-messages'
  | 'agent-messages'
  | 'agent-runtime-events'
  | 'pipeline-records'

export type NativeRuntimeTailDirection = 'forward' | 'backward'

export interface NativeRuntimeError {
  code: NativeRuntimeErrorCode
  message: string
  recoverable: boolean
  detail?: string
}

export interface NativeRuntimeStatus {
  available: boolean
  nativeEnabled: boolean
  implementation: NativeImplementationKind
  version?: string
  protocolVersion: number
  cacheSchemaVersion: number
  binaryPath?: string
  capabilities: NativeCapability[]
  fallbackReason?: NativeRuntimeFallbackReason
  lastError?: NativeRuntimeError
  checkedAt: number
}

export interface NativeRuntimeCapabilityDiagnostic {
  capability: NativeCapability
  available: boolean
  implementation: NativeImplementationKind
  fallbackReason?: NativeRuntimeFallbackReason
  lastError?: NativeRuntimeError
}

export interface NativeRuntimeDiagnostics {
  status: NativeRuntimeStatus
  protocolVersion: number
  cacheSchemaVersion: number
  capabilities: NativeRuntimeCapabilityDiagnostic[]
  fallbackReason?: NativeRuntimeFallbackReason
  lastError?: NativeRuntimeError
  checkedAt: number
}

export interface NativeRuntimeMatchedRange {
  start: number
  length: number
}

export interface NativeRuntimeSearchInput {
  requestId: string
  query: string
  scope: NativeRuntimeSearchScope[]
  limit: number
  cursor?: string
  sessionId?: string
  workspaceId?: string
}

export interface NativeRuntimeSearchMatch {
  id: string
  sourceKind: NativeRuntimeSearchSourceKind
  title: string
  snippet: string
  matchedRanges: NativeRuntimeMatchedRange[]
  score: number
  sessionId?: string
  workspaceId?: string
  recordId?: string
  filePath?: string
  cursor?: string
  updatedAt?: number
}

export interface NativeRuntimeSearchResult {
  requestId: string
  query: string
  matches: NativeRuntimeSearchMatch[]
  cursor?: string
  hasMore: boolean
  indexState: NativeRuntimeIndexState
  implementation: NativeImplementationKind
  searchedAt: number
}

export interface NativeRuntimeTailInput {
  requestId: string
  fileKind: NativeRuntimeTailFileKind
  sessionId: string
  cursor?: string
  limit: number
  direction: NativeRuntimeTailDirection
}

export interface NativeRuntimeTailResult {
  requestId: string
  fileKind: NativeRuntimeTailFileKind
  sessionId: string
  records: unknown[]
  nextCursor?: string
  hasMore: boolean
  implementation: NativeImplementationKind
  readAt: number
}

export interface NativeRuntimeWorkspaceIgnoreSummary {
  directories: string[]
  patterns: string[]
}

export interface NativeRuntimeWorkspaceIndexInput {
  requestId: string
  workspaceId: string
  rootPath: string
  additionalPaths?: string[]
  rootFingerprint?: string
  force?: boolean
}

export interface NativeRuntimeWorkspaceIndexResult {
  requestId: string
  workspaceId: string
  rootFingerprint: string
  ignoreSummary: NativeRuntimeWorkspaceIgnoreSummary
  indexedFiles: number
  status: 'idle' | 'building' | 'ready' | 'stale' | 'failed'
  implementation: NativeImplementationKind
  startedAt: number
  completedAt?: number
}

export interface NativeRuntimeFileChunkReadInput {
  requestId: string
  pathToken: string
  offset: number
  length: number
  encoding?: 'utf-8'
}

export interface NativeRuntimeFileChunkReadResult {
  requestId: string
  pathToken: string
  offset: number
  length: number
  content: string
  encoding: 'utf-8'
  truncated: boolean
  binaryDetected: boolean
  nextOffset?: number
  implementation: NativeImplementationKind
  readAt: number
}

export interface NativeRuntimeOperationRef {
  operationId: string
  kind: NativeRuntimeOperationKind
  startedAt: number
}

export interface NativeRuntimeOperationProgress extends NativeRuntimeOperationRef {
  requestId?: string
  workspaceId?: string
  sessionId?: string
  phase: NativeRuntimeOperationPhase
  completed?: number
  total?: number
  message?: string
  source: NativeImplementationKind
  cancelledAt?: number
  completedAt?: number
  error?: NativeRuntimeError
}

export interface NativeRuntimeOperationState extends NativeRuntimeOperationProgress {}

export interface NativeRuntimeRebuildIndexInput {
  requestId: string
  workspaceId: string
}

export interface NativeRuntimeClearCacheInput {
  requestId: string
}

export const NATIVE_RUNTIME_FEATURE_FLAGS = {
  RUNTIME: 'CODEINSIGHTS_NATIVE_RUNTIME',
  SEARCH: 'CODEINSIGHTS_NATIVE_SEARCH',
} as const

export const NATIVE_RUNTIME_IPC_CHANNELS = {
  GET_STATUS: 'native-runtime:get-status',
  GET_DIAGNOSTICS: 'native-runtime:get-diagnostics',
  REBUILD_INDEX: 'native-runtime:rebuild-index',
  CLEAR_CACHE: 'native-runtime:clear-cache',
  SEARCH: 'native-runtime:search',
  TAIL_JSONL: 'native-runtime:tail-jsonl',
  READ_FILE_CHUNK: 'native-runtime:read-file-chunk',
  GET_OPERATION_STATE: 'native-runtime:get-operation-state',
  CANCEL_OPERATION: 'native-runtime:cancel-operation',
  ON_PROGRESS: 'native-runtime:on-progress',
  ON_STATUS_CHANGED: 'native-runtime:on-status-changed',
} as const

export type NativeRuntimeIpcChannel =
  (typeof NATIVE_RUNTIME_IPC_CHANNELS)[keyof typeof NATIVE_RUNTIME_IPC_CHANNELS]

export function isNativeRuntimeTerminalOperationStatus(
  status: NativeRuntimeOperationPhase,
): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}
