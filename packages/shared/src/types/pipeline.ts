/**
 * Pipeline 相关类型定义
 *
 * 定义 CodeInsights Pipeline 的会话元数据、记录、流式事件和 IPC 通道常量。
 */

/** Pipeline 工作流版本。缺省按 v1 处理，保证旧会话兼容。 */
export type PipelineVersion = 1 | 2

/** Pipeline 节点类型。v1 使用前五个节点，v2 额外启用 committer。 */
export type PipelineNodeKind =
  | 'explorer'
  | 'planner'
  | 'developer'
  | 'reviewer'
  | 'tester'
  | 'committer'

/** Pipeline 会话状态 */
export type PipelineSessionStatus =
  | 'idle'
  | 'running'
  | 'waiting_human'
  | 'node_failed'
  | 'completed'
  | 'terminated'
  | 'recovery_failed'

/** 人工审核动作 */
export type PipelineGateAction =
  | 'approve'
  | 'reject_with_feedback'
  | 'rerun_node'

/** Pipeline v2 人工 gate 语义类型 */
export type PipelineGateKind =
  | 'task_selection'
  | 'document_review'
  | 'review_iteration_limit'
  | 'test_blocked'
  | 'submission_review'
  | 'remote_write_confirmation'

/** Pipeline 会话元数据 */
export interface PipelineSessionMeta {
  id: string
  version?: PipelineVersion
  title: string
  channelId?: string
  workspaceId?: string
  threadId?: string
  currentNode: PipelineNodeKind
  status: PipelineSessionStatus
  reviewIteration: number
  lastApprovedNode?: PipelineNodeKind
  pendingGate?: PipelineGateRequest | null
  pinned?: boolean
  archived?: boolean
  createdAt: number
  updatedAt: number
}

/** 人工审核请求 */
export interface PipelineGateRequest {
  gateId: string
  sessionId: string
  node: PipelineNodeKind
  kind?: PipelineGateKind
  title?: string
  summary?: string
  feedbackHint?: string
  remoteWritePlan?: PipelineRemoteWriteConfirmationPlan
  iteration: number
  createdAt: number
}

export interface PipelineRemoteWriteConfirmationPlan {
  operationId: string
  remoteName: string
  baseBranch: string
  headBranch: string
  commitHash: string
  prTitle: string
  prBody: string
  sanitizedRemoteUrl?: string
  githubRepo?: string
  pushedRef?: string
  warnings: string[]
}

/** 人工审核响应 */
export interface PipelineGateResponse {
  gateId: string
  sessionId: string
  kind?: PipelineGateKind
  action: PipelineGateAction
  feedback?: string
  selectedReportId?: string
  submissionMode?: ContributionMode
  localCommitOperationId?: string
  remoteSubmissionOperationId?: string
  remoteWriteConfirmed?: boolean
  createdAt: number
}

export interface PipelinePatchWorkDocumentRef {
  displayName: string
  relativePath: string
  checksum?: string
  revision?: number
}

/** patch-work 文档单个 revision 的只读快照 */
export interface PatchWorkDocumentRevision {
  displayName: string
  relativePath: string
  revision: number
  checksum: string
  actualChecksum: string
  content: string
  createdByNode: PatchWorkNodeKind
  updatedAt: number
  accepted: boolean
  current: boolean
  checksumMatches: boolean
}

export interface PipelineExplorerReportRef extends PipelinePatchWorkDocumentRef {
  reportId: string
  title: string
  summary?: string
}

export interface PipelinePatchSetFile extends PipelineChangedFile {
  additions?: number
  deletions?: number
}

export interface PipelineTestEvidence {
  command: string
  status: PipelineTestRunStatus
  summary: string
  durationMs?: number
  outputRef?: PipelinePatchWorkDocumentRef
}

export interface PipelinePatchSetSummary {
  files: PipelinePatchSetFile[]
  additions?: number
  deletions?: number
  patchRef?: PipelinePatchWorkDocumentRef
  changedFilesRef?: PipelinePatchWorkDocumentRef
  excludesPatchWork: boolean
  diffSummaryRef?: PipelinePatchWorkDocumentRef
  testEvidenceRef?: PipelinePatchWorkDocumentRef
  testEvidence?: PipelineTestEvidence[]
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
}

