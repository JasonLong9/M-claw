import type { MutableRefObject } from 'react'

import type { ChannelPairingTargetRef } from './channels-page-utils'

export interface FeishuTargetRefreshBindings {
  requestIdRef: MutableRefObject<number>
  setRefreshing: (value: boolean) => void
  setCheckedKey: (value: string) => void
}

export type ChannelsPageFeishuTargetRefreshChannels = () => Promise<unknown>

export interface ChannelsPageFeishuTargetRefreshChannelsBinding {
  refreshChannels: ChannelsPageFeishuTargetRefreshChannels
}

export type ChannelsPageTargetRefInput = ChannelPairingTargetRef | null | undefined

export interface ChannelsPageFeishuTargetSelectionBinding {
  active: boolean
  target: ChannelsPageTargetRefInput
}

export interface ChannelsPageFeishuTargetRefreshOptions
  extends ChannelsPageFeishuTargetRefreshChannelsBinding,
    ChannelsPageFeishuTargetSelectionBinding {}

export interface ChannelsPageFeishuTargetRefreshControls {
  refreshingTargetChannel: boolean
  refreshTargetChannelStatus: (pairingKey: string) => Promise<void>
}

export interface ChannelsPagePairingKeyBinding {
  pairingKey: string
}

export interface ChannelsPageFeishuTargetRefreshResult
  extends ChannelsPageFeishuTargetRefreshControls,
    ChannelsPagePairingKeyBinding {
  checkedTargetKey: string
}
