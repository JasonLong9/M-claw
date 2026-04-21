import { describe, expect, it } from 'vitest'

import channelCardDetailsSource from '../ChannelCardDetails.tsx?raw'

describe('ChannelCardDetails', () => {
  it('keeps the shared channel-card details contract for platform, badges, summary, and managed state', () => {
    expect(channelCardDetailsSource).toContain("import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'")
    expect(channelCardDetailsSource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(channelCardDetailsSource).toContain('platformInfo: {')
    expect(channelCardDetailsSource).toContain('badges: Array<{')
    expect(channelCardDetailsSource).toContain('summary: string')
    expect(channelCardDetailsSource).toContain('showFeishuCardMeta?: boolean')
    expect(channelCardDetailsSource).toContain('feishuProvisionDescription?: string | null')
    expect(channelCardDetailsSource).toContain('feishuSharedStatusAlert?: FeishuSharedStatusAlertState | null')
    expect(channelCardDetailsSource).toContain('showPluginStatus?: boolean')
  })

  it('renders one shared card-details block with the feishu meta and managed-plugin status subcomponents', () => {
    expect(channelCardDetailsSource).toContain('<Text size="lg" fw={600}>{channel.name}</Text>')
    expect(channelCardDetailsSource).toContain('{badges.map((badge) => (')
    expect(channelCardDetailsSource).toContain('{summary}')
    expect(channelCardDetailsSource).toContain('<FeishuChannelCardMeta')
    expect(channelCardDetailsSource).toContain('provisionDescription={feishuProvisionDescription}')
    expect(channelCardDetailsSource).toContain('sharedStatusAlert={feishuSharedStatusAlert}')
    expect(channelCardDetailsSource).toContain('<ManagedChannelPluginStatusSummary')
    expect(channelCardDetailsSource).toContain('channelKey={channel.id}')
    expect(channelCardDetailsSource).toContain('pluginStatus={channel.pluginStatus}')
  })
})
