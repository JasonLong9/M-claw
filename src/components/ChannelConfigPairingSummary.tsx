import { Alert } from '@mantine/core'

import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'
import FeishuSharedStatusAlert from './FeishuSharedStatusAlert'

interface ChannelConfigPairingSummaryProps {
  introTitle: string
  introMessage: string
  sharedStatusAlert?: FeishuSharedStatusAlertState | null
  sharedStatusRepairHint?: string
  sharedStatusRepairing?: boolean
  onRepairSharedStatus?: (() => void) | null
}

export default function ChannelConfigPairingSummary({
  introTitle,
  introMessage,
  sharedStatusAlert = null,
  sharedStatusRepairHint = '',
  sharedStatusRepairing = false,
  onRepairSharedStatus = null,
}: ChannelConfigPairingSummaryProps) {
  return (
    <>
      <Alert
        color="success"
        variant="light"
        title={introTitle}
      >
        {introMessage}
      </Alert>

      {sharedStatusAlert && (
        <FeishuSharedStatusAlert
          alert={sharedStatusAlert}
          repairHint={sharedStatusRepairHint}
          repairing={sharedStatusRepairing}
          onRepair={onRepairSharedStatus}
        />
      )}
    </>
  )
}
