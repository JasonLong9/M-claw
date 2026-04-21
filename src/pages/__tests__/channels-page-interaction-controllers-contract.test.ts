import { describe, expect, it } from 'vitest'

import interactionControllersContractSource from '../channels-page-interaction-controllers-contract.ts?raw'

describe('channels-page-interaction-controllers-contract module', () => {
  it('keeps the interaction-controller input and output contract behind one dedicated module', () => {
    expect(interactionControllersContractSource).toContain("import type { ChannelsPageChannelActionsResult } from './channels-page-channel-actions-contract'")
    expect(interactionControllersContractSource).toContain("import type {")
    expect(interactionControllersContractSource).toContain("ChannelsPageChannelInfo as ChannelInfo,")
    expect(interactionControllersContractSource).toContain('ChannelsPageSetPageErrorBinding,')
    expect(interactionControllersContractSource).toContain("} from './channels-page-data-contract'")
    expect(interactionControllersContractSource).toContain("import type { ChannelsPageConfigFlowResult } from './channels-page-config-flow-contract'")
    expect(interactionControllersContractSource).toContain("import type { ChannelsPageFeishuPluginRepairResult } from './channels-page-feishu-plugin-repair-contract'")
    expect(interactionControllersContractSource).toContain('ChannelsPageManagedStatusAccessBinding,')
    expect(interactionControllersContractSource).toContain('ChannelsPageManagedStatusChannel,')
    expect(interactionControllersContractSource).toContain("} from './channels-page-state-helpers-contract'")
    expect(interactionControllersContractSource).toContain('export interface ChannelsPageInteractionControllersOptions')
    expect(interactionControllersContractSource).toContain('export interface ChannelsPageInteractionControllersResult {')
    expect(interactionControllersContractSource).toContain('ChannelsPageManagedStatusChannel<ChannelInfo>')
  })

  it('reuses the shared managed-status helper interface in the interaction-controller contract', () => {
    expect(interactionControllersContractSource).toContain("channelActionState: ChannelsPageChannelActionsResult<ChannelInfo>")
    expect(interactionControllersContractSource).toContain("configFlowState: ChannelsPageConfigFlowResult")
    expect(interactionControllersContractSource).toContain("pluginRepairState: ChannelsPageFeishuPluginRepairResult<ChannelInfo>")
    expect(interactionControllersContractSource).toContain(
      'extends ChannelsPageManagedStatusAccessBinding<'
    )
    expect(interactionControllersContractSource).toContain('ChannelsPageManagedStatusChannel<ChannelInfo>,')
    expect(interactionControllersContractSource).toContain('ChannelInfo')
    expect(interactionControllersContractSource).toContain('ChannelsPageSetPageErrorBinding {}')
    expect(interactionControllersContractSource).not.toContain('setError: ChannelsPagePageErrorHandler')
  })
})
