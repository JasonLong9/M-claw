import { describe, expect, it } from 'vitest'

import channelActionsSource from '../channels-page-channel-actions.ts?raw'

describe('channels-page-channel-actions hook', () => {
  it('keeps the shared channel-actions controller contract for toggle state and page-level mutation handlers', () => {
    expect(channelActionsSource).toContain("import { useState } from 'react'")
    expect(channelActionsSource).toContain("import { removeWeixinChannelAccountConfig } from '../lib/openclaw-channel-registry'")
    expect(channelActionsSource).toContain('ChannelsPageChannelActionChannel,')
    expect(channelActionsSource).toContain('ChannelsPageChannelActionsOptions,')
    expect(channelActionsSource).toContain('ChannelsPageChannelActionsResult,')
    expect(channelActionsSource).toContain("} from './channels-page-channel-actions-contract'")
    expect(channelActionsSource).toContain("import { removeFeishuBotConfigForPluginState, sanitizeFeishuPluginConfig } from './feishu-bots'")
    expect(channelActionsSource).toContain('export function useChannelsPageChannelActions<Channel extends ChannelsPageChannelActionChannel>({')
    expect(channelActionsSource).toContain('}: ChannelsPageChannelActionsOptions<Channel>): ChannelsPageChannelActionsResult<Channel> {')
    expect(channelActionsSource).toContain('const [togglingChannelId, setTogglingChannelId] = useState<string | null>(null)')
    expect(channelActionsSource).toContain('const handleRemoveChannel = async (channel: Channel) => {')
    expect(channelActionsSource).toContain('const handleToggleChannelEnabled = async (channel: Channel) => {')
    expect(channelActionsSource).not.toContain('interface UseChannelsPageChannelActionsOptions<Channel extends ChannelsPageChannelActionChannel> {')
  })

  it('keeps remove and enable-toggle config patch flows inside one shared hook', () => {
    expect(channelActionsSource).toContain('if (!confirm(`Remove channel ${channel.name}?`)) return')
    expect(channelActionsSource).toContain('const config = sanitizeFeishuPluginConfig(await window.api.readConfig())')
    expect(channelActionsSource).toContain('const feishuPluginState = await window.api.getFeishuOfficialPluginState()')
    expect(channelActionsSource).toContain('nextConfig = removeFeishuBotConfigForPluginState(')
    expect(channelActionsSource).toContain('const removeStateResult = await window.api.removeWeixinAccount(channel.pairingAccountId)')
    expect(channelActionsSource).toContain("reason: 'channels-remove-channel'")
    expect(channelActionsSource).toContain("onPageError('Failed to remove the channel: ' + (error as Error).message)")
    expect(channelActionsSource).toContain('if (togglingChannelId && togglingChannelId !== channel.id) {')
    expect(channelActionsSource).toContain("throw new Error('No channel config is available to update.')")
    expect(channelActionsSource).toContain("throw new Error('Feishu channel config was not found.')")
    expect(channelActionsSource).toContain('accountConfig.enabled = nextEnabled')
    expect(channelActionsSource).toContain('targetChannel.enabled = nextEnabled')
    expect(channelActionsSource).toContain("reason: 'unknown'")
    expect(channelActionsSource).toContain('await fetchChannels({ background: true })')
    expect(channelActionsSource).toContain("onPageError(`${channel.enabled ? 'Failed to disable channel:' : 'Failed to enable channel:'} ${(error as Error).message}`)")
    expect(channelActionsSource).toContain('setTogglingChannelId(null)')
  })
})