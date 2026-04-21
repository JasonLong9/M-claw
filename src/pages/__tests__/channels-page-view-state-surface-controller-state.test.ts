import { describe, expect, it } from 'vitest'

import viewStateSurfaceControllerStateSource from '../channels-page-view-state-surface-controller-state.ts?raw'

describe('channels-page-view-state-surface-controller-state module', () => {
  it('keeps the surface-controller-state builder behind one shared module', () => {
    expect(viewStateSurfaceControllerStateSource).toContain('import type {')
    expect(viewStateSurfaceControllerStateSource).toContain('BuildChannelsPageViewStateSurfaceControllerStateOptions,')
    expect(viewStateSurfaceControllerStateSource).toContain('BuildChannelsPageViewStateSurfaceControllerStateResult,')
    expect(viewStateSurfaceControllerStateSource).toContain("} from './channels-page-view-state-surface-controller-state-contract'")
    expect(viewStateSurfaceControllerStateSource).toContain('export function buildChannelsPageViewStateSurfaceControllerState({')
    expect(viewStateSurfaceControllerStateSource).toContain("}: BuildChannelsPageViewStateSurfaceControllerStateOptions): BuildChannelsPageViewStateSurfaceControllerStateResult['surfaceControllerState'] {")
  })

  it('keeps the large surface-controller-state object mapping in one dedicated builder', () => {
    expect(viewStateSurfaceControllerStateSource).toContain('coreControllerState: {')
    expect(viewStateSurfaceControllerStateSource).toContain('interactionControllerState: {')
    expect(viewStateSurfaceControllerStateSource).toContain('return {')
    expect(viewStateSurfaceControllerStateSource).toContain('handleRefreshChannels,')
    expect(viewStateSurfaceControllerStateSource).toContain('handleOpenAddChannel,')
    expect(viewStateSurfaceControllerStateSource).toContain('handleRepairFeishuPlugin,')
    expect(viewStateSurfaceControllerStateSource).toContain('refreshChannelsInBackground,')
    expect(viewStateSurfaceControllerStateSource).toContain('showModelModal,')
    expect(viewStateSurfaceControllerStateSource).toContain('selectedModelChannel,')
    expect(viewStateSurfaceControllerStateSource).toContain('handleSaveBotModel,')
    expect(viewStateSurfaceControllerStateSource).toContain('repairFeishuPlugin,')
  })
})
