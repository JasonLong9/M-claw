const childProcess = process.getBuiltinModule('child_process') as typeof import('node:child_process')
const fs = process.getBuiltinModule('fs') as typeof import('node:fs')
const path = process.getBuiltinModule('path') as typeof import('node:path')
import { getNamedCommandLookupInvocation } from './command-capabilities'
import { inspectBundledOpenClawDeliveryStatus } from './openclaw-bundled-manifest'
import { listExecutablePathCandidates } from './runtime-path-discovery'
import { resolveSafeWorkingDirectory } from './runtime-working-directory'

export interface OpenClawPackageInfo {
  name: string
  version: string
  packageRoot: string
  packageJsonPath: string
  binaryPath: string
  resolvedBinaryPath: string
}

interface ResolveOpenClawPackageOptions {
  binaryPath?: string
  commandPathResolver?: (commandName: string) => Promise<string>
  npmPrefixResolver?: () => Promise<string | null>
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  fileExists?: (candidatePath: string) => boolean
}

interface ResolveOpenClawBinaryPathFromNpmPrefixOptions {
  npmPrefix: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  fileExists?: (candidatePath: string) => boolean
}

interface ResolvedOpenClawPackageLayout {
  binaryPath: string
  resolvedBinaryPath: string
  packageRoot: string
  packageJsonPath: string
  packageJson: Record<string, unknown>
}

interface OpenClawPackageLocation {
  packageRoot: string
  packageJsonPath: string
  packageJson: Record<string, unknown>
}

interface CommandPathLookupInvocation {
  command: string
  args: string[]
  shell: boolean
}

interface CommandLookupRuntime {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
}

function extractFirstNonEmptyLine(text: string): string {
  for (const line of text.split(/\r?\n/g)) {
    const trimmed = line.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function createCommandLookupRuntime(options: ResolveOpenClawPackageOptions = {}): CommandLookupRuntime {
  return {
    platform: options.platform || process.platform,
    env: options.env || process.env,
  }
}

function findKnownCommandCandidate(
  runtime: CommandLookupRuntime,
  npmPrefix: string | null,
  fileExists: (candidatePath: string) => boolean = fs.existsSync
): string | null {
  const candidates = listExecutablePathCandidates('openclaw', {
    platform: runtime.platform,
    env: runtime.env,
    currentPath: runtime.env.PATH || '',
    npmPrefix,
  })
  for (const candidate of candidates) {
    try {
      if (fileExists(candidate)) return candidate
    } catch {
      // ignore invalid candidate checks and continue probing.
    }
  }
  return null
}

export function resolveOpenClawBinaryPathFromNpmPrefix(
  options: ResolveOpenClawBinaryPathFromNpmPrefixOptions
): string {
  const runtime = createCommandLookupRuntime(options)
  const npmPrefix = String(options.npmPrefix || '').trim()
  const candidate = listExecutablePathCandidates('openclaw', {
    platform: runtime.platform,
    env: runtime.env,
    currentPath: '',
    npmPrefix,
  })[0]
  if (candidate) return candidate
  throw new Error(
    `Unable to resolve the openclaw binary from npm prefix: ${npmPrefix || '(empty)'}`
  )
}

function isCommandLookupMiss(commandName: string, message: string): boolean {
  const normalized = String(message || '').trim().toLowerCase()
  const normalizedCommand = commandName.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.includes('could not find files for the given pattern')) return true
  if (normalized.includes(`unable to resolve command path for ${normalizedCommand}`)) return true
  if (normalized.includes('not recognized as an internal or external command') && normalized.includes(normalizedCommand)) return true
  if (normalized.includes('command not found') && normalized.includes(normalizedCommand)) return true
  return false
}

function toActionableCommandLookupError(commandName: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error || '')
  if (isCommandLookupMiss(commandName, message)) {
    return new Error(
      `Unable to locate the ${commandName} command. Complete OpenClaw CLI installation in Env Check and restart Qclaw.`
    )
  }
  return new Error(message || `Unable to resolve command path for ${commandName}`)
}

export function getCommandPathLookupInvocation(
  commandName: string,
  platformOrRuntime:
    | NodeJS.Platform
    | {
        platform?: NodeJS.Platform
        env?: NodeJS.ProcessEnv
      } = process.platform
): CommandPathLookupInvocation {
  return getNamedCommandLookupInvocation(commandName, platformOrRuntime)
}

const DEFAULT_COMMAND_LOOKUP_TIMEOUT_MS = 15_000

function resolveCommandLookupTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = String(env.QCLAW_COMMAND_LOOKUP_TIMEOUT_MS || '').trim()
  if (!raw) return DEFAULT_COMMAND_LOOKUP_TIMEOUT_MS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_COMMAND_LOOKUP_TIMEOUT_MS
  return Math.max(500, Math.floor(parsed))
}

