import { describe, expect, it } from 'vitest'

import feishuPluginRepairSource from '../channels-page-feishu-plugin-repair.ts?raw'

describe('channels-page-feishu-plugin-repair hook', () => {
  it('keeps the shared repair controller contract for repair state and managed plugin repair flow wiring', () => {
    expect(feishuPluginRepairSource).toContain("import { useState } from 'react'")
    expect(feishuPluginRepairSource).toContain("import type { FeishuDiagnosticsRepairOutcome } from '../components/FeishuDiagnosticsModal'")
    expect(feishuPluginRepairSource).toContain('ChannelsPageFeishuPluginRepairChannel,')
    expect(feishuPluginRepairSource).toContain('ChannelsPageFeishuPluginRepairOptions,')
    expect(feishuPluginRepairSource).toContain('ChannelsPageFeishuPluginRepairRequestOptions,')
    expect(feishuPluginRepairSource).toContain('ChannelsPageFeishuPluginRepairResult,')
    expect(feishuPluginRepairSource).toContain("} from './channels-page-feishu-plugin-repair-contract'")
    expect(feishuPluginRepairSource).toContain("import { runManagedChannelRepairFlow } from '../shared/managed-channel-repair'")
    expect(feishuPluginRepairSource).toContain('export function useChannelsPageFeishuPluginRepair<Channel extends ChannelsPageFeishuPluginRepairChannel>({')
    expect(feishuPluginRepairSource).toContain('}: ChannelsPageFeishuPluginRepairOptions<Channel>): ChannelsPageFeishuPluginRepairResult<Channel> {')
    expect(feishuPluginRepairSource).toContain('const [repairingPluginChannelId, setRepairingPluginChannelId] = useState<string | null>(null)')
    expect(feishuPluginRepairSource).toContain('const repairFeishuPlugin = async (')
    expect(feishuPluginRepairSource).toContain('const handleRepairFeishuPlugin = async (channel: Channel) => {')
    expect(feishuPluginRepairSource).not.toContain('interface UseChannelsPageFeishuPluginRepairOptions<Channel extends ChannelsPageFeishuPluginRepairChannel> {')
  })

  it('keeps the guarded repair flow, refresh reconciliation, and page-error handoff inside one shared hook', () => {
    expect(feishuPluginRepairSource).toContain('if (!shouldShowRepairAction(channel)) {')
    expect(feishuPluginRepairSource).toContain("message: channel.pluginStatus?.summary || 'The current Feishu plugin state does not require repair.'")
    expect(feishuPluginRepairSource).toContain('options?: ChannelsPageFeishuPluginRepairRequestOptions')
    expect(feishuPluginRepairSource).toContain("const surface = options?.surface || 'page'")
    expect(feishuPluginRepairSource).toContain("onPageError('')")
    expect(feishuPluginRepairSource).toContain('const outcome = await runManagedChannelRepairFlow({')
    expect(feishuPluginRepairSource).toContain("await fetchChannels({ background: true })")
    expect(feishuPluginRepairSource).toContain('const refreshedChannel = resolveLatestChannelSnapshot(refreshedChannels, channel)')
    expect(feishuPluginRepairSource).toContain('const refreshedStatusAlert = refreshedChannel ? getSharedStatusAlert(refreshedChannel) : null')
    expect(feishuPluginRepairSource).toContain('message: `Repair completed, but Feishu runtime still reports: ${refreshedStatusAlert.message}`')
    expect(feishuPluginRepairSource).toContain("message: refreshedChannel?.pluginStatus?.summary || outcome.summary || 'Feishu plugin repair completed.'")
    expect(feishuPluginRepairSource).toContain("const message = `Failed to repair the Feishu plugin: ${(error as Error).message}`")
    expect(feishuPluginRepairSource).toContain('setRepairingPluginChannelId(null)')
  })
})
