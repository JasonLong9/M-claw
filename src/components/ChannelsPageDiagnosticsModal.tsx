import type { FeishuDiagnosticsRepairOutcome } from './FeishuDiagnosticsModal'
import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import FeishuDiagnosticsModalShell from './FeishuDiagnosticsModalShell'

interface ChannelsPageDiagnosticsModalChannel {
  pairingAccountId?: string | null
  accountName?: string
  name: string
  agentId?: string
}

interface ChannelsPageDiagnosticsModalProps {
  opened: boolean
  channel: ChannelsPageDiagnosticsModalChannel | null
  fallbackChannel?: ChannelsPageDiagnosticsModalChannel | null
  targetKey: string
  pending: boolean
  missing: boolean
  refreshing?: boolean
  sharedStatusAlert?: FeishuSharedStatusAlertState | null
  repairingSharedStatus?: boolean
  canRepairSharedStatus?: boolean
  getTitle: (
    channel: ChannelsPageDiagnosticsModalChannel | null | undefined,
    fallback?: ChannelsPageDiagnosticsModalChannel | null | undefined
  ) => string
  getBotLabel: (
    channel: ChannelsPageDiagnosticsModalChannel | null | undefined,
    fallback?: ChannelsPageDiagnosticsModalChannel | null | undefined
  ) => string
  onClose: () => void
  onRefreshMissing: () => void
  onRepairSharedStatus: () => Promise<FeishuDiagnosticsRepairOutcome>
}

export default function ChannelsPageDiagnosticsModal({
  opened,
  channel,
  fallbackChannel = null,
  targetKey,
  pending,
  missing,
  refreshing = false,
  sharedStatusAlert = null,
  repairingSharedStatus = false,
  canRepairSharedStatus = false,
  getTitle,
  getBotLabel,
  onClose,
  onRefreshMissing,
  onRepairSharedStatus,
}: ChannelsPageDiagnosticsModalProps) {
  return (
    <FeishuDiagnosticsModalShell
      opened={opened}
      onClose={onClose}
      pending={pending}
      pendingTitle={getTitle(channel, fallbackChannel)}
      missing={missing}
      missingTitle={getTitle(fallbackChannel)}
      refreshing={refreshing}
      onRefreshMissing={targetKey ? onRefreshMissing : null}
      accountId={channel?.pairingAccountId || undefined}
      botLabel={getBotLabel(channel, fallbackChannel)}
      agentId={channel?.agentId}
      sharedStatusAlert={sharedStatusAlert}
      repairingSharedStatus={repairingSharedStatus}
      onRepairSharedStatus={canRepairSharedStatus && channel ? onRepairSharedStatus : null}
    />
  )
}
