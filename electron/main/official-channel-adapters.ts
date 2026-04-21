import { getFeishuBotRuntimeStatuses, isPluginInstalledOnDisk, runCli } from './cli'
import { repairDingtalkOfficialChannel } from './dingtalk-official-channel'
import { ensureFeishuOfficialPluginReady, getFeishuOfficialPluginState } from './feishu-official-plugin-state'
import { parseJsonFromCommandResult } from './openclaw-command-output'
import { rerunReadOnlyCommandAfterStalePluginRepair } from './openclaw-readonly-stale-plugin-repair'
import type {
  OfficialChannelActionResult,
  OfficialChannelAdapterId,
  OfficialChannelSetupEvidence,
  OfficialChannelStatusStage,
  OfficialChannelStatusStageState,
  OfficialChannelStatusView,
} from '../../src/shared/official-channel-integration'

interface FeishuOfficialRepairResultLike {
  ok: boolean
  installedThisRun: boolean
  state: {
    pluginId: string
    installedOnDisk: boolean
    officialPluginConfigured: boolean
    configChanged: boolean
  }
  stdout: string
  stderr: string
  code: number | null
  message?: string
}

interface FeishuRuntimeStatusLike {
  runtimeState?: 'online' | 'offline' | 'degraded' | 'disabled'
  summary?: string
  issues?: string[]
  gatewayRunning?: boolean
}

interface FeishuRuntimeStageSummary {
  loadedState: OfficialChannelStatusStageState
  loadedSource: string
  loadedMessage: string
  readyState: OfficialChannelStatusStageState
  readySource: string
  readyMessage: string
  summary: string
  evidence: OfficialChannelSetupEvidence[]
}

function hasOwnRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeText(value: unknown): string {
  return String(value || '').trim()
}

function normalizePluginId(value: unknown): string {
  return normalizeText(value).toLowerCase()
}

function createStage(
  id: OfficialChannelStatusStage['id'],
  state: OfficialChannelStatusStageState,
  source: string,
  message: string
): OfficialChannelStatusStage {
  return { id, state, source, message }
}

function collectPluginListEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!hasOwnRecord(payload)) return []

  for (const key of ['plugins', 'items', 'list', 'entries', 'data'] as const) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  if (hasOwnRecord(payload.plugins)) {
    return Object.entries(payload.plugins).map(([id, value]) =>
      hasOwnRecord(value)
        ? { id, ...value }
        : { id }
    )
  }

  return []
}

function extractPluginIdsFromPayload(payload: unknown): string[] {
  const pluginIds = new Set<string>()

  for (const item of collectPluginListEntries(payload)) {
    if (typeof item === 'string') {
      const pluginId = normalizePluginId(item)
      if (pluginId) pluginIds.add(pluginId)
      continue
    }

    if (!hasOwnRecord(item)) continue

    const candidates = [
      item.id,
      item.pluginId,
      item.name,
      hasOwnRecord(item.manifest) ? item.manifest.id : '',
      hasOwnRecord(item.plugin) ? item.plugin.id : '',
      hasOwnRecord(item.extension) ? item.extension.id : '',
    ]

    for (const candidate of candidates) {
      const pluginId = normalizePluginId(candidate)
      if (pluginId) pluginIds.add(pluginId)
    }
  }

  return Array.from(pluginIds)
}