export type PipelineChangedFileType = 'added' | 'modified' | 'deleted' | 'renamed'

export interface PipelineChangedFile {
  path: string
  changeType: PipelineChangedFileType
  summary: string
}

export type PipelineTestRunStatus = 'passed' | 'failed' | 'skipped'

export interface PipelineTestRun {
  command: string
  status: PipelineTestRunStatus
  summary: string
  durationMs?: number
  outputRef?: PipelinePatchWorkDocumentRef
}

export type PipelineReviewIssueSeverity = 'blocker' | 'major' | 'minor' | 'nit'

export type PipelineReviewIssueCategory =
  | 'correctness'
  | 'regression'
  | 'test_gap'
  | 'maintainability'
  | 'security'
  | 'style'

export type PipelineReviewIssueStatus = 'open' | 'fixed' | 'accepted_risk'

export interface PipelineReviewIssue {
  id: string
  severity: PipelineReviewIssueSeverity
  category: PipelineReviewIssueCategory
  title: string
  detail: string
  status: PipelineReviewIssueStatus
  file?: string
  line?: number
  suggestedFix?: string
}

export interface PipelineExplorerStageOutput {
  node: 'explorer'
  summary: string
  findings: string[]
  keyFiles: string[]
  nextSteps: string[]
  reports?: PipelineExplorerReportRef[]
  selectedReportId?: string
  content: string
}

export interface PipelinePlannerStageOutput {
  node: 'planner'
  summary: string
  steps: string[]
  risks: string[]
  verification: string[]
  planRef?: PipelinePatchWorkDocumentRef
  testPlanRef?: PipelinePatchWorkDocumentRef
  documentRefs?: PipelinePatchWorkDocumentRef[]
  content: string
}

export interface PipelineDeveloperStageOutput {
  node: 'developer'
  summary: string
  changes: string[]
  tests: string[]
  risks: string[]
  changedFiles?: PipelineChangedFile[]
  testsRun?: PipelineTestRun[]
  devDoc?: PipelinePatchWorkDocumentRef
  devDocRef?: PipelinePatchWorkDocumentRef
  fixedFiles?: string[]
  content: string
}

export interface PipelineReviewerStageOutput {
  node: 'reviewer'
  summary: string
  approved: boolean
  issues: string[]
  structuredIssues?: PipelineReviewIssue[]
  reviewDoc?: PipelinePatchWorkDocumentRef
  reviewDocRef?: PipelinePatchWorkDocumentRef
  reviewIteration?: number
  iterationLimitReached?: boolean
  content: string
}

export interface PipelineTesterStageOutput {
  node: 'tester'
  summary: string
  commands: string[]
  results: string[]
  blockers: string[]
  testResultRef?: PipelinePatchWorkDocumentRef
  patchSet?: PipelinePatchSetSummary
  passed?: boolean
  riskAccepted?: boolean
  testEvidence?: PipelineTestEvidence[]
  changedFiles?: string[]
  content: string
}

export type PipelineSubmissionStatus =
  | 'draft_only'
  | 'local_commit_ready'
  | 'local_commit_created'
  | 'remote_pr_ready'
  | 'remote_pr_created'
  | 'remote_pr_failed'
  | 'blocked'

export type PipelineLocalCommitStatus = 'not_requested' | 'created' | 'failed'
export type PipelineRemoteSubmissionStatus = 'not_requested' | 'pushed' | 'created' | 'failed'
export type PipelineRemoteSubmissionType = 'push' | 'pull_request'

export interface PipelineLocalCommitSummary {
  attempted: boolean
  operationId?: string
  commitHash?: string
  commitMessage?: string
  status: PipelineLocalCommitStatus
  error?: string
  files?: PipelinePatchSetFile[]
  excludedFiles?: string[]
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
  createdAt?: number
}

