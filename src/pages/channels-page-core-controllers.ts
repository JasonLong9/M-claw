import {
  useChannelsPageData,
} from './channels-page-data'
import type { ChannelsPageChannelInfo as ChannelInfo } from './channels-page-data-contract'
import type {
  ChannelsPageCoreControllersOptions,
  ChannelsPageCoreControllersResult,
} from './channels-page-core-controllers-contract'
import { useChannelsPageModelConfig } from './channels-page-model-config'
import { useChannelsPageTargetModals } from './channels-page-target-modals'

export function useChannelsPageCoreControllers({
  resolveLatestChannelSnapshot,
}: ChannelsPageCoreControllersOptions): ChannelsPageCoreControllersResult {
  const syncSelectedChannelSnapshots = (nextChannels: ChannelInfo[]) => {
    targetModalState.syncSelectedTargetChannelSnapshots(nextChannels)
    modelConfigState.syncSelectedModelChannelSnapshot(nextChannels)
  }

  const dataState = useChannelsPageData({
    syncSelectedChannelSnapshots,
  })

  const targetModalState = useChannelsPageTargetModals<ChannelInfo>({
    fetchChannels: dataState.fetchChannels,
    resolveLatestChannelSnapshot,
  })

  const modelConfigState = useChannelsPageModelConfig<ChannelInfo>({
    fetchChannels: dataState.fetchChannels,
    resolveLatestChannelSnapshot,
  })

  const refreshChannelsInBackground = () => dataState.fetchChannels({ background: true })

  return {
    dataState,
    targetModalState,
    modelConfigState,
    refreshChannelsInBackground,
  }
}
