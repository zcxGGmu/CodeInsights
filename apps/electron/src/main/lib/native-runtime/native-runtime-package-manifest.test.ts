import { describe, expect, test } from 'bun:test'
import {
  buildNativeSearchPackagingConfigAllowlistChangePlan,
  buildNativeSearchPackageManifest,
  getNativeSearchOptionalPackagePlan,
  isNativeSearchPackageManifest,
  NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS,
  validateNativeSearchOptionalPackageInstallChain,
  validateNativeSearchOptionalPackagePublication,
  validateNativeSearchOptionalPackageSources,
  validateNativeSearchOptionalPackagePublishTarget,
  validateNativeSearchOptionalDependencies,
  validateNativeSearchPackagingConfig,
  buildNativeSearchOptionalPackageExecutionPlan,
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

  test('校验 native search optional package registry 发布元数据', () => {
    const registryMetadata = Object.fromEntries(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [
        plan.packageName,
        createRegistryPackument(plan.packageName, {
          version: '0.0.3',
          os: [plan.platform],
          cpu: [plan.arch],
          bin: {
            'codeinsights-native-search': `bin/${plan.binaryName}`,
          },
        }),
      ]),
    )

    expect(validateNativeSearchOptionalPackagePublication({ registryMetadata })).toEqual({
      published: true,
      expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      publishedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      missingPackages: [],
      invalidPackages: [],
      unavailablePackages: [],
    })

    const missingPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]?.packageName
    if (!missingPackage) throw new Error('native search optional package plan should exist')
    const missingRegistryMetadata = { ...registryMetadata }
    delete missingRegistryMetadata[missingPackage]

    expect(validateNativeSearchOptionalPackagePublication({
      registryMetadata: missingRegistryMetadata,
    })).toEqual(expect.objectContaining({
      published: false,
      missingPackages: [missingPackage],
      unavailablePackages: [],
    }))

    const invalidPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[1]
    if (!invalidPackage) throw new Error('native search optional package plan should include a second package')
    expect(validateNativeSearchOptionalPackagePublication({
      registryMetadata: {
        ...registryMetadata,
        [invalidPackage.packageName]: createRegistryPackument(invalidPackage.packageName, {
          version: '0.0.3',
          os: ['linux'],
          cpu: [invalidPackage.arch],
          bin: {
            'codeinsights-native-search': `bin/${invalidPackage.binaryName}`,
          },
        }),
      },
    })).toEqual(expect.objectContaining({
      published: false,
      invalidPackages: [invalidPackage.packageName],
    }))
  })

  test('registry 发布元数据可绑定 expected exact version，不能只看 latest', () => {
    const expectedVersions = Object.fromEntries(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [plan.packageName, '0.0.3']),
    )
    const registryMetadata = Object.fromEntries(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [
        plan.packageName,
        {
          name: plan.packageName,
          'dist-tags': {
            latest: '0.0.4',
          },
          versions: {
            '0.0.4': {
              name: plan.packageName,
              version: '0.0.4',
              os: [plan.platform],
              cpu: [plan.arch],
              bin: {
                'codeinsights-native-search': `bin/${plan.binaryName}`,
              },
            },
            '0.0.3': {
              name: plan.packageName,
              version: '0.0.3',
              os: [plan.platform],
              cpu: [plan.arch],
              bin: {
                'codeinsights-native-search': `bin/${plan.binaryName}`,
              },
            },
          },
        },
      ]),
    )

    expect(validateNativeSearchOptionalPackagePublication({
      registryMetadata,
      expectedPackageVersions: expectedVersions,
    })).toEqual({
      published: true,
      expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      publishedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      missingPackages: [],
      invalidPackages: [],
      unavailablePackages: [],
    })

    const invalidPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]
    if (!invalidPackage) throw new Error('native search optional package plan should exist')
    expect(validateNativeSearchOptionalPackagePublication({
      registryMetadata: {
        ...registryMetadata,
        [invalidPackage.packageName]: createRegistryPackument(invalidPackage.packageName, {
          version: '0.0.4',
          os: [invalidPackage.platform],
          cpu: [invalidPackage.arch],
          bin: {
            'codeinsights-native-search': `bin/${invalidPackage.binaryName}`,
          },
        }),
      },
      expectedPackageVersions: expectedVersions,
    })).toEqual(expect.objectContaining({
      published: false,
      invalidPackages: [invalidPackage.packageName],
    }))
  })

  test('registry 发布元数据拒绝 missing latest、path-like bin 与网络不可验证包', () => {
    const packageName = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]?.packageName
    if (!packageName) throw new Error('native search optional package plan should exist')

    expect(validateNativeSearchOptionalPackagePublication({
      registryMetadata: {
        [packageName]: {
          name: packageName,
          'dist-tags': {},
          versions: {},
        },
      },
      unavailablePackages: [NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[1]?.packageName ?? 'missing'],
    })).toEqual(expect.objectContaining({
      published: false,
      publishedPackages: [],
      missingPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS
        .map((plan) => plan.packageName)
        .filter((name) => name !== packageName && name !== NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[1]?.packageName),
      invalidPackages: [packageName],
      unavailablePackages: [NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[1]?.packageName ?? 'missing'],
    }))

    const plan = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]
    if (!plan) throw new Error('native search optional package plan should exist')
    expect(validateNativeSearchOptionalPackagePublication({
      registryMetadata: {
        [plan.packageName]: createRegistryPackument(plan.packageName, {
          version: '0.0.3',
          os: [plan.platform],
          cpu: [plan.arch],
          bin: {
            'codeinsights-native-search': '/Users/demo/codeinsights-native-search',
          },
        }),
      },
    }).invalidPackages).toEqual([plan.packageName])
  })

  test('校验 optional package publish target：404 目标可发布但仍需版本一致', () => {
    const result = validateNativeSearchOptionalPackagePublishTarget({
      packageVersion: '0.0.3',
      registryChecked: true,
      registryMetadata: {},
      cargoVersion: '0.0.3',
      binaryVersion: '0.0.3',
    })

    expect(result).toEqual({
      checked: true,
      ready: true,
      packageVersion: '0.0.3',
      blockers: [],
      expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      availablePackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      publishedVersionCollisionPackages: [],
      invalidPackages: [],
      unavailablePackages: [],
      nativeSearchVersionConsistencyVerified: true,
      nativeSearchCargoVersion: '0.0.3',
      nativeSearchBinaryVersion: '0.0.3',
      plannedOptionalPackageManifestsVerified: true,
    })
  })

  test('校验 optional package publish target 必须显式 registry check 且版本必须合法', () => {
    expect(validateNativeSearchOptionalPackagePublishTarget({
      packageVersion: '',
      registryChecked: false,
      cargoVersion: '0.0.3',
      binaryVersion: '0.0.3',
    })).toEqual(expect.objectContaining({
      checked: false,
      ready: false,
      packageVersion: null,
      blockers: [
        'publish_target_version_required',
        'registry_check_required',
        'native_search_cargo_version_mismatch',
        'native_search_binary_version_mismatch',
      ],
      plannedOptionalPackageManifestsVerified: false,
    }))

    expect(validateNativeSearchOptionalPackagePublishTarget({
      packageVersion: '0.0.3-dev',
      registryChecked: true,
      registryMetadata: {},
      cargoVersion: '0.0.3',
      binaryVersion: '0.0.3',
    })).toEqual(expect.objectContaining({
      ready: false,
      packageVersion: '0.0.3-dev',
      blockers: [
        'publish_target_version_invalid',
        'native_search_cargo_version_mismatch',
        'native_search_binary_version_mismatch',
      ],
      plannedOptionalPackageManifestsVerified: false,
    }))
  })

  test('校验 optional package publish target 拒绝已存在目标版本和无效 registry metadata', () => {
    const collisionPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]
    const invalidPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[1]
    const unavailablePackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[2]
    const availablePackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[3]
    if (!collisionPackage || !invalidPackage || !unavailablePackage || !availablePackage) {
      throw new Error('native search optional package plan should include packages')
    }

    const result = validateNativeSearchOptionalPackagePublishTarget({
      packageVersion: '0.0.3',
      registryChecked: true,
      registryMetadata: {
        [collisionPackage.packageName]: createRegistryPackument(collisionPackage.packageName, {
          version: '0.0.3',
          os: [collisionPackage.platform],
          cpu: [collisionPackage.arch],
          bin: {
            'codeinsights-native-search': `bin/${collisionPackage.binaryName}`,
          },
        }),
        [invalidPackage.packageName]: {
          name: invalidPackage.packageName,
          versions: 'not-a-record',
        },
      },
      unavailablePackages: [unavailablePackage.packageName],
      cargoVersion: '0.0.3',
      binaryVersion: '0.0.3',
    })

    expect(result.ready).toBe(false)
    expect(result.availablePackages).toEqual([availablePackage.packageName])
    expect(result.publishedVersionCollisionPackages).toEqual([collisionPackage.packageName])
    expect(result.invalidPackages).toEqual([invalidPackage.packageName])
    expect(result.unavailablePackages).toEqual([unavailablePackage.packageName])
    expect(result.blockers).toEqual([
      'registry_unavailable',
      'publish_target_version_already_exists',
      'publish_target_package_metadata_invalid',
    ])
  })

  test('校验 optional package publish target 捕获 native source 版本不一致和 dev binary', () => {
    const result = validateNativeSearchOptionalPackagePublishTarget({
      packageVersion: '0.0.3',
      registryChecked: true,
      registryMetadata: {},
      cargoVersion: '0.0.3',
      binaryVersion: '0.0.3-dev',
    })

    expect(result.ready).toBe(false)
    expect(result.nativeSearchVersionConsistencyVerified).toBe(false)
    expect(result.nativeSearchCargoVersion).toBe('0.0.3')
    expect(result.nativeSearchBinaryVersion).toBe('0.0.3-dev')
    expect(result.blockers).toEqual(['native_search_binary_version_not_release_ready'])
    expect(JSON.stringify(result)).not.toContain('/Users/')
    expect(JSON.stringify(result)).not.toContain('binaryPath')
  })

  test('校验 optional package source manifest 与 publish-ready package.json 形状', () => {
    const packageSources = Object.fromEntries(
      NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => [
        plan.packageName,
        createOptionalPackageSourceFixture(plan, '0.0.3'),
      ]),
    )

    expect(validateNativeSearchOptionalPackageSources({
      packageVersion: '0.0.3',
      packageSources,
    })).toEqual({
      checked: true,
      ready: true,
      packageVersion: '0.0.3',
      blockers: [],
      expectedPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      readyPackages: NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName),
      missingPackages: [],
      invalidPackages: [],
      plannedOptionalPackageManifestsVerified: true,
    })
  })

  test('optional package source preflight 拒绝缺失 source、无效 package.json 与 manifest 漂移', () => {
    const missingPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]
    const invalidPackageJsonPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[1]
    const invalidManifestPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[2]
    const validPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[3]
    if (!missingPackage || !invalidPackageJsonPackage || !invalidManifestPackage || !validPackage) {
      throw new Error('native search optional package plan should include packages')
    }

    const result = validateNativeSearchOptionalPackageSources({
      packageVersion: '0.0.3',
      packageSources: {
        [invalidPackageJsonPackage.packageName]: createOptionalPackageSourceFixture(
          invalidPackageJsonPackage,
          '0.0.3',
          {
            packageJsonPatch: {
              private: true,
              files: ['bin/**/*', 'native-search-package.json'],
              publishConfig: { access: 'restricted' },
            },
          },
        ),
        [invalidManifestPackage.packageName]: createOptionalPackageSourceFixture(
          invalidManifestPackage,
          '0.0.3',
          {
            nativeSearchManifestPatch: {
              packageVersion: '0.0.4',
              binaryPath: '/Users/demo/codeinsights-native-search',
            },
          },
        ),
        [validPackage.packageName]: createOptionalPackageSourceFixture(validPackage, '0.0.3'),
      },
    })

    expect(result.ready).toBe(false)
    expect(result.readyPackages).toEqual([validPackage.packageName])
    expect(result.missingPackages).toEqual([missingPackage.packageName])
    expect(result.invalidPackages).toEqual([
      invalidPackageJsonPackage.packageName,
      invalidManifestPackage.packageName,
    ])
    expect(result.blockers).toEqual([
      'package_source_manifest_missing',
      'package_source_package_json_invalid',
      'package_source_native_manifest_invalid',
    ])
    expect(result.plannedOptionalPackageManifestsVerified).toBe(false)
    expect(JSON.stringify(result)).not.toContain('/Users/')
    expect(JSON.stringify(result)).not.toContain('binaryPath')
  })

  test('optional package source preflight 拒绝 lifecycle scripts、运行时依赖和宽泛 files', () => {
    const scriptPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[0]
    const dependencyPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[1]
    const wildcardFilesPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[2]
    const publishScriptPackage = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS[3]
    if (!scriptPackage || !dependencyPackage || !wildcardFilesPackage || !publishScriptPackage) {
      throw new Error('native search optional package plan should include packages')
    }

    const result = validateNativeSearchOptionalPackageSources({
      packageVersion: '0.0.3',
      packageSources: {
        [scriptPackage.packageName]: createOptionalPackageSourceFixture(scriptPackage, '0.0.3', {
          packageJsonPatch: {
            scripts: {
              install: 'node ./install.js',
            },
          },
        }),
        [dependencyPackage.packageName]: createOptionalPackageSourceFixture(dependencyPackage, '0.0.3', {
          packageJsonPatch: {
            dependencies: {
              '@demo/installer': '1.0.0',
            },
          },
        }),
        [wildcardFilesPackage.packageName]: createOptionalPackageSourceFixture(wildcardFilesPackage, '0.0.3', {
          packageJsonPatch: {
            files: [
              'bin/**/*',
              'native-search-package.json',
            ],
          },
        }),
        [publishScriptPackage.packageName]: createOptionalPackageSourceFixture(publishScriptPackage, '0.0.3', {
          packageJsonPatch: {
            scripts: {
              prepublishOnly: 'node ./prepublish-only.js',
              publish: 'node ./publish.js',
              postpublish: 'node ./postpublish.js',
            },
          },
        }),
      },
    })

    expect(result.ready).toBe(false)
    expect(result.readyPackages).toEqual([])
    expect(result.invalidPackages).toEqual([
      scriptPackage.packageName,
      dependencyPackage.packageName,
      wildcardFilesPackage.packageName,
      publishScriptPackage.packageName,
    ])
    expect(result.blockers).toEqual(['package_source_package_json_invalid'])
    expect(result.plannedOptionalPackageManifestsVerified).toBe(false)
  })

  test('optional package source preflight 要求 release package version', () => {
    expect(validateNativeSearchOptionalPackageSources({
      packageVersion: undefined,
      packageSources: {},
    })).toEqual(expect.objectContaining({
      checked: true,
      ready: false,
      packageVersion: null,
      blockers: [
        'package_source_version_required',
        'package_source_manifest_missing',
      ],
      plannedOptionalPackageManifestsVerified: false,
    }))

    expect(validateNativeSearchOptionalPackageSources({
      packageVersion: '0.0.3-dev',
      packageSources: {},
    })).toEqual(expect.objectContaining({
      checked: true,
      ready: false,
      packageVersion: '0.0.3-dev',
      blockers: [
        'package_source_version_invalid',
        'package_source_manifest_missing',
      ],
      plannedOptionalPackageManifestsVerified: false,
    }))
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

  test('builder allowlist change plan 只输出审查输入，不证明 packaged binary', () => {
    const expectedPackages = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
    const requiredIncludes = [
      'node_modules/@codeinsights/native-search-darwin-arm64/**/*',
      'node_modules/@codeinsights/native-search-darwin-x64/**/*',
      'node_modules/@codeinsights/native-search-win32-x64/**/*',
      'node_modules/@codeinsights/native-search-linux-x64/**/*',
    ]
    const validation = validateNativeSearchPackagingConfig(`
files:
  - dist/**/*
  - package.json
  - "!node_modules/@codeinsights/**"
`)

    expect(buildNativeSearchPackagingConfigAllowlistChangePlan(validation)).toEqual({
      schemaVersion: 1,
      status: 'blocked',
      currentConfigVerified: false,
      approvalRequired: true,
      requiredIncludes,
      missingIncludes: requiredIncludes,
      blockingExcludes: ['!node_modules/@codeinsights/**'],
      tooBroadIncludes: [],
      removalCandidates: ['!node_modules/@codeinsights/**'],
      forbiddenIncludes: [
        'node_modules/**',
        'node_modules/**/*',
        'node_modules/@codeinsights/*',
        'node_modules/@codeinsights/**',
        'node_modules/@codeinsights/**/*',
        'node_modules/@codeinsights/native-search-*',
        'node_modules/@codeinsights/native-search-*/**/*',
      ],
      candidateReviewAction: 'prepare_builder_allowlist_change_for_review',
      candidateVerificationCommands: [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest",
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --app-node-modules-root <packaged-app-node_modules> --check-registry",
      ],
      forbiddenActions: [
        'do_not_modify_electron_builder_yml_without_approval',
        'do_not_use_broad_node_modules_include',
        'do_not_run_electron_builder_until_publication_and_install_chain_pass',
        'do_not_add_native_search_optional_dependencies_before_publication',
        'do_not_treat_allowlist_plan_as_packaging_config_verified',
        'do_not_treat_allowlist_plan_as_packaged_binary_verified',
        'do_not_enable_native_by_default_before_verified',
      ],
    })
    expect(validation.missingPackages).toEqual(expectedPackages)
  })

  test('builder allowlist change plan 对精确 per-package include 只进入 ready_for_review', () => {
    const allowedConfig = `
files:
  - dist/**/*
  - package.json
  - node_modules/@codeinsights/native-search-darwin-arm64/**/*
  - node_modules/@codeinsights/native-search-darwin-x64/**/*
  - node_modules/@codeinsights/native-search-win32-x64/**/*
  - node_modules/@codeinsights/native-search-linux-x64/**/*
`

    const validation = validateNativeSearchPackagingConfig(allowedConfig)
    const plan = buildNativeSearchPackagingConfigAllowlistChangePlan(validation)

    expect(validation.verified).toBe(true)
    expect(plan.status).toBe('ready_for_review')
    expect(plan.currentConfigVerified).toBe(true)
    expect(plan.approvalRequired).toBe(true)
    expect(plan.missingIncludes).toEqual([])
    expect(plan.blockingExcludes).toEqual([])
    expect(plan.tooBroadIncludes).toEqual([])
    expect(plan.removalCandidates).toEqual([])
    expect(plan.forbiddenActions).toContain('do_not_treat_allowlist_plan_as_packaged_binary_verified')
    expect(JSON.stringify(plan)).not.toContain('/Users/')
    expect(JSON.stringify(plan)).not.toContain('binaryPath')
  })

  test('builder allowlist change plan 对矛盾 validation 输入保持 blocked', () => {
    const expectedPackages = NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS.map((plan) => plan.packageName)
    const plan = buildNativeSearchPackagingConfigAllowlistChangePlan({
      verified: false,
      expectedPackages,
      includedPackages: expectedPackages,
      missingPackages: [],
      blockingExcludes: [],
      tooBroadIncludes: [],
    })

    expect(plan.status).toBe('blocked')
    expect(plan.currentConfigVerified).toBe(false)
    expect(plan.missingIncludes).toEqual([])
    expect(plan.removalCandidates).toEqual([])
    expect(plan.forbiddenActions).toContain('do_not_treat_allowlist_plan_as_packaging_config_verified')
  })

  test('builder allowlist change plan 保守拒绝宽泛 include', () => {
    const validation = validateNativeSearchPackagingConfig(`
files:
  - node_modules/@codeinsights/native-search-*/**/*
`)
    const plan = buildNativeSearchPackagingConfigAllowlistChangePlan(validation)

    expect(plan.status).toBe('blocked')
    expect(plan.tooBroadIncludes).toEqual(['node_modules/@codeinsights/native-search-*/**/*'])
    expect(plan.removalCandidates).toEqual(['node_modules/@codeinsights/native-search-*/**/*'])
    expect(plan.forbiddenIncludes).toContain('node_modules/@codeinsights/native-search-*/**/*')
    expect(plan.currentConfigVerified).toBe(false)
  })

  test('optional package execution plan 在 source / publish target ready 后只允许进入真实发布阶段', () => {
    const plan = buildNativeSearchOptionalPackageExecutionPlan({
      optionalPackagePublishTargetChecked: true,
      optionalPackagePublishTargetReady: true,
      optionalPackageSourceChecked: true,
      optionalPackageSourceReady: true,
      optionalPackagesPublished: false,
      optionalDependenciesDeclared: false,
      optionalDependenciesInstallChainVerified: false,
      packagingConfigVerified: false,
      bundledBinaryVerified: false,
      defaultEnableRiskReviewCompleted: false,
    })

    expect(plan).toEqual({
      schemaVersion: 1,
      nextStage: 'optional_package_publication',
      completedPrerequisites: [
        'publish_target_preflight',
        'package_source_preflight',
      ],
      observedEvidenceStages: [
        'publish_target_preflight',
        'package_source_preflight',
      ],
      blockedBy: [
        'optional_packages_not_published',
        'optional_dependencies_not_declared',
        'optional_package_install_chain_not_verified',
        'packaging_config_not_verified',
        'packaged_app_bundled_binary_not_verified',
        'default_enable_risk_review_not_completed',
      ],
      readyForPublication: true,
      readyForOptionalDependencies: false,
      readyForInstallChain: false,
      readyForPackagingConfigChange: false,
      readyForPackagedBundledBinarySmoke: false,
      readyForDefaultEnableRiskReview: false,
      verified: false,
      nextAllowedActions: ['publish_optional_packages_after_release_approval'],
      candidateCommands: [
        "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest --check-registry",
      ],
      forbiddenActions: [
        'do_not_treat_publish_target_ready_as_package_published',
        'do_not_treat_package_source_ready_as_npm_pack_or_publication',
        'do_not_declare_optional_dependencies_before_publication',
        'do_not_run_install_chain_before_optional_dependencies_are_declared',
        'do_not_modify_electron_builder_yml_without_approval',
        'do_not_use_temporary_fixture_as_real_packaged_binary_evidence',
        'do_not_enable_native_by_default_before_verified',
      ],
    })
  })

  test('optional package execution plan 保持顺序 gate，不允许单项 evidence 跳过前置阶段', () => {
    const plan = buildNativeSearchOptionalPackageExecutionPlan({
      optionalPackagePublishTargetChecked: false,
      optionalPackagePublishTargetReady: true,
      optionalPackageSourceChecked: true,
      optionalPackageSourceReady: true,
      optionalPackagesPublished: false,
      optionalDependenciesDeclared: true,
      optionalDependenciesInstallChainVerified: true,
      packagingConfigVerified: true,
      bundledBinaryVerified: true,
      defaultEnableRiskReviewCompleted: true,
    })

    expect(plan.nextStage).toBe('publish_target_preflight')
    expect(plan.readyForPublication).toBe(false)
    expect(plan.readyForOptionalDependencies).toBe(false)
    expect(plan.readyForInstallChain).toBe(false)
    expect(plan.readyForPackagedBundledBinarySmoke).toBe(false)
    expect(plan.readyForDefaultEnableRiskReview).toBe(false)
    expect(plan.verified).toBe(false)
    expect(plan.completedPrerequisites).toEqual([])
    expect(plan.observedEvidenceStages).toEqual([
      'package_source_preflight',
      'optional_dependencies_declaration',
      'optional_package_install_chain',
      'packaging_config_allowlist',
      'packaged_app_bundled_binary_smoke',
      'default_enable_risk_review',
    ])
    expect(plan.blockedBy).toContain('optional_package_publish_target_not_ready')
    expect(plan.blockedBy).toContain('optional_packages_not_published')
    expect(plan.nextAllowedActions).toEqual([
      'run_optional_package_publish_target_dry_run_with_explicit_registry_check',
    ])
    expect(plan.candidateCommands).toEqual([
      "bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version <native-search-package-version> --check-registry",
    ])
  })
})

