const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
import {
  isOpenClawBundledRuntimeManifest,
  type OpenClawBundledRuntimeManifest,
} from '../../src/shared/openclaw-bundled-runtime'
import { OPENCLAW_BUNDLE_DIR_NAME } from './openclaw-bundled-payload'

export const OPENCLAW_BUNDLED_MANIFEST_ENV = 'QCLAW_OPENCLAW_BUNDLED_MANIFEST'

type BundledOpenClawRuntimeArtifact = NonNullable<
  NonNullable<OpenClawBundledRuntimeManifest['artifacts']['runtime']>[number]
>

export interface BundledOpenClawDeliveryStatus {
  manifestPath: string | null
  manifest: OpenClawBundledRuntimeManifest | null
  error?: string
  platform: NodeJS.Platform
  arch: string
  defaultDeliveryMode: OpenClawBundledRuntimeManifest['defaultDeliveryMode'] | null
  targetDeliveryMode: OpenClawBundledRuntimeManifest['targetDeliveryMode'] | null
  runtimeArtifact: BundledOpenClawRuntimeArtifact | null
  runtimePath: string | null
  runtimeBinaryPath: string | null
}

interface BundledOpenClawManifestResolutionOptions {
  cwd?: string
  resourcesPath?: string
  env?: NodeJS.ProcessEnv
  exists?: (candidatePath: string) => boolean
  readFile?: (candidatePath: string) => string
}

function normalizePath(value: string): string {
  return String(value || '').trim()
}

function dedupePaths(values: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const value of values) {
    const normalized = normalizePath(value)
    if (!normalized) continue
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(normalized)
  }
  return unique
}

export function listBundledOpenClawManifestCandidates(
  options: BundledOpenClawManifestResolutionOptions = {}
): string[] {
  const env = options.env || process.env
  const overridePath = normalizePath(env[OPENCLAW_BUNDLED_MANIFEST_ENV] || '')
  const cwd = normalizePath(options.cwd || process.cwd())
  const resourcesPath = normalizePath(options.resourcesPath || process.resourcesPath || '')

  const bundleRoots = dedupePaths([
    resourcesPath ? path.join(resourcesPath, OPENCLAW_BUNDLE_DIR_NAME) : '',
    cwd ? path.join(cwd, 'resources', OPENCLAW_BUNDLE_DIR_NAME) : '',
    cwd ? path.join(cwd, OPENCLAW_BUNDLE_DIR_NAME) : '',
  ])

  return dedupePaths([
    overridePath,
    ...bundleRoots.map((root) => path.join(root, 'manifest.json')),
  ])
}

export function resolveBundledOpenClawManifestPath(
  options: BundledOpenClawManifestResolutionOptions = {}
): string | null {
  const exists = options.exists || ((candidatePath: string) => fs.existsSync(candidatePath))
  for (const candidate of listBundledOpenClawManifestCandidates(options)) {
    try {
      if (exists(candidate)) return candidate
    } catch {
      // Ignore invalid candidate paths and continue probing.
    }
  }
  return null
}

export function readBundledOpenClawManifest(
  options: BundledOpenClawManifestResolutionOptions = {}
): {
  manifestPath: string | null
  manifest: OpenClawBundledRuntimeManifest | null
  error?: string
} {
  const manifestPath = resolveBundledOpenClawManifestPath(options)
  if (!manifestPath) {
    return {
      manifestPath: null,
      manifest: null,
    }
  }

  const readFile =
    options.readFile ||
    ((candidatePath: string) => fs.readFileSync(candidatePath, 'utf8'))

  try {
    const parsed = JSON.parse(readFile(manifestPath)) as unknown
    if (!isOpenClawBundledRuntimeManifest(parsed)) {
      return {
        manifestPath,
        manifest: null,
        error: `Bundled OpenClaw manifest is invalid: ${manifestPath}`,
      }
    }
    return {
      manifestPath,
      manifest: parsed,
    }
  } catch (error) {
    return {
      manifestPath,
      manifest: null,
      error: error instanceof Error ? error.message : String(error || 'Unknown error'),
    }
  }
}

