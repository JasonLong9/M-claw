import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'
import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import ChannelsPageChannelCard, {
  type ChannelsPageChannelCardBadge,
  type ChannelsPageChannelCardChannel,
  type ChannelsPageChannelCardPlatformInfo,
} from './ChannelsPageChannelCard'

interface ChannelsPageChannelCardsProps {
  channels: Array<
    ChannelsPageChannelCardChannel & {
      platform: string
      pluginStatus?: ManagedChannelPluginStatusView | null
    }
  >
  togglingChannelId?: string | null
  repairingPluginChannelId?: string | null
  getPlatformInfo: (channelId: string, platform: string) => ChannelsPageChannelCardPlatformInfo
  getStatusBadges: (channel: ChannelsPageChannelCardChannel) => ChannelsPageChannelCardBadge[]
  getSummary: (channel: ChannelsPageChannelCardChannel, platformName: string) => string
  getFeishuSharedStatusAlert: (channel: ChannelsPageChannelCardChannel) => FeishuSharedStatusAlertState | null
  getFeishuProvisionDescription: (source: ChannelsPageChannelCardChannel['provisionSource']) => string
  shouldShowPluginStatus: (channel: ChannelsPageChannelCardChannel) => boolean
  shouldShowRepairAction: (channel: ChannelsPageChannelCardChannel) => boolean
  onOpenModelConfig: (channel: ChannelsPageChannelCardChannel) => void
  onToggleEnabled: (channel: ChannelsPageChannelCardChannel) => void
  onOpenPairing: (channel: ChannelsPageChannelCardChannel) => void
  onOpenDiagnostics: (channel: ChannelsPageChannelCardChannel) => void
  onRepairPlugin: (channel: ChannelsPageChannelCardChannel) => void
  onRemove: (channel: ChannelsPageChannelCardChannel) => void
}

export default function ChannelsPageChannelCards({
  channels,
  togglingChannelId = null,
  repairingPluginChannelId = null,
  getPlatformInfo,
  getStatusBadges,
  getSummary,
  getFeishuSharedStatusAlert,
  getFeishuProvisionDescription,
  shouldShowPluginStatus,
  shouldShowRepairAction,
  onOpenModelConfig,
  onToggleEnabled,
  onOpenPairing,
  onOpenDiagnostics,
  onRepairPlugin,
  onRemove,
}: ChannelsPageChannelCardsProps) {
  return (
    <>
      {channels.map((channel) => {
        const platformInfo = getPlatformInfo(channel.id, channel.platform)
        const isToggling = togglingChannelId === channel.id
        const togglingAnyChannel = Boolean(togglingChannelId)
        const togglingAnotherChannel = Boolean(togglingChannelId && togglingChannelId !== channel.id)
        const feishuStatusAlert = getFeishuSharedStatusAlert(channel)
        const channelStatusBadges = getStatusBadges(channel)
        const channelCardSummary = getSummary(channel, platformInfo.name)

        return (
          <ChannelsPageChannelCard
            key={channel.id}
            channel={channel}
            platformInfo={platformInfo}
            badges={channelStatusBadges}
            summary={channelCardSummary}
            showFeishuCardMeta={channel.channelId === 'feishu'}
            feishuProvisionDescription={getFeishuProvisionDescription(channel.provisionSource)}
            feishuSharedStatusAlert={feishuStatusAlert}
            showPluginStatus={shouldShowPluginStatus(channel)}
            togglingAnyChannel={togglingAnyChannel}
            togglingAnotherChannel={togglingAnotherChannel}
            isToggling={isToggling}
            showRepairAction={shouldShowRepairAction(channel)}
            repairDisabled={
              togglingAnyChannel
              || (Boolean(repairingPluginChannelId) && repairingPluginChannelId !== channel.channelId)
            }
            repairingRepairAction={repairingPluginChannelId === channel.channelId}
            onOpenModelConfig={
              channel.channelId === 'feishu' && channel.agentId
                ? () => onOpenModelConfig(channel)
                : null
            }
            onToggleEnabled={() => onToggleEnabled(channel)}
            onOpenPairing={() => onOpenPairing(channel)}
            onOpenDiagnostics={() => onOpenDiagnostics(channel)}
            onRepairPlugin={() => onRepairPlugin(channel)}
            onRemove={() => onRemove(channel)}
          />
        )
      })}
    </>
  )
}
