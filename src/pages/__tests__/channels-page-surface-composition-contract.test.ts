import { describe, expect, it } from 'vitest'

import surfaceCompositionContractSource from '../channels-page-surface-composition-contract.ts?raw'

describe('channels-page-surface-composition-contract module', () => {
  it('keeps the surface-composition input and output contract behind one dedicated module', () => {
    expect(surfaceCompositionContractSource).toContain("import type { ChannelsPageConfigFlowModalState } from './channels-page-config-flow-contract'")
    expect(surfaceCompositionContractSource).toContain(
      "import type { ChannelsPageRefreshChannelsInBackgroundBinding } from './channels-page-core-controllers-contract'"
    )
    expect(surfaceCompositionContractSource).toContain('ChannelsPageTargetStateDeriverBinding,')
    expect(surfaceCompositionContractSource).toContain("} from './channels-page-feishu-target-state-contract'")
    expect(surfaceCompositionContractSource).toContain(
      "import type { ChannelsPageChannelInfo, ChannelsPageVoidHandler } from './channels-page-data-contract'"
    )
    expect(surfaceCompositionContractSource).toContain(
      "import type { ChannelsPageFeishuPluginRepairBinding } from './channels-page-feishu-plugin-repair-contract'"
    )
    expect(surfaceCompositionContractSource).toContain('ChannelsPageMainSurfacePropsOptions,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageMainSurfacePropsResult,')
    expect(surfaceCompositionContractSource).toContain("} from './channels-page-main-surface-props-contract'")
    expect(surfaceCompositionContractSource).toContain('ChannelsPageFeishuModalDisplayHelpers,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageModalPropsResult,')
    expect(surfaceCompositionContractSource).toContain("} from './channels-page-modal-props-contract'")
    expect(surfaceCompositionContractSource).toContain(
      "import type { ChannelsPageModelModalState } from './channels-page-model-config-contract'"
    )
    expect(surfaceCompositionContractSource).toContain(
      "import type { ChannelsPageModelModalPropsResult } from './channels-page-model-modal-props-contract'"
    )
    expect(surfaceCompositionContractSource).toContain('ChannelsPageStateHelperTargetState,')
    expect(surfaceCompositionContractSource).toContain("} from './channels-page-state-helpers-contract'")
    expect(surfaceCompositionContractSource).toContain('ChannelsPageDiagnosticsModalState,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPagePairingModalState,')
    expect(surfaceCompositionContractSource).toContain("} from './channels-page-target-modals-contract'")
    expect(surfaceCompositionContractSource).toContain('export interface ChannelsPageSurfaceCompositionOptions')
    expect(surfaceCompositionContractSource).toContain('extends ChannelsPageMainSurfacePropsOptions,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageConfigFlowModalState,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageRefreshChannelsInBackgroundBinding<unknown>,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageFeishuModalDisplayHelpers,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageTargetStateDeriverBinding<')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageFeishuPluginRepairBinding<ChannelsPageChannelInfo>,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageModelModalState<ChannelsPageChannelInfo>,')
    expect(surfaceCompositionContractSource).toContain(
      'ChannelsPagePairingModalState<ChannelsPageChannelInfo, ChannelsPageVoidHandler>,'
    )
    expect(surfaceCompositionContractSource).toContain('ChannelsPageDiagnosticsModalState<ChannelsPageChannelInfo> {')
    expect(surfaceCompositionContractSource).toContain('export interface ChannelsPageSurfaceCompositionResult')
  })

  it('keeps surface-composition inputs and derived result groups in one shared contract module', () => {
    expect(surfaceCompositionContractSource).not.toContain('refreshChannelsInBackground: () => Promise<unknown>')
    expect(surfaceCompositionContractSource).not.toContain('deriveTargetState: ChannelsPageTargetStateDeriver<')
    expect(surfaceCompositionContractSource).not.toContain(
      'repairFeishuPlugin: ChannelsPageFeishuPluginRepairHandler<ChannelsPageChannelInfo>'
    )
    expect(surfaceCompositionContractSource).not.toContain('setError: ChannelsPagePageErrorHandler')
    expect(surfaceCompositionContractSource).not.toContain('handleRefreshChannels: () => Promise<unknown> | void')
    expect(surfaceCompositionContractSource).not.toContain('handleOpenAddChannel: () => void')
    expect(surfaceCompositionContractSource).not.toContain('togglingChannelId: string | null')
    expect(surfaceCompositionContractSource).not.toContain('repairingPluginChannelId: string | null')
    expect(surfaceCompositionContractSource).not.toContain('deriveChannelStatusBadges: ChannelsPageChannelStatusBadgeDeriver')
    expect(surfaceCompositionContractSource).not.toContain('selectedPairingTarget: ChannelPairingTargetRef | null')
    expect(surfaceCompositionContractSource).not.toContain('selectedDiagnosticsTarget: ChannelPairingTargetRef | null')
    expect(surfaceCompositionContractSource).not.toContain('showModelModal: boolean')
    expect(surfaceCompositionContractSource).not.toContain('selectedModelChannel: ChannelsPageChannelInfo | null')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageRefreshChannelsInBackgroundBinding<unknown>,')
    expect(surfaceCompositionContractSource).toContain('extends ChannelsPageMainSurfacePropsResult,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageModalPropsResult,')
    expect(surfaceCompositionContractSource).toContain('ChannelsPageModelModalPropsResult {}')
    expect(surfaceCompositionContractSource).not.toContain("topPanelProps: ChannelsPageMainSurfacePropsResult['topPanelProps']")
    expect(surfaceCompositionContractSource).not.toContain("configModalProps: ChannelsPageModalPropsResult['configModalProps']")
    expect(surfaceCompositionContractSource).not.toContain("pairingModalProps: ChannelsPageModalPropsResult['pairingModalProps']")
    expect(surfaceCompositionContractSource).not.toContain("modelConfigModalProps: ChannelsPageModelModalPropsResult['modelConfigModalProps']")
    expect(surfaceCompositionContractSource).not.toContain("diagnosticsModalProps: ChannelsPageModalPropsResult['diagnosticsModalProps']")
  })
})
