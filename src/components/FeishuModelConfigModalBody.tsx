import { Alert, Button, Group, Loader, Select, Text } from '@mantine/core'

import type { ModelSelectOption } from '../pages/channels-page-model-options'

interface FeishuModelConfigModalBodyProps {
  agentId?: string
  currentRuntimeModel?: string | null
  errorMessage?: string
  loading?: boolean
  modelOptions: ModelSelectOption[]
  selectedModelValue: string | null
  saving?: boolean
  onChangeModel: (value: string | null) => void
  onClose: () => void
  onSave: () => void
}

export default function FeishuModelConfigModalBody({
  agentId,
  currentRuntimeModel = null,
  errorMessage = '',
  loading = false,
  modelOptions,
  selectedModelValue,
  saving = false,
  onChangeModel,
  onClose,
  onSave,
}: FeishuModelConfigModalBodyProps) {
  return (
    <div className="space-y-4">
      {agentId && (
        <Text size="sm" c="dimmed">
          代理：{agentId}
        </Text>
      )}

      {currentRuntimeModel && (
        <Alert color="blue" variant="light" title="当前运行时模型">
          {currentRuntimeModel}
        </Alert>
      )}

      {errorMessage && (
        <Alert color="red" variant="light" title="模型配置说明">
          {errorMessage}
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader size="md" />
        </div>
      ) : (
        <Select
          label="主模型"
          placeholder="选择绑定到这个飞书机器人的模型"
          data={modelOptions}
          value={selectedModelValue}
          onChange={onChangeModel}
          searchable
          nothingFoundMessage="没有匹配模型"
        />
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={saving}>
          取消
        </Button>
        <Button onClick={onSave} loading={saving} disabled={loading}>
          保存
        </Button>
      </Group>
    </div>
  )
}
