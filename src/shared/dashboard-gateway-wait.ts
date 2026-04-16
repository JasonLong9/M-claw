import { resolveEffectiveGatewayRunning } from './gateway-effective-running'
import { pollWithBackoff } from './polling'
import { UI_RUNTIME_DEFAULTS, type BackoffPollingPolicy } from './runtime-policies'

export interface DashboardGatewayHealthLike {
  running?: boolean
  summary?: string
  stderr?: string
  raw?: string
}

export async function waitForDashboardGatewayRunning(
  api: {
    gatewayHealth: () => Promise<DashboardGatewayHealthLike>
    getOpenClawRuntimeReconcileState?: () => Promise<any>
  },
  options: {
    policy?: BackoffPollingPolicy
  } = {}
): Promise<{ ok: true; health: DashboardGatewayHealthLike } | { ok: false; message: string }> {
  let lastHealth: DashboardGatewayHealthLike | null = null
  let lastRuntimeStore: any = null
  const readiness = await pollWithBackoff({
    policy: options.policy || UI_RUNTIME_DEFAULTS.gatewayReadiness.poll,
    execute: async () => {
      const [healthResult, runtimeResult] = await Promise.allSettled([
        api.gatewayHealth(),
        typeof api.getOpenClawRuntimeReconcileState === 'function'
          ? api.getOpenClawRuntimeReconcileState()
          : Promise.resolve(null),
      ])
      lastHealth =
        healthResult.status === 'fulfilled'
          ? healthResult.value
          : {
              running: false,
              summary: 'Gateway 尚未确认可用',
            }
      lastRuntimeStore = runtimeResult.status === 'fulfilled' ? runtimeResult.value : null
      return {
        health: lastHealth,
        runtimeStore: lastRuntimeStore,
      }
    },
    isSuccess: (value) =>
      resolveEffectiveGatewayRunning({
        healthRunning: value?.health?.running === true,
        runtimeStore: value?.runtimeStore || null,
      }),
  })

  if (readiness.ok && readiness.value?.health) {
    return {
      ok: true,
      health: readiness.value.health,
    }
  }

  const failedHealth = readiness.value?.health || lastHealth
  return {
    ok: false,
    message:
      String(failedHealth?.summary || '').trim() ||
      String(failedHealth?.stderr || '').trim() ||
      String(failedHealth?.raw || '').trim() ||
      'Gateway 尚未确认可用',
  }
}
