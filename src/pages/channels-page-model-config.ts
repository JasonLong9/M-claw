import { useRef, useState } from 'react'

import {
  applyAgentPrimaryModelWithGatewayReload,
  extractPrimaryModelFromModelStatusPayload,
} from '../shared/model-config-gateway'
import { readOpenClawUpstreamModelState } from '../shared/upstream-model-state'
import {
  ensureModelSelectOption,
  loadReadyModelSelectOptions,
  type ModelSelectOption,
} from './channels-page-model-options'
import type {
  ChannelsPageModelConfigChannel,
  ChannelsPageModelConfigOptions,
  ChannelsPageModelConfigResult,
} from './channels-page-model-config-contract'

export function shouldReuseModelOptionsCache(options?: {
  forceRefresh?: boolean
  mode?: 'available' | 'all'
}): boolean {
  return !options?.forceRefresh && options?.mode !== 'all'
}

export function useChannelsPageModelConfig<Channel extends ChannelsPageModelConfigChannel>({
  fetchChannels,
  resolveLatestChannelSnapshot,
}: ChannelsPageModelConfigOptions<Channel>): ChannelsPageModelConfigResult<Channel> {
  const [showModelModal, setShowModelModal] = useState(false)
  const [selectedModelChannel, setSelectedModelChannel] = useState<Channel | null>(null)
  const [modelOptions, setModelOptions] = useState<ModelSelectOption[]>([])
  const [selectedModelValue, setSelectedModelValue] = useState<string | null>(null)
  const [currentRuntimeModel, setCurrentRuntimeModel] = useState('')
  const [modelModalError, setModelModalError] = useState('')
  const [loadingModelContext, setLoadingModelContext] = useState(false)
  const [savingModel, setSavingModel] = useState(false)
  const modelOptionsCacheRef = useRef<ModelSelectOption[]>([])

  const loadModelOptions = async (options?: {
    forceRefresh?: boolean
    mode?: 'available' | 'all'
    envVars?: Record<string, string> | null
    configData?: Record<string, any> | null
    statusData?: Record<string, any> | null
    preferredModelKey?: string
  }): Promise<ModelSelectOption[]> => {
    if (shouldReuseModelOptionsCache(options) && modelOptionsCacheRef.current.length > 0) {
      return modelOptionsCacheRef.current
    }

    const nextOptions = await loadReadyModelSelectOptions(window.api.listModelCatalog, {
      ...options,
      readUpstreamState: () => readOpenClawUpstreamModelState(),
    })
    modelOptionsCacheRef.current = nextOptions
    return nextOptions
  }

  const syncSelectedModelChannelSnapshot = (nextChannels: Channel[]) => {
    setSelectedModelChannel((current) => resolveLatestChannelSnapshot(nextChannels, current))
  }

  const closeModelModal = (options?: { force?: boolean }) => {
    if (savingModel && !options?.force) return
    setShowModelModal(false)
    setSelectedModelChannel(null)
    setModelOptions([])
    setSelectedModelValue(null)
    setCurrentRuntimeModel('')
    setModelModalError('')
    setLoadingModelContext(false)
  }

  const handleOpenModelConfig = async (channel: Channel) => {
    if (channel.channelId !== 'feishu' || !channel.agentId) return

    setSelectedModelChannel(channel)
    setShowModelModal(true)
    setModelModalError('')
    setLoadingModelContext(true)
    setCurrentRuntimeModel('')
    setSelectedModelValue(null)

    try {
      const [statusResult, envVars, configData] = await Promise.all([
        window.api.getModelStatus({ agentId: channel.agentId }),
        window.api.readEnvFile().catch(() => null),
        window.api.readConfig().catch(() => null),
      ])
      let nextOptions = modelOptionsCacheRef.current
      let nextRuntimeModel = ''
      const errors: string[] = []
      const statusData = statusResult.ok
        ? ((statusResult.data || null) as Record<string, any> | null)
        : null

      if (statusResult.ok) {
        nextRuntimeModel = extractPrimaryModelFromModelStatusPayload(statusData)
      } else {
        errors.push(statusResult.message || statusResult.stderr || 'Failed to load the current bot model status.')
      }

      try {
        nextOptions = await loadModelOptions({
          mode: 'all',
          envVars,
          configData,
          statusData,
          preferredModelKey: nextRuntimeModel,
        })
      } catch (reason) {
        errors.push(`Failed to load model options for this Feishu bot: ${reason instanceof Error ? reason.message : 'unknown error'}`)
      }

      if (!nextOptions.length) {
        errors.push('No models are available yet. Configure upstream model providers first, then reopen this Feishu bot model dialog.')
      }

      nextOptions = ensureModelSelectOption(nextOptions, nextRuntimeModel)
      setModelOptions(nextOptions)
      setCurrentRuntimeModel(nextRuntimeModel)
      setSelectedModelValue(nextRuntimeModel || nextOptions[0]?.value || null)
      setModelModalError(errors.join('; '))
    } finally {
      setLoadingModelContext(false)
    }
  }

  const handleSaveBotModel = async () => {
    if (!selectedModelChannel?.agentId) {
      setModelModalError('The current Feishu bot is missing an agent id, so the model cannot be configured.')
      return
    }

    const model = String(selectedModelValue || '').trim()
    if (!model) {
      setModelModalError('Select the model to bind to this Feishu bot.')
      return
    }

    setSavingModel(true)
    setModelModalError('')
    try {
      const result = await applyAgentPrimaryModelWithGatewayReload({
        agentId: selectedModelChannel.agentId,
        model,
        readConfig: () => window.api.readConfig(),
        applyUpstreamModelWrite: (request) => window.api.applyModelConfigViaUpstream(request),
        applyConfigPatchGuarded: (request) => window.api.applyConfigPatchGuarded(request),
        getModelStatus: () => window.api.getModelStatus({ agentId: selectedModelChannel.agentId }),
        reloadGatewayAfterModelChange: () => window.api.reloadGatewayAfterModelChange(),
      })

      if (!result.ok) {
        setModelModalError(result.message || 'Failed to save the Feishu bot model configuration.')
        return
      }

      closeModelModal({ force: true })
      await fetchChannels({ background: true })
    } catch (e) {
      setModelModalError(`Failed to save the Feishu bot model configuration: ${(e as Error).message}`)
    } finally {
      setSavingModel(false)
    }
  }

  return {
    showModelModal,
    selectedModelChannel,
    modelOptions,
    selectedModelValue,
    currentRuntimeModel,
    modelModalError,
    loadingModelContext,
    savingModel,
    setSelectedModelValue,
    closeModelModal,
    handleOpenModelConfig,
    handleSaveBotModel,
    syncSelectedModelChannelSnapshot,
  }
}
