import type {
  ChannelsPageFeishuTargetSurfaceOptions,
  ChannelsPageFeishuTargetStateResult,
  ChannelsPageTargetStateAccessBinding,
} from './channels-page-feishu-target-state-contract'

export interface ChannelsPageGroupedTargetStatesBinding<
  ConfigTargetState,
  PairingTargetState = ConfigTargetState,
  DiagnosticsTargetState = PairingTargetState,
> {
  configTargetState: ConfigTargetState
  pairingTargetState: PairingTargetState
  diagnosticsTargetState: DiagnosticsTargetState
}

export interface ChannelsPageTargetStateGroupsOptions<Channel, State extends object>
  extends ChannelsPageTargetStateAccessBinding<Channel, State> {
  config: ChannelsPageFeishuTargetSurfaceOptions<Channel>
  pairing: ChannelsPageFeishuTargetSurfaceOptions<Channel>
  diagnostics: ChannelsPageFeishuTargetSurfaceOptions<Channel>
}

export interface ChannelsPageTargetStateGroupsResult<State extends object>
  extends ChannelsPageGroupedTargetStatesBinding<ChannelsPageFeishuTargetStateResult<State>> {}
