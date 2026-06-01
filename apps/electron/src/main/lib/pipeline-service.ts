import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type {
  PipelineArtifactContentInput,
  PipelineExplorerReportRef,
  PipelineGateRequest,
  PipelineGateResponse,
  PipelinePatchWorkReadFileInput,
  PipelinePatchWorkRevisionInput,
  PipelinePatchWorkSessionInput,
  PipelineRecordsTailInput,
  PipelineRecordsTailResult,
  PipelineRecordsSearchInput,
  PipelineRecordsSearchResult,
  PipelineRecordsSummaryInput,
  PipelineRecordsSummaryResult,
  PipelineSessionRecordsSearchInput,
  PipelineSessionRecordsSearchResult,
  PipelineSelectTaskInput,
  PipelineSelectTaskResult,
  PipelineSessionMeta,
  PipelineStageArtifactRecord,
  PipelineStartInput,
  PipelineStateSnapshot,
  PipelineVersion,
  PipelinePreflightAcknowledgement,
  PipelinePreflightInput,
  PipelinePreflightIssueCode,
  PipelinePreflightResult,
  PipelineRunPreflightInput,
  PipelineStreamCompletePayload,
  PipelineStreamErrorPayload,
  PipelineStreamPayload,
  PipelineStreamEvent,
  PipelineGateKind,
  PipelineTestEvidence,
  PipelineCommitterStageOutput,
  PipelineLocalCommitSummary,
  PipelineRemoteSubmissionSummary,
  PipelineRemoteWriteConfirmationPlan,
  PipelineReportExport,
  PipelineReportExportInput,
  PipelineReportPdfSaveInput,
  PipelineReportPdfSaveResult,
  PipelineChangedFileType,
  PipelineContributionTaskSummaryInput,
  ContributionTaskSummary,
  PatchWorkDocumentRevision,
  PatchWorkFileKind,
  PipelineSubmissionPlan,
  PipelineSubmissionPlanInput,
} from '@codeinsights/shared'
import { replayPipelineRecords } from '@codeinsights/shared'
import type { PipelineNodeRunner } from './pipeline-node-runner'
import { PipelineCheckpointer } from './pipeline-checkpointer'
import {
  appendPipelineRecord,
  createPipelineSession,
  deletePipelineSession,
  getPipelineRecords,
  getPipelineRecordsSummary,
  getPipelineRecordsTail,
  getPipelineSessionMeta,
  listPipelineSessions,
  searchPipelineRecordsPage,
  searchPipelineSessionRecords,
  updatePipelineSessionMeta,
} from './pipeline-session-manager'
import { PipelineHumanGateService } from './pipeline-human-gate-service'
import { createPipelineGraph, createPipelineGraphV2 } from './pipeline-graph'
import { buildPipelineRecordsFromNodeComplete } from './pipeline-record-builder'
import {
  persistPipelineStageArtifactRecord,
  readPipelineArtifactContent,
  resolvePipelineSessionArtifactsDir,
} from './pipeline-artifact-service'
import { getSettings } from './settings-service'
import { resolvePipelineCodexChannelId } from './pipeline-codex-settings'
import {
  appendContributionTaskEvent,
  createContributionTask,
  getContributionTaskEvents,
  getContributionTaskByPipelineSessionId,
  updateContributionTask,
} from './contribution-task-service'
import {
  acceptPatchWorkDocuments,
  assertPatchWorkDocumentsAcceptable,
  initializePatchWork,
  listPatchWorkDocumentRevisions,
  listPatchWorkExplorerReports,
  readPatchWorkDocumentRevision,
  readPatchWorkManifestFile,
  readPatchWorkManifest,
  resolvePatchWorkDir,
  resolvePatchWorkManifestFilePath,
  selectPatchWorkTask,
} from './pipeline-patch-work-service'
import { getAgentWorkspace } from './agent-workspace-manager'
import { getAgentSessionWorkspacePath } from './config-paths'
import {
  type CreateRemotePipelineSubmissionInput,
  createLocalPipelineCommit,
  createRemotePipelineSubmissionWithGitHubApi,
  PipelineRemoteSubmissionError,
  redactSecretText,
} from './pipeline-git-submission-service'
import {
  redactPreflightDiagnosticText,
  redactPreflightRemoteUrl,
  runPipelinePreflight,
} from './pipeline-preflight-service'
import {
  isPipelineFixtureRunnerEnabled,
  PipelineFixtureNodeRunner,
} from './pipeline-fixture-runner'
import {
  exportPipelineReport as buildPipelineReportExport,
  getContributionTaskSummary as buildContributionTaskSummary,
  getPipelineSubmissionPlan as buildPipelineSubmissionPlan,
} from './pipeline-read-model-service'
import {
  type PipelineReportPdfSaver,
  savePipelineReportPdfFile,
} from './pipeline-report-pdf-service'

interface RunSessionPreflightInput {
  sessionId: string
  workspaceId?: string
  requireClaudeCli?: boolean
  requireCodexCli?: boolean
  requireGit?: boolean
}

export interface PipelineServiceCallbacks {
  onEvent?: (payload: PipelineStreamPayload) => void
  onComplete?: (payload: PipelineStreamCompletePayload) => void
  onError?: (payload: PipelineStreamErrorPayload) => void
}

interface PipelineGraphController {
  invoke(input: { sessionId: string; userInput: string }): Promise<{ state: PipelineStateSnapshot; interrupted?: PipelineGateRequest }>
  resume(input: { sessionId: string; response: PipelineGateResponse }): Promise<{ state: PipelineStateSnapshot; interrupted?: PipelineGateRequest }>
  getState(sessionId: string): Promise<PipelineStateSnapshot>
}

interface CreatePipelineServiceOptions {
  createGraph?: (
    meta: PipelineSessionMeta,
    signal?: AbortSignal,
    callbacks?: PipelineServiceCallbacks,
    mode?: 'execute' | 'read',
  ) => PipelineGraphController | Promise<PipelineGraphController>
  gateService?: PipelineHumanGateService
  checkpointer?: PipelineCheckpointer
  createRemoteSubmission?: PipelineRemoteSubmissionRunner
  runRepositoryPreflight?: (input: PipelinePreflightInput) => Promise<PipelinePreflightResult>
  saveReportPdf?: PipelineReportPdfSaver
}

type PipelineRemoteSubmissionRunner = (
  input: CreateRemotePipelineSubmissionInput,
) => PipelineRemoteSubmissionSummary | Promise<PipelineRemoteSubmissionSummary>

const COMMITTER_SUBMISSION_DOCUMENT_KINDS: PatchWorkFileKind[] = ['commit_doc', 'pr_doc']

function isTerminalState(status: PipelineStateSnapshot['status']): boolean {
  return status === 'completed'
    || status === 'terminated'
    || status === 'recovery_failed'
}

