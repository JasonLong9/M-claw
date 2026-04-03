const path = process.getBuiltinModule('node:path') as typeof import('node:path')

export const OPENCLAW_BUNDLE_DIR_NAME = 'openclaw-bundle'
export const OPENCLAW_BUNDLED_PAYLOAD_ENV = 'QCLAW_OPENCLAW_BUNDLED_TGZ'

export interface BundledOpenClawPayloadResolutionOptions {
  version: string
  cwd?: string
  resourcesPath?: string
  env?: NodeJS.ProcessEnv
  exists?: (candidatePath: string) => boolean
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

export function listBundledOpenClawPayloadCandidates(
  options: BundledOpenClawPayloadResolutionOptions
): string[] {
  const version = normalizePath(options.version)
  const env = options.env || process.env
  const overridePath = normalizePath(env[OPENCLAW_BUNDLED_PAYLOAD_ENV] || '')
  const cwd = normalizePath(options.cwd || process.cwd())
  const resourcesPath = normalizePath(options.resourcesPath || process.resourcesPath || '')

  const candidateFileNames = dedupePaths([
    version ? `openclaw-${version}.tgz` : '',
    'openclaw.tgz',
  ])

  const bundleRoots = dedupePaths([
    resourcesPath ? path.join(resourcesPath, OPENCLAW_BUNDLE_DIR_NAME) : '',
    cwd ? path.join(cwd, 'resources', OPENCLAW_BUNDLE_DIR_NAME) : '',
    cwd ? path.join(cwd, OPENCLAW_BUNDLE_DIR_NAME) : '',
  ])

  return dedupePaths([
    overridePath,
    ...bundleRoots.flatMap((root) => candidateFileNames.map((fileName) => path.join(root, fileName))),
  ])
}

export function resolveBundledOpenClawPayloadPath(
  options: BundledOpenClawPayloadResolutionOptions
): string | null {
  const exists = options.exists || ((candidatePath: string) => false)
  for (const candidate of listBundledOpenClawPayloadCandidates(options)) {
    try {
      if (exists(candidate)) return candidate
    } catch {
      // Ignore invalid candidate paths and continue probing.
    }
  }
  return null
}
