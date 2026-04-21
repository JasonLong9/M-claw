import { Badge, Group, Text } from '@mantine/core'

import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'
import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import FeishuChannelCardMeta from './FeishuChannelCardMeta'
import ManagedChannelPluginStatusSummary from './ManagedChannelPluginStatusSummary'

interface ChannelCardDetailsProps {
  channel: {
    id: string
    name: string
    channelId: string
    configChannelId: string
    isFeishuBot?: boolean
    agentId?: string
    provisionSource?: 'created' | 'linked' | 'unknown'
    runtimeSummary?: string
    pluginStatus?: ManagedChannelPluginStatusView | null
  }
  platformInfo: {
    name: string
    logo?: string | null
  }
  badges: Array<{
    key: string
    color: string
    label: string
  }>
  summary: string
  showFeishuCardMeta?: boolean
  feishuProvisionDescription?: string | null
  feishuSharedStatusAlert?: FeishuSharedStatusAlertState | null
  showPluginStatus?: boolean
}

export default function ChannelCardDetails({
  channel,
  platformInfo,
  badges,
  summary,
  showFeishuCardMeta = false,
  feishuProvisionDescription = null,
  feishuSharedStatusAlert = null,
  showPluginStatus = false,
}: ChannelCardDetailsProps) {
  return (
    <Group gap="md" align="flex-start">
      {platformInfo.logo
        ? <img src={platformInfo.logo} alt={platformInfo.name} style={{ width: 32, height: 32 }} />
        : <Text size="2xl">?</Text>
      }
      <div>
        <Group gap="xs">
          <Text size="lg" fw={600}>{channel.name}</Text>
          <Badge variant="light" size="sm">
            {platformInfo.name}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          ID：{channel.id}
        </Text>
        {!channel.isFeishuBot && channel.configChannelId !== channel.channelId && (
          <Text size="xs" c="dimmed" mt={4}>
            渠道 ID：{channel.channelId}
          </Text>
        )}
        {channel.agentId && (
          <Text size="xs" c="dimmed" mt={4}>
            代理：{channel.agentId}
          </Text>
        )}
        <Group gap="xs" mt={8}>
          {badges.map((badge) => (
            <Badge key={`${channel.id}:${badge.key}`} variant="light" size="sm" color={badge.color}>
              {badge.label}
            </Badge>
          ))}
        </Group>
        <Text size="xs" c="dimmed" mt={6}>
          {summary}
        </Text>
        {showFeishuCardMeta && feishuProvisionDescription && (
          <FeishuChannelCardMeta
            provisionDescription={feishuProvisionDescription}
            showProvisionConfirmation={channel.provisionSource === 'unknown'}
            runtimeSummary={channel.runtimeSummary}
            sharedStatusAlert={feishuSharedStatusAlert}
          />
        )}
        {showPluginStatus && channel.pluginStatus && (
          <ManagedChannelPluginStatusSummary
            channelKey={channel.id}
            pluginStatus={channel.pluginStatus}
          />
        )}
      </div>
    </Group>
  )
}
