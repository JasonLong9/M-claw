import type {
  ChannelsPageFeishuTargetRefreshControls,
  ChannelsPageFeishuTargetRefreshChannelsBinding,
  ChannelsPageFeishuTargetSelectionBinding,
  ChannelsPageTargetRefInput,
} from './channels-page-feishu-target-refresh-contract'
import type { ChannelsPageChannelsBinding } from './channels-page-data-contract'
import type {
  ChannelsPageStateHelperFallbackChannelBinding,
  ChannelsPageStateHelperRepairingPluginChannelBinding,
  ChannelsPageStateHelperTargetStateOptions,
} from './channels-page-state-helpers-contract'

export type ChannelsPageFeishuTargetStateOptions<Channel> = ChannelsPageStateHelperTargetStateOptions<Channel>

export interface ChannelsPageFeishuTargetStateRefreshOptions
  extends ChannelsPageFeishuTargetRefreshChannelsBinding,
    ChannelsPageStateHelperRepairingPluginChannelBinding {}

export interface ChannelsPageFeishuTargetSurfaceOptions<Channel>
  extends ChannelsPageStateHelperFallbackChannelBinding<Channel>,
    ChannelsPageFeishuTargetSelectionBinding {}

export type ChannelsPageTargetStateDeriver<Channel, State> = (
  channels: Channel[],
  target: ChannelsPageTargetRefInput,
  options: ChannelsPageFeishuTargetStateOptions<Channel>
) => State

export interface ChannelsPageTargetStateChannelsBinding<Channel>
  extends ChannelsPageChannelsBinding<Channel> {}

export interface ChannelsPageTargetStateDeriverBinding<Channel, State> {
  deriveTargetState: ChannelsPageTargetStateDeriver<Channel, State>
}

export interface ChannelsPageTargetStateAccessBinding<Channel, State>
  extends ChannelsPageFeishuTargetStateRefreshOptions,
    ChannelsPageTargetStateChannelsBinding<Channel>,
    ChannelsPageTargetStateDeriverBinding<Channel, State> {}

export interface ChannelsPageFeishuTargetStateHookOptions<Channel, State extends object>
  extends ChannelsPageTargetStateAccessBinding<Channel, State>,
    ChannelsPageFeishuTargetSurfaceOptions<Channel> {
}

export type ChannelsPageFeishuTargetStateResult<State extends object> = State &
  ChannelsPageFeishuTargetRefreshControls
