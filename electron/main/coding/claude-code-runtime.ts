import { buildCliPathWithCandidates } from '../runtime-path-discovery'
import { inspectBundledOpenClawDeliveryStatus } from '../openclaw-bundled-manifest'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const { createRequire } = process.getBuiltinModule('node:module') as typeof import('node:module')

export const CLAUDE_CODE_NPM_PACKAGE = '@anthropic-ai/claude-code'
export const CLAUDE_CODE_OFFLINE_BUNDLE_ENV = 'QCLAW_CLAUDE_CODE_BUNDLE'
export const DEV_TOOLS_BUNDLE_ENV = 'QCLAW_DEV_TOOLS_BUNDLE'
export const DEV_TOOLS_BUNDLE_DIR_NAME = 'dev-tools-bundle'

const CLAUDE_CODE_MANAGED_DIR = path.join('tools', 'claude-code')
const DEV_WINDOWS_NODE24_DIR = path.join('node-v24.14.1-win-x64', 'node-v24.14.1-win-x64')
const require = createRequire(import.meta.url)

type ClaudeCodeCommandSource = 'bundled-runtime' | 'managed-install' | 'system-path'
type ClaudeCodeGitSource = 'bundled-runtime' | 'system-path' | 'missing'

export interface ClaudeCodeRuntimePathOptions {
  platform?: NodeJS.Platform
  arch?: string
  env?: NodeJS.ProcessEnv
  userDataDir?: string
  resourcesPath?: string
  cwd?: string
}

export interface ClaudeCodeOfflineBundleStatus {
  available: boolean
  packageSpec: string | null
  bundlePath: string | null
  label: string
  source: 'bundled-runtime' | 'offline-bundle' | 'online'
}

export interface BundledClaudeCodeRuntimeStatus {
  available: boolean
  rootPath: string | null
  packagePath: string | null
  cliEntryPath: string | null
  commandPath: string | null
  binDir: string | null
}

export interface BundledGitRuntimeStatus {
  available: boolean
  rootPath: string | null
  gitPath: string | null
  bashPath: string | null
  pathEntries: string[]
}

export interface ClaudeCodeCommandResolution {
  command: string
  argsPrefix: string[]
  displayCommand: string
  source: ClaudeCodeCommandSource
  bundledClaudePath?: string
  cliEntryPath?: string
}

export interface ClaudeCodeGitResolution {
  command: string
  source: ClaudeCodeGitSource
  gitPath?: string
  gitBashPath?: string
  pathEntries: string[]
}

export interface ClaudeCodeSpawnCommand {
  command: string
  args: string[]
  shell: boolean
}

function normalizePath(value: string): string {
  return String(value || '').trim()
}

function uniqueNonEmpty(values: Array<string | null | undefined>, platform: NodeJS.Platform): string[] {
  const seen = new Set<string>()
  const items: string[] = []
  for (const value of values) {
    const normalized = normalizePath(String(value || ''))
    if (!normalized) continue
    const key = platform === 'win32' ? normalized.toLowerCase() : normalized
    if (seen.has(key)) continue
    seen.add(key)
    items.push(normalized)
  }
  return items
}

function firstExistingFile(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const normalized = normalizePath(String(candidate || ''))
    if (!normalized) continue
    try {
      if (fs.statSync(normalized).isFile()) return normalized
    } catch {
      // Ignore missing candidates and keep probing.
    }
  }
  return null
}

function firstExistingDirectory(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const normalized = normalizePath(String(candidate || ''))
    if (!normalized) continue
    try {
      if (fs.statSync(normalized).isDirectory()) return normalized
    } catch {
      // Ignore missing candidates and keep probing.
    }
  }
  return null
}

function firstPackageDirectory(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const normalized = normalizePath(String(candidate || ''))
    if (!normalized) continue
    try {
      if (!fs.statSync(normalized).isDirectory()) continue
      if (fs.existsSync(path.join(normalized, 'package.json'))) return normalized
    } catch {
      // Ignore missing candidates and keep probing.
    }
  }
  return null
}

