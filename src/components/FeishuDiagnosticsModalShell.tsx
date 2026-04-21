import { Modal } from '@mantine/core'

import FeishuDiagnosticsModal, {
  type FeishuDiagnosticsRepairOutcome,
} from './FeishuDiagnosticsModal'
import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import FeishuTargetGateAlert from './FeishuTargetGateAlert'

interface FeishuDiagnosticsModalShellProps {
  opened: boolean
  onClose: () => void
  pending: boolean
  pendingTitle: string
  missing: boolean
  missingTitle: string
  refreshing?: boolean
  onRefreshMissing?: (() => void) | null
  accountId?: string
  botLabel?: string
  agentId?: string
  sharedStatusAlert?: FeishuSharedStatusAlertState | null
  repairingSharedStatus?: boolean
  onRepairSharedStatus?: (() => Promise<FeishuDiagnosticsRepairOutcome>) | null
}

export default function FeishuDiagnosticsModalShell({
  opened,
  onClose,
  pending,
  pendingTitle,
  missing,
  missingTitle,
  refreshing = false,
  onRefreshMissing = null,
  accountId,
  botLabel = '飞书机器人',
  agentId,
  sharedStatusAlert = null,
  repairingSharedStatus = false,
  onRepairSharedStatus = null,
}: FeishuDiagnosticsModalShellProps) {
  if (!opened) return null

  if (pending) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title={pendingTitle}
        size="lg"
      >
        <FeishuTargetGateAlert state="pending" surface="diagnostics" />
      </Modal>
    )
  }

  if (missing) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title={missingTitle}
        size="lg"
      >
        <FeishuTargetGateAlert
          state="missing"
          surface="diagnostics"
          refreshing={refreshing}
          onRefresh={onRefreshMissing}
          onSecondaryAction={onClose}
        />
      </Modal>
    )
  }

  if (!accountId) return null

  return (
    <FeishuDiagnosticsModal
      opened={opened}
      onClose={onClose}
      accountId={accountId}
      botLabel={botLabel}
      agentId={agentId}
      sharedStatusAlert={sharedStatusAlert}
      repairingSharedStatus={repairingSharedStatus}
      onRepairSharedStatus={onRepairSharedStatus}
    />
  )
}
