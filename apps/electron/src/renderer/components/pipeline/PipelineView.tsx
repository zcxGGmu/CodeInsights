import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { agentChannelIdAtom, agentWorkspacesAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import type {
  PipelineSessionMeta,
  PipelineStateSnapshot,
} from '@codeinsights/shared'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import {
  clearPipelineLiveOutputForSession,
  pipelinePendingGatesAtom,
  pipelineCodexChannelIdAtom,
  getPipelineLiveOutput,
  hasPipelineLiveOutputNode,
  pipelineLiveOutputAtom,
  pipelinePreflightStateMapAtom,
  pipelineRecordRefreshAtom,
  pipelineSessionStateMapAtom,
  pipelineSessionsAtom,
  pipelineStreamErrorsAtom,
} from '@/atoms/pipeline-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import {
  PIPELINE_PREFLIGHT_RESULT_TTL_MS,
  createPipelinePreflightAcknowledgement,
  getPipelinePreflightRefreshState,
  isPipelinePreflightAcknowledged,
  resolvePipelineRunConfig,
  shouldBlockPipelineStartForPreflight,
  type PipelinePreflightError,
} from './pipeline-preflight'
import { PipelineFailureCard } from './PipelineFailureCard'
import { PipelineHeader } from './PipelineHeader'
import { PipelineRecords } from './PipelineRecords'
import { PipelineStageRail } from './PipelineStageRail'
import { buildPipelineFailureViewModel } from './pipeline-display-model'
import { buildPipelineGatePanelModel } from './pipeline-gate-panel-model'
import { ContributionTaskDashboard } from './ContributionTaskDashboard'
import { PipelineGateSidePanel } from './PipelineGateSidePanel'
import { PipelinePreflightPanel } from './PipelinePreflightPanel'
import { PipelineReportExportPanel } from './PipelineReportExportPanel'
import { useContributionTaskSummary } from './useContributionTaskSummary'
import { usePipelineExplorerReports } from './usePipelineExplorerReports'
import { usePipelinePatchWorkDocuments } from './usePipelinePatchWorkDocuments'
import { usePipelineGateActions } from './usePipelineGateActions'
import { usePipelineRecordsTail } from './usePipelineRecordsTail'
import { usePipelineSessionSnapshot } from './usePipelineSessionSnapshot'
import { usePipelineSubmissionPlan } from './usePipelineSubmissionPlan'

const EMPTY_DOCUMENT_CONTENTS = new Map<string, string>()

