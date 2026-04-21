import { useState } from 'react'

import type {
  ChannelsPageConfigFlowOptions,
  ChannelsPageConfigFlowResult,
} from './channels-page-config-flow-contract'
import type { ChannelPairingTarget, ChannelsConfigStep } from './channels-page-utils'

export function useChannelsPageConfigFlow({
  fetchChannels,
}: ChannelsPageConfigFlowOptions): ChannelsPageConfigFlowResult {
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [selectedConfigTarget, setSelectedConfigTarget] = useState<ChannelPairingTarget | null>(null)
  const [configStep, setConfigStep] = useState<ChannelsConfigStep>('channel-connect')

  const resetConfigFlow = () => {
    setShowConfigModal(false)
    setSelectedChannelId(null)
    setSelectedConfigTarget(null)
    setConfigStep('channel-connect')
  }

  const handleOpenAddChannel = () => {
    setSelectedChannelId(null)
    setSelectedConfigTarget(null)
    setConfigStep('channel-connect')
    setShowConfigModal(true)
  }

  const handleChannelConfigBack = () => {
    resetConfigFlow()
  }

  const handleConfigDone = async () => {
    resetConfigFlow()
    await fetchChannels({ background: true })
  }

  return {
    showConfigModal,
    selectedChannelId,
    selectedConfigTarget,
    configStep,
    setSelectedChannelId,
    setSelectedConfigTarget,
    setConfigStep,
    handleOpenAddChannel,
    handleChannelConfigBack,
    handleConfigDone,
  }
}
