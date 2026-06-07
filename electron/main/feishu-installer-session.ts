import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  cancelActiveProcess,
  clearActiveProcessIfMatch,
  consumeCanceledProcess,
  setActiveProcess,
} from './command-control'
import { getOpenClawPaths, readConfig } from './cli'
import { probePlatformCommandCapability } from './command-capabilities'
import { applyConfigPatchGuarded } from './openclaw-config-coordinator'
import {
  FEISHU_OFFICIAL_PLUGIN_ID,
  prepareFeishuInstallerConfig,
} from './feishu-installer-config'
import {
  ensureFeishuOfficialPluginReady,
  getFeishuOfficialPluginState,
} from './feishu-official-plugin-state'
import { inspectBundledOpenClawDeliveryStatus } from './openclaw-bundled-manifest'
import { MAIN_RUNTIME_POLICY } from './runtime-policy'
import { buildCliPathWithCandidates } from './runtime-path-discovery'
import { resolveSafeWorkingDirectory } from './runtime-working-directory'
import { cleanupIsolatedNpmCacheEnv, createIsolatedNpmCacheEnv } from './npm-cache-env'
import { buildFeishuInstallerManagedOpenClawEnv } from './feishu-installer-env'
import {
  FeishuManagedCreateCanceledError,
  runFeishuManagedCreateFlow,
} from './feishu-managed-create-flow'

const childProcess = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')
const { spawn } = childProcess

const FEISHU_INSTALLER_CONTROL_DOMAIN = 'feishu-installer'
const FEISHU_INSTALLER_PACKAGE = '@larksuite/openclaw-lark-tools'
const FEISHU_OFFICIAL_PLUGIN_MANIFEST = 'openclaw.plugin.json'
const FEISHU_INSTALLER_DEV_NODE24_WINDOWS_DIR = path.join(
  'node-v24.14.1-win-x64',
  'node-v24.14.1-win-x64'
)

export type FeishuInstallerMode = 'create' | 'link'

type FeishuInstallerNpxSource = 'bundled-runtime' | 'dev-node24' | 'shell'
type FeishuInstallerStrategy = 'official-installer' | 'managed-create-auth'

interface FeishuInstallerNpxResolution {
  executablePath: string | null
  binDir: string | null
  source: FeishuInstallerNpxSource
  packagedInvariantError: string | null
}

interface FeishuInstallerCommandResolution {
  command: string[]
  bundledPackagePath: string | null
  npxPath: string | null
  npxBinDir: string | null
  npxSource: FeishuInstallerNpxSource
  packagedInvariantError: string | null
}

function resolveFeishuInstallerNpmCacheDir(): string {
  return path.join(app.getPath('userData'), 'npm-cache')
}

function resolveFeishuOfficialPluginManifestPath(homeDir: string): string {
  return path.join(homeDir, 'extensions', FEISHU_OFFICIAL_PLUGIN_ID, FEISHU_OFFICIAL_PLUGIN_MANIFEST)
}

export async function isFeishuOfficialPluginInstalledOnDisk(): Promise<boolean> {
  const openClawPaths = await getOpenClawPaths().catch(() => null)
  const homeDir = String(openClawPaths?.homeDir || '').trim()
  if (!homeDir) return false

  try {
    await fs.promises.access(resolveFeishuOfficialPluginManifestPath(homeDir))
    return true
  } catch {
    return false
  }
}

async function prepareConfigForFeishuInstaller(): Promise<void> {
  const config = await readConfig().catch(() => null)
  const openClawPaths = await getOpenClawPaths().catch(() => null)
  const homeDir = String(openClawPaths?.homeDir || '').trim()
  const pluginInstallPath = homeDir ? path.join(homeDir, 'extensions', FEISHU_OFFICIAL_PLUGIN_ID) : ''
  const pluginInstalledOnDisk = homeDir
    ? await isFeishuOfficialPluginInstalledOnDisk().catch(() => false)
    : false

  const result = prepareFeishuInstallerConfig(config, {
    pluginInstalledOnDisk,
    installPath: pluginInstallPath,
  })

  if (result.changed) {
    const writeResult = await applyConfigPatchGuarded({
      beforeConfig: config,
      afterConfig: result.config,
      reason: 'unknown',
    })
    if (!writeResult.ok) {
      throw new Error(writeResult.message || 'Failed to prepare Feishu installer config.')
    }
  }
}

