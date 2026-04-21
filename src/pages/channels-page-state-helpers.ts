import {
  type ChannelsPageChannelInfo as ChannelInfo,
  type FeishuRuntimeStatusState,
} from './channels-page-data-contract'
import type {
  ChannelsPageChannelStatusBadgeChannel,
  ChannelsPageChannelStatusBadgeDescriptor,
  ChannelsPageChannelStatusBadgeDeriver,
  ChannelsPageChannelStatusBadgeOptions,
  ChannelsPageManagedStatusChannel,
  ChannelsPageSharedStatusChannel,
  ChannelsPageSharedStatusAlert,
  ChannelsPageStateHelperTargetState,
  ChannelsPageStateHelperTargetStateOptions,
} from './channels-page-state-helpers-contract'
import {
  type ChannelPairingTargetRef,
} from './channels-page-utils'
import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'

function getRuntimeBadgeColor(state: FeishuRuntimeStatusState | undefined): string {
  if (state === 'online') return 'teal'
  if (state === 'degraded') return 'yellow'
  if (state === 'disabled') return 'gray'
  return 'red'
}

function getRuntimeLabel(state: FeishuRuntimeStatusState | undefined): string {
  if (state === 'online') return '在线'
  if (state === 'degraded') return '待修复'
  if (state === 'disabled') return '已禁用'
  return '离线'
}

function getPairingStateBadgeColor(state: ChannelInfo['pairingState']): string {
  if (state === 'paired') return 'teal'
  if (state === 'pending') return 'yellow'
  return 'gray'
}

function getPairingStateBadgeLabel(
  channel: Pick<ChannelInfo, 'pairingRequired' | 'channelId' | 'pairingState'>
): string {
  if (!channel.pairingRequired) return '无需配对'
  if (channel.channelId === 'feishu') {
    return channel.pairingState === 'paired' ? '已连接并已配对' : '已连接，等待配对'
  }
  if (channel.channelId === 'openclaw-weixin') {
    return channel.pairingState === 'paired' ? '已授权其他用户' : '等待授权配对'
  }
  return channel.pairingState === 'paired' ? '已配对' : '等待配对'
}

function getFeishuProvisionSourceBadgeColor(source: ChannelInfo['provisionSource']): string {
  if (source === 'created') return 'blue'
  if (source === 'linked') return 'grape'
  return 'gray'
}

function getFeishuProvisionSourceBadgeLabel(source: ChannelInfo['provisionSource']): string {
  if (source === 'created') return '来源：在 Mclaw 中创建'
  if (source === 'linked') return '来源：关联已有机器人'
  return '来源：待确认'
}

export function getChannelEnabledLabel(enabled: boolean): string {
  return enabled ? '已启用' : '已停用'
}

export const deriveChannelStatusBadges: ChannelsPageChannelStatusBadgeDeriver = (
  channel: ChannelsPageChannelStatusBadgeChannel | null | undefined,
  options: ChannelsPageChannelStatusBadgeOptions = {}
): ChannelsPageChannelStatusBadgeDescriptor[] => {
  const badges: ChannelsPageChannelStatusBadgeDescriptor[] = [
    {
      key: 'enabled',
      color: channel?.enabled ? 'teal' : 'gray',
      label: getChannelEnabledLabel(Boolean(channel?.enabled)),
    },
  ]

  if (channel && options.includePairingState) {
    badges.push({
      key: 'pairing-state',
      color: getPairingStateBadgeColor(channel.pairingState),
      label: getPairingStateBadgeLabel(channel),
    })
  }

  if (channel?.channelId === 'feishu' && options.includeProvisionSource) {
    badges.push({
      key: 'provision-source',
      color: getFeishuProvisionSourceBadgeColor(channel.provisionSource),
      label: getFeishuProvisionSourceBadgeLabel(channel.provisionSource),
    })
  }

  if (channel?.channelId === 'feishu') {
    badges.push({
      key: 'runtime-state',
      color: getRuntimeBadgeColor(channel.runtimeState),
      label: getRuntimeLabel(channel.runtimeState),
    })
  }

  return badges
}

export function getChannelCardSummary(
  channel: Pick<ChannelInfo, 'pairingRequired' | 'channelId' | 'pairingState'>,
  platformName: string
): string {
  if (channel.pairingRequired) {
    if (channel.channelId === 'openclaw-weixin') {
      return '点击卡片可为这个个人微信账号处理配对授权。'
    }

    if (channel.channelId === 'feishu') {
      return channel.pairingState === 'paired'
        ? '该飞书机器人已连接，并且已有配对用户。点击卡片可继续管理更多配对。'
        : '该飞书机器人已连接，但还没有用户完成配对。点击卡片继续管理配对。'
    }
  }

  if (channel.channelId === 'openclaw-weixin') {
    return '该个人微信账号当前仅支持登录中的账号自身使用，暂不支持授权给其他微信用户。'
  }

  return `${platformName} 渠道无需额外配对。`
}

export function getFeishuProvisionSourceDescription(source: ChannelInfo['provisionSource']): string {
  if (source === 'created') {
    return '该机器人通过 Mclaw 应用内的“创建机器人”流程接入。'
  }

  if (source === 'linked') {
    return '该机器人通过“关联已有机器人”流程接入。'
  }

  return '该机器人最初的接入来源暂未记录。'
}

