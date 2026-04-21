import { describe, expect, it } from 'vitest'

import channelCardSource from '../ChannelsPageChannelCard.tsx?raw'

describe('ChannelsPageChannelCard', () => {
  it('keeps the shared channel-card shell contract for detail state, action state, and handlers', () => {
    expect(channelCardSource).toContain("import ChannelCardActionButtons from './ChannelCardActionButtons'")
    expect(channelCardSource).toContain("import ChannelCardDetails from './ChannelCardDetails'")
    expect(channelCardSource).toContain('togglingAnyChannel: boolean')
    expect(channelCardSource).toContain('togglingAnotherChannel: boolean')
    expect(channelCardSource).toContain('isToggling: boolean')
    expect(channelCardSource).toContain('showRepairAction: boolean')
    expect(channelCardSource).toContain('repairDisabled: boolean')
    expect(channelCardSource).toContain('repairingRepairAction: boolean')
    expect(channelCardSource).toContain('onOpenModelConfig?: (() => void) | null')
    expect(channelCardSource).toContain('onToggleEnabled: () => void')
    expect(channelCardSource).toContain('onOpenPairing: () => void')
    expect(channelCardSource).toContain('onOpenDiagnostics: () => void')
    expect(channelCardSource).toContain('onRepairPlugin: () => void')
    expect(channelCardSource).toContain('onRemove: () => void')
  })

  it('renders one shared channel-card shell that owns the card hover behavior and wires details plus actions', () => {
    expect(channelCardSource).toContain('<Card')
    expect(channelCardSource).toContain("channel.pairingRequired ? 'cursor-pointer' : ''")
    expect(channelCardSource).toContain("style={cardStyle}")
    expect(channelCardSource).toContain("event.currentTarget.style.backgroundColor = 'var(--app-bg-tertiary)'")
    expect(channelCardSource).toContain("event.currentTarget.style.backgroundColor = ''")
    expect(channelCardSource).toContain("onClick={channel.pairingRequired ? onOpenPairing : undefined}")
    expect(channelCardSource).toContain('<ChannelCardDetails')
    expect(channelCardSource).toContain('showFeishuCardMeta={showFeishuCardMeta}')
    expect(channelCardSource).toContain('feishuSharedStatusAlert={feishuSharedStatusAlert}')
    expect(channelCardSource).toContain('showPluginStatus={showPluginStatus}')
    expect(channelCardSource).toContain('<ChannelCardActionButtons')
    expect(channelCardSource).toContain('showRepairAction={showRepairAction}')
    expect(channelCardSource).toContain('repairDisabled={repairDisabled}')
    expect(channelCardSource).toContain('repairingRepairAction={repairingRepairAction}')
  })
})
