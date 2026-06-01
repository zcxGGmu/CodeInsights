import type {
  NativeImplementationKind,
  NativeRuntimeDiagnostics,
  NativeRuntimeFileChunkReadInput,
  NativeRuntimeFileChunkReadResult,
  NativeRuntimeOperationState,
  NativeRuntimeSearchInput,
  NativeRuntimeSearchResult,
  NativeRuntimeStatus,
  NativeRuntimeTailInput,
  NativeRuntimeTailResult,
  NativeRuntimeWorkspaceIndexInput,
  NativeRuntimeWorkspaceIndexResult,
} from '@codeinsights/shared'

/**
 * 主进程内部 native runtime 替换边界。
 *
 * Phase 0 只定义 TypeScript interface；实现仍使用现有 TypeScript 逻辑或 disabled diagnostics。
 */
export interface NativeRuntimeAdapter {
  readonly implementation: NativeImplementationKind

  getStatus(signal?: AbortSignal): Promise<NativeRuntimeStatus>
  getDiagnostics(signal?: AbortSignal): Promise<NativeRuntimeDiagnostics>
  search(input: NativeRuntimeSearchInput, signal?: AbortSignal): Promise<NativeRuntimeSearchResult>
  tailJsonl(input: NativeRuntimeTailInput, signal?: AbortSignal): Promise<NativeRuntimeTailResult>
  indexWorkspace(
    input: NativeRuntimeWorkspaceIndexInput,
    signal?: AbortSignal,
  ): Promise<NativeRuntimeWorkspaceIndexResult>
  readFileChunk(
    input: NativeRuntimeFileChunkReadInput,
    signal?: AbortSignal,
  ): Promise<NativeRuntimeFileChunkReadResult>
  getOperationState(operationId: string): Promise<NativeRuntimeOperationState | null>
  cancelOperation(operationId: string): Promise<NativeRuntimeOperationState | null>
}