export function PipelineView({
  sessionId,
}: {
  sessionId: string
}): React.ReactElement {
  const sessions = useAtomValue(pipelineSessionsAtom)
  const stateMap = useAtomValue(pipelineSessionStateMapAtom)
  const pendingGates = useAtomValue(pipelinePendingGatesAtom)
  const refreshMap = useAtomValue(pipelineRecordRefreshAtom)
  const errorMap = useAtomValue(pipelineStreamErrorsAtom)
  const liveOutputMap = useAtomValue(pipelineLiveOutputAtom)
  const preflightStateMap = useAtomValue(pipelinePreflightStateMapAtom)
  const channels = useAtomValue(channelsAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const fallbackChannelId = useAtomValue(agentChannelIdAtom)
  const fallbackWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const pipelineCodexChannelId = useAtomValue(pipelineCodexChannelIdAtom)
  const setDraftSessionIds = useSetAtom(draftSessionIdsAtom)
  const setSessions = useSetAtom(pipelineSessionsAtom)
  const setStateMap = useSetAtom(pipelineSessionStateMapAtom)
  const setPendingGates = useSetAtom(pipelinePendingGatesAtom)
  const setErrors = useSetAtom(pipelineStreamErrorsAtom)
  const setRecordRefresh = useSetAtom(pipelineRecordRefreshAtom)
  const setLiveOutput = useSetAtom(pipelineLiveOutputAtom)
  const setPreflightStateMap = useSetAtom(pipelinePreflightStateMapAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const [preflightError, setPreflightError] = React.useState<PipelinePreflightError | null>(null)

  const session = React.useMemo<PipelineSessionMeta | null>(
    () => sessions.find((item) => item.id === sessionId) ?? null,
    [sessions, sessionId],
  )
  const state = stateMap.get(sessionId) ?? (session ? {
    sessionId: session.id,
    version: session.version,
    currentNode: session.currentNode,
    status: session.status,
    reviewIteration: session.reviewIteration,
    lastApprovedNode: session.lastApprovedNode,
    pendingGate: session.pendingGate,
    updatedAt: session.updatedAt,
  } : null)
  const pendingGate = pendingGates.get(sessionId) ?? session?.pendingGate ?? null
  const { handleRespond, handleSelectTask } = usePipelineGateActions({
    sessionId,
    pendingGate,
  })
  const refreshVersion = refreshMap.get(sessionId) ?? 0
  const error = errorMap.get(sessionId)
  const {
    records,
    recordsFocusRequest,
    latestUserInput,
    latestErrorRecord,
    recordsLoading,
    recordsLoadError,
    hasOlderRecords,
    loadingOlderRecords,
    retryLoadRecords,
    loadOlderRecords,
    requestStageFocus,
    requestRecordFocus,
  } = usePipelineRecordsTail(sessionId, refreshVersion)
  const repositoryPreflight = preflightStateMap.get(sessionId) ?? {
    result: null,
    acknowledgement: null,
    loading: false,
    error: null,
  }
  const [preflightFreshnessTick, setPreflightFreshnessTick] = React.useState(0)
  const preflightNow = React.useMemo(() => Date.now(), [preflightFreshnessTick])
  const currentPreflightWorkspaceId = session?.workspaceId ?? fallbackWorkspaceId ?? undefined
  const preflightRefreshState = getPipelinePreflightRefreshState({
    result: repositoryPreflight.result,
    acknowledgement: repositoryPreflight.acknowledgement,
    checkedWorkspaceId: repositoryPreflight.workspaceId,
    currentWorkspaceId: currentPreflightWorkspaceId,
    now: preflightNow,
  })
  const running = state?.status === 'running' || state?.status === 'waiting_human'
  const repositoryPreflightBlocksStart = shouldBlockPipelineStartForPreflight(
    repositoryPreflight.result,
    preflightRefreshState.acknowledgement,
  ) || preflightRefreshState.refreshRequired
  const currentTask = latestUserInput
  const latestRecordError = latestErrorRecord?.error
  const liveOutput = state
    ? getPipelineLiveOutput(liveOutputMap, sessionId, state.currentNode)
    : ''
  const showLiveOutput = state?.status === 'running'
    && hasPipelineLiveOutputNode(liveOutputMap, sessionId, state.currentNode)
  const failureViewModel = React.useMemo(() => buildPipelineFailureViewModel({
    state,
    error: error ?? latestRecordError,
    partialOutput: liveOutput,
  }), [error, latestRecordError, liveOutput, state])
  React.useEffect(() => {
    const checkedAt = repositoryPreflight.result?.checkedAt
    if (!checkedAt) return
    const delay = Math.max(0, checkedAt + PIPELINE_PREFLIGHT_RESULT_TTL_MS - Date.now() + 1)
    const timeoutId = window.setTimeout(() => {
      setPreflightFreshnessTick((prev) => prev + 1)
    }, delay)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [repositoryPreflight.result?.checkedAt, repositoryPreflight.result?.fingerprint])

  const gatePanelSeed = React.useMemo(() => buildPipelineGatePanelModel({
    sessionId,
    pendingGate,
    state,
    documentContents: EMPTY_DOCUMENT_CONTENTS,
  }), [pendingGate, sessionId, state])
  const {
    documentContents,
    documentLoadingPaths,
    documentReadErrors,
  } = usePipelinePatchWorkDocuments({
    sessionId,
    enabled: gatePanelSeed.showPatchWorkDocumentRead,
    documents: gatePanelSeed.reviewDocuments,
  })
  const gatePanel = React.useMemo(() => buildPipelineGatePanelModel({
    sessionId,
    pendingGate,
    state,
    documentContents,
  }), [documentContents, pendingGate, sessionId, state])
  const explorerReports = usePipelineExplorerReports({
    sessionId,
    enabled: gatePanel.panelKind === 'explorer_task',
    initialReports: gatePanel.stageOutputs.explorer?.reports,
  })
  const contributionTaskSummary = useContributionTaskSummary({
    sessionId,
    enabled: (session?.version ?? state?.version) === 2,
    refreshVersion,
  })
  const submissionPlan = usePipelineSubmissionPlan({
    sessionId,
    enabled: gatePanel.panelKind === 'committer',
    refreshVersion,
  })

  usePipelineSessionSnapshot({
    sessionId,
    setStateMap,
    setPendingGates,
    setSessions,
  })

  const handleStart = React.useCallback(async (userInput: string): Promise<{ started: boolean }> => {
    const resolved = resolvePipelineRunConfig({
      sessionChannelId: session?.channelId,
      sessionWorkspaceId: session?.workspaceId,
      fallbackChannelId: fallbackChannelId ?? undefined,
      fallbackWorkspaceId: fallbackWorkspaceId ?? undefined,
      pipelineCodexChannelId: pipelineCodexChannelId ?? undefined,
      channels,
      workspaces,
    })
    if (!resolved.ok) {
      setPreflightError(resolved.error)
      return { started: false }
    }
    setPreflightError(null)

    const pipelineVersion = session?.version ?? state?.version
    let preflightAcknowledgement = preflightRefreshState.acknowledgement
    if (pipelineVersion === 2) {
      setPreflightStateMap((prev) => {
        const next = new Map(prev)
        next.set(sessionId, {
          result: repositoryPreflight.result,
          acknowledgement: preflightAcknowledgement,
          loading: true,
          error: null,
          workspaceId: resolved.config.workspaceId,
          updatedAt: Date.now(),
        })
        return next
      })

      try {
        const result = await window.electronAPI.runPipelinePreflight({
          sessionId,
          workspaceId: resolved.config.workspaceId,
        })
        preflightAcknowledgement = isPipelinePreflightAcknowledged(result, preflightAcknowledgement)
          ? preflightAcknowledgement
          : null
        setPreflightStateMap((prev) => {
          const next = new Map(prev)
          next.set(sessionId, {
            result,
            acknowledgement: preflightAcknowledgement ?? null,
            loading: false,
            error: null,
            workspaceId: resolved.config.workspaceId,
            updatedAt: Date.now(),
          })
          return next
        })
        if (shouldBlockPipelineStartForPreflight(result, preflightAcknowledgement)) {
          return { started: false }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Pipeline preflight 检查失败'
        setPreflightStateMap((prev) => {
          const next = new Map(prev)
          next.set(sessionId, {
            result: null,
            acknowledgement: null,
            loading: false,
            error: message,
            workspaceId: resolved.config.workspaceId,
            updatedAt: Date.now(),
          })
          return next
        })
        return { started: false }
      }
    }

    const optimisticState: PipelineStateSnapshot = {
      sessionId,
      ...(pipelineVersion ? { version: pipelineVersion } : {}),
      currentNode: 'explorer',
      status: 'running',
      reviewIteration: state?.reviewIteration ?? session?.reviewIteration ?? 0,
      lastApprovedNode: state?.lastApprovedNode ?? session?.lastApprovedNode,
      pendingGate: null,
      updatedAt: Date.now(),
    }

    setPreflightError(null)
    setErrors((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Map(prev)
      next.delete(sessionId)
      return next
    })
    setDraftSessionIds((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Set(prev)
      next.delete(sessionId)
      return next
    })
    setStateMap((prev) => {
      const next = new Map(prev)
      next.set(sessionId, optimisticState)
      return next
    })
    setSessions((prev) => prev.map((item) => (
      item.id === sessionId
        ? {
            ...item,
            version: pipelineVersion ?? item.version,
            channelId: resolved.config.channelId,
            workspaceId: resolved.config.workspaceId,
            currentNode: optimisticState.currentNode,
            status: optimisticState.status,
            pendingGate: null,
            updatedAt: optimisticState.updatedAt,
          }
        : item
    )))
    void window.electronAPI.startPipeline({
      sessionId,
      userInput,
      channelId: resolved.config.channelId,
      workspaceId: resolved.config.workspaceId,
      threadId: session?.threadId,
      preflightAcknowledgement: preflightAcknowledgement ?? undefined,
    }).catch((error) => {
      console.error('[PipelineView] 启动失败:', error)
      const message = error instanceof Error ? error.message : '启动 Pipeline 失败'
      const failedAt = Date.now()
      const failedState: PipelineStateSnapshot = {
        ...optimisticState,
        status: 'node_failed',
        pendingGate: null,
        updatedAt: failedAt,
      }
      setErrors((prev) => {
        const next = new Map(prev)
        next.set(sessionId, message)
        return next
      })
      setPendingGates((prev) => {
        if (!prev.has(sessionId)) return prev
        const next = new Map(prev)
        next.delete(sessionId)
        return next
      })
      setStateMap((prev) => {
        const next = new Map(prev)
        next.set(sessionId, failedState)
        return next
      })
      setSessions((prev) => prev.map((item) => (
        item.id === sessionId
          ? {
              ...item,
              status: failedState.status,
              pendingGate: null,
              updatedAt: failedAt,
            }
          : item
      )))
    })
    return { started: true }
  }, [channels, fallbackChannelId, fallbackWorkspaceId, pipelineCodexChannelId, preflightRefreshState.acknowledgement, repositoryPreflight.result, session, sessionId, setDraftSessionIds, setErrors, setPendingGates, setPreflightStateMap, setSessions, setStateMap, state, workspaces])

  const handleRefreshRepositoryPreflight = React.useCallback(async (): Promise<void> => {
    const resolved = resolvePipelineRunConfig({
      sessionChannelId: session?.channelId,
      sessionWorkspaceId: session?.workspaceId,
      fallbackChannelId: fallbackChannelId ?? undefined,
      fallbackWorkspaceId: fallbackWorkspaceId ?? undefined,
      pipelineCodexChannelId: pipelineCodexChannelId ?? undefined,
      channels,
      workspaces,
    })
    if (!resolved.ok) {
      setPreflightError(resolved.error)
      return
    }
    setPreflightError(null)

    setPreflightStateMap((prev) => {
      const next = new Map(prev)
      next.set(sessionId, {
        result: repositoryPreflight.result,
        acknowledgement: preflightRefreshState.acknowledgement,
        loading: true,
        error: null,
        workspaceId: resolved.config.workspaceId,
        updatedAt: Date.now(),
      })
      return next
    })

    try {
      const result = await window.electronAPI.runPipelinePreflight({
        sessionId,
        workspaceId: resolved.config.workspaceId,
      })
      const acknowledgement = isPipelinePreflightAcknowledged(result, preflightRefreshState.acknowledgement)
        ? preflightRefreshState.acknowledgement
        : null
      setPreflightStateMap((prev) => {
        const next = new Map(prev)
        next.set(sessionId, {
          result,
          acknowledgement,
          loading: false,
          error: null,
          workspaceId: resolved.config.workspaceId,
          updatedAt: Date.now(),
        })
        return next
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pipeline preflight 检查失败'
      setPreflightStateMap((prev) => {
        const next = new Map(prev)
        next.set(sessionId, {
          result: null,
          acknowledgement: null,
          loading: false,
          error: message,
          workspaceId: resolved.config.workspaceId,
          updatedAt: Date.now(),
        })
        return next
      })
    }
  }, [channels, fallbackChannelId, fallbackWorkspaceId, pipelineCodexChannelId, preflightRefreshState.acknowledgement, repositoryPreflight, session, sessionId, setPreflightStateMap, workspaces])

  const handleAcknowledgePreflightWarnings = React.useCallback((): void => {
    if (!repositoryPreflight.result) return
    const acknowledgement = createPipelinePreflightAcknowledgement(repositoryPreflight.result)
    setPreflightStateMap((prev) => {
      const next = new Map(prev)
      next.set(sessionId, {
        ...repositoryPreflight,
        acknowledgement,
        workspaceId: repositoryPreflight.workspaceId ?? currentPreflightWorkspaceId,
        updatedAt: Date.now(),
      })
      return next
    })
  }, [currentPreflightWorkspaceId, repositoryPreflight, sessionId, setPreflightStateMap])

  const applyStoppedState = React.useCallback((stoppedState: PipelineStateSnapshot): void => {
    setPendingGates((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Map(prev)
      next.delete(sessionId)
      return next
    })
    setErrors((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Map(prev)
      next.delete(sessionId)
      return next
    })
    setLiveOutput((prev) => clearPipelineLiveOutputForSession(prev, sessionId))
    setStateMap((prev) => {
      const next = new Map(prev)
      next.set(sessionId, stoppedState)
      return next
    })
    setSessions((prev) => prev.map((item) => (
      item.id === sessionId
        ? {
            ...item,
            version: stoppedState.version ?? item.version,
            currentNode: stoppedState.currentNode,
            status: stoppedState.status,
            reviewIteration: stoppedState.reviewIteration,
            lastApprovedNode: stoppedState.lastApprovedNode,
            pendingGate: null,
            updatedAt: stoppedState.updatedAt,
          }
        : item
    )))
    setRecordRefresh((prev) => {
      const next = new Map(prev)
      next.set(sessionId, (prev.get(sessionId) ?? 0) + 1)
      return next
    })
  }, [sessionId, setErrors, setLiveOutput, setPendingGates, setRecordRefresh, setSessions, setStateMap])

  const handleStop = React.useCallback(async (): Promise<void> => {
    const previousState = state
    const previousSession = session
    const previousPendingGate = pendingGates.get(sessionId) ?? null
    const previousError = errorMap.get(sessionId) ?? null
    const stoppedAt = Date.now()
    const optimisticState: PipelineStateSnapshot = {
      sessionId,
      version: state?.version ?? session?.version,
      currentNode: state?.currentNode ?? session?.currentNode ?? 'explorer',
      status: 'terminated',
      reviewIteration: state?.reviewIteration ?? session?.reviewIteration ?? 0,
      lastApprovedNode: state?.lastApprovedNode ?? session?.lastApprovedNode,
      pendingGate: null,
      stageOutputs: state?.stageOutputs,
      updatedAt: stoppedAt,
    }

    applyStoppedState(optimisticState)

    try {
      const stoppedState = await window.electronAPI.stopPipeline(sessionId)
      applyStoppedState(stoppedState)
    } catch (error) {
      if (previousState) {
        setStateMap((prev) => {
          const next = new Map(prev)
          next.set(sessionId, previousState)
          return next
        })
      }
      if (previousSession) {
        setSessions((prev) => prev.map((item) => (
          item.id === sessionId ? previousSession : item
        )))
      }
      setPendingGates((prev) => {
        const next = new Map(prev)
        if (previousPendingGate) {
          next.set(sessionId, previousPendingGate)
        } else {
          next.delete(sessionId)
        }
        return next
      })
      setErrors((prev) => {
        const next = new Map(prev)
        if (previousError) {
          next.set(sessionId, previousError)
        } else {
          next.delete(sessionId)
        }
        return next
      })
      throw error
    }
  }, [applyStoppedState, errorMap, pendingGates, session, sessionId, setErrors, setPendingGates, setSessions, setStateMap, state])

  const handleRestart = React.useCallback((): void => {
    if (!currentTask || running) return
    void handleStart(currentTask)
  }, [currentTask, handleStart, running])

  const requestErrorFocus = React.useCallback((): void => {
    if (!latestErrorRecord) return
    requestRecordFocus(latestErrorRecord.id)
  }, [latestErrorRecord, requestRecordFocus])

  const handleOpenArtifactsDir = React.useCallback(async (): Promise<void> => {
    const opened = await window.electronAPI.openPipelineArtifactsDir(sessionId)
    if (!opened) {
      throw new Error('系统未能打开 Pipeline 产物目录')
    }
  }, [sessionId])

  const handleOpenPatchWorkDir = React.useCallback(async (): Promise<void> => {
    const opened = await window.electronAPI.openPipelinePatchWorkDir(sessionId)
    if (!opened) {
      throw new Error('系统未能打开 patch-work 目录')
    }
  }, [sessionId])

  const handleOpenAgentSettings = React.useCallback((): void => {
    setSettingsTab('agent')
    setSettingsOpen(true)
  }, [setSettingsOpen, setSettingsTab])

  return (
    <div className="pipeline-workbench-shell relative flex h-full flex-col overflow-hidden bg-surface-panel/95">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-status-running/25 to-transparent" aria-hidden="true" />
      <div className="pipeline-workbench-bg relative z-10 flex-1 overflow-auto bg-transparent p-4">
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-4">
          <PipelineHeader session={session} state={state} />
          <PipelineStageRail
            state={state}
            version={session?.version ?? state?.version}
            onSelectStage={requestStageFocus}
          />

          {failureViewModel ? (
            <PipelineFailureCard
              viewModel={failureViewModel}
              canLocateError={Boolean(latestErrorRecord)}
              canRestart={Boolean(currentTask) && !running}
              onLocateError={requestErrorFocus}
              onOpenArtifactsDir={handleOpenArtifactsDir}
              onRestart={handleRestart}
              onOpenSettings={handleOpenAgentSettings}
            />
          ) : error ? (
            <div className="rounded-panel border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm leading-6 text-status-danger-fg shadow-card">
              {error}
            </div>
          ) : null}

          {preflightError ? (
            <div className="flex items-center justify-between gap-3 rounded-panel border border-status-waiting-border bg-status-waiting-bg px-4 py-3 text-sm text-text-primary shadow-card">
              <div>{preflightError.message}</div>
              <button
                onClick={() => {
                  setSettingsTab(preflightError.settingsTab)
                  setSettingsOpen(true)
                }}
                className="rounded-control bg-background px-3 py-2 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                前往设置
              </button>
            </div>
          ) : null}

          {repositoryPreflight.loading || repositoryPreflight.result || repositoryPreflight.error ? (
            <PipelinePreflightPanel
              result={repositoryPreflight.result}
              acknowledgement={repositoryPreflight.acknowledgement}
              loading={repositoryPreflight.loading}
              error={repositoryPreflight.error}
              refreshState={preflightRefreshState}
              onAcknowledgeWarnings={handleAcknowledgePreflightWarnings}
              onRefreshPreflight={handleRefreshRepositoryPreflight}
            />
          ) : null}

          {(session?.version ?? state?.version) === 2 ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <ContributionTaskDashboard
                summary={contributionTaskSummary.summary}
                loading={contributionTaskSummary.loading}
                error={contributionTaskSummary.error}
                onRefresh={contributionTaskSummary.refresh}
                onOpenPatchWorkDir={handleOpenPatchWorkDir}
              />
              <PipelineReportExportPanel sessionId={sessionId} />
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <PipelineRecords
                focusRequest={recordsFocusRequest}
                records={records}
                liveNode={state?.currentNode}
                liveOutput={liveOutput}
                sessionId={sessionId}
                sessionTitle={session?.title}
                showLiveOutput={showLiveOutput}
                version={session?.version ?? state?.version}
                hasOlderRecords={hasOlderRecords}
                loadingOlderRecords={loadingOlderRecords}
                recordsLoading={recordsLoading}
                recordsLoadError={recordsLoadError}
                onRetryLoadRecords={retryLoadRecords}
                onLoadOlderRecords={loadOlderRecords}
              />
            </div>
            <PipelineGateSidePanel
              sessionId={sessionId}
              session={session}
              state={state}
              pendingGate={pendingGate}
              gatePanel={gatePanel}
              explorerReports={explorerReports}
              documentContents={documentContents}
              documentLoadingPaths={documentLoadingPaths}
              documentReadErrors={documentReadErrors}
              submissionPlan={submissionPlan.submissionPlan}
              submissionPlanLoading={submissionPlan.loading}
              submissionPlanError={submissionPlan.error}
              running={running}
              startDisabled={repositoryPreflightBlocksStart}
              currentTask={currentTask}
              onRespond={handleRespond}
              onSelectTask={handleSelectTask}
              onOpenPatchWorkDir={handleOpenPatchWorkDir}
              onStart={handleStart}
              onStop={handleStop}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
