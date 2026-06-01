import { ipcMain, shell } from 'electron'
import { PIPELINE_IPC_CHANNELS } from '@codeinsights/shared'
import type {
  PipelineArtifactContentInput,
  ContributionTaskSummary,
  PipelineExplorerReportRef,
  PipelineGateRequest,
  PipelineGateResponse,
  PipelineContributionTaskSummaryInput,
  PipelinePatchWorkReadFileInput,
  PipelinePatchWorkRevisionInput,
  PipelinePatchWorkSessionInput,
  PipelineRecord,
  PipelineRecordsSearchInput,
  PipelineRecordsSearchResult,
  PipelineRecordsSummaryInput,
  PipelineRecordsSummaryResult,
  PipelineSessionRecordsSearchInput,
  PipelineSessionRecordsSearchResult,
  PipelineRecordsTailInput,
  PipelineRecordsTailResult,
  PipelineResumeInput,
  PipelineSelectTaskInput,
  PipelineSelectTaskResult,
  PipelineRunPreflightInput,
  PipelinePreflightResult,
  PipelineSubmissionPlan,
  PipelineSubmissionPlanInput,
  PipelineReportExport,
  PipelineReportExportInput,
  PipelineReportPdfSaveInput,
  PipelineReportPdfSaveResult,
  PipelineSessionMeta,
  PipelineStartInput,
  PipelineStateSnapshot,
  PipelineVersion,
  PatchWorkDocumentRevision,
  PatchWorkManifest,
} from '@codeinsights/shared'
import { getPipelineService } from '../lib/pipeline-service'
import { pipelineStreamBus } from '../lib/pipeline-stream-bus'

