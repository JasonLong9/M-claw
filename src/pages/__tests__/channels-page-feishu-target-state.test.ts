import { describe, expect, it } from 'vitest'

import feishuTargetStateSource from '../channels-page-feishu-target-state.ts?raw'

describe('channels-page-feishu-target-state hook', () => {
  it('keeps the shared target-state hook contract for refresh coordination plus derived state wiring', () => {
    expect(feishuTargetStateSource).toContain('ChannelsPageFeishuTargetStateHookOptions,')
    expect(feishuTargetStateSource).toContain('ChannelsPageFeishuTargetStateResult,')
    expect(feishuTargetStateSource).toContain("} from './channels-page-feishu-target-state-contract'")
    expect(feishuTargetStateSource).toContain("import { useChannelsPageFeishuTargetRefresh } from './channels-page-feishu-target-refresh'")
    expect(feishuTargetStateSource).toContain('export function useChannelsPageFeishuTargetState<Channel, State extends object>({')
    expect(feishuTargetStateSource).toContain('}: ChannelsPageFeishuTargetStateHookOptions<Channel, State>): ChannelsPageFeishuTargetStateResult<State> {')
    expect(feishuTargetStateSource).not.toContain('interface UseChannelsPageFeishuTargetStateOptions<Channel, State extends object> {')
  })

  it('reuses the refresh hook and feeds its checked/refreshing state back into the shared derived target-state contract', () => {
    expect(feishuTargetStateSource).toContain('} = useChannelsPageFeishuTargetRefresh({')
    expect(feishuTargetStateSource).toContain('checkedTargetKey,')
    expect(feishuTargetStateSource).toContain('refreshTargetChannelStatus,')
    expect(feishuTargetStateSource).toContain('...deriveTargetState(channels, target, {')
    expect(feishuTargetStateSource).toContain('refreshing: refreshingTargetChannel,')
    expect(feishuTargetStateSource).toContain('checkedKey: checkedTargetKey,')
    expect(feishuTargetStateSource).toContain('repairingPluginChannelId,')
    expect(feishuTargetStateSource).toContain('refreshingTargetChannel,')
    expect(feishuTargetStateSource).toContain('refreshTargetChannelStatus,')
  })
})