export interface PipelineRemoteSubmissionSummary {
  attempted: boolean
  operationId?: string
  commitHash?: string
  status: PipelineRemoteSubmissionStatus
  type?: PipelineRemoteSubmissionType
  provider?: 'gh_cli' | 'github_api'
  remoteName?: string
  sanitizedRemoteUrl?: string
  githubRepo?: string
  baseBranch?: string
  headBranch?: string
  pushedRef?: string
  prTitle?: string
  prBody?: string
  prUrl?: string
  prNumber?: number
  existingPr?: boolean
  draft?: boolean
  error?: string
  pushedAt?: number
  createdAt?: number
}

export interface PipelineCommitterStageOutput {
  node: 'committer'
  summary: string
  commitMessage: string
  prTitle: string
  prBody: string
  submissionStatus: PipelineSubmissionStatus
  blockers: string[]
  risks: string[]
  commitDocRef?: PipelinePatchWorkDocumentRef
  prDocRef?: PipelinePatchWorkDocumentRef
  commitRef?: PipelinePatchWorkDocumentRef
  prRef?: PipelinePatchWorkDocumentRef
  localCommit?: PipelineLocalCommitSummary
  remoteSubmission?: PipelineRemoteSubmissionSummary
  content: string
}

export type PipelineStageOutput =
  | PipelineExplorerStageOutput
  | PipelinePlannerStageOutput
  | PipelineDeveloperStageOutput
  | PipelineReviewerStageOutput
  | PipelineTesterStageOutput
  | PipelineCommitterStageOutput

export interface PipelineStageOutputByNode {
  explorer: PipelineExplorerStageOutput
  planner: PipelinePlannerStageOutput
  developer: PipelineDeveloperStageOutput
  reviewer: PipelineReviewerStageOutput
  tester: PipelineTesterStageOutput
  committer: PipelineCommitterStageOutput
}

export type PipelineStageOutputMap = Partial<PipelineStageOutputByNode>

export type PipelineArtifactFileKind = 'markdown' | 'json' | 'content'

export interface PipelineArtifactFileRef {
  kind: PipelineArtifactFileKind
  displayName: string
  relativePath: string
}

export interface PipelineArtifactContentRef extends PipelineArtifactFileRef {
  kind: 'content'
}

export interface PipelineArtifactManifest {
  version: number
  sessionId: string
  files: PipelineArtifactFileRef[]
  updatedAt: number
}

/** Pipeline v2 贡献模式 */
export type ContributionMode = 'local_patch' | 'local_commit' | 'remote_pr'

/** Pipeline v2 贡献任务状态 */
export type ContributionTaskStatus =
  | 'created'
  | 'exploring'
  | 'task_selected'
  | 'planning'
  | 'plan_review'
  | 'developing'
  | 'dev_review'
  | 'reviewing'
  | 'testing'
  | 'committing'
  | 'completed'
  | 'failed'

/** 一次开源贡献任务，承载仓库、分支、patch-work 和 Pipeline session 的领域状态 */
export interface ContributionTask {
  id: string
  pipelineSessionId: string
  workspaceId?: string
  repositoryRoot: string
  repositoryUrl?: string
  issueUrl?: string
  baseBranch?: string
  workingBranch?: string
  baseCommit?: string
  selectedReportId?: string
  selectedTaskTitle?: string
  patchWorkDir: string
  contributionMode: ContributionMode
  allowRemoteWrites: boolean
  status: ContributionTaskStatus
  currentGateId?: string
  createdAt: number
  updatedAt: number
}

export type ContributionTaskEventType =
  | 'task_created'
  | 'task_updated'
  | 'preflight_completed'
  | 'patch_work_updated'
  | 'document_revision_created'
  | 'local_commit_created'
  | 'local_commit_failed'
  | 'remote_write_confirmed'
  | 'remote_submission_created'
  | 'remote_submission_failed'
  | 'task_failed'

/** 贡献任务审计事件，按 taskId 写入 JSONL */
export interface ContributionTaskEvent {
  id: string
  taskId: string
  pipelineSessionId: string
  type: ContributionTaskEventType
  payload?: Record<string, unknown>
  createdAt: number
}

export interface ContributionTaskRepositorySummary {
  root: string
  url?: string
  issueUrl?: string
  baseBranch?: string
  workingBranch?: string
  baseCommit?: string
}

