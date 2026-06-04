import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import type {
  NativeCapability,
  NativeRuntimeErrorCode,
  NativeRuntimeFallbackReason,
  NativeRuntimeIndexState,
  NativeRuntimeMatchedRange,
  NativeRuntimeSearchMatch,
  NativeRuntimeSearchResult,
  NativeRuntimeSearchSourceKind,
  NativeRuntimeStatus,
} from '@codeinsights/shared'
import {
  NATIVE_RUNTIME_CACHE_SCHEMA_VERSION,
  NATIVE_RUNTIME_PROTOCOL_VERSION,
  redactNativeRuntimeText,
} from './native-runtime-diagnostics'

const DEFAULT_REQUEST_TIMEOUT_MS = 1500
const DEFAULT_STATUS_TIMEOUT_MS = 1500
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 1000
const MAX_PROTOCOL_LINE_BYTES = 1024 * 1024
const SIDECAR_IMPLEMENTATION = 'rust-sidecar'
const FALLBACK_IMPLEMENTATION = 'typescript'
const CAPABILITIES: NativeCapability[] = ['diagnostics', 'indexed-search']
const FALLBACK_CAPABILITIES: NativeCapability[] = ['diagnostics', 'jsonl-tail', 'workspace-index']

export interface NativeRuntimeSidecarSource {
  sourceKind: NativeRuntimeSearchSourceKind
  sourceId?: string
  sessionId?: string
  workspaceId?: string
  title?: string
  filePath: string
  textFields?: string[]
  textExtractor?: NativeRuntimeSidecarTextExtractor
  idField?: string
}

export type NativeRuntimeSidecarTextExtractor = 'agent_message_search_text'

export interface NativeRuntimeSidecarSearchInput {
  requestId: string
  query: string
  limit: number
  sources: NativeRuntimeSidecarSource[]
}

export interface NativeRuntimeSidecarManagerOptions {
  binaryPath?: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  requestTimeoutMs?: number
  statusTimeoutMs?: number
  shutdownTimeoutMs?: number
}

interface ProtocolRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params: unknown
  deadlineMs: number
}

interface ProtocolErrorPayload {
  code?: unknown
  message?: unknown
  recoverable?: unknown
}

interface ProtocolResponse {
  jsonrpc?: unknown
  id?: unknown
  ok?: unknown
  result?: unknown
  error?: ProtocolErrorPayload
}

interface PendingRequest {
  method: string
  resolve: (value: unknown) => void
  reject: (error: NativeRuntimeSidecarError) => void
  timer: ReturnType<typeof setTimeout>
}

interface SendRequestOptions {
  disableOnTimeout?: boolean
}

interface SidecarStatusPayload {
  implementation: 'rust-sidecar'
  binaryVersion?: string
  protocolVersion: number
  cacheSchemaVersion: number
  capabilities: NativeCapability[]
}

export class NativeRuntimeSidecarError extends Error {
  readonly code: NativeRuntimeErrorCode
  readonly recoverable: boolean

  constructor(code: NativeRuntimeErrorCode, message: string, recoverable = true) {
    super(redactNativeRuntimeText(message))
    this.name = 'NativeRuntimeSidecarError'
    this.code = code
    this.recoverable = recoverable
  }
}

export function canFallbackFromNativeSidecarError(error: NativeRuntimeSidecarError): boolean {
  return [
    'disabled',
    'missing_binary',
    'version_mismatch',
    'contract_violation',
    'timeout',
    'crashed',
    'cache_corrupted',
    'unsupported_platform',
  ].includes(error.code)
}

export class NativeRuntimeSidecarManager {
  private readonly binaryPath?: string
  private readonly args: string[]
  private readonly cwd?: string
  private readonly env?: NodeJS.ProcessEnv
  private readonly requestTimeoutMs: number
  private readonly statusTimeoutMs: number
  private readonly shutdownTimeoutMs: number
  private child?: ChildProcessWithoutNullStreams
  private stdoutBuffer = ''
  private stderrBuffer = ''
  private requestSequence = 0
  private readonly pending = new Map<string, PendingRequest>()
  private disabledReason?: NativeRuntimeFallbackReason
  private lastError?: NativeRuntimeSidecarError
  private cachedStatus?: NativeRuntimeStatus
  private statusPromise?: Promise<NativeRuntimeStatus>

