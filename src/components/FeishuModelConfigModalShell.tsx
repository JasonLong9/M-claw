import { Modal } from '@mantine/core'

import type { ModelSelectOption } from '../pages/channels-page-model-options'
import FeishuModelConfigModalBody from './FeishuModelConfigModalBody'

interface FeishuModelConfigModalShellProps {
  opened: boolean
  onClose: () => void
  botName?: string | null
  agentId?: string
  currentRuntimeModel?: string | null
  errorMessage?: string
  loading?: boolean
  modelOptions: ModelSelectOption[]
  selectedModelValue: string | null
  saving?: boolean
  onChangeModel: (value: string | null) => void
  onSave: () => void
}

export default function FeishuModelConfigModalShell({
  opened,
  onClose,
  botName = null,
  agentId,
  currentRuntimeModel = null,
  errorMessage = '',
  loading = false,
  modelOptions,
  selectedModelValue,
  saving = false,
  onChangeModel,
  onSave,
}: FeishuModelConfigModalShellProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={botName ? `${botName} 模型配置` : '飞书机器人模型配置'}
      size="lg"
    >
      <FeishuModelConfigModalBody
        agentId={agentId}
        currentRuntimeModel={currentRuntimeModel}
        errorMessage={errorMessage}
        loading={loading}
        modelOptions={modelOptions}
        selectedModelValue={selectedModelValue}
        saving={saving}
        onChangeModel={onChangeModel}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  )
}
