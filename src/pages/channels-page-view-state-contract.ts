import type {
  ChannelsPageChannelInfo,
  ChannelsPageLoadingBinding,
} from './channels-page-data-contract'
import type {
  ChannelsPageFeishuTargetStateOptions,
  ChannelsPageTargetStateDeriverBinding,
} from './channels-page-feishu-target-state-contract'
import type { ChannelsPageChannelCardDisplayHelpers } from './channels-page-main-surface-props-contract'
import type { ChannelsPageFeishuModalDisplayHelpers } from './channels-page-modal-props-contract'
import type {
  ChannelsPageChannelStatusBadgeDeriverBinding,
  ChannelsPageChannelStatusBadgeDeriver,
  ChannelsPageChannelStatusBadgeOptions,
  ChannelsPageLatestChannelSnapshotResolverBinding,
  ChannelsPageManagedStatusChannel,
  ChannelsPageManagedStatusResolvers,
  ChannelsPageStateHelperTargetState,
} from './channels-page-state-helpers-contract'
import type { ChannelPairingTargetRef } from './channels-page-utils'
import type ChannelsPageChannelCards from '../components/ChannelsPageChannelCards'
import type ChannelsPagePairingModal from '../components/ChannelsPagePairingModal'
import type { ChannelsPageSurfaceCompositionResult } from './channels-page-surface-composition-contract'

export interface ChannelsPageViewStateHelpers
  extends ChannelsPageChannelCardDisplayHelpers,
    ChannelsPageChannelStatusBadgeDeriverBinding,
    ChannelsPageFeishuModalDisplayHelpers,
    ChannelsPageTargetStateDeriverBinding<
      ChannelsPageChannelInfo,
      ChannelsPageStateHelperTargetState<ChannelsPageChannelInfo>
    >,
    ChannelsPageManagedStatusResolvers<ChannelsPageManagedStatusChannel<ChannelsPageChannelInfo>>,
    ChannelsPageLatestChannelSnapshotResolverBinding<ChannelsPageChannelInfo> {
}

export interface ChannelsPageViewStateResult
  extends ChannelsPageSurfaceCompositionResult,
    ChannelsPageLoadingBinding {}
