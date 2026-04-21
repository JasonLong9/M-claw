import type {
  ChannelsPageFeishuTargetStateHookOptions,
  ChannelsPageFeishuTargetStateResult,
} from './channels-page-feishu-target-state-contract'
import { useChannelsPageFeishuTargetRefresh } from './channels-page-feishu-target-refresh'

export function useChannelsPageFeishuTargetState<Channel, State extends object>({
  active,
  channels,
  target,
  fallbackChannel,
  repairingPluginChannelId,
  refreshChannels,
  deriveTargetState,
}: ChannelsPageFeishuTargetStateHookOptions<Channel, State>): ChannelsPageFeishuTargetStateResult<State> {
  const {
    refreshingTargetChannel,
    checkedTargetKey,
    refreshTargetChannelStatus,
  } = useChannelsPageFeishuTargetRefresh({
    active,
    target,
    refreshChannels,
  })

  return {
    ...deriveTargetState(channels, target, {
      fallbackChannel,
      refreshing: refreshingTargetChannel,
      checkedKey: checkedTargetKey,
      repairingPluginChannelId,
    }),
    refreshingTargetChannel,
    refreshTargetChannelStatus,
  }
}
