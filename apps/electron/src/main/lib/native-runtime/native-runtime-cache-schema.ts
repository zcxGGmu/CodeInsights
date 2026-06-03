import type { NativeRuntimeError } from '@codeinsights/shared'
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getConfigDir } from '../config-paths'
import {
  NATIVE_RUNTIME_CACHE_SCHEMA_VERSION,
  NATIVE_RUNTIME_PROTOCOL_VERSION,
  redactNativeRuntimeText,
} from './native-runtime-diagnostics'

const NATIVE_RUNTIME_CACHE_DIR_NAME = 'native-cache'
const NATIVE_RUNTIME_CACHE_MANIFEST_FILE = 'manifest.json'

export interface NativeRuntimePackagePlan {
  packageName: string
  platform: NodeJS.Platform
  arch: NodeJS.Architecture
  binaryName: string
}

export interface NativeRuntimeCacheManifest {
  schemaVersion: number
  protocolVersion: number
  implementation: 'rust-sidecar'
  cacheKind: 'search'
  packagePlan?: NativeRuntimePackagePlan
  createdAt: string
  updatedAt: string
}

export type NativeRuntimeCacheManifestReadResult =
  | { ok: true; manifest: NativeRuntimeCacheManifest }
  | { ok: false; error: NativeRuntimeError }

interface BuildNativeRuntimeCacheManifestOptions {
  packagePlan?: NativeRuntimePackagePlan
  now?: Date
}

export function getNativeRuntimeCacheDir(): string {
  return join(getConfigDir(), NATIVE_RUNTIME_CACHE_DIR_NAME)
}

export function getNativeRuntimeCacheManifestPath(): string {
  return join(getNativeRuntimeCacheDir(), NATIVE_RUNTIME_CACHE_MANIFEST_FILE)
}

export function buildNativeRuntimeCacheManifest(
  options: BuildNativeRuntimeCacheManifestOptions = {},
): NativeRuntimeCacheManifest {
  const timestamp = (options.now ?? new Date()).toISOString()
  return {
    schemaVersion: NATIVE_RUNTIME_CACHE_SCHEMA_VERSION,
    protocolVersion: NATIVE_RUNTIME_PROTOCOL_VERSION,
    implementation: 'rust-sidecar',
    cacheKind: 'search',
    ...(options.packagePlan ? { packagePlan: options.packagePlan } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function writeNativeRuntimeCacheManifest(manifest: NativeRuntimeCacheManifest): void {
  const cacheDir = getNativeRuntimeCacheDir()
  ensureSafeNativeRuntimeCacheDir(cacheDir)
  const safeManifest = normalizeNativeRuntimeCacheManifest(manifest)
  writeFileSync(getNativeRuntimeCacheManifestPath(), `${JSON.stringify(safeManifest, null, 2)}\n`, 'utf-8')
}

export function readNativeRuntimeCacheManifest(): NativeRuntimeCacheManifestReadResult {
  const manifestPath = getNativeRuntimeCacheManifestPath()
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      error: {
        code: 'cache_corrupted',
        message: 'native-cache manifest 不存在',
        recoverable: true,
      },
    }
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf-8')) as unknown
    if (!isNativeRuntimeCacheManifest(parsed)) {
      return {
        ok: false,
        error: {
          code: 'cache_corrupted',
          message: 'native-cache manifest schema 不兼容',
          recoverable: true,
        },
      }
    }
    return { ok: true, manifest: parsed }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'cache_corrupted',
        message: redactNativeRuntimeText(error instanceof Error ? error.message : 'native-cache manifest 读取失败'),
        recoverable: true,
      },
    }
  }
}

function isNativeRuntimeCacheManifest(value: unknown): value is NativeRuntimeCacheManifest {
  if (!isRecord(value)) return false
  if (hasUnsafePathLikeKey(value)) return false
  if (value.schemaVersion !== NATIVE_RUNTIME_CACHE_SCHEMA_VERSION) return false
  if (value.protocolVersion !== NATIVE_RUNTIME_PROTOCOL_VERSION) return false
  if (value.implementation !== 'rust-sidecar') return false
  if (value.cacheKind !== 'search') return false
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false
  if (value.packagePlan !== undefined && !isNativeRuntimePackagePlan(value.packagePlan)) return false
  return true
}

function isNativeRuntimePackagePlan(value: unknown): value is NativeRuntimePackagePlan {
  if (!isRecord(value)) return false
  if (hasUnsafePathLikeKey(value)) return false
  return typeof value.packageName === 'string'
    && typeof value.platform === 'string'
    && typeof value.arch === 'string'
    && typeof value.binaryName === 'string'
    && !('binaryPath' in value)
}

function normalizeNativeRuntimeCacheManifest(manifest: NativeRuntimeCacheManifest): NativeRuntimeCacheManifest {
  const normalized = buildNativeRuntimeCacheManifest({
    ...(manifest.packagePlan ? {
      packagePlan: {
        packageName: manifest.packagePlan.packageName,
        platform: manifest.packagePlan.platform,
        arch: manifest.packagePlan.arch,
        binaryName: manifest.packagePlan.binaryName,
      },
    } : {}),
  })

  return {
    ...normalized,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
  }
}

function ensureSafeNativeRuntimeCacheDir(cacheDir: string): void {
  const configDir = getConfigDir()

  if (existsSync(cacheDir)) {
    const cacheStat = lstatSync(cacheDir)
    if (cacheStat.isSymbolicLink()) {
      throw new Error('native-cache 目录不安全：拒绝 symlink')
    }
  } else {
    mkdirSync(cacheDir, { recursive: true })
  }

  const realConfigDir = realpathSync(configDir)
  const realCacheDir = realpathSync(cacheDir)
  if (realCacheDir !== realConfigDir && !realCacheDir.startsWith(`${realConfigDir}/`)) {
    throw new Error('native-cache 目录不安全：不在配置目录内')
  }
}

function hasUnsafePathLikeKey(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => {
    const normalized = key.toLowerCase()
    return normalized === 'binarypath'
      || normalized === 'path'
      || normalized.endsWith('path')
      || normalized === 'homedir'
      || normalized === 'homepath'
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
