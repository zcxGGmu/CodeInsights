import { describe, expect, test } from 'bun:test'
import {
  buildBenchmarkSummary,
  parseBenchmarkArgs,
  percentile,
  runBenchmark,
} from './native-runtime-benchmark'

describe('native-runtime-benchmark helpers', () => {
  test('parseBenchmarkArgs 支持 quick benchmark 参数', () => {
    const options = parseBenchmarkArgs([
      '--records',
      '1200',
      '--payload-bytes',
      '128',
      '--workspace-files',
      '2400',
      '--log-bytes',
      '4096',
      '--iterations',
      '3',
      '--keep-artifacts',
    ])

    expect(options).toEqual({
      records: 1200,
      payloadBytes: 128,
      workspaceFiles: 2400,
      logBytes: 4096,
      iterations: 3,
      keepArtifacts: true,
    })
  })

  test('percentile 以稳定方式返回样本分位值', () => {
    expect(percentile([20, 10, 50, 40, 30], 0.5)).toBe(30)
    expect(percentile([20, 10, 50, 40, 30], 0.95)).toBe(50)
    expect(percentile([], 0.95)).toBe(0)
  })

  test('buildBenchmarkSummary 输出包含 Phase 0 需要记录的基线字段', () => {
    const summary = buildBenchmarkSummary({
      startedAt: '2026-06-01T12:00:00.000Z',
      artifactDir: '/tmp/codeinsights-native-runtime-benchmark-demo',
      keepArtifacts: false,
      options: {
        records: 10,
        payloadBytes: 64,
        workspaceFiles: 20,
        logBytes: 1024,
        iterations: 2,
        keepArtifacts: false,
      },
      cases: [
        {
          name: 'chat-search-large-history',
          dataScale: { records: 10, bytes: 2048 },
          samplesMs: [2, 4],
          eventLoopDelayMs: 1,
          memoryDeltaBytes: 1024,
        },
      ],
    })

    expect(summary.schemaVersion).toBe(1)
    expect(summary.implementation).toBe('typescript')
    expect(summary.cases[0]).toMatchObject({
      name: 'chat-search-large-history',
      p50Ms: 2,
      p95Ms: 4,
      p99Ms: 4,
    })
    expect(summary.artifactDir).toBeUndefined()
  })

  test('runBenchmark 输出 workspace cold build 与 warm search 指标', async () => {
    const summary = await runBenchmark({
      records: 10,
      payloadBytes: 64,
      workspaceFiles: 20,
      logBytes: 1024,
      iterations: 1,
      keepArtifacts: false,
    })

    const coldBuild = summary.cases.find((item) => item.name === 'workspace-file-name-index-cold-build')
    const warmSearch = summary.cases.find((item) => item.name === 'workspace-file-name-search')

    expect(summary.implementation).toBe('typescript')
    expect(coldBuild).toMatchObject({
      files: 20,
    })
    expect(warmSearch).toMatchObject({
      files: 20,
    })
    expect(coldBuild?.p50Ms).toBeGreaterThanOrEqual(0)
    expect(warmSearch?.eventLoopDelayMs).toBeGreaterThanOrEqual(0)
    expect(warmSearch?.memoryDeltaBytes).toBeGreaterThanOrEqual(0)
  })
})
