import { describe, expect, it } from 'vitest'

import channelCardsSource from '../ChannelsPageChannelCards.tsx?raw'

describe('ChannelsPageChannelCards', () => {
  it('keeps the shared channel-cards contract for row derivation helpers, row state, and callbacks', () => {
    expect(channelCardsSource).toContain("import ChannelsPageChannelCard, {")
    expect(channelCardsSource).toContain('channels: Array<')
    expect(channelCardsSource).toContain('togglingChannelId?: string | null')
    expect(channelCardsSource).toContain('repairingPluginChannelId?: string | null')
    expect(channelCardsSource).toContain('getPlatformInfo: (channelId: string, platform: string) => ChannelsPageChannelCardPlatformInfo')
    expect(channelCardsSource).toContain('getStatusBadges: (channel: ChannelsPageChannelCardChannel) => ChannelsPageChannelCardBadge[]')
    expect(channelCardsSource).toContain('getSummary: (channel: ChannelsPageChannelCardChannel, platformName: string) => string')
    expect(channelCardsSource).toContain('getFeishuSharedStatusAlert: (channel: ChannelsPageChannelCardChannel) => FeishuSharedStatusAlertState | null')
    expect(channelCardsSource).toContain('shouldShowPluginStatus: (channel: ChannelsPageChannelCardChannel) => boolean')
    expect(channelCardsSource).toContain('shouldShowRepairAction: (channel: ChannelsPageChannelCardChannel) => boolean')
    expect(channelCardsSource).toContain('onOpenModelConfig: (channel: ChannelsPageChannelCardChannel) => void')
    expect(channelCardsSource).toContain('onToggleEnabled: (channel: ChannelsPageChannelCardChannel) => void')
    expect(channelCardsSource).toContain('onOpenPairing: (channel: ChannelsPageChannelCardChannel) => void')
    expect(channelCardsSource).toContain('onOpenDiagnostics: (channel: ChannelsPageChannelCardChannel) => void')
    expect(channelCardsSource).toContain('onRepairPlugin: (channel: ChannelsPageChannelCardChannel) => void')
    expect(channelCardsSource).toContain('onRemove: (channel: ChannelsPageChannelCardChannel) => void')
  })

  it('renders one shared channel-cards mapper that derives row state and wires each row into the shared card shell', () => {
    expect(channelCardsSource).toContain('{channels.map((channel) => {')
    expect(channelCardsSource).toContain('const platformInfo = getPlatformInfo(channel.id, channel.platform)')
    expect(channelCardsSource).toContain('const isToggling = togglingChannelId === channel.id')
    expect(channelCardsSource).toContain('const togglingAnyChannel = Boolean(togglingChannelId)')
    expect(channelCardsSource).toContain('const togglingAnotherChannel = Boolean(togglingChannelId && togglingChannelId !== channel.id)')
    expect(channelCardsSource).toContain('const feishuStatusAlert = getFeishuSharedStatusAlert(channel)')
    expect(channelCardsSource).toContain('const channelStatusBadges = getStatusBadges(channel)')
    expect(channelCardsSource).toContain('const channelCardSummary = getSummary(channel, platformInfo.name)')
    expect(channelCardsSource).toContain('<ChannelsPageChannelCard')
    expect(channelCardsSource).toContain('showFeishuCardMeta={channel.channelId === \'feishu\'}')
    expect(channelCardsSource).toContain('showPluginStatus={shouldShowPluginStatus(channel)}')
    expect(channelCardsSource).toContain('showRepairAction={shouldShowRepairAction(channel)}')
    expect(channelCardsSource).toContain('repairingRepairAction={repairingPluginChannelId === channel.channelId}')
    expect(channelCardsSource).toContain('channel.channelId === \'feishu\' && channel.agentId')
    expect(channelCardsSource).toContain('onToggleEnabled={() => onToggleEnabled(channel)}')
    expect(channelCardsSource).toContain('onRemove={() => onRemove(channel)}')
  })
})