export interface ContributionTaskPatchWorkSummary {
  dir: string
  manifestFound: boolean
  fileCount: number
  acceptedFileCount: number
  updatedAt?: number
  error?: string
}

export interface ContributionTaskSummaryEvent {
  id: string
  type: ContributionTaskEventType
  title: string
  detail?: string
  createdAt: number
}

export interface ContributionTaskSummary {
  sessionId: string
  task: ContributionTask | null
  repository?: ContributionTaskRepositorySummary
  mode?: ContributionMode
  allowRemoteWrites?: boolean
  patchWork?: ContributionTaskPatchWorkSummary
  localCommit?: PipelineLocalCommitSummary
  remoteSubmission?: PipelineRemoteSubmissionSummary
  recentEvents: ContributionTaskSummaryEvent[]
  updatedAt: number
  error?: string
}

export interface PipelineSubmissionPlan {
  sessionId: string
  mode: ContributionMode
  commitMessage: string
  prTitle: string
  prBody: string
  baseBranch?: string
  headBranch?: string
  remoteName?: string
  sanitizedRemoteUrl?: string
  candidateFiles: string[]
  excludedFiles: string[]
  blockers: string[]
  warnings: string[]
  localCommit?: PipelineLocalCommitSummary
  remoteSubmission?: PipelineRemoteSubmissionSummary
  updatedAt: number
}

export interface PipelineReportExport {
  sessionId: string
  title: string
  markdown: string
  html: string
  fileName: string
  htmlFileName: string
  pdfFileName: string
  generatedAt: number
}

/** patch-work 文件归属节点。preflight 不是 Agent 阶段，但会写入检查产物。 */
export type PatchWorkNodeKind = PipelineNodeKind | 'preflight'

export type PatchWorkFileKind =
  | 'explorer_report'
  | 'selected_task'
  | 'implementation_plan'
  | 'test_plan'
  | 'dev_doc'
  | 'review_doc'
  | 'test_result'
  | 'patch'
  | 'changed_files'
  | 'diff_summary'
  | 'test_evidence'
  | 'commit_doc'
  | 'pr_doc'

/** 指向 patch-work 内文件的安全引用 */
export interface PatchWorkFileRef {
  kind: PatchWorkFileKind
  displayName: string
  relativePath: string
  createdByNode: PatchWorkNodeKind
  revision: number
  checksum: string
  updatedAt: number
  acceptedRevision?: number
  acceptedAt?: number
  acceptedByGateId?: string
}

/** patch-work 文件事实源 manifest */
export interface PatchWorkManifest {
  version: 1
  contributionTaskId: string
  pipelineSessionId: string
  repositoryRoot: string
  patchWorkDir: string
  selectedReportId?: string
  files: PatchWorkFileRef[]
  checksums: Record<string, string>
  updatedAt: number
}

export type PipelinePackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn' | 'unknown'

export type PipelinePreflightRuntimeKind =
  | 'claude-cli'
  | 'codex-cli'
  | 'git'
  | 'github'

export type PipelinePreflightIssueCode =
  | 'repository_missing'
  | 'repository_not_git_root'
  | 'git_missing'
  | 'git_conflicts'
  | 'git_uncommitted_changes'
  | 'git_detached_head'
  | 'git_remote_missing'
  | 'claude_cli_missing'
  | 'codex_cli_missing'
  | 'package_manager_unknown'

export interface PipelinePreflightIssue {
  code: PipelinePreflightIssueCode
  message: string
}

export interface PipelinePreflightRuntimeStatus {
  kind: PipelinePreflightRuntimeKind
  available: boolean
  version?: string
  path?: string
  error?: string
}

export interface PipelinePreflightRepositoryStatus {
  root: string
  currentBranch?: string
  baseBranch?: string
  remoteUrl?: string
  headCommit?: string
  statusDigest?: string
  hasUncommittedChanges: boolean
  hasConflicts: boolean
}

export interface PipelinePreflightInput {
  repositoryRoot: string
  requireClaudeCli?: boolean
  requireCodexCli?: boolean
  requireGit?: boolean
}

export interface PipelineRunPreflightInput {
  sessionId: string
  workspaceId?: string
}

