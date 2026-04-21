import { Alert, Button, Group, Text } from '@mantine/core'

interface ChannelsPageTopPanelProps {
  title: string
  description: string
  refreshLabel: string
  addChannelLabel: string
  refreshing?: boolean
  errorMessage?: string
  legacyFeishuAgentIds?: string[]
  onRefresh: () => void
  onAddChannel: () => void
  onDismissError: () => void
}

export default function ChannelsPageTopPanel({
  title,
  description,
  refreshLabel,
  addChannelLabel,
  refreshing = false,
  errorMessage = '',
  legacyFeishuAgentIds = [],
  onRefresh,
  onAddChannel,
  onDismissError,
}: ChannelsPageTopPanelProps) {
  return (
    <>
      <Group justify="space-between">
        <div>
          <Text size="xl" fw={700}>{title}</Text>
          <Text size="sm" c="dimmed" mt={4}>
            {description}
          </Text>
        </div>
        <Group gap="sm">
          <Button
            variant="default"
            onClick={onRefresh}
            loading={refreshing}
            size="md"
            className="cursor-pointer"
          >
            {refreshLabel}
          </Button>
          <Button
            onClick={onAddChannel}
            size="md"
            className="cursor-pointer"
          >
            {addChannelLabel}
          </Button>
        </Group>
      </Group>

      {errorMessage && (
        <Alert color="red" title="错误" onClose={onDismissError}>
          {errorMessage}
        </Alert>
      )}

      {legacyFeishuAgentIds.length > 0 && (
        <Alert color="yellow" title="发现遗留飞书代理">
          仍存在未匹配当前渠道配置的遗留飞书代理 ID：{legacyFeishuAgentIds.join(', ')}。为避免误编辑陈旧配置，Mclaw 已暂时在按机器人进入的模型配置入口中隐藏它们。
        </Alert>
      )}
    </>
  )
}
