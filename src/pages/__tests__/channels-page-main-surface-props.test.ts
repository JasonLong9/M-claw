import { describe, expect, it } from 'vitest'

import mainSurfacePropsSource from '../channels-page-main-surface-props.ts?raw'

describe('channels-page-main-surface-props hook', () => {
  it('keeps the shared top-panel, list-panel, and channel-card surface prop contract in one hook', () => {
    expect(mainSurfacePropsSource).toContain("import type { ComponentProps } from 'react'")
    expect(mainSurfacePropsSource).toContain("import ChannelsPageChannelCards from '../components/ChannelsPageChannelCards'")
    expect(mainSurfacePropsSource).toContain("import ChannelsPageChannelListPanel from '../components/ChannelsPageChannelListPanel'")
    expect(mainSurfacePropsSource).toContain("import ChannelsPageTopPanel from '../components/ChannelsPageTopPanel'")
    expect(mainSurfacePropsSource).toContain("import { getChannelDefinition } from '../lib/openclaw-channel-registry'")
    expect(mainSurfacePropsSource).toContain('ChannelsPageMainSurfacePropsOptions,')
    expect(mainSurfacePropsSource).toContain('ChannelsPageMainSurfacePropsResult,')
    expect(mainSurfacePropsSource).toContain("} from './channels-page-main-surface-props-contract'")
    expect(mainSurfacePropsSource).toContain('export function useChannelsPageMainSurfaceProps({')
    expect(mainSurfacePropsSource).toContain('}: ChannelsPageMainSurfacePropsOptions): ChannelsPageMainSurfacePropsResult {')
    expect(mainSurfacePropsSource).toContain('const topPanelProps: ComponentProps<typeof ChannelsPageTopPanel> = {')
    expect(mainSurfacePropsSource).toContain('const channelListPanelProps: ComponentProps<typeof ChannelsPageChannelListPanel> = {')
    expect(mainSurfacePropsSource).toContain('const channelCardsProps: ComponentProps<typeof ChannelsPageChannelCards> = {')
    expect(mainSurfacePropsSource).toContain('topPanelProps,')
    expect(mainSurfacePropsSource).toContain('channelListPanelProps,')
    expect(mainSurfacePropsSource).toContain('channelCardsProps,')
    expect(mainSurfacePropsSource).not.toContain('interface UseChannelsPageMainSurfacePropsOptions {')
  })

  it('keeps the shared getPlatformInfo and card action wiring inside one hook', () => {
    expect(mainSurfacePropsSource).toContain('const getPlatformInfo = (channelId: string, platform: string) => {')
    expect(mainSurfacePropsSource).toContain("onRefresh: () => {\n      void handleRefreshChannels()\n    },")
    expect(mainSurfacePropsSource).toContain("onDismissError: () => setError(''),")
    expect(mainSurfacePropsSource).toContain('getStatusBadges: (channel) => deriveChannelStatusBadges(channel, {')
    expect(mainSurfacePropsSource).toContain('onOpenModelConfig: (channel) => void handleOpenModelConfig(channel),')
    expect(mainSurfacePropsSource).toContain('onToggleEnabled: (channel) => void handleToggleChannelEnabled(channel),')
    expect(mainSurfacePropsSource).toContain('onOpenPairing: (channel) => handleOpenPairing(channel),')
    expect(mainSurfacePropsSource).toContain('onOpenDiagnostics: (channel) => handleOpenDiagnostics(channel),')
    expect(mainSurfacePropsSource).toContain('onRepairPlugin: (channel) => void handleRepairFeishuPlugin(channel),')
    expect(mainSurfacePropsSource).toContain('onRemove: (channel) => void handleRemoveChannel(channel),')
  })
})
