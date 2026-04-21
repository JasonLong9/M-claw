import type { Dispatch, SetStateAction } from 'react'

import type { ChannelsPageAsyncChannelActionHandler } from './channels-page-channel-actions-contract'
import type {
  ChannelsPageAgentBinding,
  ChannelsPageAsyncVoidHandler,
  ChannelsPageChannelIdentityBinding,
  ChannelsPageChannelNameBinding,
  ChannelsPageChannelSnapshotsSyncHandler,
  ChannelsPageNullableChannel,
  ChannelsPageNullableStringSetter,
} from './channels-page-data-contract'
import type { ModelSelectOption } from './channels-page-model-options'
import type { ChannelsPageLatestChannelSnapshotAccessBinding } from './channels-page-state-helpers-contract'

export interface ChannelsPageModelConfigChannel
  extends ChannelsPageChannelIdentityBinding,
    ChannelsPageChannelNameBinding,
    ChannelsPageAgentBinding {}

export interface ChannelsPageModelConfigOptions<Channel extends ChannelsPageModelConfigChannel>
  extends ChannelsPageLatestChannelSnapshotAccessBinding<Channel> {}

export interface ChannelsPageModelModalState<Channel> {
  showModelModal: boolean
  selectedModelChannel: ChannelsPageNullableChannel<Channel>
  modelOptions: ModelSelectOption[]
  selectedModelValue: string | null
  currentRuntimeModel: string | null
  modelModalError: string
  loadingModelContext: boolean
  savingModel: boolean
  setSelectedModelValue: ChannelsPageNullableStringSetter
  closeModelModal: (options?: { force?: boolean }) => void
  handleSaveBotModel: ChannelsPageAsyncVoidHandler
}

export interface ChannelsPageModelConfigResult<Channel extends ChannelsPageModelConfigChannel>
  extends ChannelsPageModelModalState<Channel> {
  handleOpenModelConfig: ChannelsPageAsyncChannelActionHandler<Channel>
  syncSelectedModelChannelSnapshot: ChannelsPageChannelSnapshotsSyncHandler<Channel>
}
