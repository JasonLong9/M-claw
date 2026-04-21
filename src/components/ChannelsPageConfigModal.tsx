import ChannelConfigModalShell from './ChannelConfigModalShell'
import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import type { ChannelConnectNextPayload } from '../pages/ChannelConnect'
import {
  getPairingIntroCopy,
  resolveChannelConnectAdvance,
  type ChannelPairingTarget,
  type ChannelsConfigStep,
} from '../pages/channels-page-utils'

interface ChannelsPageConfigModalProps {
  opened: boolean
  configStep: ChannelsConfigStep
  selectedChannelId?: string | null
  selectedTarget: ChannelPairingTarget | null
  refreshTargetKey: string
  sharedStatusAlert?: FeishuSharedStatusAlertState | null
  sharedStatusRepairing?: boolean
  canRepairSharedStatus?: boolean
  statusPending: boolean
  missingAfterRefresh: boolean
  blockedBySharedStatus: boolean
  refreshing?: boolean
  onClose: () => void
  onComplete: () => void
  onSelectChannelId: (value: string | null) => void
  onSelectTarget: (value: ChannelPairingTarget | null) => void
  onSetConfigStep: (value: ChannelsConfigStep) => void
  onRepairSharedStatus: () => void
  onRefreshMissing: () => void
}

export default function ChannelsPageConfigModal({
  opened,
  configStep,
  selectedChannelId = null,
  selectedTarget,
  refreshTargetKey,
  sharedStatusAlert = null,
  sharedStatusRepairing = false,
  canRepairSharedStatus = false,
  statusPending,
  missingAfterRefresh,
  blockedBySharedStatus,
  refreshing = false,
  onClose,
  onComplete,
  onSelectChannelId,
  onSelectTarget,
  onSetConfigStep,
  onRepairSharedStatus,
  onRefreshMissing,
}: ChannelsPageConfigModalProps) {
  const pairingIntro = getPairingIntroCopy(selectedTarget)

  const handleChannelConnectNext = (payload: ChannelConnectNextPayload) => {
    const advance = resolveChannelConnectAdvance({
      channelId: payload.channelId,
      accountId: payload.accountId,
      accountName: payload.accountName,
      skipPairing: payload.skipPairing,
    })

    if (advance.shouldComplete) {
      onComplete()
      return
    }

    onSelectChannelId(advance.selectedTarget?.channelId || null)
    onSelectTarget(advance.selectedTarget)
    onSetConfigStep(advance.nextStep)
  }

  return (
    <ChannelConfigModalShell
      opened={opened}
      onClose={onClose}
      configStep={configStep}
      selectedChannelId={selectedChannelId}
      selectedTarget={selectedTarget}
      onChannelConnectNext={handleChannelConnectNext}
      onComplete={onComplete}
      pairingIntroTitle={pairingIntro.title}
      pairingIntroMessage={pairingIntro.message}
      sharedStatusAlert={sharedStatusAlert}
      sharedStatusRepairHint="如共享飞书运行时阻塞，请先在这里一键修复；刷新共享状态后再继续配对。"
      sharedStatusRepairing={sharedStatusRepairing}
      onRepairSharedStatus={canRepairSharedStatus ? onRepairSharedStatus : null}
      statusPending={statusPending}
      missingAfterRefresh={missingAfterRefresh}
      blockedBySharedStatus={blockedBySharedStatus}
      refreshing={refreshing}
      onRefreshMissing={refreshTargetKey ? onRefreshMissing : null}
      onBackToChannelConnect={() => onSetConfigStep('channel-connect')}
      completeLabel="开始对话"
    />
  )
}