export interface PipelinePreflightAcknowledgement {
  fingerprint: string
  acceptedWarningCodes: PipelinePreflightIssueCode[]
  acknowledgedAt: number
}

export interface PipelinePreflightResult {
  ok: boolean
  repository: PipelinePreflightRepositoryStatus
  runtimes: PipelinePreflightRuntimeStatus[]
  packageManager: PipelinePackageManager
  warnings: PipelinePreflightIssue[]
  blockers: PipelinePreflightIssue[]
  checkedAt: number
  fingerprint: string
}

/** 启动 Pipeline 输入 */
export interface PipelineStartInput {
  sessionId: string
  userInput: string
  channelId?: string
  workspaceId?: string
  threadId?: string
  preflightAcknowledgement?: PipelinePreflightAcknowledgement
}

/** 恢复 Pipeline 输入 */
export interface PipelineResumeInput {
  sessionId: string
  response?: PipelineGateResponse
}

export type PipelineRecordsTailDirection = 'latest' | 'before' | 'after'

/** Pipeline 记录增量读取输入 */
export interface PipelineRecordsTailInput {
  sessionId: string
  afterIndex?: number
  cursor?: string
  direction?: PipelineRecordsTailDirection
  limit?: number
}

/** Pipeline 记录增量读取结果 */
export interface PipelineRecordsTailResult {
  sessionId: string
  records: PipelineRecord[]
  nextIndex: number
  hasMore: boolean
  previousCursor?: string
  nextCursor?: string
  cursorInvalid?: boolean
}

/** Pipeline 记录摘要读取输入 */
export interface PipelineRecordsSummaryInput {
  sessionId: string
}

/** Pipeline 记录摘要，用于避免从截断 records window 推导关键状态 */
export interface PipelineRecordsSummaryResult {
  sessionId: string
  latestUserInput?: string
  latestErrorRecord?: Extract<PipelineRecord, { type: 'error' }>
}

export type PipelineRecordSearchStage = 'all' | 'task' | PipelineNodeKind

export type PipelineRecordSearchTab = 'artifacts' | 'logs'

/** Pipeline 记录分页搜索输入 */
export interface PipelineRecordsSearchInput {
  sessionId: string
  query: string
  stage?: PipelineRecordSearchStage
  offset?: number
  limit?: number
}

/** Pipeline 记录分页搜索命中项 */
export interface PipelineRecordsSearchMatch {
  recordId: string
  recordType: PipelineRecord['type']
  tab: PipelineRecordSearchTab
  stage: PipelineRecordSearchStage
  title: string
  snippet: string
  createdAt: number
}

/** Pipeline 记录分页搜索结果 */
export interface PipelineRecordsSearchResult {
  sessionId: string
  query: string
  matches: PipelineRecordsSearchMatch[]
  total: number
  nextOffset: number
  hasMore: boolean
}

/** Pipeline 全局内容搜索输入 */
export interface PipelineSessionRecordsSearchInput {
  query: string
  limit?: number
  includeArchived?: boolean
}

/** Pipeline 全局内容搜索命中项 */
export interface PipelineSessionRecordsSearchMatch {
  sessionId: string
  sessionTitle: string
  archived?: boolean
  recordId: string
  recordType: PipelineRecord['type']
  stage: PipelineRecordSearchStage
  title: string
  snippet: string
  matchStart: number
  matchLength: number
  createdAt: number
}

/** Pipeline 全局内容搜索结果 */
export interface PipelineSessionRecordsSearchResult {
  query: string
  matches: PipelineSessionRecordsSearchMatch[]
  total: number
  hasMore: boolean
}

export interface PipelineArtifactContentInput {
  sessionId: string
  ref: PipelineArtifactContentRef
}

export interface PipelinePatchWorkSessionInput {
  sessionId: string
}

export interface PipelineContributionTaskSummaryInput extends PipelinePatchWorkSessionInput {}

export interface PipelineSubmissionPlanInput extends PipelinePatchWorkSessionInput {}

export interface PipelineReportExportInput extends PipelinePatchWorkSessionInput {}

export interface PipelineReportPdfSaveInput extends PipelinePatchWorkSessionInput {}

