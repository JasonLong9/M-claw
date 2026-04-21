import type {
  ChannelsPageViewStateHelpers,
  ChannelsPageViewStateResult,
} from './channels-page-view-state-contract'
import { useChannelsPageViewStateControllerState } from './channels-page-view-state-controller-state'
import { useChannelsPageSurfaceComposition } from './channels-page-surface-composition'

export function useChannelsPageViewState({
  resolveLatestChannelSnapshot,
  shouldShowRepairAction,
  getSharedStatusAlert,
  deriveTargetState,
  deriveChannelStatusBadges,
  getChannelCardSummary,
  getFeishuProvisionSourceDescription,
  shouldShowPluginStatus,
  shouldShowFeishuPluginRepairAction,
  getFeishuPairingModalSummary,
  getFeishuRuntimeSummaryAlertColor,
  getFeishuDiagnosticsModalTitle,
  getFeishuChannelDisplayName,
}: ChannelsPageViewStateHelpers): ChannelsPageViewStateResult {
  const {
    loading,
    surfaceControllerState,
  } = useChannelsPageViewStateControllerState({
    resolveLatestChannelSnapshot,
    shouldShowRepairAction,
    getSharedStatusAlert,
  })

  const {
    topPanelProps,
    channelListPanelProps,
    channelCardsProps,
    configModalProps,
    pairingModalProps,
    modelConfigModalProps,
    diagnosticsModalProps,
  } = useChannelsPageSurfaceComposition({
    ...surfaceControllerState,
    deriveTargetState,
    deriveChannelStatusBadges,
    getChannelCardSummary,
    getFeishuSharedStatusAlert: getSharedStatusAlert,
    getFeishuProvisionSourceDescription,
    shouldShowPluginStatus,
    shouldShowFeishuPluginRepairAction,
    getFeishuPairingModalSummary,
    getFeishuRuntimeSummaryAlertColor,
    getFeishuDiagnosticsModalTitle,
    getFeishuChannelDisplayName,
  })

  return {
    loading,
    topPanelProps,
    channelListPanelProps,
    channelCardsProps,
    configModalProps,
    pairingModalProps,
    modelConfigModalProps,
    diagnosticsModalProps,
  }
}


