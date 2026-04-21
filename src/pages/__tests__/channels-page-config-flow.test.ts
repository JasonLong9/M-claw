import { describe, expect, it } from 'vitest'

import configFlowSource from '../channels-page-config-flow.ts?raw'

describe('channels-page-config-flow hook', () => {
  it('keeps the shared config-flow controller contract for modal state and config selection state', () => {
    expect(configFlowSource).toContain("import { useState } from 'react'")
    expect(configFlowSource).toContain('ChannelsPageConfigFlowOptions,')
    expect(configFlowSource).toContain('ChannelsPageConfigFlowResult,')
    expect(configFlowSource).toContain("} from './channels-page-config-flow-contract'")
    expect(configFlowSource).toContain("import type { ChannelPairingTarget, ChannelsConfigStep } from './channels-page-utils'")
    expect(configFlowSource).toContain('export function useChannelsPageConfigFlow({')
    expect(configFlowSource).toContain('}: ChannelsPageConfigFlowOptions): ChannelsPageConfigFlowResult {')
    expect(configFlowSource).toContain('const [showConfigModal, setShowConfigModal] = useState(false)')
    expect(configFlowSource).toContain('const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)')
    expect(configFlowSource).toContain("const [selectedConfigTarget, setSelectedConfigTarget] = useState<ChannelPairingTarget | null>(null)")
    expect(configFlowSource).toContain("const [configStep, setConfigStep] = useState<ChannelsConfigStep>('channel-connect')")
    expect(configFlowSource).toContain('const resetConfigFlow = () => {')
    expect(configFlowSource).not.toContain('interface UseChannelsPageConfigFlowOptions {')
  })

  it('keeps add-channel open, back, and complete flows inside one shared hook', () => {
    expect(configFlowSource).toContain('const handleOpenAddChannel = () => {')
    expect(configFlowSource).toContain('setSelectedChannelId(null)')
    expect(configFlowSource).toContain('setSelectedConfigTarget(null)')
    expect(configFlowSource).toContain("setConfigStep('channel-connect')")
    expect(configFlowSource).toContain('setShowConfigModal(true)')
    expect(configFlowSource).toContain('const handleChannelConfigBack = () => {')
    expect(configFlowSource).toContain('const handleConfigDone = async () => {')
    expect(configFlowSource).toContain("await fetchChannels({ background: true })")
    expect(configFlowSource).toContain('handleOpenAddChannel,')
    expect(configFlowSource).toContain('handleChannelConfigBack,')
    expect(configFlowSource).toContain('handleConfigDone,')
  })
})