function runCommandPathLookup(commandName: string, runtime: CommandLookupRuntime): Promise<string> {
  return new Promise((resolve, reject) => {
    const invocation = getCommandPathLookupInvocation(commandName, runtime)
    const child = childProcess.spawn(invocation.command, invocation.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: invocation.shell,
      env: runtime.env,
      cwd: resolveSafeWorkingDirectory({ env: runtime.env, platform: runtime.platform }),
      windowsHide: true,
    })

    const timeoutMs = resolveCommandLookupTimeoutMs(runtime.env)
    let settled = false
    const timeoutId = setTimeout(() => {
      try { child.kill() } catch { /* noop */ }
      if (settled) return
      settled = true
      reject(new Error(`Command lookup timed out after ${timeoutMs}ms for ${commandName}`))
    }, timeoutMs)

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      const resolved = extractFirstNonEmptyLine(stdout)
      if (code === 0 && resolved) {
        resolve(resolved)
        return
      }
      reject(new Error(stderr.trim() || `Unable to resolve command path for ${commandName}`))
    })
  })
}

function runDirectCommand(command: string, args: string[], runtime: CommandLookupRuntime): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: runtime.env,
      cwd: resolveSafeWorkingDirectory({ env: runtime.env, platform: runtime.platform }),
      windowsHide: true,
    })

    const timeoutMs = resolveCommandLookupTimeoutMs(runtime.env)
    let settled = false
    const timeoutId = setTimeout(() => {
      try { child.kill() } catch { /* noop */ }
      if (settled) return
      settled = true
      reject(new Error(`Direct command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`))
    }, timeoutMs)

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      if (code === 0) {
        resolve(stdout)
        return
      }
      reject(new Error(stderr.trim() || `Command failed: ${command}`))
    })
  })
}

async function resolveNpmGlobalPrefix(runtime: CommandLookupRuntime): Promise<string | null> {
  try {
    const npmCommandPath = await runCommandPathLookup('npm', runtime)
    const stdout = await runDirectCommand(npmCommandPath.trim(), ['config', 'get', 'prefix'], runtime)
    const prefix = extractFirstNonEmptyLine(stdout)
    if (!prefix || prefix === 'undefined' || prefix === 'null') return null
    return prefix
  } catch {
    return null
  }
}

async function resolvePackageLayout(
  options: ResolveOpenClawPackageOptions = {}
): Promise<ResolvedOpenClawPackageLayout> {
  const binaryPath = options.binaryPath?.trim() || (await resolveOpenClawBinaryPath(options))
  if (!binaryPath) {
    throw new Error('Unable to resolve the openclaw binary path')
  }

  const fsPromises = fs.promises
  if (!fsPromises) {
    throw new Error('Node fs.promises is unavailable in this runtime')
  }
  const resolvedBinaryPath = await fsPromises.realpath(binaryPath)
  const packageLocation = await findOpenClawPackageLocation(binaryPath, resolvedBinaryPath, fsPromises)
  if (!packageLocation) {
    throw new Error(
      `Resolved OpenClaw binary does not have an adjacent or parent openclaw package.json: ${resolvedBinaryPath}`
    )
  }

  const { packageRoot, packageJsonPath, packageJson } = packageLocation

  return {
    binaryPath,
    resolvedBinaryPath,
    packageRoot,
    packageJsonPath,
    packageJson,
  }
}

async function findNearestOpenClawPackageLocation(
  startDir: string,
  fsPromises: typeof fs.promises
): Promise<OpenClawPackageLocation | null> {
  let currentDir = startDir

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json')
    try {
      const rawPackageJson = await fsPromises.readFile(packageJsonPath, 'utf8')
      let packageJson: Record<string, unknown>
      try {
        packageJson = JSON.parse(rawPackageJson) as Record<string, unknown>
      } catch {
        throw new Error(`Failed to parse OpenClaw package.json: ${packageJsonPath}`)
      }

      if (packageJson.name === 'openclaw') {
        return {
          packageRoot: currentDir,
          packageJsonPath,
          packageJson,
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '')
      if (message.startsWith('Failed to parse OpenClaw package.json:')) {
        throw error
      }
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) return null
    currentDir = parentDir
  }
}

async function findOpenClawPackageLocation(
  binaryPath: string,
  resolvedBinaryPath: string,
  fsPromises: typeof fs.promises
): Promise<OpenClawPackageLocation | null> {
  const nearestPackage = await findNearestOpenClawPackageLocation(path.dirname(resolvedBinaryPath), fsPromises)
  if (nearestPackage) return nearestPackage

  for (const candidateRoot of listShimPackageRootCandidates(binaryPath, resolvedBinaryPath)) {
    const packageLocation = await readOpenClawPackageLocation(candidateRoot, fsPromises)
    if (packageLocation) return packageLocation
  }

  return null
}

