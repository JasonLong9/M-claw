import { parseJsonFromOutput } from './openclaw-command-output'
import { resolveOpenClawBinaryPath } from './openclaw-package'
import { resolveOpenClawCommand } from './openclaw-spawn'
import {
  expandDisplayPath,
  resolveOpenClawPaths,
  resolveOpenClawPathsFromStateRoot,
  resolveUserHomeDir,
  type OpenClawPaths,
} from './openclaw-paths'
import { resolveSafeWorkingDirectory } from './runtime-working-directory'
import { inspectBundledOpenClawDeliveryStatus } from './openclaw-bundled-manifest'
import { buildCliPathWithCandidates } from './runtime-path-discovery'
const fs = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const childProcess = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const { access } = fs
const { spawn } = childProcess

export interface RuntimePathCommandResult {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
}

interface RuntimeBackupPlanAsset {
  kind?: string
  sourcePath?: string
  displayPath?: string
}

interface RuntimeBackupPlan {
  assets?: RuntimeBackupPlanAsset[]
}

interface ResolveRuntimeOpenClawPathsOptions {
  binaryPath?: string
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  cacheTtlMs?: number
  pathExists?: (targetPath: string) => Promise<boolean>
  runCommand?: (binaryPath: string, args: string[]) => Promise<RuntimePathCommandResult>
}

const DEFAULT_RUNTIME_PATH_CACHE_TTL_MS = 15_000

let cachedKey = ''
let cachedRuntimePaths: OpenClawPaths | null = null
let cachedAt = 0
let cachedProbeKey = ''
let cachedRuntimePathsPromise: Promise<OpenClawPaths> | null = null

function resolveRuntimeHomeDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv | undefined
): string {
  const fallback = resolveUserHomeDir(platform)
  return String(
    platform === 'win32'
      ? env?.USERPROFILE || env?.HOME || fallback
      : env?.HOME || env?.USERPROFILE || fallback
  ).trim() || fallback
}

function stripWrappingQuotes(value: string): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function findConfigPathLine(stdout: string): string | null {
  const lines = String(stdout || '').split(/\r?\n/g)
  const pathPattern = /((?:~|\/|[A-Za-z]:[\\/]).*openclaw\.json)\s*$/i

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = stripWrappingQuotes(lines[index])
    if (!line) continue
    const matched = line.match(pathPattern)
    if (matched?.[1]) {
      return matched[1]
    }
  }

  return null
}

function resolveFallbackPaths(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv | undefined
): OpenClawPaths {
  const envHomeDir = resolveRuntimeHomeDir(platform, env)

  return resolveOpenClawPaths({
    userHomeDir: envHomeDir,
    userDataDir: env?.QCLAW_USER_DATA_DIR,
    platform,
  })
}

function getPathModuleForPlatform(platform: NodeJS.Platform): typeof path.win32 | typeof path.posix {
  return platform === 'win32' ? path.win32 : path.posix
}

function normalizeComparablePath(inputPath: string, platform: NodeJS.Platform): string {
  const normalized = getPathModuleForPlatform(platform).normalize(String(inputPath || '').trim())
  if (!normalized) return ''
  return platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isPathEqualOrWithinDirectory(
  candidatePath: string,
  rootPath: string,
  platform: NodeJS.Platform
): boolean {
  const normalizedCandidate = normalizeComparablePath(candidatePath, platform)
  const normalizedRoot = normalizeComparablePath(rootPath, platform)
  if (!normalizedCandidate || !normalizedRoot) return false
  if (normalizedCandidate === normalizedRoot) return true
  const sep = platform === 'win32' ? '\\' : '/'
  return normalizedCandidate.startsWith(`${normalizedRoot}${sep}`)
}

function normalizeManagedStateRoot(
  stateRoot: string,
  managedRoot: string,
  platform: NodeJS.Platform
): string {
  if (!isPathEqualOrWithinDirectory(stateRoot, managedRoot, platform)) {
    return stateRoot
  }

  const pathModule = getPathModuleForPlatform(platform)
  const relative = pathModule.relative(
    pathModule.normalize(managedRoot),
    pathModule.normalize(stateRoot)
  )
  const segments = String(relative || '')
    .split(/[\\/]+/g)
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length >= 2 && segments[0] === '.openclaw' && segments[1] === '.openclaw') {
    return pathModule.join(pathModule.normalize(managedRoot), '.openclaw')
  }

  return stateRoot
}

async function defaultPathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function defaultRunCommand(
  binaryPath: string,
  args: string[],
  options: ResolveRuntimeOpenClawPathsOptions
): Promise<RuntimePathCommandResult> {
  return new Promise((resolve) => {
    const runtimeEnv = options.env || process.env
    const resolvedCommand = resolveOpenClawCommand(args, {
      platform: options.platform || process.platform,
      commandPath: binaryPath,
      env: runtimeEnv,
    })
    const proc = spawn(resolvedCommand.command, resolvedCommand.args, {
      cwd: resolveSafeWorkingDirectory({
        env: runtimeEnv,
        platform: options.platform || process.platform,
      }),
      env: runtimeEnv,
      shell: resolvedCommand.shell,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    proc.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    proc.on('error', (error) => {
      resolve({
        ok: false,
        stdout,
        stderr: error instanceof Error ? error.message : String(error),
        code: 1,
      })
    })
    proc.on('close', (code) => {
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        code,
      })
    })
  })
}

function parseRuntimeConfigPath(
  stdout: string,
  platform: NodeJS.Platform,
  userHomeDir: string
): string | null {
  const configLine = findConfigPathLine(stdout)
  if (!configLine) return null
  return expandDisplayPath(configLine, userHomeDir, platform)
}

