import type { ComponentProps } from 'react'

import type { FeishuDiagnosticsRepairOutcome } from '../components/FeishuDiagnosticsModal'
import type ChannelsPageConfigModal from '../components/ChannelsPageConfigModal'
import type ChannelsPageDiagnosticsModal from '../components/ChannelsPageDiagnosticsModal'
import type ChannelsPagePairingModal from '../components/ChannelsPagePairingModal'
import type { ChannelsPageConfigFlowModalState } from './channels-page-config-flow-contract'
import type {
  ChannelsPageChannelInfo,
  ChannelsPageNullableChannel,
  ChannelsPageVoidHandler,
} from './channels-page-data-contract'
import type { ChannelsPageFeishuPluginRepairBinding } from './channels-page-feishu-plugin-repair-contract'
import type { ChannelsPageFeishuTargetRefreshControls } from './channels-page-feishu-target-refresh-contract'
import type {
  ChannelsPageChannelStatusBadgeDeriverBinding,
  ChannelsPageStateHelperBlockedBySharedStatusBinding,
  ChannelsPageStateHelperRepairStateBinding,
  ChannelsPageStateHelperRefreshStatusBinding,
} from './channels-page-state-helpers-contract'
import type { ChannelsPageGroupedTargetStatesBinding } from './channels-page-target-state-groups-contract'
import type {
  ChannelsPageDiagnosticsModalVisibilityState,
  ChannelsPagePairingModalVisibilityState,
} from './channels-page-target-modals-contract'

export interface ChannelsPageFeishuModalDisplayHelpers {
  getFeishuPairingModalSummary: ComponentProps<typeof ChannelsPagePairingModal>['getSummary']
  getFeishuRuntimeSummaryAlertColor: ComponentProps<typeof ChannelsPagePairingModal>['getRuntimeSummaryColor']
  getFeishuDiagnosticsModalTitle: ComponentProps<typeof ChannelsPageDiagnosticsModal>['getTitle']
  getFeishuChannelDisplayName: ComponentProps<typeof ChannelsPageDiagnosticsModal>['getBotLabel']
}

export interface ChannelsPageModalSharedStatusState<Alert>
  extends ChannelsPageStateHelperRepairStateBinding {
  statusAlert: Alert
}

export interface ChannelsPageModalTargetRefreshState
  extends ChannelsPageFeishuTargetRefreshControls,
    ChannelsPageStateHelperRefreshStatusBinding {
  targetKey: string
}

export interface ChannelsPageModalTargetChannelBinding {
  channel: ChannelsPageNullableChannel<ChannelsPageChannelInfo>
}

export interface ChannelsPageBaseModalTargetState<Alert>
  extends ChannelsPageModalSharedStatusState<Alert>,
    ChannelsPageModalTargetRefreshState,
    ChannelsPageModalTargetChannelBinding {
}

export interface ChannelsPageBlockedModalTargetState<Alert>
  extends ChannelsPageBaseModalTargetState<Alert>,
    ChannelsPageStateHelperBlockedBySharedStatusBinding {
}

export interface ChannelsPageConfigModalTargetState
  extends ChannelsPageBlockedModalTargetState<ComponentProps<typeof ChannelsPageConfigModal>['sharedStatusAlert']> {}

export interface ChannelsPagePairingModalTargetState
  extends ChannelsPageBlockedModalTargetState<ComponentProps<typeof ChannelsPagePairingModal>['sharedStatusAlert']> {}

export interface ChannelsPageDiagnosticsModalTargetState
  extends ChannelsPageBaseModalTargetState<ComponentProps<typeof ChannelsPageDiagnosticsModal>['sharedStatusAlert']> {
  fallbackChannel: ChannelsPageNullableChannel<ChannelsPageChannelInfo>
}

export interface ChannelsPageModalPropsOptions
  extends ChannelsPageConfigFlowModalState,
    ChannelsPageFeishuModalDisplayHelpers,
    ChannelsPagePairingModalVisibilityState<ChannelsPageVoidHandler>,
    ChannelsPageDiagnosticsModalVisibilityState,
    ChannelsPageChannelStatusBadgeDeriverBinding,
    ChannelsPageFeishuPluginRepairBinding<ChannelsPageChannelInfo>,
    ChannelsPageGroupedTargetStatesBinding<
      ChannelsPageConfigModalTargetState,
      ChannelsPagePairingModalTargetState,
      ChannelsPageDiagnosticsModalTargetState
    > {}

export interface ChannelsPageModalPropsResult {
  configModalProps: ComponentProps<typeof ChannelsPageConfigModal>
  pairingModalProps: ComponentProps<typeof ChannelsPagePairingModal>
  diagnosticsModalProps: ComponentProps<typeof ChannelsPageDiagnosticsModal>
}
