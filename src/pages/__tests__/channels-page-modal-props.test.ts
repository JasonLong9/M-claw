import { describe, expect, it } from 'vitest'

import modalPropsSource from '../channels-page-modal-props.ts?raw'

describe('channels-page-modal-props hook', () => {
  it('keeps the shared modal surface contract for config, pairing, and diagnostics modal prop assembly', () => {
    expect(modalPropsSource).toContain("import type { ComponentProps } from 'react'")
    expect(modalPropsSource).toContain("import ChannelsPageConfigModal from '../components/ChannelsPageConfigModal'")
    expect(modalPropsSource).toContain("import ChannelsPagePairingModal from '../components/ChannelsPagePairingModal'")
    expect(modalPropsSource).toContain("import ChannelsPageDiagnosticsModal from '../components/ChannelsPageDiagnosticsModal'")
    expect(modalPropsSource).toContain('ChannelsPageModalPropsOptions,')
    expect(modalPropsSource).toContain('ChannelsPageModalPropsResult,')
    expect(modalPropsSource).toContain("} from './channels-page-modal-props-contract'")
    expect(modalPropsSource).toContain('export function useChannelsPageModalProps({')
    expect(modalPropsSource).toContain('}: ChannelsPageModalPropsOptions): ChannelsPageModalPropsResult {')
    expect(modalPropsSource).toContain('const configModalProps: ComponentProps<typeof ChannelsPageConfigModal> = {')
    expect(modalPropsSource).toContain('const pairingModalProps: ComponentProps<typeof ChannelsPagePairingModal> = {')
    expect(modalPropsSource).toContain('const diagnosticsModalProps: ComponentProps<typeof ChannelsPageDiagnosticsModal> = {')
    expect(modalPropsSource).toContain('configModalProps,')
    expect(modalPropsSource).toContain('pairingModalProps,')
    expect(modalPropsSource).toContain('diagnosticsModalProps,')
    expect(modalPropsSource).not.toContain('interface UseChannelsPageModalPropsOptions {')
  })

  it('keeps shared-status repair and refresh callbacks inside the modal prop composition hook', () => {
    expect(modalPropsSource).toContain("onRepairSharedStatus: () => void repairFeishuPlugin(configTargetState.channel!, { surface: 'pairing' })")
    expect(modalPropsSource).toContain('onRefreshMissing: () => void configTargetState.refreshTargetChannelStatus(configTargetState.targetKey)')
    expect(modalPropsSource).toContain("onRepairSharedStatus: () => void repairFeishuPlugin(pairingTargetState.channel!, { surface: 'pairing' })")
    expect(modalPropsSource).toContain('onRefreshMissing: () => void pairingTargetState.refreshTargetChannelStatus(pairingTargetState.targetKey)')
    expect(modalPropsSource).toContain("onRepairSharedStatus: () => repairFeishuPlugin(diagnosticsTargetState.channel!, { surface: 'diagnostics' })")
    expect(modalPropsSource).toContain('onRefreshMissing: () => void diagnosticsTargetState.refreshTargetChannelStatus(diagnosticsTargetState.targetKey)')
    expect(modalPropsSource).toContain('getBadges: deriveChannelStatusBadges,')
    expect(modalPropsSource).toContain('getSummary: getFeishuPairingModalSummary,')
    expect(modalPropsSource).toContain('getRuntimeSummaryColor: getFeishuRuntimeSummaryAlertColor,')
    expect(modalPropsSource).toContain('getTitle: getFeishuDiagnosticsModalTitle,')
    expect(modalPropsSource).toContain('getBotLabel: getFeishuChannelDisplayName,')
  })
})
