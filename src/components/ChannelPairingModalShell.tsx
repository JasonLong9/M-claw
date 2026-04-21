import { Modal } from '@mantine/core'

import PairingCode from '../pages/PairingCode'
import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import ChannelPairingModalSummary from './ChannelPairingModalSummary'
import FeishuTargetGateAlert from './FeishuTargetGateAlert'

interface ChannelPairingModalChannel {
  channelId?: string | null
  pairingAccountId?: string | null
  accountName?: string | null
  name?: string | null
}

interface ChannelPairingModalShellProps {
  opened: boolean
  onClose: () => void
  channel: ChannelPairingModalChannel | null
  targetKey?: string
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
  pending: boolean
  missing: boolean
  blocked: boolean
  refreshing?: boolean
  onRefreshMissing?: (() => void) | null
  onComplete: () => void
}

export default function ChannelPairingModalShell({
  opened,
  onClose,
  channel,
  targetKey = '',
  badges,
  summary,
  sharedStatusAlert = null,
  sharedStatusRepairHint = '',
  sharedStatusRepairing = false,
  onRepairSharedStatus = null,
  runtimeSummary,
  runtimeSummaryColor = 'red',
  pending,
  missing,
  blocked,
  refreshing = false,
  onRefreshMissing = null,
  onComplete,
}: ChannelPairingModalShellProps) {
  if (!channel && !targetKey) return null

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={channel?.name ? `${channel.name} 配对` : '渠道配对'}
      size="lg"
    >
      <div className="space-y-4">
        <ChannelPairingModalSummary
          badges={badges}
          summary={summary}
          sharedStatusAlert={sharedStatusAlert}
          sharedStatusRepairHint={sharedStatusRepairHint}
          sharedStatusRepairing={sharedStatusRepairing}
          onRepairSharedStatus={onRepairSharedStatus}
          runtimeSummary={runtimeSummary}
          runtimeSummaryColor={runtimeSummaryColor}
        />

        {pending ? (
          <FeishuTargetGateAlert state="pending" surface="pairing-modal" />
        ) : missing ? (
          <FeishuTargetGateAlert
            state="missing"
            surface="pairing-modal"
            refreshing={refreshing}
            onRefresh={onRefreshMissing}
            onSecondaryAction={onClose}
          />
        ) : blocked ? (
          <FeishuTargetGateAlert state="blocked" surface="pairing-modal" />
        ) : channel?.channelId ? (
          <PairingCode
            channel={channel.channelId}
            accountId={channel.pairingAccountId || undefined}
            accountName={channel.accountName || undefined}
            surface="dashboard"
            onBack={onClose}
            onComplete={onComplete}
            showSkip={false}
            backLabel="关闭"
            completeLabel="完成"
          />
        ) : null}
      </div>
    </Modal>
  )
}
