const path = process.getBuiltinModule('node:path') as typeof import('node:path')

import type { BundledOpenClawInstallPlan } from './openclaw-bundled-plan'

export interface BundledOpenClawWindowsTargetLayout {
  prefixDir: string
  binaryTargets: string[]
  nodeTarget: string
  packageRootTarget: string
}

export interface BundledOpenClawWindowsExecutionPlan {
  ok: boolean
  reason?:
    | 'not-windows'
    | 'wrong-source'
    | 'missing-runtime-root'
    | 'missing-runtime-binary'
    | 'unsafe-prefix'
  runtimeRoot: string | null
  runtimeBinaryPath: string | null
  targetLayout: BundledOpenClawWindowsTargetLayout | null
}

export interface BundledOpenClawWindowsSourceLayout {
  runtimeRoot: string
  binarySources: string[]
  nodeSource: string | null
  packageRootSource: string
  packageManifestSource: string
}

export interface BundledOpenClawWindowsCopyPlan {
  runtimeRoot: string
  targetLayout: BundledOpenClawWindowsTargetLayout
  binaryCopies: Array<{
    sourcePath: string
    targetPath: string
  }>
  nodeCopy: {
    sourcePath: string
    targetPath: string
  } | null
  packageRootSource: string
  packageRootTarget: string
}

export interface BundledOpenClawWindowsRuntimeValidationResult {
  ok: boolean
  binaryPath: string | null
  nodePath: string
  packageManifestPath: string
  errors: string[]
}

function normalizePath(value: string): string {
  return String(value || '').trim()
}

