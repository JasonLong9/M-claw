import { describe, expect, it } from 'vitest'
import {
  buildRedactedPreviewRows,
  buildWatchdogBadges,
  buildWatchdogRows,
  formatWatchdogEvent,
} from './system-diagnostics'

describe('system diagnostics helpers', () => {
  it('builds watchdog badges and rows from a watchdog state snapshot', () => {
    const state = {
      stateCode: 'recovering',
      lastHealthCheckTime: 1710000000000,
      lastHealthyTime: 1710000005000,
      consecutiveFailures: 2,
      totalRecoveries: 3,
      totalFailures: 4,
      circuitOpenUntil: null,
      lastRecoveryTime: 1710000010000,
      lastRecoveryAction: 'restart_gateway',
      lastError: 'gateway timeout',
    } as const

    expect(buildWatchdogBadges(state, true)).toEqual([
      { label: 'Watchdog', value: '运行中', tone: 'teal' },
      { label: '状态', value: 'recovering', tone: 'yellow' },
      { label: '连续失败', value: '2', tone: 'yellow' },
      { label: '累计恢复', value: '3', tone: 'teal' },
    ])

    expect(buildWatchdogRows(state)).toEqual(
      expect.arrayContaining([
        { label: '最后恢复动作', value: 'restart_gateway' },
        { label: '累计失败', value: '4' },
        { label: '最近错误', value: 'gateway timeout' },
      ])
    )
  })

  it('formats watchdog event metadata into a compact label', () => {
    expect(formatWatchdogEvent({
      id: 'event-1',
      timestamp: 1710000000000,
      kind: 'recovery_failed',
      action: 'run_doctor',
      message: 'recovery failed',
      detail: 'doctor returned code 1',
      stateCode: 'recovering',
    })).toBe('recovery_failed · action=run_doctor · state=recovering · detail=doctor returned code 1')
  })

  it('builds compact redacted snapshot preview rows', () => {
    expect(buildRedactedPreviewRows({
      OPENAI_API_KEY: '[REDACTED]',
      channels: {
        feishu: {
          enabled: true,
        },
      },
      emptyString: '',
    }, 3)).toEqual([
      { label: 'OPENAI_API_KEY', value: '[REDACTED]' },
      { label: 'channels', value: '{"feishu":{"enabled":true}}' },
      { label: 'emptyString', value: '空字符串' },
    ])
  })
})
