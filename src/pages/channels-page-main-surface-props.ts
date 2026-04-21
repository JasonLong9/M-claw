import type { ComponentProps } from 'react'

import ChannelsPageChannelCards from '../components/ChannelsPageChannelCards'
import ChannelsPageChannelListPanel from '../components/ChannelsPageChannelListPanel'
import ChannelsPageTopPanel from '../components/ChannelsPageTopPanel'
import { getChannelDefinition } from '../lib/openclaw-channel-registry'
import type {
  ChannelsPageMainSurfacePropsOptions,
  ChannelsPageMainSurfacePropsResult,
} from './channels-page-main-surface-props-contract'

export function useChannelsPageMainSurfaceProps({
  refreshing,
  error,
  legacyFeishuAgentIds,
  handleRefreshChannels,
  handleOpenAddChannel,
  setError,
  channels,
  togglingChannelId,
  repairingPluginChannelId,
  handleOpenModelConfig,
  handleToggleChannelEnabled,
  handleOpenPairing,
  handleOpenDiagnostics,
  handleRepairFeishuPlugin,
  handleRemoveChannel,
  deriveChannelStatusBadges,
  getChannelCardSummary,
  getFeishuSharedStatusAlert,
  getFeishuProvisionSourceDescription,
  shouldShowPluginStatus,
  shouldShowFeishuPluginRepairAction,
}: ChannelsPageMainSurfacePropsOptions): ChannelsPageMainSurfacePropsResult {
  const getPlatformInfo = (channelId: string, platform: string) => {
    const channelDef = getChannelDefinition(platform) || getChannelDefinition(channelId)
    return {
      logo: channelDef?.logo || null,
      name: channelDef?.name || platform,
    }
  }

  const topPanelProps: ComponentProps<typeof ChannelsPageTopPanel> = {
    title: 'IM 渠道',
    description: '统一管理已接入的 IM 渠道，查看状态，并从这里进入配对或诊断。',
    refreshLabel: '刷新',
    addChannelLabel: '添加渠道',
    refreshing,
    errorMessage: error,
    legacyFeishuAgentIds,
    onRefresh: () => {
      void handleRefreshChannels()
    },
    onAddChannel: handleOpenAddChannel,
    onDismissError: () => setError(''),
  }

  const channelListPanelProps: ComponentProps<typeof ChannelsPageChannelListPanel> = {
    hasChannels: channels.length > 0,
    emptyMessage: '暂未配置任何渠道。点击“添加渠道”接入第一个 IM 渠道。',
  }

  const channelCardsProps: ComponentProps<typeof ChannelsPageChannelCards> = {
    channels,
    togglingChannelId,
    repairingPluginChannelId,
    getPlatformInfo,
    getStatusBadges: (channel) => deriveChannelStatusBadges(channel, {
      includePairingState: true,
      includeProvisionSource: true,
    }),
    getSummary: getChannelCardSummary,
    getFeishuSharedStatusAlert,
    getFeishuProvisionDescription: getFeishuProvisionSourceDescription,
    shouldShowPluginStatus,
    shouldShowRepairAction: shouldShowFeishuPluginRepairAction,
    onOpenModelConfig: (channel) => void handleOpenModelConfig(channel),
    onToggleEnabled: (channel) => void handleToggleChannelEnabled(channel),
    onOpenPairing: (channel) => handleOpenPairing(channel),
    onOpenDiagnostics: (channel) => handleOpenDiagnostics(channel),
    onRepairPlugin: (channel) => void handleRepairFeishuPlugin(channel),
    onRemove: (channel) => void handleRemoveChannel(channel),
  }

  return {
    topPanelProps,
    channelListPanelProps,
    channelCardsProps,
  }
}
