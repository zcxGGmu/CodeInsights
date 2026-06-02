import type {
  NativeRuntimeFileChunkReadInput,
  NativeRuntimeFileChunkReadResult,
  NativeRuntimeClearCacheInput,
  NativeRuntimeOperationState,
  NativeRuntimeRebuildIndexInput,
  NativeRuntimeSearchInput,
  NativeRuntimeSearchResult,
  NativeRuntimeStatus,
  NativeRuntimeTailInput,
  NativeRuntimeTailResult,
  NativeRuntimeWorkspaceIndexInput,
  NativeRuntimeWorkspaceIndexResult,
} from '@codeinsights/shared'
import {
  buildNativeRuntimeDiagnostics,
  buildNativeRuntimeStatus,
  sanitizeNativeRuntimeStatus,
} from './native-runtime-diagnostics'
import { TypeScriptEventSearchService } from './ts-event-search-service'
import { TypeScriptPipelineTailService } from './ts-pipeline-tail-service'
import { TypeScriptWorkspaceIndexService } from './ts-workspace-index-service'
import type { NativeRuntimeAdapter } from './native-runtime-types'
import { getPipelineSessionRecordsPath, getWorkspaceFilesDir } from '../config-paths'
import { getWorkspaceAttachedDirectories, listAgentWorkspaces } from '../agent-workspace-manager'

const eventSearchService = new TypeScriptEventSearchService()
const pipelineTailService = new TypeScriptPipelineTailService()
const workspaceIndexService = new TypeScriptWorkspaceIndexService()
const MAX_OPERATION_HISTORY = 100

function unsupportedOperation(operation: string): Error {
  return new Error(`Native Runtime ${operation} 尚未接入 TypeScript facade`)
}

export function getTypeScriptEventSearchService(): TypeScriptEventSearchService {
  return eventSearchService
}

export function getTypeScriptPipelineTailService(): TypeScriptPipelineTailService {
  return pipelineTailService
}

export function getTypeScriptWorkspaceIndexService(): TypeScriptWorkspaceIndexService {
  return workspaceIndexService
}

/**
 * 主进程 Native Runtime facade。
 *
 * Phase 1 只接入 TypeScript fallback 的搜索服务；其他 native 能力仍保持未接入，
 * 避免 renderer 或业务路径误以为 native binary 已存在。
 */
export class TypeScriptNativeRuntimeService implements NativeRuntimeAdapter {
  readonly implementation = 'typescript' as const
  private readonly operationStates = new Map<string, NativeRuntimeOperationState>()
  private readonly progressListeners = new Set<(state: NativeRuntimeOperationState) => void>()
  private readonly statusListeners = new Set<(status: NativeRuntimeStatus) => void>()

  async getStatus() {
    return buildNativeRuntimeStatus()
  }

  async getDiagnostics() {
    return buildNativeRuntimeDiagnostics()
  }

  async search(input: NativeRuntimeSearchInput): Promise<NativeRuntimeSearchResult> {
    throw unsupportedOperation('search')
  }

  async tailJsonl(input: NativeRuntimeTailInput): Promise<NativeRuntimeTailResult> {
    if (input.fileKind !== 'pipeline-records') {
      throw unsupportedOperation('tailJsonl')
    }

    const result = pipelineTailService.readTail({
      requestId: input.requestId,
      filePath: getPipelineSessionRecordsPath(input.sessionId),
      sessionId: input.sessionId,
      direction: input.cursor
        ? input.direction === 'backward' ? 'before' : 'after'
        : 'latest',
      cursor: input.cursor,
      limit: input.limit,
    })

    return {
      requestId: input.requestId,
      fileKind: input.fileKind,
      sessionId: input.sessionId,
      records: result.records,
      nextCursor: input.direction === 'backward'
        ? result.previousCursor
        : result.nextCursor,
      hasMore: result.hasMore,
      implementation: 'typescript',
      readAt: result.readAt,
    }
  }

  async indexWorkspace(
    input: NativeRuntimeWorkspaceIndexInput,
    signal?: AbortSignal,
  ): Promise<NativeRuntimeWorkspaceIndexResult> {
    return workspaceIndexService.indexWorkspace(input, signal)
  }

