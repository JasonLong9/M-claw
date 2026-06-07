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
import { MAIN_RUNTIME_POLICY } from './runtime-policy'
import { buildCliPathWithCandidates } from './runtime-path-discovery'
import { resolveSafeWorkingDirectory } from './runtime-working-directory'
import { listWeixinAccountState } from './weixin-account-state'
import { cleanupIsolatedNpmCacheEnv, createIsolatedNpmCacheEnv } from './npm-cache-env'
import { inspectBundledOpenClawDeliveryStatus } from './openclaw-bundled-manifest'
import { resolveBundledManagedPluginSourcePath } from './openclaw-bundled-managed-plugin'
import { getOpenClawPaths } from './cli'

const childProcess = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')
const { spawn } = childProcess

const WEIXIN_INSTALLER_CONTROL_DOMAIN = 'weixin-installer'
const WEIXIN_PLUGIN_ID = 'openclaw-weixin'
const WEIXIN_INSTALLER_PACKAGE = '@tencent-weixin/openclaw-weixin-cli@latest'
const WEIXIN_INSTALLER_COMMAND = ['npx', '-y', WEIXIN_INSTALLER_PACKAGE, 'install'] as const
const WEIXIN_LOGIN_NETWORK_FAILURE_REGEX =
  /\bfetch failed\b|\benotfound\b|\beconnreset\b|\beconnrefused\b|timed out|timeout|network|dns|proxy|certificate|tls|ssl|socket hang up/i
const WEIXIN_PLUGIN_ALREADY_EXISTS_REGEX =
  /plugin already exists|already exists: .*openclaw-weixin|delete it first/i

function resolveWeixinInstallerNpmCacheDir(): string {
  return path.join(app.getPath('userData'), 'npm-cache')
}

function resolveBundledOpenClawCliPath(): string | null {
  const bundledDeliveryStatus = inspectBundledOpenClawDeliveryStatus({
    cwd: process.cwd(),
    resourcesPath: process.resourcesPath,
    env: process.env,
    platform: process.platform,
  })
  return String(bundledDeliveryStatus.runtimeBinaryPath || '').trim() || null
}

function resolveBundledWeixinPluginPath(): string | null {
  const sourcePath = resolveBundledManagedPluginSourcePath({
    pluginId: WEIXIN_PLUGIN_ID,
    resourcesPath: process.resourcesPath,
    cwd: process.cwd(),
  })
  return String(sourcePath || '').trim() || null
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
  process: ChildProcess | null
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
      command: [...WEIXIN_INSTALLER_COMMAND],
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

  activeSession.phase = 'exited'
  activeSession.code = params.code
  activeSession.ok = params.ok
  activeSession.canceled = params.canceled
  activeSession.afterAccountIds = afterAccountIds
  activeSession.newAccountIds = newAccountIds

  emit({
    sessionId,
    type: 'exit',
    phase: 'exited',
    code: params.code,
    ok: params.ok,
    canceled: params.canceled,
    beforeAccountIds: [...activeSession.beforeAccountIds],
    afterAccountIds: [...afterAccountIds],
    newAccountIds: [...newAccountIds],
  })
  await cleanupIsolatedNpmCacheEnv(npmCacheDirForCleanup)
}

