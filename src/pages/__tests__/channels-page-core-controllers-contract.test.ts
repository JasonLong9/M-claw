import { describe, expect, it } from 'vitest'

import coreControllersContractSource from '../channels-page-core-controllers-contract.ts?raw'

describe('channels-page-core-controllers-contract module', () => {
  it('keeps the core-controller input and output contract behind one dedicated module', () => {
    expect(coreControllersContractSource).toContain("ChannelsPageChannelInfo as ChannelInfo,")
    expect(coreControllersContractSource).toContain("ChannelsPageDataResult,")
    expect(coreControllersContractSource).toContain("} from './channels-page-data-contract'")
    expect(coreControllersContractSource).toContain("import type { ChannelsPageModelConfigResult } from './channels-page-model-config-contract'")
    expect(coreControllersContractSource).toContain(
      "import type { ChannelsPageLatestChannelSnapshotResolverBinding } from './channels-page-state-helpers-contract'"
    )
    expect(coreControllersContractSource).toContain("import type { ChannelsPageTargetModalsResult } from './channels-page-target-modals-contract'")
    expect(coreControllersContractSource).toContain('export interface ChannelsPageCoreControllersOptions')
    expect(coreControllersContractSource).toContain(
      'export type ChannelsPageRefreshChannelsInBackground<Channel> = () => Promise<Channel[]>'
    )
    expect(coreControllersContractSource).toContain(
      'export interface ChannelsPageRefreshChannelsInBackgroundBinding<Channel> {'
    )
    expect(coreControllersContractSource).toContain('export interface ChannelsPageCoreControllersResult')
    expect(coreControllersContractSource).toContain('extends ChannelsPageLatestChannelSnapshotResolverBinding<ChannelInfo> {}')
  })

  it('keeps data, target-modal, model-config, and background-refresh result fields in the shared core-controller contract', () => {
    expect(coreControllersContractSource).toContain(
      'extends ChannelsPageRefreshChannelsInBackgroundBinding<ChannelInfo> {'
    )
    expect(coreControllersContractSource).toContain('dataState: ChannelsPageDataResult')
    expect(coreControllersContractSource).toContain('targetModalState: ChannelsPageTargetModalsResult<ChannelInfo>')
    expect(coreControllersContractSource).toContain('modelConfigState: ChannelsPageModelConfigResult<ChannelInfo>')
    expect(coreControllersContractSource).toContain('refreshChannelsInBackground: ChannelsPageRefreshChannelsInBackground<Channel>')
    expect(coreControllersContractSource).not.toContain('refreshChannelsInBackground: () => Promise<ChannelInfo[]>')
  })
})