  constructor(options: NativeRuntimeSidecarManagerOptions = {}) {
    this.binaryPath = options.binaryPath ? normalizeBinaryPath(options.binaryPath) : undefined
    this.args = options.args ?? []
    this.cwd = options.cwd
    this.env = options.env
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.statusTimeoutMs = options.statusTimeoutMs ?? DEFAULT_STATUS_TIMEOUT_MS
    this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS
  }

  async getStatus(): Promise<NativeRuntimeStatus> {
    if (this.disabledReason) {
      return this.buildFallbackStatus(this.disabledReason, this.lastError)
    }
    if (this.cachedStatus) return this.cachedStatus
    if (this.statusPromise) return await this.statusPromise

    this.statusPromise = this.probeStatus()
    try {
      return await this.statusPromise
    } finally {
      this.statusPromise = undefined
    }
  }

  async search(input: NativeRuntimeSidecarSearchInput): Promise<NativeRuntimeSearchResult> {
    await this.ensureNativeAvailable()
    try {
      const result = await this.sendRequest('search', input, this.requestTimeoutMs)
      return validateSearchResult(result, input)
    } catch (error) {
      const sidecarError = toSidecarError(error)
      if (
        sidecarError.code === 'contract_violation' ||
        sidecarError.code === 'timeout' ||
        sidecarError.code === 'crashed'
      ) {
        this.disable(toFallbackReason(sidecarError.code), sidecarError)
      }
      throw sidecarError
    }
  }

  async shutdown(): Promise<boolean> {
    const child = this.child
    if (!child) return false

    try {
      await this.sendRequest('shutdown', {}, this.shutdownTimeoutMs, { disableOnTimeout: false })
    } catch (error) {
      await this.terminateChildGracefully(child)
      if (error instanceof NativeRuntimeSidecarError && error.code === 'crashed') {
        return true
      }
      return true
    }

    const exited = await waitForChildExit(child, this.shutdownTimeoutMs)
    if (!exited) {
      await this.terminateChildGracefully(child)
    }
    return true
  }

  private async probeStatus(): Promise<NativeRuntimeStatus> {
    if (!this.binaryPath || !existsSync(this.binaryPath)) {
      const error = new NativeRuntimeSidecarError('missing_binary', 'Native runtime binary 不存在')
      this.disable('missing_binary', error)
      return this.buildFallbackStatus('missing_binary', error)
    }

    try {
      const payload = await this.sendRequest('status', {}, this.statusTimeoutMs)
      const statusPayload = validateStatusPayload(payload)
      if (statusPayload.protocolVersion !== NATIVE_RUNTIME_PROTOCOL_VERSION) {
        throw new NativeRuntimeSidecarError(
          'version_mismatch',
          `native protocolVersion ${statusPayload.protocolVersion} 与主进程 ${NATIVE_RUNTIME_PROTOCOL_VERSION} 不兼容`,
        )
      }
      if (statusPayload.cacheSchemaVersion !== NATIVE_RUNTIME_CACHE_SCHEMA_VERSION) {
        throw new NativeRuntimeSidecarError(
          'cache_corrupted',
          `native cacheSchemaVersion ${statusPayload.cacheSchemaVersion} 与主进程 ${NATIVE_RUNTIME_CACHE_SCHEMA_VERSION} 不兼容`,
        )
      }

      const status: NativeRuntimeStatus = {
        available: true,
        nativeEnabled: true,
        implementation: SIDECAR_IMPLEMENTATION,
        version: statusPayload.binaryVersion,
        protocolVersion: statusPayload.protocolVersion,
        cacheSchemaVersion: statusPayload.cacheSchemaVersion,
        capabilities: statusPayload.capabilities,
        checkedAt: Date.now(),
      }
      this.cachedStatus = status
      return status
    } catch (error) {
      const sidecarError = toSidecarError(error)
      const reason = toFallbackReason(sidecarError.code)
      this.disable(reason, sidecarError)
      return this.buildFallbackStatus(reason, sidecarError)
    }
  }

  private async ensureNativeAvailable(): Promise<void> {
    if (this.disabledReason) {
      throw this.lastError ?? new NativeRuntimeSidecarError(this.disabledReason, 'Native runtime 已禁用')
    }

    const status = await this.getStatus()
    if (!status.nativeEnabled) {
      throw this.lastError ?? new NativeRuntimeSidecarError(
        status.fallbackReason ?? 'disabled',
        'Native runtime 当前不可用',
      )
    }
  }