function listShimPackageRootCandidates(binaryPath: string, resolvedBinaryPath: string): string[] {
  const candidateRoots: string[] = []
  const seen = new Set<string>()

  for (const currentPath of [binaryPath, resolvedBinaryPath]) {
    const trimmed = String(currentPath || '').trim()
    if (!trimmed) continue

    const binaryDir = path.dirname(trimmed)
    const binaryName = path.basename(trimmed).toLowerCase()
    const parentDir = path.dirname(binaryDir)
    const grandParentDir = path.dirname(parentDir)
    const rootsToCheck = [
      path.join(binaryDir, 'node_modules', 'openclaw'),
      path.join(parentDir, 'node_modules', 'openclaw'),
    ]

    if (binaryName === 'openclaw' || binaryName === 'openclaw.cmd' || binaryName === 'openclaw.exe') {
      rootsToCheck.push(path.join(parentDir, 'lib', 'node_modules', 'openclaw'))
      rootsToCheck.push(path.join(grandParentDir, 'lib', 'node_modules', 'openclaw'))
    }

    for (const root of rootsToCheck) {
      const normalized = path.normalize(root)
      const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized
      if (seen.has(key)) continue
      seen.add(key)
      candidateRoots.push(normalized)
    }
  }

  return candidateRoots
}

async function readOpenClawPackageLocation(
  packageRoot: string,
  fsPromises: typeof fs.promises
): Promise<OpenClawPackageLocation | null> {
  const packageJsonPath = path.join(packageRoot, 'package.json')
  try {
    const rawPackageJson = await fsPromises.readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(rawPackageJson) as Record<string, unknown>
    if (packageJson.name !== 'openclaw') return null
    return {
      packageRoot,
      packageJsonPath,
      packageJson,
    }
  } catch {
    return null
  }
}

export async function resolveOpenClawBinaryPath(
  options: ResolveOpenClawPackageOptions = {}
): Promise<string> {
  const runtime = createCommandLookupRuntime(options)
  const resolveCommandPath =
    options.commandPathResolver ||
    ((commandName: string) => runCommandPathLookup(commandName, runtime))
  const bundledRuntimeBinaryPath = inspectBundledOpenClawDeliveryStatus({
    cwd: process.cwd(),
    resourcesPath: process.resourcesPath,
    env: runtime.env,
    platform: runtime.platform,
  }).runtimeBinaryPath

  // Packaged Qclaw should keep using its own bundled OpenClaw runtime even when
  // a separate global `openclaw` command is also installed on PATH.
  if (bundledRuntimeBinaryPath) {
    return bundledRuntimeBinaryPath
  }

  // Fast path: filesystem scan without spawning where.exe / which.
  // On Windows, where.exe can hang indefinitely when PATH contains
  // inaccessible network drives. Pure fs checks avoid that entirely.
  const fastCandidate = findKnownCommandCandidate(runtime, null, options.fileExists)
  if (fastCandidate) return fastCandidate

  try {
    const binaryPath = await resolveCommandPath('openclaw')
    const trimmed = binaryPath.trim()
    if (!trimmed) {
      throw new Error('Unable to resolve the openclaw binary path')
    }
    return trimmed
  } catch (error) {
    const npmPrefix =
      (await options.npmPrefixResolver?.().catch(() => null)) ??
      (await resolveNpmGlobalPrefix(runtime))
    const fallbackCandidate = findKnownCommandCandidate(runtime, npmPrefix, options.fileExists)
    if (fallbackCandidate) return fallbackCandidate
    if (bundledRuntimeBinaryPath) return bundledRuntimeBinaryPath
    throw toActionableCommandLookupError('openclaw', error)
  }
}

export async function resolveOpenClawPackageRoot(
  options: ResolveOpenClawPackageOptions = {}
): Promise<string> {
  const layout = await resolvePackageLayout(options)
  return layout.packageRoot
}

export async function readOpenClawPackageInfo(
  options: ResolveOpenClawPackageOptions = {}
): Promise<OpenClawPackageInfo> {
  const layout = await resolvePackageLayout(options)
  const version = String(layout.packageJson.version || '').trim()
  if (!version) {
    throw new Error(`Resolved OpenClaw package.json is missing a version: ${layout.packageJsonPath}`)
  }

  return {
    name: 'openclaw',
    version,
    packageRoot: layout.packageRoot,
    packageJsonPath: layout.packageJsonPath,
    binaryPath: layout.binaryPath,
    resolvedBinaryPath: layout.resolvedBinaryPath,
  }
}
