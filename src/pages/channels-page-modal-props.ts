import type { ComponentProps } from 'react'

import ChannelsPageConfigModal from '../components/ChannelsPageConfigModal'
import ChannelsPageDiagnosticsModal from '../components/ChannelsPageDiagnosticsModal'
import ChannelsPagePairingModal from '../components/ChannelsPagePairingModal'
import type {
  ChannelsPageModalPropsOptions,
  ChannelsPageModalPropsResult,
} from './channels-page-modal-props-contract'

export function useChannelsPageModalProps({
  showConfigModal,
  handleChannelConfigBack,
  configStep,
  selectedChannelId,
  selectedConfigTarget,
  handleConfigDone,
  setSelectedChannelId,
  setSelectedConfigTarget,
  setConfigStep,
  configTargetState,
  showPairingModal,
  pairingTargetState,
  handlePairingClose,
  handlePairingDone,
  showDiagnosticsModal,
  diagnosticsTargetState,
  handleDiagnosticsClose,
  deriveChannelStatusBadges,
  getFeishuPairingModalSummary,
  getFeishuRuntimeSummaryAlertColor,
  getFeishuDiagnosticsModalTitle,
  getFeishuChannelDisplayName,
  repairFeishuPlugin,
}: ChannelsPageModalPropsOptions): ChannelsPageModalPropsResult {
  const configModalProps: ComponentProps<typeof ChannelsPageConfigModal> = {
    opened: showConfigModal,
    onClose: handleChannelConfigBack,
    configStep,
    selectedChannelId,
    selectedTarget: selectedConfigTarget,
    refreshTargetKey: configTargetState.targetKey,
    sharedStatusAlert: configTargetState.statusAlert,
    sharedStatusRepairing: configTargetState.repairing,
    canRepairSharedStatus: configTargetState.canRepair,
    statusPending: configTargetState.statusPending,
    missingAfterRefresh: configTargetState.missingAfterRefresh,
    blockedBySharedStatus: configTargetState.blockedBySharedStatus,
    refreshing: configTargetState.refreshingTargetChannel,
    onComplete: handleConfigDone,
    onSelectChannelId: setSelectedChannelId,
    onSelectTarget: setSelectedConfigTarget,
    onSetConfigStep: setConfigStep,
    onRepairSharedStatus: () => void repairFeishuPlugin(configTargetState.channel!, { surface: 'pairing' }),
    onRefreshMissing: () => void configTargetState.refreshTargetChannelStatus(configTargetState.targetKey),
  }

  const pairingModalProps: ComponentProps<typeof ChannelsPagePairingModal> = {
    opened: showPairingModal,
    channel: pairingTargetState.channel,
    targetKey: pairingTargetState.targetKey,
    sharedStatusAlert: pairingTargetState.statusAlert,
    sharedStatusRepairing: pairingTargetState.repairing,
    canRepairSharedStatus: pairingTargetState.canRepair,
    pending: pairingTargetState.statusPending,
    missing: pairingTargetState.missingAfterRefresh,
    blocked: pairingTargetState.blockedBySharedStatus,
    refreshing: pairingTargetState.refreshingTargetChannel,
    getBadges: deriveChannelStatusBadges,
    getSummary: getFeishuPairingModalSummary,
    getRuntimeSummaryColor: getFeishuRuntimeSummaryAlertColor,
    onClose: handlePairingClose,
    onRepairSharedStatus: () => void repairFeishuPlugin(pairingTargetState.channel!, { surface: 'pairing' }),
    onRefreshMissing: () => void pairingTargetState.refreshTargetChannelStatus(pairingTargetState.targetKey),
    onComplete: handlePairingDone,
  }

  const diagnosticsModalProps: ComponentProps<typeof ChannelsPageDiagnosticsModal> = {
    opened: showDiagnosticsModal,
    channel: diagnosticsTargetState.channel,
    fallbackChannel: diagnosticsTargetState.fallbackChannel,
    targetKey: diagnosticsTargetState.targetKey,
    pending: diagnosticsTargetState.statusPending,
    missing: diagnosticsTargetState.missingAfterRefresh,
    refreshing: diagnosticsTargetState.refreshingTargetChannel,
    sharedStatusAlert: diagnosticsTargetState.statusAlert,
    repairingSharedStatus: diagnosticsTargetState.repairing,
    canRepairSharedStatus: diagnosticsTargetState.canRepair,
    getTitle: getFeishuDiagnosticsModalTitle,
    getBotLabel: getFeishuChannelDisplayName,
    onClose: handleDiagnosticsClose,
    onRefreshMissing: () => void diagnosticsTargetState.refreshTargetChannelStatus(diagnosticsTargetState.targetKey),
    onRepairSharedStatus: () => repairFeishuPlugin(diagnosticsTargetState.channel!, { surface: 'diagnostics' }),
  }

  return {
    configModalProps,
    pairingModalProps,
    diagnosticsModalProps,
  }
}
