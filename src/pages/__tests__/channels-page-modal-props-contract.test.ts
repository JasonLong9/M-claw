import { describe, expect, it } from 'vitest'

import modalPropsContractSource from '../channels-page-modal-props-contract.ts?raw'

describe('channels-page-modal-props-contract module', () => {
  it('keeps the modal prop input and output contract behind one dedicated module', () => {
    expect(modalPropsContractSource).toContain("import type { ComponentProps } from 'react'")
    expect(modalPropsContractSource).toContain("import type { FeishuDiagnosticsRepairOutcome } from '../components/FeishuDiagnosticsModal'")
    expect(modalPropsContractSource).toContain("import type ChannelsPageConfigModal from '../components/ChannelsPageConfigModal'")
    expect(modalPropsContractSource).toContain("import type ChannelsPagePairingModal from '../components/ChannelsPagePairingModal'")
    expect(modalPropsContractSource).toContain("import type ChannelsPageDiagnosticsModal from '../components/ChannelsPageDiagnosticsModal'")
    expect(modalPropsContractSource).toContain("import type { ChannelsPageConfigFlowModalState } from './channels-page-config-flow-contract'")
    expect(modalPropsContractSource).toContain('ChannelsPageChannelInfo,')
    expect(modalPropsContractSource).toContain('ChannelsPageNullableChannel,')
    expect(modalPropsContractSource).toContain('ChannelsPageVoidHandler,')
    expect(modalPropsContractSource).toContain("} from './channels-page-data-contract'")
    expect(modalPropsContractSource).toContain("import type { ChannelsPageFeishuPluginRepairBinding } from './channels-page-feishu-plugin-repair-contract'")
    expect(modalPropsContractSource).toContain(
      "import type { ChannelsPageFeishuTargetRefreshControls } from './channels-page-feishu-target-refresh-contract'"
    )
    expect(modalPropsContractSource).toContain(
      'ChannelsPageChannelStatusBadgeDeriverBinding,'
    )
    expect(modalPropsContractSource).toContain(
      'ChannelsPageStateHelperBlockedBySharedStatusBinding,'
    )
    expect(modalPropsContractSource).toContain(
      'ChannelsPageStateHelperRepairStateBinding,'
    )
    expect(modalPropsContractSource).toContain(
      'ChannelsPageStateHelperRefreshStatusBinding,'
    )
    expect(modalPropsContractSource).toContain(
      "} from './channels-page-state-helpers-contract'"
    )
    expect(modalPropsContractSource).toContain(
      "import type { ChannelsPageGroupedTargetStatesBinding } from './channels-page-target-state-groups-contract'"
    )
    expect(modalPropsContractSource).toContain("import type {")
    expect(modalPropsContractSource).toContain('ChannelsPageDiagnosticsModalVisibilityState,')
    expect(modalPropsContractSource).toContain('ChannelsPagePairingModalVisibilityState,')
    expect(modalPropsContractSource).toContain("} from './channels-page-target-modals-contract'")
    expect(modalPropsContractSource).toContain('export interface ChannelsPageFeishuModalDisplayHelpers {')
    expect(modalPropsContractSource).toContain('export interface ChannelsPageModalSharedStatusState<Alert>')
    expect(modalPropsContractSource).toContain('export interface ChannelsPageModalTargetRefreshState')
    expect(modalPropsContractSource).toContain('export interface ChannelsPageModalTargetChannelBinding {')
    expect(modalPropsContractSource).toContain('export interface ChannelsPageBaseModalTargetState<Alert>')
    expect(modalPropsContractSource).toContain('export interface ChannelsPageBlockedModalTargetState<Alert>')
    expect(modalPropsContractSource).toContain('export interface ChannelsPageConfigModalTargetState')
    expect(modalPropsContractSource).toContain('export interface ChannelsPagePairingModalTargetState')
    expect(modalPropsContractSource).toContain('export interface ChannelsPageDiagnosticsModalTargetState')
    expect(modalPropsContractSource).toContain('export interface ChannelsPageModalPropsOptions')
    expect(modalPropsContractSource).toContain('export interface ChannelsPageModalPropsResult {')
  })

  it('keeps grouped config, pairing, and diagnostics target-state wiring in the shared contract module', () => {
    expect(modalPropsContractSource).toContain('extends ChannelsPageConfigFlowModalState,')
    expect(modalPropsContractSource).toContain('ChannelsPageFeishuModalDisplayHelpers,')
    expect(modalPropsContractSource).toContain('ChannelsPagePairingModalVisibilityState<ChannelsPageVoidHandler>,')
    expect(modalPropsContractSource).toContain('ChannelsPageDiagnosticsModalVisibilityState,')
    expect(modalPropsContractSource).toContain('ChannelsPageChannelStatusBadgeDeriverBinding,')
    expect(modalPropsContractSource).toContain(
      'ChannelsPageFeishuPluginRepairBinding<ChannelsPageChannelInfo>,'
    )
    expect(modalPropsContractSource).toContain('targetKey: string')
    expect(modalPropsContractSource).toContain('extends ChannelsPageFeishuTargetRefreshControls,')
    expect(modalPropsContractSource).toContain('ChannelsPageStateHelperRefreshStatusBinding {')
    expect(modalPropsContractSource).not.toContain('export type ChannelsPageTargetChannelStatusRefreshHandler = (')
    expect(modalPropsContractSource).not.toContain('refreshingTargetChannel: boolean')
    expect(modalPropsContractSource).not.toContain(
      'refreshTargetChannelStatus: ChannelsPageTargetChannelStatusRefreshHandler'
    )
    expect(modalPropsContractSource).not.toContain('statusPending: boolean')
    expect(modalPropsContractSource).not.toContain('missingAfterRefresh: boolean')
    expect(modalPropsContractSource).toContain('ChannelsPageStateHelperBlockedBySharedStatusBinding {')
    expect(modalPropsContractSource).not.toContain('blockedBySharedStatus: boolean')
    expect(modalPropsContractSource).toContain('extends ChannelsPageStateHelperRepairStateBinding {')
    expect(modalPropsContractSource).not.toContain('repairing: boolean')
    expect(modalPropsContractSource).not.toContain('canRepair: boolean')
    expect(modalPropsContractSource).toContain('channel: ChannelsPageNullableChannel<ChannelsPageChannelInfo>')
    expect(modalPropsContractSource).toContain('ChannelsPageModalTargetChannelBinding {')
    expect(modalPropsContractSource).not.toContain('channel: ChannelsPageChannelInfo | null\n  blockedBySharedStatus: boolean')
    expect(modalPropsContractSource).toContain('extends ChannelsPageBaseModalTargetState<Alert>,')
    expect(modalPropsContractSource).toContain('extends ChannelsPageBlockedModalTargetState<ComponentProps<typeof ChannelsPageConfigModal>')
    expect(modalPropsContractSource).toContain('extends ChannelsPageBlockedModalTargetState<ComponentProps<typeof ChannelsPagePairingModal>')
    expect(modalPropsContractSource).toContain('extends ChannelsPageBaseModalTargetState<ComponentProps<typeof ChannelsPageDiagnosticsModal>')
    expect(modalPropsContractSource).toContain('ChannelsPageGroupedTargetStatesBinding<')
    expect(modalPropsContractSource).toContain('ChannelsPageConfigModalTargetState,')
    expect(modalPropsContractSource).toContain('ChannelsPagePairingModalTargetState,')
    expect(modalPropsContractSource).toContain('ChannelsPageDiagnosticsModalTargetState')
    expect(modalPropsContractSource).toContain('> {}')
    expect(modalPropsContractSource).not.toContain('configTargetState: ChannelsPageConfigModalTargetState')
    expect(modalPropsContractSource).not.toContain('pairingTargetState: ChannelsPagePairingModalTargetState')
    expect(modalPropsContractSource).not.toContain('diagnosticsTargetState: ChannelsPageDiagnosticsModalTargetState')
    expect(modalPropsContractSource).not.toContain('showPairingModal: boolean')
    expect(modalPropsContractSource).not.toContain('handlePairingClose: () => void')
    expect(modalPropsContractSource).not.toContain('handlePairingDone: () => void')
    expect(modalPropsContractSource).not.toContain('showDiagnosticsModal: boolean')
    expect(modalPropsContractSource).not.toContain('handleDiagnosticsClose: () => void')
    expect(modalPropsContractSource).toContain('fallbackChannel: ChannelsPageNullableChannel<ChannelsPageChannelInfo>')
    expect(modalPropsContractSource).not.toContain('deriveChannelStatusBadges: ChannelsPageChannelStatusBadgeDeriver')
    expect(modalPropsContractSource).not.toContain(
      'repairFeishuPlugin: ChannelsPageFeishuPluginRepairHandler<ChannelsPageChannelInfo>'
    )
    expect(modalPropsContractSource).toContain("configModalProps: ComponentProps<typeof ChannelsPageConfigModal>")
    expect(modalPropsContractSource).toContain("pairingModalProps: ComponentProps<typeof ChannelsPagePairingModal>")
    expect(modalPropsContractSource).toContain("diagnosticsModalProps: ComponentProps<typeof ChannelsPageDiagnosticsModal>")
  })
})
