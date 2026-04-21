import { describe, expect, it } from 'vitest'

import viewStateSurfaceControllerStateContractSource from '../channels-page-view-state-surface-controller-state-contract.ts?raw'

describe('channels-page-view-state-surface-controller-state-contract module', () => {
  it('keeps the surface-controller-state builder contract behind one dedicated module', () => {
    expect(viewStateSurfaceControllerStateContractSource).toContain("import type {")
    expect(viewStateSurfaceControllerStateContractSource).toContain('ChannelsPageViewStateSurfaceControllerStateBinding,')
    expect(viewStateSurfaceControllerStateContractSource).toContain(
      "} from './channels-page-view-state-controller-state-contract'"
    )
    expect(viewStateSurfaceControllerStateContractSource).toContain("import type { ChannelsPageCoreControllersResult } from './channels-page-core-controllers-contract'")
    expect(viewStateSurfaceControllerStateContractSource).toContain("import type { ChannelsPageInteractionControllersResult } from './channels-page-interaction-controllers-contract'")
    expect(viewStateSurfaceControllerStateContractSource).toContain('export type ChannelsPageCoreControllersState = ChannelsPageCoreControllersResult')
    expect(viewStateSurfaceControllerStateContractSource).toContain('export type ChannelsPageInteractionControllersState = ChannelsPageInteractionControllersResult')
    expect(viewStateSurfaceControllerStateContractSource).toContain('export interface BuildChannelsPageViewStateSurfaceControllerStateOptions {')
    expect(viewStateSurfaceControllerStateContractSource).toContain(
      'export interface BuildChannelsPageViewStateSurfaceControllerStateResult'
    )
  })

  it('keeps the builder input and surface-state output in one shared contract module', () => {
    expect(viewStateSurfaceControllerStateContractSource).toContain('coreControllerState: ChannelsPageCoreControllersState')
    expect(viewStateSurfaceControllerStateContractSource).toContain('interactionControllerState: ChannelsPageInteractionControllersState')
    expect(viewStateSurfaceControllerStateContractSource).toContain(
      'extends ChannelsPageViewStateSurfaceControllerStateBinding {}'
    )
    expect(viewStateSurfaceControllerStateContractSource).not.toContain(
      'surfaceControllerState: ChannelsPageViewStateSurfaceControllerState'
    )
  })
})
