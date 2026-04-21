import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../cli', () => ({
  gatewayHealth: vi.fn().mockResolvedValue({
    running: true,
    raw: '',
    stderr: '',
    code: 0,
    summary: 'ok',
  }),
}))

vi.mock('../gateway-lifecycle-controller', () => ({
  ensureGatewayReady: vi.fn().mockResolvedValue({
    ok: true,
    running: true,
    stdout: '',
    stderr: '',
    summary: 'ok',
  }),
  reloadGatewayForConfigChange: vi.fn().mockResolvedValue({
    ok: true,
    running: true,
    stdout: '',
    stderr: '',
    summary: 'ok',
  }),
}))

import {
  getEventHistory,
  getWatchdogState,
  isWatchdogRunning,
  resetWatchdogState,
  startWatchdog,
  stopWatchdog,
} from '../watchdog'

describe('WatchdogService', () => {
  beforeEach(() => {
    resetWatchdogState()
  })

  afterEach(() => {
    stopWatchdog()
  })

  it('starts and stops correctly', () => {
    expect(isWatchdogRunning()).toBe(false)

    startWatchdog()
    expect(isWatchdogRunning()).toBe(true)
    expect(getWatchdogState().stateCode).toBe('monitoring')

    stopWatchdog()
    expect(isWatchdogRunning()).toBe(false)
    expect(getWatchdogState().stateCode).toBe('idle')
  })

  it('records start and stop events', () => {
    startWatchdog()
    stopWatchdog()

    const events = getEventHistory()
    expect(events.some((event) => event.kind === 'watchdog_started')).toBe(true)
    expect(events.some((event) => event.kind === 'watchdog_stopped')).toBe(true)
  })

  it('does not start twice', () => {
    startWatchdog()
    startWatchdog()

    const startEvents = getEventHistory().filter((event) => event.kind === 'watchdog_started')
    expect(startEvents).toHaveLength(1)
  })
})
