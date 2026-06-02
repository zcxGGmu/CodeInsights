import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Activity, AlertCircle, CheckCircle2, Copy, DatabaseZap, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import type {
  NativeCapability,
  NativeRuntimeCapabilityDiagnostic,
  NativeRuntimeDiagnostics,
  NativeRuntimeFallbackReason,
} from '@codeinsights/shared'
import { SettingsCard, SettingsRow, SettingsSection } from './primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
} from '@/atoms/agent-atoms'
import {
  nativeRuntimeActiveOperationsAtom,
  nativeRuntimeDiagnosticsAtom,
  nativeRuntimeLastErrorAtom,
  setNativeRuntimeDiagnosticsAtom,
  setNativeRuntimeOperationProgressAtom,
} from '@/atoms/native-runtime-atoms'

export interface NativeRuntimeCapabilityRow {
  label: string
  availableLabel: string
  tone: 'success' | 'warning'
  implementationLabel: string
}

export interface NativeRuntimeDiagnosticsViewModel {
  statusLabel: string
  statusTone: 'success' | 'warning' | 'danger' | 'muted'
  implementationLabel: string
  fallbackLabel: string
  checkedAtLabel: string
  capabilityRows: NativeRuntimeCapabilityRow[]
  lastErrorLabel?: string
}

const CAPABILITY_LABELS: Record<NativeCapability, string> = {
  diagnostics: 'Diagnostics',
  'indexed-search': 'Indexed Search',
  'jsonl-tail': 'JSONL Tail',
  'workspace-index': 'Workspace Index',
  'file-chunk-read': 'File Chunk Read',
  'path-safety': 'Path Safety',
  'git-output-parse': 'Git Output Parse',
}

const FALLBACK_LABELS: Record<NativeRuntimeFallbackReason, string> = {
  disabled: '已禁用 native runtime',
  missing_binary: '未找到 native binary',
  version_mismatch: '协议版本不兼容',
  contract_violation: '契约校验失败',
  timeout: '调用超时',
  crashed: 'native runtime 已崩溃',
  cache_corrupted: '派生缓存损坏',
  unsupported_platform: '当前平台暂不支持',
}

function implementationLabel(value: string): string {
  switch (value) {
    case 'typescript':
      return 'TypeScript'
    case 'rust-sidecar':
      return 'Rust Sidecar'
    case 'rust-napi':
      return 'Rust N-API'
    case 'go-sidecar':
      return 'Go Sidecar'
    default:
      return value
  }
}

function capabilityRow(item: NativeRuntimeCapabilityDiagnostic): NativeRuntimeCapabilityRow {
  return {
    label: CAPABILITY_LABELS[item.capability],
    availableLabel: item.available ? '可用' : '不可用',
    tone: item.available ? 'success' : 'warning',
    implementationLabel: implementationLabel(item.implementation),
  }
}

function redactDiagnosticsText(value: string): string {
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

export function buildNativeRuntimeDiagnosticsViewModel(
  diagnostics: NativeRuntimeDiagnostics | null,
): NativeRuntimeDiagnosticsViewModel {
  if (!diagnostics) {
    return {
      statusLabel: '正在加载',
      statusTone: 'muted',
      implementationLabel: '未知',
      fallbackLabel: '尚未读取 diagnostics',
      checkedAtLabel: '-',
      capabilityRows: [],
    }
  }

  const status = diagnostics.status
  const hasError = Boolean(diagnostics.lastError && diagnostics.lastError.code !== 'disabled')
  const statusTone = hasError
    ? 'danger'
    : status.nativeEnabled
      ? 'success'
      : 'warning'

  return {
    statusLabel: status.nativeEnabled ? 'Native runtime 可用' : 'TypeScript fallback',
    statusTone,
    implementationLabel: implementationLabel(status.implementation),
    fallbackLabel: diagnostics.fallbackReason
      ? FALLBACK_LABELS[diagnostics.fallbackReason]
      : '未触发 fallback',
    checkedAtLabel: new Date(diagnostics.checkedAt).toLocaleString(),
    capabilityRows: diagnostics.capabilities.map(capabilityRow),
    lastErrorLabel: diagnostics.lastError?.message,
  }
}

export function buildNativeRuntimeDiagnosticsCopy(
  diagnostics: NativeRuntimeDiagnostics | null,
): string {
  if (!diagnostics) return 'Native Runtime diagnostics: not loaded'
  const { binaryPath: _binaryPath, ...status } = diagnostics.status
  return redactDiagnosticsText(JSON.stringify({
    ...diagnostics,
    status: {
      ...status,
      lastError: diagnostics.status.lastError,
    },
  }, null, 2))
}

export function resolveNativeRuntimeClearCacheAction(input: {
  confirming: boolean
  loading: boolean
}): { label: string; disabled: boolean; destructive: boolean } {
  if (input.loading) {
    return { label: '正在清理', disabled: true, destructive: true }
  }
  if (input.confirming) {
    return { label: '确认清理', disabled: false, destructive: true }
  }
  return { label: '清理缓存', disabled: false, destructive: false }
}

function StatusBadge({ model }: { model: NativeRuntimeDiagnosticsViewModel }): React.ReactElement {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
      model.statusTone === 'success' && 'bg-emerald-500/10 text-emerald-700',
      model.statusTone === 'warning' && 'bg-amber-500/10 text-amber-700',
      model.statusTone === 'danger' && 'bg-destructive/10 text-destructive',
      model.statusTone === 'muted' && 'bg-foreground/[0.06] text-muted-foreground',
    )}>
      {model.statusTone === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
      {model.statusLabel}
    </span>
  )
}

