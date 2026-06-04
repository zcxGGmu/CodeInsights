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

  test('buildBenchmarkSummary 输出 Chat / Agent native search gate 对比', () => {
    const summary = buildBenchmarkSummary({
      startedAt: '2026-06-01T12:00:00.000Z',
      artifactDir: '/tmp/codeinsights-native-runtime-benchmark-demo',
      keepArtifacts: false,
      options: {
        records: 100,
        payloadBytes: 64,
        workspaceFiles: 20,
        logBytes: 1024,
        iterations: 2,
        keepArtifacts: false,
        nativeSearchBinary: '/tmp/native-search',
      },
      cases: [
        {
          name: 'chat-search-large-history',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [120, 100],
          eventLoopBaselineSamplesMs: [1, 1],
          eventLoopDelaySamplesMs: [4, 3],
          memoryDeltaBytes: 1024,
        },
        {
          name: 'native-chat-search-large-history',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [10, 12],
          eventLoopBaselineSamplesMs: [1, 1],
          eventLoopDelaySamplesMs: [2, 2],
          memoryDeltaBytes: 2048,
        },
        {
          name: 'agent-runtime-search',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [220, 200],
          eventLoopBaselineSamplesMs: [1, 1],
          eventLoopDelaySamplesMs: [2, 2],
          memoryDeltaBytes: 1024,
        },
        {
          name: 'native-agent-runtime-search',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [4, 5],
          eventLoopBaselineSamplesMs: [1, 1],
          eventLoopDelaySamplesMs: [3, 3],
          memoryDeltaBytes: 2048,
        },
        {
          name: 'agent-runtime-production-facade-search',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [210, 205],
          eventLoopBaselineSamplesMs: [1, 1],
          eventLoopDelaySamplesMs: [4, 4],
          memoryDeltaBytes: 1024,
        },
      ],
    })

    expect(summary.nativeSearchGate).toMatchObject({
      evaluated: true,
      benchmarkGatePassed: false,
      defaultEnableCandidate: false,
      benchmarkBlockers: [
        'agent_event_loop_delay_p95_regressed',
        'agent_event_loop_work_delay_p95_regressed',
      ],
      defaultEnableBlockers: [
        'optional_package_install_chain_not_evaluated',
        'packaged_app_bundled_binary_not_evaluated',
      ],
      blockers: [
        'agent_event_loop_delay_p95_regressed',
        'agent_event_loop_work_delay_p95_regressed',
        'optional_package_install_chain_not_evaluated',
        'packaged_app_bundled_binary_not_evaluated',
      ],
    })
    expect(summary.nativeSearchGate.comparisons).toHaveLength(2)
    expect(summary.nativeSearchGate.comparisons[0]).toMatchObject({
      source: 'chat',
      p95DeltaMs: -108,
      p95Ratio: 0.1,
      eventLoopDelayP95DeltaMs: -2,
      eventLoopWorkDelayP95DeltaMs: -2,
      p95Improved: true,
      eventLoopDelayP95NotRegressed: true,
      eventLoopWorkDelayP95NotRegressed: true,
    })
    expect(summary.nativeSearchGate.comparisons[1]).toMatchObject({
      source: 'agent',
      p95DeltaMs: -215,
      p95Ratio: 0.023,
      eventLoopDelayP95DeltaMs: 1,
      eventLoopWorkDelayP95DeltaMs: 1,
      p95Improved: true,
      eventLoopDelayP95NotRegressed: false,
      eventLoopWorkDelayP95NotRegressed: false,
    })
    expect(summary.agentFacadeSearch).toMatchObject({
      evaluated: true,
      caseName: 'agent-runtime-production-facade-search',
      implementation: 'typescript',
      productionAgentNativeExtractor: 'agent_message_search_text',
      productionAgentNativeExtractorDeclared: true,
      nativeEligible: true,
      directNativeBenchmarkCaseName: 'native-agent-runtime-search',
      nativeParityCaseName: 'native-agent-runtime-production-facade-search',
      nativeParityEvaluated: false,
      defaultEnableBlockers: ['agent_facade_native_parity_not_evaluated'],
    })
    expect(summary.nativeSearchGate.comparisons.map((comparison) => comparison.nativeCaseName)).toEqual([
      'native-chat-search-large-history',
      'native-agent-runtime-search',
    ])
    expect(summary.nativeSearchDefaultEnableReadiness).toMatchObject({
      evaluated: true,
      defaultEnableCandidate: false,
      explicitOptInRequired: true,
      blockers: [
        'native_benchmark_gate_not_passed',
        'agent_facade_native_parity_not_evaluated',
        'optional_packages_not_published',
        'optional_dependencies_not_declared',
        'optional_package_install_chain_not_verified',
        'packaging_config_not_verified',
        'packaged_app_evidence_not_verified',
        'packaged_app_identity_not_verified',
        'packaged_app_bundled_binary_not_verified',
        'default_enable_risk_review_not_completed',
      ],
      gates: {
        benchmarkEvaluated: true,
        benchmarkGatePassed: false,
        agentFacadeNativeExtractorDeclared: true,
        agentFacadeNativeParityEvaluated: false,
        optionalPackagesPublished: false,
        optionalDependenciesDeclared: false,
        optionalDependenciesInstallChainVerified: false,
        packagingConfigVerified: false,
        packagedAppEvidenceVerified: false,
        packagedAppIdentityVerified: false,
        realPackagedBinaryVerified: false,
        riskReviewCompleted: false,
      },
    })
  })

  test('buildBenchmarkSummary 未提供 native binary 时仍保留默认启用阻塞项', () => {
    const summary = buildBenchmarkSummary({
      startedAt: '2026-06-01T12:00:00.000Z',
      artifactDir: '/tmp/codeinsights-native-runtime-benchmark-demo',
      keepArtifacts: false,
      options: {
        records: 100,
        payloadBytes: 64,
        workspaceFiles: 20,
        logBytes: 1024,
        iterations: 1,
        keepArtifacts: false,
      },
      cases: [],
    })

    expect(summary.nativeSearchGate).toMatchObject({
      evaluated: false,
      benchmarkGatePassed: false,
      defaultEnableCandidate: false,
      benchmarkBlockers: ['native_binary_not_provided'],
      defaultEnableBlockers: [
        'optional_package_install_chain_not_evaluated',
        'packaged_app_bundled_binary_not_evaluated',
      ],
      blockers: [
        'native_binary_not_provided',
        'optional_package_install_chain_not_evaluated',
        'packaged_app_bundled_binary_not_evaluated',
      ],
      comparisons: [],
    })
    expect(summary.nativeSearchDefaultEnableReadiness.blockers).toEqual([
      'native_benchmark_not_evaluated',
      'native_benchmark_gate_not_passed',
      'agent_facade_native_extractor_not_declared',
      'agent_facade_native_parity_not_evaluated',
      'optional_packages_not_published',
      'optional_dependencies_not_declared',
      'optional_package_install_chain_not_verified',
      'packaging_config_not_verified',
      'packaged_app_evidence_not_verified',
      'packaged_app_identity_not_verified',
      'packaged_app_bundled_binary_not_verified',
      'default_enable_risk_review_not_completed',
    ])
  })

  test('buildBenchmarkSummary benchmark 通过时仍不把 packaged / optional 阻塞误判为可默认启用', () => {
    const summary = buildBenchmarkSummary({
      startedAt: '2026-06-01T12:00:00.000Z',
      artifactDir: '/tmp/codeinsights-native-runtime-benchmark-demo',
      keepArtifacts: false,
      options: {
        records: 100,
        payloadBytes: 64,
        workspaceFiles: 20,
        logBytes: 1024,
        iterations: 2,
        keepArtifacts: false,
        nativeSearchBinary: '/tmp/native-search',
      },
      cases: [
        {
          name: 'chat-search-large-history',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [100, 100],
          eventLoopBaselineSamplesMs: [1, 1],
          eventLoopDelaySamplesMs: [5, 5],
          memoryDeltaBytes: 1024,
        },
        {
          name: 'native-chat-search-large-history',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [5, 5],
          eventLoopBaselineSamplesMs: [1, 1],
          eventLoopDelaySamplesMs: [2, 2],
          memoryDeltaBytes: 1024,
        },
        {
          name: 'agent-runtime-search',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [200, 200],
          eventLoopBaselineSamplesMs: [1, 1],
          eventLoopDelaySamplesMs: [4, 4],
          memoryDeltaBytes: 1024,
        },
        {
          name: 'native-agent-runtime-search',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [4, 4],
          eventLoopBaselineSamplesMs: [1, 1],
          eventLoopDelaySamplesMs: [2, 2],
          memoryDeltaBytes: 1024,
        },
      ],
    })

    expect(summary.nativeSearchGate).toMatchObject({
      evaluated: true,
      benchmarkGatePassed: true,
      defaultEnableCandidate: false,
      benchmarkBlockers: [],
      defaultEnableBlockers: [
        'optional_package_install_chain_not_evaluated',
        'packaged_app_bundled_binary_not_evaluated',
      ],
      blockers: [
        'optional_package_install_chain_not_evaluated',
        'packaged_app_bundled_binary_not_evaluated',
      ],
    })
    expect(summary.agentFacadeSearch.defaultEnableBlockers).toContain('agent_facade_case_missing')
  })

  test('buildBenchmarkSummary 识别 Agent facade nested native parity case', () => {
    const summary = buildBenchmarkSummary({
      startedAt: '2026-06-01T12:00:00.000Z',
      artifactDir: '/tmp/codeinsights-native-runtime-benchmark-demo',
      keepArtifacts: false,
      options: {
        records: 100,
        payloadBytes: 64,
        workspaceFiles: 20,
        logBytes: 1024,
        iterations: 1,
        keepArtifacts: false,
        nativeSearchBinary: '/tmp/native-search',
      },
      cases: [
        {
          name: 'agent-runtime-production-facade-search',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [20],
          eventLoopBaselineSamplesMs: [1],
          eventLoopDelaySamplesMs: [2],
          memoryDeltaBytes: 1024,
        },
        {
          name: 'native-agent-runtime-production-facade-search',
          dataScale: { records: 100, bytes: 4096 },
          samplesMs: [4],
          eventLoopBaselineSamplesMs: [1],
          eventLoopDelaySamplesMs: [2],
          memoryDeltaBytes: 1024,
        },
      ],
    })

    expect(summary.agentFacadeSearch).toMatchObject({
      evaluated: true,
      implementation: 'rust-sidecar',
      productionAgentNativeExtractor: 'agent_message_search_text',
      productionAgentNativeExtractorDeclared: true,
      nativeEligible: true,
      nativeParityCaseName: 'native-agent-runtime-production-facade-search',
      nativeParityEvaluated: true,
      defaultEnableBlockers: [],
    })
    expect(summary.nativeSearchGate.defaultEnableCandidate).toBe(false)
    expect(summary.nativeSearchDefaultEnableReadiness).toMatchObject({
      defaultEnableCandidate: false,
      explicitOptInRequired: true,
      blockers: [
        'native_benchmark_not_evaluated',
        'native_benchmark_gate_not_passed',
        'optional_packages_not_published',
        'optional_dependencies_not_declared',
        'optional_package_install_chain_not_verified',
        'packaging_config_not_verified',
        'packaged_app_evidence_not_verified',
        'packaged_app_identity_not_verified',
        'packaged_app_bundled_binary_not_verified',
        'default_enable_risk_review_not_completed',
      ],
    })
  })

  test('runBenchmark 输出 workspace cold build、warm search 与 Agent facade 指标', async () => {
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
    const agentFacade = summary.cases.find((item) => item.name === 'agent-runtime-production-facade-search')

    expect(summary.implementation).toBe('typescript')
    expect(summary.agentFacadeSearch).toMatchObject({
      evaluated: true,
      implementation: 'typescript',
      productionAgentNativeExtractor: 'agent_message_search_text',
      productionAgentNativeExtractorDeclared: true,
      nativeEligible: true,
      nativeParityEvaluated: false,
      defaultEnableBlockers: ['agent_facade_native_parity_not_evaluated'],
    })
    expect(coldBuild).toMatchObject({
      files: 20,
    })
    expect(warmSearch).toMatchObject({
      files: 20,
    })
    expect(agentFacade).toMatchObject({
      records: 10,
    })
    expect(agentFacade?.p50Ms).toBeGreaterThanOrEqual(0)
    expect(agentFacade?.eventLoopWorkDelayMs).toBeGreaterThanOrEqual(0)
    expect(coldBuild?.p50Ms).toBeGreaterThanOrEqual(0)
    expect(warmSearch?.eventLoopDelayMs).toBeGreaterThanOrEqual(0)
    expect(warmSearch?.eventLoopBaselineMs).toBeGreaterThanOrEqual(0)
    expect(warmSearch?.eventLoopWorkDelayMs).toBeGreaterThanOrEqual(0)
    expect(warmSearch?.eventLoopDelaySamplesMs).toHaveLength(1)
    expect(warmSearch?.eventLoopWorkDelaySamplesMs).toHaveLength(1)
    expect(warmSearch?.memoryDeltaBytes).toBeGreaterThanOrEqual(0)
  })
})