export function findBundledOpenClawRuntimeArtifact(
  manifest: OpenClawBundledRuntimeManifest | null | undefined,
  options: {
    platform?: NodeJS.Platform
    arch?: string
  } = {}
): BundledOpenClawRuntimeArtifact | null {
  if (!manifest?.artifacts?.runtime || manifest.artifacts.runtime.length === 0) {
    return null
  }

  const platform = options.platform || process.platform
  const arch = String(options.arch || process.arch).trim()
  return (
    manifest.artifacts.runtime.find(
      (item) => item.platform === platform && String(item.arch || '').trim() === arch
    ) || null
  )
}

export function resolveBundledOpenClawRuntimeArtifactPath(options: {
  manifestPath: string | null | undefined
  manifest: OpenClawBundledRuntimeManifest | null | undefined
  platform?: NodeJS.Platform
  arch?: string
  exists?: (candidatePath: string) => boolean
}): string | null {
  const manifestPath = normalizePath(options.manifestPath || '')
  if (!manifestPath) return null

  const runtimeArtifact = findBundledOpenClawRuntimeArtifact(options.manifest, {
    platform: options.platform,
    arch: options.arch,
  })
  if (!runtimeArtifact) return null

  const bundleRoot = path.dirname(manifestPath)
  const runtimePath = path.join(bundleRoot, 'runtime', runtimeArtifact.directoryName)
  const exists = options.exists || ((candidatePath: string) => fs.existsSync(candidatePath))
  try {
    return exists(runtimePath) ? runtimePath : null
  } catch {
    return null
  }
}

export function listBundledOpenClawRuntimeBinaryCandidates(options: {
  runtimePath: string | null | undefined
  platform?: NodeJS.Platform
}): string[] {
  const runtimePath = normalizePath(options.runtimePath || '')
  if (!runtimePath) return []

  const platform = options.platform || process.platform
  if (platform === 'win32') {
    return [
      path.join(runtimePath, 'openclaw.cmd'),
      path.join(runtimePath, 'openclaw.ps1'),
      path.join(runtimePath, 'openclaw'),
      path.join(runtimePath, 'bin', 'openclaw.cmd'),
      path.join(runtimePath, 'bin', 'openclaw.ps1'),
      path.join(runtimePath, 'bin', 'openclaw'),
    ]
  }

  return [
    path.join(runtimePath, 'openclaw'),
    path.join(runtimePath, 'bin', 'openclaw'),
  ]
}

export function resolveBundledOpenClawRuntimeBinaryPath(options: {
  runtimePath: string | null | undefined
  platform?: NodeJS.Platform
  exists?: (candidatePath: string) => boolean
}): string | null {
  const exists = options.exists || ((candidatePath: string) => fs.existsSync(candidatePath))
  for (const candidatePath of listBundledOpenClawRuntimeBinaryCandidates(options)) {
    try {
      if (exists(candidatePath)) return candidatePath
    } catch {
      // Ignore invalid candidate paths and continue probing.
    }
  }
  return null
}

export function inspectBundledOpenClawDeliveryStatus(
  options: BundledOpenClawManifestResolutionOptions & {
    platform?: NodeJS.Platform
    arch?: string
  } = {}
): BundledOpenClawDeliveryStatus {
  const platform = options.platform || process.platform
  const arch = String(options.arch || process.arch).trim()
  const manifestResult = readBundledOpenClawManifest(options)
  const runtimeArtifact = findBundledOpenClawRuntimeArtifact(manifestResult.manifest, {
    platform,
    arch,
  })
  const runtimePath = resolveBundledOpenClawRuntimeArtifactPath({
    manifestPath: manifestResult.manifestPath,
    manifest: manifestResult.manifest,
    platform,
    arch,
    exists: options.exists,
  })
  const runtimeBinaryPath = resolveBundledOpenClawRuntimeBinaryPath({
    runtimePath,
    platform,
    exists: options.exists,
  })

  return {
    manifestPath: manifestResult.manifestPath,
    manifest: manifestResult.manifest,
    ...(manifestResult.error ? { error: manifestResult.error } : {}),
    platform,
    arch,
    defaultDeliveryMode: manifestResult.manifest?.defaultDeliveryMode || null,
    targetDeliveryMode: manifestResult.manifest?.targetDeliveryMode || null,
    runtimeArtifact,
    runtimePath,
    runtimeBinaryPath,
  }
}
