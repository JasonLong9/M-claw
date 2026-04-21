import type {
  ChannelsPageChannelInfo as ChannelInfo,
  ChannelsPageDataResult,
} from './channels-page-data-contract'
import type { ChannelsPageModelConfigResult } from './channels-page-model-config-contract'
import type { ChannelsPageLatestChannelSnapshotResolverBinding } from './channels-page-state-helpers-contract'
import type { ChannelsPageTargetModalsResult } from './channels-page-target-modals-contract'

export interface ChannelsPageCoreControllersOptions
  extends ChannelsPageLatestChannelSnapshotResolverBinding<ChannelInfo> {}

export type ChannelsPageRefreshChannelsInBackground<Channel> = () => Promise<Channel[]>

export interface ChannelsPageRefreshChannelsInBackgroundBinding<Channel> {
  refreshChannelsInBackground: ChannelsPageRefreshChannelsInBackground<Channel>
}

export interface ChannelsPageCoreControllersResult
  extends ChannelsPageRefreshChannelsInBackgroundBinding<ChannelInfo> {
  dataState: ChannelsPageDataResult
  targetModalState: ChannelsPageTargetModalsResult<ChannelInfo>
  modelConfigState: ChannelsPageModelConfigResult<ChannelInfo>
}