function resolveBundledFeishuInstallerPackage(): string | null {
  const envOverride = String(process.env.QCLAW_FEISHU_INSTALLER_TGZ || '').trim()
  if (envOverride && fs.existsSync(envOverride)) {
    return envOverride
  }

  return null
}

function resolveExistingExecutablePath(candidatePath: string): string | null {
  const normalizedPath = String(candidatePath || '').trim()
  if (!normalizedPath) return null

  try {
    const stats = fs.statSync(normalizedPath)
    return stats.isFile() ? normalizedPath : null
  } catch {
    return null
  }
}

function resolveDevNode24RuntimeRoot(): string | null {
  if (process.platform !== 'win32') return null

  const runtimeRoot = path.join(process.cwd(), FEISHU_INSTALLER_DEV_NODE24_WINDOWS_DIR)
  return resolveExistingExecutablePath(path.join(runtimeRoot, 'node.exe')) ? runtimeRoot : null
}

function resolveFeishuInstallerNpx(): FeishuInstallerNpxResolution {
  const platform = process.platform
  const bundledDeliveryStatus = inspectBundledOpenClawDeliveryStatus({
    cwd: process.cwd(),
    resourcesPath: process.resourcesPath,
    env: process.env,
    platform,
  })
  const runtimePath = String(bundledDeliveryStatus.runtimePath || '').trim()
  const bundledNpxName = platform === 'win32' ? 'npx.cmd' : 'npx'
  const bundledNpxPath = runtimePath
    ? resolveExistingExecutablePath(path.join(runtimePath, bundledNpxName))
    : null

  if (bundledNpxPath) {
    return {
      executablePath: bundledNpxPath,
      binDir: path.dirname(bundledNpxPath),
      source: 'bundled-runtime',
      packagedInvariantError: null,
    }
  }

  if (app.isPackaged) {
    return {
      executablePath: null,
      binDir: runtimePath || null,
      source: 'bundled-runtime',
      packagedInvariantError: runtimePath
        ? `Bundled Feishu installer runtime is incomplete: missing ${bundledNpxName} under ${runtimePath}`
        : 'Bundled Feishu installer runtime is unavailable in this packaged build.',
    }
  }

  const devRuntimeRoot = resolveDevNode24RuntimeRoot()
  const devNpxPath = devRuntimeRoot
    ? resolveExistingExecutablePath(path.join(devRuntimeRoot, bundledNpxName))
    : null
  if (devNpxPath) {
    return {
      executablePath: devNpxPath,
      binDir: path.dirname(devNpxPath),
      source: 'dev-node24',
      packagedInvariantError: null,
    }
  }

  return {
    executablePath: null,
    binDir: null,
    source: 'shell',
    packagedInvariantError: null,
  }
}

function buildFeishuInstallerCommand(): FeishuInstallerCommandResolution {
  const bundledPackagePath = resolveBundledFeishuInstallerPackage()
  const packageSpecifier = bundledPackagePath || FEISHU_INSTALLER_PACKAGE
  const npxResolution = resolveFeishuInstallerNpx()
  const command = [npxResolution.executablePath || 'npx', '-y', packageSpecifier, 'install']

  return {
    command,
    bundledPackagePath,
    npxPath: npxResolution.executablePath,
    npxBinDir: npxResolution.binDir,
    npxSource: npxResolution.source,
    packagedInvariantError: npxResolution.packagedInvariantError,
  }
}

export interface FeishuInstallerSessionSnapshot {
  active: boolean
  sessionId: string | null
  phase: 'idle' | 'running' | 'exited'
  output: string
  code: number | null
  ok: boolean
  canceled: boolean
  command: string[]
}

