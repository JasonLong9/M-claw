import { useState } from 'react'

import type {
  ChannelsPageTargetModalChannel,
  ChannelsPageTargetModalsOptions,
  ChannelsPageTargetModalsResult,
} from './channels-page-target-modals-contract'
import type { ChannelPairingTargetRef } from './channels-page-utils'

export function useChannelsPageTargetModals<Channel extends ChannelsPageTargetModalChannel>({
  fetchChannels,
  resolveLatestChannelSnapshot,
}: ChannelsPageTargetModalsOptions<Channel>): ChannelsPageTargetModalsResult<Channel> {
  const [showPairingModal, setShowPairingModal] = useState(false)
  const [selectedPairingChannel, setSelectedPairingChannel] = useState<Channel | null>(null)
  const [selectedPairingTarget, setSelectedPairingTarget] = useState<ChannelPairingTargetRef | null>(null)
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false)
  const [selectedDiagnosticsChannel, setSelectedDiagnosticsChannel] = useState<Channel | null>(null)
  const [selectedDiagnosticsTarget, setSelectedDiagnosticsTarget] =
    useState<ChannelPairingTargetRef | null>(null)

  const syncSelectedTargetChannelSnapshots = (nextChannels: Channel[]) => {
    setSelectedPairingChannel((current) => resolveLatestChannelSnapshot(nextChannels, current))
    setSelectedDiagnosticsChannel((current) => resolveLatestChannelSnapshot(nextChannels, current))
  }

  const handleOpenPairing = (channel: Channel) => {
    if (!channel.pairingRequired) return
    setSelectedPairingChannel(channel)
    setSelectedPairingTarget({
      channelId: channel.channelId,
      accountId: channel.pairingAccountId,
    })
    setShowPairingModal(true)
  }

  const handlePairingClose = () => {
    setShowPairingModal(false)
    setSelectedPairingChannel(null)
    setSelectedPairingTarget(null)
  }

  const handlePairingDone = async () => {
    handlePairingClose()
    await fetchChannels({ background: true })
  }

  const handleOpenDiagnostics = (channel: Channel) => {
    if (channel.channelId !== 'feishu' || !channel.pairingAccountId) return
    setSelectedDiagnosticsChannel(channel)
    setSelectedDiagnosticsTarget({
      channelId: channel.channelId,
      accountId: channel.pairingAccountId,
    })
    setShowDiagnosticsModal(true)
  }

  const handleDiagnosticsClose = () => {
    setShowDiagnosticsModal(false)
    setSelectedDiagnosticsChannel(null)
    setSelectedDiagnosticsTarget(null)
  }

  return {
    showPairingModal,
    selectedPairingChannel,
    selectedPairingTarget,
    showDiagnosticsModal,
    selectedDiagnosticsChannel,
    selectedDiagnosticsTarget,
    syncSelectedTargetChannelSnapshots,
    handleOpenPairing,
    handlePairingClose,
    handlePairingDone,
    handleOpenDiagnostics,
    handleDiagnosticsClose,
  }
}