export function getFeishuRuntimeSummaryAlertColor(state: FeishuRuntimeStatusState | undefined): string {
  if (state === 'online') return 'green'
  if (state === 'degraded') return 'yellow'
  return 'red'
}

export function shouldShowPluginStatus(channel: Pick<ChannelInfo, 'pluginStatus'>): boolean {
  return Boolean(channel.pluginStatus)
}

export function getManagedPluginStageState(
  status: ManagedChannelPluginStatusView | null | undefined,
  stageId: ManagedChannelPluginStatusView['stages'][number]['id']
): ManagedChannelPluginStatusView['stages'][number]['state'] | undefined {
  return status?.stages.find((stage) => stage.id === stageId)?.state
}

export function getFeishuSharedStatusAlert(
  channel: ChannelsPageSharedStatusChannel<ChannelInfo>
): ChannelsPageSharedStatusAlert | null {
  if (channel.channelId !== 'feishu' || !channel.pluginStatus) return null

  const installedState = getManagedPluginStageState(channel.pluginStatus, 'installed')
  const registeredState = getManagedPluginStageState(channel.pluginStatus, 'registered')
  const readyState = getManagedPluginStageState(channel.pluginStatus, 'ready')

  if (installedState === 'missing' || registeredState === 'missing') {
    return {
      color: 'red',
      title: '插件状态需要修复',
      message: channel.pluginStatus.summary,
    }
  }

  if (readyState === 'missing') {
    return {
      color: 'yellow',
      title: '飞书运行时需要修复',
      message: channel.pluginStatus.summary,
    }
  }

  return null
}

export function shouldShowFeishuPluginRepairAction(
  channel: ChannelsPageManagedStatusChannel<ChannelInfo>
): boolean {
  if (channel.channelId !== 'feishu' || !channel.pairingAccountId) return false
  if (!channel.pluginStatus) return true

  return ['installed', 'registered', 'ready'].some((stageId) =>
    getManagedPluginStageState(
      channel.pluginStatus,
      stageId as ManagedChannelPluginStatusView['stages'][number]['id']
    ) !== 'verified'
  )
}

export function resolveLatestChannelSnapshot(
  channels: ChannelInfo[],
  current: Pick<ChannelInfo, 'id'> | null | undefined
): ChannelInfo | null {
  if (!current) return null
  return channels.find((channel) => channel.id === current.id) || null
}

export function resolveConfigTargetChannelSnapshot(
  channels: ChannelInfo[],
  target: ChannelPairingTargetRef | null | undefined
): ChannelInfo | null {
  if (!target?.channelId) return null

  return (
    channels.find((channel) => {
      if (channel.channelId !== target.channelId) return false
      if (target.channelId !== 'feishu') return true
      return channel.pairingAccountId === (target.accountId || undefined)
    }) || null
  )
}

export function deriveFeishuTargetState(
  channels: ChannelInfo[],
  target: ChannelPairingTargetRef | null | undefined,
  options: ChannelsPageStateHelperTargetStateOptions<ChannelInfo> = {}
): ChannelsPageStateHelperTargetState<ChannelInfo> {
  const pairingKey =
    target?.channelId === 'feishu' && target.accountId
      ? `feishu:${target.accountId}`
      : ''
  const targetChannel = resolveConfigTargetChannelSnapshot(channels, target)
  const channelForSurface = targetChannel || options.fallbackChannel || null
  const sharedStatusAlert = channelForSurface
    ? getFeishuSharedStatusAlert(channelForSurface)
    : null
  const canRepair = channelForSurface
    ? shouldShowFeishuPluginRepairAction(channelForSurface)
    : false
  const repairing = Boolean(
    channelForSurface && options.repairingPluginChannelId === channelForSurface.channelId
  )
  const statusPending = Boolean(
    pairingKey
    && (Boolean(options.refreshing) || options.checkedKey !== pairingKey)
  )
  const missingAfterRefresh = Boolean(
    pairingKey
    && !targetChannel
    && !statusPending
  )

  return {
    pairingKey,
    targetChannel,
    channelForSurface,
    sharedStatusAlert,
    canRepair,
    repairing,
    statusPending,
    missingAfterRefresh,
    blockedBySharedStatus: Boolean(sharedStatusAlert),
  }
}

export function getFeishuChannelDisplayName(
  channel: Pick<ChannelInfo, 'accountName' | 'name'> | null | undefined,
  fallback?: Pick<ChannelInfo, 'accountName' | 'name'> | null | undefined
): string {
  return channel?.accountName || channel?.name || fallback?.accountName || fallback?.name || '飞书机器人'
}

export function getFeishuDiagnosticsModalTitle(
  channel: Pick<ChannelInfo, 'accountName' | 'name'> | null | undefined,
  fallback?: Pick<ChannelInfo, 'accountName' | 'name'> | null | undefined
): string {
  return `${getFeishuChannelDisplayName(channel, fallback)} 诊断`
}

export function getFeishuPairingModalSummary(
  channel: Pick<ChannelInfo, 'pairedCount' | 'name'> | null | undefined
): string {
  if (channel && channel.pairedCount > 0) {
    return `该机器人已有 ${channel.pairedCount} 个已配对账号，你可以继续输入新的配对码授权更多用户。`
  }

  return `该机器人已接入 OpenClaw，但还没有用户完成配对。请先给 ${channel?.name || '该机器人'} 发送一条消息，然后把返回的配对码粘贴到这里。`
}
