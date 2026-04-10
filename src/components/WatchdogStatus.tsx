import { useEffect, useState, useCallback } from 'react'
import { Badge, Button, Group, Text, Alert, ActionIcon, Tooltip, Box } from '@mantine/core'
import { IconPlayerPlay, IconPlayerPause, IconRefresh, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import type { WatchdogState, WatchdogEvent } from '../shared/watchdog-types'
import LogViewer from './LogViewer'

function formatTime(timestamp: number | null): string {
  if (!timestamp) return '未记录'
  return new Date(timestamp).toLocaleString('zh-CN')
}

function getStateBadgeColor(stateCode: string): string {
  switch (stateCode) {
    case 'idle':
      return 'gray'
    case 'monitoring':
      return 'green'
    case 'recovering':
      return 'yellow'
    case 'circuit_open':
    case 'circuit_half_open':
      return 'red'
    case 'disabled':
      return 'gray'
    default:
      return 'gray'
  }
}

function getStateLabel(stateCode: string): string {
  switch (stateCode) {
    case 'idle':
      return '待机'
    case 'monitoring':
      return '监控中'
    case 'recovering':
      return '恢复中'
    case 'circuit_open':
      return '熔断已激活'
    case 'circuit_half_open':
      return '半熔断状态'
    case 'disabled':
      return '已禁用'
    default:
      return stateCode
  }
}

export default function WatchdogStatus() {
  const [isRunning, setIsRunning] = useState(false)
  const [state, setState] = useState<WatchdogState | null>(null)
  const [events, setEvents] = useState<WatchdogEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showEvents, setShowEvents] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      const [runningResult, stateResult, eventsResult] = await Promise.all([
        window.api.watchdogIsRunning(),
        window.api.watchdogGetState(),
        window.api.watchdogGetEvents(),
      ])
      setIsRunning(runningResult)
      setState(stateResult)
      setEvents(eventsResult as WatchdogEvent[])
    } catch (e) {
      console.error('刷新看门狗状态失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleStart = async () => {
    try {
      await window.api.watchdogStart()
      await refreshStatus()
    } catch (e) {
      console.error('启动看门狗失败:', e)
    }
  }

  const handleStop = async () => {
    try {
      await window.api.watchdogStop()
      await refreshStatus()
    } catch (e) {
      console.error('停止看门狗失败:', e)
    }
  }

  const handleReset = async () => {
    try {
      await window.api.watchdogReset()
      await refreshStatus()
    } catch (e) {
      console.error('重置看门狗失败:', e)
    }
  }

  useEffect(() => {
    refreshStatus()
    const interval = setInterval(refreshStatus, 3000)
    return () => clearInterval(interval)
  }, [refreshStatus])

  const eventsLog = events
    .map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString('zh-CN')
      return `[${time}] ${e.kind}: ${e.message}${e.detail ? `\n  详情: ${e.detail}` : ''}`
    })
    .join('\n')

  if (loading) {
    return (
      <div className="p-4">
        <Text size="sm" c="dimmed">加载中...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <Text size="sm" fw={600}>看门狗服务</Text>
          <Badge
            color={isRunning ? 'green' : 'gray'}
            variant="dot"
            size="sm"
          >
            {isRunning ? '运行中' : '已停止'}
          </Badge>
          {state && (
            <Badge
              color={getStateBadgeColor(state.stateCode)}
              variant="outline"
              size="sm"
            >
              {getStateLabel(state.stateCode)}
            </Badge>
          )}
        </Group>

        <Group gap="xs">
          {!isRunning ? (
            <Tooltip label="启动看门狗" withArrow>
              <ActionIcon
                color="green"
                variant="light"
                onClick={handleStart}
                size="sm"
              >
                <IconPlayerPlay size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="停止看门狗" withArrow>
              <ActionIcon
                color="orange"
                variant="light"
                onClick={handleStop}
                size="sm"
              >
                <IconPlayerPause size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="重置看门狗状态" withArrow>
            <ActionIcon
              variant="light"
              onClick={handleReset}
              size="sm"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {state && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <Text size="xs" c="dimmed">最后健康检查</Text>
            <Text size="xs">{formatTime(state.lastHealthCheckTime)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">最后健康时间</Text>
            <Text size="xs">{formatTime(state.lastHealthyTime)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">连续失败次数</Text>
            <Text size="xs">{state.consecutiveFailures}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">总恢复次数</Text>
            <Text size="xs">{state.totalRecoveries}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">总失败次数</Text>
            <Text size="xs">{state.totalFailures}</Text>
          </div>
          {state.circuitOpenUntil && (
            <div>
              <Text size="xs" c="dimmed">熔断结束时间</Text>
              <Text size="xs">{formatTime(state.circuitOpenUntil)}</Text>
            </div>
          )}
          {state.lastRecoveryTime && (
            <div>
              <Text size="xs" c="dimmed">最后恢复时间</Text>
              <Text size="xs">{formatTime(state.lastRecoveryTime)}</Text>
            </div>
          )}
          {state.lastRecoveryAction && (
            <div>
              <Text size="xs" c="dimmed">最后恢复动作</Text>
              <Text size="xs">{state.lastRecoveryAction}</Text>
            </div>
          )}
        </div>
      )}

      {state?.lastError && (
        <Alert
          color="orange"
          variant="light"
          icon={<IconAlertTriangle size={16} />}
          title="错误信息"
        >
          <Text size="xs">{state.lastError}</Text>
        </Alert>
      )}

      <Group justify="flex-start">
        <Button
          variant="light"
          size="xs"
          onClick={() => setShowEvents(!showEvents)}
        >
          {showEvents ? '隐藏事件日志' : '查看事件日志'}
        </Button>
      </Group>

      {showEvents && (
        <div>
          <LogViewer
            content={eventsLog || '暂无事件'}
            maxHeight="200px"
          />
        </div>
      )}

      {state?.stateCode === 'circuit_open' && (
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertTriangle size={16} />}
          title="熔断已激活"
        >
          <Text size="xs">
            看门狗检测到连续失败，已激活熔断保护。请检查网关状态，手动修复后可重置看门狗。
          </Text>
        </Alert>
      )}
    </div>
  )
}
