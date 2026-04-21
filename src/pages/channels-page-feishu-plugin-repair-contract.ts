import type { FeishuDiagnosticsRepairOutcome } from '../components/FeishuDiagnosticsModal'
import type { ChannelsPageAsyncChannelActionHandler } from './channels-page-channel-actions-contract'
import type {
  ChannelsPageChannelIdentityBinding,
  ChannelsPageOnPageErrorBinding,
  ChannelsPagePendingChannelId,
} from './channels-page-data-contract'
import type {
  ChannelsPageManagedStatusAccessBinding,
} from './channels-page-state-helpers-contract'

export interface ChannelsPageFeishuPluginRepairChannel
  extends ChannelsPageChannelIdentityBinding {
  pluginStatus?: {
    summary?: string
  } | null
}

export interface ChannelsPageFeishuPluginRepairOptions<Channel extends ChannelsPageFeishuPluginRepairChannel>
  extends ChannelsPageManagedStatusAccessBinding<Channel, Channel>,
    ChannelsPageOnPageErrorBinding {}

export type ChannelsPageFeishuPluginRepairSurface = 'page' | 'pairing' | 'diagnostics'

export interface ChannelsPageFeishuPluginRepairRequestOptions {
  surface?: ChannelsPageFeishuPluginRepairSurface
}

export type ChannelsPageFeishuPluginRepairHandler<Channel> = (
  channel: Channel,
  options?: ChannelsPageFeishuPluginRepairRequestOptions
) => Promise<FeishuDiagnosticsRepairOutcome>

export interface ChannelsPageFeishuPluginRepairBinding<Channel> {
  repairFeishuPlugin: ChannelsPageFeishuPluginRepairHandler<Channel>
}

export interface ChannelsPageRepairingPluginChannelBinding {
  repairingPluginChannelId: ChannelsPagePendingChannelId
}

export interface ChannelsPageFeishuPluginRepairResult<Channel extends ChannelsPageFeishuPluginRepairChannel>
  extends ChannelsPageFeishuPluginRepairBinding<Channel>,
    ChannelsPageRepairingPluginChannelBinding {
  handleRepairFeishuPlugin: ChannelsPageAsyncChannelActionHandler<Channel>
}
