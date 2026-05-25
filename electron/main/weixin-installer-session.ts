import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { app } from 'electron'
import {
  cancelActiveProcess,
  clearActiveProcessIfMatch,
  consumeCanceledProcess,
  setActiveProcess,
} from './command-control'
import { probePlatformCommandCapability } from './command-capabilities'
import { getOpenClawPaths } from './cli'
import { resolveFeishuInstallerManagedOpenClawHomeEnvRoot } from './feishu-installer-env'
import { sanitizeManagedInstallerEnv } from './managed-installer-env'
import { cleanupIsolatedNpmCacheEnv, createIsolatedNpmCacheEnv } from './npm-cache-env'
import { inspectBundledOpenClawDeliveryStatus } from './openclaw-bundled-manifest'
import { resolveOpenClawBinaryPath } from './openclaw-package'
import { MAIN_RUNTIME_POLICY } from './runtime-policy'
import { buildCliPathWithCandidates } from './runtime-path-discovery'
import { resolveSafeWorkingDirectory } from './runtime-working-directory'
import { listWeixinAccountState } from './weixin-account-state'

const childProcess = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')
const { spawn } = childProcess

const WEIXIN_INSTALLER_CONTROL_DOMAIN = 'weixin-installer'
const WEIXIN_PLUGIN_SPEC = '@tencent-weixin/openclaw-weixin'

const WEIXIN_INSTALLER_BASE_COMMAND = [
  'plugins', 'install', WEIXIN_PLUGIN_SPEC,
] as const

async function resolveManagedOpenClawBinary(): Promise<string | null> {
  try {
    const binaryPath = await resolveOpenClawBinaryPath({
      env: process.env,
      platform: process.platform,
    })
    const trimmed = String(binaryPath).trim()
    if (trimmed) return trimmed
  } catch {
    // Best-effort resolution — fall back to PATH lookup by the shell.
  }
  return null
}

function buildWeixinInstallerShellCommand(openclawBin: string): string {
  const q = process.platform === 'win32' ? '"' : "'"
  const bin = `${q}${openclawBin}${q}`
  const pluginSpec = `${q}${WEIXIN_PLUGIN_SPEC}${q}`
  return [
    `${bin} plugins install ${pluginSpec}`,
    `${bin} config set plugins.entries.openclaw-weixin.enabled true`,
    `${bin} channels login --channel openclaw-weixin`,
  ].join(' && ')
}

function resolveWeixinInstallerNpmCacheDir(): string {
  return path.join(app.getPath('userData'), 'npm-cache')
}

export interface WeixinInstallerSessionSnapshot {
  active: boolean
  sessionId: string | null
  phase: 'idle' | 'running' | 'exited'
  output: string
  code: number | null
  ok: boolean
  canceled: boolean
  command: string[]
  beforeAccountIds: string[]
  afterAccountIds: string[]
  newAccountIds: string[]
}

export interface WeixinInstallerSessionEvent {
  sessionId: string
  type: 'started' | 'output' | 'exit'
  stream?: 'stdout' | 'stderr'
  chunk?: string
  phase?: WeixinInstallerSessionSnapshot['phase']
  code?: number | null
  ok?: boolean
  canceled?: boolean
  command?: string[]
  beforeAccountIds?: string[]
  afterAccountIds?: string[]
  newAccountIds?: string[]
}

interface ActiveWeixinInstallerSession {
  id: string
  process: ChildProcess
  phase: WeixinInstallerSessionSnapshot['phase']
  output: string
  code: number | null
  ok: boolean
  canceled: boolean
  command: string[]
  beforeAccountIds: string[]
  afterAccountIds: string[]
  newAccountIds: string[]
  npmCacheDir: string
}

let activeSession: ActiveWeixinInstallerSession | null = null

