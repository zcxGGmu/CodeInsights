import { opendir, realpath, lstat } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import type {
  FileIndexEntry,
  FileSearchResult,
  NativeImplementationKind,
  NativeRuntimeWorkspaceIgnoreSummary,
  NativeRuntimeWorkspaceIndexInput,
  NativeRuntimeWorkspaceIndexResult,
} from '@codeinsights/shared'

const MAX_SCAN_DEPTH = 10
const MAX_INDEX_ENTRIES = 200_000
const MAX_INDEXED_FILE_BYTES = 20 * 1024 * 1024
const LARGE_BINARY_BYTES = 512 * 1024

const DEFAULT_IGNORE_DIRS = [
  '.git',
  'node_modules',
  'dist',
  '.next',
  '__pycache__',
  '.venv',
  'build',
  '.cache',
  'coverage',
  'out',
]

const DEFAULT_IGNORE_FILES = [
  '.DS_Store',
  '.Spotlight-V100',
  '.Trashes',
  'Thumbs.db',
  'desktop.ini',
]

const BINARY_EXTENSIONS = new Set([
  '.7z',
  '.bin',
  '.db',
  '.dmg',
  '.exe',
  '.gif',
  '.gz',
  '.ico',
  '.icns',
  '.jpeg',
  '.jpg',
  '.mov',
  '.mp3',
  '.mp4',
  '.pdf',
  '.png',
  '.sqlite',
  '.tar',
  '.wav',
  '.webp',
  '.zip',
])

type WorkspaceIndexStatus = NativeRuntimeWorkspaceIndexResult['status']

interface WorkspaceIndexRoot {
  rootPath: string
  resolvedRoot: string
  source: 'workspace' | 'attached'
}

interface WorkspaceIndexCache {
  cacheKey: string
  workspaceId: string
  rootFingerprint: string
  sourceRoots: string[]
  entries: WorkspaceIndexEntry[]
  groups: WorkspaceIndexEntry[][]
  ignoreSummary: NativeRuntimeWorkspaceIgnoreSummary
  indexedFiles: number
  status: WorkspaceIndexStatus
  stale: boolean
  startedAt: number
  completedAt?: number
}

interface WorkspaceIndexEntry extends FileIndexEntry {
  sourceRoot: string
  source: 'workspace' | 'attached'
  relativePath: string
  nameLower: string
  pathLower: string
  size?: number
  mtimeMs?: number
}

interface WorkspaceIndexSearchInput {
  requestId: string
  workspaceId: string
  rootPath: string
  query: string
  limit?: number
  additionalPaths?: string[]
  forceRebuild?: boolean
  signal?: AbortSignal
}

interface TypeScriptWorkspaceIndexServiceOptions {
  maxIndexEntries?: number
}

interface WorkspaceIndexBuildInput {
  requestId: string
  workspaceId: string
  rootPath: string
  additionalPaths?: string[]
  force?: boolean
  signal?: AbortSignal
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('工作区索引已取消')
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20
  return Math.min(100, Math.max(1, Math.floor(limit ?? 20)))
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

function toRelativeDisplayPath(rootPath: string, fullPath: string): string {
  return relative(rootPath, fullPath)
}

function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const root = rootPath.replace(/[\\/]+$/, '')
  return candidatePath === root || candidatePath.startsWith(root + sep)
}

function shouldIgnoreDirectory(name: string): boolean {
  if (name.startsWith('.')) return true
  return DEFAULT_IGNORE_DIRS.includes(name)
}

function shouldIgnoreFile(name: string, size: number): boolean {
  if (name.startsWith('.')) return true
  if (DEFAULT_IGNORE_FILES.includes(name)) return true
  if (size > MAX_INDEXED_FILE_BYTES) return true

  const ext = extname(name).toLowerCase()
  return BINARY_EXTENSIONS.has(ext) && size > LARGE_BINARY_BYTES
}

