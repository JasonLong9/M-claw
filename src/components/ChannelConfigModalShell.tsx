import { Modal } from '@mantine/core'

import ChannelConnect, { type ChannelConnectNextPayload } from '../pages/ChannelConnect'
import {
  getConfigModalTitle,
  type ChannelPairingTarget,
  type ChannelsConfigStep,
} from '../pages/channels-page-utils'
import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import ChannelConfigPairingStep from './ChannelConfigPairingStep'

interface ChannelConfigModalShellProps {
  opened: boolean
  configStep: ChannelsConfigStep
  selectedChannelId?: string | null
  selectedTarget: ChannelPairingTarget | null
  onClose: () => void
  onChannelConnectNext: (payload: ChannelConnectNextPayload) => void
  onComplete: () => void
  pairingIntroTitle: string
  pairingIntroMessage: string
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
  completeLabel?: string
}

export default function ChannelConfigModalShell({
  opened,
  configStep,
  selectedChannelId = null,
  selectedTarget,
  onClose,
  onChannelConnectNext,
  onComplete,
  pairingIntroTitle,
  pairingIntroMessage,
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
  completeLabel,
}: ChannelConfigModalShellProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={getConfigModalTitle(configStep, selectedTarget)}
      size={
        (configStep === 'channel-connect' && selectedChannelId === 'openclaw-weixin')
        || selectedTarget?.channelId === 'openclaw-weixin'
          ? '92vw'
          : 'xl'
      }
      styles={{
        body: {
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
        },
      }}
    >
      {configStep === 'channel-connect' && (
        <ChannelConnect
          initialChannelId={selectedChannelId ?? undefined}
          onNext={onChannelConnectNext}
          onBack={onClose}
          onSkip={onComplete}
          setupModelContext={null}
        />
      )}
      {configStep === 'pairing-code' && (
        <ChannelConfigPairingStep
          target={selectedTarget}
          introTitle={pairingIntroTitle}
          introMessage={pairingIntroMessage}
          sharedStatusAlert={sharedStatusAlert}
          sharedStatusRepairHint={sharedStatusRepairHint}
          sharedStatusRepairing={sharedStatusRepairing}
          onRepairSharedStatus={onRepairSharedStatus}
          statusPending={statusPending}
          missingAfterRefresh={missingAfterRefresh}
          blockedBySharedStatus={blockedBySharedStatus}
          refreshing={refreshing}
          onRefreshMissing={onRefreshMissing}
          onBackToChannelConnect={onBackToChannelConnect}
          onComplete={onComplete}
          completeLabel={completeLabel}
        />
      )}
    </Modal>
  )
}