function pathSeparatorFor(platform: NodeJS.Platform): string {
  return platform === 'win32' ? ';' : ':'
}

function resolveElectronUserDataDir(): string {
  try {
    const electron = require('electron') as typeof import('electron')
    return normalizePath(electron.app?.getPath?.('userData') || '')
  } catch {
    return ''
  }
}

function resolveFallbackUserDataDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv
): string {
  if (platform === 'win32') {
    const appData = normalizePath(env.APPDATA || env.LOCALAPPDATA || '')
    if (appData) {
      return path.join(appData, 'Mclaw')
    }
  }

  const homeDir = normalizePath(env.HOME || env.USERPROFILE || '')
  if (homeDir) {
    return path.join(homeDir, '.mclaw')
  }

  return path.join(process.cwd(), '.mclaw')
}

function resolveEffectiveRuntime(
  options: ClaudeCodeRuntimePathOptions = {}
): Required<ClaudeCodeRuntimePathOptions> {
  const platform = options.platform || process.platform
  const env = options.env || process.env
  const cwd = normalizePath(options.cwd || process.cwd())
  const resourcesPath = normalizePath(options.resourcesPath || process.resourcesPath || '')
  const userDataDir =
    normalizePath(options.userDataDir || '')
    || resolveElectronUserDataDir()
    || resolveFallbackUserDataDir(platform, env)

  return {
    platform,
    arch: String(options.arch || process.arch).trim(),
    env,
    userDataDir,
    resourcesPath,
    cwd,
  }
}

function resolveBundledDevToolsPlatformRoots(
  options: Required<ClaudeCodeRuntimePathOptions>
): string[] {
  const platformDirAliases = uniqueNonEmpty(
    [
      `${options.platform}-${options.arch}`,
      options.platform === 'win32' ? `windows-${options.arch}` : '',
      options.platform === 'darwin' ? `macos-${options.arch}` : '',
    ],
    options.platform
  )
  const rootCandidates = uniqueNonEmpty(
    [
      normalizePath(options.env[DEV_TOOLS_BUNDLE_ENV] || ''),
      options.resourcesPath ? path.join(options.resourcesPath, DEV_TOOLS_BUNDLE_DIR_NAME) : '',
      options.cwd ? path.join(options.cwd, 'resources', DEV_TOOLS_BUNDLE_DIR_NAME) : '',
      options.cwd ? path.join(options.cwd, DEV_TOOLS_BUNDLE_DIR_NAME) : '',
    ],
    options.platform
  )

  const platformRoots: string[] = []
  for (const rootCandidate of rootCandidates) {
    for (const platformDir of platformDirAliases) {
      platformRoots.push(path.join(rootCandidate, platformDir))
    }
    platformRoots.push(path.join(rootCandidate, options.platform), path.join(rootCandidate, 'current'))
  }

  return uniqueNonEmpty(platformRoots, options.platform)
}

export function resolveClaudeCodeManagedPrefix(
  options: ClaudeCodeRuntimePathOptions = {}
): string {
  const runtime = resolveEffectiveRuntime(options)
  return path.join(runtime.userDataDir, CLAUDE_CODE_MANAGED_DIR)
}

export function resolveClaudeCodeManagedBinDir(
  options: ClaudeCodeRuntimePathOptions = {}
): string {
  return path.join(resolveClaudeCodeManagedPrefix(options), 'node_modules', '.bin')
}

function resolveManagedClaudeCodePackagePath(
  options: Required<ClaudeCodeRuntimePathOptions>
): string | null {
  return firstPackageDirectory([
    path.join(resolveClaudeCodeManagedPrefix(options), 'node_modules', CLAUDE_CODE_NPM_PACKAGE),
  ])
}

function resolveManagedClaudeCodeCommandPath(
  options: Required<ClaudeCodeRuntimePathOptions>
): string | null {
  const executableName = options.platform === 'win32' ? 'claude.cmd' : 'claude'
  return firstExistingFile([
    path.join(resolveClaudeCodeManagedBinDir(options), executableName),
  ])
}

