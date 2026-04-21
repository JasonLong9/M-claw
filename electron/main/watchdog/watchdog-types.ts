export type {
  WatchdogEvent,
  WatchdogEventKind,
  WatchdogRecoveryAction,
  WatchdogState,
  WatchdogStateCode,
} from '../../../src/shared/watchdog'

export interface WatchdogThresholds {
  healthCheckIntervalMs: number
  healthCheckTimeoutMs: number
  maxConsecutiveFailures: number
  circuitOpenDurationMs: number
  maxRecoveryAttempts: number
  recoveryBackoffMs: number
}

export const DEFAULT_WATCHDOG_THRESHOLDS: WatchdogThresholds = {
  healthCheckIntervalMs: 10000,
  healthCheckTimeoutMs: 10000,
  maxConsecutiveFailures: 3,
  circuitOpenDurationMs: 60000,
  maxRecoveryAttempts: 5,
  recoveryBackoffMs: 3000,
}
