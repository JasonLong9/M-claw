import type { ChannelsPageChannelActionsResult } from './channels-page-channel-actions-contract'
import type {
  ChannelsPageChannelInfo as ChannelInfo,
  ChannelsPageSetPageErrorBinding,
} from './channels-page-data-contract'
import type { ChannelsPageConfigFlowResult } from './channels-page-config-flow-contract'
import type { ChannelsPageFeishuPluginRepairResult } from './channels-page-feishu-plugin-repair-contract'
import type {
  ChannelsPageManagedStatusAccessBinding,
  ChannelsPageManagedStatusChannel,
} from './channels-page-state-helpers-contract'

export interface ChannelsPageInteractionControllersOptions
  extends ChannelsPageManagedStatusAccessBinding<
      ChannelsPageManagedStatusChannel<ChannelInfo>,
      ChannelInfo
    >,
    ChannelsPageSetPageErrorBinding {}

export interface ChannelsPageInteractionControllersResult {
  channelActionState: ChannelsPageChannelActionsResult<ChannelInfo>
  configFlowState: ChannelsPageConfigFlowResult
  pluginRepairState: ChannelsPageFeishuPluginRepairResult<ChannelInfo>
}
