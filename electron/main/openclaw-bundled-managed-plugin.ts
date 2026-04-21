const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

import { OPENCLAW_BUNDLE_DIR_NAME } from './openclaw-bundled-payload'

export const OPENCLAW_BUNDLED_MANAGED_PLUGIN_DIR_NAME = 'managed-plugins'
export const OPENCLAW_BUNDLED_MANAGED_PLUGIN_MANIFEST = 'openclaw.plugin.json'

interface BundledManagedPluginResolutionOptions {
  pluginId: string
  cwd?: string
  resourcesPath?: string
  exists?: (candidatePath: string) => boolean
}

interface MaterializeBundledManagedPluginOptions extends BundledManagedPluginResolutionOptions {
  targetPath: string
  mkdir?: (targetPath: string, options: { recursive?: boolean }) => Promise<void>
  copy?: (
    sourcePath: string,
    targetPath: string,
    options: {
      recursive?: boolean
      force?: boolean
      errorOnExist?: boolean
    }
  ) => Promise<void>
  remove?: (
    targetPath: string,
    options: {
      recursive?: boolean
      force?: boolean
    }
  ) => Promise<void>
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

export function listBundledManagedPluginDirectoryCandidates(
  options: BundledManagedPluginResolutionOptions
): string[] {
  const pluginId = normalizePath(options.pluginId)
  const cwd = normalizePath(options.cwd || process.cwd())
  const resourcesPath = normalizePath(options.resourcesPath || process.resourcesPath || '')

  const bundleRoots = dedupePaths([
    resourcesPath ? path.join(resourcesPath, OPENCLAW_BUNDLE_DIR_NAME) : '',
    cwd ? path.join(cwd, 'resources', OPENCLAW_BUNDLE_DIR_NAME) : '',
    cwd ? path.join(cwd, OPENCLAW_BUNDLE_DIR_NAME) : '',
  ])

  return dedupePaths(
    bundleRoots.map((root) =>
      path.join(root, OPENCLAW_BUNDLED_MANAGED_PLUGIN_DIR_NAME, pluginId)
    )
  )
}

export function resolveBundledManagedPluginSourcePath(
  options: BundledManagedPluginResolutionOptions
): string | null {
  const exists = options.exists || ((candidatePath: string) => fs.existsSync(candidatePath))
  for (const candidate of listBundledManagedPluginDirectoryCandidates(options)) {
    try {
      if (exists(path.join(candidate, OPENCLAW_BUNDLED_MANAGED_PLUGIN_MANIFEST))) {
        return candidate
      }
    } catch {
      // Ignore invalid candidate paths and continue probing.
    }
  }
  return null
}

export async function materializeBundledManagedPlugin(
  options: MaterializeBundledManagedPluginOptions
): Promise<{
  ok: boolean
  copied: boolean
  sourcePath: string | null
  targetPath: string
  error?: string
}> {
  const sourcePath = resolveBundledManagedPluginSourcePath(options)
  const targetPath = normalizePath(options.targetPath)
  if (!sourcePath || !targetPath) {
    return {
      ok: false,
      copied: false,
      sourcePath: sourcePath || null,
      targetPath,
      error: !targetPath ? 'Bundled plugin target path is empty.' : 'Bundled plugin source was not found.',
    }
  }

  const mkdir =
    options.mkdir ||
    ((candidatePath: string, mkdirOptions: { recursive?: boolean }) =>
      fs.promises.mkdir(candidatePath, mkdirOptions))
  const copy =
    options.copy ||
    ((
      sourceDir: string,
      targetDir: string,
      copyOptions: { recursive?: boolean; force?: boolean; errorOnExist?: boolean }
    ) => fs.promises.cp(sourceDir, targetDir, copyOptions))
  const remove =
    options.remove ||
    ((candidatePath: string, removeOptions: { recursive?: boolean; force?: boolean }) =>
      fs.promises.rm(candidatePath, removeOptions))

  try {
    await mkdir(path.dirname(targetPath), { recursive: true })
    await remove(targetPath, { recursive: true, force: true })
    await copy(sourcePath, targetPath, {
      recursive: true,
      force: true,
      errorOnExist: false,
    })
    return {
      ok: true,
      copied: true,
      sourcePath,
      targetPath,
    }
  } catch (error) {
    return {
      ok: false,
      copied: false,
      sourcePath,
      targetPath,
      error: error instanceof Error ? error.message : String(error || 'Unknown error'),
    }
  }
}
