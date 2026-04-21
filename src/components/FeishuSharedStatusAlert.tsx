import { Alert, Button, Group, Stack, Text } from '@mantine/core'

export interface FeishuSharedStatusAlertState {
  color: 'yellow' | 'red'
  title: string
  message: string
}

interface FeishuSharedStatusAlertProps {
  alert: FeishuSharedStatusAlertState
  repairHint: string
  repairing?: boolean
  repairDisabled?: boolean
  onRepair?: (() => void) | null
}

export default function FeishuSharedStatusAlert({
  alert,
  repairHint,
  repairing = false,
  repairDisabled = false,
  onRepair = null,
}: FeishuSharedStatusAlertProps) {
  return (
    <Alert color={alert.color} variant="light" title={alert.title}>
      <Stack gap="xs">
        <Text size="sm">{alert.message}</Text>
        {onRepair && (
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              {repairHint}
            </Text>
            <Button
              size="xs"
              variant="light"
              color={alert.color}
              loading={repairing}
              disabled={repairDisabled}
              onClick={onRepair}
            >
              修复飞书插件
            </Button>
          </Group>
        )}
      </Stack>
    </Alert>
  )
}
