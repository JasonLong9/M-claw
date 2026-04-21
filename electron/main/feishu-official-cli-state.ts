import type { CliResult } from './cli'
import {
  collectFeishuOfficialCliCommandDetail,
  FEISHU_OFFICIAL_CLI_COMMAND,
  FEISHU_OFFICIAL_CLI_STATUS_ARGS,
  FEISHU_OFFICIAL_CLI_VERSION_ARGS,
  isMissingFeishuOfficialCliDetail,
  normalizeFeishuOfficialCliVersion,
  runFeishuOfficialCli,
} from './feishu-official-cli'

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

function classifyAuthState(result: CliResult): FeishuOfficialCliAuthState {
  const detail = collectFeishuOfficialCliCommandDetail(result).toLowerCase()
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
    'please sign in',
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
      ? '当前未检测到可用的飞书官方 CLI，Mclaw 会继续使用内置插件接入流程。'
      : '当前机器还没有安装飞书官方 CLI。'
  }

  if (params.authState === 'authenticated') {
    return '已检测到飞书官方 CLI，且当前机器看起来已经完成官方登录。'
  }
  if (params.authState === 'unauthenticated') {
    return '已检测到飞书官方 CLI，但当前机器还没有完成官方登录。'
  }
  if (params.authState === 'error') {
    return '已检测到飞书官方 CLI，但当前无法可靠读取它的登录状态。'
  }
  return '已检测到飞书官方 CLI，但当前登录状态还不能被明确判定。'
}

function buildRecommendedAction(available: boolean, authState: FeishuOfficialCliAuthState): string {
  if (!available) {
    return '如果你后续需要走飞书官方 CLI 的浏览器登录或设备码流程，可额外安装 `@larksuite/cli`；这不是当前内置插件接入的前置条件。'
  }
  if (authState === 'unauthenticated') {
    return '可在终端执行 `lark-cli auth login --recommend` 完成官方登录，然后回到这里刷新状态。'
  }
  if (authState === 'authenticated') {
    return '飞书官方 CLI 登录已就绪；如需高级调试或官方授权链路，可再使用 `lark-cli config init --new` / `auth login`。'
  }
  return '可在终端执行 `lark-cli auth status` 或 `lark-cli auth login --recommend` 核对当前官方登录状态，然后回到这里刷新。'
}

export async function getFeishuOfficialCliStatus(): Promise<FeishuOfficialCliStatus> {
  const versionResult = await runFeishuOfficialCli([...FEISHU_OFFICIAL_CLI_VERSION_ARGS])
  const versionDetail = collectFeishuOfficialCliCommandDetail(versionResult)

  if (!versionResult.ok) {
    const missingCommand = isMissingFeishuOfficialCliDetail(versionDetail)
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
    version: normalizeFeishuOfficialCliVersion(versionResult.stdout),
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
