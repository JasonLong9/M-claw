import { Alert } from '@mantine/core'

import PairingCode from '../pages/PairingCode'
import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import ChannelConfigPairingSummary from './ChannelConfigPairingSummary'
import FeishuTargetGateAlert from './FeishuTargetGateAlert'

interface ChannelConfigPairingTarget {
  channelId?: string | null
  accountId?: string | null
  accountName?: string | null
}

interface ChannelConfigPairingStepProps {
  target: ChannelConfigPairingTarget | null
  introTitle: string
  introMessage: string
  sharedStatusAlert?: FeishuSharedStatusAlertState | null
  sharedStatusRepairHint?: string
  sharedStatusRepairing?: boolean
  onRepairSharedStatus?: (() => void) | null
  statusPending: boolean
  missingAfterRefresh: boolean
  blockedBySharedStatus: boolean
  refreshing?: boolean
  onRefreshMissing?: (() => void) | null
  onBackToChannelConnect: () => void
  onComplete: () => void
  completeLabel?: string
}

export default function ChannelConfigPairingStep({
  target,
  introTitle,
  introMessage,
  sharedStatusAlert = null,
  sharedStatusRepairHint = '',
  sharedStatusRepairing = false,
  onRepairSharedStatus = null,
  statusPending,
  missingAfterRefresh,
  blockedBySharedStatus,
  refreshing = false,
  onRefreshMissing = null,
  onBackToChannelConnect,
  onComplete,
  completeLabel,
}: ChannelConfigPairingStepProps) {
  if (!target?.channelId) {
    return (
      <Alert color="warning" variant="light" title="暂未找到刚接入的渠道">
        当前无法继续配对。请关闭这个对话框，回到“添加渠道”，重新完成一次飞书接入。
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <ChannelConfigPairingSummary
        introTitle={introTitle}
        introMessage={introMessage}
        sharedStatusAlert={sharedStatusAlert}
        sharedStatusRepairHint={sharedStatusRepairHint}
        sharedStatusRepairing={sharedStatusRepairing}
        onRepairSharedStatus={onRepairSharedStatus}
      />

      {statusPending ? (
        <FeishuTargetGateAlert state="pending" surface="config-pairing" />
      ) : missingAfterRefresh ? (
        <FeishuTargetGateAlert
          state="missing"
          surface="config-pairing"
          refreshing={refreshing}
          onRefresh={onRefreshMissing}
          onSecondaryAction={onBackToChannelConnect}
        />
      ) : blockedBySharedStatus ? (
        <FeishuTargetGateAlert state="blocked" surface="config-pairing" />
      ) : (
        <PairingCode
          channel={target.channelId}
          accountId={target.accountId || undefined}
          accountName={target.accountName || undefined}
          onBack={onBackToChannelConnect}
          onComplete={onComplete}
          onSkip={onComplete}
          completeLabel={completeLabel}
        />
      )}
    </div>
  )
}