function fuzzyMatches(text: string, query: string): boolean {
  let queryIndex = 0
  for (let index = 0; index < text.length && queryIndex < query.length; index += 1) {
    if (text[index] === query[queryIndex]) queryIndex += 1
  }
  return queryIndex === query.length
}

function matchesEntry(entry: WorkspaceIndexEntry, query: string): boolean {
  if (entry.nameLower.startsWith(query)) return true
  if (entry.nameLower.includes(query) || entry.pathLower.includes(query)) return true
  return fuzzyMatches(entry.nameLower, query)
}

function sortSearchMatches(query: string, a: WorkspaceIndexEntry, b: WorkspaceIndexEntry): number {
  const aStartsWith = a.nameLower.startsWith(query) ? 0 : 1
  const bStartsWith = b.nameLower.startsWith(query) ? 0 : 1
  if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith
  if (a.type === 'dir' && b.type !== 'dir') return -1
  if (a.type !== 'dir' && b.type === 'dir') return 1
  return a.path.length - b.path.length
}

function sortDirectoryEntries(a: WorkspaceIndexEntry, b: WorkspaceIndexEntry): number {
  if (a.type === 'dir' && b.type !== 'dir') return -1
  if (a.type !== 'dir' && b.type === 'dir') return 1
  return a.name.localeCompare(b.name)
}

function buildIgnoreSummary(): NativeRuntimeWorkspaceIgnoreSummary {
  return {
    directories: [...DEFAULT_IGNORE_DIRS],
    patterns: ['hidden entries', 'large binary files', ...DEFAULT_IGNORE_FILES],
  }
}

async function resolveExistingPath(path: string): Promise<string> {
  const resolved = resolve(path)
  return realpath(resolved).catch(() => resolved)
}

async function buildRootFingerprint(roots: WorkspaceIndexRoot[]): Promise<string> {
  const parts: string[] = []
  for (const root of roots) {
    const stat = await lstat(root.resolvedRoot).catch(() => null)
    parts.push([
      root.source,
      root.resolvedRoot,
      stat?.dev ?? 'missing',
      stat?.ino ?? 'missing',
      stat?.mtimeMs ?? 0,
    ].join(':'))
  }
  return parts.join('|')
}

function toPublicEntry(entry: WorkspaceIndexEntry): FileIndexEntry {
  return {
    name: entry.name,
    path: entry.path,
    type: entry.type,
    size: entry.size,
    mtimeMs: entry.mtimeMs,
    source: entry.source,
    relativePath: entry.relativePath,
  }
}

export class TypeScriptWorkspaceIndexService {
  private readonly implementation: NativeImplementationKind = 'typescript'
  private readonly maxIndexEntries: number
  private readonly cache = new Map<string, WorkspaceIndexCache>()
  private readonly inflightBuilds = new Map<string, Promise<WorkspaceIndexCache>>()

  constructor(options: TypeScriptWorkspaceIndexServiceOptions = {}) {
    this.maxIndexEntries = options.maxIndexEntries ?? MAX_INDEX_ENTRIES
  }

  async indexWorkspace(
    input: WorkspaceIndexBuildInput | NativeRuntimeWorkspaceIndexInput,
    signal?: AbortSignal,
  ): Promise<NativeRuntimeWorkspaceIndexResult> {
    const rootPath = 'rootPath' in input ? input.rootPath : undefined
    if (!rootPath) {
      throw new Error('工作区索引缺少 rootPath')
    }

    const cache = await this.getOrBuildIndex({
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      rootPath,
      additionalPaths: 'additionalPaths' in input ? input.additionalPaths : undefined,
      force: input.force,
      signal,
    })

    return {
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      rootFingerprint: cache.rootFingerprint,
      ignoreSummary: cache.ignoreSummary,
      indexedFiles: cache.indexedFiles,
      status: cache.status,
      implementation: this.implementation,
      startedAt: cache.startedAt,
      completedAt: cache.completedAt,
    }
  }

