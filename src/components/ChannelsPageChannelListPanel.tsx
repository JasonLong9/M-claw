import type { ReactNode } from 'react'
import { Card, ScrollArea, Text } from '@mantine/core'

interface ChannelsPageChannelListPanelProps {
  hasChannels: boolean
  emptyMessage: string
  children?: ReactNode
}

export default function ChannelsPageChannelListPanel({
  hasChannels,
  emptyMessage,
  children,
}: ChannelsPageChannelListPanelProps) {
  return (
    <ScrollArea h="calc(100vh - 200px)">
      <div className="space-y-4">
        {hasChannels ? children : (
          <Card padding="xl" withBorder className="text-center">
            <Text size="sm" c="dimmed">
              {emptyMessage}
            </Text>
          </Card>
        )}
      </div>
    </ScrollArea>
  )
}
