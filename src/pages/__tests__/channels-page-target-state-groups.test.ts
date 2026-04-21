import { describe, expect, it } from 'vitest'

import targetStateGroupsSource from '../channels-page-target-state-groups.ts?raw'

describe('channels-page-target-state-groups hook', () => {
  it('keeps the repeated feishu target-state surface contract inside one shared composition hook', () => {
    expect(targetStateGroupsSource).toContain("import {")
    expect(targetStateGroupsSource).toContain("useChannelsPageFeishuTargetState,")
    expect(targetStateGroupsSource).toContain("} from './channels-page-feishu-target-state'")
    expect(targetStateGroupsSource).toContain('ChannelsPageTargetStateGroupsOptions,')
    expect(targetStateGroupsSource).toContain('ChannelsPageTargetStateGroupsResult,')
    expect(targetStateGroupsSource).toContain("} from './channels-page-target-state-groups-contract'")
    expect(targetStateGroupsSource).toContain('export function useChannelsPageTargetStateGroups<Channel, State extends object>({')
    expect(targetStateGroupsSource).toContain('}: ChannelsPageTargetStateGroupsOptions<Channel, State>): ChannelsPageTargetStateGroupsResult<State> {')
    expect(targetStateGroupsSource).not.toContain('interface ChannelsPageTargetStateSurfaceOptions<Channel> {')
    expect(targetStateGroupsSource).not.toContain('interface UseChannelsPageTargetStateGroupsOptions<Channel, State extends object> {')
  })

  it('reuses the shared feishu target-state hook three times and returns grouped surface state objects', () => {
    expect(targetStateGroupsSource).toContain('const configTargetState = useChannelsPageFeishuTargetState({')
    expect(targetStateGroupsSource).toContain('active: config.active,')
    expect(targetStateGroupsSource).toContain('target: config.target,')
    expect(targetStateGroupsSource).toContain('const pairingTargetState = useChannelsPageFeishuTargetState({')
    expect(targetStateGroupsSource).toContain('active: pairing.active,')
    expect(targetStateGroupsSource).toContain('fallbackChannel: pairing.fallbackChannel,')
    expect(targetStateGroupsSource).toContain('const diagnosticsTargetState = useChannelsPageFeishuTargetState({')
    expect(targetStateGroupsSource).toContain('active: diagnostics.active,')
    expect(targetStateGroupsSource).toContain('fallbackChannel: diagnostics.fallbackChannel,')
    expect(targetStateGroupsSource).toContain('refreshChannels,')
    expect(targetStateGroupsSource).toContain('deriveTargetState,')
    expect(targetStateGroupsSource).toContain('configTargetState,')
    expect(targetStateGroupsSource).toContain('pairingTargetState,')
    expect(targetStateGroupsSource).toContain('diagnosticsTargetState,')
  })
})