  async searchWorkspaceFiles(input: WorkspaceIndexSearchInput): Promise<FileSearchResult> {
    const cache = await this.getOrBuildIndex({
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      rootPath: input.rootPath,
      additionalPaths: input.additionalPaths,
      force: input.forceRebuild,
      signal: input.signal,
    })
    const limit = normalizeLimit(input.limit)
    const query = normalizeQuery(input.query)

    if (!query) {
      const entries = this.pickBalancedEntries(cache.groups, limit)
      return {
        entries: entries.map(toPublicEntry),
        total: cache.entries.length,
      }
    }

    const matches = cache.entries
      .filter((entry) => matchesEntry(entry, query))
      .sort((a, b) => sortSearchMatches(query, a, b))

    return {
      entries: matches.slice(0, limit).map(toPublicEntry),
      total: matches.length,
    }
  }

  invalidateByPath(changedPath?: string): void {
    if (!changedPath) {
      for (const cache of this.cache.values()) cache.stale = true
      return
    }

    const resolved = resolve(changedPath)
    for (const cache of this.cache.values()) {
      if (cache.sourceRoots.some((root) => isPathInsideRoot(root, resolved))) {
        cache.stale = true
      }
    }
  }

  clear(): void {
    this.cache.clear()
    this.inflightBuilds.clear()
  }

  private async getOrBuildIndex(input: WorkspaceIndexBuildInput): Promise<WorkspaceIndexCache> {
    throwIfAborted(input.signal)
    const roots = await this.resolveRoots(input.rootPath, input.additionalPaths)
    const cacheKey = roots.map((root) => `${root.source}:${root.resolvedRoot}`).join('|')
    const rootFingerprint = await buildRootFingerprint(roots)
    const existing = this.cache.get(cacheKey)

    if (existing && !input.force && !existing.stale && existing.rootFingerprint === rootFingerprint) {
      return existing
    }

    const buildKey = `${cacheKey}|${rootFingerprint}`
    if (!input.force) {
      const inflight = this.inflightBuilds.get(buildKey)
      if (inflight) return inflight
    }

    const buildPromise: Promise<WorkspaceIndexCache> = this.buildIndex({
      cacheKey,
      workspaceId: input.workspaceId,
      rootFingerprint,
      roots,
      signal: input.signal,
    })
      .then((rebuilt) => {
        this.cache.set(cacheKey, rebuilt)
        return rebuilt
      })
      .finally(() => {
        if (this.inflightBuilds.get(buildKey) === buildPromise) {
          this.inflightBuilds.delete(buildKey)
        }
      })

    this.inflightBuilds.set(buildKey, buildPromise)
    return buildPromise
  }

  private async resolveRoots(rootPath: string, additionalPaths?: string[]): Promise<WorkspaceIndexRoot[]> {
    const roots: WorkspaceIndexRoot[] = [
      {
        rootPath: resolve(rootPath),
        resolvedRoot: await resolveExistingPath(rootPath),
        source: 'workspace',
      },
    ]

    for (const additionalPath of additionalPaths ?? []) {
      roots.push({
        rootPath: resolve(additionalPath),
        resolvedRoot: await resolveExistingPath(additionalPath),
        source: 'attached',
      })
    }

    return roots
  }

  private async buildIndex(input: {
    cacheKey: string
    workspaceId: string
    rootFingerprint: string
    roots: WorkspaceIndexRoot[]
    signal?: AbortSignal
  }): Promise<WorkspaceIndexCache> {
    const startedAt = Date.now()
    const groups: WorkspaceIndexEntry[][] = []
    const entries: WorkspaceIndexEntry[] = []
    let indexedFiles = 0
    let totalEntries = 0
    let entryLimitReached = false

    for (const root of input.roots) {
      throwIfAborted(input.signal)
      const group: WorkspaceIndexEntry[] = []
      await this.scanDirectory({
        root,
        currentDir: root.resolvedRoot,
        depth: 0,
        target: group,
        signal: input.signal,
        canAppend: () => totalEntries < this.maxIndexEntries,
        onEntryAppended: () => { totalEntries += 1 },
        onFileIndexed: () => { indexedFiles += 1 },
        onLimitReached: () => { entryLimitReached = true },
      })
      group.sort(sortDirectoryEntries)
      groups.push(group)
      entries.push(...group)
    }

    return {
      cacheKey: input.cacheKey,
      workspaceId: input.workspaceId,
      rootFingerprint: input.rootFingerprint,
      sourceRoots: input.roots.flatMap((root) => [root.rootPath, root.resolvedRoot]),
      entries,
      groups,
      ignoreSummary: buildIgnoreSummary(),
      indexedFiles,
      status: entryLimitReached ? 'stale' : 'ready',
      stale: false,
      startedAt,
      completedAt: Date.now(),
    }
  }

