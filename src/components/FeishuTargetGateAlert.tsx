import { Alert, Button, Group, Loader, Text } from '@mantine/core'

export type FeishuTargetGateSurface = 'config-pairing' | 'pairing-modal' | 'diagnostics'
export type FeishuTargetGateState = 'pending' | 'missing' | 'blocked'

interface FeishuTargetGateAlertCopy {
  color: 'blue' | 'yellow'
  title: string
  message: string
  detail?: string
  secondaryLabel?: string
}

interface FeishuTargetGateAlertProps {
  state: FeishuTargetGateState
  surface: FeishuTargetGateSurface
  refreshing?: boolean
  onRefresh?: (() => void) | null
  onSecondaryAction?: (() => void) | null
}

export function getFeishuTargetGateAlertCopy(
  state: FeishuTargetGateState,
  surface: FeishuTargetGateSurface
): FeishuTargetGateAlertCopy {
  if (state === 'pending') {
    return {
      color: 'blue',
      title: '正在检查飞书运行时状态',
      message:
        surface === 'diagnostics'
          ? 'Mclaw 正在刷新飞书共享运行时状态，完成后再打开诊断。'
          : 'Mclaw 正在刷新飞书共享运行时状态，完成后再打开配对表单。',
    }
  }

  if (state === 'blocked') {
    return {
      color: 'yellow',
      title: '配对已阻塞',
      message:
        '请先修复共享飞书运行时。共享状态刷新完成且阻塞解除后，配对表单会自动在这里恢复。',
    }
  }

  if (surface === 'config-pairing') {
    return {
      color: 'yellow',
      title: '暂未找到刚接入的机器人',
      message:
        'Mclaw 已刷新渠道列表，但在最新共享状态里仍然没有找到这个飞书机器人。',
      detail: '你可以在这里重试刷新共享状态，或先回到接入步骤再继续配对。',
      secondaryLabel: '返回接入步骤',
    }
  }

  if (surface === 'diagnostics') {
    return {
      color: 'yellow',
      title: '已选机器人不存在了',
      message:
        'Mclaw 已刷新渠道列表，但这个飞书机器人已经不再出现在最新共享状态中。',
      detail: '你可以在这里重试刷新共享状态，或关闭诊断后返回渠道列表。',
      secondaryLabel: '关闭诊断',
    }
  }

  return {
    color: 'yellow',
    title: '已选机器人不存在了',
    message:
      'Mclaw 已刷新渠道列表，但这个飞书机器人已经不再出现在最新共享状态中。',
    detail: '你可以在这里重试刷新共享状态，或关闭这个配对窗口后返回渠道列表。',
    secondaryLabel: '关闭配对',
  }
}

export default function FeishuTargetGateAlert({
  state,
  surface,
  refreshing = false,
  onRefresh = null,
  onSecondaryAction = null,
}: FeishuTargetGateAlertProps) {
  const copy = getFeishuTargetGateAlertCopy(state, surface)

  if (state === 'pending') {
    return (
      <Alert color={copy.color} variant="light" title={copy.title}>
        <Group gap="xs" align="center">
          <Loader size="sm" />
          <Text size="sm">{copy.message}</Text>
        </Group>
      </Alert>
    )
  }

  if (state === 'blocked') {
    return (
      <Alert color={copy.color} variant="light" title={copy.title}>
        {copy.message}
      </Alert>
    )
  }

  return (
    <Alert color={copy.color} variant="light" title={copy.title}>
      <div className="space-y-3">
        <Text size="sm">{copy.message}</Text>
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            {copy.detail}
          </Text>
          <Group gap="xs">
            {onRefresh && (
              <Button size="xs" variant="light" loading={refreshing} onClick={onRefresh}>
                刷新机器人状态
              </Button>
            )}
            {onSecondaryAction && copy.secondaryLabel && (
              <Button size="xs" variant="subtle" color="gray" onClick={onSecondaryAction}>
                {copy.secondaryLabel}
              </Button>
            )}
          </Group>
        </Group>
      </div>
    </Alert>
  )
}
