import type { ChannelsPageChannelInfo as ChannelInfo } from './channels-page-data-contract'
import type {
  ChannelsPageInteractionControllersOptions,
  ChannelsPageInteractionControllersResult,
} from './channels-page-interaction-controllers-contract'
import { useChannelsPageChannelActions } from './channels-page-channel-actions'
import { useChannelsPageConfigFlow } from './channels-page-config-flow'
import { useChannelsPageFeishuPluginRepair } from './channels-page-feishu-plugin-repair'

export function useChannelsPageInteractionControllers({
  fetchChannels,
  setError,
  resolveLatestChannelSnapshot,
  shouldShowRepairAction,
  getSharedStatusAlert,
}: ChannelsPageInteractionControllersOptions): ChannelsPageInteractionControllersResult {
  const channelActionState = useChannelsPageChannelActions<ChannelInfo>({
    fetchChannels,
    onPageError: setError,
  })

  const configFlowState = useChannelsPageConfigFlow({
    fetchChannels,
  })

  const pluginRepairState = useChannelsPageFeishuPluginRepair<ChannelInfo>({
    fetchChannels,
    resolveLatestChannelSnapshot,
    shouldShowRepairAction,
    getSharedStatusAlert,
    onPageError: setError,
  })

  return {
    channelActionState,
    configFlowState,
    pluginRepairState,
  }
}
