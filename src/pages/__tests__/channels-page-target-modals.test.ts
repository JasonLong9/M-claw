import { describe, expect, it } from 'vitest'

import targetModalsSource from '../channels-page-target-modals.ts?raw'

describe('channels-page-target-modals hook', () => {
  it('keeps the shared target-modal controller contract for pairing and diagnostics modal state', () => {
    expect(targetModalsSource).toContain("import { useState } from 'react'")
    expect(targetModalsSource).toContain('ChannelsPageTargetModalChannel,')
    expect(targetModalsSource).toContain('ChannelsPageTargetModalsOptions,')
    expect(targetModalsSource).toContain('ChannelsPageTargetModalsResult,')
    expect(targetModalsSource).toContain("} from './channels-page-target-modals-contract'")
    expect(targetModalsSource).toContain("import type { ChannelPairingTargetRef } from './channels-page-utils'")
    expect(targetModalsSource).toContain('export function useChannelsPageTargetModals<Channel extends ChannelsPageTargetModalChannel>({')
    expect(targetModalsSource).toContain('}: ChannelsPageTargetModalsOptions<Channel>): ChannelsPageTargetModalsResult<Channel> {')
    expect(targetModalsSource).toContain('const [showPairingModal, setShowPairingModal] = useState(false)')
    expect(targetModalsSource).toContain('const [selectedPairingChannel, setSelectedPairingChannel] = useState<Channel | null>(null)')
    expect(targetModalsSource).toContain('useState<ChannelPairingTargetRef | null>(null)')
    expect(targetModalsSource).toContain("const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false)")
    expect(targetModalsSource).toContain('const [selectedDiagnosticsChannel, setSelectedDiagnosticsChannel] = useState<Channel | null>(null)')
    expect(targetModalsSource).toContain('const syncSelectedTargetChannelSnapshots = (nextChannels: Channel[]) => {')
    expect(targetModalsSource).not.toContain('interface UseChannelsPageTargetModalsOptions<Channel extends ChannelsPageTargetModalChannel> {')
  })

  it('reuses one hook for open/close/done flows across pairing and diagnostics surfaces', () => {
    expect(targetModalsSource).toContain('const handleOpenPairing = (channel: Channel) => {')
    expect(targetModalsSource).toContain('if (!channel.pairingRequired) return')
    expect(targetModalsSource).toContain('const handlePairingClose = () => {')
    expect(targetModalsSource).toContain('const handlePairingDone = async () => {')
    expect(targetModalsSource).toContain("await fetchChannels({ background: true })")
    expect(targetModalsSource).toContain("const handleOpenDiagnostics = (channel: Channel) => {")
    expect(targetModalsSource).toContain("if (channel.channelId !== 'feishu' || !channel.pairingAccountId) return")
    expect(targetModalsSource).toContain('const handleDiagnosticsClose = () => {')
    expect(targetModalsSource).toContain('handleOpenPairing,')
    expect(targetModalsSource).toContain('handlePairingDone,')
    expect(targetModalsSource).toContain('handleOpenDiagnostics,')
    expect(targetModalsSource).toContain('handleDiagnosticsClose,')
  })
})