  async rebuildIndex(
    input: NativeRuntimeRebuildIndexInput,
    signal?: AbortSignal,
  ): Promise<NativeRuntimeOperationState> {
    const workspace = listAgentWorkspaces().find((item) => item.id === input.workspaceId)
    if (!workspace) {
      throw new Error(`Agent 工作区不存在: ${input.workspaceId}`)
    }

    const startedAt = Date.now()
    const operationId = `native-index-rebuild-${input.requestId}`
    this.upsertOperation({
      operationId,
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      kind: 'index_rebuild',
      phase: 'scanning',
      startedAt,
      source: 'typescript',
      message: '正在重建工作区索引',
    })

    try {
      const result = await this.indexWorkspace({
        requestId: input.requestId,
        workspaceId: input.workspaceId,
        rootPath: getWorkspaceFilesDir(workspace.slug),
        additionalPaths: getWorkspaceAttachedDirectories(workspace.slug),
        force: true,
      }, signal)

      const completed = this.upsertOperation({
        operationId,
        requestId: input.requestId,
        workspaceId: input.workspaceId,
        kind: 'index_rebuild',
        phase: 'completed',
        startedAt,
        completedAt: Date.now(),
        completed: result.indexedFiles,
        total: result.indexedFiles,
        source: 'typescript',
        message: '工作区索引已重建',
      })
      this.emitStatus()
      return completed
    } catch (error) {
      const failed = this.upsertOperation({
        operationId,
        requestId: input.requestId,
        workspaceId: input.workspaceId,
        kind: 'index_rebuild',
        phase: 'failed',
        startedAt,
        completedAt: Date.now(),
        source: 'typescript',
        error: {
          code: 'io_error',
          message: error instanceof Error ? error.message : '重建工作区索引失败',
          recoverable: true,
        },
      })
      this.emitStatus()
      return failed
    }
  }

  async clearCache(input: NativeRuntimeClearCacheInput): Promise<NativeRuntimeOperationState> {
    const startedAt = Date.now()
    const operationId = `native-cache-cleanup-${input.requestId}`
    this.upsertOperation({
      operationId,
      requestId: input.requestId,
      kind: 'cache_cleanup',
      phase: 'writing',
      startedAt,
      source: 'typescript',
      message: '正在清理派生缓存',
    })

    workspaceIndexService.clear()

    const completed = this.upsertOperation({
      operationId,
      requestId: input.requestId,
      kind: 'cache_cleanup',
      phase: 'completed',
      startedAt,
      completedAt: Date.now(),
      source: 'typescript',
      message: '派生缓存已清理',
    })
    this.emitStatus()
    return completed
  }

  async readFileChunk(
    _input: NativeRuntimeFileChunkReadInput,
  ): Promise<NativeRuntimeFileChunkReadResult> {
    throw unsupportedOperation('readFileChunk')
  }

  async getOperationState(_operationId: string): Promise<NativeRuntimeOperationState | null> {
    return this.operationStates.get(_operationId) ?? null
  }

  async cancelOperation(_operationId: string): Promise<NativeRuntimeOperationState | null> {
    const current = this.operationStates.get(_operationId)
    if (!current) return null
    if (current.phase === 'completed' || current.phase === 'failed' || current.phase === 'cancelled') {
      return current
    }
    return this.upsertOperation({
      ...current,
      phase: 'cancelled',
      cancelledAt: Date.now(),
      completedAt: Date.now(),
      message: '操作已取消',
    })
  }

  onProgress(listener: (state: NativeRuntimeOperationState) => void): () => void {
    this.progressListeners.add(listener)
    return () => {
      this.progressListeners.delete(listener)
    }
  }

  onStatusChanged(listener: (status: NativeRuntimeStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  private upsertOperation(state: NativeRuntimeOperationState): NativeRuntimeOperationState {
    this.operationStates.set(state.operationId, state)
    while (this.operationStates.size > MAX_OPERATION_HISTORY) {
      const oldest = this.operationStates.keys().next().value
      if (!oldest) break
      this.operationStates.delete(oldest)
    }
    for (const listener of this.progressListeners) {
      listener(state)
    }
    return state
  }

  private emitStatus(): void {
    const status = sanitizeNativeRuntimeStatus(buildNativeRuntimeStatus())
    for (const listener of this.statusListeners) {
      listener(status)
    }
  }
}

export const nativeRuntimeService = new TypeScriptNativeRuntimeService()
