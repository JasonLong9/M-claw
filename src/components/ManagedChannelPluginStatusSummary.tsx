import { Badge, Group, Text } from '@mantine/core'

import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'
import {
  getOfficialChannelStageColor,
  getOfficialChannelStageLabel,
  getOfficialChannelStageStateLabel,
} from '../shared/official-channel-status-view'

interface ManagedChannelPluginStatusSummaryProps {
  channelKey: string
  pluginStatus: ManagedChannelPluginStatusView
}

export default function ManagedChannelPluginStatusSummary({
  channelKey,
  pluginStatus,
}: ManagedChannelPluginStatusSummaryProps) {
  return (
    <div className="mt-3 space-y-2">
      <Text size="xs" c="dimmed">
        插件状态：{pluginStatus.summary}
      </Text>
      <Group gap="xs">
        {pluginStatus.stages.map((stage) => (
          <Badge
            key={`${channelKey}:${stage.id}`}
            variant="light"
            size="sm"
            color={getOfficialChannelStageColor(stage.state)}
          >
            {getOfficialChannelStageLabel(stage.id)} / {getOfficialChannelStageStateLabel(stage.state)}
          </Badge>
        ))}
      </Group>
    </div>
  )
}
