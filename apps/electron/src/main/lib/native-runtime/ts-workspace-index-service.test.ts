import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TypeScriptWorkspaceIndexService } from './ts-workspace-index-service'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function writeFixtureFile(filePath: string, content = 'demo'): void {
  mkdirSync(join(filePath, '..'), { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

describe('TypeScriptWorkspaceIndexService', () => {
  test('首次索引后按缓存搜索 workspace-files 与 attached directories，并跳过默认 ignore 项', async () => {
    const root = await createTempDir('codeinsights-workspace-index-root-')
    const attached = await createTempDir('codeinsights-workspace-index-attached-')
    writeFixtureFile(join(root, 'src', 'target-main.ts'))
    writeFixtureFile(join(root, 'src', 'alpha.ts'))
    writeFixtureFile(join(root, 'node_modules', 'target-lib.js'))
    writeFixtureFile(join(root, '.git', 'target-head'))
    writeFixtureFile(join(root, '.env.target'))
    writeFixtureFile(join(attached, 'target-note.md'))

    const service = new TypeScriptWorkspaceIndexService()
    const result = await service.searchWorkspaceFiles({
      requestId: 'req-workspace-search',
      workspaceId: 'workspace-1',
      rootPath: root,
      additionalPaths: [attached],
      query: 'target',
      limit: 10,
    })

    expect(result.entries.map((entry) => entry.path)).toEqual([
      'src/target-main.ts',
      join(attached, 'target-note.md'),
    ])
    expect(result.entries.every((entry) => typeof entry.mtimeMs === 'number')).toBe(true)
    expect(result.entries.every((entry) => typeof entry.size === 'number')).toBe(true)
    expect(result.total).toBe(2)

    const state = await service.indexWorkspace({
      requestId: 'req-workspace-index-state',
      workspaceId: 'workspace-1',
      rootPath: root,
      additionalPaths: [attached],
    })
    expect(state).toMatchObject({
      workspaceId: 'workspace-1',
      indexedFiles: 3,
      status: 'ready',
      implementation: 'typescript',
    })
    expect(state.ignoreSummary.directories).toContain('node_modules')
  })

  test('空 query 从 workspace root 和 attached directories 均衡返回候选', async () => {
    const root = await createTempDir('codeinsights-workspace-index-empty-root-')
    const attached = await createTempDir('codeinsights-workspace-index-empty-attached-')
    writeFixtureFile(join(root, 'a.ts'))
    writeFixtureFile(join(root, 'b.ts'))
    writeFixtureFile(join(attached, 'c.ts'))
    writeFixtureFile(join(attached, 'd.ts'))

    const service = new TypeScriptWorkspaceIndexService()
    const result = await service.searchWorkspaceFiles({
      requestId: 'req-empty-query',
      workspaceId: 'workspace-1',
      rootPath: root,
      additionalPaths: [attached],
      query: '',
      limit: 2,
    })

    expect(result.entries).toHaveLength(2)
    expect(result.entries.some((entry) => !entry.path.startsWith('/'))).toBe(true)
    expect(result.entries.some((entry) => entry.path.startsWith(attached))).toBe(true)
  })

  test('watcher invalidation 后重建 cache，新增文件进入搜索结果', async () => {
    const root = await createTempDir('codeinsights-workspace-index-invalidate-')
    writeFixtureFile(join(root, 'src', 'alpha.ts'))

    const service = new TypeScriptWorkspaceIndexService()
    const before = await service.searchWorkspaceFiles({
      requestId: 'req-before-invalidate',
      workspaceId: 'workspace-1',
      rootPath: root,
      query: 'target',
      limit: 10,
    })
    expect(before.total).toBe(0)

    const newPath = join(root, 'src', 'target-added.ts')
    writeFixtureFile(newPath)
    const cached = await service.searchWorkspaceFiles({
      requestId: 'req-before-stale',
      workspaceId: 'workspace-1',
      rootPath: root,
      query: 'target',
      limit: 10,
    })
    expect(cached.total).toBe(0)

    service.invalidateByPath(newPath)
    const after = await service.searchWorkspaceFiles({
      requestId: 'req-after-invalidate',
      workspaceId: 'workspace-1',
      rootPath: root,
      query: 'target',
      limit: 10,
    })
    expect(after.entries.map((entry) => entry.path)).toEqual(['src/target-added.ts'])
  })

  test('单个 root 扫描也会遵守索引条目上限并标记 stale', async () => {
    const root = await createTempDir('codeinsights-workspace-index-entry-limit-')
    writeFixtureFile(join(root, 'a.ts'))
    writeFixtureFile(join(root, 'b.ts'))
    writeFixtureFile(join(root, 'c.ts'))
    writeFixtureFile(join(root, 'd.ts'))

    const service = new TypeScriptWorkspaceIndexService({ maxIndexEntries: 3 })
    const result = await service.searchWorkspaceFiles({
      requestId: 'req-entry-limit-search',
      workspaceId: 'workspace-1',
      rootPath: root,
      query: '',
      limit: 10,
    })
    const state = await service.indexWorkspace({
      requestId: 'req-entry-limit-state',
      workspaceId: 'workspace-1',
      rootPath: root,
    })

    expect(result.entries).toHaveLength(3)
    expect(state.status).toBe('stale')
    expect(state.indexedFiles).toBe(3)
  })

  test('外部 symlink 不被递归跟随，避免把仓库外文件纳入索引', async () => {
    const root = await createTempDir('codeinsights-workspace-index-symlink-root-')
    const outside = await createTempDir('codeinsights-workspace-index-symlink-outside-')
    writeFixtureFile(join(outside, 'secret-target.txt'), 'secret')

    try {
      symlinkSync(outside, join(root, 'linked-outside'), 'dir')
    } catch {
      // 部分平台或权限下不能创建 symlink；测试仍验证正常文件路径。
      writeFixtureFile(join(root, 'linked-outside-placeholder.txt'))
    }

    const service = new TypeScriptWorkspaceIndexService()
    const result = await service.searchWorkspaceFiles({
      requestId: 'req-symlink',
      workspaceId: 'workspace-1',
      rootPath: root,
      query: 'secret-target',
      limit: 10,
    })

    expect(result.entries).toEqual([])
  })
})