export interface FeishuInstallerSessionEvent {
  sessionId: string
  type: 'started' | 'output' | 'exit'
  stream?: 'stdout' | 'stderr'
  chunk?: string
  phase?: FeishuInstallerSessionSnapshot['phase']
  code?: number | null
  ok?: boolean
  canceled?: boolean
  command?: string[]
}

interface ActiveFeishuInstallerSession {
  id: string
  mode: FeishuInstallerMode
  strategy: FeishuInstallerStrategy
  process: ChildProcess | null
  phase: FeishuInstallerSessionSnapshot['phase']
  output: string
  code: number | null
  ok: boolean
  canceled: boolean
  command: string[]
  npmCacheDir: string | null
  cancel: (() => void) | null
}

let activeSession: ActiveFeishuInstallerSession | null = null

function buildSnapshot(): FeishuInstallerSessionSnapshot {
  const commandResolution = buildFeishuInstallerCommand()
  if (!activeSession) {
    return {
      active: false,
      sessionId: null,
      phase: 'idle',
      output: '',
      code: null,
      ok: false,
      canceled: false,
      command: [...commandResolution.command],
    }
  }

  return {
    active: activeSession.phase === 'running',
    sessionId: activeSession.id,
    phase: activeSession.phase,
    output: activeSession.output,
    code: activeSession.code,
    ok: activeSession.ok,
    canceled: activeSession.canceled,
    command: activeSession.command,
  }
}

function appendOutput(stream: 'stdout' | 'stderr', chunk: string, emit: (event: FeishuInstallerSessionEvent) => void) {
  if (!activeSession) return
  activeSession.output += chunk
  emit({
    sessionId: activeSession.id,
    type: 'output',
    stream,
    chunk,
  })
}

function finalizeActiveSession(
  sessionId: string,
  emit: (event: FeishuInstallerSessionEvent) => void,
  params: {
    code: number | null
    ok: boolean
    canceled: boolean
    extraOutput?: string
  }
) {
  if (!activeSession || activeSession.id !== sessionId) return

  if (params.extraOutput) {
    activeSession.output += params.extraOutput
    emit({
      sessionId,
      type: 'output',
      stream: 'stderr',
      chunk: params.extraOutput,
    })
  }

  activeSession.phase = 'exited'
  activeSession.code = params.code
  activeSession.ok = params.ok
  activeSession.canceled = params.canceled
  activeSession.cancel = null

  emit({
    sessionId,
    type: 'exit',
    phase: 'exited',
    code: params.code,
    ok: params.ok,
    canceled: params.canceled,
    command: [...activeSession.command],
  })

  if (activeSession.npmCacheDir) {
    void cleanupIsolatedNpmCacheEnv(activeSession.npmCacheDir)
  }
}

function buildFeishuInstallerStartupBanner(commandResolution: FeishuInstallerCommandResolution): string {
  return [
    commandResolution.npxSource === 'bundled-runtime' && commandResolution.npxBinDir
      ? `[Mclaw] 使用内置 Node/npm 工具链：${commandResolution.npxBinDir}\n`
      : '',
    commandResolution.npxSource === 'dev-node24' && commandResolution.npxBinDir
      ? `[Mclaw] 使用本地 Node 24 工具链：${commandResolution.npxBinDir}\n`
      : '',
    commandResolution.bundledPackagePath
      ? `[Mclaw] 使用内置飞书安装器包：${commandResolution.bundledPackagePath}\n`
      : '',
  ].join('')
}

function buildFeishuManagedCreateCommand(): string[] {
  return ['mclaw', 'feishu', 'create-bot']
}

function buildFeishuManagedCreateBanner(): string {
  return '[Mclaw] 新建机器人现在走 Mclaw 内置二维码创建链路，不再依赖上游 npm install/update。\n'
}

