import type { ComponentProps } from 'react'

import type ChannelsPageChannelCards from '../components/ChannelsPageChannelCards'
import type ChannelsPageChannelListPanel from '../components/ChannelsPageChannelListPanel'
import type ChannelsPageTopPanel from '../components/ChannelsPageTopPanel'
import type {
  ChannelsPageChannelSurfaceActionHandlers,
  ChannelsPageTogglingChannelBinding,
} from './channels-page-channel-actions-contract'
import type { ChannelsPageOpenAddChannelHandler } from './channels-page-config-flow-contract'
import type {
  ChannelsPageChannelsBinding,
  ChannelsPageChannelInfo,
  ChannelsPageRefreshFeedbackBinding,
  ChannelsPageSetPageErrorBinding,
} from './channels-page-data-contract'
import type { ChannelsPageRepairingPluginChannelBinding } from './channels-page-feishu-plugin-repair-contract'
import type {
  ChannelsPageChannelStatusBadgeDeriverBinding,
  ChannelsPageChannelStatusBadgeDeriver,
} from './channels-page-state-helpers-contract'

export interface ChannelsPageMainSurfacePropsOptions
  extends ChannelsPageChannelSurfaceActionHandlers<ChannelsPageChannelInfo>,
    ChannelsPageChannelsBinding<ChannelsPageChannelInfo>,
    ChannelsPageChannelCardDisplayHelpers,
    ChannelsPageChannelStatusBadgeDeriverBinding,
    ChannelsPageTogglingChannelBinding,
    ChannelsPageRepairingPluginChannelBinding,
    ChannelsPageRefreshFeedbackBinding,
    ChannelsPageSetPageErrorBinding {
  handleOpenAddChannel: ChannelsPageOpenAddChannelHandler
  getFeishuSharedStatusAlert: ComponentProps<typeof ChannelsPageChannelCards>['getFeishuSharedStatusAlert']
}

export interface ChannelsPageChannelCardDisplayHelpers {
  getChannelCardSummary: ComponentProps<typeof ChannelsPageChannelCards>['getSummary']
  getFeishuProvisionSourceDescription: ComponentProps<typeof ChannelsPageChannelCards>['getFeishuProvisionDescription']
  shouldShowPluginStatus: ComponentProps<typeof ChannelsPageChannelCards>['shouldShowPluginStatus']
  shouldShowFeishuPluginRepairAction: ComponentProps<typeof ChannelsPageChannelCards>['shouldShowRepairAction']
}

export interface ChannelsPageMainSurfacePropsResult {
  topPanelProps: ComponentProps<typeof ChannelsPageTopPanel>
  channelListPanelProps: ComponentProps<typeof ChannelsPageChannelListPanel>
  channelCardsProps: ComponentProps<typeof ChannelsPageChannelCards>
}
