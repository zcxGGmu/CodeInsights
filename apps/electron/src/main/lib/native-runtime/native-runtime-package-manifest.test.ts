import { describe, expect, test } from 'bun:test'
import {
  buildNativeSearchPackageManifest,
  getNativeSearchOptionalPackagePlan,
  isNativeSearchPackageManifest,
  NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS,
  validateNativeSearchOptionalPackageInstallChain,
  validateNativeSearchOptionalDependencies,
  validateNativeSearchPackagingConfig,
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

  test('校验 package.json 中 native search optionalDependencies 声明矩阵', () => {
    const completeOptionalDependencies = Object.fromEntries(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [plan.packageName, '0.0.2']),
    )

    expect(validateNativeSearchOptionalDependencies({
      optionalDependencies: {
        ...completeOptionalDependencies,
        'opencode-darwin-arm64': '1.15.11',
      },
    })).toEqual({
      declared: true,
      expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      presentPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      missingPackages: [],
      invalidPackages: [],
    })

    const missingPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]?.packageName
    if (!missingPackage) throw new Error('native search optional package plan should exist')
    const incompleteOptionalDependencies = { ...completeOptionalDependencies }
    delete incompleteOptionalDependencies[missingPackage]

    const missingResult = validateNativeSearchOptionalDependencies({
      optionalDependencies: incompleteOptionalDependencies,
    })
    expect(missingResult.declared).toBe(false)
    expect(missingResult.presentPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS
        .map((plan) => plan.packageName)
        .filter((packageName) => packageName !== missingPackage),
    )
    expect(missingResult.missingPackages).toEqual([missingPackage])
    expect(missingResult.invalidPackages).toEqual([])

    const invalidVersionPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[1]?.packageName
    if (!invalidVersionPackage) throw new Error('native search optional package plan should include a second package')
    const invalidResult = validateNativeSearchOptionalDependencies({
      optionalDependencies: {
        ...completeOptionalDependencies,
        [missingPackage]: '',
        [invalidVersionPackage]: 123,
      },
    })
    expect(invalidResult.declared).toBe(false)
    expect(invalidResult.presentPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(invalidResult.missingPackages).toEqual([])
    expect(invalidResult.invalidPackages).toEqual([
      missingPackage,
      invalidVersionPackage,
    ])

    const pathLikeResult = validateNativeSearchOptionalDependencies({
      optionalDependencies: {
        ...completeOptionalDependencies,
        [missingPackage]: 'file:/Users/demo/native-search',
        [invalidVersionPackage]: 'workspace:*',
      },
    })
    expect(pathLikeResult.declared).toBe(false)
    expect(pathLikeResult.presentPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(pathLikeResult.invalidPackages).toEqual([
      missingPackage,
      invalidVersionPackage,
    ])

    const partialResult = validateNativeSearchOptionalDependencies({
      optionalDependencies: {
        [missingPackage]: '0.0.2',
      },
    })
    expect(partialResult).toEqual({
      declared: false,
      expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      presentPackages: [missingPackage],
      missingPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS
        .map((plan) => plan.packageName)
        .filter((packageName) => packageName !== missingPackage),
      invalidPackages: [],
    })
  })

  test('允许安全的 npm registry alias，拒绝 alias 指向非 native search 包', () => {
    const aliasOptionalDependencies = Object.fromEntries(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [
        plan.packageName,
        `npm:${plan.packageName}@0.0.2`,
      ]),
    )

    expect(validateNativeSearchOptionalDependencies({
      optionalDependencies: aliasOptionalDependencies,
    })).toEqual({
      declared: true,
      expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      presentPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      missingPackages: [],
      invalidPackages: [],
    })

    const aliasedPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]?.packageName
    if (!aliasedPackage) throw new Error('native search optional package plan should exist')
    const crossPlatformPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[1]?.packageName
    if (!crossPlatformPackage) throw new Error('native search optional package plan should include a second package')

    expect(validateNativeSearchOptionalDependencies({
      optionalDependencies: {
        ...aliasOptionalDependencies,
        [aliasedPackage]: 'npm:@demo/native-search-darwin-arm64@0.0.2',
      },
    })).toEqual(expect.objectContaining({
      declared: false,
      invalidPackages: [aliasedPackage],
    }))

    expect(validateNativeSearchOptionalDependencies({
      optionalDependencies: {
        ...aliasOptionalDependencies,
        [aliasedPackage]: `npm:${crossPlatformPackage}@0.0.2`,
      },
    })).toEqual(expect.objectContaining({
      declared: false,
      invalidPackages: [aliasedPackage],
    }))

    expect(validateNativeSearchOptionalDependencies({
      optionalDependencies: {
        ...aliasOptionalDependencies,
        [aliasedPackage]: '^0.0.2',
        [crossPlatformPackage]: `npm:${crossPlatformPackage}@latest`,
      },
    })).toEqual(expect.objectContaining({
      declared: false,
      invalidPackages: [
        aliasedPackage,
        crossPlatformPackage,
      ],
    }))
  })

  test('校验 optional package 声明、lockfile 与已安装 package manifest 的一致性', () => {
    const optionalDependencies = Object.fromEntries(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [plan.packageName, '0.0.2']),
    )
    const installedPackageManifests = Object.fromEntries(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [
        plan.packageName,
        { name: plan.packageName, version: '0.0.2' },
      ]),
    )
    const lockfileText = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS
      .map((plan) => `    "${plan.packageName}": ["${plan.packageName}@0.0.2", "", {}, "sha512-fixture"],`)
      .join('\n')

    expect(validateNativeSearchOptionalPackageInstallChain({
      packageJson: { optionalDependencies },
      lockfileText,
      installedPackageManifests,
    })).toEqual({
      verified: true,
      optionalDependencies: {
        declared: true,
        expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
        presentPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
        missingPackages: [],
        invalidPackages: [],
      },
      lockfileVerified: true,
      installedPackagesVerified: true,
      missingLockfilePackages: [],
      missingInstalledPackages: [],
      invalidInstalledPackages: [],
    })

    const missingResult = validateNativeSearchOptionalPackageInstallChain({
      packageJson: {},
      lockfileText: '',
      installedPackageManifests: {},
    })
    expect(missingResult.verified).toBe(false)
    expect(missingResult.optionalDependencies.declared).toBe(false)
    expect(missingResult.lockfileVerified).toBe(false)
    expect(missingResult.installedPackagesVerified).toBe(false)
    expect(missingResult.missingLockfilePackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(missingResult.missingInstalledPackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )
    expect(JSON.stringify(missingResult)).not.toContain('/Users/')
    expect(JSON.stringify(missingResult)).not.toContain('node_modules')

    const invalidInstalledPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]?.packageName
    if (!invalidInstalledPackage) throw new Error('native search optional package plan should exist')
    const invalidResult = validateNativeSearchOptionalPackageInstallChain({
      packageJson: { optionalDependencies },
      lockfileText,
      installedPackageManifests: {
        ...installedPackageManifests,
        [invalidInstalledPackage]: {
          name: '@demo/native-search-darwin-arm64',
          version: '0.0.2',
        },
      },
    })
    expect(invalidResult.verified).toBe(false)
    expect(invalidResult.invalidInstalledPackages).toEqual([invalidInstalledPackage])

    const importerOnlyLockfile = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS
      .map((plan) => `        "${plan.packageName}": "0.0.2",`)
      .join('\n')
    const importerOnlyResult = validateNativeSearchOptionalPackageInstallChain({
      packageJson: { optionalDependencies },
      lockfileText: importerOnlyLockfile,
      installedPackageManifests,
    })
    expect(importerOnlyResult.verified).toBe(false)
    expect(importerOnlyResult.lockfileVerified).toBe(false)
    expect(importerOnlyResult.missingLockfilePackages).toEqual(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
    )

    const missingInstalledResult = validateNativeSearchOptionalPackageInstallChain({
      packageJson: { optionalDependencies },
      lockfileText,
      installedPackageManifests: {},
    })
    expect(missingInstalledResult.verified).toBe(false)
    expect(missingInstalledResult.optionalDependencies.declared).toBe(true)
    expect(missingInstalledResult.lockfileVerified).toBe(true)
    expect(missingInstalledResult.installedPackagesVerified).toBe(false)
  })

  test('缺少 optionalDependencies 对象时返回完整缺失列表且不读取真实 node_modules', () => {
    const result = validateNativeSearchOptionalDependencies({})

    expect(result).toEqual({
      declared: false,
      expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      presentPackages: [],
      missingPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      invalidPackages: [],
    })
  })

  test('校验 electron-builder files 是否包含 native search optional packages 且未被 workspace 排除规则阻断', () => {
    const expectedPackages = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
    const blockedConfig = `
files:
  - dist/**/*
  - package.json
  - "!node_modules/@codeinsights/**"
`

    expect(validateNativeSearchPackagingConfig(blockedConfig)).toEqual({
      verified: false,
      expectedPackages,
      includedPackages: [],
      missingPackages: expectedPackages,
      blockingExcludes: ['!node_modules/@codeinsights/**'],
      tooBroadIncludes: [],
    })

    const allowedConfig = `
files:
  - dist/**/*
  - package.json
  - node_modules/@codeinsights/native-search-darwin-arm64/**/*
  - node_modules/@codeinsights/native-search-darwin-x64/**/*
  - node_modules/@codeinsights/native-search-win32-x64/**/*
  - node_modules/@codeinsights/native-search-linux-x64/**/*
`

    expect(validateNativeSearchPackagingConfig(allowedConfig)).toEqual({
      verified: true,
      expectedPackages,
      includedPackages: expectedPackages,
      missingPackages: [],
      blockingExcludes: [],
      tooBroadIncludes: [],
    })

    const packageSpecificExcludeConfig = `
files:
  - node_modules/@codeinsights/native-search-darwin-arm64/**/*
  - node_modules/@codeinsights/native-search-darwin-x64/**/*
  - node_modules/@codeinsights/native-search-win32-x64/**/*
  - node_modules/@codeinsights/native-search-linux-x64/**/*
  - "!node_modules/@codeinsights/native-search-darwin-arm64/**/*"
`

    expect(validateNativeSearchPackagingConfig(packageSpecificExcludeConfig)).toEqual({
      verified: false,
      expectedPackages,
      includedPackages: expectedPackages,
      missingPackages: [],
      blockingExcludes: ['!node_modules/@codeinsights/native-search-darwin-arm64/**/*'],
      tooBroadIncludes: [],
    })

    const broadExcludeConfig = `
files: # top-level only
  - node_modules/@codeinsights/native-search-darwin-arm64/**/*
  - node_modules/@codeinsights/native-search-darwin-x64/**/*
  - node_modules/@codeinsights/native-search-win32-x64/**/*
  - node_modules/@codeinsights/native-search-linux-x64/**/*
  - "!node_modules/**"
  - "!node_modules/@codeinsights/*"
  - "!node_modules/@codeinsights/native-search-*/bin/**"
`

    expect(validateNativeSearchPackagingConfig(broadExcludeConfig)).toEqual({
      verified: false,
      expectedPackages,
      includedPackages: expectedPackages,
      missingPackages: [],
      blockingExcludes: [
        '!node_modules/**',
        '!node_modules/@codeinsights/*',
        '!node_modules/@codeinsights/native-search-*/bin/**',
      ],
      tooBroadIncludes: [],
    })

    const wildcardIncludeConfig = `
files:
  - node_modules/@codeinsights/native-search-*/**/*
`

    expect(validateNativeSearchPackagingConfig(wildcardIncludeConfig)).toEqual({
      verified: false,
      expectedPackages,
      includedPackages: [],
      missingPackages: expectedPackages,
      blockingExcludes: [],
      tooBroadIncludes: ['node_modules/@codeinsights/native-search-*/**/*'],
    })
  })

  test('未支持的 electron-builder files 写法必须保守地保持未验证', () => {
    const expectedPackages = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
    const inlineArrayConfig = `
files: ["node_modules/@codeinsights/native-search-darwin-arm64/**/*"]
`

    expect(validateNativeSearchPackagingConfig(inlineArrayConfig)).toEqual({
      verified: false,
      expectedPackages,
      includedPackages: [],
      missingPackages: expectedPackages,
      blockingExcludes: [],
      tooBroadIncludes: [],
    })

    const fileSetObjectConfig = `
files:
  - from: node_modules/@codeinsights/native-search-darwin-arm64
    to: node_modules/@codeinsights/native-search-darwin-arm64
`

    expect(validateNativeSearchPackagingConfig(fileSetObjectConfig)).toEqual({
      verified: false,
      expectedPackages,
      includedPackages: [],
      missingPackages: expectedPackages,
      blockingExcludes: [],
      tooBroadIncludes: [],
    })
  })
})