function createRegistryPackument(
  packageName: string,
  manifest: Record<string, unknown>,
): Record<string, unknown> {
  const version = typeof manifest.version === 'string' ? manifest.version : '0.0.3'
  return {
    name: packageName,
    'dist-tags': {
      latest: version,
    },
    versions: {
      [version]: {
        name: packageName,
        ...manifest,
      },
    },
  }
}

function createOptionalPackageSourceFixture(
  plan: (typeof NATIVE_SEARCH_OPTIONAL_PACKAGE_PLANS)[number],
  packageVersion: string,
  options: {
    packageJsonPatch?: Record<string, unknown>
    nativeSearchManifestPatch?: Record<string, unknown>
  } = {},
): {
  packageJson: Record<string, unknown>
  nativeSearchPackageManifest: Record<string, unknown>
} {
  const packageJson = {
    name: plan.packageName,
    version: packageVersion,
    description: `CodeInsights native search sidecar for ${plan.platform} ${plan.arch}`,
    private: false,
    license: 'MIT',
    os: [plan.platform],
    cpu: [plan.arch],
    bin: {
      'codeinsights-native-search': `bin/${plan.binaryName}`,
    },
    files: [
      'package.json',
      'native-search-package.json',
      `bin/${plan.binaryName}`,
    ],
    publishConfig: {
      access: 'public',
    },
    ...options.packageJsonPatch,
  }

  const nativeSearchPackageManifest = {
    ...buildNativeSearchPackageManifest({
      plan,
      packageVersion,
      binarySha256: VALID_SHA256,
    }),
    ...options.nativeSearchManifestPatch,
  }

  return {
    packageJson,
    nativeSearchPackageManifest,
  }
}
