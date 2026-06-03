import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { NativeRuntimeErrorCode } from '@codeinsights/shared'
import {
  NativeRuntimeSidecarError,
  NativeRuntimeSidecarManager,
  type NativeRuntimeSidecarSearchInput,
} from './native-runtime-sidecar-manager'

const tempDirs: string[] = []

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'codeinsights-native-sidecar-manager-'))
  tempDirs.push(dir)
  return dir
}

function createFixtureJsonl(dir: string): string {
  const filePath = join(dir, 'events.jsonl')
  writeFileSync(filePath, [
    JSON.stringify({ id: 'record-1', content: '普通内容', createdAt: 1 }),
    '{bad json',
    JSON.stringify({
      id: 'record-2',
      content: '这里有关键字 Authorization: Bearer secret-token',
      createdAt: 2,
    }),
  ].join('\n'), 'utf-8')
  return filePath
}

function createFakeSidecar(dir: string): string {
  const scriptPath = join(dir, 'fake-sidecar.js')
  writeFileSync(scriptPath, `
const scenario = process.argv[2] ?? 'ok'
const logPath = process.argv[3]
let buffer = ''

function appendLog(value) {
  if (!logPath) return
  awaitWrite(logPath, value + '\\n')
}

function awaitWrite(filePath, value) {
  const fs = require('node:fs')
  fs.appendFileSync(filePath, value)
}

function send(value) {
  process.stdout.write(JSON.stringify(value) + '\\n')
}

function sendError(id, code, message) {
  send({
    jsonrpc: '2.0',
    id,
    ok: false,
    error: { code, message, recoverable: true },
  })
}

process.on('SIGTERM', () => {
  appendLog('SIGTERM')
  process.exit(0)
})

function status(id) {
  send({
    jsonrpc: '2.0',
    id,
    ok: true,
    result: {
      implementation: 'rust-sidecar',
      binaryVersion: '0.0.1-test',
      protocolVersion: scenario === 'version-mismatch' ? 999 : 1,
      cacheSchemaVersion: 1,
      capabilities: ['diagnostics', 'indexed-search'],
    },
  })
}

function search(id, params) {
  if (scenario === 'timeout') return
  if (scenario === 'crash') process.exit(42)
  if (scenario === 'path-denied') {
    sendError(id, 'path_denied', 'native 拒绝读取路径')
    return
  }
  if (scenario === 'contract-violation') {
    send({
      jsonrpc: '2.0',
      id,
      ok: true,
      result: {
        requestId: params.requestId,
        query: params.query,
        matches: [{ id: 123, sourceKind: 'pipeline_record' }],
        hasMore: false,
        indexState: 'ready',
        implementation: 'rust-sidecar',
        searchedAt: Date.now(),
      },
    })
    return
  }
  if (scenario === 'source-boundary-violation') {
    send({
      jsonrpc: '2.0',
      id,
      ok: true,
      result: {
        requestId: params.requestId,
        query: params.query,
        matches: [{
          id: 'record-2',
          sourceKind: 'pipeline_record',
          title: 'Pipeline fixture',
          snippet: '这里有关键字',
          matchedRanges: [{ start: 3, length: 3 }],
          score: 1,
          sessionId: 'other-session',
          recordId: 'record-2',
          cursor: '3',
        }],
        hasMore: false,
        indexState: 'ready',
        implementation: 'rust-sidecar',
        searchedAt: Date.now(),
      },
    })
    return
  }
  if (scenario === 'range-violation') {
    send({
      jsonrpc: '2.0',
      id,
      ok: true,
      result: {
        requestId: params.requestId,
        query: params.query,
        matches: [{
          id: 'record-2',
          sourceKind: 'pipeline_record',
          title: 'Pipeline fixture',
          snippet: '短',
          matchedRanges: [{ start: 10, length: 3 }],
          score: 1,
          sessionId: 'session-1',
          recordId: 'record-2',
          cursor: '3',
        }],
        hasMore: false,
        indexState: 'ready',
        implementation: 'rust-sidecar',
        searchedAt: Date.now(),
      },
    })
    return
  }
  send({
    jsonrpc: '2.0',
    id,
    ok: true,
    result: {
      requestId: params.requestId,
      query: params.query,
      matches: [{
        id: 'record-2',
        sourceKind: 'pipeline_record',
        title: 'Pipeline fixture',
        snippet: '这里有关键字 Authorization: [redacted]',
        matchedRanges: [{ start: 3, length: 3 }],
        score: 1,
        sessionId: 'session-1',
        recordId: 'record-2',
        cursor: '3',
        filePath: '/Users/demo/.codeinsights/conversations/secret.jsonl',
      }],
      hasMore: false,
      indexState: 'ready',
      implementation: 'rust-sidecar',
      searchedAt: Date.now(),
    },
  })
}

function handle(line) {
  if (scenario === 'bad-json-stdout') {
    process.stdout.write('not-json\\n')
    return
  }
  if (scenario === 'huge-stdout') {
    process.stdout.write('x'.repeat(1024 * 1024 + 100))
    return
  }

  const request = JSON.parse(line)
  appendLog(request.method)
  if (request.method === 'status') {
    status(request.id)
    return
  }
  if (request.method === 'search') {
    search(request.id, request.params)
    return
  }
  if (request.method === 'shutdown') {
    if (scenario === 'shutdown-no-ack') {
      appendLog('shutdown-no-ack')
      return
    }
    send({ jsonrpc: '2.0', id: request.id, ok: true, result: { accepted: true } })
    process.exit(0)
    return
  }
  sendError(request.id, 'invalid_input', 'unknown method')
}

process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  while (buffer.includes('\\n')) {
    const index = buffer.indexOf('\\n')
    const line = buffer.slice(0, index)
    buffer = buffer.slice(index + 1)
    if (line.trim()) handle(line)
  }
})
`, 'utf-8')
  return scriptPath
}

