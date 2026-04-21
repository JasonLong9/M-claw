import ChannelsPageShell from '../components/ChannelsPageShell'
import { useChannelsPageViewState } from './channels-page-view-state'
import { channelsPageViewStateHelpers } from './channels-page-view-state-helpers'

export { shouldReuseModelOptionsCache } from './channels-page-model-config'
export {
  deriveChannelStatusBadges,
  deriveFeishuTargetState,
  getChannelCardSummary,
  getChannelEnabledLabel,
  getFeishuChannelDisplayName,
  getFeishuDiagnosticsModalTitle,
  getFeishuPairingModalSummary,
  getFeishuProvisionSourceDescription,
  getFeishuRuntimeSummaryAlertColor,
  getFeishuSharedStatusAlert,
  getManagedPluginStageState,
  resolveConfigTargetChannelSnapshot,
  resolveLatestChannelSnapshot,
  shouldShowFeishuPluginRepairAction,
  shouldShowPluginStatus,
} from './channels-page-state-helpers'

export default function ChannelsPage() {
  const {
    loading,
    topPanelProps,
    channelListPanelProps,
    channelCardsProps,
    configModalProps,
    pairingModalProps,
    modelConfigModalProps,
    diagnosticsModalProps,
  } = useChannelsPageViewState(channelsPageViewStateHelpers)

  return (
    <ChannelsPageShell
      loading={loading}
      topPanelProps={topPanelProps}
      channelListPanelProps={channelListPanelProps}
      channelCardsProps={channelCardsProps}
      configModalProps={configModalProps}
      pairingModalProps={pairingModalProps}
      modelConfigModalProps={modelConfigModalProps}
      diagnosticsModalProps={diagnosticsModalProps}
    />
  )
}
