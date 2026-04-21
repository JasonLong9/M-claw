import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { shell } from 'electron'
import {
  cancelActiveProcess,
  clearActiveProcessIfMatch,
  consumeCanceledProcess,
  setActiveProcess,
} from './command-control'
import { buildCliPathWithCandidates } from './runtime-path-discovery'
import { resolveSafeWorkingDirectory } from './runtime-working-directory'
import { MAIN_RUNTIME_POLICY } from './runtime-policy'
import { createOAuthChallengeScanner } from './oauth-browser'
import {
  buildFeishuOfficialCliGuidedArgs,
  buildFeishuOfficialCliGuidedCommand,
  collectFeishuOfficialCliCommandDetail,
  type FeishuOfficialCliGuidedMode,
  runFeishuOfficialCli,
} from './feishu-official-cli'

const childProcess = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')
const { spawn } = childProcess

const FEISHU_OFFICIAL_CLI_CONTROL_DOMAIN = 'feishu-lark-cli'

export interface FeishuOfficialCliSessionSnapshot {
  active: boolean
  sessionId: string | null
  phase: 'idle' | 'running' | 'exited'
  mode: FeishuOfficialCliGuidedMode | null
  output: string
  code: number | null
  ok: boolean
  canceled: boolean
  command: string[]
  latestAuthUrl: string
  latestUserCode: string
}

export interface FeishuOfficialCliSessionEvent {
  sessionId: string
  type: 'started' | 'output' | 'challenge' | 'exit'
  stream?: 'stdout' | 'stderr'
  chunk?: string
  phase?: FeishuOfficialCliSessionSnapshot['phase']
  code?: number | null
  ok?: boolean
  canceled?: boolean
  command?: string[]
  mode?: FeishuOfficialCliGuidedMode | null
  latestAuthUrl?: string
  latestUserCode?: string
}

interface ActiveFeishuOfficialCliSession {
  id: string
  process: ChildProcess
  phase: FeishuOfficialCliSessionSnapshot['phase']
  mode: FeishuOfficialCliGuidedMode
  output: string
  code: number | null
  ok: boolean
  canceled: boolean
  command: string[]
  latestAuthUrl: string
  latestUserCode: string
}

let activeSession: ActiveFeishuOfficialCliSession | null = null

function buildSnapshot(): FeishuOfficialCliSessionSnapshot {
  if (!activeSession) {
    return {
      active: false,
      sessionId: null,
      phase: 'idle',
      mode: null,
      output: '',
      code: null,
      ok: false,
      canceled: false,
      command: [],
      latestAuthUrl: '',
      latestUserCode: '',
    }
  }

  return {
    active: activeSession.phase === 'running',
    sessionId: activeSession.id,
    phase: activeSession.phase,
    mode: activeSession.mode,
    output: activeSession.output,
    code: activeSession.code,
    ok: activeSession.ok,
    canceled: activeSession.canceled,
    command: [...activeSession.command],
    latestAuthUrl: activeSession.latestAuthUrl,
    latestUserCode: activeSession.latestUserCode,
  }
}

function appendOutput(
  stream: 'stdout' | 'stderr',
  chunk: string,
  emit: (event: FeishuOfficialCliSessionEvent) => void,
  scanChallenge: (chunk: string) => void
) {
  if (!activeSession) return
  activeSession.output += chunk
  emit({
    sessionId: activeSession.id,
    type: 'output',
    stream,
    chunk,
    mode: activeSession.mode,
    command: [...activeSession.command],
  })
  scanChallenge(chunk)
}

function finalizeSession(
  sessionId: string,
  emit: (event: FeishuOfficialCliSessionEvent) => void,
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
  }

  activeSession.phase = 'exited'
  activeSession.code = params.code
  activeSession.ok = params.ok
  activeSession.canceled = params.canceled

  emit({
    sessionId,
    type: 'exit',
    phase: 'exited',
    code: params.code,
    ok: params.ok,
    canceled: params.canceled,
    mode: activeSession.mode,
    command: [...activeSession.command],
    latestAuthUrl: activeSession.latestAuthUrl,
    latestUserCode: activeSession.latestUserCode,
  })
}

export async function getFeishuOfficialCliSessionSnapshot(): Promise<FeishuOfficialCliSessionSnapshot> {
  return buildSnapshot()
}

