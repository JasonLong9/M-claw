import { describe, expect, it, vi } from 'vitest'
import { createDefaultOpenClawRuntimeReconcileStore } from '../../shared/gateway-runtime-reconcile-state'
import { waitForDashboardGatewayRunning } from '../../shared/dashboard-gateway-wait'

const FAST_POLL_POLICY = {
  timeoutMs: 50,
  initialIntervalMs: 1,
  maxIntervalMs: 1,
  backoffFactor: 1,
} as const

describe('waitForDashboardGatewayRunning', () => {
  it('waits until gateway health reports running', async () => {
    const gatewayHealth = vi
      .fn()
      .mockResolvedValueOnce({ running: false, summary: 'starting' })
      .mockResolvedValueOnce({ running: false, summary: 'recovering' })
      .mockResolvedValueOnce({ running: true, summary: 'Gateway ready' })

    const result = await waitForDashboardGatewayRunning(
      { gatewayHealth },
      { policy: FAST_POLL_POLICY }
    )

    expect(result).toEqual({
      ok: true,
      health: {
        running: true,
        summary: 'Gateway ready',
      },
    })
    expect(gatewayHealth).toHaveBeenCalledTimes(3)
  })

  it('accepts the audited legacy compatibility path when health is stale but runtime reconcile stays green', async () => {
    const runtimeStore = createDefaultOpenClawRuntimeReconcileStore()
    runtimeStore.lastSeenVersionBand = 'openclaw_2026_3_23_to_2026_3_24'
    runtimeStore.runtime.stateCode = 'degraded'
    runtimeStore.runtime.safeToRetry = true
    runtimeStore.runtime.blockingReason = 'control_ui_handshake_failed'
    runtimeStore.runtime.lastReconcileSummary = 'compat runtime confirmed'

    const gatewayHealth = vi.fn().mockResolvedValue({
      running: false,
      summary: 'Gateway health stale',
    })
    const getOpenClawRuntimeReconcileState = vi.fn().mockResolvedValue(runtimeStore)

    const result = await waitForDashboardGatewayRunning(
      {
        gatewayHealth,
        getOpenClawRuntimeReconcileState,
      },
      { policy: FAST_POLL_POLICY }
    )

    expect(result).toEqual({
      ok: true,
      health: {
        running: false,
        summary: 'Gateway health stale',
      },
    })
  })

  it('returns the last health summary when readiness times out', async () => {
    const gatewayHealth = vi.fn().mockResolvedValue({ running: false, summary: 'Gateway still recovering' })

    const result = await waitForDashboardGatewayRunning(
      { gatewayHealth },
      { policy: FAST_POLL_POLICY }
    )

    expect(result).toEqual({
      ok: false,
      message: 'Gateway still recovering',
    })
  })
})
