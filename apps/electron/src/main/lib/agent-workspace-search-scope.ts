import { realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { AgentSessionMeta } from '@codeinsights/shared'
import { readJsonFileSafe } from './safe-file'
import { getAgentSessionsIndexPath, getAgentWorkspacesDir } from './config-paths'
import { getWorkspaceAttachedDirectories, listAgentWorkspaces } from './agent-workspace-manager'

export interface WorkspaceSearchScope {
  workspaceId: string
  rootPath: string
  additionalPaths: string[]
}

interface AgentSessionsIndex {
  sessions?: AgentSessionMeta[]
}

function listWorkspaceSearchSessions(): AgentSessionMeta[] {
  return readJsonFileSafe<AgentSessionsIndex>(getAgentSessionsIndexPath())?.sessions ?? []
}

async function canonicalizeSearchPath(filePath: string): Promise<string> {
  const resolved = resolve(filePath)
  return realpath(resolved).catch(() => resolved)
}

async function filterAllowedAdditionalPaths(input: {
  requestedPaths: string[]
  allowedPaths: string[]
}): Promise<string[]> {
  const allowedByCanonicalPath = new Map<string, string>()
  for (const allowedPath of input.allowedPaths) {
    if (typeof allowedPath !== 'string' || allowedPath.trim().length === 0) continue
    allowedByCanonicalPath.set(await canonicalizeSearchPath(allowedPath), resolve(allowedPath))
  }

  const filtered: string[] = []
  const seen = new Set<string>()
  for (const requestedPath of input.requestedPaths) {
    const canonical = await canonicalizeSearchPath(requestedPath)
    const allowedPath = allowedByCanonicalPath.get(canonical)
    if (!allowedPath || seen.has(canonical)) continue
    filtered.push(allowedPath)
    seen.add(canonical)
  }
  return filtered
}

export async function resolveWorkspaceSearchScope(
  rootPath: string,
  additionalPaths: string[],
): Promise<WorkspaceSearchScope> {
  const requestedRoot = await canonicalizeSearchPath(rootPath)
  const workspacesRoot = getAgentWorkspacesDir()
  const workspaces = listAgentWorkspaces()
  const sessions = listWorkspaceSearchSessions()

  for (const workspace of workspaces) {
    const workspaceFilesPath = join(workspacesRoot, workspace.slug, 'workspace-files')
    const workspaceAttachedDirectories = getWorkspaceAttachedDirectories(workspace.slug)
    const workspaceFilesCanonical = await canonicalizeSearchPath(workspaceFilesPath)

    if (requestedRoot === workspaceFilesCanonical) {
      return {
        workspaceId: workspace.id,
        rootPath: workspaceFilesPath,
        additionalPaths: await filterAllowedAdditionalPaths({
          requestedPaths: additionalPaths,
          allowedPaths: workspaceAttachedDirectories,
        }),
      }
    }

    for (const session of sessions) {
      if (session.workspaceId !== workspace.id) continue

      const sessionPath = join(workspacesRoot, workspace.slug, session.id)
      const sessionCanonical = await canonicalizeSearchPath(sessionPath)
      if (requestedRoot !== sessionCanonical) continue

      return {
        workspaceId: session.id,
        rootPath: sessionPath,
        additionalPaths: await filterAllowedAdditionalPaths({
          requestedPaths: additionalPaths,
          allowedPaths: [
            workspaceFilesPath,
            ...workspaceAttachedDirectories,
            ...(session.attachedDirectories ?? []),
          ],
        }),
      }
    }
  }

  throw new Error('工作区搜索路径不在允许范围内')
}
