import type { GatewayHealthCheckResult } from '../cli'
import { gatewayHealth } from '../cli'
import type { WatchdogThresholds } from './watchdog-types'

export interface HealthCheckResult {
  ok: boolean
  result: GatewayHealthCheckResult | null
  error?: Error
  timestamp: number
}

export async function performHealthCheck(
  thresholds: WatchdogThresholds
): Promise<HealthCheckResult> {
  const timestamp = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      thresholds.healthCheckTimeoutMs
    )

    const result = await gatewayHealth()

    clearTimeout(timeoutId)

    return {
      ok: Boolean(result.running),
      result,
      timestamp,
    }
  } catch (error) {
    return {
      ok: false,
      result: null,
      error: error instanceof Error ? error : new Error(String(error)),
      timestamp,
    }
  }
}