function isReconcileCandidate(status: PipelineSessionMeta['status']): boolean {
  return status === 'running' || status === 'waiting_human'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Pipeline IPC 参数无效: ${fieldName}`)
  }
  return value.trim()
}

function parsePatchWorkSessionInput(input: PipelinePatchWorkSessionInput): PipelinePatchWorkSessionInput {
  const value = input as unknown
  if (!isObject(value)) {
    throw new Error('Pipeline IPC 参数无效: input')
  }
  return {
    sessionId: requireNonEmptyString(value.sessionId, 'sessionId'),
  }
}

function parsePatchWorkReadFileInput(input: PipelinePatchWorkReadFileInput): PipelinePatchWorkReadFileInput {
  const value = input as unknown
  if (!isObject(value)) {
    throw new Error('Pipeline IPC 参数无效: input')
  }
  return {
    sessionId: requireNonEmptyString(value.sessionId, 'sessionId'),
    relativePath: requireNonEmptyString(value.relativePath, 'relativePath'),
  }
}

function parsePatchWorkRevisionInput(input: PipelinePatchWorkRevisionInput): PipelinePatchWorkRevisionInput {
  const value = input as unknown
  if (!isObject(value)) {
    throw new Error('Pipeline IPC 参数无效: input')
  }
  const revision = typeof value.revision === 'number' ? value.revision : Number.NaN
  if (!Number.isInteger(revision) || revision < 1) {
    throw new Error('Pipeline IPC 参数无效: revision')
  }
  return {
    sessionId: requireNonEmptyString(value.sessionId, 'sessionId'),
    relativePath: requireNonEmptyString(value.relativePath, 'relativePath'),
    revision,
  }
}

function parseSelectTaskInput(input: PipelineSelectTaskInput): PipelineSelectTaskInput {
  const value = input as unknown
  if (!isObject(value)) {
    throw new Error('Pipeline IPC 参数无效: input')
  }
  return {
    sessionId: requireNonEmptyString(value.sessionId, 'sessionId'),
    gateId: requireNonEmptyString(value.gateId, 'gateId'),
    selectedReportId: requireNonEmptyString(value.selectedReportId, 'selectedReportId'),
  }
}

interface PipelineStageArtifactPersistor {
  (record: PipelineStageArtifactRecord): PipelineStageArtifactRecord
}

export function appendPipelineNodeCompleteRecords(
  sessionId: string,
  event: Extract<PipelineStreamEvent, { type: 'node_complete' }>,
  persistStageArtifactRecord: PipelineStageArtifactPersistor = persistPipelineStageArtifactRecord,
): void {
  for (const record of buildPipelineRecordsFromNodeComplete(sessionId, event)) {
    if (record.type !== 'stage_artifact') {
      appendPipelineRecord(sessionId, record)
      continue
    }

    let artifactRecord = record
    try {
      artifactRecord = persistStageArtifactRecord(record)
    } catch (error) {
      console.warn('[Pipeline] 阶段产物落盘失败:', error)
    }
    appendPipelineRecord(sessionId, artifactRecord)
  }
}

export function createPipelineService(options: CreatePipelineServiceOptions = {}) {
  const gateService = options.gateService ?? new PipelineHumanGateService()
  const checkpointer = options.checkpointer ?? new PipelineCheckpointer()
  const activeControllers = new Map<string, AbortController>()
  const activeRunners = new Map<string, PipelineNodeRunner>()
  const activeCallbacks = new Map<string, PipelineServiceCallbacks | undefined>()
  const remoteSubmissionRunner = options.createRemoteSubmission ?? createRemotePipelineSubmissionWithGitHubApi
  const repositoryPreflightRunner = options.runRepositoryPreflight ?? runPipelinePreflight
  const reportPdfSaver = options.saveReportPdf ?? savePipelineReportPdfFile
  let reconcileSessionsPromise: Promise<PipelineSessionMeta[]> | null = null

  function emitEvent(
    sessionId: string,
    callbacks: PipelineServiceCallbacks | undefined,
    payload: PipelineStreamPayload['event'],
  ): void {
    callbacks?.onEvent?.({
      sessionId,
      event: payload,
    })
  }

  function syncSessionState(
    sessionId: string,
    state: PipelineStateSnapshot,
    pendingGate?: PipelineGateRequest | null,
  ): PipelineSessionMeta {
    return updatePipelineSessionMeta(sessionId, {
      currentNode: state.currentNode,
      status: state.status,
      reviewIteration: state.reviewIteration,
      lastApprovedNode: state.lastApprovedNode,
      pendingGate: pendingGate ?? state.pendingGate,
    })
  }

  function appendStatusRecord(
    sessionId: string,
    status: PipelineStateSnapshot['status'],
    reason?: string,
  ): void {
    appendPipelineRecord(sessionId, {
      id: `${sessionId}-status-${status}-${Date.now()}`,
      sessionId,
      type: 'status_change',
      status,
      reason,
      createdAt: Date.now(),
    })
  }

  function emitStatusChange(
    sessionId: string,
    status: PipelineStateSnapshot['status'],
    currentNode: PipelineStateSnapshot['currentNode'],
    callbacks?: PipelineServiceCallbacks,
  ): void {
    emitEvent(sessionId, callbacks ?? activeCallbacks.get(sessionId), {
      type: 'status_change',
      status,
      currentNode,
      createdAt: Date.now(),
    })
  }

  function markRecoveryFailed(
    meta: PipelineSessionMeta,
    reason: string,
  ): PipelineSessionMeta {
    const latestMeta = getPipelineSessionMeta(meta.id) ?? meta
    if (latestMeta.status === 'recovery_failed') {
      return latestMeta
    }

    const updatedMeta = updatePipelineSessionMeta(meta.id, {
      status: 'recovery_failed',
      pendingGate: null,
    })
    appendStatusRecord(meta.id, 'recovery_failed', reason)
    return updatedMeta
  }

  async function reconcileWaitingHumanSession(
    meta: PipelineSessionMeta,
  ): Promise<PipelineSessionMeta> {
    if (checkpointer.hasCorruptedThread(meta.id)) {
      return markRecoveryFailed(meta, 'checkpoint 损坏，无法恢复 Pipeline')
    }

    try {
      const graph = await Promise.resolve(createGraph(meta))
      const snapshot = await graph.getState(meta.id)

      if (snapshot.status === 'waiting_human' && snapshot.pendingGate) {
        const pendingGate = enrichGateRequest(meta.id, snapshot.pendingGate)
        return updatePipelineSessionMeta(meta.id, {
          currentNode: pendingGate.node,
          status: 'waiting_human',
          reviewIteration: snapshot.reviewIteration,
          lastApprovedNode: snapshot.lastApprovedNode,
          pendingGate,
        })
      }

      if (snapshot.status === 'running') {
        return markRecoveryFailed(meta, 'checkpoint 未处于待审核状态，无法恢复运行中节点')
      }

      return updatePipelineSessionMeta(meta.id, {
        currentNode: snapshot.currentNode,
        status: snapshot.status,
        reviewIteration: snapshot.reviewIteration,
        lastApprovedNode: snapshot.lastApprovedNode,
        pendingGate: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知 checkpoint 错误'
      return markRecoveryFailed(meta, `checkpoint 恢复失败: ${message}`)
    }
  }

  async function reconcileSession(meta: PipelineSessionMeta): Promise<PipelineSessionMeta> {
    if (!isReconcileCandidate(meta.status) || activeControllers.has(meta.id)) {
      return meta
    }

    if (meta.status === 'running') {
      return markRecoveryFailed(meta, '应用重启后无法恢复运行中节点')
    }

    return reconcileWaitingHumanSession(meta)
  }

  async function reconcileSessions(): Promise<PipelineSessionMeta[]> {
    if (reconcileSessionsPromise) {
      return reconcileSessionsPromise
    }

    reconcileSessionsPromise = (async () => {
      for (const session of listPipelineSessions()) {
        await reconcileSession(session)
      }

      return listPipelineSessions()
    })().finally(() => {
      reconcileSessionsPromise = null
    })

    return reconcileSessionsPromise
  }

  function assertGateResponseMatchesPending(
    meta: PipelineSessionMeta,
    response: PipelineGateResponse,
  ): PipelineGateRequest | null {
    const pendingGate = meta.pendingGate
    if (!pendingGate) {
      return null
    }

    if (meta.status !== 'waiting_human') {
      throw new Error(`Pipeline gate 状态不匹配，当前状态: ${meta.status}`)
    }

    if (pendingGate.gateId !== response.gateId) {
      throw new Error('Pipeline gate 已过期或不匹配，请刷新后重试')
    }

    if (pendingGate.sessionId !== response.sessionId) {
      throw new Error('Pipeline gate 会话不匹配，请刷新后重试')
    }

    if (response.kind && pendingGate.kind && response.kind !== pendingGate.kind) {
      throw new Error('Pipeline gate 类型不匹配，请刷新后重试')
    }

    return pendingGate
  }

  function getContributionTaskForSession(
    sessionId: string,
    options: { required?: boolean } = {},
  ) {
    const task = getContributionTaskByPipelineSessionId(sessionId)
    if (!task && options.required) {
      throw new Error(`未找到 Pipeline 贡献任务: ${sessionId}`)
    }
    return task
  }

  function resolvePipelineRepositoryRoot(
    sessionId: string,
    workspaceId: string | undefined,
  ): string {
    const existingTask = getContributionTaskByPipelineSessionId(sessionId)
    if (existingTask) {
      return existingTask.repositoryRoot
    }

    if (!workspaceId) {
      throw new Error('Pipeline preflight 需要先选择工作区。')
    }

    const workspace = getAgentWorkspace(workspaceId)
    if (!workspace) {
      throw new Error(`Pipeline preflight 工作区不存在: ${workspaceId}`)
    }

    return getAgentSessionWorkspacePath(workspace.slug, sessionId)
  }

  async function runSessionPreflight(
    meta: PipelineSessionMeta,
    input: RunSessionPreflightInput,
  ): Promise<PipelinePreflightResult> {
    const repositoryRoot = resolvePipelineRepositoryRoot(
      meta.id,
      input.workspaceId ?? meta.workspaceId,
    )

    return repositoryPreflightRunner({
      repositoryRoot,
      requireGit: input.requireGit,
      requireClaudeCli: input.requireClaudeCli,
      requireCodexCli: input.requireCodexCli,
    })
  }

  function issueCodes(issues: { code: PipelinePreflightIssueCode }[]): PipelinePreflightIssueCode[] {
    return issues.map((issue) => issue.code)
  }

  function validatePreflightAcknowledgement(
    preflight: PipelinePreflightResult,
    acknowledgement?: PipelinePreflightAcknowledgement,
  ): PipelinePreflightAcknowledgement | undefined {
    if (preflight.blockers.length > 0) {
      return undefined
    }
    if (preflight.warnings.length === 0) {
      return undefined
    }
    if (!acknowledgement || acknowledgement.fingerprint !== preflight.fingerprint) {
      throw new Error('Pipeline preflight warning 需要用户确认')
    }

    const warningCodes = new Set(issueCodes(preflight.warnings))
    const acceptedCodes = new Set(acknowledgement.acceptedWarningCodes)
    if (acceptedCodes.size !== acknowledgement.acceptedWarningCodes.length) {
      throw new Error('Pipeline preflight warning 确认包含重复 code，请刷新后重试')
    }
    for (const code of acceptedCodes) {
      if (!warningCodes.has(code)) {
        throw new Error(`Pipeline preflight warning 确认包含未知 code: ${code}`)
      }
    }
    for (const code of warningCodes) {
      if (!acceptedCodes.has(code)) {
        throw new Error('Pipeline preflight warning 需要用户确认')
      }
    }
    return {
      fingerprint: acknowledgement.fingerprint,
      acceptedWarningCodes: [...acknowledgement.acceptedWarningCodes],
      acknowledgedAt: Date.now(),
    }
  }

  function appendPreflightFailureRecord(
    meta: PipelineSessionMeta,
    message: string,
  ): void {
    appendPipelineRecord(meta.id, {
      id: `${meta.id}-preflight-error-${Date.now()}`,
      sessionId: meta.id,
      type: 'error',
      node: meta.currentNode,
      error: message,
      createdAt: Date.now(),
    })
    updatePipelineSessionMeta(meta.id, {
      status: 'node_failed',
      pendingGate: null,
    })
    appendStatusRecord(meta.id, 'node_failed', message)
  }

  function appendPreflightContributionEvent(
    sessionId: string,
    preflight: PipelinePreflightResult,
    acknowledgement?: PipelinePreflightAcknowledgement,
  ): void {
    const task = getContributionTaskByPipelineSessionId(sessionId)
    if (!task) return

    appendContributionTaskEvent(task.id, {
      pipelineSessionId: sessionId,
      type: 'preflight_completed',
      payload: {
        ok: preflight.ok,
        fingerprint: preflight.fingerprint,
        checkedAt: preflight.checkedAt,
        warningCodes: issueCodes(preflight.warnings),
        blockerCodes: issueCodes(preflight.blockers),
        acknowledgedWarningCodes: acknowledgement?.acceptedWarningCodes,
        acknowledgedAt: acknowledgement?.acknowledgedAt,
        repository: {
          root: preflight.repository.root,
          currentBranch: preflight.repository.currentBranch,
          baseBranch: preflight.repository.baseBranch,
          remoteUrl: preflight.repository.remoteUrl
            ? redactPreflightRemoteUrl(preflight.repository.remoteUrl)
            : undefined,
          hasUncommittedChanges: preflight.repository.hasUncommittedChanges,
          hasConflicts: preflight.repository.hasConflicts,
        },
        packageManager: preflight.packageManager,
        runtimes: preflight.runtimes.map((runtime) => ({
          kind: runtime.kind,
          available: runtime.available,
          version: runtime.version,
          path: runtime.path,
          error: runtime.error ? redactPreflightDiagnosticText(redactSecretText(runtime.error)) : undefined,
        })),
      },
    })
  }

  async function assertStartPreflight(
    meta: PipelineSessionMeta,
    workspaceId: string | undefined,
    acknowledgement?: PipelinePreflightAcknowledgement,
  ): Promise<{
    preflight: PipelinePreflightResult
    acknowledgement?: PipelinePreflightAcknowledgement
  } | null> {
    if (meta.version !== 2) {
      return null
    }

    const fixtureRunnerEnabled = isPipelineFixtureRunnerEnabled()
    const preflight = await runSessionPreflight(meta, {
      sessionId: meta.id,
      workspaceId,
      requireGit: true,
      requireClaudeCli: !fixtureRunnerEnabled,
      requireCodexCli: !fixtureRunnerEnabled,
    })

    if (preflight.blockers.length > 0) {
      const message = `Pipeline preflight 未通过：${preflight.blockers.map((issue) => issue.message).join('；')}`
      appendPreflightFailureRecord(meta, message)
      throw new Error(message)
    }

    let acceptedAcknowledgement: PipelinePreflightAcknowledgement | undefined
    try {
      acceptedAcknowledgement = validatePreflightAcknowledgement(preflight, acknowledgement)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pipeline preflight warning 需要用户确认'
      appendPreflightFailureRecord(meta, message)
      throw error
    }

    return {
      preflight,
      acknowledgement: acceptedAcknowledgement,
    }
  }

  function patchTextContainsPatchWorkFile(patch: string): boolean {
    return patch.split('\n').some((line) =>
      line.startsWith('diff --git a/patch-work ')
      || line.startsWith('diff --git a/patch-work/')
      || line.includes(' b/patch-work/')
      || line.endsWith(' b/patch-work'))
  }

  function parsePatchSetChangedFilePaths(content: string): string[] {
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed)) {
      throw new Error('patch-set changed-files.json 不是合法数组')
    }

    return parsed.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`patch-set changed-files.json 包含非法对象: ${index}`)
      }
      const path = (item as { path?: unknown }).path
      if (typeof path !== 'string' || !path.trim()) {
        throw new Error(`patch-set changed-files.json 缺少 path: ${index}`)
      }
      return path.trim().replace(/\\/g, '/')
    })
  }

  function parseTesterEvidence(content: string): PipelineTestEvidence[] {
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('patch-set test-evidence.json 不是非空数组')
    }

    return parsed.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`patch-set test-evidence.json 包含非法对象: ${index}`)
      }
      const record = item as Record<string, unknown>
      const command = typeof record.command === 'string' ? record.command.trim() : ''
      const status = typeof record.status === 'string' ? record.status.trim() : ''
      const summary = typeof record.summary === 'string' ? record.summary.trim() : ''
      if (!command || !['passed', 'failed', 'skipped'].includes(status) || !summary) {
        throw new Error(`patch-set test-evidence.json 缺少或非法字段: ${index}`)
      }
      return {
        command,
        status: status as PipelineTestEvidence['status'],
        summary,
        durationMs: typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
          ? record.durationMs
          : undefined,
      }
    })
  }

  function assertTesterPatchSetExcludesPatchWork(repositoryRoot: string): void {
    const patch = readPatchWorkManifestFile({
      repositoryRoot,
      relativePath: 'patch-set/changes.patch',
    })
    const changedFilesContent = readPatchWorkManifestFile({
      repositoryRoot,
      relativePath: 'patch-set/changed-files.json',
    })
    const changedFiles = parsePatchSetChangedFilePaths(changedFilesContent)
    const hasPatchWorkFile = patchTextContainsPatchWorkFile(patch)
      || changedFiles.some((path) => path === 'patch-work' || path.startsWith('patch-work/'))

    if (hasPatchWorkFile) {
      throw new Error('patch-set 包含 patch-work/**，禁止进入提交草稿')
    }
  }

  function assertTesterEvidenceAllowsApprove(
    repositoryRoot: string,
    gateKind: PipelineGateKind,
  ): void {
    const evidenceContent = readPatchWorkManifestFile({
      repositoryRoot,
      relativePath: 'patch-set/test-evidence.json',
    })
    const evidence = parseTesterEvidence(evidenceContent)

    if (gateKind === 'test_blocked') return

    const hasNonPassingEvidence = evidence.some((item) => item.status !== 'passed')
    if (hasNonPassingEvidence) {
      throw new Error('tester 测试证据未全部通过，禁止以正常审核进入提交草稿')
    }
  }

  function replayCurrentPipelineState(sessionId: string): PipelineStateSnapshot {
    const meta = getPipelineSessionMeta(sessionId)
    if (!meta) {
      throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
    }

    return replayPipelineRecords(sessionId, getPipelineRecords(sessionId), {
      version: meta.version,
      now: meta.updatedAt,
    })
  }

  function mergeStateWithReplayedStageOutputs(
    sessionId: string,
    state: PipelineStateSnapshot,
  ): PipelineStateSnapshot {
    const replayedState = replayCurrentPipelineState(sessionId)
    const stageOutputs = {
      ...(state.stageOutputs ?? {}),
      ...(replayedState.stageOutputs ?? {}),
    }

    return Object.keys(stageOutputs).length > 0
      ? {
        ...state,
        stageOutputs,
      }
      : state
  }

  function getLatestCommitterOutput(sessionId: string): PipelineCommitterStageOutput {
    const committerOutput = replayCurrentPipelineState(sessionId).stageOutputs?.committer
    if (committerOutput?.node !== 'committer') {
      throw new Error('committer 提交材料状态缺失，禁止完成提交操作')
    }
    return committerOutput
  }

  function assertCommitterSubmissionAllowsDraftOnlyApprove(sessionId: string): void {
    const committerOutput = getLatestCommitterOutput(sessionId)
    if (committerOutput.node !== 'committer') {
      throw new Error('committer 提交材料状态缺失，禁止完成 Phase 6 submission review')
    }
    if (committerOutput.submissionStatus !== 'draft_only') {
      throw new Error('committer 提交材料不是 draft-only 状态，禁止完成 Phase 6 submission review')
    }
    if (committerOutput.blockers.length > 0) {
      throw new Error('committer 提交材料仍存在 blocker，禁止完成 Phase 6 submission review')
    }
    if (committerOutput.localCommit?.attempted || committerOutput.remoteSubmission?.attempted) {
      throw new Error('Phase 6 禁止完成已尝试本地 commit 或远端提交的提交材料')
    }
  }

  function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }

  function normalizeChangedFileType(value: unknown): PipelineChangedFileType {
    return value === 'added' || value === 'deleted' || value === 'renamed' || value === 'modified'
      ? value
      : 'modified'
  }

  function toLocalCommitSummary(
    value: unknown,
  ): PipelineLocalCommitSummary | undefined {
    if (!isObject(value) || value.status !== 'created' || typeof value.operationId !== 'string') {
      return undefined
    }

    const files = Array.isArray(value.files)
      ? value.files
        .filter(isObject)
        .map((file) => {
          const path = typeof file.path === 'string' ? file.path : ''
          if (!path) return null
          return {
            path,
            changeType: normalizeChangedFileType(file.changeType),
            summary: typeof file.summary === 'string' ? file.summary : path,
            additions: typeof file.additions === 'number' ? file.additions : undefined,
            deletions: typeof file.deletions === 'number' ? file.deletions : undefined,
          }
        })
        .filter((file): file is NonNullable<typeof file> => Boolean(file))
      : undefined

    return {
      attempted: true,
      operationId: value.operationId,
      commitHash: typeof value.commitHash === 'string' ? value.commitHash : undefined,
      commitMessage: typeof value.commitMessage === 'string' ? value.commitMessage : undefined,
      status: 'created',
      error: typeof value.error === 'string' ? value.error : undefined,
      files,
      excludedFiles: asStringArray(value.excludedFiles),
      baseBranch: typeof value.baseBranch === 'string' ? value.baseBranch : undefined,
      workingBranch: typeof value.workingBranch === 'string' ? value.workingBranch : undefined,
      headCommit: typeof value.headCommit === 'string' ? value.headCommit : undefined,
      createdAt: typeof value.createdAt === 'number' ? value.createdAt : undefined,
    }
  }

  function toRemoteSubmissionSummary(
    value: unknown,
  ): PipelineRemoteSubmissionSummary | undefined {
    if (!isObject(value) || typeof value.operationId !== 'string') {
      return undefined
    }
    const status = value.status === 'created'
      || value.status === 'failed'
      || value.status === 'pushed'
      || value.status === 'not_requested'
      ? value.status
      : undefined
    if (!status) return undefined

    return {
      attempted: value.attempted === true,
      operationId: value.operationId,
      commitHash: typeof value.commitHash === 'string' ? value.commitHash : undefined,
      status,
      type: value.type === 'push' || value.type === 'pull_request' ? value.type : undefined,
      provider: value.provider === 'gh_cli' || value.provider === 'github_api' ? value.provider : undefined,
      remoteName: typeof value.remoteName === 'string' ? value.remoteName : undefined,
      sanitizedRemoteUrl: typeof value.sanitizedRemoteUrl === 'string' ? value.sanitizedRemoteUrl : undefined,
      githubRepo: typeof value.githubRepo === 'string' ? value.githubRepo : undefined,
      baseBranch: typeof value.baseBranch === 'string' ? value.baseBranch : undefined,
      headBranch: typeof value.headBranch === 'string' ? value.headBranch : undefined,
      pushedRef: typeof value.pushedRef === 'string' ? value.pushedRef : undefined,
      prTitle: typeof value.prTitle === 'string' ? value.prTitle : undefined,
      prBody: typeof value.prBody === 'string' ? value.prBody : undefined,
      prUrl: typeof value.prUrl === 'string' ? value.prUrl : undefined,
      prNumber: typeof value.prNumber === 'number' ? value.prNumber : undefined,
      existingPr: value.existingPr === true ? true : undefined,
      draft: typeof value.draft === 'boolean' ? value.draft : undefined,
      error: typeof value.error === 'string' ? value.error : undefined,
      pushedAt: typeof value.pushedAt === 'number' ? value.pushedAt : undefined,
      createdAt: typeof value.createdAt === 'number' ? value.createdAt : undefined,
    }
  }

  function appendCommitterLocalCommitArtifact(
    sessionId: string,
    output: PipelineCommitterStageOutput,
    localCommit: PipelineLocalCommitSummary,
  ): void {
    const content = JSON.stringify({
      ...output,
      submissionStatus: localCommit.status === 'created'
        ? 'local_commit_created'
        : output.submissionStatus,
      localCommit,
    }, null, 2)
    appendPipelineRecord(sessionId, {
      id: `${sessionId}-committer-local-commit-${localCommit.operationId ?? 'unknown'}-${localCommit.createdAt ?? Date.now()}-artifact`,
      sessionId,
      type: 'stage_artifact',
      node: 'committer',
      artifact: {
        ...output,
        submissionStatus: localCommit.status === 'created'
          ? 'local_commit_created'
          : output.submissionStatus,
        localCommit,
        content,
      },
      createdAt: localCommit.createdAt ?? Date.now(),
    })
  }

  function appendCommitterRemoteSubmissionArtifact(
    sessionId: string,
    output: PipelineCommitterStageOutput,
    remoteSubmission: PipelineRemoteSubmissionSummary,
  ): void {
    const submissionStatus = remoteSubmission.status === 'created'
      ? 'remote_pr_created'
      : remoteSubmission.status === 'failed' || remoteSubmission.status === 'pushed'
        ? 'remote_pr_failed'
        : output.submissionStatus
    const content = JSON.stringify({
      ...output,
      submissionStatus,
      remoteSubmission,
    }, null, 2)
    appendPipelineRecord(sessionId, {
      id: `${sessionId}-committer-remote-${remoteSubmission.operationId ?? 'unknown'}-${remoteSubmission.createdAt ?? Date.now()}-artifact`,
      sessionId,
      type: 'stage_artifact',
      node: 'committer',
      artifact: {
        ...output,
        submissionStatus,
        remoteSubmission,
        content,
      },
      createdAt: remoteSubmission.createdAt ?? Date.now(),
    })
  }

  function getExistingLocalCommitResult(
    sessionId: string,
    operationId: string,
  ): PipelineLocalCommitSummary | undefined {
    const currentLocalCommit = replayCurrentPipelineState(sessionId).stageOutputs?.committer?.localCommit
    if (currentLocalCommit?.status === 'created' && currentLocalCommit.operationId === operationId) {
      return currentLocalCommit
    }

    const task = getContributionTaskByPipelineSessionId(sessionId)
    if (!task) return undefined

    for (const event of getContributionTaskEvents(task.id)) {
      if (event.type !== 'local_commit_created') continue
      const payload = event.payload
      if (!isObject(payload) || payload.operationId !== operationId) continue
      const summary = toLocalCommitSummary(payload.localCommit)
      if (summary) {
        return summary
      }
    }

    return undefined
  }

  function getExistingRemoteSubmissionResult(
    sessionId: string,
    operationId: string,
  ): PipelineRemoteSubmissionSummary | undefined {
    const currentRemoteSubmission = replayCurrentPipelineState(sessionId).stageOutputs?.committer?.remoteSubmission
    if (currentRemoteSubmission?.operationId === operationId) {
      return currentRemoteSubmission
    }

    const task = getContributionTaskByPipelineSessionId(sessionId)
    if (!task) return undefined

    const events = getContributionTaskEvents(task.id).slice().reverse()
    for (const event of events) {
      if (event.type !== 'remote_submission_created' && event.type !== 'remote_submission_failed') continue
      const payload = event.payload
      if (!isObject(payload) || payload.operationId !== operationId) continue
      const summary = toRemoteSubmissionSummary(payload.remoteSubmission)
      if (summary) {
        return summary
      }
    }

    return undefined
  }

  function hasRemoteWriteConfirmedEvent(taskId: string, operationId: string): boolean {
    return getContributionTaskEvents(taskId).some((event) =>
      event.type === 'remote_write_confirmed'
      && isObject(event.payload)
      && event.payload.operationId === operationId)
  }

  function appendRemoteWriteConfirmedEvent(
    sessionId: string,
    taskId: string,
    input: {
      gateId: string
      operationId: string
      commitHash: string
      remoteName: string
      baseBranch: string
      headBranch: string
      prTitle: string
      draft: boolean
      skipPush: boolean
    },
  ): void {
    if (hasRemoteWriteConfirmedEvent(taskId, input.operationId)) return

    appendContributionTaskEvent(taskId, {
      pipelineSessionId: sessionId,
      type: 'remote_write_confirmed',
      payload: {
        gateId: input.gateId,
        operationId: input.operationId,
        commitHash: input.commitHash,
        remoteName: input.remoteName,
        baseBranch: input.baseBranch,
        headBranch: input.headBranch,
        prTitle: input.prTitle,
        draft: input.draft,
        skipPush: input.skipPush,
        remoteWriteConfirmed: true,
      },
    })
  }

  function assertCommitterSubmissionAllowsLocalCommit(
    output: PipelineCommitterStageOutput,
  ): void {
    if (output.submissionStatus !== 'draft_only') {
      throw new Error('committer 提交材料不是 draft-only 状态，禁止创建本地 commit')
    }
    if (output.blockers.length > 0) {
      throw new Error('committer 提交材料仍存在 blocker，禁止创建本地 commit')
    }
    if (output.remoteSubmission?.attempted) {
      throw new Error('提交材料包含远端提交尝试记录，禁止创建本地 commit')
    }
  }

  function assertCommitterSubmissionAllowsRemoteSubmit(
    output: PipelineCommitterStageOutput,
    task: NonNullable<ReturnType<typeof getContributionTaskForSession>>,
    response: PipelineGateResponse,
  ): void {
    if (response.kind !== 'remote_write_confirmation') {
      throw new Error('远端写必须使用独立高风险确认 gate')
    }
    if (!response.remoteWriteConfirmed) {
      throw new Error('用户未确认远端写，禁止执行 push 或创建 PR')
    }
    if (
      output.submissionStatus !== 'local_commit_created'
      && output.submissionStatus !== 'remote_pr_failed'
    ) {
      throw new Error('远端提交必须基于已创建的本地 commit')
    }
    if (output.localCommit?.status !== 'created') {
      throw new Error('远端提交必须基于已创建的本地 commit')
    }
    if (!output.localCommit.commitHash) {
      throw new Error('缺少本地 commit hash，禁止远端提交')
    }
    if (output.blockers.length > 0) {
      throw new Error('committer 提交材料仍存在 blocker，禁止远端提交')
    }
    if (output.remoteSubmission?.status === 'created') {
      throw new Error('远端提交已创建，禁止重复执行')
    }
  }

  function assertCommitterSubmissionAllowsRemoteConfirmation(
    output: PipelineCommitterStageOutput,
  ): void {
    if (
      output.submissionStatus !== 'local_commit_created'
      && output.submissionStatus !== 'remote_pr_failed'
    ) {
      throw new Error('远端确认必须基于已创建的本地 commit')
    }
    if (output.localCommit?.status !== 'created' || !output.localCommit.commitHash) {
      throw new Error('远端确认必须基于已创建的本地 commit')
    }
    if (output.blockers.length > 0) {
      throw new Error('committer 提交材料仍存在 blocker，禁止进入远端确认')
    }
    if (output.remoteSubmission?.status === 'created') {
      throw new Error('远端提交已创建，禁止重复执行')
    }
  }

  function resolveLocalCommitOperationId(
    pendingGate: PipelineGateRequest,
    response: PipelineGateResponse,
  ): string {
    return response.localCommitOperationId?.trim()
      || `${response.sessionId}:${pendingGate.gateId}:local_commit`
  }

  function applyLocalCommitSubmission(
    pendingGate: PipelineGateRequest,
    response: PipelineGateResponse,
    task: NonNullable<ReturnType<typeof getContributionTaskForSession>>,
  ): PipelineLocalCommitSummary {
    const operationId = resolveLocalCommitOperationId(pendingGate, response)
    const committerOutput = getLatestCommitterOutput(response.sessionId)
    const existingCommit = getExistingLocalCommitResult(response.sessionId, operationId)
    if (existingCommit?.status === 'created') {
      appendCommitterLocalCommitArtifact(response.sessionId, committerOutput, existingCommit)
      updateContributionTask(task.id, {
        contributionMode: 'local_commit',
      })
      return existingCommit
    }

    assertCommitterSubmissionAllowsLocalCommit(committerOutput)

    try {
      assertPatchWorkDocumentsAcceptable({
        repositoryRoot: task.repositoryRoot,
        kinds: COMMITTER_SUBMISSION_DOCUMENT_KINDS,
      })
      const result = createLocalPipelineCommit({
        repositoryRoot: task.repositoryRoot,
        commitMessage: committerOutput.commitMessage,
        operationId,
        confirmed: true,
      })
      const localCommit: PipelineLocalCommitSummary = {
        attempted: true,
        operationId: result.operationId,
        commitHash: result.commitHash,
        commitMessage: result.commitMessage,
        status: result.status,
        files: result.files,
        excludedFiles: result.excludedFiles,
        baseBranch: result.baseBranch,
        workingBranch: result.workingBranch,
        headCommit: result.headCommit,
        createdAt: result.createdAt,
      }
      appendCommitterLocalCommitArtifact(response.sessionId, committerOutput, localCommit)
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'local_commit_created',
        payload: {
          operationId,
          commitHash: result.commitHash,
          commitMessage: result.commitMessage,
          files: result.files.map((file) => file.path),
          excludedFiles: result.excludedFiles,
          localCommit,
        },
      })
      updateContributionTask(task.id, {
        contributionMode: 'local_commit',
      })
      return localCommit
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const localCommit: PipelineLocalCommitSummary = {
        attempted: true,
        operationId,
        commitMessage: committerOutput.commitMessage,
        status: 'failed',
        error: message,
        createdAt: Date.now(),
      }
      appendCommitterLocalCommitArtifact(response.sessionId, committerOutput, localCommit)
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'local_commit_failed',
        payload: {
          operationId,
          error: message,
          localCommit,
        },
      })
      throw error
    }
  }

  function resolveRemoteSubmissionOperationId(
    pendingGate: PipelineGateRequest,
    response: PipelineGateResponse,
  ): string {
    return response.remoteSubmissionOperationId?.trim()
      || `${response.sessionId}:${pendingGate.gateId}:remote_pr`
  }

  function buildRemoteWriteConfirmationPlan(
    sessionId: string,
    pendingGate: PipelineGateRequest,
  ): PipelineRemoteWriteConfirmationPlan | undefined {
    if (pendingGate.kind !== 'remote_write_confirmation' || pendingGate.node !== 'committer') {
      return undefined
    }
    const task = getContributionTaskForSession(sessionId)
    const output = getLatestCommitterOutput(sessionId)
    const localCommit = output.localCommit
    const remoteSubmission = output.remoteSubmission
    const operationId = remoteSubmission?.operationId?.trim()
      || `${sessionId}:${pendingGate.gateId}:remote_pr`
    const commitHash = remoteSubmission?.commitHash ?? localCommit?.commitHash
    if (!commitHash) return undefined
    const remoteName = remoteSubmission?.remoteName ?? 'origin'
    const baseBranch = remoteSubmission?.baseBranch
      ?? localCommit?.baseBranch
      ?? task?.baseBranch
      ?? 'main'
    const headBranch = remoteSubmission?.headBranch
      ?? localCommit?.workingBranch
      ?? task?.workingBranch
      ?? ''
    if (!headBranch) return undefined

    return {
      operationId,
      remoteName,
      baseBranch,
      headBranch,
      commitHash,
      prTitle: remoteSubmission?.prTitle ?? output.prTitle,
      prBody: remoteSubmission?.prBody ?? output.prBody,
      sanitizedRemoteUrl: remoteSubmission?.sanitizedRemoteUrl,
      githubRepo: remoteSubmission?.githubRepo,
      pushedRef: remoteSubmission?.pushedRef,
      warnings: [
        ...new Set([
          '确认后会执行 git push，并创建 GitHub Draft PR。',
          'patch-work/** 必须保持在提交和推送范围之外。',
          ...(remoteSubmission?.status === 'pushed' ? ['远端分支已推送，本次只重试创建 Draft PR。'] : []),
          ...output.risks,
        ]),
      ],
    }
  }

  function remoteSubmissionMatchesCurrentPlan(
    remoteSubmission: PipelineRemoteSubmissionSummary,
    output: PipelineCommitterStageOutput,
    task: NonNullable<ReturnType<typeof getContributionTaskForSession>>,
    options?: { requirePushedRef?: boolean },
  ): boolean {
    const localCommit = output.localCommit
    const expectedCommitHash = localCommit?.commitHash
    const expectedRemoteName = output.remoteSubmission?.remoteName ?? 'origin'
    const expectedBaseBranch = output.remoteSubmission?.baseBranch
      ?? localCommit?.baseBranch
      ?? task.baseBranch
      ?? 'main'
    const expectedHeadBranch = output.remoteSubmission?.headBranch
      ?? localCommit?.workingBranch
      ?? task.workingBranch
    const expectedGitHubRepo = output.remoteSubmission?.githubRepo
    const expectedPushedRef = output.remoteSubmission?.pushedRef
      ?? (expectedHeadBranch ? `refs/heads/${expectedHeadBranch}` : undefined)
    const pushedRefMatches = !expectedPushedRef
      || !remoteSubmission.pushedRef
      || remoteSubmission.pushedRef === expectedPushedRef
    if (options?.requirePushedRef && expectedPushedRef && !remoteSubmission.pushedRef) {
      return false
    }

    return Boolean(
      remoteSubmission.commitHash
      && expectedCommitHash
      && remoteSubmission.commitHash === expectedCommitHash
      && remoteSubmission.remoteName === expectedRemoteName
      && remoteSubmission.baseBranch === expectedBaseBranch
      && remoteSubmission.headBranch === expectedHeadBranch
      && (!expectedGitHubRepo || remoteSubmission.githubRepo === expectedGitHubRepo)
      && pushedRefMatches,
    )
  }

  function enrichGateRequest(sessionId: string, request: PipelineGateRequest): PipelineGateRequest {
    let remoteWritePlan: PipelineRemoteWriteConfirmationPlan | undefined
    try {
      remoteWritePlan = buildRemoteWriteConfirmationPlan(sessionId, request)
    } catch {
      remoteWritePlan = undefined
    }
    if (!remoteWritePlan) return request
    return {
      ...request,
      sessionId,
      remoteWritePlan,
    }
  }

  async function applyRemoteSubmission(
    pendingGate: PipelineGateRequest,
    response: PipelineGateResponse,
    task: NonNullable<ReturnType<typeof getContributionTaskForSession>>,
  ): Promise<PipelineRemoteSubmissionSummary> {
    const operationId = resolveRemoteSubmissionOperationId(pendingGate, response)
    const committerOutput = getLatestCommitterOutput(response.sessionId)
    const existingRemoteSubmission = getExistingRemoteSubmissionResult(response.sessionId, operationId)
    if (
      existingRemoteSubmission?.status === 'created'
      && remoteSubmissionMatchesCurrentPlan(existingRemoteSubmission, committerOutput, task)
    ) {
      appendCommitterRemoteSubmissionArtifact(response.sessionId, committerOutput, existingRemoteSubmission)
      updateContributionTask(task.id, {
        contributionMode: 'remote_pr',
        status: 'completed',
        currentGateId: undefined,
      })
      return existingRemoteSubmission
    }
    const skipPush = existingRemoteSubmission?.status === 'pushed'
      && remoteSubmissionMatchesCurrentPlan(
        existingRemoteSubmission,
        committerOutput,
        task,
        { requirePushedRef: true },
      )

    assertCommitterSubmissionAllowsRemoteSubmit(committerOutput, task, response)

    try {
      assertPatchWorkDocumentsAcceptable({
        repositoryRoot: task.repositoryRoot,
        kinds: COMMITTER_SUBMISSION_DOCUMENT_KINDS,
      })
      const localCommit = committerOutput.localCommit
      if (!localCommit?.commitHash) {
        throw new Error('缺少本地 commit hash，禁止远端提交')
      }
      const allowRemoteWrites = task.allowRemoteWrites || response.remoteWriteConfirmed === true
      if (!task.allowRemoteWrites && allowRemoteWrites) {
        updateContributionTask(task.id, {
          allowRemoteWrites: true,
        })
        appendContributionTaskEvent(task.id, {
          pipelineSessionId: response.sessionId,
          type: 'task_updated',
          payload: {
            allowRemoteWrites: true,
            reason: 'remote_write_confirmed',
            operationId,
          },
        })
      }
      const remoteName = committerOutput.remoteSubmission?.remoteName ?? 'origin'
      const headBranch = committerOutput.remoteSubmission?.headBranch
        ?? localCommit.workingBranch
        ?? task.workingBranch
      const baseBranch = committerOutput.remoteSubmission?.baseBranch
        ?? localCommit.baseBranch
        ?? task.baseBranch
        ?? 'main'
      const draft = committerOutput.remoteSubmission?.draft ?? true
      if (!headBranch) {
        throw new Error('缺少远端 head branch，禁止远端提交')
      }
      appendRemoteWriteConfirmedEvent(response.sessionId, task.id, {
        gateId: pendingGate.gateId,
        operationId,
        commitHash: localCommit.commitHash,
        remoteName,
        baseBranch,
        headBranch,
        prTitle: committerOutput.prTitle,
        draft,
        skipPush,
      })
      const result = await Promise.resolve(remoteSubmissionRunner({
        repositoryRoot: task.repositoryRoot,
        operationId,
        commitHash: localCommit.commitHash,
        prTitle: committerOutput.prTitle,
        prBody: committerOutput.prBody,
        allowRemoteWrites,
        confirmed: response.remoteWriteConfirmed === true,
        remoteName,
        headBranch,
        baseBranch,
        draft,
        skipPush,
      }))
      const remoteSubmission: PipelineRemoteSubmissionSummary = {
        ...result,
        attempted: true,
        operationId,
        status: result.status,
      }
      if (remoteSubmission.status !== 'created') {
        throw new PipelineRemoteSubmissionError(
          remoteSubmission.error ?? '远端提交未完成',
          remoteSubmission,
        )
      }
      appendCommitterRemoteSubmissionArtifact(response.sessionId, committerOutput, remoteSubmission)
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'remote_submission_created',
        payload: {
          operationId,
          commitHash: remoteSubmission.commitHash,
          prUrl: remoteSubmission.prUrl,
          remoteSubmission,
        },
      })
      updateContributionTask(task.id, {
        contributionMode: 'remote_pr',
        status: 'completed',
        currentGateId: undefined,
      })
      return remoteSubmission
    } catch (error) {
      const message = redactSecretText(error instanceof Error ? error.message : String(error))
      const partialRemoteSubmission = error instanceof PipelineRemoteSubmissionError
        ? error.remoteSubmission
        : undefined
      const remoteSubmission: PipelineRemoteSubmissionSummary = {
        attempted: true,
        operationId,
        commitHash: committerOutput.localCommit?.commitHash,
        status: partialRemoteSubmission?.status ?? 'failed',
        type: 'pull_request',
        remoteName: committerOutput.remoteSubmission?.remoteName ?? 'origin',
        sanitizedRemoteUrl: partialRemoteSubmission?.sanitizedRemoteUrl
          ?? committerOutput.remoteSubmission?.sanitizedRemoteUrl,
        githubRepo: partialRemoteSubmission?.githubRepo ?? committerOutput.remoteSubmission?.githubRepo,
        baseBranch: committerOutput.remoteSubmission?.baseBranch
          ?? committerOutput.localCommit?.baseBranch
          ?? task.baseBranch,
        headBranch: committerOutput.remoteSubmission?.headBranch
          ?? committerOutput.localCommit?.workingBranch
          ?? task.workingBranch,
        prTitle: committerOutput.prTitle,
        prBody: committerOutput.prBody,
        draft: committerOutput.remoteSubmission?.draft ?? true,
        ...partialRemoteSubmission,
        error: redactSecretText(partialRemoteSubmission?.error ?? message),
        createdAt: partialRemoteSubmission?.createdAt ?? Date.now(),
      }
      appendCommitterRemoteSubmissionArtifact(response.sessionId, committerOutput, remoteSubmission)
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'remote_submission_failed',
        payload: {
          operationId,
          error: message,
          remoteSubmission,
        },
      })
      throw new Error(message)
    }
  }

  function ensureV2ContributionTask(
    meta: PipelineSessionMeta,
    workspaceId: string | undefined,
  ): void {
    if (meta.version !== 2) return

    const existing = getContributionTaskByPipelineSessionId(meta.id)
    if (existing) {
      if (existing.status === 'created') {
        updateContributionTask(existing.id, { status: 'exploring' })
      }
      return
    }

    if (!workspaceId) {
      throw new Error('Pipeline v2 需要先选择工作区，才能创建贡献任务。')
    }

    const workspace = getAgentWorkspace(workspaceId)
    if (!workspace) {
      throw new Error(`Pipeline v2 工作区不存在: ${workspaceId}`)
    }

    const repositoryRoot = getAgentSessionWorkspacePath(workspace.slug, meta.id)
    const task = createContributionTask({
      pipelineSessionId: meta.id,
      workspaceId,
      repositoryRoot,
      patchWorkDir: join(repositoryRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'exploring',
    })

    initializePatchWork({
      contributionTaskId: task.id,
      pipelineSessionId: meta.id,
      repositoryRoot,
    })
    appendContributionTaskEvent(task.id, {
      pipelineSessionId: meta.id,
      type: 'task_created',
      payload: {
        repositoryRoot,
        contributionMode: 'local_patch',
      },
    })
  }

  async function applyV2GateSideEffects(
    pendingGate: PipelineGateRequest,
    response: PipelineGateResponse,
  ): Promise<void> {
    if (response.action !== 'approve') {
      if (pendingGate.kind === 'document_review' && pendingGate.node === 'planner') {
        const task = getContributionTaskForSession(response.sessionId)
        if (task) {
          updateContributionTask(task.id, {
            status: 'planning',
            currentGateId: pendingGate.gateId,
          })
        }
      }
      if (pendingGate.kind === 'document_review' && pendingGate.node === 'developer') {
        const task = getContributionTaskForSession(response.sessionId)
        if (task) {
          updateContributionTask(task.id, {
            status: 'developing',
            currentGateId: pendingGate.gateId,
          })
        }
      }
      if (pendingGate.kind === 'review_iteration_limit') {
        const task = getContributionTaskForSession(response.sessionId)
        if (task) {
          updateContributionTask(task.id, {
            status: response.action === 'rerun_node' ? 'reviewing' : 'developing',
            currentGateId: pendingGate.gateId,
          })
        }
      }
      if (
        (pendingGate.kind === 'document_review' || pendingGate.kind === 'test_blocked')
        && pendingGate.node === 'tester'
      ) {
        const task = getContributionTaskForSession(response.sessionId)
        if (task) {
          updateContributionTask(task.id, {
            status: response.action === 'reject_with_feedback' ? 'developing' : 'testing',
            currentGateId: pendingGate.gateId,
          })
        }
      }
      return
    }

    if (pendingGate.kind === 'task_selection') {
      if (!response.selectedReportId) {
        throw new Error('请选择 explorer report 后再进入 planner')
      }

      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      const result = selectPatchWorkTask({
        repositoryRoot: task.repositoryRoot,
        selectedReportId: response.selectedReportId,
        gateId: pendingGate.gateId,
      })
      updateContributionTask(task.id, {
        selectedReportId: response.selectedReportId,
        selectedTaskTitle: result.selectedReport.title,
        status: 'task_selected',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          selectedReportId: response.selectedReportId,
          selectedTaskPath: result.selectedTaskRef.relativePath,
        },
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'task_updated',
        payload: {
          status: 'task_selected',
          selectedReportId: response.selectedReportId,
          selectedTaskTitle: result.selectedReport.title,
        },
      })
      return
    }

    if (pendingGate.kind === 'document_review' && pendingGate.node === 'planner') {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      const accepted = acceptPatchWorkDocuments({
        repositoryRoot: task.repositoryRoot,
        gateId: pendingGate.gateId,
        kinds: ['implementation_plan', 'test_plan'],
      })
      updateContributionTask(task.id, {
        status: 'developing',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          acceptedDocuments: accepted.map((file) => ({
            relativePath: file.relativePath,
            checksum: file.checksum,
            revision: file.revision,
          })),
        },
      })
    }

    if (pendingGate.kind === 'document_review' && pendingGate.node === 'developer') {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      const accepted = acceptPatchWorkDocuments({
        repositoryRoot: task.repositoryRoot,
        gateId: pendingGate.gateId,
        kinds: ['dev_doc'],
      })
      updateContributionTask(task.id, {
        status: 'reviewing',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          acceptedDocuments: accepted.map((file) => ({
            relativePath: file.relativePath,
            checksum: file.checksum,
            revision: file.revision,
          })),
        },
      })
      return
    }

    if (pendingGate.kind === 'review_iteration_limit') {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      updateContributionTask(task.id, {
        status: 'testing',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'task_updated',
        payload: {
          status: 'testing',
          reason: 'review_iteration_limit_accepted',
        },
      })
    }

    if (
      (pendingGate.kind === 'document_review' || pendingGate.kind === 'test_blocked')
      && pendingGate.node === 'tester'
    ) {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      assertTesterPatchSetExcludesPatchWork(task.repositoryRoot)
      assertTesterEvidenceAllowsApprove(task.repositoryRoot, pendingGate.kind)
      const accepted = acceptPatchWorkDocuments({
        repositoryRoot: task.repositoryRoot,
        gateId: pendingGate.gateId,
        kinds: ['test_result', 'patch', 'changed_files', 'diff_summary', 'test_evidence'],
      })
      updateContributionTask(task.id, {
        status: 'committing',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          acceptedDocuments: accepted.map((file) => ({
            relativePath: file.relativePath,
            checksum: file.checksum,
            revision: file.revision,
          })),
          riskAccepted: pendingGate.kind === 'test_blocked',
        },
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'task_updated',
        payload: {
          status: 'committing',
          reason: pendingGate.kind === 'test_blocked'
            ? 'test_blocked_risk_accepted'
            : 'tester_result_accepted',
        },
      })
    }

    if (pendingGate.kind === 'submission_review' && pendingGate.node === 'committer') {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return
      const submissionMode = response.submissionMode ?? 'local_patch'
      if (submissionMode === 'remote_pr') {
        let committerOutput = getLatestCommitterOutput(response.sessionId)
        if (committerOutput.localCommit?.status !== 'created' || !committerOutput.localCommit.commitHash) {
          applyLocalCommitSubmission(pendingGate, {
            ...response,
            submissionMode: 'local_commit',
          }, task)
          committerOutput = getLatestCommitterOutput(response.sessionId)
        }
        assertCommitterSubmissionAllowsRemoteConfirmation(committerOutput)
        assertPatchWorkDocumentsAcceptable({
          repositoryRoot: task.repositoryRoot,
          kinds: COMMITTER_SUBMISSION_DOCUMENT_KINDS,
        })
        const operationId = resolveRemoteSubmissionOperationId(pendingGate, response)
        const localCommit = committerOutput.localCommit
        const remoteSubmission: PipelineRemoteSubmissionSummary = {
          attempted: false,
          operationId,
          commitHash: localCommit?.commitHash,
          status: 'not_requested',
          type: 'pull_request',
          remoteName: committerOutput.remoteSubmission?.remoteName ?? 'origin',
          sanitizedRemoteUrl: committerOutput.remoteSubmission?.sanitizedRemoteUrl,
          githubRepo: committerOutput.remoteSubmission?.githubRepo,
          baseBranch: committerOutput.remoteSubmission?.baseBranch
            ?? localCommit?.baseBranch
            ?? task.baseBranch
            ?? 'main',
          headBranch: committerOutput.remoteSubmission?.headBranch
            ?? localCommit?.workingBranch
            ?? task.workingBranch,
          prTitle: committerOutput.prTitle,
          prBody: committerOutput.prBody,
          draft: committerOutput.remoteSubmission?.draft ?? true,
          createdAt: Date.now(),
        }
        appendCommitterRemoteSubmissionArtifact(response.sessionId, committerOutput, remoteSubmission)
        updateContributionTask(task.id, {
          contributionMode: 'remote_pr',
          status: 'committing',
          currentGateId: pendingGate.gateId,
        })
        appendContributionTaskEvent(task.id, {
          pipelineSessionId: response.sessionId,
          type: 'task_updated',
          payload: {
            status: 'committing',
            reason: 'remote_write_confirmation_requested',
            submissionMode: 'remote_pr',
            operationId,
          },
        })
        return
      }
      if (submissionMode === 'local_commit') {
        const localCommit = applyLocalCommitSubmission(pendingGate, response, task)
        const accepted = acceptPatchWorkDocuments({
          repositoryRoot: task.repositoryRoot,
          gateId: pendingGate.gateId,
          kinds: COMMITTER_SUBMISSION_DOCUMENT_KINDS,
        })
        updateContributionTask(task.id, {
          contributionMode: 'local_commit',
          status: 'completed',
          currentGateId: undefined,
        })
        appendContributionTaskEvent(task.id, {
          pipelineSessionId: response.sessionId,
          type: 'patch_work_updated',
          payload: {
            acceptedDocuments: accepted.map((file) => ({
              relativePath: file.relativePath,
              checksum: file.checksum,
              revision: file.revision,
            })),
            submissionMode: 'local_commit',
            operationId: resolveLocalCommitOperationId(pendingGate, response),
            localCommit,
          },
        })
        appendContributionTaskEvent(task.id, {
          pipelineSessionId: response.sessionId,
          type: 'task_updated',
          payload: {
            status: 'completed',
            reason: 'local_commit_created',
          },
        })
        return
      }

      assertCommitterSubmissionAllowsDraftOnlyApprove(response.sessionId)
      const accepted = acceptPatchWorkDocuments({
        repositoryRoot: task.repositoryRoot,
        gateId: pendingGate.gateId,
        kinds: COMMITTER_SUBMISSION_DOCUMENT_KINDS,
      })
      updateContributionTask(task.id, {
        status: 'completed',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          acceptedDocuments: accepted.map((file) => ({
            relativePath: file.relativePath,
            checksum: file.checksum,
            revision: file.revision,
          })),
          submissionMode: 'local_patch',
        },
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'task_updated',
        payload: {
          status: 'completed',
          reason: 'submission_draft_saved',
        },
      })
    }

    if (pendingGate.kind === 'remote_write_confirmation' && pendingGate.node === 'committer') {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return
      const remoteSubmission = await applyRemoteSubmission(pendingGate, response, task)
      const accepted = acceptPatchWorkDocuments({
        repositoryRoot: task.repositoryRoot,
        gateId: pendingGate.gateId,
        kinds: COMMITTER_SUBMISSION_DOCUMENT_KINDS,
      })
      updateContributionTask(task.id, {
        contributionMode: 'remote_pr',
        status: 'completed',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          acceptedDocuments: accepted.map((file) => ({
            relativePath: file.relativePath,
            checksum: file.checksum,
            revision: file.revision,
          })),
          submissionMode: 'remote_pr',
          operationId: resolveRemoteSubmissionOperationId(pendingGate, response),
          remoteSubmission,
        },
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'task_updated',
        payload: {
          status: 'completed',
          reason: 'remote_submission_created',
        },
      })
    }
  }

  async function buildDefaultGraph(
    meta: PipelineSessionMeta,
    signal?: AbortSignal,
    callbacks?: PipelineServiceCallbacks,
    mode: 'execute' | 'read' = 'read',
  ): Promise<PipelineGraphController> {
    const onEvent = (event: PipelineStreamEvent): void => {
      if (event.type === 'node_start') {
        appendPipelineRecord(meta.id, {
          id: `${meta.id}-${event.node}-${event.createdAt}-start`,
          sessionId: meta.id,
          type: 'node_transition',
          toNode: event.node,
          createdAt: event.createdAt,
        })
      }

      if (event.type === 'node_complete') {
        appendPipelineNodeCompleteRecords(meta.id, event)
      }

      emitEvent(meta.id, callbacks, event)
    }
    let runner: PipelineNodeRunner
    if (isPipelineFixtureRunnerEnabled()) {
      runner = new PipelineFixtureNodeRunner({ onEvent })
    } else {
      const { RoutedPipelineNodeRunner } = await import('./pipeline-node-router')
      runner = new RoutedPipelineNodeRunner({
        version: meta.version ?? 1,
        claudeChannelId: meta.channelId,
        codexChannelId: resolvePipelineCodexChannelId(getSettings()),
        workspaceId: meta.workspaceId,
        codexBackend: process.env.CODEINSIGHTS_PIPELINE_CODEX_BACKEND === 'cli' ? 'cli' : 'sdk',
        onEvent,
      })
    }

    if (mode === 'execute') {
      activeRunners.set(meta.id, runner)
    }

    const createGraph = meta.version === 2 ? createPipelineGraphV2 : createPipelineGraph
    return createGraph({
      checkpointer,
      getSignal: () => signal,
      runNode: (node, context) => runner.runNode(node, context),
    })
  }

  const createGraph = options.createGraph ?? buildDefaultGraph

  async function driveResult(
    meta: PipelineSessionMeta,
    result: { state: PipelineStateSnapshot; interrupted?: PipelineGateRequest },
    callbacks?: PipelineServiceCallbacks,
    options: { waitForDecision?: boolean } = {},
  ): Promise<void> {
    let current = result
    const waitForDecision = options.waitForDecision ?? true

    while (true) {
      const interrupted = current.interrupted
        ? enrichGateRequest(meta.id, current.interrupted)
        : undefined
      syncSessionState(meta.id, current.state, interrupted ?? null)

      if (!interrupted) {
        if (isTerminalState(current.state.status)) {
          const completeState = mergeStateWithReplayedStageOutputs(meta.id, current.state)
          callbacks?.onComplete?.({
            sessionId: meta.id,
            state: completeState,
          })
        }
        return
      }

      appendPipelineRecord(meta.id, {
        id: `${meta.id}-${interrupted.gateId}-request`,
        sessionId: meta.id,
        type: 'gate_requested',
        node: interrupted.node,
        kind: interrupted.kind,
        gateId: interrupted.gateId,
        title: interrupted.title,
        summary: interrupted.summary,
        feedbackHint: interrupted.feedbackHint,
        remoteWritePlan: interrupted.remoteWritePlan,
        iteration: interrupted.iteration,
        createdAt: interrupted.createdAt,
      })
      emitEvent(meta.id, callbacks, {
        type: 'gate_waiting',
        request: interrupted,
        createdAt: Date.now(),
      })

      if (!waitForDecision) {
        return
      }

      const controller = activeControllers.get(meta.id)
      const response = await gateService.waitForDecision(meta.id, interrupted, controller?.signal)
      if (controller?.signal.aborted) {
        return
      }

      appendPipelineRecord(meta.id, {
        id: `${meta.id}-${response.gateId}-response`,
        sessionId: meta.id,
        type: 'gate_decision',
        node: interrupted.node,
        kind: interrupted.kind,
        action: response.action,
        feedback: response.feedback,
        selectedReportId: response.selectedReportId,
        submissionMode: response.submissionMode,
        localCommitOperationId: response.localCommitOperationId,
        remoteSubmissionOperationId: response.remoteSubmissionOperationId,
        remoteWriteConfirmed: response.remoteWriteConfirmed,
        createdAt: response.createdAt,
      })
      emitEvent(meta.id, callbacks, {
        type: 'gate_resolved',
        response,
        createdAt: Date.now(),
      })

      const latestMeta = getPipelineSessionMeta(meta.id)
      if (!latestMeta) return

      const graph = await Promise.resolve(createGraph(latestMeta, controller?.signal, callbacks, 'execute'))
      current = await graph.resume({
        sessionId: meta.id,
        response,
      })
    }
  }

  async function runExecution(
    meta: PipelineSessionMeta,
    callbacks: PipelineServiceCallbacks | undefined,
    executor: (
      graph: PipelineGraphController,
      latestMeta: PipelineSessionMeta,
      controller: AbortController,
    ) => Promise<{ state: PipelineStateSnapshot; interrupted?: PipelineGateRequest }>,
    options: { waitForDecision?: boolean } = {},
  ): Promise<void> {
    if (activeControllers.has(meta.id)) {
      throw new Error(`Pipeline 会话正在运行中: ${meta.id}`)
    }

    const controller = new AbortController()
    activeControllers.set(meta.id, controller)
    activeCallbacks.set(meta.id, callbacks)

    try {
      const latestMeta = getPipelineSessionMeta(meta.id)
      if (!latestMeta) {
        throw new Error(`未找到 Pipeline 会话: ${meta.id}`)
      }

      const graph = await Promise.resolve(createGraph(latestMeta, controller.signal, callbacks, 'execute'))
      const result = await executor(graph, latestMeta, controller)
      await driveResult(latestMeta, result, callbacks, options)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      const currentMeta = getPipelineSessionMeta(meta.id)
      const replayedAfterError = currentMeta ? replayCurrentPipelineState(meta.id) : undefined
      const remoteSubmission = replayedAfterError?.stageOutputs?.committer?.remoteSubmission
      if (
        !controller.signal.aborted
        && currentMeta?.currentNode === 'committer'
        && replayedAfterError
        && remoteSubmission?.status === 'created'
      ) {
        const updatedMeta = updatePipelineSessionMeta(meta.id, {
          currentNode: 'committer',
          status: 'completed',
          lastApprovedNode: 'committer',
          pendingGate: null,
        })
        appendStatusRecord(
          meta.id,
          'completed',
          `远端 PR 已创建；Graph resume 失败但已保留远端提交状态：${message}`,
        )
        emitStatusChange(meta.id, 'completed', updatedMeta.currentNode, callbacks)
        const completedState: PipelineStateSnapshot = {
          ...replayedAfterError,
          status: 'completed',
          currentNode: 'committer',
          lastApprovedNode: 'committer',
          pendingGate: null,
          updatedAt: updatedMeta.updatedAt,
        }
        callbacks?.onComplete?.({
          sessionId: meta.id,
          state: mergeStateWithReplayedStageOutputs(meta.id, completedState),
        })
        return
      }
      if (!controller.signal.aborted) {
        appendPipelineRecord(meta.id, {
          id: `${meta.id}-error-${Date.now()}`,
          sessionId: meta.id,
          type: 'error',
          node: currentMeta?.currentNode,
          error: message,
          createdAt: Date.now(),
        })
      }

      const terminalStatus = controller.signal.aborted ? 'terminated' : 'node_failed'
      if (!controller.signal.aborted || currentMeta?.status !== 'terminated') {
        const updatedMeta = updatePipelineSessionMeta(meta.id, {
          status: terminalStatus,
          pendingGate: null,
        })
        appendStatusRecord(meta.id, terminalStatus, controller.signal.aborted ? '操作已停止' : message)
        emitStatusChange(meta.id, terminalStatus, updatedMeta.currentNode, callbacks)
      }

      if (!controller.signal.aborted) {
        callbacks?.onError?.({
          sessionId: meta.id,
          error: message,
        })
        throw error
      }
    } finally {
      activeControllers.delete(meta.id)
      activeCallbacks.delete(meta.id)
      activeRunners.delete(meta.id)
    }
  }

  return {
    async listSessions(): Promise<PipelineSessionMeta[]> {
      return reconcileSessions()
    },

    createSession(
      title?: string,
      channelId?: string,
      workspaceId?: string,
      version?: PipelineVersion,
    ): PipelineSessionMeta {
      return createPipelineSession(title, channelId, workspaceId, version)
    },

    getRecords(sessionId: string) {
      return getPipelineRecords(sessionId)
    },

    getRecordsTail(input: PipelineRecordsTailInput): PipelineRecordsTailResult {
      return getPipelineRecordsTail(input)
    },

    async getRecordsSummary(input: PipelineRecordsSummaryInput): Promise<PipelineRecordsSummaryResult> {
      return getPipelineRecordsSummary(input)
    },

    async searchRecords(input: PipelineRecordsSearchInput): Promise<PipelineRecordsSearchResult> {
      return searchPipelineRecordsPage(input)
    },

    async searchSessionRecords(
      input: PipelineSessionRecordsSearchInput,
    ): Promise<PipelineSessionRecordsSearchResult> {
      return searchPipelineSessionRecords(input)
    },

    readArtifactContent(input: PipelineArtifactContentInput): string {
      return readPipelineArtifactContent(input.sessionId, input.ref)
    },

    updateTitle(sessionId: string, title: string): PipelineSessionMeta {
      return updatePipelineSessionMeta(sessionId, { title })
    },

    deleteSession(sessionId: string): void {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }
      if (activeControllers.has(meta.id)) {
        throw new Error(`Pipeline 会话正在运行中，请先停止: ${meta.id}`)
      }

      gateService.clearSessionPending(meta.id)
      void checkpointer.deleteThread(meta.id)
      rmSync(resolvePipelineSessionArtifactsDir(meta.id, { create: false }), {
        recursive: true,
        force: true,
      })
      deletePipelineSession(meta.id)
    },

    getArtifactsDir(sessionId: string): string {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }

      return resolvePipelineSessionArtifactsDir(meta.id)
    },

    getPatchWorkDir(sessionId: string): string {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }
      const task = getContributionTaskForSession(meta.id, { required: true })
      return resolvePatchWorkDir(task!.repositoryRoot, { create: false })
    },

    getPatchWorkFilePath(input: PipelinePatchWorkReadFileInput): string {
      const parsed = parsePatchWorkReadFileInput(input)
      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      return resolvePatchWorkManifestFilePath({
        repositoryRoot: task!.repositoryRoot,
        relativePath: parsed.relativePath,
      })
    },

    async runPreflight(input: PipelineRunPreflightInput): Promise<PipelinePreflightResult> {
      const meta = getPipelineSessionMeta(input.sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${input.sessionId}`)
      }
      return runSessionPreflight(meta, {
        sessionId: meta.id,
        workspaceId: input.workspaceId ?? meta.workspaceId,
        requireGit: true,
        requireClaudeCli: !isPipelineFixtureRunnerEnabled(),
        requireCodexCli: meta.version === 2 && !isPipelineFixtureRunnerEnabled(),
      })
    },

    togglePin(sessionId: string): PipelineSessionMeta {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }
      const nextPinned = !meta.pinned
      return updatePipelineSessionMeta(sessionId, {
        pinned: nextPinned,
        ...(nextPinned && meta.archived ? { archived: false } : {}),
      })
    },

    toggleArchive(sessionId: string): PipelineSessionMeta {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }
      const nextArchived = !meta.archived
      return updatePipelineSessionMeta(sessionId, {
        archived: nextArchived,
        ...(nextArchived && meta.pinned ? { pinned: false } : {}),
      })
    },

    async start(
      input: PipelineStartInput,
      callbacks?: PipelineServiceCallbacks,
    ): Promise<void> {
      const meta = getPipelineSessionMeta(input.sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${input.sessionId}`)
      }

      const effectiveWorkspaceId = input.workspaceId ?? meta.workspaceId
      const startPreflight = await assertStartPreflight(
        meta,
        effectiveWorkspaceId,
        input.preflightAcknowledgement,
      )

      appendPipelineRecord(meta.id, {
        id: `${meta.id}-user-${Date.now()}`,
        sessionId: meta.id,
        type: 'user_input',
        content: input.userInput,
        createdAt: Date.now(),
      })

      ensureV2ContributionTask(meta, effectiveWorkspaceId)
      if (startPreflight) {
        appendPreflightContributionEvent(
          meta.id,
          startPreflight.preflight,
          startPreflight.acknowledgement,
        )
      }

      updatePipelineSessionMeta(meta.id, {
        channelId: input.channelId ?? meta.channelId,
        workspaceId: effectiveWorkspaceId,
        threadId: input.threadId ?? meta.threadId,
        status: 'running',
        pendingGate: null,
      })
      await runExecution(meta, callbacks, async (graph) => graph.invoke({
        sessionId: meta.id,
        userInput: input.userInput,
      }))
    },

    async respondGate(
      response: PipelineGateResponse,
      callbacks?: PipelineServiceCallbacks,
    ): Promise<void> {
      const activePendingGate = gateService
        .getPendingRequests()
        .find((request) => request.gateId === response.gateId && request.sessionId === response.sessionId)
      if (activePendingGate) {
        await applyV2GateSideEffects(activePendingGate, response)
      }
      const hitPending = gateService.respond(response)
      if (hitPending) return

      const meta = getPipelineSessionMeta(response.sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${response.sessionId}`)
      }
      const pendingGate = assertGateResponseMatchesPending(meta, response)
      if (!pendingGate) {
        return
      }
      if (activeControllers.has(meta.id)) {
        return
      }

      await applyV2GateSideEffects(pendingGate, response)
      appendPipelineRecord(meta.id, {
        id: `${meta.id}-${response.gateId}-response`,
        sessionId: meta.id,
        type: 'gate_decision',
        node: pendingGate.node,
        kind: pendingGate.kind,
        action: response.action,
        feedback: response.feedback,
        selectedReportId: response.selectedReportId,
        submissionMode: response.submissionMode,
        localCommitOperationId: response.localCommitOperationId,
        remoteSubmissionOperationId: response.remoteSubmissionOperationId,
        remoteWriteConfirmed: response.remoteWriteConfirmed,
        createdAt: response.createdAt,
      })
      emitEvent(meta.id, callbacks, {
        type: 'gate_resolved',
        response,
        createdAt: Date.now(),
      })
      await runExecution(meta, callbacks, async (graph) => graph.resume({
        sessionId: meta.id,
        response,
      }), { waitForDecision: false })
    },

    async resume(
      input: { sessionId: string; response?: PipelineGateResponse },
      callbacks?: PipelineServiceCallbacks,
    ): Promise<void> {
      if (!input.response) {
        throw new Error('resumePipeline 需要提供 gate response')
      }
      await this.respondGate(input.response, callbacks)
    },

    stop(sessionId: string): PipelineStateSnapshot {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }

      activeControllers.get(sessionId)?.abort()
      activeRunners.get(sessionId)?.abort?.(sessionId)
      const updatedMeta = updatePipelineSessionMeta(sessionId, {
        status: 'terminated',
        pendingGate: null,
      })
      appendStatusRecord(sessionId, 'terminated', '操作已停止')
      emitStatusChange(sessionId, 'terminated', updatedMeta.currentNode)
      if (meta?.pendingGate) {
        gateService.clearSessionPending(sessionId)
      }

      return {
        sessionId: updatedMeta.id,
        version: updatedMeta.version,
        currentNode: updatedMeta.currentNode,
        status: 'terminated',
        reviewIteration: updatedMeta.reviewIteration,
        lastApprovedNode: updatedMeta.lastApprovedNode,
        pendingGate: null,
        updatedAt: updatedMeta.updatedAt,
      }
    },

    getPendingGates(): PipelineGateRequest[] {
      const combined = new Map<string, PipelineGateRequest>()

      for (const request of gateService.getPendingRequests()) {
        combined.set(request.gateId, enrichGateRequest(request.sessionId, request))
      }

      for (const session of listPipelineSessions()) {
        if (session.pendingGate) {
          combined.set(session.pendingGate.gateId, enrichGateRequest(session.id, session.pendingGate))
        }
      }

      return [...combined.values()]
    },

    async getSessionState(sessionId: string): Promise<PipelineStateSnapshot> {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }

      if (isTerminalState(meta.status)) {
        const replayedState = replayCurrentPipelineState(sessionId)
        if (replayedState.stageOutputs?.committer?.remoteSubmission?.status === 'created') {
          return replayedState.pendingGate
            ? {
                ...replayedState,
                pendingGate: enrichGateRequest(sessionId, replayedState.pendingGate),
              }
            : replayedState
        }
      }

      try {
        const graph = await Promise.resolve(createGraph(meta))
        const graphState = await graph.getState(sessionId)
        const mergedState = mergeStateWithReplayedStageOutputs(sessionId, graphState)
        return mergedState.pendingGate
          ? {
              ...mergedState,
              pendingGate: enrichGateRequest(sessionId, mergedState.pendingGate),
            }
          : mergedState
      } catch {
        const replayedState = replayCurrentPipelineState(sessionId)
        return replayedState.pendingGate
          ? {
              ...replayedState,
              pendingGate: enrichGateRequest(sessionId, replayedState.pendingGate),
            }
          : replayedState
      }
    },

    getPatchWorkManifest(input: PipelinePatchWorkSessionInput) {
      const parsed = parsePatchWorkSessionInput(input)
      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      return readPatchWorkManifest(task!.repositoryRoot)
    },

    getContributionTaskSummary(input: PipelineContributionTaskSummaryInput): ContributionTaskSummary {
      const parsed = parsePatchWorkSessionInput(input)
      return buildContributionTaskSummary(parsed)
    },

    getSubmissionPlan(input: PipelineSubmissionPlanInput): PipelineSubmissionPlan {
      const parsed = parsePatchWorkSessionInput(input)
      return buildPipelineSubmissionPlan(parsed)
    },

    exportPipelineReport(input: PipelineReportExportInput): PipelineReportExport {
      const parsed = parsePatchWorkSessionInput(input)
      return buildPipelineReportExport(parsed)
    },

    async savePipelineReportPdf(input: PipelineReportPdfSaveInput): Promise<PipelineReportPdfSaveResult> {
      const parsed = parsePatchWorkSessionInput(input)
      const report = buildPipelineReportExport(parsed)
      return reportPdfSaver(report)
    },

    readPatchWorkFile(input: PipelinePatchWorkReadFileInput): string {
      const parsed = parsePatchWorkReadFileInput(input)
      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      return readPatchWorkManifestFile({
        repositoryRoot: task!.repositoryRoot,
        relativePath: parsed.relativePath,
      })
    },

    listPatchWorkRevisions(input: PipelinePatchWorkReadFileInput): PatchWorkDocumentRevision[] {
      const parsed = parsePatchWorkReadFileInput(input)
      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      return listPatchWorkDocumentRevisions({
        repositoryRoot: task!.repositoryRoot,
        relativePath: parsed.relativePath,
      })
    },

    readPatchWorkRevision(input: PipelinePatchWorkRevisionInput): PatchWorkDocumentRevision {
      const parsed = parsePatchWorkRevisionInput(input)
      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      return readPatchWorkDocumentRevision({
        repositoryRoot: task!.repositoryRoot,
        relativePath: parsed.relativePath,
        revision: parsed.revision,
      })
    },

    listExplorerReports(input: PipelinePatchWorkSessionInput): PipelineExplorerReportRef[] {
      const parsed = parsePatchWorkSessionInput(input)
      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      return listPatchWorkExplorerReports({
        repositoryRoot: task!.repositoryRoot,
      })
    },

    async selectTask(
      input: PipelineSelectTaskInput,
      callbacks?: PipelineServiceCallbacks,
    ): Promise<PipelineSelectTaskResult> {
      const parsed = parseSelectTaskInput(input)
      const meta = getPipelineSessionMeta(parsed.sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${parsed.sessionId}`)
      }
      const pendingGate = meta.pendingGate
      if (!pendingGate || pendingGate.gateId !== parsed.gateId || pendingGate.kind !== 'task_selection') {
        throw new Error('Pipeline task selection gate 不匹配，请刷新后重试')
      }

      await this.respondGate({
        gateId: parsed.gateId,
        sessionId: parsed.sessionId,
        kind: 'task_selection',
        action: 'approve',
        selectedReportId: parsed.selectedReportId,
        createdAt: Date.now(),
      }, callbacks)

      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      const reports = listPatchWorkExplorerReports({ repositoryRoot: task!.repositoryRoot })
      const selectedReport = reports.find((report) => report.reportId === parsed.selectedReportId)
      const manifest = readPatchWorkManifest(task!.repositoryRoot)
      const selectedTaskRef = manifest.files.find((file) => file.kind === 'selected_task')
      if (!selectedReport || !selectedTaskRef) {
        throw new Error('选择任务后未找到 selected-task.md，请刷新后重试')
      }

      return {
        manifest,
        selectedReport,
        selectedTaskRef,
      }
    },
  }
}

let pipelineServiceSingleton: ReturnType<typeof createPipelineService> | null = null

export function getPipelineService() {
  if (!pipelineServiceSingleton) {
    pipelineServiceSingleton = createPipelineService()
  }
  return pipelineServiceSingleton
}
