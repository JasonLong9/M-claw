import { describe, expect, it } from 'vitest'

import targetModalsContractSource from '../channels-page-target-modals-contract.ts?raw'

describe('channels-page-target-modals-contract module', () => {
  it('keeps the target-modal input and output contract behind one dedicated module', () => {
    expect(targetModalsContractSource).toContain(
      "import type {"
    )
    expect(targetModalsContractSource).toContain('ChannelsPageAsyncVoidHandler,')
    expect(targetModalsContractSource).toContain('ChannelsPageChannelIdentityBinding,')
    expect(targetModalsContractSource).toContain('ChannelsPageChannelSnapshotsSyncHandler,')
    expect(targetModalsContractSource).toContain('ChannelsPageNullableChannel,')
    expect(targetModalsContractSource).toContain('ChannelsPagePairingAccountBinding,')
    expect(targetModalsContractSource).toContain('ChannelsPagePairingRequirementBinding,')
    expect(targetModalsContractSource).toContain('ChannelsPageVoidHandler,')
    expect(targetModalsContractSource).toContain(
      "} from './channels-page-data-contract'"
    )
    expect(targetModalsContractSource).toContain(
      "import type { ChannelsPageLatestChannelSnapshotAccessBinding } from './channels-page-state-helpers-contract'"
    )
    expect(targetModalsContractSource).toContain("import type { ChannelPairingTargetRef } from './channels-page-utils'")
    expect(targetModalsContractSource).toContain('export interface ChannelsPageTargetModalChannel')
    expect(targetModalsContractSource).toContain('export interface ChannelsPageTargetModalsOptions<Channel extends ChannelsPageTargetModalChannel>')
    expect(targetModalsContractSource).toContain(
      'export type ChannelsPageTargetModalOpenHandler<Channel> = (channel: Channel) => void'
    )
    expect(targetModalsContractSource).toContain('export interface ChannelsPageTargetModalOpenHandlers<Channel> {')
    expect(targetModalsContractSource).toContain(
      'export type ChannelsPageTargetModalSelectionRef = ChannelPairingTargetRef | null'
    )
    expect(targetModalsContractSource).toContain('export interface ChannelsPagePairingModalVisibilityState<')
    expect(targetModalsContractSource).toContain('export interface ChannelsPagePairingModalState<')
    expect(targetModalsContractSource).toContain('export interface ChannelsPageDiagnosticsModalVisibilityState {')
    expect(targetModalsContractSource).toContain('export interface ChannelsPageDiagnosticsModalState<Channel>')
    expect(targetModalsContractSource).toContain('export interface ChannelsPageTargetModalsResult<Channel extends ChannelsPageTargetModalChannel>')
    expect(targetModalsContractSource).toContain('extends ChannelsPageLatestChannelSnapshotAccessBinding<Channel> {}')
  })

  it('keeps pairing and diagnostics state plus modal actions in the shared contract module', () => {
    expect(targetModalsContractSource).toContain('ChannelsPageLatestChannelSnapshotAccessBinding<Channel> {}')
    expect(targetModalsContractSource).toContain('extends ChannelsPageChannelIdentityBinding,')
    expect(targetModalsContractSource).toContain('ChannelsPagePairingRequirementBinding,')
    expect(targetModalsContractSource).toContain('ChannelsPagePairingAccountBinding {')
    expect(targetModalsContractSource).toContain('PairingDoneHandler extends () => unknown = ChannelsPageAsyncVoidHandler,')
    expect(targetModalsContractSource).toContain('showPairingModal: boolean')
    expect(targetModalsContractSource).toContain('extends ChannelsPagePairingModalVisibilityState<PairingDoneHandler> {')
    expect(targetModalsContractSource).toContain('selectedPairingChannel: ChannelsPageNullableChannel<Channel>')
    expect(targetModalsContractSource).toContain('selectedPairingTarget: ChannelsPageTargetModalSelectionRef')
    expect(targetModalsContractSource).toContain('handlePairingClose: ChannelsPageVoidHandler')
    expect(targetModalsContractSource).toContain('handlePairingDone: PairingDoneHandler')
    expect(targetModalsContractSource).toContain('showDiagnosticsModal: boolean')
    expect(targetModalsContractSource).toContain('extends ChannelsPageDiagnosticsModalVisibilityState {')
    expect(targetModalsContractSource).toContain('selectedDiagnosticsChannel: ChannelsPageNullableChannel<Channel>')
    expect(targetModalsContractSource).toContain('selectedDiagnosticsTarget: ChannelsPageTargetModalSelectionRef')
    expect(targetModalsContractSource).toContain('handleDiagnosticsClose: ChannelsPageVoidHandler')
    expect(targetModalsContractSource).toContain(
      'syncSelectedTargetChannelSnapshots: ChannelsPageChannelSnapshotsSyncHandler<Channel>'
    )
    expect(targetModalsContractSource).toContain('extends ChannelsPageTargetModalOpenHandlers<Channel>,')
    expect(targetModalsContractSource).toContain('ChannelsPagePairingModalState<Channel>,')
    expect(targetModalsContractSource).toContain('ChannelsPageDiagnosticsModalState<Channel> {')
    expect(targetModalsContractSource).toContain('handleOpenPairing: ChannelsPageTargetModalOpenHandler<Channel>')
    expect(targetModalsContractSource).toContain('handleOpenDiagnostics: ChannelsPageTargetModalOpenHandler<Channel>')
  })
})
