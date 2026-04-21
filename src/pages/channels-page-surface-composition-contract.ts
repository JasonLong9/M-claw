import type { ChannelsPageConfigFlowModalState } from './channels-page-config-flow-contract'
import type { ChannelsPageRefreshChannelsInBackgroundBinding } from './channels-page-core-controllers-contract'
import type { ChannelsPageChannelInfo, ChannelsPageVoidHandler } from './channels-page-data-contract'
import type { ChannelsPageFeishuPluginRepairBinding } from './channels-page-feishu-plugin-repair-contract'
import type {
  ChannelsPageTargetStateDeriverBinding,
} from './channels-page-feishu-target-state-contract'
import type {
  ChannelsPageMainSurfacePropsOptions,
  ChannelsPageMainSurfacePropsResult,
} from './channels-page-main-surface-props-contract'
import type {
  ChannelsPageFeishuModalDisplayHelpers,
  ChannelsPageModalPropsResult,
} from './channels-page-modal-props-contract'
import type { ChannelsPageModelModalState } from './channels-page-model-config-contract'
import type { ChannelsPageModelModalPropsResult } from './channels-page-model-modal-props-contract'
import type {
  ChannelsPageStateHelperTargetState,
} from './channels-page-state-helpers-contract'
import type {
  ChannelsPageDiagnosticsModalState,
  ChannelsPagePairingModalState,
} from './channels-page-target-modals-contract'

export interface ChannelsPageSurfaceCompositionOptions
  extends ChannelsPageMainSurfacePropsOptions,
    ChannelsPageConfigFlowModalState,
    ChannelsPageRefreshChannelsInBackgroundBinding<unknown>,
    ChannelsPageFeishuModalDisplayHelpers,
    ChannelsPageTargetStateDeriverBinding<
      ChannelsPageChannelInfo,
      ChannelsPageStateHelperTargetState<ChannelsPageChannelInfo>
    >,
    ChannelsPageFeishuPluginRepairBinding<ChannelsPageChannelInfo>,
    ChannelsPageModelModalState<ChannelsPageChannelInfo>,
    ChannelsPagePairingModalState<ChannelsPageChannelInfo, ChannelsPageVoidHandler>,
    ChannelsPageDiagnosticsModalState<ChannelsPageChannelInfo> {}

export interface ChannelsPageSurfaceCompositionResult
  extends ChannelsPageMainSurfacePropsResult,
    ChannelsPageModalPropsResult,
    ChannelsPageModelModalPropsResult {}