  private sendRequest(
    method: string,
    params: unknown,
    timeoutMs: number,
    options: SendRequestOptions = {},
  ): Promise<unknown> {
    if (this.disabledReason) {
      return Promise.reject(this.lastError ?? new NativeRuntimeSidecarError(this.disabledReason, 'Native runtime 已禁用'))
    }

    const child = this.ensureChild()
    const id = `native-${method}-${Date.now()}-${this.requestSequence++}`
    const request: ProtocolRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
      deadlineMs: timeoutMs,
    }

    return new Promise<unknown>((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        const error = new NativeRuntimeSidecarError('timeout', `native ${method} 请求超时`)
        if (options.disableOnTimeout ?? true) {
          this.disable('timeout', error)
        }
        rejectPromise(error)
      }, timeoutMs)

      this.pending.set(id, {
        method,
        resolve: resolvePromise,
        reject: rejectPromise,
        timer,
      })

      child.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
        if (!error) return
        clearTimeout(timer)
        this.pending.delete(id)
        const sidecarError = new NativeRuntimeSidecarError('io_error', `native ${method} 写入失败: ${error.message}`)
        rejectPromise(sidecarError)
      })
    })
  }

  private ensureChild(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child
    if (!this.binaryPath || !existsSync(this.binaryPath)) {
      const error = new NativeRuntimeSidecarError('missing_binary', 'Native runtime binary 不存在')
      this.disable('missing_binary', error)
      throw error
    }

    const child = spawn(this.binaryPath, this.args, {
      cwd: this.cwd,
      env: this.env ?? process.env,
      stdio: 'pipe',
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams

    child.stdout.setEncoding('utf-8')
    child.stdout.on('data', (chunk: string | Buffer) => this.handleStdout(String(chunk)))
    child.stderr.setEncoding('utf-8')
    child.stderr.on('data', (chunk: string | Buffer) => this.appendStderr(String(chunk)))
    child.once('error', (error) => {
      const sidecarError = new NativeRuntimeSidecarError('crashed', `native sidecar 启动失败: ${error.message}`)
      this.disable('crashed', sidecarError)
    })
    child.once('exit', (code, signal) => {
      if (this.child !== child) return
      this.child = undefined
      if (this.pending.size === 0) return
      const detail = signal ? `signal=${signal}` : `code=${code ?? 'unknown'}`
      const error = new NativeRuntimeSidecarError('crashed', `native sidecar 已退出: ${detail}`)
      this.disable('crashed', error)
    })

    this.child = child
    return child
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk
    if (Buffer.byteLength(this.stdoutBuffer, 'utf-8') > MAX_PROTOCOL_LINE_BYTES) {
      this.disable(
        'contract_violation',
        new NativeRuntimeSidecarError('contract_violation', 'native stdout protocol line 超过限制'),
      )
      return
    }

    while (this.stdoutBuffer.includes('\n')) {
      const newlineIndex = this.stdoutBuffer.indexOf('\n')
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim()
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1)
      if (!line) continue
      this.handleProtocolLine(line)
    }
  }

  private handleProtocolLine(line: string): void {
    let response: ProtocolResponse
    try {
      response = JSON.parse(line) as ProtocolResponse
    } catch {
      this.disable(
        'contract_violation',
        new NativeRuntimeSidecarError('contract_violation', 'native stdout 返回了非 JSON protocol line'),
      )
      return
    }

    if (response.jsonrpc !== '2.0' || typeof response.id !== 'string' || typeof response.ok !== 'boolean') {
      this.disable(
        'contract_violation',
        new NativeRuntimeSidecarError('contract_violation', 'native response envelope 不符合 protocol'),
      )
      return
    }

    const pending = this.pending.get(response.id)
    if (!pending) {
      this.disable(
        'contract_violation',
        new NativeRuntimeSidecarError('contract_violation', 'native response id 无法匹配 pending request'),
      )
      return
    }

    clearTimeout(pending.timer)
    this.pending.delete(response.id)

    if (!response.ok) {
      const error = response.error
      pending.reject(new NativeRuntimeSidecarError(
        normalizeErrorCode(error?.code),
        typeof error?.message === 'string' ? error.message : `native ${pending.method} 请求失败`,
        typeof error?.recoverable === 'boolean' ? error.recoverable : true,
      ))
      return
    }

    pending.resolve(response.result)
  }

  private appendStderr(chunk: string): void {
    this.stderrBuffer += redactNativeRuntimeText(chunk)
    if (this.stderrBuffer.length > 4096) {
      this.stderrBuffer = this.stderrBuffer.slice(-4096)
    }
  }

  private disable(reason: NativeRuntimeFallbackReason, error: NativeRuntimeSidecarError): void {
    this.disabledReason = reason
    this.lastError = error
    this.cachedStatus = undefined
    this.rejectPending(error)
    this.terminateChild()
  }

  private rejectPending(error: NativeRuntimeSidecarError): void {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer)
      this.pending.delete(id)
      pending.reject(error)
    }
  }

  private terminateChild(): void {
    const child = this.child
    if (!child) return
    this.child = undefined
    child.kill('SIGTERM')
    setTimeout(() => {
      if (child.exitCode == null && child.signalCode == null) {
        child.kill('SIGKILL')
      }
    }, 500).unref?.()
  }

  private async terminateChildGracefully(child: ChildProcessWithoutNullStreams): Promise<void> {
    if (this.child === child) {
      this.child = undefined
    }
    if (child.exitCode != null || child.signalCode != null) return

    child.kill('SIGTERM')
    const terminated = await waitForChildExit(child, 500)
    if (terminated) return

    child.kill('SIGKILL')
    await waitForChildExit(child, 500)
  }

  private buildFallbackStatus(
    reason: NativeRuntimeFallbackReason,
    error?: NativeRuntimeSidecarError,
  ): NativeRuntimeStatus {
    return {
      available: false,
      nativeEnabled: false,
      implementation: FALLBACK_IMPLEMENTATION,
      protocolVersion: NATIVE_RUNTIME_PROTOCOL_VERSION,
      cacheSchemaVersion: NATIVE_RUNTIME_CACHE_SCHEMA_VERSION,
      capabilities: FALLBACK_CAPABILITIES,
      fallbackReason: reason,
      lastError: {
        code: error?.code ?? reason,
        message: error?.message ?? 'Native runtime 当前使用 TypeScript fallback',
        recoverable: error?.recoverable ?? true,
        ...(this.stderrBuffer ? { detail: this.stderrBuffer } : {}),
      },
      checkedAt: Date.now(),
    }
  }
}

