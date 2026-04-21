import { describe, expect, it } from 'vitest'

import viewStateHelpersSource from '../channels-page-view-state-helpers.ts?raw'

describe('channels-page-view-state-helpers module', () => {
  it('keeps the page-level view-state helper bundle behind one shared module', () => {
    expect(viewStateHelpersSource).toContain("import type { ChannelsPageViewStateHelpers } from './channels-page-view-state-contract'")
    expect(viewStateHelpersSource).toContain("import {")
    expect(viewStateHelpersSource).toContain("deriveChannelStatusBadges,")
    expect(viewStateHelpersSource).toContain("deriveFeishuTargetState,")
    expect(viewStateHelpersSource).toContain("getChannelCardSummary,")
    expect(viewStateHelpersSource).toContain("getFeishuChannelDisplayName,")
    expect(viewStateHelpersSource).toContain("getFeishuDiagnosticsModalTitle,")
    expect(viewStateHelpersSource).toContain("getFeishuPairingModalSummary,")
    expect(viewStateHelpersSource).toContain("getFeishuProvisionSourceDescription,")
    expect(viewStateHelpersSource).toContain("getFeishuRuntimeSummaryAlertColor,")
    expect(viewStateHelpersSource).toContain("getFeishuSharedStatusAlert,")
    expect(viewStateHelpersSource).toContain("resolveLatestChannelSnapshot,")
    expect(viewStateHelpersSource).toContain("shouldShowFeishuPluginRepairAction,")
    expect(viewStateHelpersSource).toContain("shouldShowPluginStatus,")
    expect(viewStateHelpersSource).toContain("} from './channels-page-state-helpers'")
    expect(viewStateHelpersSource).toContain('export const channelsPageViewStateHelpers: ChannelsPageViewStateHelpers = {')
  })

  it('keeps the view-state helper wiring in one shared object instead of inline page composition', () => {
    expect(viewStateHelpersSource).toContain('resolveLatestChannelSnapshot,')
    expect(viewStateHelpersSource).toContain('shouldShowRepairAction: shouldShowFeishuPluginRepairAction,')
    expect(viewStateHelpersSource).toContain('getSharedStatusAlert: getFeishuSharedStatusAlert,')
    expect(viewStateHelpersSource).toContain('deriveTargetState: deriveFeishuTargetState,')
    expect(viewStateHelpersSource).toContain('deriveChannelStatusBadges,')
    expect(viewStateHelpersSource).toContain('getChannelCardSummary,')
    expect(viewStateHelpersSource).toContain('getFeishuProvisionSourceDescription,')
    expect(viewStateHelpersSource).toContain('shouldShowPluginStatus,')
    expect(viewStateHelpersSource).toContain('shouldShowFeishuPluginRepairAction,')
    expect(viewStateHelpersSource).toContain('getFeishuPairingModalSummary,')
    expect(viewStateHelpersSource).toContain('getFeishuRuntimeSummaryAlertColor,')
    expect(viewStateHelpersSource).toContain('getFeishuDiagnosticsModalTitle,')
    expect(viewStateHelpersSource).toContain('getFeishuChannelDisplayName,')
  })
})