function buildSnapshot(): WeixinInstallerSessionSnapshot {
  if (!activeSession) {
    return {
      active: false,
      sessionId: null,
      phase: 'idle',
      output: '',
      code: null,
      ok: false,
      canceled: false,
      command: ['openclaw', ...WEIXIN_INSTALLER_BASE_COMMAND],
      beforeAccountIds: [],
      afterAccountIds: [],
      newAccountIds: [],
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
    beforeAccountIds: [...activeSession.beforeAccountIds],
    afterAccountIds: [...activeSession.afterAccountIds],
    newAccountIds: [...activeSession.newAccountIds],
  }
}

function appendOutput(stream: 'stdout' | 'stderr', chunk: string, emit: (event: WeixinInstallerSessionEvent) => void) {
  if (!activeSession) return
  activeSession.output += chunk
  emit({
    sessionId: activeSession.id,
    type: 'output',
    stream,
    chunk,
  })
}

async function collectAccountIds(): Promise<string[]> {
  const accounts = await listWeixinAccountState().catch(() => [])
  return accounts.map((account) => account.accountId)
}

async function finalizeSession(
  sessionId: string,
  emit: (event: WeixinInstallerSessionEvent) => void,
  params: { code: number | null; ok: boolean; canceled: boolean; extraOutput?: string }
): Promise<void> {
  if (!activeSession || activeSession.id !== sessionId) return
  const npmCacheDirForCleanup = activeSession.npmCacheDir

  if (params.extraOutput) {
    activeSession.output += params.extraOutput
  }

  const afterAccountIds = await collectAccountIds().catch(() => [])
  const beforeSet = new Set(activeSession.beforeAccountIds)
  const newAccountIds = afterAccountIds.filter((accountId) => !beforeSet.has(accountId))

  const pluginInstalled = newAccountIds.length > 0
  // Only report success when new accounts are actually detected. Exit code
  // alone is unreliable — `channels login` may return 0 without a completed
  // scan, which would cause finishWeixinChannelConnect to fail downstream.
  const effectiveOk = pluginInstalled && !params.canceled

  if (!effectiveOk && params.ok && !params.canceled) {
    activeSession.output +=
      '\n⚠️ 安装命令已执行完成，但未检测到新的微信账号。请确认已扫描二维码完成登录。\n'
  }

  if (!params.ok && effectiveOk) {
    activeSession.output +=
      '\n⚠️ 安装收尾步骤报告了非零退出码，但已检测到新的微信账号，插件安装与登录实际已完成。\n' +
      'Gateway 重载将由 Mclaw 统一接管，当前安装视为成功。\n'
  }

  activeSession.phase = 'exited'
  activeSession.code = params.code
  activeSession.ok = effectiveOk
  activeSession.canceled = params.canceled
  activeSession.afterAccountIds = afterAccountIds
  activeSession.newAccountIds = newAccountIds

  emit({
    sessionId,
    type: 'exit',
    phase: 'exited',
    code: params.code,
    ok: effectiveOk,
    canceled: params.canceled,
    beforeAccountIds: [...activeSession.beforeAccountIds],
    afterAccountIds: [...afterAccountIds],
    newAccountIds: [...newAccountIds],
  })
  await cleanupIsolatedNpmCacheEnv(npmCacheDirForCleanup)
}

export async function getWeixinInstallerSessionSnapshot(): Promise<WeixinInstallerSessionSnapshot> {
  return buildSnapshot()
}

export async function startWeixinInstallerSession(
  emit: (event: WeixinInstallerSessionEvent) => void
): Promise<WeixinInstallerSessionSnapshot> {
  if (activeSession?.phase === 'running') {
    return buildSnapshot()
  }

  const capability = await probePlatformCommandCapability('openclaw', {
    platform: process.platform,
    env: process.env,
  })
  if (!capability.available) {
    const errorSessionId = activeSession?.id || randomUUID()
    return {
      active: false,
      sessionId: errorSessionId,
      phase: 'exited',
      output: capability.message || 'openclaw 命令不可用，无法启动个人微信安装器。',
      code: 1,
      ok: false,
      canceled: false,
      command: [...WEIXIN_INSTALLER_BASE_COMMAND],
      beforeAccountIds: [],
      afterAccountIds: [],
      newAccountIds: [],
    }
  }

  const openclawBin = await resolveManagedOpenClawBinary()
  if (!openclawBin) {
    const errorSessionId = activeSession?.id || randomUUID()
    return {
      active: false,
      sessionId: errorSessionId,
      phase: 'exited',
      output: '无法定位托管的 openclaw 可执行文件，请确认 OpenClaw 已正确安装。',
      code: 1,
      ok: false,
      canceled: false,
      command: [...WEIXIN_INSTALLER_BASE_COMMAND],
      beforeAccountIds: [],
      afterAccountIds: [],
      newAccountIds: [],
    }
  }

  const shellCommand = buildWeixinInstallerShellCommand(openclawBin)

  const npmCacheDir = resolveWeixinInstallerNpmCacheDir()
  const isolatedNpmCache = await createIsolatedNpmCacheEnv(npmCacheDir)
  const openClawPaths = await getOpenClawPaths().catch(() => null)
  const homeEnvRoot = resolveFeishuInstallerManagedOpenClawHomeEnvRoot(openClawPaths)
  const baseEnv = sanitizeManagedInstallerEnv(process.env)
  const managedOpenClawEnv: NodeJS.ProcessEnv = { ...baseEnv }

  // Derive OPENCLAW_HOME (the directory containing .openclaw state).
  const resolvedHome = String(baseEnv.OPENCLAW_HOME || homeEnvRoot || '').trim()
  if (resolvedHome) {
    managedOpenClawEnv.OPENCLAW_HOME = resolvedHome
  } else {
    const userDataDir = String(
      process.env.QCLAW_USER_DATA_DIR || app.getPath('userData')
    ).trim()
    managedOpenClawEnv.OPENCLAW_HOME = path.join(userDataDir, 'openclaw-state')
  }

  // Explicitly set OPENCLAW_STATE_DIR so the CLI does NOT derive it as
  // <OPENCLAW_HOME>/.openclaw — which would double-nest when the probed
  // state root already is the .openclaw directory.
  const probedHomeDir = String(openClawPaths?.homeDir || '').trim()
  if (probedHomeDir) {
    // Ensure the state directory points to the actual .openclaw config
    // directory.  The probed homeDir may be the managed root (e.g.
    // .../openclaw-state) which needs .openclaw appended, or it may
    // already be the .openclaw directory itself.
    const normalizedLeaf = path.basename(probedHomeDir).toLowerCase()
    managedOpenClawEnv.OPENCLAW_STATE_DIR =
      normalizedLeaf === '.openclaw'
        ? probedHomeDir
        : path.join(probedHomeDir, '.openclaw')
  } else {
    managedOpenClawEnv.OPENCLAW_STATE_DIR = path.join(
      String(managedOpenClawEnv.OPENCLAW_HOME || '').trim(),
      '.openclaw'
    )
  }

  if (openClawPaths?.configFile) {
    managedOpenClawEnv.OPENCLAW_CONFIG_PATH = String(
      baseEnv.OPENCLAW_CONFIG_PATH || openClawPaths.configFile
    ).trim()
  }

  const bundledStatus = inspectBundledOpenClawDeliveryStatus({
    cwd: process.cwd(),
    resourcesPath: process.resourcesPath,
    env: process.env,
    platform: process.platform,
  })
  const runtimeBinDir = String(bundledStatus.runtimePath || '').trim() || null

  const beforeAccountIds = await collectAccountIds().catch(() => [])
  const sessionId = randomUUID()
  const displayCommand = ['openclaw', ...WEIXIN_INSTALLER_BASE_COMMAND]
  const proc = spawn(shellCommand, [], {
    cwd: resolveSafeWorkingDirectory({
      env: managedOpenClawEnv,
      platform: process.platform,
    }),
    env: {
      ...managedOpenClawEnv,
      PATH: buildCliPathWithCandidates({
        platform: process.platform,
        currentPath: managedOpenClawEnv.PATH || process.env.PATH || '',
        detectedNodeBinDir: runtimeBinDir,
        env: managedOpenClawEnv,
      }),
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      ...isolatedNpmCache.env,
      npm_config_registry: 'https://registry.npmmirror.com',
      NPM_CONFIG_REGISTRY: 'https://registry.npmmirror.com',
    },
    shell: true,
    windowsHide: true,
    timeout: MAIN_RUNTIME_POLICY.cli.pluginInstallNpxTimeoutMs,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  activeSession = {
    id: sessionId,
    process: proc,
    phase: 'running',
    output: '',
    code: null,
    ok: false,
    canceled: false,
    command: displayCommand,
    beforeAccountIds,
    afterAccountIds: [],
    newAccountIds: [],
    npmCacheDir: isolatedNpmCache.cacheDir,
  }
  setActiveProcess(proc, WEIXIN_INSTALLER_CONTROL_DOMAIN)

  emit({
    sessionId,
    type: 'started',
    phase: 'running',
    command: displayCommand,
    beforeAccountIds: [...beforeAccountIds],
  })

  proc.stdout?.on('data', (chunk) => {
    appendOutput('stdout', String(chunk), emit)
  })

  proc.stderr?.on('data', (chunk) => {
    appendOutput('stderr', String(chunk), emit)
  })

  proc.on('close', (code) => {
    if (!activeSession || activeSession.id !== sessionId) return
    clearActiveProcessIfMatch(proc, WEIXIN_INSTALLER_CONTROL_DOMAIN)
    const canceled = consumeCanceledProcess(proc, WEIXIN_INSTALLER_CONTROL_DOMAIN)
    void finalizeSession(sessionId, emit, {
      code: canceled ? null : code,
      ok: code === 0 && !canceled,
      canceled,
    })
  })

  proc.on('error', (error) => {
    if (!activeSession || activeSession.id !== sessionId) return
    clearActiveProcessIfMatch(proc, WEIXIN_INSTALLER_CONTROL_DOMAIN)
    const canceled = consumeCanceledProcess(proc, WEIXIN_INSTALLER_CONTROL_DOMAIN)
    void finalizeSession(sessionId, emit, {
      code: canceled ? null : 1,
      ok: false,
      canceled,
      extraOutput: `\n${error instanceof Error ? error.message : String(error)}`,
    })
  })

  return buildSnapshot()
}

export async function stopWeixinInstallerSession(): Promise<{ ok: boolean }> {
  if (!activeSession || activeSession.phase !== 'running') {
    return { ok: true }
  }
  const proc = activeSession.process
  const ok = await cancelActiveProcess(WEIXIN_INSTALLER_CONTROL_DOMAIN)

  if (process.platform !== 'win32' && typeof proc.pid === 'number' && proc.pid > 0) {
    try {
      process.kill(-proc.pid, 'SIGTERM')
    } catch {
      // Ignore best-effort process tree termination failures.
    }
    setTimeout(() => {
      try {
        process.kill(-proc.pid!, 'SIGKILL')
      } catch {
        // Ignore if the process group already exited.
      }
    }, MAIN_RUNTIME_POLICY.processControl.cancelGracePeriodMs)
  }

  return { ok }
}
