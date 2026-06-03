import { describe, expect, test } from 'bun:test'
import {
  buildNativeSearchPackageManifest,
  getNativeSearchOptionalPackagePlan,
  isNativeSearchPackageManifest,
  NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS,
} from './native-runtime-package-manifest'

const VALID_SHA256 = 'a'.repeat(64)

describe('native-runtime-package-manifest', () => {
  test('固定 native search optional package 平台矩阵', () => {
    expect(NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS).toEqual([
      {
        packageName: '@codeinsights/native-search-darwin-arm64',
        platform: 'darwin',
        arch: 'arm64',
        binaryName: 'codeinsights-native-search',
      },
      {
        packageName: '@codeinsights/native-search-darwin-x64',
        platform: 'darwin',
        arch: 'x64',
        binaryName: 'codeinsights-native-search',
      },
      {
        packageName: '@codeinsights/native-search-win32-x64',
        platform: 'win32',
        arch: 'x64',
        binaryName: 'codeinsights-native-search.exe',
      },
      {
        packageName: '@codeinsights/native-search-linux-x64',
        platform: 'linux',
        arch: 'x64',
        binaryName: 'codeinsights-native-search',
      },
    ])
  })

  test('可按当前平台和架构生成 package manifest，不记录 binary path', () => {
    const plan = getNativeSearchOptionalPackagePlan('darwin', 'arm64')

    expect(plan).toBeDefined()
    if (!plan) throw new Error('darwin arm64 package plan should exist')
    expect(plan).toEqual({
      packageName: '@codeinsights/native-search-darwin-arm64',
      platform: 'darwin',
      arch: 'arm64',
      binaryName: 'codeinsights-native-search',
    })

    const manifest = buildNativeSearchPackageManifest({
      plan,
      packageVersion: '0.0.2',
      binarySha256: VALID_SHA256,
    })

    expect(manifest).toEqual({
      schemaVersion: 1,
      packageName: '@codeinsights/native-search-darwin-arm64',
      packageVersion: '0.0.2',
      protocolVersion: 1,
      cacheSchemaVersion: 1,
      platform: 'darwin',
      arch: 'arm64',
      binaryName: 'codeinsights-native-search',
      binarySha256: VALID_SHA256,
    })
    expect(JSON.stringify(manifest)).not.toContain('binaryPath')
    expect(JSON.stringify(manifest)).not.toContain('/Users/')
  })

  test('校验 package manifest 字段、SHA-256 和 path-like 字段', () => {
    const plan = getNativeSearchOptionalPackagePlan('win32', 'x64')
    expect(plan).toBeDefined()
    if (!plan) throw new Error('win32 x64 package plan should exist')

    const validManifest = buildNativeSearchPackageManifest({
      plan,
      packageVersion: '0.0.2',
      binarySha256: VALID_SHA256.toUpperCase(),
    })

    expect(isNativeSearchPackageManifest(validManifest)).toBe(true)
    expect(validManifest.binarySha256).toBe(VALID_SHA256)
    expect(isNativeSearchPackageManifest({
      ...validManifest,
      binarySha256: 'not-a-sha',
    })).toBe(false)
    expect(isNativeSearchPackageManifest({
      ...validManifest,
      packageVersion: '/Users/demo/native-search',
    })).toBe(false)
    expect(isNativeSearchPackageManifest({
      ...validManifest,
      binaryPath: '/Users/demo/codeinsights-native-search',
    })).toBe(false)
    expect(isNativeSearchPackageManifest({
      ...validManifest,
      metadata: {
        binaryPath: '/Users/demo/codeinsights-native-search',
      },
    })).toBe(false)
    expect(isNativeSearchPackageManifest({
      ...validManifest,
      home: '/Users/demo',
    })).toBe(false)
    expect(isNativeSearchPackageManifest({
      ...validManifest,
      packageName: '@codeinsights/native-search-darwin-arm64',
    })).toBe(false)
  })

  test('不支持的平台不会生成 package plan', () => {
    expect(getNativeSearchOptionalPackagePlan('freebsd' as NodeJS.Platform, 'x64')).toBeUndefined()
    expect(getNativeSearchOptionalPackagePlan('darwin', 'arm' as NodeJS.Architecture)).toBeUndefined()
  })
})
