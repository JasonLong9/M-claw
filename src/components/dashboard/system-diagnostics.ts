import type { WatchdogEvent, WatchdogState } from '../../shared/watchdog'

export interface DiagnosticSummaryRow {
  label: string
  value: string
}

export interface DiagnosticSummaryBadge {
  label: string
  value: string
  tone: 'gray' | 'teal' | 'yellow' | 'red'
}

function formatTimestamp(value: number | null | undefined): string {
  if (!value) return '未记录'
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatUnknown(value: unknown): string {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized || '空字符串'
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value == null) return '空值'

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function buildWatchdogBadges(
  state: WatchdogState | null | undefined,
  running: boolean
): DiagnosticSummaryBadge[] {
  const stateToneMap: Record<string, DiagnosticSummaryBadge['tone']> = {
    monitoring: 'teal',
    recovering: 'yellow',
    circuit_open: 'red',
    circuit_half_open: 'yellow',
    disabled: 'gray',
    idle: 'gray',
  }

  if (!state) {
    return [
      { label: 'Watchdog', value: running ? '运行中' : '未读取', tone: running ? 'yellow' : 'gray' },
    ]
  }

  return [
    {
      label: 'Watchdog',
      value: running ? '运行中' : '已停止',
      tone: running ? 'teal' : 'gray',
    },
    {
      label: '状态',
      value: state.stateCode,
      tone: stateToneMap[state.stateCode] || 'gray',
    },
    {
      label: '连续失败',
      value: String(state.consecutiveFailures),
      tone: state.consecutiveFailures > 0 ? 'yellow' : 'gray',
    },
    {
      label: '累计恢复',
      value: String(state.totalRecoveries),
      tone: state.totalRecoveries > 0 ? 'teal' : 'gray',
    },
  ]
}

export function buildWatchdogRows(
  state: WatchdogState | null | undefined
): DiagnosticSummaryRow[] {
  if (!state) return []

  return [
    { label: '最后健康检查', value: formatTimestamp(state.lastHealthCheckTime) },
    { label: '最后健康时刻', value: formatTimestamp(state.lastHealthyTime) },
    { label: '最后恢复时刻', value: formatTimestamp(state.lastRecoveryTime) },
    { label: '最后恢复动作', value: state.lastRecoveryAction || '未触发' },
    { label: '熔断截止', value: formatTimestamp(state.circuitOpenUntil) },
    { label: '累计失败', value: String(state.totalFailures) },
    { label: '最近错误', value: state.lastError || '无' },
  ]
}

export function formatWatchdogEvent(entry: WatchdogEvent): string {
  const parts = [
    entry.kind,
    entry.action ? `action=${entry.action}` : '',
    entry.stateCode ? `state=${entry.stateCode}` : '',
    entry.detail ? `detail=${entry.detail}` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

export function buildRedactedPreviewRows(
  record: Record<string, unknown> | null | undefined,
  limit = 6
): DiagnosticSummaryRow[] {
  if (!record || typeof record !== 'object') return []

  return Object.entries(record)
    .slice(0, Math.max(0, limit))
    .map(([label, value]) => ({
      label,
      value: formatUnknown(value),
    }))
}
