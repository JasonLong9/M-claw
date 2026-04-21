import type { ModelSelectOption } from '../pages/channels-page-model-options'
import FeishuModelConfigModalShell from './FeishuModelConfigModalShell'

interface ChannelsPageModelConfigModalChannel {
  name: string
  agentId?: string
}

interface ChannelsPageModelConfigModalProps {
  opened: boolean
  channel: ChannelsPageModelConfigModalChannel | null
  currentRuntimeModel?: string | null
  errorMessage?: string
  loading?: boolean
  modelOptions: ModelSelectOption[]
  selectedModelValue: string | null
  saving?: boolean
  onClose: () => void
  onChangeSelectedModel: (value: string | null) => void
  onSave: () => void
}

export default function ChannelsPageModelConfigModal({
  opened,
  channel,
  currentRuntimeModel = null,
  errorMessage = '',
  loading = false,
  modelOptions,
  selectedModelValue,
  saving = false,
  onClose,
  onChangeSelectedModel,
  onSave,
}: ChannelsPageModelConfigModalProps) {
  return (
    <FeishuModelConfigModalShell
      opened={opened}
      onClose={onClose}
      botName={channel?.name}
      agentId={channel?.agentId}
      currentRuntimeModel={currentRuntimeModel}
      errorMessage={errorMessage}
      loading={loading}
      modelOptions={modelOptions}
      selectedModelValue={selectedModelValue}
      saving={saving}
      onChangeModel={onChangeSelectedModel}
      onSave={onSave}
    />
  )
}
