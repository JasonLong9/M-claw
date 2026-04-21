import { describe, expect, it } from 'vitest'

import viewStateSource from '../channels-page-view-state.ts?raw'

describe('channels-page-view-state hook', () => {
  it('keeps the shared page-level view-state contract behind one hook', () => {
    expect(viewStateSource).toContain('import type {')
    expect(viewStateSource).toContain("ChannelsPageViewStateHelpers,")
    expect(viewStateSource).toContain("ChannelsPageViewStateResult,")
    expect(viewStateSource).toContain("} from './channels-page-view-state-contract'")
    expect(viewStateSource).toContain("import { useChannelsPageViewStateControllerState } from './channels-page-view-state-controller-state'")
    expect(viewStateSource).toContain("import { useChannelsPageSurfaceComposition } from './channels-page-surface-composition'")
    expect(viewStateSource).toContain('export function useChannelsPageViewState({')
    expect(viewStateSource).toContain('}: ChannelsPageViewStateHelpers): ChannelsPageViewStateResult {')
    expect(viewStateSource).not.toContain('interface UseChannelsPageViewStateOptions {')
  })

  it('keeps controller-state plus surface-composition glue inside one shared hook', () => {
    expect(viewStateSource).toContain('} = useChannelsPageViewStateControllerState({')
    expect(viewStateSource).toContain('resolveLatestChannelSnapshot,')
    expect(viewStateSource).toContain('shouldShowRepairAction,')
    expect(viewStateSource).toContain('getSharedStatusAlert,')
    expect(viewStateSource).toContain('} = useChannelsPageSurfaceComposition({')
    expect(viewStateSource).toContain('...surfaceControllerState,')
    expect(viewStateSource).toContain('getFeishuSharedStatusAlert: getSharedStatusAlert,')
    expect(viewStateSource).toContain('deriveTargetState,')
    expect(viewStateSource).toContain('deriveChannelStatusBadges,')
    expect(viewStateSource).toContain('topPanelProps,')
    expect(viewStateSource).toContain('channelListPanelProps,')
    expect(viewStateSource).toContain('channelCardsProps,')
    expect(viewStateSource).toContain('configModalProps,')
    expect(viewStateSource).toContain('pairingModalProps,')
    expect(viewStateSource).toContain('modelConfigModalProps,')
    expect(viewStateSource).toContain('diagnosticsModalProps,')
    expect(viewStateSource).toContain('return {')
    expect(viewStateSource).toContain('loading,')
  })
})

