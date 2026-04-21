import type { MouseEvent } from 'react'
import { Button, Group } from '@mantine/core'

interface ChannelCardActionButtonsProps {
  channel: {
    channelId: string
    agentId?: string
    pairingRequired: boolean
    pairingAccountId?: string
    enabled: boolean
  }
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

function handleCardActionClick(event: MouseEvent<HTMLButtonElement>, action: () => void): void {
  event.stopPropagation()
  action()
}

export default function ChannelCardActionButtons({
  channel,
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
}: ChannelCardActionButtonsProps) {
  return (
    <Group gap="xs">
      {channel.channelId === 'feishu' && channel.agentId && onOpenModelConfig && (
        <Button
          variant="light"
          size="sm"
          disabled={togglingAnyChannel}
          onClick={(event) => handleCardActionClick(event, onOpenModelConfig)}
          className="cursor-pointer"
        >
          模型配置
        </Button>
      )}
      <Button
        color={channel.enabled ? 'orange' : 'teal'}
        variant="light"
        size="sm"
        disabled={togglingAnotherChannel}
        loading={isToggling}
        onClick={(event) => handleCardActionClick(event, onToggleEnabled)}
        className="cursor-pointer"
      >
        {channel.enabled ? '停用' : '启用'}
      </Button>
      {channel.pairingRequired && (
        <Button
          variant="light"
          size="sm"
          disabled={togglingAnyChannel}
          onClick={(event) => handleCardActionClick(event, onOpenPairing)}
          className="cursor-pointer"
        >
          配对管理
        </Button>
      )}
      {channel.channelId === 'feishu' && channel.pairingAccountId && (
        <Button
          variant="light"
          size="sm"
          disabled={togglingAnyChannel}
          onClick={(event) => handleCardActionClick(event, onOpenDiagnostics)}
          className="cursor-pointer"
        >
          诊断
        </Button>
      )}
      {showRepairAction && (
        <Button
          variant="light"
          size="sm"
          disabled={repairDisabled}
          loading={repairingRepairAction}
          onClick={(event) => handleCardActionClick(event, onRepairPlugin)}
          className="cursor-pointer"
        >
          修复飞书插件
        </Button>
      )}
      <Button
        color="red"
        variant="light"
        size="sm"
        disabled={togglingAnyChannel}
        onClick={(event) => handleCardActionClick(event, onRemove)}
        className="cursor-pointer"
      >
        移除
      </Button>
    </Group>
  )
}
