import type {
  ChannelsPageViewStateControllerStateInput,
  ChannelsPageViewStateControllerStateResult,
} from './channels-page-view-state-controller-state-contract'
import { useChannelsPageCoreControllers } from './channels-page-core-controllers'
import { useChannelsPageInteractionControllers } from './channels-page-interaction-controllers'
import { buildChannelsPageViewStateSurfaceControllerState } from './channels-page-view-state-surface-controller-state'

export function useChannelsPageViewStateControllerState({
  resolveLatestChannelSnapshot,
  shouldShowRepairAction,
  getSharedStatusAlert,
}: ChannelsPageViewStateControllerStateInput): ChannelsPageViewStateControllerStateResult {
  const coreControllerState = useChannelsPageCoreControllers({
    resolveLatestChannelSnapshot,
  })
  const { loading, fetchChannels, setError } = coreControllerState.dataState

  const interactionControllerState = useChannelsPageInteractionControllers({
    fetchChannels,
    setError,
    resolveLatestChannelSnapshot,
    shouldShowRepairAction,
    getSharedStatusAlert,
  })

  return {
    loading,
    surfaceControllerState: buildChannelsPageViewStateSurfaceControllerState({
      coreControllerState,
      interactionControllerState,
    }),
  }
}
