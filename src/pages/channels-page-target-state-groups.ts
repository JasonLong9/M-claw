import {
  useChannelsPageFeishuTargetState,
} from './channels-page-feishu-target-state'
import type {
  ChannelsPageTargetStateGroupsOptions,
  ChannelsPageTargetStateGroupsResult,
} from './channels-page-target-state-groups-contract'

export function useChannelsPageTargetStateGroups<Channel, State extends object>({
  channels,
  repairingPluginChannelId,
  refreshChannels,
  deriveTargetState,
  config,
  pairing,
  diagnostics,
}: ChannelsPageTargetStateGroupsOptions<Channel, State>): ChannelsPageTargetStateGroupsResult<State> {
  const configTargetState = useChannelsPageFeishuTargetState({
    active: config.active,
    channels,
    target: config.target,
    fallbackChannel: config.fallbackChannel,
    repairingPluginChannelId,
    refreshChannels,
    deriveTargetState,
  })

  const pairingTargetState = useChannelsPageFeishuTargetState({
    active: pairing.active,
    channels,
    target: pairing.target,
    fallbackChannel: pairing.fallbackChannel,
    repairingPluginChannelId,
    refreshChannels,
    deriveTargetState,
  })

  const diagnosticsTargetState = useChannelsPageFeishuTargetState({
    active: diagnostics.active,
    channels,
    target: diagnostics.target,
    fallbackChannel: diagnostics.fallbackChannel,
    repairingPluginChannelId,
    refreshChannels,
    deriveTargetState,
  })

  return {
    configTargetState,
    pairingTargetState,
    diagnosticsTargetState,
  }
}