export function NativeRuntimeDiagnostics(): React.ReactElement {
  const diagnostics = useAtomValue(nativeRuntimeDiagnosticsAtom)
  const activeOperations = useAtomValue(nativeRuntimeActiveOperationsAtom)
  const lastError = useAtomValue(nativeRuntimeLastErrorAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const setDiagnostics = useSetAtom(setNativeRuntimeDiagnosticsAtom)
  const setOperationProgress = useSetAtom(setNativeRuntimeOperationProgressAtom)
  const [refreshing, setRefreshing] = React.useState(false)
  const [rebuilding, setRebuilding] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)
  const [clearConfirming, setClearConfirming] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? null
  const model = buildNativeRuntimeDiagnosticsViewModel(diagnostics)
  const clearAction = resolveNativeRuntimeClearCacheAction({ confirming: clearConfirming, loading: clearing })

  const refresh = React.useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      const nextDiagnostics = await window.electronAPI.getNativeRuntimeDiagnostics()
      setDiagnostics(nextDiagnostics)
    } catch (error) {
      console.error('[NativeRuntime] 刷新 diagnostics 失败:', error)
    } finally {
      setRefreshing(false)
    }
  }, [setDiagnostics])

  React.useEffect(() => {
    if (!diagnostics) void refresh()
  }, [diagnostics, refresh])

  const rebuildIndex = async (): Promise<void> => {
    if (!currentWorkspace) return
    setRebuilding(true)
    try {
      const operation = await window.electronAPI.rebuildNativeRuntimeIndex({
        requestId: `diagnostics-rebuild-${Date.now()}`,
        workspaceId: currentWorkspace.id,
      })
      setOperationProgress(operation)
      await refresh()
    } catch (error) {
      console.error('[NativeRuntime] 重建工作区索引失败:', error)
    } finally {
      setRebuilding(false)
    }
  }

  const clearCache = async (): Promise<void> => {
    if (!clearConfirming) {
      setClearConfirming(true)
      return
    }
    setClearing(true)
    try {
      const operation = await window.electronAPI.clearNativeRuntimeCache({
        requestId: `diagnostics-clear-cache-${Date.now()}`,
      })
      setOperationProgress(operation)
      setClearConfirming(false)
      await refresh()
    } catch (error) {
      console.error('[NativeRuntime] 清理派生缓存失败:', error)
    } finally {
      setClearing(false)
    }
  }

  const copyDiagnostics = async (): Promise<void> => {
    const content = buildNativeRuntimeDiagnosticsCopy(diagnostics)
    await navigator.clipboard?.writeText(content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Native Runtime"
        description="本地索引、tail 和未来 native helper 的诊断状态。"
        action={(
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>刷新状态</span>
          </Button>
        )}
      >
        <SettingsCard>
          <SettingsRow
            label="运行状态"
            icon={<Activity size={18} className="text-primary" />}
            description={`当前实现：${model.implementationLabel}；${model.fallbackLabel}`}
            feedback={lastError ? <div className="text-xs text-status-waiting-fg">{lastError.message}</div> : null}
          >
            <StatusBadge model={model} />
          </SettingsRow>

          <SettingsRow
            label="能力"
            icon={<DatabaseZap size={18} className="text-emerald-600" />}
            description={`最近检查：${model.checkedAtLabel}`}
          >
            <div className="flex flex-wrap justify-end gap-1.5">
              {model.capabilityRows.length === 0 ? (
                <span className="rounded-md bg-foreground/[0.06] px-2 py-1 text-xs text-muted-foreground">未加载</span>
              ) : model.capabilityRows.map((row) => (
                <span
                  key={row.label}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium',
                    row.tone === 'success' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700',
                  )}
                  title={row.implementationLabel}
                >
                  {row.label} · {row.availableLabel}
                </span>
              ))}
            </div>
          </SettingsRow>

          <SettingsRow
            label="运行中的操作"
            icon={<Loader2 size={18} className={cn('text-muted-foreground', activeOperations.length > 0 && 'animate-spin text-amber-600')} />}
            description={activeOperations.length > 0 ? activeOperations.map((operation) => operation.message ?? operation.kind).join('、') : '当前没有后台 native runtime 操作'}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="索引维护" description="只清理可重建的派生缓存，不影响 JSON / JSONL 会话事实源。">
        <SettingsCard>
          <SettingsRow
            label="重建工作区索引"
            icon={<RefreshCw size={18} className="text-muted-foreground" />}
            description={currentWorkspace ? `当前工作区：${currentWorkspace.name}` : '当前没有可重建的工作区'}
          >
            <Button size="sm" variant="outline" disabled={!currentWorkspace || rebuilding} onClick={() => void rebuildIndex()}>
              {rebuilding ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>重建索引</span>
            </Button>
          </SettingsRow>

          <SettingsRow
            label="清理派生缓存"
            icon={<Trash2 size={18} className="text-muted-foreground" />}
            description="清理后会在下一次搜索或手动重建时重新生成。"
          >
            <Button
              size="sm"
              variant={clearAction.destructive ? 'destructive' : 'outline'}
              disabled={clearAction.disabled}
              onClick={() => void clearCache()}
            >
              {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              <span>{clearAction.label}</span>
            </Button>
          </SettingsRow>

          <SettingsRow
            label="复制诊断信息"
            icon={<Copy size={18} className="text-muted-foreground" />}
            description="复制内容会移除 binary path、home path、token 和 credentialed URL。"
          >
            <Button size="sm" variant="outline" onClick={() => void copyDiagnostics()}>
              <Copy size={14} />
              <span>{copied ? '已复制' : '复制诊断'}</span>
            </Button>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}
