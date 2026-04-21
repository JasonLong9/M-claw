import type { ChannelsPageViewStateHelpers } from './channels-page-view-state-contract'
import {
  deriveChannelStatusBadges,
  deriveFeishuTargetState,
  getChannelCardSummary,
  getFeishuChannelDisplayName,
  getFeishuDiagnosticsModalTitle,
  getFeishuPairingModalSummary,
  getFeishuProvisionSourceDescription,
  getFeishuRuntimeSummaryAlertColor,
  getFeishuSharedStatusAlert,
  resolveLatestChannelSnapshot,
  shouldShowFeishuPluginRepairAction,
  shouldShowPluginStatus,
} from './channels-page-state-helpers'

export const channelsPageViewStateHelpers: ChannelsPageViewStateHelpers = {
  resolveLatestChannelSnapshot,
  shouldShowRepairAction: shouldShowFeishuPluginRepairAction,
  getSharedStatusAlert: getFeishuSharedStatusAlert,
  deriveTargetState: deriveFeishuTargetState,
  deriveChannelStatusBadges,
  getChannelCardSummary,
  getFeishuProvisionSourceDescription,
  shouldShowPluginStatus,
  shouldShowFeishuPluginRepairAction,
  getFeishuPairingModalSummary,
  getFeishuRuntimeSummaryAlertColor,
  getFeishuDiagnosticsModalTitle,
  getFeishuChannelDisplayName,
}
