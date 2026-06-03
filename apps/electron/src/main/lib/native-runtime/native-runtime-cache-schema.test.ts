import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildNativeRuntimeCacheManifest,
  getNativeRuntimeCacheDir,
  getNativeRuntimeCacheManifestPath,
  readNativeRuntimeCacheManifest,
  writeNativeRuntimeCacheManifest,
} from './native-runtime-cache-schema'

const tempDirs: string[] = []
const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR

afterEach(() => {
  if (originalConfigDir == null) {
    delete process.env.CODEINSIGHTS_CONFIG_DIR
  } else {
    process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
  }

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe('native-runtime-cache-schema', () => {
  test('cache root 固定在配置目录 native-cache 下', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-cache-schema-'))
    tempDirs.push(configDir)
    process.env.CODEINSIGHTS_CONFIG_DIR = configDir

    expect(getNativeRuntimeCacheDir()).toBe(join(configDir, 'native-cache'))
    expect(getNativeRuntimeCacheManifestPath()).toBe(join(configDir, 'native-cache', 'manifest.json'))
  })

  test('manifest 记录 protocol/schema/package plan，但不记录 binary path', () => {
    const manifest = buildNativeRuntimeCacheManifest({
      packagePlan: {
        packageName: '@codeinsights/native-search-darwin-arm64',
        platform: 'darwin',
        arch: 'arm64',
        binaryName: 'codeinsights-native-search',
      },
    })

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      protocolVersion: 1,
      implementation: 'rust-sidecar',
      packagePlan: {
        packageName: '@codeinsights/native-search-darwin-arm64',
        platform: 'darwin',
        arch: 'arm64',
        binaryName: 'codeinsights-native-search',
      },
    })
    expect(JSON.stringify(manifest)).not.toContain('binaryPath')
  })

  test('read/write manifest 使用脱敏路径并把损坏 manifest 标记为 cache_corrupted', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-cache-read-'))
    tempDirs.push(configDir)
    process.env.CODEINSIGHTS_CONFIG_DIR = configDir
    const manifest = buildNativeRuntimeCacheManifest()

    writeNativeRuntimeCacheManifest(manifest)
    const readResult = readNativeRuntimeCacheManifest()

    expect(readResult.ok).toBe(true)
    if (readResult.ok) {
      expect(readResult.manifest.schemaVersion).toBe(1)
      expect(readResult.manifest.createdAt).toBe(manifest.createdAt)
    }
    expect(existsSync(getNativeRuntimeCacheManifestPath())).toBe(true)

    writeFileSync(getNativeRuntimeCacheManifestPath(), '{broken', 'utf-8')
    const corrupted = readNativeRuntimeCacheManifest()

    expect(corrupted.ok).toBe(false)
    if (!corrupted.ok) {
      expect(corrupted.error.code).toBe('cache_corrupted')
      expect(corrupted.error.message).not.toContain(configDir)
    }
  })

  test('write manifest 会白名单归一化，拒绝额外 path 字段落盘', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-cache-safe-write-'))
    tempDirs.push(configDir)
    process.env.CODEINSIGHTS_CONFIG_DIR = configDir

    writeNativeRuntimeCacheManifest({
      ...buildNativeRuntimeCacheManifest({
        packagePlan: {
          packageName: '@codeinsights/native-search-darwin-arm64',
          platform: 'darwin',
          arch: 'arm64',
          binaryName: 'codeinsights-native-search',
        },
      }),
      binaryPath: '/Users/demo/native-search',
      packagePlan: {
        packageName: '@codeinsights/native-search-darwin-arm64',
        platform: 'darwin',
        arch: 'arm64',
        binaryName: 'codeinsights-native-search',
        binaryPath: '/Users/demo/native-search',
      },
    } as unknown as ReturnType<typeof buildNativeRuntimeCacheManifest>)

    const rawManifest = readFileSync(getNativeRuntimeCacheManifestPath(), 'utf-8')

    expect(rawManifest).not.toContain('binaryPath')
    expect(rawManifest).not.toContain('/Users/demo')
  })

  test('native-cache symlink 指向配置目录外时拒绝写入', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-cache-symlink-'))
    const externalDir = mkdtempSync(join(tmpdir(), 'codeinsights-native-cache-external-'))
    tempDirs.push(configDir, externalDir)
    process.env.CODEINSIGHTS_CONFIG_DIR = configDir
    symlinkSync(externalDir, getNativeRuntimeCacheDir())

    expect(() => writeNativeRuntimeCacheManifest(buildNativeRuntimeCacheManifest())).toThrow('native-cache 目录不安全')
    expect(existsSync(join(externalDir, 'manifest.json'))).toBe(false)
  })
})