function resolveBundledNodeExecutablePath(
  options: Required<ClaudeCodeRuntimePathOptions>
): string | null {
  const deliveryStatus = inspectBundledOpenClawDeliveryStatus({
    cwd: options.cwd,
    resourcesPath: options.resourcesPath,
    env: options.env,
    platform: options.platform,
    arch: options.arch,
  })
  const runtimePath = normalizePath(deliveryStatus.runtimePath || '')
  if (!runtimePath) return null

  return firstExistingFile([
    path.join(runtimePath, options.platform === 'win32' ? 'node.exe' : 'node'),
  ])
}

function resolveBundledNodeBinDir(
  options: Required<ClaudeCodeRuntimePathOptions>
): string | null {
  const nodePath = resolveBundledNodeExecutablePath(options)
  return nodePath ? path.dirname(nodePath) : null
}

function resolveDevNodeExecutablePath(
  options: Required<ClaudeCodeRuntimePathOptions>
): string | null {
  if (options.platform !== 'win32') return null
  return firstExistingFile([
    path.join(options.cwd, DEV_WINDOWS_NODE24_DIR, 'node.exe'),
  ])
}

function resolveDevNodeBinDir(
  options: Required<ClaudeCodeRuntimePathOptions>
): string | null {
  const nodePath = resolveDevNodeExecutablePath(options)
  return nodePath ? path.dirname(nodePath) : null
}

function resolveNodeCommandForCli(
  options: Required<ClaudeCodeRuntimePathOptions>
): string {
  return (
    resolveBundledNodeExecutablePath(options)
    || resolveDevNodeExecutablePath(options)
    || (options.platform === 'win32' ? 'node.exe' : 'node')
  )
}

export function inspectBundledGitRuntime(
  options: ClaudeCodeRuntimePathOptions = {}
): BundledGitRuntimeStatus {
  const runtime = resolveEffectiveRuntime(options)
  if (runtime.platform !== 'win32') {
    return {
      available: false,
      rootPath: null,
      gitPath: null,
      bashPath: null,
      pathEntries: [],
    }
  }

  for (const platformRoot of resolveBundledDevToolsPlatformRoots(runtime)) {
    const gitRoot = firstExistingDirectory([
      path.join(platformRoot, 'git'),
      path.join(platformRoot, 'Git'),
    ])

    const normalizedGitRoot = normalizePath(gitRoot || '')
    if (!normalizedGitRoot) continue

    const gitPath = firstExistingFile([
      path.join(normalizedGitRoot, 'cmd', 'git.exe'),
      path.join(normalizedGitRoot, 'bin', 'git.exe'),
    ])
    const bashPath = firstExistingFile([
      path.join(normalizedGitRoot, 'bin', 'bash.exe'),
      path.join(normalizedGitRoot, 'usr', 'bin', 'bash.exe'),
    ])
    const pathEntries = uniqueNonEmpty(
      [
        path.join(normalizedGitRoot, 'cmd'),
        path.join(normalizedGitRoot, 'bin'),
        path.join(normalizedGitRoot, 'usr', 'bin'),
        path.join(normalizedGitRoot, 'mingw64', 'bin'),
      ].filter((candidate) => {
        try {
          return fs.statSync(candidate).isDirectory()
        } catch {
          return false
        }
      }),
      runtime.platform
    )

    if (gitPath || bashPath || pathEntries.length > 0) {
      return {
        available: Boolean(gitPath),
        rootPath: normalizedGitRoot,
        gitPath,
        bashPath,
        pathEntries,
      }
    }
  }

  return {
    available: false,
    rootPath: null,
    gitPath: null,
    bashPath: null,
    pathEntries: [],
  }
}