async function spawnCommand(command: string[], emit: (event: WeixinInstallerSessionEvent) => void, sessionId: string): Promise<number | null> {
  const openClawPaths = await getOpenClawPaths().catch(() => null)
  const openClawStateDir = process.env.OPENCLAW_STATE_DIR || (openClawPaths?.homeDir ? String(openClawPaths.homeDir).trim() : undefined)

  return new Promise((resolve) => {
    const proc = spawn(command[0], command.slice(1), {
      cwd: resolveSafeWorkingDirectory({
        env: process.env,
        platform: process.platform,
      }),
      env: {
        ...process.env,
        ...(openClawStateDir ? { OPENCLAW_STATE_DIR: openClawStateDir } : {}),
        OPENCLAW_WEIXIN_SKIP_CONFIG_RELOAD: '1',
        PATH: buildCliPathWithCandidates({
          platform: process.platform,
          currentPath: process.env.PATH || '',
          env: process.env,
        }),
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      detached: process.platform !== 'win32',
      shell: process.platform === 'win32',
      timeout: MAIN_RUNTIME_POLICY.cli.pluginInstallNpxTimeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (activeSession && activeSession.id === sessionId) {
      activeSession.process = proc
      activeSession.command = [...command]
    }
    setActiveProcess(proc, WEIXIN_INSTALLER_CONTROL_DOMAIN)
    proc.stdout?.on('data', (chunk) => appendOutput('stdout', String(chunk), emit))
    proc.stderr?.on('data', (chunk) => appendOutput('stderr', String(chunk), emit))
    proc.on('close', (code) => {
      clearActiveProcessIfMatch(proc, WEIXIN_INSTALLER_CONTROL_DOMAIN)
      const canceled = consumeCanceledProcess(proc, WEIXIN_INSTALLER_CONTROL_DOMAIN)
      resolve(canceled ? null : code)
    })
    proc.on('error', (error) => {
      clearActiveProcessIfMatch(proc, WEIXIN_INSTALLER_CONTROL_DOMAIN)
      appendOutput('stderr', `\n${error instanceof Error ? error.message : String(error)}\n`, emit)
      resolve(1)
    })
  })
}

function buildWeixinLoginNetworkDiagnostic(rawOutput: string): string {
  const corpus = String(rawOutput || '')
  if (!WEIXIN_LOGIN_NETWORK_FAILURE_REGEX.test(corpus)) return ''
  return [
    '',
    '[Mclaw] 检测到个人微信登录阶段网络异常（fetch failed）。',
    '[Mclaw] 当前内置插件已安装成功，失败点在扫码登录请求。',
    '[Mclaw] 请检查网络是否可访问 https://ilinkai.weixin.qq.com （DNS/代理/防火墙/TLS 证书）。',
    '[Mclaw] 若在公司网络，请先切换到可直连网络后重试“开始连接”。',
    '',
  ].join('\n')
}

function isWeixinInstallAlreadyExistsFailure(rawOutput: string): boolean {
  return WEIXIN_PLUGIN_ALREADY_EXISTS_REGEX.test(String(rawOutput || ''))
}

export async function getWeixinInstallerSessionSnapshot(): Promise<WeixinInstallerSessionSnapshot> {
  return buildSnapshot()
}

export async function startWeixinInstallerSession(
  emit: (event: WeixinInstallerSessionEvent) => void
): Promise<WeixinInstallerSessionSnapshot> {
  if (activeSession?.phase === 'running') return buildSnapshot()

  const npmCacheDir = resolveWeixinInstallerNpmCacheDir()
  const isolatedNpmCache = await createIsolatedNpmCacheEnv(npmCacheDir)
  const beforeAccountIds = await collectAccountIds().catch(() => [])
  const sessionId = randomUUID()

  activeSession = {
    id: sessionId,
    process: null,
    phase: 'running',
    output: '',
    code: null,
    ok: false,
    canceled: false,
    command: [...WEIXIN_INSTALLER_COMMAND],
    beforeAccountIds,
    afterAccountIds: [],
    newAccountIds: [],
    npmCacheDir: isolatedNpmCache.cacheDir,
  }

  emit({
    sessionId,
    type: 'started',
    phase: 'running',
    command: [...WEIXIN_INSTALLER_COMMAND],
    beforeAccountIds: [...beforeAccountIds],
  })

  void (async () => {
    const bundledOpenClawCli = resolveBundledOpenClawCliPath()
    const bundledWeixinPlugin = resolveBundledWeixinPluginPath()

    if (bundledOpenClawCli && bundledWeixinPlugin) {
      appendOutput('stdout', `[Mclaw] Offline mode: install bundled weixin plugin from ${bundledWeixinPlugin}\n`, emit)
      const installCode = await spawnCommand(
        [bundledOpenClawCli, 'plugins', 'install', bundledWeixinPlugin],
        emit,
        sessionId
      )
      const installOutput = activeSession && activeSession.id === sessionId ? activeSession.output : ''
      const installAlreadyExists = installCode !== 0 && isWeixinInstallAlreadyExistsFailure(installOutput)
      if (installCode !== 0 && !installAlreadyExists) {
        await finalizeSession(sessionId, emit, {
          code: installCode,
          ok: false,
          canceled: false,
          extraOutput: '\n[Mclaw] Offline bundled plugin installation failed.\n',
        })
        return
      }
      if (installAlreadyExists) {
        appendOutput('stdout', '\n[Mclaw] Detected existing openclaw-weixin plugin, skip reinstall and continue.\n', emit)
      }

      const enableCode = await spawnCommand(
        [bundledOpenClawCli, 'config', 'set', 'plugins.entries.openclaw-weixin.enabled', 'true'],
        emit,
        sessionId
      )
      if (enableCode !== 0) {
        await finalizeSession(sessionId, emit, {
          code: enableCode,
          ok: false,
          canceled: false,
          extraOutput: '\n[Mclaw] Enable openclaw-weixin plugin failed.\n',
        })
        return
      }

      const loginCode = await spawnCommand(
        [bundledOpenClawCli, 'channels', 'login', '--channel', 'openclaw-weixin'],
        emit,
        sessionId
      )
      const loginDiagnostic =
        loginCode === 0 || !activeSession || activeSession.id !== sessionId
          ? ''
          : buildWeixinLoginNetworkDiagnostic(activeSession.output)
      await finalizeSession(sessionId, emit, {
        code: loginCode,
        ok: loginCode === 0,
        canceled: false,
        extraOutput: loginDiagnostic,
      })
      return
    }

    const capability = await probePlatformCommandCapability('npx', {
      platform: process.platform,
      env: process.env,
    })
    if (!capability.available) {
      await finalizeSession(sessionId, emit, {
        code: 1,
        ok: false,
        canceled: false,
        extraOutput: '\nnpx command is unavailable. Install or repair Node.js before continuing.\n',
      })
      return
    }

    appendOutput('stderr', '\n[Mclaw] Bundled offline weixin plugin is unavailable, fallback to online installer.\n', emit)
    const onlineCode = await spawnCommand([...WEIXIN_INSTALLER_COMMAND], emit, sessionId)
    await finalizeSession(sessionId, emit, {
      code: onlineCode,
      ok: onlineCode === 0,
      canceled: false,
    })
  })()

  return buildSnapshot()
}

export async function stopWeixinInstallerSession(): Promise<{ ok: boolean }> {
  if (!activeSession || activeSession.phase !== 'running') {
    return { ok: true }
  }
  const proc = activeSession.process
  const ok = await cancelActiveProcess(WEIXIN_INSTALLER_CONTROL_DOMAIN)

  if (proc && process.platform !== 'win32' && typeof proc.pid === 'number' && proc.pid > 0) {
    try {
      process.kill(-proc.pid, 'SIGTERM')
    } catch {}
    setTimeout(() => {
      try {
        process.kill(-proc.pid!, 'SIGKILL')
      } catch {}
    }, MAIN_RUNTIME_POLICY.processControl.cancelGracePeriodMs)
  }

  return { ok }
}
