import type {
  ChannelsPageAccountNameBinding,
  ChannelsPageChannelEnabledBinding,
  ChannelsPageChannelIdentityBinding,
  ChannelsPageChannelNameBinding,
  ChannelsPageConfigChannelBinding,
  ChannelsPageFetchChannelsBinding,
  ChannelsPageOnPageErrorBinding,
  ChannelsPagePairingAccountBinding,
  ChannelsPagePendingChannelId,
} from './channels-page-data-contract'
import type { ChannelsPageTargetModalOpenHandlers } from './channels-page-target-modals-contract'

export interface ChannelsPageChannelActionChannel
  extends ChannelsPageChannelIdentityBinding,
    ChannelsPageChannelEnabledBinding,
    ChannelsPageChannelNameBinding,
    ChannelsPageConfigChannelBinding,
    ChannelsPagePairingAccountBinding,
    ChannelsPageAccountNameBinding {}

export interface ChannelsPageChannelActionsOptions<Channel extends ChannelsPageChannelActionChannel>
  extends ChannelsPageFetchChannelsBinding<Channel>,
    ChannelsPageOnPageErrorBinding {}

export type ChannelsPageAsyncChannelActionHandler<Channel> = (channel: Channel) => Promise<void>

export type ChannelsPageSurfaceChannelActionHandler<Channel> = (
  channel: Channel
) => Promise<unknown> | void

export interface ChannelsPageChannelSurfaceActionHandlers<Channel>
  extends ChannelsPageTargetModalOpenHandlers<Channel> {
  handleOpenModelConfig: ChannelsPageSurfaceChannelActionHandler<Channel>
  handleToggleChannelEnabled: ChannelsPageSurfaceChannelActionHandler<Channel>
  handleRepairFeishuPlugin: ChannelsPageSurfaceChannelActionHandler<Channel>
  handleRemoveChannel: ChannelsPageSurfaceChannelActionHandler<Channel>
}

export interface ChannelsPageTogglingChannelBinding {
  togglingChannelId: ChannelsPagePendingChannelId
}

export interface ChannelsPageChannelActionsResult<Channel extends ChannelsPageChannelActionChannel>
  extends ChannelsPageTogglingChannelBinding {
  handleRemoveChannel: ChannelsPageAsyncChannelActionHandler<Channel>
  handleToggleChannelEnabled: ChannelsPageAsyncChannelActionHandler<Channel>
}