export function inspectBundledClaudeCodeRuntime(
  options: ClaudeCodeRuntimePathOptions = {}
): BundledClaudeCodeRuntimeStatus {
  const runtime = resolveEffectiveRuntime(options)

  for (const platformRoot of resolveBundledDevToolsPlatformRoots(runtime)) {
    const rootPath = normalizePath(
      firstExistingDirectory([
        path.join(platformRoot, 'claude-code'),
        path.join(platformRoot, 'ClaudeCode'),
      ]) || ''
    )
    if (!rootPath) continue

    const packagePath = firstPackageDirectory([
      path.join(rootPath, 'node_modules', CLAUDE_CODE_NPM_PACKAGE),
      rootPath,
    ])
    const cliEntryPath = firstExistingFile([
      packagePath ? path.join(packagePath, 'cli.js') : '',
    ])
    const commandPath = firstExistingFile([
      path.join(rootPath, 'claude.cmd'),
      path.join(rootPath, 'claude.ps1'),
      path.join(rootPath, 'claude'),
    ])

    if (packagePath || commandPath) {
      return {
        available: Boolean(packagePath || commandPath),
        rootPath,
        packagePath,
        cliEntryPath,
        commandPath,
        binDir: rootPath,
      }
    }
  }

  return {
    available: false,
    rootPath: null,
    packagePath: null,
    cliEntryPath: null,
    commandPath: null,
    binDir: null,
  }
}

function resolveSystemClaudeCodePackagePath(
  options: Required<ClaudeCodeRuntimePathOptions>
): string | null {
  const prefixes = uniqueNonEmpty(
    [
      normalizePath(options.env.npm_config_prefix || ''),
      normalizePath(options.env.NPM_CONFIG_PREFIX || ''),
      options.env.APPDATA ? path.join(options.env.APPDATA, 'npm') : '',
      options.env.USERPROFILE ? path.join(options.env.USERPROFILE, 'AppData', 'Roaming', 'npm') : '',
    ],
    options.platform
  )

  const packageCandidates: string[] = []
  for (const prefix of prefixes) {
    packageCandidates.push(
      path.join(prefix, 'node_modules', CLAUDE_CODE_NPM_PACKAGE),
      path.join(prefix, '..', 'node_modules', CLAUDE_CODE_NPM_PACKAGE)
    )
  }

  return firstPackageDirectory(packageCandidates)
}

function resolveSystemClaudeCodeCommandPath(
  options: Required<ClaudeCodeRuntimePathOptions>
): string | null {
  const executableName = options.platform === 'win32' ? 'claude.cmd' : 'claude'
  const prefixes = uniqueNonEmpty(
    [
      normalizePath(options.env.npm_config_prefix || ''),
      normalizePath(options.env.NPM_CONFIG_PREFIX || ''),
      options.env.APPDATA ? path.join(options.env.APPDATA, 'npm') : '',
      options.env.USERPROFILE ? path.join(options.env.USERPROFILE, 'AppData', 'Roaming', 'npm') : '',
    ],
    options.platform
  )

  const commandCandidates: string[] = []
  for (const prefix of prefixes) {
    commandCandidates.push(
      path.join(prefix, executableName),
      path.join(prefix, 'bin', executableName)
    )
  }

  return firstExistingFile(commandCandidates)
}