function parseRuntimeStateRoot(
  stdout: string,
  platform: NodeJS.Platform,
  userHomeDir: string
): string | null {
  try {
    const payload = parseJsonFromOutput<RuntimeBackupPlan>(stdout)
    const stateAsset =
      (payload.assets || []).find((asset) => String(asset.kind || '').trim() === 'state') || null
    const rawPath = String(stateAsset?.sourcePath || stateAsset?.displayPath || '').trim()
    if (!rawPath) return null
    return expandDisplayPath(rawPath, userHomeDir, platform)
  } catch {
    return null
  }
}

export function resetRuntimeOpenClawPathsCache(): void {
  cachedKey = ''
  cachedRuntimePaths = null
  cachedAt = 0
  cachedProbeKey = ''
  cachedRuntimePathsPromise = null
}

export async function resolveRuntimeOpenClawPaths(
  options: ResolveRuntimeOpenClawPathsOptions = {}
): Promise<OpenClawPaths> {
  const platform = options.platform || process.platform
  const env = options.env || process.env
  const userHomeDir = resolveRuntimeHomeDir(platform, env)
  const fallback = resolveFallbackPaths(platform, env)

  const resolvedBinaryPath = String(
    options.binaryPath || (await resolveOpenClawBinaryPath({ env, platform }).catch(() => ''))
  ).trim()
  if (!resolvedBinaryPath) return fallback
  const cacheKey = `${resolvedBinaryPath}\n${userHomeDir}\n${platform}\n${fallback.homeDir}`

  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_RUNTIME_PATH_CACHE_TTL_MS
  if (
    cachedRuntimePaths &&
    cachedKey === cacheKey &&
    Date.now() - cachedAt < cacheTtlMs
  ) {
    return cachedRuntimePaths
  }

  if (cachedRuntimePathsPromise && cachedProbeKey === cacheKey) {
    return cachedRuntimePathsPromise
  }

  const managedProbeEnv: NodeJS.ProcessEnv = {
    ...env,
    OPENCLAW_HOME: String(env.OPENCLAW_HOME || fallback.homeDir || '').trim(),
    OPENCLAW_CONFIG_PATH: String(env.OPENCLAW_CONFIG_PATH || fallback.configFile || '').trim(),
  }

  const bundledDelivery = inspectBundledOpenClawDeliveryStatus({
    cwd: process.cwd(),
    resourcesPath: (process as any).resourcesPath,
    env,
    platform,
  })
  const runtimePath = bundledDelivery.runtimePath
  const detectedNodeBinDir = runtimePath
    ? platform === 'win32'
      ? runtimePath
      : path.join(runtimePath, 'bin')
    : null

  managedProbeEnv.PATH = buildCliPathWithCandidates({
    platform,
    currentPath: managedProbeEnv.PATH || '',
    detectedNodeBinDir,
    env: managedProbeEnv,
  })
  const effectiveRunCommand =
    options.runCommand ||
    ((binaryPath: string, commandArgs: string[]) =>
      defaultRunCommand(binaryPath, commandArgs, {
        ...options,
        env: managedProbeEnv,
      }))
  const pathExists = options.pathExists || defaultPathExists

  const probePromise = (async () => {
    const [configResult, backupResult] = await Promise.all([
      effectiveRunCommand(resolvedBinaryPath, ['config', 'file']),
      effectiveRunCommand(resolvedBinaryPath, ['backup', 'create', '--dry-run', '--json']),
    ])

    let configFile = configResult.ok
      ? parseRuntimeConfigPath(configResult.stdout, platform, userHomeDir)
      : null
    let stateRoot = backupResult.ok
      ? parseRuntimeStateRoot(backupResult.stdout, platform, userHomeDir)
      : null

    const enforceManagedRoot = Boolean(String(env.QCLAW_USER_DATA_DIR || '').trim())
    if (enforceManagedRoot) {
      if (configFile && !isPathEqualOrWithinDirectory(configFile, fallback.homeDir, platform)) {
        configFile = null
      }
      if (stateRoot && !isPathEqualOrWithinDirectory(stateRoot, fallback.homeDir, platform)) {
        stateRoot = null
      }
    }

    if (stateRoot && enforceManagedRoot) {
      stateRoot = normalizeManagedStateRoot(stateRoot, fallback.homeDir, platform)
    }

    if (stateRoot) {
      const stateConfigFile = getPathModuleForPlatform(platform).join(stateRoot, 'openclaw.json')
      const currentConfigExists = configFile ? await pathExists(configFile) : false
      const stateConfigExists = await pathExists(stateConfigFile)
      if ((!configFile || !currentConfigExists) && stateConfigExists) {
        configFile = stateConfigFile
      }
    }

    if (!configFile && !stateRoot) {
      cachedKey = cacheKey
      cachedRuntimePaths = fallback
      cachedAt = Date.now()
      return fallback
    }

    const nextPaths = resolveOpenClawPathsFromStateRoot({
      stateRoot: stateRoot || path.dirname(configFile || fallback.configFile),
      configFile: configFile || undefined,
      homeDir: userHomeDir,
      platform,
    })

    cachedKey = cacheKey
    cachedRuntimePaths = nextPaths
    cachedAt = Date.now()
    return nextPaths
  })()

  cachedProbeKey = cacheKey
  cachedRuntimePathsPromise = probePromise

  try {
    return await probePromise
  } finally {
    if (cachedRuntimePathsPromise === probePromise) {
      cachedProbeKey = ''
      cachedRuntimePathsPromise = null
    }
  }
}
