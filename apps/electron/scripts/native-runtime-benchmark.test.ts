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
      '--native-search-binary',
      '/tmp/native-search',
      '--keep-artifacts',
    ])

    expect(options).toEqual({
      records: 1200,
      payloadBytes: 128,
      workspaceFiles: 2400,
      logBytes: 4096,
      iterations: 3,
      nativeSearchBinary: '/tmp/native-search',
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
        nativeSearchBinary: '/Users/demo/native-search',
      },
      cases: [
        {
          name: 'chat-search-large-history',
          dataScale: { records: 10, bytes: 2048 },
          samplesMs: [2, 4],
          eventLoopBaselineSamplesMs: [0.5, 1],
          eventLoopDelaySamplesMs: [1, 3, 2],
          memoryDeltaBytes: 1024,
        },
      ],
    })

    expect(summary.schemaVersion).toBe(1)
    expect(summary.implementation).toBe('typescript+rust-sidecar')
    expect(JSON.stringify(summary)).not.toContain('/Users/demo/native-search')
    expect(summary.options.nativeSearchBinaryProvided).toBe(true)
    expect(summary.cases[0]).toMatchObject({
      name: 'chat-search-large-history',
      p50Ms: 2,
      p95Ms: 4,
      p99Ms: 4,
      eventLoopDelayMs: 3,
      eventLoopDelayMaxMs: 3,
      eventLoopDelayP95Ms: 3,
      eventLoopDelaySamplesMs: [1, 3, 2],
      eventLoopBaselineMs: 1,
      eventLoopBaselineP95Ms: 1,
      eventLoopWorkDelayMs: 2,
      eventLoopWorkDelayP95Ms: 2,
      eventLoopWorkDelaySamplesMs: [0.5, 2, 2],
    })
    expect(summary.artifactDir).toBeUndefined()
  })

  test('buildBenchmarkSummary 对空 event-loop 样本保持数值字段', () => {
    const summary = buildBenchmarkSummary({
      startedAt: '2026-06-01T12:00:00.000Z',
      artifactDir: '/tmp/codeinsights-native-runtime-benchmark-demo',
      keepArtifacts: false,
      options: {
        records: 0,
        payloadBytes: 64,
        workspaceFiles: 0,
        logBytes: 0,
        iterations: 0,
        keepArtifacts: false,
      },
      cases: [
        {
          name: 'empty-samples',
          dataScale: {},
          samplesMs: [],
          eventLoopBaselineSamplesMs: [],
          eventLoopDelaySamplesMs: [],
          memoryDeltaBytes: 0,
        },
      ],
    })

    expect(summary.cases[0]).toMatchObject({
      p50Ms: 0,
      eventLoopDelayMs: 0,
      eventLoopDelayMaxMs: 0,
      eventLoopDelayP95Ms: 0,
      eventLoopBaselineMs: 0,
      eventLoopBaselineP95Ms: 0,
      eventLoopWorkDelayMs: 0,
      eventLoopWorkDelayP95Ms: 0,
      eventLoopWorkDelaySamplesMs: [],
    })
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
    expect(warmSearch?.eventLoopBaselineMs).toBeGreaterThanOrEqual(0)
    expect(warmSearch?.eventLoopWorkDelayMs).toBeGreaterThanOrEqual(0)
    expect(warmSearch?.eventLoopDelaySamplesMs).toHaveLength(1)
    expect(warmSearch?.eventLoopWorkDelaySamplesMs).toHaveLength(1)
    expect(warmSearch?.memoryDeltaBytes).toBeGreaterThanOrEqual(0)
  })
})
