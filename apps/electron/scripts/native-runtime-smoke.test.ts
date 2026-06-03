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

  test('protocol mismatch smoke 使用 fake sidecar 验证 version_mismatch fallback', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'protocol-mismatch',
      query: '关键字',
    })

    expect(summary.nativeSearchBinaryProvided).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'protocol-mismatch',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('fallbackReason=version_mismatch')
    expect(JSON.stringify(summary)).not.toContain('/Users/')
  })

  test('crash smoke 使用 fake sidecar 验证 crashed fallback', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'crash',
      query: '关键字',
    })

    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'crash',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('fallbackReason=crashed')
    expect(JSON.stringify(summary)).not.toContain('secret-token')
  })

  test('timeout smoke 使用 fake sidecar 验证 timeout fallback 且清理 pending', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'timeout',
      query: '关键字',
    })

    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'timeout',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('fallbackReason=timeout')
  })

  test('cache corruption smoke 使用隔离 config dir 验证 cache_corrupted 且不读取真实缓存', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'cache-corruption',
      query: '关键字',
    })

    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'cache-corruption',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('fallbackReason=cache_corrupted')
    expect(JSON.stringify(summary)).not.toContain('/codeinsights-native-runtime-smoke-')
  })

  test('packaged manifest smoke 只验证 optional package manifest 预检，不证明 bundled binary', async () => {
    const summary = await runNativeRuntimeSmoke({
      mode: 'packaged-manifest',
      query: '关键字',
    })

    expect(summary.mode).toBe('packaged-manifest')
    expect(summary.nativeSearchBinaryProvided).toBe(false)
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'packaged-manifest-preflight',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'packaged-resolver-fixture',
      status: 'passed',
    }))
    expect(summary.cases).toContainEqual(expect.objectContaining({
      name: 'typescript-fallback-search',
      status: 'passed',
    }))
    expect(JSON.stringify(summary)).toContain('bundledBinaryVerified=false')
    expect(JSON.stringify(summary)).toContain('fixtureBundledPackageVerified=true')
    expect(JSON.stringify(summary)).toContain('realPackagedBinaryVerified=false')
    expect(JSON.stringify(summary)).not.toContain('/Users/')
    expect(JSON.stringify(summary)).not.toContain('binaryPath')
    expect(JSON.stringify(summary)).not.toContain('/codeinsights-native-runtime-smoke-')
  })
})
