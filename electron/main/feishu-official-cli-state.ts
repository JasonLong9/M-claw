import type { CliResult } from './cli'
import { runShell } from './cli'
import { MAIN_RUNTIME_POLICY } from './runtime-policy'

const FEISHU_OFFICIAL_CLI_COMMAND = 'lark-cli'
const FEISHU_OFFICIAL_CLI_VERSION_ARGS = ['--version'] as const
const FEISHU_OFFICIAL_CLI_STATUS_ARGS = ['auth', 'status'] as const

export type FeishuOfficialCliAuthState = 'authenticated' | 'unauthenticated' | 'unknown' | 'error'

export interface FeishuOfficialCliStatus {
  available: boolean
  command: string
  version: string
  authState: FeishuOfficialCliAuthState
  summary: string
  recommendedAction: string
  versionCommand: string[]
  statusCommand: string[]
  statusOutput: string
  statusError: string
}

function extractFirstNonEmptyLine(text: string): string {
  for (const line of String(text || '').split(/\r?\n/g)) {
    const trimmed = line.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function collectCommandDetail(result: Pick<CliResult, 'stdout' | 'stderr'>): string {
  return [String(result.stderr || '').trim(), String(result.stdout || '').trim()]
    .filter(Boolean)
    .join('\n')
    .trim()
}

function normalizeVersion(output: string): string {
  const firstLine = extractFirstNonEmptyLine(output)
  if (!firstLine) return ''
  return firstLine
    .replace(/^lark-cli\s*/i, '')
    .replace(/^version[:\s]*/i, '')
    .trim()
}

function isMissingCommandDetail(detail: string): boolean {
  const normalized = String(detail || '').toLowerCase()
  return (
    normalized.includes('not recognized as an internal or external command') ||
    normalized.includes('command not found') ||
    normalized.includes('no such file or directory') ||
    normalized.includes('enoent') ||
    normalized.includes('不是内部或外部命令') ||
    normalized.includes('无法将') && normalized.includes('识别为') ||
    normalized.includes('未找到命令') ||
    normalized.includes('找不到指定的文件')
  )
}

function classifyAuthState(result: CliResult): FeishuOfficialCliAuthState {
  const detail = collectCommandDetail(result).toLowerCase()
  if (!detail) return result.ok ? 'unknown' : 'error'

  const negativeSignals = [
    'not logged',
    'not login',
    'login required',
    'please login',
    'please log in',
    'unauth',
    'not authenticated',
    'not authorized',
    '未登录',
    '请先登录',
    '未授权',
    '未认证',
  ]
  if (negativeSignals.some((signal) => detail.includes(signal))) {
    return 'unauthenticated'
  }

  const positiveSignals = [
    'logged in',
    'login success',
    'authenticated',
    'authorized',
    'auth ok',
    '已登录',
    '已授权',
    '认证成功',
    '授权成功',
  ]
  if (positiveSignals.some((signal) => detail.includes(signal))) {
    return 'authenticated'
  }

  return result.ok ? 'unknown' : 'error'
}

function buildSummary(params: {
  available: boolean
  authState: FeishuOfficialCliAuthState
  statusError: string
}): string {
  if (!params.available) {
    return params.statusError
      ? '未检测到飞书官方 CLI，当前仍以官方插件安装链路为主。'
      : '当前未检测到飞书官方 CLI。'
  }

  if (params.authState === 'authenticated') {
    return '已检测到飞书官方 CLI，且官方授权状态看起来已就绪。'
  }
  if (params.authState === 'unauthenticated') {
    return '已检测到飞书官方 CLI，但当前还没有完成官方授权登录。'
  }
  if (params.authState === 'error') {
    return '已检测到飞书官方 CLI，但读取官方授权状态失败。'
  }
  return '已检测到飞书官方 CLI，但当前无法可靠判断官方授权状态。'
}

function buildRecommendedAction(available: boolean, authState: FeishuOfficialCliAuthState): string {
  if (!available) {
    return '当前可以继续使用下面的官方插件安装器，不会与 lark-cli 冲突；如需补充官方 OAuth / scope 状态感知，请先执行 `npm install -g @larksuite/cli` 安装官方 CLI，完成后回到页面点击“刷新状态”。'
  }
  if (authState === 'unauthenticated') {
    return '建议先在终端执行 `lark-cli auth login` 完成官方授权；登录成功后回到这里点击“刷新状态”，然后继续使用下面的官方插件安装器完成 Bot 落盘。'
  }
  if (authState === 'authenticated') {
    return '官方授权层已可用；可以继续使用下面的官方插件安装器完成 Bot 落盘和渠道接入，两者当前按职责分层共存。'
  }
  return '建议在终端手动执行 `lark-cli auth status` 或 `lark-cli auth login` 复核当前授权状态；复核完成后回到页面点击“刷新状态”。复核期间仍可按需使用下面的官方插件安装器。'
}

async function runFeishuOfficialCli(args: string[]): Promise<CliResult> {
  return runShell(
    FEISHU_OFFICIAL_CLI_COMMAND,
    args,
    MAIN_RUNTIME_POLICY.cli.lightweightProbeTimeoutMs,
    {
      controlDomain: 'env-setup',
      shell: process.platform === 'win32',
    }
  )
}

export async function getFeishuOfficialCliStatus(): Promise<FeishuOfficialCliStatus> {
  const versionResult = await runFeishuOfficialCli([...FEISHU_OFFICIAL_CLI_VERSION_ARGS])
  const versionDetail = collectCommandDetail(versionResult)

  if (!versionResult.ok) {
    const missingCommand = isMissingCommandDetail(versionDetail)
    const statusError = missingCommand ? '' : versionDetail
    return {
      available: false,
      command: FEISHU_OFFICIAL_CLI_COMMAND,
      version: '',
      authState: 'unknown',
      summary: buildSummary({
        available: false,
        authState: 'unknown',
        statusError,
      }),
      recommendedAction: buildRecommendedAction(false, 'unknown'),
      versionCommand: [FEISHU_OFFICIAL_CLI_COMMAND, ...FEISHU_OFFICIAL_CLI_VERSION_ARGS],
      statusCommand: [FEISHU_OFFICIAL_CLI_COMMAND, ...FEISHU_OFFICIAL_CLI_STATUS_ARGS],
      statusOutput: String(versionResult.stdout || '').trim(),
      statusError,
    }
  }

  const statusResult = await runFeishuOfficialCli([...FEISHU_OFFICIAL_CLI_STATUS_ARGS])
  const authState = classifyAuthState(statusResult)
  const statusOutput = String(statusResult.stdout || '').trim()
  const statusError = String(statusResult.stderr || '').trim()

  return {
    available: true,
    command: FEISHU_OFFICIAL_CLI_COMMAND,
    version: normalizeVersion(versionResult.stdout),
    authState,
    summary: buildSummary({
      available: true,
      authState,
      statusError,
    }),
    recommendedAction: buildRecommendedAction(true, authState),
    versionCommand: [FEISHU_OFFICIAL_CLI_COMMAND, ...FEISHU_OFFICIAL_CLI_VERSION_ARGS],
    statusCommand: [FEISHU_OFFICIAL_CLI_COMMAND, ...FEISHU_OFFICIAL_CLI_STATUS_ARGS],
    statusOutput,
    statusError,
  }
}
