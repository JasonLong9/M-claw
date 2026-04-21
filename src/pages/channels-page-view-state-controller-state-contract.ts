import type { ChannelsPageLoadingBinding } from './channels-page-data-contract'
import type {
  ChannelsPageViewStateHelpers,
} from './channels-page-view-state-contract'
import type { ChannelsPageSurfaceCompositionOptions } from './channels-page-surface-composition-contract'

export type ChannelsPageViewStateControllerStateInput = Pick<
  ChannelsPageViewStateHelpers,
  'resolveLatestChannelSnapshot' | 'shouldShowRepairAction' | 'getSharedStatusAlert'
>

export type ChannelsPageViewStateSurfaceControllerState = Omit<
  ChannelsPageSurfaceCompositionOptions,
  | 'deriveTargetState'
  | 'deriveChannelStatusBadges'
  | 'getChannelCardSummary'
  | 'getFeishuSharedStatusAlert'
  | 'getFeishuProvisionSourceDescription'
  | 'shouldShowPluginStatus'
  | 'shouldShowFeishuPluginRepairAction'
  | 'getFeishuPairingModalSummary'
  | 'getFeishuRuntimeSummaryAlertColor'
  | 'getFeishuDiagnosticsModalTitle'
  | 'getFeishuChannelDisplayName'
>

export interface ChannelsPageViewStateSurfaceControllerStateBinding {
  surfaceControllerState: ChannelsPageViewStateSurfaceControllerState
}

export interface ChannelsPageViewStateControllerStateResult
  extends ChannelsPageViewStateSurfaceControllerStateBinding,
    ChannelsPageLoadingBinding {}
