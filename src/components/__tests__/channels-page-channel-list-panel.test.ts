import { describe, expect, it } from 'vitest'

import channelListPanelSource from '../ChannelsPageChannelListPanel.tsx?raw'

describe('ChannelsPageChannelListPanel', () => {
  it('keeps the shared channel-list panel contract for empty-state messaging and rendered children', () => {
    expect(channelListPanelSource).toContain("import type { ReactNode } from 'react'")
    expect(channelListPanelSource).toContain('hasChannels: boolean')
    expect(channelListPanelSource).toContain('emptyMessage: string')
    expect(channelListPanelSource).toContain('children?: ReactNode')
  })

  it('renders one shared list panel that switches between the empty card and channel card children', () => {
    expect(channelListPanelSource).toContain('<ScrollArea h="calc(100vh - 200px)">')
    expect(channelListPanelSource).toContain('<div className="space-y-4">')
    expect(channelListPanelSource).toContain('{hasChannels ? children : (')
    expect(channelListPanelSource).toContain('<Card padding="xl" withBorder className="text-center">')
    expect(channelListPanelSource).toContain('<Text size="sm" c="dimmed">')
    expect(channelListPanelSource).toContain('{emptyMessage}')
  })
})
