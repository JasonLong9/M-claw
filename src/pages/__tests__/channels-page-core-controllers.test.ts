import { describe, expect, it } from 'vitest'

import coreControllersSource from '../channels-page-core-controllers.ts?raw'

describe('channels-page-core-controllers hook', () => {
  it('keeps the shared data, target-modal, and model-config controller contract behind one hook', () => {
    expect(coreControllersSource).toContain("import {")
    expect(coreControllersSource).toContain("useChannelsPageData,")
    expect(coreControllersSource).toContain("} from './channels-page-data'")
    expect(coreControllersSource).toContain("import type { ChannelsPageChannelInfo as ChannelInfo } from './channels-page-data-contract'")
    expect(coreControllersSource).toContain('ChannelsPageCoreControllersOptions,')
    expect(coreControllersSource).toContain('ChannelsPageCoreControllersResult,')
    expect(coreControllersSource).toContain("} from './channels-page-core-controllers-contract'")
    expect(coreControllersSource).toContain("import { useChannelsPageModelConfig } from './channels-page-model-config'")
    expect(coreControllersSource).toContain("import { useChannelsPageTargetModals } from './channels-page-target-modals'")
    expect(coreControllersSource).toContain('export function useChannelsPageCoreControllers({')
    expect(coreControllersSource).toContain('}: ChannelsPageCoreControllersOptions): ChannelsPageCoreControllersResult {')
    expect(coreControllersSource).toContain('resolveLatestChannelSnapshot,')
    expect(coreControllersSource).not.toContain('interface UseChannelsPageCoreControllersOptions {')
  })

  it('keeps snapshot-sync glue and background refresh wiring inside the shared core-controller hook', () => {
    expect(coreControllersSource).toContain('const syncSelectedChannelSnapshots = (nextChannels: ChannelInfo[]) => {')
    expect(coreControllersSource).toContain('targetModalState.syncSelectedTargetChannelSnapshots(nextChannels)')
    expect(coreControllersSource).toContain('modelConfigState.syncSelectedModelChannelSnapshot(nextChannels)')
    expect(coreControllersSource).toContain('const dataState = useChannelsPageData({')
    expect(coreControllersSource).toContain('syncSelectedChannelSnapshots,')
    expect(coreControllersSource).toContain('const targetModalState = useChannelsPageTargetModals<ChannelInfo>({')
    expect(coreControllersSource).toContain('fetchChannels: dataState.fetchChannels,')
    expect(coreControllersSource).toContain('const modelConfigState = useChannelsPageModelConfig<ChannelInfo>({')
    expect(coreControllersSource).toContain('const refreshChannelsInBackground = () => dataState.fetchChannels({ background: true })')
    expect(coreControllersSource).toContain('dataState,')
    expect(coreControllersSource).toContain('targetModalState,')
    expect(coreControllersSource).toContain('modelConfigState,')
    expect(coreControllersSource).toContain('refreshChannelsInBackground,')
  })
})