export interface PipelineReportPdfSaveResult {
  canceled: boolean
  fileName: string
  filePath?: string
}

export interface PipelinePatchWorkReadFileInput extends PipelinePatchWorkSessionInput {
  relativePath: string
}

export interface PipelinePatchWorkRevisionInput extends PipelinePatchWorkReadFileInput {
  revision: number
}

export interface PipelineSelectTaskInput extends PipelinePatchWorkSessionInput {
  gateId: string
  selectedReportId: string
}

export interface PipelineSelectTaskResult {
  manifest: PatchWorkManifest
  selectedReport: PipelineExplorerReportRef
  selectedTaskRef: PatchWorkFileRef
}

/** 当前 Pipeline 运行快照 */
export interface PipelineStateSnapshot {
  sessionId: string
  version?: PipelineVersion
  currentNode: PipelineNodeKind
  status: PipelineSessionStatus
  reviewIteration: number
  lastApprovedNode?: PipelineNodeKind
  pendingGate?: PipelineGateRequest | null
  stageOutputs?: PipelineStageOutputMap
  updatedAt: number
}

/** 用户输入记录 */
export interface PipelineUserInputRecord {
  id: string
  sessionId: string
  type: 'user_input'
  content: string
  createdAt: number
}

/** 节点切换记录 */
export interface PipelineNodeTransitionRecord {
  id: string
  sessionId: string
  type: 'node_transition'
  toNode: PipelineNodeKind
  fromNode?: PipelineNodeKind
  createdAt: number
}

/** 节点输出记录 */
export interface PipelineNodeOutputRecord {
  id: string
  sessionId: string
  type: 'node_output'
  node: PipelineNodeKind
  content: string
  summary?: string
  createdAt: number
}

/** reviewer 结构化结论 */
export interface PipelineReviewResultRecord {
  id: string
  sessionId: string
  type: 'review_result'
  node: 'reviewer'
  approved: boolean
  summary: string
  issues?: string[]
  createdAt: number
}

/** 阶段结构化产物记录 */
export interface PipelineStageArtifactRecord {
  id: string
  sessionId: string
  type: 'stage_artifact'
  node: PipelineNodeKind
  artifact: PipelineStageOutput
  artifactFiles?: PipelineArtifactFileRef[]
  artifactContentRef?: PipelineArtifactContentRef
  createdAt: number
}

/** 审核请求记录 */
export interface PipelineGateRequestedRecord {
  id: string
  sessionId: string
  type: 'gate_requested'
  node: PipelineNodeKind
  kind?: PipelineGateKind
  gateId: string
  title?: string
  summary?: string
  feedbackHint?: string
  remoteWritePlan?: PipelineRemoteWriteConfirmationPlan
  iteration?: number
  createdAt: number
}

/** 审核结果记录 */
export interface PipelineGateDecisionRecord {
  id: string
  sessionId: string
  type: 'gate_decision'
  node: PipelineNodeKind
  kind?: PipelineGateKind
  action: PipelineGateAction
  feedback?: string
  selectedReportId?: string
  submissionMode?: ContributionMode
  localCommitOperationId?: string
  remoteSubmissionOperationId?: string
  remoteWriteConfirmed?: boolean
  createdAt: number
}

/** 状态变更记录 */
export interface PipelineStatusChangeRecord {
  id: string
  sessionId: string
  type: 'status_change'
  status: PipelineSessionStatus
  reason?: string
  createdAt: number
}

/** 错误记录 */
export interface PipelineErrorRecord {
  id: string
  sessionId: string
  type: 'error'
  node?: PipelineNodeKind
  error: string
  createdAt: number
}

/** 持久化记录联合类型 */
export type PipelineRecord =
  | PipelineUserInputRecord
  | PipelineNodeTransitionRecord
  | PipelineNodeOutputRecord
  | PipelineStageArtifactRecord
  | PipelineReviewResultRecord
  | PipelineGateRequestedRecord
  | PipelineGateDecisionRecord
  | PipelineStatusChangeRecord
  | PipelineErrorRecord

