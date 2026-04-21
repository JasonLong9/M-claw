import { describe, expect, it } from 'vitest'

import pluginStatusSummarySource from '../ManagedChannelPluginStatusSummary.tsx?raw'

describe('ManagedChannelPluginStatusSummary', () => {
  it('keeps the shared managed-plugin status contract for the channel key and plugin status payload', () => {
    expect(pluginStatusSummarySource).toContain("import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'")
    expect(pluginStatusSummarySource).toContain('channelKey: string')
    expect(pluginStatusSummarySource).toContain('pluginStatus: ManagedChannelPluginStatusView')
  })

  it('renders one shared summary block for the plugin status text and stage badges', () => {
    expect(pluginStatusSummarySource).toContain('插件状态：{pluginStatus.summary}')
    expect(pluginStatusSummarySource).toContain('pluginStatus.stages.map((stage) => (')
    expect(pluginStatusSummarySource).toContain('key={`${channelKey}:${stage.id}`}')
    expect(pluginStatusSummarySource).toContain('getOfficialChannelStageColor(stage.state)')
    expect(pluginStatusSummarySource).toContain('getOfficialChannelStageLabel(stage.id)')
    expect(pluginStatusSummarySource).toContain('getOfficialChannelStageStateLabel(stage.state)')
  })
})
