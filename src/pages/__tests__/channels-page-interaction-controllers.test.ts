import { describe, expect, it } from 'vitest'

import interactionControllersSource from '../channels-page-interaction-controllers.ts?raw'

describe('channels-page-interaction-controllers hook', () => {
  it('keeps the shared config-flow, channel-actions, and plugin-repair controller contract behind one hook', () => {
    expect(interactionControllersSource).toContain("import type { ChannelsPageChannelInfo as ChannelInfo } from './channels-page-data-contract'")
    expect(interactionControllersSource).toContain('ChannelsPageInteractionControllersOptions,')
    expect(interactionControllersSource).toContain('ChannelsPageInteractionControllersResult,')
    expect(interactionControllersSource).toContain("} from './channels-page-interaction-controllers-contract'")
    expect(interactionControllersSource).toContain("import { useChannelsPageChannelActions } from './channels-page-channel-actions'")
    expect(interactionControllersSource).toContain("import { useChannelsPageConfigFlow } from './channels-page-config-flow'")
    expect(interactionControllersSource).toContain("import { useChannelsPageFeishuPluginRepair } from './channels-page-feishu-plugin-repair'")
    expect(interactionControllersSource).toContain('export function useChannelsPageInteractionControllers({')
    expect(interactionControllersSource).toContain('}: ChannelsPageInteractionControllersOptions): ChannelsPageInteractionControllersResult {')
    expect(interactionControllersSource).not.toContain('interface UseChannelsPageInteractionControllersOptions {')
  })

  it('keeps the page-level interaction controller wiring inside one shared composition hook', () => {
    expect(interactionControllersSource).toContain('const channelActionState = useChannelsPageChannelActions<ChannelInfo>({')
    expect(interactionControllersSource).toContain('fetchChannels,')
    expect(interactionControllersSource).toContain('onPageError: setError,')
    expect(interactionControllersSource).toContain('const configFlowState = useChannelsPageConfigFlow({')
    expect(interactionControllersSource).toContain('const pluginRepairState = useChannelsPageFeishuPluginRepair<ChannelInfo>({')
    expect(interactionControllersSource).toContain('resolveLatestChannelSnapshot,')
    expect(interactionControllersSource).toContain('shouldShowRepairAction,')
    expect(interactionControllersSource).toContain('getSharedStatusAlert,')
    expect(interactionControllersSource).toContain('channelActionState,')
    expect(interactionControllersSource).toContain('configFlowState,')
    expect(interactionControllersSource).toContain('pluginRepairState,')
  })
})
