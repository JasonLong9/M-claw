import type { CSSProperties } from 'react'
import { Card, Group } from '@mantine/core'

import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'
import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import ChannelCardActionButtons from './ChannelCardActionButtons'
import ChannelCardDetails from './ChannelCardDetails'

export interface ChannelsPageChannelCardChannel {
  id: string
  name: string
  channelId: string
  configChannelId: string
  platform: string
  enabled: boolean
  credentials: Record<string, string>
  pairingRequired: boolean
  pairingState: 'paired' | 'pending' | 'not_required'
  pairedCount: number
  pairingUsers: string[]
  pairingAccountId?: string
  accountName?: string
  isFeishuBot?: boolean
  agentId?: string
  provisionSource?: 'created' | 'linked' | 'unknown'
  runtimeState?: 'online' | 'offline' | 'degraded' | 'disabled'
  runtimeSummary?: string
  pluginStatus?: ManagedChannelPluginStatusView | null
}

export interface ChannelsPageChannelCardPlatformInfo {
  name: string
  logo?: string | null
}

export interface ChannelsPageChannelCardBadge {
  key: string
  color: string
  label: string
}

interface ChannelsPageChannelCardProps {
  channel: ChannelsPageChannelCardChannel
  platformInfo: ChannelsPageChannelCardPlatformInfo
  badges: ChannelsPageChannelCardBadge[]
  summary: string
  showFeishuCardMeta?: boolean
  feishuProvisionDescription?: string | null
  feishuSharedStatusAlert?: FeishuSharedStatusAlertState | null
  showPluginStatus?: boolean
  togglingAnyChannel: boolean
  togglingAnotherChannel: boolean
  isToggling: boolean
  showRepairAction: boolean
  repairDisabled: boolean
  repairingRepairAction: boolean
  onOpenModelConfig?: (() => void) | null
  onToggleEnabled: () => void
  onOpenPairing: () => void
  onOpenDiagnostics: () => void
  onRepairPlugin: () => void
  onRemove: () => void
}

export default function ChannelsPageChannelCard({
  channel,
  platformInfo,
  badges,
  summary,
  showFeishuCardMeta = false,
  feishuProvisionDescription = null,
  feishuSharedStatusAlert = null,
  showPluginStatus = false,
  togglingAnyChannel,
  togglingAnotherChannel,
  isToggling,
  showRepairAction,
  repairDisabled,
  repairingRepairAction,
  onOpenModelConfig = null,
  onToggleEnabled,
  onOpenPairing,
  onOpenDiagnostics,
  onRepairPlugin,
  onRemove,
}: ChannelsPageChannelCardProps) {
  const cardStyle = channel.pairingRequired
    ? { '--hover-bg': 'var(--app-bg-tertiary)' } as CSSProperties
    : undefined

  return (
    <Card
      padding="lg"
      withBorder
      className={`transition-colors duration-200 ${
        channel.pairingRequired ? 'cursor-pointer' : ''
      }`}
      style={cardStyle}
      onMouseEnter={(event) => {
        if (channel.pairingRequired) event.currentTarget.style.backgroundColor = 'var(--app-bg-tertiary)'
      }}
      onMouseLeave={(event) => {
        if (channel.pairingRequired) event.currentTarget.style.backgroundColor = ''
      }}
      onClick={channel.pairingRequired ? onOpenPairing : undefined}
    >
      <Group justify="space-between" align="flex-start">
        <ChannelCardDetails
          channel={channel}
          platformInfo={platformInfo}
          badges={badges}
          summary={summary}
          showFeishuCardMeta={showFeishuCardMeta}
          feishuProvisionDescription={feishuProvisionDescription}
          feishuSharedStatusAlert={feishuSharedStatusAlert}
          showPluginStatus={showPluginStatus}
        />
        <ChannelCardActionButtons
          channel={channel}
          togglingAnyChannel={togglingAnyChannel}
          togglingAnotherChannel={togglingAnotherChannel}
          isToggling={isToggling}
          showRepairAction={showRepairAction}
          repairDisabled={repairDisabled}
          repairingRepairAction={repairingRepairAction}
          onOpenModelConfig={onOpenModelConfig}
          onToggleEnabled={onToggleEnabled}
          onOpenPairing={onOpenPairing}
          onOpenDiagnostics={onOpenDiagnostics}
          onRepairPlugin={onRepairPlugin}
          onRemove={onRemove}
        />
      </Group>
    </Card>
  )
}