export function resolveClaudeCodeCommand(
  options: ClaudeCodeRuntimePathOptions = {}
): ClaudeCodeCommandResolution {
  const runtime = resolveEffectiveRuntime(options)
  const displayCommand = runtime.platform === 'win32' ? 'claude.cmd' : 'claude'
  const nodeCommand = resolveNodeCommandForCli(runtime)
  const bundledRuntime = inspectBundledClaudeCodeRuntime(runtime)
  const managedPackagePath = resolveManagedClaudeCodePackagePath(runtime)
  const managedCommandPath = resolveManagedClaudeCodeCommandPath(runtime)
  const systemPackagePath = resolveSystemClaudeCodePackagePath(runtime)
  const systemCommandPath = resolveSystemClaudeCodeCommandPath(runtime)

  const createNodeBackedResolution = (
    source: ClaudeCodeCommandSource,
    cliEntryPath: string,
    bundledClaudePath?: string
  ): ClaudeCodeCommandResolution => ({
    command: nodeCommand,
    argsPrefix: [cliEntryPath],
    displayCommand,
    source,
    ...(bundledClaudePath ? { bundledClaudePath } : {}),
    cliEntryPath,
  })

  if (bundledRuntime.cliEntryPath) {
    return createNodeBackedResolution(
      'bundled-runtime',
      bundledRuntime.cliEntryPath,
      bundledRuntime.commandPath || bundledRuntime.rootPath || undefined
    )
  }
  if (bundledRuntime.commandPath) {
    return {
      command: bundledRuntime.commandPath,
      argsPrefix: [],
      displayCommand,
      source: 'bundled-runtime',
      bundledClaudePath: bundledRuntime.commandPath,
    }
  }

  const managedCliEntryPath = firstExistingFile([
    managedPackagePath ? path.join(managedPackagePath, 'cli.js') : '',
  ])
  if (managedCliEntryPath) {
    return createNodeBackedResolution('managed-install', managedCliEntryPath)
  }
  if (managedCommandPath) {
    return {
      command: managedCommandPath,
      argsPrefix: [],
      displayCommand,
      source: 'managed-install',
    }
  }

  const systemCliEntryPath = firstExistingFile([
    systemPackagePath ? path.join(systemPackagePath, 'cli.js') : '',
  ])
  if (systemCliEntryPath) {
    return createNodeBackedResolution('system-path', systemCliEntryPath)
  }
  if (systemCommandPath) {
    return {
      command: systemCommandPath,
      argsPrefix: [],
      displayCommand,
      source: 'system-path',
    }
  }

  return {
    command: displayCommand,
    argsPrefix: [],
    displayCommand,
    source: 'system-path',
  }
}

export function resolveClaudeCodeGitCommand(
  options: ClaudeCodeRuntimePathOptions = {}
): ClaudeCodeGitResolution {
  const runtime = resolveEffectiveRuntime(options)
  const bundledGitRuntime = inspectBundledGitRuntime(runtime)
  if (bundledGitRuntime.gitPath) {
    return {
      command: bundledGitRuntime.gitPath,
      source: 'bundled-runtime',
      gitPath: bundledGitRuntime.gitPath,
      gitBashPath: bundledGitRuntime.bashPath || undefined,
      pathEntries: bundledGitRuntime.pathEntries,
    }
  }

  return {
    command: runtime.platform === 'win32' ? 'git.exe' : 'git',
    source: 'system-path',
    pathEntries: [],
  }
}

export function shouldUseShellForCommand(command: string): boolean {
  const normalized = normalizePath(command).toLowerCase()
  return /\.(cmd|bat|ps1)$/.test(normalized)
}

function quoteWindowsCmdArg(value: string): string {
  const raw = String(value ?? '')
  if (raw === '') return '""'
  if (!/[\s"&|<>()^]/.test(raw)) return raw
  return `"${raw.replace(/(["&|<>()^])/g, '^$1')}"`
}

export function resolveClaudeCodeSpawnCommand(
  command: string,
  args: string[],
  options: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv } = {}
): ClaudeCodeSpawnCommand {
  const platform = options.platform || process.platform
  const normalizedCommand = normalizePath(command)
  const needsShell = shouldUseShellForCommand(normalizedCommand)
  if (platform !== 'win32' || !needsShell) {
    return {
      command: normalizedCommand,
      args,
      shell: needsShell,
    }
  }

  return {
    command: options.env?.ComSpec || process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d', '/s', '/c', [normalizedCommand, ...args].map(quoteWindowsCmdArg).join(' ')],
    shell: false,
  }
}

export function buildClaudeCodeCommandEnv(
  options: ClaudeCodeRuntimePathOptions & { env?: NodeJS.ProcessEnv } = {}
): NodeJS.ProcessEnv {
  const runtime = resolveEffectiveRuntime(options)
  const mergedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...runtime.env,
  }
  const managedBinDir = resolveClaudeCodeManagedBinDir(runtime)
  const bundledNodeBinDir = resolveBundledNodeBinDir(runtime)
  const devNodeBinDir = resolveDevNodeBinDir(runtime)
  const bundledClaudeRuntime = inspectBundledClaudeCodeRuntime(runtime)
  const gitResolution = resolveClaudeCodeGitCommand(runtime)
  const currentPath = uniqueNonEmpty(
    [
      bundledClaudeRuntime.binDir,
      managedBinDir,
      bundledNodeBinDir,
      devNodeBinDir,
      ...gitResolution.pathEntries,
      mergedEnv.PATH || process.env.PATH || '',
    ],
    runtime.platform
  ).join(pathSeparatorFor(runtime.platform))

  mergedEnv.PATH = buildCliPathWithCandidates({
    platform: runtime.platform,
    currentPath,
    env: mergedEnv,
    detectedNodeBinDir: bundledNodeBinDir || devNodeBinDir,
  })

  if (gitResolution.gitBashPath) {
    mergedEnv.CLAUDE_CODE_GIT_BASH_PATH = gitResolution.gitBashPath
  }

  return mergedEnv
}

