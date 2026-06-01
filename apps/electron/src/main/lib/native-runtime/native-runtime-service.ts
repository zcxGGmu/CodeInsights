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
import type { NativeRuntimeAdapter } from './native-runtime-types'

const eventSearchService = new TypeScriptEventSearchService()

function unsupportedOperation(operation: string): Error {
  return new Error(`Native Runtime ${operation} 尚未接入 TypeScript facade`)
}

export function getTypeScriptEventSearchService(): TypeScriptEventSearchService {
  return eventSearchService
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

  async tailJsonl(_input: NativeRuntimeTailInput): Promise<NativeRuntimeTailResult> {
    throw unsupportedOperation('tailJsonl')
  }

  async indexWorkspace(
    _input: NativeRuntimeWorkspaceIndexInput,
  ): Promise<NativeRuntimeWorkspaceIndexResult> {
    throw unsupportedOperation('indexWorkspace')
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
