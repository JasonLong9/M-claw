import type { OpenClawRuntimeReconcileStore } from './gateway-runtime-reconcile-state'

export interface ResolveEffectiveGatewayRunningInput {
  healthRunning?: boolean | null
  runtimeStore?: OpenClawRuntimeReconcileStore | null
}

// Legacy OpenClaw 2026.3.24 on Windows can finish the compat startup path while
// `gatewayHealth()` still reports false negatives. For renderer-side status cards,
// prefer the persisted runtime reconcile result when it explicitly says the gateway
// bootstrap completed or degraded into the known handshake-only compatibility mode.
export function resolveEffectiveGatewayRunning(
  input: ResolveEffectiveGatewayRunningInput
): boolean {
  if (input.healthRunning) return true

  const runtimeStore = input.runtimeStore
  const runtime = runtimeStore?.runtime
  if (!runtime) return false

  if (runtime.stateCode === 'ready') return true

  return (
    runtime.stateCode === 'degraded'
    && runtime.safeToRetry
    && (runtime.blockingReason === 'control_ui_handshake_failed' || runtime.blockingReason === 'service_generation_stale')
    && runtimeStore?.lastSeenVersionBand === 'openclaw_2026_3_23_to_2026_3_24'
  )
}