function createManager(
  scenario: string,
  options: { timeoutMs?: number; statusTimeoutMs?: number } = {},
): { manager: NativeRuntimeSidecarManager; fixturePath: string; logPath: string } {
  const dir = createTempDir()
  const fixturePath = createFixtureJsonl(dir)
  const scriptPath = createFakeSidecar(dir)
  const logPath = join(dir, 'fake-sidecar.log')

  return {
    fixturePath,
    logPath,
    manager: new NativeRuntimeSidecarManager({
      binaryPath: process.execPath,
      args: [scriptPath, scenario, logPath],
      cwd: dir,
      requestTimeoutMs: options.timeoutMs ?? 200,
      statusTimeoutMs: options.statusTimeoutMs ?? 1000,
      shutdownTimeoutMs: options.timeoutMs ?? 200,
    }),
  }
}

function searchInput(filePath: string): NativeRuntimeSidecarSearchInput {
  return {
    requestId: 'sidecar-search-1',
    query: '关键字',
    limit: 5,
    sources: [{
      sourceKind: 'pipeline_record',
      sourceId: 'session-1',
      sessionId: 'session-1',
      title: 'Pipeline fixture',
      filePath,
      textFields: ['content'],
      idField: 'id',
    }],
  }
}

function expectSidecarError(error: unknown, code: NativeRuntimeErrorCode): NativeRuntimeSidecarError {
  expect(error).toBeInstanceOf(NativeRuntimeSidecarError)
  const sidecarError = error as NativeRuntimeSidecarError
  expect(sidecarError.code).toBe(code)
  expect(sidecarError.recoverable).toBe(true)
  expect(sidecarError.message).not.toContain('secret-token')
  expect(sidecarError.message).not.toContain('/Users/')
  return sidecarError
}

