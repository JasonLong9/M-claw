import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import ChannelPairingModalShell from './ChannelPairingModalShell'

interface ChannelsPagePairingModalChannel {
  channelId: string
  enabled: boolean
  pairingAccountId?: string | null
  accountName?: string | null
  name: string
  pairingRequired: boolean
  pairingState: 'paired' | 'pending' | 'not_required'
  pairedCount: number
  provisionSource?: 'created' | 'linked' | 'unknown'
  runtimeState?: 'online' | 'offline' | 'degraded' | 'disabled'
  runtimeSummary?: string
}

interface ChannelsPagePairingModalBadge {
  key: string
  color: string
  label: string
}

interface ChannelsPagePairingModalProps {
  opened: boolean
  channel: ChannelsPagePairingModalChannel | null
  targetKey: string
  sharedStatusAlert?: FeishuSharedStatusAlertState | null
  sharedStatusRepairing?: boolean
  canRepairSharedStatus?: boolean
  pending: boolean
  missing: boolean
  blocked: boolean
  refreshing?: boolean
  getBadges: (channel: ChannelsPagePairingModalChannel | null | undefined) => ChannelsPagePairingModalBadge[]
  getSummary: (channel: ChannelsPagePairingModalChannel | null | undefined) => string
  getRuntimeSummaryColor: (state: ChannelsPagePairingModalChannel['runtimeState']) => string
  onClose: () => void
  onRepairSharedStatus: () => void
  onRefreshMissing: () => void
  onComplete: () => void
}

export default function ChannelsPagePairingModal({
  opened,
  channel,
  targetKey,
  sharedStatusAlert = null,
  sharedStatusRepairing = false,
  canRepairSharedStatus = false,
  pending,
  missing,
  blocked,
  refreshing = false,
  getBadges,
  getSummary,
  getRuntimeSummaryColor,
  onClose,
  onRepairSharedStatus,
  onRefreshMissing,
  onComplete,
}: ChannelsPagePairingModalProps) {
  return (
    <ChannelPairingModalShell
      opened={opened}
      onClose={onClose}
      channel={channel}
      targetKey={targetKey}
      badges={getBadges(channel)}
      summary={getSummary(channel)}
      sharedStatusAlert={sharedStatusAlert}
      sharedStatusRepairHint="如共享飞书运行时阻塞，请先在这里一键修复；刷新共享状态后再继续配对。"
      sharedStatusRepairing={sharedStatusRepairing}
      onRepairSharedStatus={canRepairSharedStatus ? onRepairSharedStatus : null}
      runtimeSummary={channel?.channelId === 'feishu' ? channel.runtimeSummary : undefined}
      runtimeSummaryColor={getRuntimeSummaryColor(channel?.runtimeState)}
      pending={pending}
      missing={missing}
      blocked={blocked}
      refreshing={refreshing}
      onRefreshMissing={targetKey ? onRefreshMissing : null}
      onComplete={onComplete}
    />
  )
}
