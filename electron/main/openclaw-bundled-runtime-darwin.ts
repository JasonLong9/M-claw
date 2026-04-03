const path = process.getBuiltinModule('node:path') as typeof import('node:path')

import type { BundledOpenClawInstallPlan } from './openclaw-bundled-plan'

export interface BundledOpenClawDarwinTargetLayout {
  prefixDir: string
  binaryTarget: string
  packageRootTarget: string
}

export interface BundledOpenClawDarwinExecutionPlan {
  ok: boolean
  reason?:
    | 'not-darwin'
    | 'wrong-source'
    | 'missing-runtime-root'
    | 'missing-runtime-binary'
    | 'unsafe-prefix'
  runtimeRoot: string | null
  runtimeBinaryPath: string | null
  targetLayout: BundledOpenClawDarwinTargetLayout | null
}

export interface BundledOpenClawDarwinSourceLayout {
  runtimeRoot: string
  binarySource: string
  packageRootSource: string
  packageManifestSource: string
}

export interface BundledOpenClawDarwinCopyPlan {
  runtimeRoot: string
  targetLayout: BundledOpenClawDarwinTargetLayout
  binarySource: string
  binaryTarget: string
  packageRootSource: string
  packageRootTarget: string
}

export interface BundledOpenClawDarwinRuntimeValidationResult {
  ok: boolean
  binaryPath: string | null
  packageManifestPath: string
  errors: string[]
}

function normalizePath(value: string): string {
  return String(value || '').trim()
}

function normalizeCompare(value: string): string {
  return normalizePath(value).replace(/\\/g, '/').toLowerCase()
}

export function resolveBundledOpenClawDarwinPrefixDir(env: NodeJS.ProcessEnv = process.env): string {
  const homeDir = normalizePath(env.HOME || '')
  if (homeDir) return path.join(homeDir, '.openclaw-runtime', 'bin')
  return path.join(process.cwd(), '.openclaw-runtime', 'bin')
}

export function isSafeBundledOpenClawDarwinPrefixDir(prefixDir: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalizedPrefix = normalizeCompare(prefixDir)
  if (!normalizedPrefix) return false

  const allowedRoots = [
    normalizePath(env.HOME || '') ? path.join(String(env.HOME), '.openclaw-runtime', 'bin') : '',
  ]
    .map((value) => normalizeCompare(value))
    .filter(Boolean)

  return allowedRoots.includes(normalizedPrefix)
}

export function buildBundledOpenClawDarwinTargetLayout(
  prefixDir: string
): BundledOpenClawDarwinTargetLayout {
  return {
    prefixDir,
    binaryTarget: path.join(prefixDir, 'openclaw'),
    packageRootTarget: path.join(prefixDir, '..', 'node_modules', 'openclaw'),
  }
}

export function inspectBundledOpenClawDarwinSourceLayout(
  executionPlan: BundledOpenClawDarwinExecutionPlan,
  exists: (candidatePath: string) => boolean
): BundledOpenClawDarwinSourceLayout | null {
  if (!executionPlan.ok || !executionPlan.runtimeRoot || !executionPlan.runtimeBinaryPath) {
    return null
  }

  const packageRootSource = path.join(executionPlan.runtimeRoot, 'node_modules', 'openclaw')
  const packageManifestSource = path.join(packageRootSource, 'package.json')

  try {
    if (!exists(executionPlan.runtimeBinaryPath)) return null
    if (!exists(packageManifestSource)) return null
  } catch {
    return null
  }

  return {
    runtimeRoot: executionPlan.runtimeRoot,
    binarySource: executionPlan.runtimeBinaryPath,
    packageRootSource,
    packageManifestSource,
  }
}

export function buildBundledOpenClawDarwinCopyPlan(
  executionPlan: BundledOpenClawDarwinExecutionPlan,
  sourceLayout: BundledOpenClawDarwinSourceLayout | null
): BundledOpenClawDarwinCopyPlan | null {
  if (!executionPlan.ok || !executionPlan.targetLayout || !sourceLayout) {
    return null
  }

  return {
    runtimeRoot: sourceLayout.runtimeRoot,
    targetLayout: executionPlan.targetLayout,
    binarySource: sourceLayout.binarySource,
    binaryTarget: executionPlan.targetLayout.binaryTarget,
    packageRootSource: sourceLayout.packageRootSource,
    packageRootTarget: executionPlan.targetLayout.packageRootTarget,
  }
}

export function validateBundledOpenClawDarwinCopyPlan(
  copyPlan: BundledOpenClawDarwinCopyPlan,
  exists: (candidatePath: string) => boolean
): BundledOpenClawDarwinRuntimeValidationResult {
  const packageManifestPath = path.join(copyPlan.packageRootTarget, 'package.json')
  const errors: string[] = []

  try {
    if (!exists(copyPlan.binaryTarget)) {
      errors.push(`missing target runtime binary: ${copyPlan.binaryTarget}`)
    }
  } catch {
    errors.push(`failed to inspect target runtime binary: ${copyPlan.binaryTarget}`)
  }

  try {
    if (!exists(packageManifestPath)) {
      errors.push(`missing target package manifest: ${packageManifestPath}`)
    }
  } catch {
    errors.push(`failed to inspect target package manifest: ${packageManifestPath}`)
  }

  return {
    ok: errors.length === 0,
    binaryPath: copyPlan.binaryTarget,
    packageManifestPath,
    errors,
  }
}

export function resolveBundledOpenClawDarwinExecutionPlan(
  installPlan: BundledOpenClawInstallPlan,
  env: NodeJS.ProcessEnv = process.env
): BundledOpenClawDarwinExecutionPlan {
  if (installPlan.platform !== 'darwin') {
    return {
      ok: false,
      reason: 'not-darwin',
      runtimeRoot: installPlan.runtimePath,
      runtimeBinaryPath: installPlan.runtimeBinaryPath,
      targetLayout: null,
    }
  }

  if (installPlan.preferredSource !== 'bundled-runtime') {
    return {
      ok: false,
      reason: 'wrong-source',
      runtimeRoot: installPlan.runtimePath,
      runtimeBinaryPath: installPlan.runtimeBinaryPath,
      targetLayout: null,
    }
  }

  const runtimeRoot = normalizePath(installPlan.runtimePath || '')
  if (!runtimeRoot) {
    return {
      ok: false,
      reason: 'missing-runtime-root',
      runtimeRoot: null,
      runtimeBinaryPath: installPlan.runtimeBinaryPath,
      targetLayout: null,
    }
  }

  const runtimeBinaryPath = normalizePath(installPlan.runtimeBinaryPath || '')
  if (!runtimeBinaryPath) {
    return {
      ok: false,
      reason: 'missing-runtime-binary',
      runtimeRoot,
      runtimeBinaryPath: null,
      targetLayout: null,
    }
  }

  const prefixDir = resolveBundledOpenClawDarwinPrefixDir(env)
  if (!isSafeBundledOpenClawDarwinPrefixDir(prefixDir, env)) {
    return {
      ok: false,
      reason: 'unsafe-prefix',
      runtimeRoot,
      runtimeBinaryPath,
      targetLayout: null,
    }
  }

  return {
    ok: true,
    runtimeRoot,
    runtimeBinaryPath,
    targetLayout: buildBundledOpenClawDarwinTargetLayout(prefixDir),
  }
}