async function detectRegisteredPlugin(params: {
  channelId: OfficialChannelAdapterId
  pluginId: string
}): Promise<{
  state: OfficialChannelStatusStageState
  evidence: OfficialChannelSetupEvidence
}> {
  const listResult = await rerunReadOnlyCommandAfterStalePluginRepair(
    () => runCli(['plugins', 'list', '--json'], undefined, 'plugin-install')
  ).catch(() => null)

  if (!listResult || !listResult.ok) {
    return {
      state: 'unknown',
      evidence: {
        source: 'plugins-list',
        channelId: params.channelId,
        pluginId: params.pluginId,
        command: 'openclaw plugins list --json',
        message: '无法从 plugins list 确认插件注册状态，registered 暂记 unknown。',
        detail: normalizeText(listResult?.stderr) || normalizeText(listResult?.stdout),
      },
    }
  }

  try {
    const payload = parseJsonFromCommandResult<unknown>(listResult)
    const pluginIds = extractPluginIdsFromPayload(payload)
    const registered = pluginIds.includes(normalizePluginId(params.pluginId))

    return {
      state: registered ? 'verified' : 'missing',
      evidence: {
        source: 'plugins-list',
        channelId: params.channelId,
        pluginId: params.pluginId,
        command: 'openclaw plugins list --json',
        message: registered
          ? '已在上游 plugins list 中确认插件已注册。'
          : '当前尚未在上游 plugins list 中确认插件注册。',
      },
    }
  } catch (error) {
    return {
      state: 'unknown',
      evidence: {
        source: 'plugins-list',
        channelId: params.channelId,
        pluginId: params.pluginId,
        command: 'openclaw plugins list --json',
        message: 'plugins list 输出暂不可解析，registered 暂记 unknown。',
        detail: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

function getFeishuRuntimeBlockingReason(
  entries: Array<[string, FeishuRuntimeStatusLike]>
): string {
  for (const [, status] of entries) {
    const summary = normalizeText(status.summary)
    if (summary) return summary

    const firstIssue = Array.isArray(status.issues)
      ? status.issues.map((item) => normalizeText(item)).find(Boolean)
      : ''
    if (firstIssue) return firstIssue
  }

  return ''
}

function buildFeishuRuntimeStageSummary(params: {
  pluginId: string
  runtimeStatuses: Record<string, FeishuRuntimeStatusLike> | null
  runtimeError: string
}): FeishuRuntimeStageSummary {
  if (params.runtimeError) {
    return {
      loadedState: 'unknown',
      loadedSource: 'gateway-runtime-error',
      loadedMessage: '飞书运行态读取失败，loaded 暂记 unknown。',
      readyState: 'unknown',
      readySource: 'gateway-runtime-error',
      readyMessage: '飞书运行态读取失败，ready 暂记 unknown。',
      summary: '飞书运行态读取失败，loaded / ready 暂无法证明。',
      evidence: [{
        source: 'status',
        channelId: 'feishu',
        pluginId: params.pluginId,
        message: '飞书运行态读取失败，loaded / ready 暂无法证明。',
        detail: params.runtimeError,
      }],
    }
  }

  const entries = Object.entries(params.runtimeStatuses || {}).filter(([, value]) => hasOwnRecord(value))
  if (entries.length === 0) {
    return {
      loadedState: 'unknown',
      loadedSource: 'status',
      loadedMessage: '当前还没有具备完整凭据的飞书 Bot，loaded 暂记 unknown。',
      readyState: 'unknown',
      readySource: 'status',
      readyMessage: '当前还没有具备完整凭据的飞书 Bot，ready 暂记 unknown。',
      summary: '当前还没有具备完整凭据的飞书 Bot，loaded / ready 暂无运行态证据。',
      evidence: [{
        source: 'status',
        channelId: 'feishu',
        pluginId: params.pluginId,
        message: '当前还没有具备完整凭据的飞书 Bot，loaded / ready 暂无运行态证据。',
      }],
    }
  }

  const anyGatewayRunning = entries.some(([, status]) => status.gatewayRunning === true)
  const onlineEntries = entries.filter(([, status]) => status.runtimeState === 'online')
  const blockingReason = getFeishuRuntimeBlockingReason(
    entries.filter(([, status]) => status.runtimeState !== 'online')
  )

  return {
    loadedState: anyGatewayRunning ? 'verified' : 'missing',
    loadedSource: 'gateway-runtime',
    loadedMessage: anyGatewayRunning
      ? '已通过飞书运行态确认当前 Gateway 已暴露飞书 Bot 运行快照。'
      : '当前已检测到飞书 Bot 配置，但 Gateway 未运行。',
    readyState: onlineEntries.length > 0 ? 'verified' : 'missing',
    readySource: 'gateway-runtime',
    readyMessage: onlineEntries.length > 0
      ? `已通过飞书运行态确认 ${onlineEntries.length} 个飞书 Bot 处于在线状态。`
      : blockingReason
        ? `当前飞书 Bot 尚未 ready：${blockingReason}`
        : '当前飞书 Bot 尚未 ready。',
    summary: onlineEntries.length > 0
      ? `已通过飞书运行态确认 ${onlineEntries.length} 个飞书 Bot 运行中。`
      : anyGatewayRunning
        ? (
            blockingReason
              ? `Gateway 已运行，但飞书 Bot 仍待修复：${blockingReason}`
              : 'Gateway 已运行，但飞书 Bot 仍待修复。'
          )
        : '当前已检测到飞书 Bot 配置，但 Gateway 未运行。',
    evidence: [
      {
        source: anyGatewayRunning ? 'gateway' : 'status',
        channelId: 'feishu',
        pluginId: params.pluginId,
        message: anyGatewayRunning
          ? `已通过飞书运行态确认 Gateway 正在为 ${entries.length} 个 Bot 提供快照。`
          : `已检测到 ${entries.length} 个具备完整凭据的飞书 Bot，但 Gateway 当前未运行。`,
      },
      {
        source: 'status',
        channelId: 'feishu',
        pluginId: params.pluginId,
        message: onlineEntries.length > 0
          ? `已确认 ${onlineEntries.length} 个飞书 Bot 处于在线状态。`
          : blockingReason
            ? `当前飞书 Bot 尚未 ready：${blockingReason}`
            : '当前飞书 Bot 尚未 ready。',
      },
    ],
  }
}

async function getDingtalkOfficialChannelStatus(): Promise<OfficialChannelStatusView> {
  const pluginId = 'dingtalk-connector'
  const installedOnDisk = await isPluginInstalledOnDisk(pluginId)
  const registered = await detectRegisteredPlugin({
    channelId: 'dingtalk',
    pluginId,
  })

  const evidence: OfficialChannelSetupEvidence[] = [
    {
      source: 'disk',
      channelId: 'dingtalk',
      pluginId,
      message: installedOnDisk
        ? '已确认钉钉官方插件安装目录存在。'
        : '当前未确认到钉钉官方插件安装目录。',
    },
    registered.evidence,
    {
      source: 'status',
      channelId: 'dingtalk',
      pluginId,
      message: '当前缺少上游 loaded signal，loaded 暂记 unknown。',
    },
    {
      source: 'status',
      channelId: 'dingtalk',
      pluginId,
      message: '当前缺少上游 channel status / probe，ready 暂记 unknown。',
    },
  ]

  const stages: OfficialChannelStatusStage[] = [
    createStage(
      'installed',
      installedOnDisk ? 'verified' : 'missing',
      'disk',
      installedOnDisk ? '已确认本机存在钉钉官方插件安装。' : '本机尚未确认到钉钉官方插件安装。'
    ),
    createStage('registered', registered.state, 'plugins-list', registered.evidence.message),
    createStage('loaded', 'unknown', 'upstream-status-missing', '当前缺少上游 loaded 证明。'),
    createStage('ready', 'unknown', 'upstream-probe-missing', '当前缺少上游 ready 证明。'),
  ]

  return {
    channelId: 'dingtalk',
    pluginId,
    summary: !installedOnDisk
      ? '钉钉官方插件尚未安装。'
      : registered.state === 'verified'
        ? '钉钉官方插件已安装并已注册；loaded / ready 仍待上游证据。'
        : registered.state === 'missing'
          ? '钉钉官方插件已安装，但尚未在上游 plugins list 中确认注册。'
          : '钉钉官方插件已安装；registered / loaded / ready 仍待更多上游证据。',
    stages,
    evidence,
  }
}

async function getFeishuOfficialChannelStatus(): Promise<OfficialChannelStatusView> {
  const state = await getFeishuOfficialPluginState()
  const registered = await detectRegisteredPlugin({
    channelId: 'feishu',
    pluginId: state.pluginId,
  })
  const runtimeResult = await getFeishuBotRuntimeStatuses()
    .then((runtimeStatuses) => ({
      runtimeStatuses: runtimeStatuses as Record<string, FeishuRuntimeStatusLike>,
      runtimeError: '',
    }))
    .catch((error) => ({
      runtimeStatuses: null,
      runtimeError: error instanceof Error ? error.message : String(error),
    }))
  const runtimeSummary = buildFeishuRuntimeStageSummary({
    pluginId: state.pluginId,
    runtimeStatuses: runtimeResult.runtimeStatuses,
    runtimeError: runtimeResult.runtimeError,
  })

  const evidence: OfficialChannelSetupEvidence[] = [
    {
      source: 'disk',
      channelId: 'feishu',
      pluginId: state.pluginId,
      message: state.installedOnDisk
        ? '已确认飞书官方插件安装目录存在。'
        : '当前未确认到飞书官方插件安装目录。',
    },
    registered.evidence,
    ...(state.configChanged
      ? [{
          source: 'config' as const,
          channelId: 'feishu',
          pluginId: state.pluginId,
          message: '检测到飞书官方插件配置仍待同步，当前 status 已继续补充运行态证据。',
        }]
      : []),
    ...runtimeSummary.evidence,
  ]

  const stages: OfficialChannelStatusStage[] = [
    createStage(
      'installed',
      state.installedOnDisk ? 'verified' : 'missing',
      'disk',
      state.installedOnDisk ? '已确认本机存在飞书官方插件安装。' : '本机尚未确认到飞书官方插件安装。'
    ),
    createStage('registered', registered.state, 'plugins-list', registered.evidence.message),
    createStage('loaded', runtimeSummary.loadedState, runtimeSummary.loadedSource, runtimeSummary.loadedMessage),
    createStage('ready', runtimeSummary.readyState, runtimeSummary.readySource, runtimeSummary.readyMessage),
  ]

  return {
    channelId: 'feishu',
    pluginId: state.pluginId,
    summary: !state.installedOnDisk
      ? '飞书官方插件尚未安装。'
      : runtimeSummary.readyState === 'verified' && state.configChanged
        ? '飞书官方插件已形成运行态证明，但配置仍待同步。'
        : runtimeSummary.readyState === 'verified'
          ? '飞书官方插件已安装，并已有飞书 Bot 运行中。'
          : state.configChanged
            ? '飞书官方插件已安装，但配置仍待同步；运行态尚未就绪。'
            : runtimeSummary.loadedState === 'verified'
              ? runtimeSummary.summary
              : registered.state === 'verified'
                ? '飞书官方插件已安装并已注册；loaded / ready 仍待运行态证据。'
                : registered.state === 'missing'
                  ? '飞书官方插件已安装，但尚未在上游 plugins list 中确认注册。'
                  : '飞书官方插件已安装；registered / loaded / ready 仍待更多上游证据。',
    stages,
    evidence,
  }
}

function mapFeishuRepairResult(result: FeishuOfficialRepairResultLike): OfficialChannelActionResult {
  const evidence: OfficialChannelSetupEvidence[] = [
    {
      source: result.installedThisRun ? 'plugin-install' : 'status',
      channelId: 'feishu',
      pluginId: result.state.pluginId,
      message: result.installedThisRun
        ? '已安装飞书官方插件，并完成必要配置归一化。'
        : '已确认飞书官方插件安装存在，且配置已处于归一化状态。',
    },
  ]

  return {
    ok: result.ok,
    channelId: 'feishu',
    pluginId: result.state.pluginId,
    summary: result.ok
      ? result.installedThisRun
        ? '已安装并归一化飞书官方插件；loaded / ready 仍待运行态证据。'
        : '飞书官方插件已归一化；loaded / ready 仍待运行态证据。'
      : (normalizeText(result.message) || '飞书官方插件处理失败。'),
    installedThisRun: result.installedThisRun,
    gatewayResult: null,
    evidence,
    stdout: result.stdout,
    stderr: result.stderr,
    code: result.code,
    ...(normalizeText(result.message) ? { message: normalizeText(result.message) } : {}),
  }
}

export async function getOfficialChannelStatus(
  channelId: OfficialChannelAdapterId
): Promise<OfficialChannelStatusView> {
  if (channelId === 'dingtalk') {
    return getDingtalkOfficialChannelStatus()
  }
  if (channelId === 'feishu') {
    return getFeishuOfficialChannelStatus()
  }
  throw new Error(`Unsupported official channel status adapter: ${channelId}`)
}

export async function repairOfficialChannel(
  channelId: OfficialChannelAdapterId
): Promise<OfficialChannelActionResult> {
  if (channelId === 'dingtalk') {
    return repairDingtalkOfficialChannel()
  }
  if (channelId === 'feishu') {
    const result = await ensureFeishuOfficialPluginReady()
    return mapFeishuRepairResult(result)
  }
  throw new Error(`Unsupported official channel repair adapter: ${channelId}`)
}
