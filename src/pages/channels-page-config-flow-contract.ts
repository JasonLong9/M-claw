import type { Dispatch, SetStateAction } from 'react'

import type {
  ChannelsPageAsyncVoidHandler,
  ChannelsPageFetchChannelsBinding,
  ChannelsPageNullableStringSetter,
  ChannelsPageVoidHandler,
} from './channels-page-data-contract'
import type { ChannelPairingTarget, ChannelsConfigStep } from './channels-page-utils'

export interface ChannelsPageConfigFlowOptions extends ChannelsPageFetchChannelsBinding<unknown> {}

export interface ChannelsPageConfigFlowModalState {
  showConfigModal: boolean
  selectedChannelId: string | null
  selectedConfigTarget: ChannelPairingTarget | null
  configStep: ChannelsConfigStep
  handleChannelConfigBack: ChannelsPageVoidHandler
  handleConfigDone: ChannelsPageAsyncVoidHandler
  setSelectedChannelId: ChannelsPageNullableStringSetter
  setSelectedConfigTarget: Dispatch<SetStateAction<ChannelPairingTarget | null>>
  setConfigStep: Dispatch<SetStateAction<ChannelsConfigStep>>
}

export type ChannelsPageOpenAddChannelHandler = ChannelsPageVoidHandler

export interface ChannelsPageConfigFlowResult extends ChannelsPageConfigFlowModalState {
  handleOpenAddChannel: ChannelsPageOpenAddChannelHandler
}
