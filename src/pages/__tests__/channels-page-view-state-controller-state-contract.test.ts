import { describe, expect, it } from 'vitest'

import viewStateControllerStateContractSource from '../channels-page-view-state-controller-state-contract.ts?raw'

describe('channels-page-view-state-controller-state-contract module', () => {
  it('keeps the controller-state input and output contract behind one dedicated module', () => {
    expect(viewStateControllerStateContractSource).toContain(
      "import type { ChannelsPageLoadingBinding } from './channels-page-data-contract'"
    )
    expect(viewStateControllerStateContractSource).toContain("import type { ChannelsPageSurfaceCompositionOptions } from './channels-page-surface-composition-contract'")
    expect(viewStateControllerStateContractSource).toContain('import type {')
    expect(viewStateControllerStateContractSource).toContain('ChannelsPageViewStateHelpers,')
    expect(viewStateControllerStateContractSource).toContain("} from './channels-page-view-state-contract'")
    expect(viewStateControllerStateContractSource).toContain('export type ChannelsPageViewStateControllerStateInput = Pick<')
    expect(viewStateControllerStateContractSource).toContain('export type ChannelsPageViewStateSurfaceControllerState = Omit<')
    expect(viewStateControllerStateContractSource).toContain(
      'export interface ChannelsPageViewStateSurfaceControllerStateBinding {'
    )
    expect(viewStateControllerStateContractSource).toContain('export interface ChannelsPageViewStateControllerStateResult')
  })

  it('keeps the controller-state surface contract aligned with surface-composition non-helper props', () => {
    expect(viewStateControllerStateContractSource).toContain("'resolveLatestChannelSnapshot' | 'shouldShowRepairAction' | 'getSharedStatusAlert'")
    expect(viewStateControllerStateContractSource).toContain('ChannelsPageSurfaceCompositionOptions,')
    expect(viewStateControllerStateContractSource).toContain("'deriveTargetState'")
    expect(viewStateControllerStateContractSource).toContain("'deriveChannelStatusBadges'")
    expect(viewStateControllerStateContractSource).toContain("'getChannelCardSummary'")
    expect(viewStateControllerStateContractSource).toContain("'getFeishuSharedStatusAlert'")
    expect(viewStateControllerStateContractSource).toContain("'getFeishuProvisionSourceDescription'")
    expect(viewStateControllerStateContractSource).toContain("'shouldShowPluginStatus'")
    expect(viewStateControllerStateContractSource).toContain("'shouldShowFeishuPluginRepairAction'")
    expect(viewStateControllerStateContractSource).toContain("'getFeishuPairingModalSummary'")
    expect(viewStateControllerStateContractSource).toContain("'getFeishuRuntimeSummaryAlertColor'")
    expect(viewStateControllerStateContractSource).toContain("'getFeishuDiagnosticsModalTitle'")
    expect(viewStateControllerStateContractSource).toContain("'getFeishuChannelDisplayName'")
    expect(viewStateControllerStateContractSource).toContain('extends ChannelsPageViewStateSurfaceControllerStateBinding,')
    expect(viewStateControllerStateContractSource).toContain('ChannelsPageLoadingBinding {}')
    expect(viewStateControllerStateContractSource).toContain(
      'surfaceControllerState: ChannelsPageViewStateSurfaceControllerState'
    )
    expect(viewStateControllerStateContractSource).not.toContain("loading: ChannelsPageViewStateResult['loading']")
  })
})
