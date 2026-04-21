import { describe, expect, it } from 'vitest'

import viewStateContractSource from '../channels-page-view-state-contract.ts?raw'

describe('channels-page-view-state-contract module', () => {
  it('keeps the shared view-state helper contract behind one dedicated module', () => {
    expect(viewStateContractSource).toContain('ChannelsPageFeishuTargetStateOptions,')
    expect(viewStateContractSource).toContain('ChannelsPageTargetStateDeriverBinding,')
    expect(viewStateContractSource).toContain("} from './channels-page-feishu-target-state-contract'")
    expect(viewStateContractSource).toContain('import type {')
    expect(viewStateContractSource).toContain('ChannelsPageChannelInfo,')
    expect(viewStateContractSource).toContain('ChannelsPageLoadingBinding,')
    expect(viewStateContractSource).toContain("} from './channels-page-data-contract'")
    expect(viewStateContractSource).toContain(
      "import type { ChannelsPageChannelCardDisplayHelpers } from './channels-page-main-surface-props-contract'"
    )
    expect(viewStateContractSource).toContain(
      "import type { ChannelsPageFeishuModalDisplayHelpers } from './channels-page-modal-props-contract'"
    )
    expect(viewStateContractSource).toContain('ChannelsPageChannelStatusBadgeDeriverBinding,')
    expect(viewStateContractSource).toContain('ChannelsPageChannelStatusBadgeDeriver,')
    expect(viewStateContractSource).toContain('ChannelsPageChannelStatusBadgeOptions,')
    expect(viewStateContractSource).toContain('ChannelsPageLatestChannelSnapshotResolverBinding,')
    expect(viewStateContractSource).toContain('ChannelsPageManagedStatusChannel,')
    expect(viewStateContractSource).toContain('ChannelsPageManagedStatusResolvers,')
    expect(viewStateContractSource).toContain('ChannelsPageStateHelperTargetState,')
    expect(viewStateContractSource).toContain("} from './channels-page-state-helpers-contract'")
    expect(viewStateContractSource).toContain("import type { ChannelPairingTargetRef } from './channels-page-utils'")
    expect(viewStateContractSource).toContain("import type ChannelsPageChannelCards from '../components/ChannelsPageChannelCards'")
    expect(viewStateContractSource).toContain("import type ChannelsPagePairingModal from '../components/ChannelsPagePairingModal'")
    expect(viewStateContractSource).toContain(
      "import type { ChannelsPageSurfaceCompositionResult } from './channels-page-surface-composition-contract'"
    )
    expect(viewStateContractSource).toContain('export interface ChannelsPageViewStateHelpers')
    expect(viewStateContractSource).toContain('export interface ChannelsPageViewStateResult')
  })

  it('keeps both helper inputs and shell-ready result props in one shared contract module', () => {
    expect(viewStateContractSource).toContain(
      'ChannelsPageLatestChannelSnapshotResolverBinding<ChannelsPageChannelInfo> {'
    )
    expect(viewStateContractSource).toContain(
      'ChannelsPageManagedStatusResolvers<ChannelsPageManagedStatusChannel<ChannelsPageChannelInfo>>,'
    )
    expect(viewStateContractSource).toContain('ChannelsPageTargetStateDeriverBinding<')
    expect(viewStateContractSource).toContain('extends ChannelsPageChannelCardDisplayHelpers,')
    expect(viewStateContractSource).toContain('ChannelsPageChannelStatusBadgeDeriverBinding,')
    expect(viewStateContractSource).toContain('ChannelsPageFeishuModalDisplayHelpers,')
    expect(viewStateContractSource).not.toContain('deriveChannelStatusBadges: ChannelsPageChannelStatusBadgeDeriver')
    expect(viewStateContractSource).not.toContain('deriveTargetState: ChannelsPageTargetStateDeriver<')
    expect(viewStateContractSource).toContain('extends ChannelsPageSurfaceCompositionResult,')
    expect(viewStateContractSource).toContain('ChannelsPageLoadingBinding {}')
    expect(viewStateContractSource).not.toContain("loading: ComponentProps<typeof ChannelsPageShell>['loading']")
    expect(viewStateContractSource).not.toContain("topPanelProps: ComponentProps<typeof ChannelsPageShell>['topPanelProps']")
    expect(viewStateContractSource).not.toContain("diagnosticsModalProps: ComponentProps<typeof ChannelsPageShell>['diagnosticsModalProps']")
  })
})
