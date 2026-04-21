import { Alert, Text } from '@mantine/core'

import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'

interface FeishuChannelCardMetaProps {
  provisionDescription: string
  showProvisionConfirmation?: boolean
  runtimeSummary?: string
  sharedStatusAlert?: FeishuSharedStatusAlertState | null
}

export default function FeishuChannelCardMeta({
  provisionDescription,
  showProvisionConfirmation = false,
  runtimeSummary,
  sharedStatusAlert,
}: FeishuChannelCardMetaProps) {
  return (
    <>
      <Text size="xs" c="dimmed" mt={6}>
        {provisionDescription}
      </Text>
      {showProvisionConfirmation && (
        <Alert color="yellow" variant="light" mt="sm" title="接入来源待确认">
          该飞书机器人来自较早的配置或旧版本应用。Mclaw 已确认它当前已连接，但暂时还无法判断它最初是通过“创建机器人”还是“关联已有机器人”接入的。
        </Alert>
      )}
      {runtimeSummary && (
        <Text size="xs" c="dimmed" mt={6}>
          运行时状态：{runtimeSummary}
        </Text>
      )}
      {sharedStatusAlert && (
        <Alert color={sharedStatusAlert.color} variant="light" mt="sm" title={sharedStatusAlert.title}>
          {sharedStatusAlert.message}
        </Alert>
      )}
    </>
  )
}
