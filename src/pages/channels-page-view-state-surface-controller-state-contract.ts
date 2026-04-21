import type {
  ChannelsPageViewStateSurfaceControllerStateBinding,
} from './channels-page-view-state-controller-state-contract'
import type { ChannelsPageCoreControllersResult } from './channels-page-core-controllers-contract'
import type { ChannelsPageInteractionControllersResult } from './channels-page-interaction-controllers-contract'

export type ChannelsPageCoreControllersState = ChannelsPageCoreControllersResult

export type ChannelsPageInteractionControllersState = ChannelsPageInteractionControllersResult

export interface BuildChannelsPageViewStateSurfaceControllerStateOptions {
  coreControllerState: ChannelsPageCoreControllersState
  interactionControllerState: ChannelsPageInteractionControllersState
}

export interface BuildChannelsPageViewStateSurfaceControllerStateResult
  extends ChannelsPageViewStateSurfaceControllerStateBinding {}
