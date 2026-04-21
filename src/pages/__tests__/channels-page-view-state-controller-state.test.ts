import { describe, expect, it } from 'vitest'

import viewStateControllerStateSource from '../channels-page-view-state-controller-state.ts?raw'

describe('channels-page-view-state-controller-state hook', () => {
  it('keeps the view-state controller composition behind one shared hook', () => {
    expect(viewStateControllerStateSource).toContain('import type {')
    expect(viewStateControllerStateSource).toContain('ChannelsPageViewStateControllerStateInput,')
    expect(viewStateControllerStateSource).toContain('ChannelsPageViewStateControllerStateResult,')
    expect(viewStateControllerStateSource).toContain("} from './channels-page-view-state-controller-state-contract'")
    expect(viewStateControllerStateSource).toContain("import { useChannelsPageCoreControllers } from './channels-page-core-controllers'")
    expect(viewStateControllerStateSource).toContain("import { useChannelsPageInteractionControllers } from './channels-page-interaction-controllers'")
    expect(viewStateControllerStateSource).toContain("import { buildChannelsPageViewStateSurfaceControllerState } from './channels-page-view-state-surface-controller-state'")
    expect(viewStateControllerStateSource).toContain('export function useChannelsPageViewStateControllerState({')
    expect(viewStateControllerStateSource).toContain('}: ChannelsPageViewStateControllerStateInput): ChannelsPageViewStateControllerStateResult {')
  })

  it('keeps controller composition in the hook and delegates large surface-state mapping to the builder module', () => {
    expect(viewStateControllerStateSource).toContain('const coreControllerState = useChannelsPageCoreControllers({')
    expect(viewStateControllerStateSource).toContain('resolveLatestChannelSnapshot,')
    expect(viewStateControllerStateSource).toContain('const { loading, fetchChannels, setError } = coreControllerState.dataState')
    expect(viewStateControllerStateSource).toContain('const interactionControllerState = useChannelsPageInteractionControllers({')
    expect(viewStateControllerStateSource).toContain('fetchChannels,')
    expect(viewStateControllerStateSource).toContain('setError,')
    expect(viewStateControllerStateSource).toContain('shouldShowRepairAction,')
    expect(viewStateControllerStateSource).toContain('getSharedStatusAlert,')
    expect(viewStateControllerStateSource).toContain('return {')
    expect(viewStateControllerStateSource).toContain('loading,')
    expect(viewStateControllerStateSource).toContain('surfaceControllerState: buildChannelsPageViewStateSurfaceControllerState({')
    expect(viewStateControllerStateSource).toContain('coreControllerState,')
    expect(viewStateControllerStateSource).toContain('interactionControllerState,')
  })
})
