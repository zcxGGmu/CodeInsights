import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  buildNativeRuntimeSmokeSummary,
  parseNativeRuntimeSmokeArgs,
  runNativeRuntimeSmoke,
} from './native-runtime-smoke'

const originalNativeSearchBinary = process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY

afterEach(() => {
  if (originalNativeSearchBinary == null) {
    delete process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY
  } else {
    process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY = originalNativeSearchBinary
  }
})

describe('native-runtime-smoke', () => {
  test('parseNativeRuntimeSmokeArgs 支持 smoke mode 与显式 binary', () => {
    const options = parseNativeRuntimeSmokeArgs([
      '--mode',
      'native-available',
      '--native-search-binary',
      '/tmp/native-search',
      '--query',
      '关键字',
    ])

    expect(options).toEqual({
      mode: 'native-available',
      nativeSearchBinary: '/tmp/native-search',
      query: '关键字',
    })
  })

  test('summary 不泄露 binary path 或 home path', () => {
    const summary = buildNativeRuntimeSmokeSummary({
      mode: 'native-available',
      nativeSearchBinary: '/Users/demo/native-search',
      cases: [{
        name: 'native-available',
        status: 'passed',
        detail: '/Users/demo/native-search is ready',
      }],
    })

    const serialized = JSON.stringify(summary)
    expect(summary.nativeSearchBinaryProvided).toBe(true)
    expect(serialized).not.toContain('/Users/demo/native-search')
    expect(serialized).toContain('[home]/native-search')
  })

  test('env binary 属于显式 opt-in，summary 仍脱敏路径', () => {
    process.env.CODEINSIGHTS_NATIVE_SEARCH_BINARY = '/Users/demo/native-search'
    const options = parseNativeRuntimeSmokeArgs(['--mode', 'native-available'])
    const summary = buildNativeRuntimeSmokeSummary({
      mode: options.mode,
      nativeSearchBinary: options.nativeSearchBinary,
      cases: [{
        name: 'native-available',
        status: 'skipped',
        detail: options.nativeSearchBinary,
      }],
    })

    expect(options.nativeSearchBinary).toBe('/Users/demo/native-search')
    expect(summary.nativeSearchBinaryProvided).toBe(true)
    expect(JSON.stringify(summary)).not.toContain('/Users/demo/native-search')
  })

  test('未显式提供 binary 时 native available smoke 标记 skipped，不从 PATH 查找', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'native-available',
      query: '关键字',
      env: {
        PATH: join('/tmp', 'fake-native-path'),
      },
    })

    expect(summary.mode).toBe('native-available')
    expect(summary.nativeSearchBinaryProvided).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'native-available',
      status: 'skipped',
    }))
  })

  test('native missing smoke 证明 missing_binary fallback 且 TS fallback 可用', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'native-missing',
      nativeSearchBinary: join('/tmp', 'missing-codeinsights-native-search'),
      query: '关键字',
    })

    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'native-missing',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).not.toContain('/tmp/missing-codeinsights-native-search')
  })
})
