import { describe, expect, it } from 'vitest'

import feishuTargetStateContractSource from '../channels-page-feishu-target-state-contract.ts?raw'

describe('channels-page-feishu-target-state-contract module', () => {
  it('keeps the feishu target-state hook contracts behind one dedicated module', () => {
    expect(feishuTargetStateContractSource).toContain("import type { ChannelsPageChannelsBinding } from './channels-page-data-contract'")
    expect(feishuTargetStateContractSource).toContain('ChannelsPageFeishuTargetRefreshControls,')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageFeishuTargetRefreshChannelsBinding,')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageFeishuTargetSelectionBinding,')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageTargetRefInput,')
    expect(feishuTargetStateContractSource).toContain("} from './channels-page-feishu-target-refresh-contract'")
    expect(feishuTargetStateContractSource).toContain('ChannelsPageStateHelperFallbackChannelBinding,')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageStateHelperRepairingPluginChannelBinding,')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageStateHelperTargetStateOptions,')
    expect(feishuTargetStateContractSource).toContain("} from './channels-page-state-helpers-contract'")
    expect(feishuTargetStateContractSource).toContain('export type ChannelsPageFeishuTargetStateOptions<Channel> = ChannelsPageStateHelperTargetStateOptions<Channel>')
    expect(feishuTargetStateContractSource).toContain('export interface ChannelsPageFeishuTargetStateRefreshOptions')
    expect(feishuTargetStateContractSource).toContain('export interface ChannelsPageFeishuTargetSurfaceOptions<Channel>')
    expect(feishuTargetStateContractSource).toContain('export type ChannelsPageTargetStateDeriver<Channel, State> = (')
    expect(feishuTargetStateContractSource).toContain('export interface ChannelsPageTargetStateChannelsBinding<Channel>')
    expect(feishuTargetStateContractSource).toContain('export interface ChannelsPageTargetStateDeriverBinding<Channel, State> {')
    expect(feishuTargetStateContractSource).toContain('export interface ChannelsPageTargetStateAccessBinding<Channel, State>')
    expect(feishuTargetStateContractSource).toContain('export interface ChannelsPageFeishuTargetStateHookOptions<Channel, State extends object>')
    expect(feishuTargetStateContractSource).toContain('export type ChannelsPageFeishuTargetStateResult<State extends object> = State &')
    expect(feishuTargetStateContractSource).toContain('target: ChannelsPageTargetRefInput')
  })

  it('keeps derive-state input wiring plus refresh-state result fields inside the shared contract module', () => {
    expect(feishuTargetStateContractSource).toContain('export type ChannelsPageFeishuTargetStateOptions<Channel> = ChannelsPageStateHelperTargetStateOptions<Channel>')
    expect(feishuTargetStateContractSource).toContain(
      'extends ChannelsPageFeishuTargetRefreshChannelsBinding,'
    )
    expect(feishuTargetStateContractSource).toContain(
      'ChannelsPageStateHelperRepairingPluginChannelBinding {}'
    )
    expect(feishuTargetStateContractSource).not.toContain(
      'refreshChannels: ChannelsPageFeishuTargetRefreshChannels'
    )
    expect(feishuTargetStateContractSource).not.toContain('repairingPluginChannelId?: string | null')
    expect(feishuTargetStateContractSource).toContain('extends ChannelsPageFeishuTargetStateRefreshOptions,')
    expect(feishuTargetStateContractSource).toContain(
      'extends ChannelsPageStateHelperFallbackChannelBinding<Channel>,'
    )
    expect(feishuTargetStateContractSource).toContain(
      'ChannelsPageFeishuTargetSelectionBinding {}'
    )
    expect(feishuTargetStateContractSource).not.toContain('fallbackChannel?: Channel | null')
    expect(feishuTargetStateContractSource).toContain('export interface ChannelsPageFeishuTargetSurfaceOptions<Channel>')
    expect(feishuTargetStateContractSource).toContain('channels: Channel[]')
    expect(feishuTargetStateContractSource).toContain('deriveTargetState: ChannelsPageTargetStateDeriver<Channel, State>')
    expect(feishuTargetStateContractSource).toContain('extends ChannelsPageChannelsBinding<Channel> {}')
    expect(feishuTargetStateContractSource).toContain('extends ChannelsPageFeishuTargetStateRefreshOptions,')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageTargetStateChannelsBinding<Channel>,')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageTargetStateDeriverBinding<Channel, State> {}')
    expect(feishuTargetStateContractSource).toContain('extends ChannelsPageTargetStateAccessBinding<Channel, State>,')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageTargetStateChannelsBinding<Channel>,')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageTargetStateDeriverBinding<Channel, State> {')
    expect(feishuTargetStateContractSource).toContain('target: ChannelsPageTargetRefInput,')
    expect(feishuTargetStateContractSource).toContain('options: ChannelsPageFeishuTargetStateOptions<Channel>')
    expect(feishuTargetStateContractSource).toContain('ChannelsPageFeishuTargetRefreshControls')
  })
})