function isInstallablePackageFile(targetPath: string): boolean {
  return /\.(?:tgz|tar\.gz)$/i.test(targetPath)
}

function findPackageSpecInDirectory(directoryPath: string): string | null {
  const normalizedDirectory = normalizePath(directoryPath)
  if (!normalizedDirectory || !fs.existsSync(normalizedDirectory)) return null

  const packageJsonPath = path.join(normalizedDirectory, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    return normalizedDirectory
  }

  try {
    const fileName = fs.readdirSync(normalizedDirectory).find((entry) =>
      isInstallablePackageFile(entry)
    )
    return fileName ? path.join(normalizedDirectory, fileName) : null
  } catch {
    return null
  }
}

function resolveOfflineBundleCandidateSpecs(
  options: Required<ClaudeCodeRuntimePathOptions>
): string[] {
  const platformDir = `${options.platform}-${options.arch}`
  const legacyRoots = uniqueNonEmpty(
    [
      normalizePath(options.env[CLAUDE_CODE_OFFLINE_BUNDLE_ENV] || ''),
      options.resourcesPath ? path.join(options.resourcesPath, 'claude-code-offline') : '',
      options.cwd ? path.join(options.cwd, 'resources', 'claude-code-offline') : '',
      options.cwd ? path.join(options.cwd, 'claude-code-offline') : '',
    ],
    options.platform
  )

  const specs: string[] = []
  for (const rootCandidate of legacyRoots) {
    specs.push(
      rootCandidate,
      path.join(rootCandidate, platformDir),
      path.join(rootCandidate, options.platform),
      path.join(rootCandidate, 'current'),
      path.join(rootCandidate, 'package.tgz')
    )
  }

  const bundledRuntime = inspectBundledClaudeCodeRuntime(options)
  if (bundledRuntime.packagePath) {
    specs.unshift(bundledRuntime.packagePath)
  }

  return uniqueNonEmpty(specs, options.platform)
}

export function inspectClaudeCodeOfflineBundle(
  options: ClaudeCodeRuntimePathOptions = {}
): ClaudeCodeOfflineBundleStatus {
  const runtime = resolveEffectiveRuntime(options)
  const bundledRuntime = inspectBundledClaudeCodeRuntime(runtime)

  for (const candidate of resolveOfflineBundleCandidateSpecs(runtime)) {
    if (!fs.existsSync(candidate)) continue

    if (isInstallablePackageFile(candidate)) {
      const source = bundledRuntime.packagePath && normalizePath(candidate) === normalizePath(bundledRuntime.packagePath)
        ? 'bundled-runtime'
        : 'offline-bundle'
      return {
        available: true,
        packageSpec: candidate,
        bundlePath: candidate,
        label: source === 'bundled-runtime' ? '内置开发运行时' : '内置离线包',
        source,
      }
    }

    const directorySpec = findPackageSpecInDirectory(candidate)
    if (directorySpec) {
      const source = bundledRuntime.packagePath && normalizePath(directorySpec) === normalizePath(bundledRuntime.packagePath)
        ? 'bundled-runtime'
        : 'offline-bundle'
      return {
        available: true,
        packageSpec: directorySpec,
        bundlePath: candidate,
        label: source === 'bundled-runtime' ? '内置开发运行时' : '内置离线包',
        source,
      }
    }
  }

  return {
    available: false,
    packageSpec: null,
    bundlePath: null,
    label: '在线安装',
    source: 'online',
  }
}
