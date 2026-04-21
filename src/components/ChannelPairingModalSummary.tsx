import { Alert, Badge, Group, Text } from '@mantine/core'

import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import FeishuSharedStatusAlert from './FeishuSharedStatusAlert'

interface ChannelPairingModalSummaryProps {
  badges: Array<{
    key: string
    color: string
    label: string
  }>
  summary: string
  sharedStatusAlert?: FeishuSharedStatusAlertState | null
  sharedStatusRepairHint?: string
  sharedStatusRepairing?: boolean
  onRepairSharedStatus?: (() => void) | null
  runtimeSummary?: string
  runtimeSummaryColor?: string
}

export default function ChannelPairingModalSummary({
  badges,
  summary,
  sharedStatusAlert = null,
  sharedStatusRepairHint = '',
  sharedStatusRepairing = false,
  onRepairSharedStatus = null,
  runtimeSummary,
  runtimeSummaryColor = 'red',
}: ChannelPairingModalSummaryProps) {
  return (
    <>
      <Group gap="xs">
        {badges.map((badge) => (
          <Badge key={`pairing-modal:${badge.key}`} variant="light" size="sm" color={badge.color}>
            {badge.label}
          </Badge>
        ))}
      </Group>

      <Text size="sm" c="dimmed">
        {summary}
      </Text>

      {sharedStatusAlert && (
        <FeishuSharedStatusAlert
          alert={sharedStatusAlert}
          repairHint={sharedStatusRepairHint}
          repairing={sharedStatusRepairing}
          onRepair={onRepairSharedStatus}
        />
      )}

      {runtimeSummary && (
        <Alert color={runtimeSummaryColor} variant="light" title="当前运行时状态">
          {runtimeSummary}
        </Alert>
      )}
    </>
  )
}
