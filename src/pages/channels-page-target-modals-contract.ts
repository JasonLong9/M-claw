import type {
  ChannelsPageAsyncVoidHandler,
  ChannelsPageChannelIdentityBinding,
  ChannelsPageChannelSnapshotsSyncHandler,
  ChannelsPageNullableChannel,
  ChannelsPagePairingAccountBinding,
  ChannelsPagePairingRequirementBinding,
  ChannelsPageVoidHandler,
} from './channels-page-data-contract'
import type { ChannelsPageLatestChannelSnapshotAccessBinding } from './channels-page-state-helpers-contract'
import type { ChannelPairingTargetRef } from './channels-page-utils'

export interface ChannelsPageTargetModalChannel
  extends ChannelsPageChannelIdentityBinding,
    ChannelsPagePairingRequirementBinding,
    ChannelsPagePairingAccountBinding {
}

export interface ChannelsPageTargetModalsOptions<Channel extends ChannelsPageTargetModalChannel>
  extends ChannelsPageLatestChannelSnapshotAccessBinding<Channel> {}

export type ChannelsPageTargetModalOpenHandler<Channel> = (channel: Channel) => void

export interface ChannelsPageTargetModalOpenHandlers<Channel> {
  handleOpenPairing: ChannelsPageTargetModalOpenHandler<Channel>
  handleOpenDiagnostics: ChannelsPageTargetModalOpenHandler<Channel>
}

export type ChannelsPageTargetModalSelectionRef = ChannelPairingTargetRef | null

export interface ChannelsPagePairingModalVisibilityState<
  PairingDoneHandler extends () => unknown = ChannelsPageAsyncVoidHandler,
> {
  showPairingModal: boolean
  handlePairingClose: ChannelsPageVoidHandler
  handlePairingDone: PairingDoneHandler
}

export interface ChannelsPagePairingModalState<
  Channel,
  PairingDoneHandler extends () => unknown = ChannelsPageAsyncVoidHandler,
> extends ChannelsPagePairingModalVisibilityState<PairingDoneHandler> {
  selectedPairingChannel: ChannelsPageNullableChannel<Channel>
  selectedPairingTarget: ChannelsPageTargetModalSelectionRef
}

export interface ChannelsPageDiagnosticsModalVisibilityState {
  showDiagnosticsModal: boolean
  handleDiagnosticsClose: ChannelsPageVoidHandler
}

export interface ChannelsPageDiagnosticsModalState<Channel>
  extends ChannelsPageDiagnosticsModalVisibilityState {
  selectedDiagnosticsChannel: ChannelsPageNullableChannel<Channel>
  selectedDiagnosticsTarget: ChannelsPageTargetModalSelectionRef
}

export interface ChannelsPageTargetModalsResult<Channel extends ChannelsPageTargetModalChannel>
  extends ChannelsPageTargetModalOpenHandlers<Channel>,
    ChannelsPagePairingModalState<Channel>,
    ChannelsPageDiagnosticsModalState<Channel> {
  syncSelectedTargetChannelSnapshots: ChannelsPageChannelSnapshotsSyncHandler<Channel>
}
