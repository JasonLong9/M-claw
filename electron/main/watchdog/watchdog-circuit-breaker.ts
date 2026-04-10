import type { WatchdogState, WatchdogThresholds } from './watchdog-types'
import { getWatchdogState, setWatchdogState, addEvent } from './watchdog-state'

export function shouldOpenCircuit(
  state: WatchdogState,
  thresholds: WatchdogThresholds
): boolean {
  return state.consecutiveFailures >= thresholds.maxConsecutiveFailures
}

export function shouldCloseCircuit(
  state: WatchdogState,
  now: number = Date.now()
): boolean {
  if (state.circuitOpenUntil === null) return false
  return now >= state.circuitOpenUntil
}

export function openCircuit(
  thresholds: WatchdogThresholds,
  reason: string
): void {
  const state = getWatchdogState()
  const now = Date.now()

  setWatchdogState({
    stateCode: 'circuit_open',
    circuitOpenUntil: now + thresholds.circuitOpenDurationMs,
    lastError: reason,
  })

  addEvent('circuit_opened', `Circuit opened: ${reason}`, {
    detail: `Will remain open until ${new Date(now + thresholds.circuitOpenDurationMs).toISOString()}`,
  })
}

export function closeCircuit(): void {
  const state = getWatchdogState()

  setWatchdogState({
    stateCode: 'monitoring',
    circuitOpenUntil: null,
    consecutiveFailures: 0,
  })

  addEvent('circuit_closed', 'Circuit closed, resuming monitoring')
}

export function transitionToHalfOpen(): void {
  setWatchdogState({
    stateCode: 'circuit_half_open',
  })
}

export function isCircuitOpen(): boolean {
  const state = getWatchdogState()
  return state.stateCode === 'circuit_open'
}