/** 流式事件 */
export type PipelineStreamEvent =
  | {
      type: 'node_start'
      node: PipelineNodeKind
      createdAt: number
    }
  | {
      type: 'text_delta'
      node: PipelineNodeKind
      delta: string
      createdAt: number
    }
  | {
      type: 'node_complete'
      node: PipelineNodeKind
      output: string
      summary?: string
      approved?: boolean
      issues?: string[]
      artifact?: PipelineStageOutput
      createdAt: number
    }
  | {
      type: 'status_change'
      status: PipelineSessionStatus
      currentNode: PipelineNodeKind
      createdAt: number
    }
  | {
      type: 'gate_waiting'
      request: PipelineGateRequest
      createdAt: number
    }
  | {
      type: 'gate_resolved'
      response: PipelineGateResponse
      createdAt: number
    }
  | {
      type: 'error'
      error: string
      node?: PipelineNodeKind
      createdAt: number
    }

/** Pipeline 流式载荷 */
export interface PipelineStreamPayload {
  sessionId: string
  event: PipelineStreamEvent
}

/** Pipeline 流结束载荷 */
export interface PipelineStreamCompletePayload {
  sessionId: string
  state: PipelineStateSnapshot
}

/** Pipeline 流错误载荷 */
export interface PipelineStreamErrorPayload {
  sessionId: string
  error: string
}

/** Pipeline IPC 通道 */
export const PIPELINE_IPC_CHANNELS = {
  LIST_SESSIONS: 'pipeline:list-sessions',
  CREATE_SESSION: 'pipeline:create-session',
  GET_RECORDS: 'pipeline:get-records',
  GET_RECORDS_TAIL: 'pipeline:get-records-tail',
  GET_RECORDS_SUMMARY: 'pipeline:get-records-summary',
  SEARCH_RECORDS: 'pipeline:search-records',
  SEARCH_SESSION_RECORDS: 'pipeline:search-session-records',
  READ_ARTIFACT_CONTENT: 'pipeline:read-artifact-content',
  GET_PATCH_WORK_MANIFEST: 'pipeline-v2:get-patch-work-manifest',
  GET_CONTRIBUTION_TASK_SUMMARY: 'pipeline-v2:get-contribution-task-summary',
  GET_SUBMISSION_PLAN: 'pipeline-v2:get-submission-plan',
  EXPORT_REPORT: 'pipeline-v2:export-report',
  SAVE_REPORT_PDF: 'pipeline-v2:save-report-pdf',
  READ_PATCH_WORK_FILE: 'pipeline-v2:read-patch-work-file',
  LIST_PATCH_WORK_REVISIONS: 'pipeline-v2:list-patch-work-revisions',
  READ_PATCH_WORK_REVISION: 'pipeline-v2:read-patch-work-revision',
  LIST_EXPLORER_REPORTS: 'pipeline-v2:list-explorer-reports',
  SELECT_TASK: 'pipeline-v2:select-task',
  RUN_PREFLIGHT: 'pipeline:run-preflight',
  UPDATE_TITLE: 'pipeline:update-title',
  DELETE_SESSION: 'pipeline:delete-session',
  TOGGLE_PIN: 'pipeline:toggle-pin',
  TOGGLE_ARCHIVE: 'pipeline:toggle-archive',
  START: 'pipeline:start',
  RESUME: 'pipeline:resume',
  RESPOND_GATE: 'pipeline:respond-gate',
  STOP: 'pipeline:stop',
  GET_PENDING_GATES: 'pipeline:get-pending-gates',
  GET_SESSION_STATE: 'pipeline:get-session-state',
  OPEN_ARTIFACTS_DIR: 'pipeline:open-artifacts-dir',
  OPEN_PATCH_WORK_DIR: 'pipeline-v2:open-patch-work-dir',
  OPEN_PATCH_WORK_FILE: 'pipeline-v2:open-patch-work-file',
  SUBSCRIBE_STREAM: 'pipeline:stream:subscribe',
  UNSUBSCRIBE_STREAM: 'pipeline:stream:unsubscribe',
  STREAM_EVENT: 'pipeline:stream:event',
  STREAM_COMPLETE: 'pipeline:stream:complete',
  STREAM_ERROR: 'pipeline:stream:error',
} as const