export async function startFeishuOfficialCliSession(
  mode: FeishuOfficialCliGuidedMode,
  emit: (event: FeishuOfficialCliSessionEvent) => void
): Promise<FeishuOfficialCliSessionSnapshot> {
  if (activeSession?.phase === 'running') {
    return buildSnapshot()
  }

  const versionProbe = await runFeishuOfficialCli(['--version'])
  if (!versionProbe.ok) {
    return {
      active: false,
      sessionId: activeSession?.id || randomUUID(),
      phase: 'exited',
      mode,
      output:
        collectFeishuOfficialCliCommandDetail(versionProbe)
        || 'lark-cli is unavailable, so Mclaw cannot start the official guided flow.',
      code: versionProbe.code ?? 1,
      ok: false,
      canceled: Boolean(versionProbe.canceled),
      command: buildFeishuOfficialCliGuidedCommand(mode),
      latestAuthUrl: '',
      latestUserCode: '',
    }
  }

  const sessionId = randomUUID()
  const command = buildFeishuOfficialCliGuidedCommand(mode)
  const proc = spawn(command[0], buildFeishuOfficialCliGuidedArgs(mode), {
    cwd: resolveSafeWorkingDirectory({
      env: process.env,
      platform: process.platform,
    }),
    env: {
      ...process.env,
      PATH: buildCliPathWithCandidates({
        platform: process.platform,
        currentPath: process.env.PATH || '',
        env: process.env,
      }),
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
    shell: process.platform === 'win32',
    timeout: MAIN_RUNTIME_POLICY.cli.pluginInstallNpxTimeoutMs,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })

  activeSession = {
    id: sessionId,
    process: proc,
    phase: 'running',
    mode,
    output: '',
    code: null,
    ok: false,
    canceled: false,
    command,
    latestAuthUrl: '',
    latestUserCode: '',
  }
  setActiveProcess(proc, FEISHU_OFFICIAL_CLI_CONTROL_DOMAIN)

  const scanChallenge = createOAuthChallengeScanner((challenge) => {
    if (!activeSession || activeSession.id !== sessionId) return
    activeSession.latestAuthUrl = challenge.verificationUri
    activeSession.latestUserCode = String(challenge.userCode || '').trim()
    emit({
      sessionId,
      type: 'challenge',
      mode,
      command: [...activeSession.command],
      latestAuthUrl: activeSession.latestAuthUrl,
      latestUserCode: activeSession.latestUserCode,
    })
    void shell.openExternal(challenge.verificationUri).catch(() => {
      // Keep the URL in state even if opening the browser fails.
    })
  })

  emit({
    sessionId,
    type: 'started',
    phase: 'running',
    mode,
    command,
  })

  proc.stdout?.on('data', (chunk) => {
    appendOutput('stdout', String(chunk), emit, scanChallenge)
  })

  proc.stderr?.on('data', (chunk) => {
    appendOutput('stderr', String(chunk), emit, scanChallenge)
  })

  proc.on('close', (code) => {
    if (!activeSession || activeSession.id !== sessionId) return
    clearActiveProcessIfMatch(proc, FEISHU_OFFICIAL_CLI_CONTROL_DOMAIN)
    const canceled = consumeCanceledProcess(proc, FEISHU_OFFICIAL_CLI_CONTROL_DOMAIN)
    finalizeSession(sessionId, emit, {
      code: canceled ? null : code,
      ok: code === 0 && !canceled,
      canceled,
    })
  })

  proc.on('error', (error) => {
    if (!activeSession || activeSession.id !== sessionId) return
    clearActiveProcessIfMatch(proc, FEISHU_OFFICIAL_CLI_CONTROL_DOMAIN)
    const canceled = consumeCanceledProcess(proc, FEISHU_OFFICIAL_CLI_CONTROL_DOMAIN)
    finalizeSession(sessionId, emit, {
      code: canceled ? null : 1,
      ok: false,
      canceled,
      extraOutput: `\n${error instanceof Error ? error.message : String(error)}`,
    })
  })

  return buildSnapshot()
}

export async function writeFeishuOfficialCliSessionInput(
  sessionId: string,
  input: string
): Promise<{ ok: boolean; message?: string }> {
  if (!activeSession || activeSession.id !== sessionId || activeSession.phase !== 'running') {
    return { ok: false, message: 'The official lark-cli guided session is not running.' }
  }

  const normalizedInput = String(input || '')
  if (!normalizedInput) {
    return { ok: false, message: 'Input cannot be empty.' }
  }

  const stdin = activeSession.process.stdin
  if (!stdin || stdin.destroyed || !stdin.writable) {
    return { ok: false, message: 'The official lark-cli session is no longer writable.' }
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

export async function stopFeishuOfficialCliSession(): Promise<{ ok: boolean }> {
  if (!activeSession || activeSession.phase !== 'running') {
    return { ok: true }
  }
  const ok = await cancelActiveProcess(FEISHU_OFFICIAL_CLI_CONTROL_DOMAIN)
  return { ok }
}