async function waitForChildExit(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<boolean> {
  if (child.exitCode != null || child.signalCode != null) return true
  return await new Promise<boolean>((resolvePromise) => {
    const timer = setTimeout(() => resolvePromise(false), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolvePromise(true)
    })
  })
}

function normalizeBinaryPath(binaryPath: string): string {
  return isAbsolute(binaryPath) ? binaryPath : resolve(process.cwd(), binaryPath)
}

function validateStatusPayload(value: unknown): SidecarStatusPayload {
  if (!isRecord(value)) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native status result 不是 object')
  }
  if (value.implementation !== SIDECAR_IMPLEMENTATION) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native status implementation 无效')
  }
  if (typeof value.protocolVersion !== 'number' || typeof value.cacheSchemaVersion !== 'number') {
    throw new NativeRuntimeSidecarError('contract_violation', 'native status version 字段无效')
  }
  if (!Array.isArray(value.capabilities) || !value.capabilities.every(isNativeCapability)) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native status capabilities 无效')
  }
  return {
    implementation: SIDECAR_IMPLEMENTATION,
    binaryVersion: typeof value.binaryVersion === 'string' ? value.binaryVersion : undefined,
    protocolVersion: value.protocolVersion,
    cacheSchemaVersion: value.cacheSchemaVersion,
    capabilities: value.capabilities,
  }
}

function validateSearchResult(
  value: unknown,
  input: NativeRuntimeSidecarSearchInput,
): NativeRuntimeSearchResult {
  if (!isRecord(value)) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native search result 不是 object')
  }
  if (
    value.requestId !== input.requestId ||
    value.query !== input.query ||
    !Array.isArray(value.matches) ||
    typeof value.hasMore !== 'boolean' ||
    !isIndexState(value.indexState) ||
    value.implementation !== SIDECAR_IMPLEMENTATION ||
    !isSafeNumber(value.searchedAt)
  ) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native search result contract 无效')
  }

  return {
    requestId: input.requestId,
    query: value.query,
    matches: value.matches.map((match) => validateSearchMatch(match, input.sources)),
    hasMore: value.hasMore,
    indexState: value.indexState,
    implementation: SIDECAR_IMPLEMENTATION,
    searchedAt: value.searchedAt,
  }
}

