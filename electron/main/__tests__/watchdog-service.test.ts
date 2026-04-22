import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  gatewayHealthMock,
  ensureGatewayReadyMock,
  reloadGatewayForConfigChangeMock,
} = vi.hoisted(() => ({
  gatewayHealthMock: vi.fn(),
  ensureGatewayReadyMock: vi.fn(),
  reloadGatewayForConfigChangeMock: vi.fn(),
}))

vi.mock('../cli', () => ({
  gatewayHealth: gatewayHealthMock,
}))

vi.mock('../gateway-lifecycle-controller', () => ({
  ensureGatewayReady: ensureGatewayReadyMock,
  reloadGatewayForConfigChange: reloadGatewayForConfigChangeMock,
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
    vi.useFakeTimers()
    resetWatchdogState()
    gatewayHealthMock.mockReset()
    ensureGatewayReadyMock.mockReset()
    reloadGatewayForConfigChangeMock.mockReset()

    gatewayHealthMock.mockResolvedValue({
      running: true,
      raw: '',
      stderr: '',
      code: 0,
      summary: 'ok',
    })
    ensureGatewayReadyMock.mockResolvedValue({
      ok: true,
      running: true,
      stdout: '',
      stderr: '',
      summary: 'ok',
    })
    reloadGatewayForConfigChangeMock.mockResolvedValue({
      ok: true,
      running: true,
      stdout: '',
      stderr: '',
      summary: 'ok',
    })
  })

  afterEach(() => {
    stopWatchdog()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
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

  it('does not restart the gateway on the very first startup health-check failure', async () => {
    gatewayHealthMock
      .mockResolvedValueOnce({
        running: false,
        raw: '',
        stderr: 'gateway booting',
        code: 1,
        summary: 'gateway booting',
      })
      .mockResolvedValue({
        running: true,
        raw: '',
        stderr: '',
        code: 0,
        summary: 'ok',
      })

    startWatchdog({
      healthCheckIntervalMs: 10,
      healthCheckTimeoutMs: 10,
    })

    await vi.advanceTimersByTimeAsync(12)
    await Promise.resolve()

    expect(reloadGatewayForConfigChangeMock).not.toHaveBeenCalled()
    expect(getWatchdogState().consecutiveFailures).toBe(1)

    await vi.advanceTimersByTimeAsync(12)
    await Promise.resolve()

    expect(getWatchdogState().stateCode).toBe('monitoring')
    expect(getWatchdogState().consecutiveFailures).toBe(0)
  })
})