describe('NativeRuntimeSidecarManager', () => {
  test('missing binary 不启动进程并返回 missing_binary fallback 状态', async () => {
    const dir = createTempDir()
    const missingBinaryPath = join(dir, 'missing-native-search')
    const manager = new NativeRuntimeSidecarManager({
      binaryPath: missingBinaryPath,
      requestTimeoutMs: 20,
    })

    const status = await manager.getStatus()
    expect(existsSync(missingBinaryPath)).toBe(false)
    expect(status).toMatchObject({
      available: false,
      nativeEnabled: false,
      implementation: 'typescript',
      fallbackReason: 'missing_binary',
    })
    expect(status.binaryPath).toBeUndefined()

    try {
      await manager.search(searchInput(join(dir, 'missing.jsonl')))
      throw new Error('search should fail')
    } catch (error) {
      expectSidecarError(error, 'missing_binary')
    }
  })

  test('status protocol version mismatch 会禁用 native 并记录 version_mismatch', async () => {
    const { manager } = createManager('version-mismatch')

    const status = await manager.getStatus()

    expect(status).toMatchObject({
      available: false,
      nativeEnabled: false,
      implementation: 'typescript',
      fallbackReason: 'version_mismatch',
    })
    expect(status.lastError?.message).toContain('protocolVersion')
    expect(status.binaryPath).toBeUndefined()
  })

  test('request timeout 会清理 pending、终止进程并进入 timeout fallback', async () => {
    const { manager, fixturePath } = createManager('timeout', { timeoutMs: 30, statusTimeoutMs: 300 })
    await expect(manager.getStatus()).resolves.toMatchObject({ nativeEnabled: true })

    try {
      await manager.search(searchInput(fixturePath))
      throw new Error('search should timeout')
    } catch (error) {
      expectSidecarError(error, 'timeout')
    }

    const status = await manager.getStatus()
    expect(status).toMatchObject({
      nativeEnabled: false,
      fallbackReason: 'timeout',
      implementation: 'typescript',
    })
  })

  test('sidecar crash 会拒绝 pending request 并让后续请求直接 fallback', async () => {
    const { manager, fixturePath } = createManager('crash', { timeoutMs: 200 })
    await expect(manager.getStatus()).resolves.toMatchObject({ nativeEnabled: true })

    try {
      await manager.search(searchInput(fixturePath))
      throw new Error('search should crash')
    } catch (error) {
      expectSidecarError(error, 'crashed')
    }

    try {
      await manager.search(searchInput(fixturePath))
      throw new Error('search should stay disabled after crash')
    } catch (error) {
      expectSidecarError(error, 'crashed')
    }
  })

  test('shutdown 通过 protocol 请求让 sidecar 退出且可重复调用', async () => {
    const { manager, logPath } = createManager('ok')
    await expect(manager.getStatus()).resolves.toMatchObject({ nativeEnabled: true })

    await expect(manager.shutdown()).resolves.toBe(true)
    await expect(manager.shutdown()).resolves.toBe(false)

    const log = Bun.file(logPath)
    await expect(log.text()).resolves.toContain('shutdown')
  })

  test('shutdown 没有 ack 时会先走 SIGTERM fallback', async () => {
    const { manager, logPath } = createManager('shutdown-no-ack', { timeoutMs: 30, statusTimeoutMs: 300 })
    await expect(manager.getStatus()).resolves.toMatchObject({ nativeEnabled: true })

    await expect(manager.shutdown()).resolves.toBe(true)

    const log = await Bun.file(logPath).text()
    expect(log).toContain('shutdown-no-ack')
    expect(log).toContain('SIGTERM')
  })

  test('contract violation 会禁用 native 且不会使用非法 search result', async () => {
    const { manager, fixturePath } = createManager('contract-violation')
    await expect(manager.getStatus()).resolves.toMatchObject({ nativeEnabled: true })

    try {
      await manager.search(searchInput(fixturePath))
      throw new Error('search should fail on contract violation')
    } catch (error) {
      expectSidecarError(error, 'contract_violation')
    }

    const status = await manager.getStatus()
    expect(status).toMatchObject({
      nativeEnabled: false,
      fallbackReason: 'contract_violation',
      implementation: 'typescript',
    })
  })

  test('bad JSON stdout 会进入 contract_violation fallback', async () => {
    const { manager, fixturePath } = createManager('bad-json-stdout')

    try {
      await manager.search(searchInput(fixturePath))
      throw new Error('search should fail on bad JSON stdout')
    } catch (error) {
      expectSidecarError(error, 'contract_violation')
    }
  })

  test('stdout protocol line 超过上限时会进入 contract_violation fallback', async () => {
    const { manager, fixturePath } = createManager('huge-stdout')

    try {
      await manager.search(searchInput(fixturePath))
      throw new Error('search should fail on huge stdout')
    } catch (error) {
      expectSidecarError(error, 'contract_violation')
    }
  })

  test('match 超出请求 source 边界时会进入 contract_violation fallback', async () => {
    const { manager, fixturePath } = createManager('source-boundary-violation')
    await expect(manager.getStatus()).resolves.toMatchObject({ nativeEnabled: true })

    try {
      await manager.search(searchInput(fixturePath))
      throw new Error('search should fail on source boundary violation')
    } catch (error) {
      expectSidecarError(error, 'contract_violation')
    }
  })

  test('match range 超出 snippet 边界时会进入 contract_violation fallback', async () => {
    const { manager, fixturePath } = createManager('range-violation')
    await expect(manager.getStatus()).resolves.toMatchObject({ nativeEnabled: true })

    try {
      await manager.search(searchInput(fixturePath))
      throw new Error('search should fail on range violation')
    } catch (error) {
      expectSidecarError(error, 'contract_violation')
    }
  })

  test('path_denied 只拒绝当前请求，不禁用整个 sidecar', async () => {
    const { manager, fixturePath } = createManager('path-denied')
    await expect(manager.getStatus()).resolves.toMatchObject({ nativeEnabled: true })

    try {
      await manager.search(searchInput(fixturePath))
      throw new Error('search should fail on path_denied')
    } catch (error) {
      expectSidecarError(error, 'path_denied')
    }

    await expect(manager.getStatus()).resolves.toMatchObject({ nativeEnabled: true })
  })

  test('正常 search 返回已校验且脱敏的 rust-sidecar result', async () => {
    const { manager, fixturePath } = createManager('ok')

    const result = await manager.search(searchInput(fixturePath))

    expect(result).toMatchObject({
      requestId: 'sidecar-search-1',
      query: '关键字',
      implementation: 'rust-sidecar',
      indexState: 'ready',
      hasMore: false,
    })
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]).toMatchObject({
      id: 'record-2',
      sourceKind: 'pipeline_record',
      sessionId: 'session-1',
      matchedRanges: [{ start: 3, length: 3 }],
    })
    expect(result.matches[0]?.snippet).not.toContain('secret-token')
    expect(result.matches[0]?.filePath).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('/Users/demo')
  })
})