function buildFeishuOfficialPluginEnsureBanner(params: {
  installedThisRun: boolean
  stateInstalledOnDisk: boolean
  message?: string
  stdout?: string
  stderr?: string
}): string {
  const lines: string[] = []
  if (params.installedThisRun) {
    lines.push('[Mclaw] 已将内置飞书运行时插件写入当前 OpenClaw 目录。')
  } else if (params.stateInstalledOnDisk) {
    lines.push('[Mclaw] 当前 OpenClaw 目录中已存在飞书运行时插件。')
  }

  const message = String(params.message || '').trim()
  if (message) lines.push(`[Mclaw] ${message}`)

  const stdout = String(params.stdout || '').trim()
  if (stdout) lines.push(stdout)

  const stderr = String(params.stderr || '').trim()
  if (stderr) lines.push(stderr)

  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

export async function getFeishuInstallerSessionSnapshot(): Promise<FeishuInstallerSessionSnapshot> {
  return buildSnapshot()
}

function buildFeishuInstallerFailureSnapshot(
  command: string[],
  output: string,
  code = 1
): FeishuInstallerSessionSnapshot {
  return {
    active: false,
    sessionId: activeSession?.id || randomUUID(),
    phase: 'exited',
    output,
    code,
    ok: false,
    canceled: false,
    command: [...command],
  }
}

async function ensureFeishuInstallerPluginReady(params: {
  mode: FeishuInstallerMode
  command: string[]
  failureFallback: string
}): Promise<
  | FeishuInstallerSessionSnapshot
  | Awaited<ReturnType<typeof ensureFeishuOfficialPluginReady>>
> {
  let ensurePluginReadyResult: Awaited<ReturnType<typeof ensureFeishuOfficialPluginReady>>
  try {
    ensurePluginReadyResult = await ensureFeishuOfficialPluginReady({
      skipGatewayReload: true,
    })
  } catch (error) {
    const fallbackState = await getFeishuOfficialPluginState().catch(() => ({
      pluginId: FEISHU_OFFICIAL_PLUGIN_ID,
      installedOnDisk: false,
      installPath: '',
      installSource: '',
      bundledPayloadAvailable: false,
      bundledPayloadPath: '',
      officialPluginConfigured: false,
      legacyPluginIdsPresent: [],
      configChanged: false,
      normalizedConfig: {},
    }))

    ensurePluginReadyResult = {
      ok: false,
      installedThisRun: false,
      state: fallbackState,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      code: 1,
      message:
        params.mode === 'create'
          ? '启动飞书建机器人二维码前，准备内置飞书运行时插件失败。'
          : '启动飞书官方安装器前，准备内置飞书运行时插件失败。',
    }
  }

  if (!ensurePluginReadyResult.ok || !ensurePluginReadyResult.state.installedOnDisk) {
    const detail = [
      String(ensurePluginReadyResult.message || '').trim(),
      String(ensurePluginReadyResult.stderr || '').trim(),
      String(ensurePluginReadyResult.stdout || '').trim(),
    ]
      .filter(Boolean)
      .join('\n\n')

    return buildFeishuInstallerFailureSnapshot(
      params.command,
      detail || params.failureFallback,
      ensurePluginReadyResult.code ?? 1
    )
  }

  return ensurePluginReadyResult
}

async function startManagedCreateInstallerSession(
  emit: (event: FeishuInstallerSessionEvent) => void
): Promise<FeishuInstallerSessionSnapshot> {
  const command = buildFeishuManagedCreateCommand()
  const readyState = await ensureFeishuInstallerPluginReady({
    mode: 'create',
    command,
    failureFallback: '飞书运行时插件尚未就绪，无法继续创建机器人。',
  })
  if ('active' in readyState) {
    return readyState
  }

  const sessionId = randomUUID()
  let canceled = false

  activeSession = {
    id: sessionId,
    mode: 'create',
    strategy: 'managed-create-auth',
    process: null,
    phase: 'running',
    output:
      buildFeishuOfficialPluginEnsureBanner({
        installedThisRun: readyState.installedThisRun,
        stateInstalledOnDisk: readyState.state.installedOnDisk,
        message: readyState.message,
        stdout: readyState.stdout,
        stderr: readyState.stderr,
      }) + buildFeishuManagedCreateBanner(),
    code: null,
    ok: false,
    canceled: false,
    command,
    npmCacheDir: null,
    cancel: () => {
      canceled = true
    },
  }

  emit({
    sessionId,
    type: 'started',
    phase: 'running',
    command: [...command],
  })

  void runFeishuManagedCreateFlow({
    onOutput: (chunk) => appendOutput('stdout', chunk, emit),
    isCanceled: () => canceled || !activeSession || activeSession.id !== sessionId || activeSession.phase !== 'running',
  })
    .then(() => {
      finalizeActiveSession(sessionId, emit, {
        code: 0,
        ok: true,
        canceled: false,
      })
    })
    .catch((error) => {
      if (error instanceof FeishuManagedCreateCanceledError || canceled) {
        finalizeActiveSession(sessionId, emit, {
          code: null,
          ok: false,
          canceled: true,
        })
        return
      }

      finalizeActiveSession(sessionId, emit, {
        code: 1,
        ok: false,
        canceled: false,
        extraOutput: `\n${error instanceof Error ? error.message : String(error)}`,
      })
    })

  return buildSnapshot()
}

async function startOfficialInstallerSession(
  emit: (event: FeishuInstallerSessionEvent) => void
): Promise<FeishuInstallerSessionSnapshot> {
  const commandResolution = buildFeishuInstallerCommand()
  if (commandResolution.packagedInvariantError) {
    return buildFeishuInstallerFailureSnapshot(
      [...commandResolution.command],
      commandResolution.packagedInvariantError
    )
  }

  if (!commandResolution.npxPath) {
    const capability = await probePlatformCommandCapability('npx', {
      platform: process.platform,
      env: process.env,
    })
    if (!capability.available) {
      return buildFeishuInstallerFailureSnapshot(
        [...commandResolution.command],
        capability.message || '当前环境中没有可用的 npx，无法启动飞书官方安装器。'
      )
    }
  }

  const readyState = await ensureFeishuInstallerPluginReady({
    mode: 'link',
    command: [...commandResolution.command],
    failureFallback: '飞书运行时插件尚未就绪，官方安装器无法继续。',
  })
  if ('active' in readyState) {
    return readyState
  }

  await prepareConfigForFeishuInstaller().catch(() => {
    // Best effort only; installer startup should still proceed if config cleanup fails.
  })

  const npmCacheDir = resolveFeishuInstallerNpmCacheDir()
  const isolatedNpmCache = await createIsolatedNpmCacheEnv(npmCacheDir)
  const openClawPaths = await getOpenClawPaths().catch(() => null)
  const managedOpenClawEnv = buildFeishuInstallerManagedOpenClawEnv({
    baseEnv: process.env,
    openClawPaths,
  })
  const sessionId = randomUUID()
  const proc = spawn(commandResolution.command[0], commandResolution.command.slice(1), {
    cwd: resolveSafeWorkingDirectory({
      env: managedOpenClawEnv,
      platform: process.platform,
    }),
    env: {
      ...managedOpenClawEnv,
      PATH: buildCliPathWithCandidates({
        platform: process.platform,
        currentPath: managedOpenClawEnv.PATH || process.env.PATH || '',
        detectedNodeBinDir: commandResolution.npxBinDir,
        env: managedOpenClawEnv,
      }),
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      ...isolatedNpmCache.env,
    },
    shell: process.platform === 'win32',
    windowsHide: true,
    timeout: MAIN_RUNTIME_POLICY.cli.pluginInstallNpxTimeoutMs,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  activeSession = {
    id: sessionId,
    mode: 'link',
    strategy: 'official-installer',
    process: proc,
    phase: 'running',
    output:
      buildFeishuOfficialPluginEnsureBanner({
        installedThisRun: readyState.installedThisRun,
        stateInstalledOnDisk: readyState.state.installedOnDisk,
        message: readyState.message,
        stdout: readyState.stdout,
        stderr: readyState.stderr,
      }) + buildFeishuInstallerStartupBanner(commandResolution),
    code: null,
    ok: false,
    canceled: false,
    command: [...commandResolution.command],
    npmCacheDir: isolatedNpmCache.cacheDir,
    cancel: null,
  }
  setActiveProcess(proc, FEISHU_INSTALLER_CONTROL_DOMAIN)

  emit({
    sessionId,
    type: 'started',
    phase: 'running',
    command: [...commandResolution.command],
  })

  proc.stdout?.on('data', (chunk) => {
    appendOutput('stdout', String(chunk), emit)
  })

  proc.stderr?.on('data', (chunk) => {
    appendOutput('stderr', String(chunk), emit)
  })

  proc.on('close', (code) => {
    if (!activeSession || activeSession.id !== sessionId) return
    clearActiveProcessIfMatch(proc, FEISHU_INSTALLER_CONTROL_DOMAIN)
    const canceled = consumeCanceledProcess(proc, FEISHU_INSTALLER_CONTROL_DOMAIN)
    finalizeActiveSession(sessionId, emit, {
      code: canceled ? null : code,
      ok: code === 0 && !canceled,
      canceled,
    })
  })

  proc.on('error', (error) => {
    if (!activeSession || activeSession.id !== sessionId) return
    clearActiveProcessIfMatch(proc, FEISHU_INSTALLER_CONTROL_DOMAIN)
    const canceled = consumeCanceledProcess(proc, FEISHU_INSTALLER_CONTROL_DOMAIN)
    finalizeActiveSession(sessionId, emit, {
      code: canceled ? null : 1,
      ok: false,
      canceled,
      extraOutput: `\n${error instanceof Error ? error.message : String(error)}`,
    })
  })

  return buildSnapshot()
}

export async function startFeishuInstallerSession(
  mode: FeishuInstallerMode = 'create',
  emit: (event: FeishuInstallerSessionEvent) => void
): Promise<FeishuInstallerSessionSnapshot> {
  if (activeSession?.phase === 'running') {
    return buildSnapshot()
  }

  return mode === 'link'
    ? startOfficialInstallerSession(emit)
    : startManagedCreateInstallerSession(emit)
}

export async function writeFeishuInstallerSessionInput(
  sessionId: string,
  input: string
): Promise<{ ok: boolean; message?: string }> {
  if (!activeSession || activeSession.id !== sessionId || activeSession.phase !== 'running') {
    return { ok: false, message: 'The Feishu official installer is not running.' }
  }

  if (activeSession.strategy === 'managed-create-auth') {
    return { ok: false, message: '当前二维码创建流程不需要手动输入；请直接扫码并等待结果回传。' }
  }

  const normalizedInput = String(input || '')
  if (!normalizedInput) {
    return { ok: false, message: 'Input cannot be empty.' }
  }

  const proc = activeSession.process
  if (!proc) {
    return { ok: false, message: 'The installer input stream is unavailable in the current session.' }
  }

  const stdin = proc.stdin
  if (!stdin || stdin.destroyed || !stdin.writable) {
    return { ok: false, message: 'The installer input stream is no longer writable. Please restart it.' }
  }

  return new Promise((resolve) => {
    stdin.write(normalizedInput, (error) => {
      if (error) {
        resolve({ ok: false, message: error.message })
        return
      }
      resolve({ ok: true })
    })
  })
}

export async function stopFeishuInstallerSession(): Promise<{ ok: boolean }> {
  if (!activeSession || activeSession.phase !== 'running') {
    return { ok: true }
  }

  if (activeSession.strategy === 'managed-create-auth') {
    activeSession.cancel?.()
    return { ok: true }
  }

  const ok = await cancelActiveProcess(FEISHU_INSTALLER_CONTROL_DOMAIN)
  return { ok }
}