  private async scanDirectory(input: {
    root: WorkspaceIndexRoot
    currentDir: string
    depth: number
    target: WorkspaceIndexEntry[]
    signal?: AbortSignal
    canAppend: () => boolean
    onEntryAppended: () => void
    onFileIndexed: () => void
    onLimitReached: () => void
  }): Promise<void> {
    throwIfAborted(input.signal)
    if (input.depth > MAX_SCAN_DEPTH) return
    if (!input.canAppend()) {
      input.onLimitReached()
      return
    }

    let dir
    try {
      dir = await opendir(input.currentDir)
    } catch {
      return
    }

    for await (const dirent of dir) {
      throwIfAborted(input.signal)
      if (!input.canAppend()) {
        input.onLimitReached()
        return
      }

      const fullPath = resolve(input.currentDir, dirent.name)
      const stat = await lstat(fullPath).catch(() => null)
      if (!stat || stat.isSymbolicLink()) continue

      if (stat.isDirectory()) {
        if (shouldIgnoreDirectory(dirent.name)) continue
        const entry = this.buildEntry(input.root, fullPath, dirent.name, 'dir', stat.size, stat.mtimeMs)
        input.target.push(entry)
        input.onEntryAppended()
        await this.scanDirectory({
          ...input,
          currentDir: fullPath,
          depth: input.depth + 1,
        })
        continue
      }

      if (!stat.isFile()) continue
      if (shouldIgnoreFile(dirent.name, stat.size)) continue

      const entry = this.buildEntry(input.root, fullPath, dirent.name, 'file', stat.size, stat.mtimeMs)
      input.target.push(entry)
      input.onEntryAppended()
      input.onFileIndexed()
    }
  }

  private buildEntry(
    root: WorkspaceIndexRoot,
    fullPath: string,
    name: string,
    type: 'file' | 'dir',
    size: number,
    mtimeMs: number,
  ): WorkspaceIndexEntry {
    const relativePath = toRelativeDisplayPath(root.resolvedRoot, fullPath)
    const attachedDisplayPath = join(root.rootPath, relativePath)
    return {
      name,
      path: root.source === 'attached' ? attachedDisplayPath : relativePath,
      type,
      nameLower: name.toLowerCase(),
      pathLower: (root.source === 'attached' ? attachedDisplayPath : relativePath).toLowerCase(),
      size,
      mtimeMs,
      source: root.source,
      sourceRoot: root.resolvedRoot,
      relativePath,
    }
  }

  private pickBalancedEntries(groups: WorkspaceIndexEntry[][], limit: number): WorkspaceIndexEntry[] {
    const nonEmptyGroups = groups.filter((group) => group.length > 0)
    if (nonEmptyGroups.length === 0) return []

    const result: WorkspaceIndexEntry[] = []
    const perGroup = Math.max(1, Math.floor(limit / nonEmptyGroups.length))

    for (const group of nonEmptyGroups) {
      result.push(...group.slice(0, perGroup))
    }

    if (result.length < limit) {
      for (const group of nonEmptyGroups) {
        for (let index = perGroup; index < group.length && result.length < limit; index += 1) {
          result.push(group[index]!)
        }
      }
    }

    return result.slice(0, limit)
  }
}
