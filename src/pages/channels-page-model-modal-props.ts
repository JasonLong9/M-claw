import type { ComponentProps } from 'react'

import ChannelsPageModelConfigModal from '../components/ChannelsPageModelConfigModal'
import type {
  ChannelsPageModelModalPropsOptions,
  ChannelsPageModelModalPropsResult,
} from './channels-page-model-modal-props-contract'

export function useChannelsPageModelModalProps({
  showModelModal,
  selectedModelChannel,
  closeModelModal,
  currentRuntimeModel,
  modelModalError,
  loadingModelContext,
  modelOptions,
  selectedModelValue,
  savingModel,
  setSelectedModelValue,
  handleSaveBotModel,
}: ChannelsPageModelModalPropsOptions): ChannelsPageModelModalPropsResult {
  const modelConfigModalProps: ComponentProps<typeof ChannelsPageModelConfigModal> = {
    opened: showModelModal,
    channel: selectedModelChannel,
    onClose: closeModelModal,
    currentRuntimeModel,
    errorMessage: modelModalError,
    loading: loadingModelContext,
    modelOptions,
    selectedModelValue,
    saving: savingModel,
    onChangeSelectedModel: setSelectedModelValue,
    onSave: () => void handleSaveBotModel(),
  }

  return {
    modelConfigModalProps,
  }
}
