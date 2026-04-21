import { describe, expect, it } from 'vitest'

import configFlowContractSource from '../channels-page-config-flow-contract.ts?raw'

describe('channels-page-config-flow-contract module', () => {
  it('keeps the config-flow input and output contract behind one dedicated module', () => {
    expect(configFlowContractSource).toContain("import type { Dispatch, SetStateAction } from 'react'")
    expect(configFlowContractSource).toContain("import type {")
    expect(configFlowContractSource).toContain('ChannelsPageAsyncVoidHandler,')
    expect(configFlowContractSource).toContain('ChannelsPageFetchChannelsBinding,')
    expect(configFlowContractSource).toContain('ChannelsPageNullableStringSetter,')
    expect(configFlowContractSource).toContain('ChannelsPageVoidHandler,')
    expect(configFlowContractSource).toContain("} from './channels-page-data-contract'")
    expect(configFlowContractSource).toContain("import type { ChannelPairingTarget, ChannelsConfigStep } from './channels-page-utils'")
    expect(configFlowContractSource).toContain(
      'export interface ChannelsPageConfigFlowOptions extends ChannelsPageFetchChannelsBinding<unknown> {}'
    )
    expect(configFlowContractSource).toContain('export interface ChannelsPageConfigFlowModalState {')
    expect(configFlowContractSource).toContain('export type ChannelsPageOpenAddChannelHandler = ChannelsPageVoidHandler')
    expect(configFlowContractSource).toContain('export interface ChannelsPageConfigFlowResult extends ChannelsPageConfigFlowModalState {')
  })

  it('keeps modal state, selection setters, and config-flow handlers in the shared contract module', () => {
    expect(configFlowContractSource).toContain('showConfigModal: boolean')
    expect(configFlowContractSource).toContain('selectedChannelId: string | null')
    expect(configFlowContractSource).toContain('selectedConfigTarget: ChannelPairingTarget | null')
    expect(configFlowContractSource).toContain('configStep: ChannelsConfigStep')
    expect(configFlowContractSource).toContain('setSelectedChannelId: ChannelsPageNullableStringSetter')
    expect(configFlowContractSource).toContain('setSelectedConfigTarget: Dispatch<SetStateAction<ChannelPairingTarget | null>>')
    expect(configFlowContractSource).toContain('setConfigStep: Dispatch<SetStateAction<ChannelsConfigStep>>')
    expect(configFlowContractSource).toContain('handleOpenAddChannel: ChannelsPageOpenAddChannelHandler')
    expect(configFlowContractSource).toContain('handleChannelConfigBack: ChannelsPageVoidHandler')
    expect(configFlowContractSource).toContain('handleConfigDone: ChannelsPageAsyncVoidHandler')
  })
})