function validateSearchMatch(
  value: unknown,
  sources: NativeRuntimeSidecarSource[],
): NativeRuntimeSearchMatch {
  if (!isRecord(value)) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native search match 不是 object')
  }
  if (
    typeof value.id !== 'string' ||
    !isSearchSourceKind(value.sourceKind) ||
    typeof value.title !== 'string' ||
    typeof value.snippet !== 'string' ||
    !Array.isArray(value.matchedRanges) ||
    value.matchedRanges.length === 0 ||
    !isSafeNumber(value.score) ||
    value.score < 0
  ) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native search match contract 无效')
  }

  const id = value.id as string
  const title = value.title as string
  const snippet = value.snippet as string
  const matchedRanges = value.matchedRanges as unknown[]
  const score = value.score as number
  const sourceKind = value.sourceKind
  const sessionId = typeof value.sessionId === 'string' ? value.sessionId : undefined
  const workspaceId = typeof value.workspaceId === 'string' ? value.workspaceId : undefined
  if (!matchesRequestedSource(sourceKind, sessionId, workspaceId, sources)) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native search match 超出请求 source 边界')
  }

  return {
    id,
    sourceKind,
    title: redactNativeRuntimeText(title),
    snippet: redactNativeRuntimeText(snippet),
    matchedRanges: matchedRanges.map((range) => validateMatchedRange(range, snippet)),
    score,
    ...(sessionId ? { sessionId } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    ...(typeof value.recordId === 'string' ? { recordId: value.recordId } : {}),
    ...(typeof value.cursor === 'string' ? { cursor: value.cursor } : {}),
    ...(isSafeNumber(value.updatedAt) ? { updatedAt: value.updatedAt } : {}),
  }
}

function matchesRequestedSource(
  sourceKind: NativeRuntimeSearchSourceKind,
  sessionId: string | undefined,
  workspaceId: string | undefined,
  sources: NativeRuntimeSidecarSource[],
): boolean {
  return sources.some((source) => {
    if (source.sourceKind !== sourceKind) return false

    const expectedSessionId = source.sessionId ?? source.sourceId
    if (sessionId && expectedSessionId && sessionId !== expectedSessionId) {
      return false
    }

    if (workspaceId && source.workspaceId && workspaceId !== source.workspaceId) {
      return false
    }

    return true
  })
}

function validateMatchedRange(value: unknown, snippet: string): NativeRuntimeMatchedRange {
  if (!isRecord(value)) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native matchedRange contract 无效')
  }

  const start = value.start
  const length = value.length
  if (
    typeof start !== 'number' ||
    typeof length !== 'number' ||
    !Number.isInteger(start) ||
    !Number.isInteger(length)
  ) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native matchedRange contract 无效')
  }
  if (start < 0 || length <= 0) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native matchedRange 越界')
  }
  if (start + length > snippet.length) {
    throw new NativeRuntimeSidecarError('contract_violation', 'native matchedRange 超出 snippet 边界')
  }
  return { start, length }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNativeCapability(value: unknown): value is NativeCapability {
  return [
    'diagnostics',
    'indexed-search',
    'jsonl-tail',
    'workspace-index',
    'file-chunk-read',
    'path-safety',
    'git-output-parse',
  ].includes(String(value))
}

function isSearchSourceKind(value: unknown): value is NativeRuntimeSearchSourceKind {
  return [
    'chat',
    'agent',
    'pipeline',
    'workspace',
    'patch-work',
    'chat_message',
    'agent_message',
    'pipeline_record',
    'workspace_file',
    'patch_work_file',
  ].includes(String(value))
}

function isIndexState(value: unknown): value is NativeRuntimeIndexState {
  return ['ready', 'building', 'stale', 'fallback'].includes(String(value))
}

function isSafeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeErrorCode(code: unknown): NativeRuntimeErrorCode {
  if (typeof code !== 'string') return 'unknown'
  if ([
    'disabled',
    'missing_binary',
    'version_mismatch',
    'contract_violation',
    'timeout',
    'crashed',
    'cache_corrupted',
    'unsupported_platform',
    'invalid_input',
    'operation_cancelled',
    'path_denied',
    'io_error',
    'unknown',
  ].includes(code)) {
    return code as NativeRuntimeErrorCode
  }
  return 'unknown'
}

function toSidecarError(error: unknown): NativeRuntimeSidecarError {
  if (error instanceof NativeRuntimeSidecarError) return error
  return new NativeRuntimeSidecarError('unknown', error instanceof Error ? error.message : String(error))
}

function toFallbackReason(code: NativeRuntimeErrorCode): NativeRuntimeFallbackReason {
  if ([
    'disabled',
    'missing_binary',
    'version_mismatch',
    'contract_violation',
    'timeout',
    'crashed',
    'cache_corrupted',
    'unsupported_platform',
  ].includes(code)) {
    return code as NativeRuntimeFallbackReason
  }
  return 'contract_violation'
}