export function registerPipelineIpcHandlers(): void {
  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.LIST_SESSIONS,
    async (): Promise<PipelineSessionMeta[]> => {
      return getPipelineService().listSessions()
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.CREATE_SESSION,
    async (
      _event,
      title?: string,
      channelId?: string,
      workspaceId?: string,
      version?: PipelineVersion,
    ): Promise<PipelineSessionMeta> => {
      return getPipelineService().createSession(title, channelId, workspaceId, version)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.GET_RECORDS,
    async (_event, sessionId: string): Promise<PipelineRecord[]> => {
      return getPipelineService().getRecords(sessionId)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.GET_RECORDS_TAIL,
    async (_event, input: PipelineRecordsTailInput): Promise<PipelineRecordsTailResult> => {
      return getPipelineService().getRecordsTail(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.GET_RECORDS_SUMMARY,
    async (_event, input: PipelineRecordsSummaryInput): Promise<PipelineRecordsSummaryResult> => {
      return getPipelineService().getRecordsSummary(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.SEARCH_RECORDS,
    async (_event, input: PipelineRecordsSearchInput): Promise<PipelineRecordsSearchResult> => {
      return getPipelineService().searchRecords(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.SEARCH_SESSION_RECORDS,
    async (_event, input: PipelineSessionRecordsSearchInput): Promise<PipelineSessionRecordsSearchResult> => {
      return getPipelineService().searchSessionRecords(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.READ_ARTIFACT_CONTENT,
    async (_event, input: PipelineArtifactContentInput): Promise<string> => {
      return getPipelineService().readArtifactContent(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.RUN_PREFLIGHT,
    async (_event, input: PipelineRunPreflightInput): Promise<PipelinePreflightResult> => {
      return getPipelineService().runPreflight(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.GET_PATCH_WORK_MANIFEST,
    async (_event, input: PipelinePatchWorkSessionInput): Promise<PatchWorkManifest> => {
      return getPipelineService().getPatchWorkManifest(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.GET_CONTRIBUTION_TASK_SUMMARY,
    async (_event, input: PipelineContributionTaskSummaryInput): Promise<ContributionTaskSummary> => {
      return getPipelineService().getContributionTaskSummary(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.GET_SUBMISSION_PLAN,
    async (_event, input: PipelineSubmissionPlanInput): Promise<PipelineSubmissionPlan> => {
      return getPipelineService().getSubmissionPlan(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.EXPORT_REPORT,
    async (_event, input: PipelineReportExportInput): Promise<PipelineReportExport> => {
      return getPipelineService().exportPipelineReport(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.SAVE_REPORT_PDF,
    async (_event, input: PipelineReportPdfSaveInput): Promise<PipelineReportPdfSaveResult> => {
      return getPipelineService().savePipelineReportPdf(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.READ_PATCH_WORK_FILE,
    async (_event, input: PipelinePatchWorkReadFileInput): Promise<string> => {
      return getPipelineService().readPatchWorkFile(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.LIST_PATCH_WORK_REVISIONS,
    async (_event, input: PipelinePatchWorkReadFileInput): Promise<PatchWorkDocumentRevision[]> => {
      return getPipelineService().listPatchWorkRevisions(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.READ_PATCH_WORK_REVISION,
    async (_event, input: PipelinePatchWorkRevisionInput): Promise<PatchWorkDocumentRevision> => {
      return getPipelineService().readPatchWorkRevision(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.LIST_EXPLORER_REPORTS,
    async (_event, input: PipelinePatchWorkSessionInput): Promise<PipelineExplorerReportRef[]> => {
      return getPipelineService().listExplorerReports(input)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.SELECT_TASK,
    async (_event, input: PipelineSelectTaskInput): Promise<PipelineSelectTaskResult> => {
      return getPipelineService().selectTask(input, pipelineStreamBus.createCallbacks())
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.OPEN_ARTIFACTS_DIR,
    async (_event, sessionId: string): Promise<boolean> => {
      const errorMessage = await shell.openPath(getPipelineService().getArtifactsDir(sessionId))
      if (errorMessage) {
        throw new Error(`打开 Pipeline 产物目录失败: ${errorMessage}`)
      }
      return errorMessage.length === 0
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.OPEN_PATCH_WORK_DIR,
    async (_event, sessionId: string): Promise<boolean> => {
      const errorMessage = await shell.openPath(getPipelineService().getPatchWorkDir(sessionId))
      if (errorMessage) {
        throw new Error(`打开 patch-work 目录失败: ${errorMessage}`)
      }
      return errorMessage.length === 0
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.OPEN_PATCH_WORK_FILE,
    async (_event, input: PipelinePatchWorkReadFileInput): Promise<boolean> => {
      const errorMessage = await shell.openPath(getPipelineService().getPatchWorkFilePath(input))
      if (errorMessage) {
        throw new Error(`打开 patch-work 文件失败: ${errorMessage}`)
      }
      return errorMessage.length === 0
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.UPDATE_TITLE,
    async (_event, sessionId: string, title: string): Promise<PipelineSessionMeta> => {
      return getPipelineService().updateTitle(sessionId, title)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.DELETE_SESSION,
    async (_event, sessionId: string): Promise<void> => {
      getPipelineService().deleteSession(sessionId)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.TOGGLE_PIN,
    async (_event, sessionId: string): Promise<PipelineSessionMeta> => {
      return getPipelineService().togglePin(sessionId)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.TOGGLE_ARCHIVE,
    async (_event, sessionId: string): Promise<PipelineSessionMeta> => {
      return getPipelineService().toggleArchive(sessionId)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.START,
    async (_event, input: PipelineStartInput): Promise<void> => {
      await getPipelineService().start(input, pipelineStreamBus.createCallbacks())
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.RESUME,
    async (_event, input: PipelineResumeInput): Promise<void> => {
      await getPipelineService().resume(input, pipelineStreamBus.createCallbacks())
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.RESPOND_GATE,
    async (_event, response: PipelineGateResponse): Promise<void> => {
      await getPipelineService().respondGate(response, pipelineStreamBus.createCallbacks())
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.SUBSCRIBE_STREAM,
    async (event): Promise<void> => {
      pipelineStreamBus.subscribe(event.sender)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.UNSUBSCRIBE_STREAM,
    async (event): Promise<void> => {
      pipelineStreamBus.unsubscribe(event.sender.id)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.STOP,
    async (_event, sessionId: string): Promise<PipelineStateSnapshot> => {
      return getPipelineService().stop(sessionId)
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.GET_PENDING_GATES,
    async (): Promise<PipelineGateRequest[]> => {
      return getPipelineService().getPendingGates()
    }
  )

  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.GET_SESSION_STATE,
    async (_event, sessionId: string): Promise<PipelineStateSnapshot> => {
      return getPipelineService().getSessionState(sessionId)
    }
  )
}