function normalizeCompare(value: string): string {
  return normalizePath(value).replace(/\//g, '\\').toLowerCase()
}

export function resolveBundledOpenClawWindowsPrefixDir(env: NodeJS.ProcessEnv = process.env): string {
  const appData = normalizePath(env.APPDATA || '')
  if (appData) return path.join(appData, 'npm')

  const userProfile = normalizePath(env.USERPROFILE || '')
  if (userProfile) return path.join(userProfile, 'AppData', 'Roaming', 'npm')

  return path.join(process.cwd(), '.openclaw-windows-prefix')
}

export function isSafeBundledOpenClawWindowsPrefixDir(prefixDir: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalizedPrefix = normalizeCompare(prefixDir)
  if (!normalizedPrefix) return false

  const allowedRoots = [
    normalizePath(env.APPDATA || '') ? path.join(String(env.APPDATA), 'npm') : '',
    normalizePath(env.USERPROFILE || '') ? path.join(String(env.USERPROFILE), 'AppData', 'Roaming', 'npm') : '',
  ]
    .map((value) => normalizeCompare(value))
    .filter(Boolean)

  return allowedRoots.includes(normalizedPrefix)
}

export function buildBundledOpenClawWindowsTargetLayout(
  prefixDir: string
): BundledOpenClawWindowsTargetLayout {
  return {
    prefixDir,
    binaryTargets: [
      path.join(prefixDir, 'openclaw.cmd'),
      path.join(prefixDir, 'openclaw.ps1'),
      path.join(prefixDir, 'openclaw'),
    ],
    nodeTarget: path.join(prefixDir, 'node.exe'),
    packageRootTarget: path.join(prefixDir, 'node_modules', 'openclaw'),
  }
}

export function inspectBundledOpenClawWindowsSourceLayout(
  executionPlan: BundledOpenClawWindowsExecutionPlan,
  exists: (candidatePath: string) => boolean
): BundledOpenClawWindowsSourceLayout | null {
  if (!executionPlan.ok || !executionPlan.runtimeRoot || !executionPlan.targetLayout) {
    return null
  }

  const runtimeRoot = executionPlan.runtimeRoot
  const binarySources = [
    path.join(runtimeRoot, 'openclaw.cmd'),
    path.join(runtimeRoot, 'openclaw.ps1'),
    path.join(runtimeRoot, 'openclaw'),
  ].filter((candidatePath) => {
    try {
      return exists(candidatePath)
    } catch {
      return false
    }
  })
  const nodeSource = path.join(runtimeRoot, 'node.exe')
  const hasNodeSource = (() => {
    try {
      return exists(nodeSource)
    } catch {
      return false
    }
  })()

  const packageRootSource = path.join(runtimeRoot, 'node_modules', 'openclaw')
  const packageManifestSource = path.join(packageRootSource, 'package.json')
  try {
    if (!exists(packageManifestSource)) return null
  } catch {
    return null
  }

  if (binarySources.length === 0) {
    return null
  }

  return {
    runtimeRoot,
    binarySources,
    nodeSource: hasNodeSource ? nodeSource : null,
    packageRootSource,
    packageManifestSource,
  }
}

export function buildBundledOpenClawWindowsCopyPlan(
  executionPlan: BundledOpenClawWindowsExecutionPlan,
  sourceLayout: BundledOpenClawWindowsSourceLayout | null
): BundledOpenClawWindowsCopyPlan | null {
  if (!executionPlan.ok || !executionPlan.targetLayout || !sourceLayout) {
    return null
  }

  const binaryCopies = sourceLayout.binarySources
    .map((sourcePath) => {
      const targetPath = path.join(executionPlan.targetLayout!.prefixDir, path.basename(sourcePath))
      return { sourcePath, targetPath }
    })

  return {
    runtimeRoot: sourceLayout.runtimeRoot,
    targetLayout: executionPlan.targetLayout,
    binaryCopies,
    nodeCopy: sourceLayout.nodeSource
      ? {
          sourcePath: sourceLayout.nodeSource,
          targetPath: executionPlan.targetLayout.nodeTarget,
        }
      : null,
    packageRootSource: sourceLayout.packageRootSource,
    packageRootTarget: executionPlan.targetLayout.packageRootTarget,
  }
}

export function validateBundledOpenClawWindowsCopyPlan(
  copyPlan: BundledOpenClawWindowsCopyPlan,
  exists: (candidatePath: string) => boolean
): BundledOpenClawWindowsRuntimeValidationResult {
  const packageManifestPath = path.join(copyPlan.packageRootTarget, 'package.json')
  const nodePath = copyPlan.targetLayout.nodeTarget
  const errors: string[] = []

  let binaryPath =
    copyPlan.binaryCopies.find((item) => /\.cmd$/i.test(item.targetPath))?.targetPath ||
    copyPlan.binaryCopies[0]?.targetPath ||
    null

  if (!binaryPath) {
    errors.push('missing target runtime binary path')
  } else {
    try {
      if (!exists(binaryPath)) {
        errors.push(`missing target runtime binary: ${binaryPath}`)
      }
    } catch {
      errors.push(`failed to inspect target runtime binary: ${binaryPath}`)
    }
  }

  try {
    if (!exists(packageManifestPath)) {
      errors.push(`missing target package manifest: ${packageManifestPath}`)
    }
  } catch {
    errors.push(`failed to inspect target package manifest: ${packageManifestPath}`)
  }

  if (copyPlan.nodeCopy) {
    try {
      if (!exists(nodePath)) {
        errors.push(`missing target node runtime: ${nodePath}`)
      }
    } catch {
      errors.push(`failed to inspect target node runtime: ${nodePath}`)
    }
  }

  return {
    ok: errors.length === 0,
    binaryPath,
    nodePath,
    packageManifestPath,
    errors,
  }
}

export function resolveBundledOpenClawWindowsExecutionPlan(
  installPlan: BundledOpenClawInstallPlan,
  env: NodeJS.ProcessEnv = process.env
): BundledOpenClawWindowsExecutionPlan {
  if (installPlan.platform !== 'win32') {
    return {
      ok: false,
      reason: 'not-windows',
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

  const prefixDir = resolveBundledOpenClawWindowsPrefixDir(env)
  if (!isSafeBundledOpenClawWindowsPrefixDir(prefixDir, env)) {
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
    targetLayout: buildBundledOpenClawWindowsTargetLayout(prefixDir),
  }
}
