import type {
  NativeRuntimeFileChunkReadInput,
  NativeRuntimeFileChunkReadResult,
  NativeRuntimeOperationState,
  NativeRuntimeSearchInput,
  NativeRuntimeSearchResult,
  NativeRuntimeTailInput,
  NativeRuntimeTailResult,
  NativeRuntimeWorkspaceIndexInput,
  NativeRuntimeWorkspaceIndexResult,
} from '@codeinsights/shared'
import {
  buildNativeRuntimeDiagnostics,
  buildNativeRuntimeStatus,
} from './native-runtime-diagnostics'
import { TypeScriptEventSearchService } from './ts-event-search-service'
import { TypeScriptPipelineTailService } from './ts-pipeline-tail-service'
import { TypeScriptWorkspaceIndexService } from './ts-workspace-index-service'
import type { NativeRuntimeAdapter } from './native-runtime-types'
import { getPipelineSessionRecordsPath } from '../config-paths'

const eventSearchService = new TypeScriptEventSearchService()
const pipelineTailService = new TypeScriptPipelineTailService()
const workspaceIndexService = new TypeScriptWorkspaceIndexService()

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

  async readFileChunk(
    _input: NativeRuntimeFileChunkReadInput,
  ): Promise<NativeRuntimeFileChunkReadResult> {
    throw unsupportedOperation('readFileChunk')
  }

  async getOperationState(_operationId: string): Promise<NativeRuntimeOperationState | null> {
    return null
  }

  async cancelOperation(_operationId: string): Promise<NativeRuntimeOperationState | null> {
    return null
  }
}

export const nativeRuntimeService = new TypeScriptNativeRuntimeService()
