import {
  DEFAULT_WATCHDOG_THRESHOLDS,
  type WatchdogThresholds,
  type WatchdogState,
} from './watchdog-types'
import {
  getWatchdogState,
  setWatchdogState,
  addEvent,
  getEventHistory,
  resetWatchdogState,
  onStateChange,
  onEvent,
} from './watchdog-state'
import { performHealthCheck, type HealthCheckResult } from './watchdog-health-sensing'
import { attemptRecovery, getRecoveryActionSequence } from './watchdog-self-healing'
import {
  shouldOpenCircuit,
  shouldCloseCircuit,
  openCircuit,
  closeCircuit,
  isCircuitOpen,
} from './watchdog-circuit-breaker'

let healthCheckTimer: NodeJS.Timeout | null = null
let thresholds: WatchdogThresholds = { ...DEFAULT_WATCHDOG_THRESHOLDS }
let recoveryAttemptIndex = 0
let isRunning = false

export function startWatchdog(customThresholds?: Partial<WatchdogThresholds>): void {
  if (isRunning) {
    return
  }

  thresholds = { ...DEFAULT_WATCHDOG_THRESHOLDS, ...customThresholds }
  isRunning = true
  recoveryAttemptIndex = 0

  setWatchdogState({
    stateCode: 'monitoring',
  })

  addEvent('watchdog_started', 'Watchdog started monitoring')

  scheduleNextHealthCheck()
}

export function stopWatchdog(): void {
  if (!isRunning) {
    return
  }

  isRunning = false

  if (healthCheckTimer) {
    clearTimeout(healthCheckTimer)
    healthCheckTimer = null
  }

  setWatchdogState({
    stateCode: 'idle',
  })

  addEvent('watchdog_stopped', 'Watchdog stopped monitoring')
}

export function isWatchdogRunning(): boolean {
  return isRunning
}

export function getThresholds(): WatchdogThresholds {
  return { ...thresholds }
}

export function updateThresholds(customThresholds: Partial<WatchdogThresholds>): void {
  thresholds = { ...thresholds, ...customThresholds }
}

function scheduleNextHealthCheck(): void {
  if (!isRunning) return

  healthCheckTimer = setTimeout(() => {
    void runHealthCheckLoop()
  }, thresholds.healthCheckIntervalMs)
}

async function runHealthCheckLoop(): Promise<void> {
  if (!isRunning) return

  const state = getWatchdogState()

  if (state.stateCode === 'circuit_open') {
    if (shouldCloseCircuit(state)) {
      closeCircuit()
    } else {
      scheduleNextHealthCheck()
      return
    }
  }

  const healthResult = await performHealthCheck(thresholds)
  await handleHealthCheckResult(healthResult)

  scheduleNextHealthCheck()
}

async function handleHealthCheckResult(result: HealthCheckResult): Promise<void> {
  const state = getWatchdogState()

  setWatchdogState({
    lastHealthCheckTime: result.timestamp,
  })

  if (result.ok) {
    handleHealthSuccess(result)
  } else {
    await handleHealthFailure(result)
  }
}

function handleHealthSuccess(result: HealthCheckResult): void {
  const state = getWatchdogState()

  setWatchdogState({
    lastHealthyTime: result.timestamp,
    consecutiveFailures: 0,
    stateCode: 'monitoring',
    lastError: undefined,
  })

  addEvent('health_check_success', 'Gateway health check passed', {
    action: 'health_check',
    detail: result.result?.summary,
  })

  recoveryAttemptIndex = 0
}

async function handleHealthFailure(result: HealthCheckResult): Promise<void> {
  const state = getWatchdogState()
  const newConsecutiveFailures = state.consecutiveFailures + 1

  setWatchdogState({
    consecutiveFailures: newConsecutiveFailures,
    totalFailures: state.totalFailures + 1,
    lastError: result.error?.message || result.result?.summary,
  })

  addEvent('health_check_failure', 'Gateway health check failed', {
    action: 'health_check',
    detail: result.error?.message || result.result?.summary,
  })

  const updatedState = getWatchdogState()
  const shouldDeferInitialRecovery =
    updatedState.lastHealthyTime === null &&
    newConsecutiveFailures < 2

  // On app/dashboard entry the gateway may still be settling for a short moment.
  // Deferring the very first recovery avoids false-positive restarts that make
  // the OpenClaw terminal disappear and relaunch shortly after startup.
  if (shouldDeferInitialRecovery) {
    setWatchdogState({
      stateCode: 'monitoring',
    })
    return
  }

  if (shouldOpenCircuit(updatedState, thresholds)) {
    openCircuit(thresholds, `Consecutive failures reached ${thresholds.maxConsecutiveFailures}`)
    return
  }

  await attemptRecoverySequence()
}

async function attemptRecoverySequence(): Promise<void> {
  const state = getWatchdogState()
  const recoveryActions = getRecoveryActionSequence()

  if (recoveryAttemptIndex >= recoveryActions.length) {
    recoveryAttemptIndex = 0
    return
  }

  setWatchdogState({
    stateCode: 'recovering',
  })

  const action = recoveryActions[recoveryAttemptIndex]

  addEvent('recovery_started', `Starting recovery action: ${action}`, {
    action,
  })

  const recoveryResult = await attemptRecovery(action)

  setWatchdogState({
    lastRecoveryTime: Date.now(),
    lastRecoveryAction: action,
  })

  if (recoveryResult.ok) {
    addEvent('recovery_verify_started', `Verifying recovery action ${action}...`, {
      action,
    })

    await new Promise(resolve => setTimeout(resolve, 2000))

    const verifyResult = await performHealthCheck(thresholds)

    if (verifyResult.ok) {
      setWatchdogState({
        stateCode: 'monitoring',
        totalRecoveries: state.totalRecoveries + 1,
        lastHealthyTime: verifyResult.timestamp,
        consecutiveFailures: 0,
        lastError: undefined,
      })

      addEvent('recovery_succeeded', `Recovery action ${action} succeeded and verified`, {
        action,
      })

      addEvent('health_check_success', 'Post-recovery health check passed', {
        action: 'health_check',
        detail: verifyResult.result?.summary,
      })

      recoveryAttemptIndex = 0
    } else {
      setWatchdogState({
        consecutiveFailures: 1,
        totalFailures: state.totalFailures + 1,
        lastError: verifyResult.error?.message || verifyResult.result?.summary,
      })

      addEvent('recovery_verify_failed', `Recovery action ${action} verification failed`, {
        action,
        detail: verifyResult.error?.message || verifyResult.result?.summary,
      })

      addEvent('health_check_failure', 'Post-recovery health check failed', {
        action: 'health_check',
        detail: verifyResult.error?.message || verifyResult.result?.summary,
      })

      recoveryAttemptIndex++
    }
  } else {
    addEvent('recovery_failed', `Recovery action ${action} failed: ${recoveryResult.message}`, {
      action,
      detail: recoveryResult.detail,
    })

    recoveryAttemptIndex++
  }
}

export {
  getWatchdogState,
  getEventHistory,
  resetWatchdogState,
  onStateChange,
  onEvent,
  type WatchdogState,
}
