import { describe, expect, it } from 'vitest'

import targetStateGroupsContractSource from '../channels-page-target-state-groups-contract.ts?raw'

describe('channels-page-target-state-groups-contract module', () => {
  it('keeps the grouped target-state surface input contract behind one dedicated module', () => {
    expect(targetStateGroupsContractSource).toContain('ChannelsPageFeishuTargetSurfaceOptions,')
    expect(targetStateGroupsContractSource).toContain('ChannelsPageFeishuTargetStateResult,')
    expect(targetStateGroupsContractSource).toContain('ChannelsPageTargetStateAccessBinding,')
    expect(targetStateGroupsContractSource).toContain("} from './channels-page-feishu-target-state-contract'")
    expect(targetStateGroupsContractSource).toContain(
      'export interface ChannelsPageGroupedTargetStatesBinding<'
    )
    expect(targetStateGroupsContractSource).toContain('export interface ChannelsPageTargetStateGroupsOptions<Channel, State extends object>')
    expect(targetStateGroupsContractSource).toContain('export interface ChannelsPageTargetStateGroupsResult<State extends object>')
    expect(targetStateGroupsContractSource).not.toContain('export interface ChannelsPageTargetStateSurfaceOptions<Channel> {')
  })

  it('keeps the shared deriveTargetState plus config/pairing/diagnostics surface groups inside the contract module', () => {
    expect(targetStateGroupsContractSource).toContain('extends ChannelsPageTargetStateAccessBinding<Channel, State> {')
    expect(targetStateGroupsContractSource).not.toContain('deriveTargetState: ChannelsPageTargetStateDeriver<Channel, State>')
    expect(targetStateGroupsContractSource).not.toContain('channels: Channel[]')
    expect(targetStateGroupsContractSource).not.toContain('extends ChannelsPageFeishuTargetStateRefreshOptions,')
    expect(targetStateGroupsContractSource).not.toContain('ChannelsPageTargetStateChannelsBinding<Channel>,')
    expect(targetStateGroupsContractSource).not.toContain('ChannelsPageTargetStateDeriverBinding<Channel, State> {')
    expect(targetStateGroupsContractSource).toContain('config: ChannelsPageFeishuTargetSurfaceOptions<Channel>')
    expect(targetStateGroupsContractSource).toContain('pairing: ChannelsPageFeishuTargetSurfaceOptions<Channel>')
    expect(targetStateGroupsContractSource).toContain('diagnostics: ChannelsPageFeishuTargetSurfaceOptions<Channel>')
    expect(targetStateGroupsContractSource).toContain(
      'extends ChannelsPageGroupedTargetStatesBinding<ChannelsPageFeishuTargetStateResult<State>> {}'
    )
    expect(targetStateGroupsContractSource).toContain('configTargetState: ConfigTargetState')
    expect(targetStateGroupsContractSource).toContain('pairingTargetState: PairingTargetState')
    expect(targetStateGroupsContractSource).toContain('diagnosticsTargetState: DiagnosticsTargetState')
  })
})
