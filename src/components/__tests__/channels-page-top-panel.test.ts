import { describe, expect, it } from 'vitest'

import topPanelSource from '../ChannelsPageTopPanel.tsx?raw'

describe('ChannelsPageTopPanel', () => {
  it('keeps the shared top-panel contract for title, actions, error state, and legacy ids', () => {
    expect(topPanelSource).toContain('title: string')
    expect(topPanelSource).toContain('description: string')
    expect(topPanelSource).toContain('refreshLabel: string')
    expect(topPanelSource).toContain('addChannelLabel: string')
    expect(topPanelSource).toContain('refreshing?: boolean')
    expect(topPanelSource).toContain('errorMessage?: string')
    expect(topPanelSource).toContain('legacyFeishuAgentIds?: string[]')
    expect(topPanelSource).toContain('onRefresh: () => void')
    expect(topPanelSource).toContain('onAddChannel: () => void')
    expect(topPanelSource).toContain('onDismissError: () => void')
  })

  it('renders one shared top panel with actions plus optional error and legacy alerts', () => {
    expect(topPanelSource).toContain('<Group justify="space-between">')
    expect(topPanelSource).toContain('<Text size="xl" fw={700}>{title}</Text>')
    expect(topPanelSource).toContain('{description}')
    expect(topPanelSource).toContain('onClick={onRefresh}')
    expect(topPanelSource).toContain('loading={refreshing}')
    expect(topPanelSource).toContain('{refreshLabel}')
    expect(topPanelSource).toContain('onClick={onAddChannel}')
    expect(topPanelSource).toContain('{addChannelLabel}')
    expect(topPanelSource).toContain('{errorMessage && (')
    expect(topPanelSource).toContain('title="Error"')
    expect(topPanelSource).toContain('onClose={onDismissError}')
    expect(topPanelSource).toContain('{legacyFeishuAgentIds.length > 0 && (')
    expect(topPanelSource).toContain('title="Legacy Feishu agents"')
    expect(topPanelSource).toContain("legacyFeishuAgentIds.join(', ')")
  })
})
