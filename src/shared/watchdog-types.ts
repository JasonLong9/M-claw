export type WatchdogStateCode =
  | 'idle'
  | 'monitoring'
  | 'recovering'
  | 'circuit_open'
  | 'circuit_half_open'
  | 'disabled'

export type WatchdogRecoveryAction =
  | 'health_check'
  | 'restart_gateway'
  | 'stop_gateway'
  | 'migrate_port'
  | 'run_doctor'

export type WatchdogEventKind =
  | 'health_check_success'
  | 'health_check_failure'
  | 'process_exit_detected'
  | 'recovery_started'
  | 'recovery_succeeded'
  | 'recovery_failed'
  | 'circuit_opened'
  | 'circuit_closed'
  | 'watchdog_started'
  | 'watchdog_stopped'

export interface WatchdogEvent {
  id: string
  timestamp: number
  kind: WatchdogEventKind
  action?: WatchdogRecoveryAction
  message: string
  detail?: string
  stateCode?: WatchdogStateCode
}

export interface WatchdogState {
  stateCode: WatchdogStateCode
  lastHealthCheckTime: number | null
  lastHealthyTime: number | null
  consecutiveFailures: number
  totalRecoveries: number
  totalFailures: number
  circuitOpenUntil: number | null
  lastRecoveryTime: number | null
  lastRecoveryAction?: WatchdogRecoveryAction
  lastError?: string
}

export interface WatchdogThresholds {
  healthCheckIntervalMs: number
  healthCheckTimeoutMs: number
  maxConsecutiveFailures: number
  circuitOpenDurationMs: number
  maxRecoveryAttempts: number
  recoveryBackoffMs: number
}

export const DEFAULT_WATCHDOG_THRESHOLDS: WatchdogThresholds = {
  healthCheckIntervalMs: 5000,
  healthCheckTimeoutMs: 10000,
  maxConsecutiveFailures: 3,
  circuitOpenDurationMs: 60000,
  maxRecoveryAttempts: 5,
  recoveryBackoffMs: 3000,
}
