import { ensureGatewayReady, reloadGatewayForConfigChange } from '../gateway-lifecycle-controller'
import type { WatchdogRecoveryAction } from './watchdog-types'

export interface RecoveryResult {
  ok: boolean
  action: WatchdogRecoveryAction
  message: string
  detail?: string
}

export async function attemptRecovery(
  action: WatchdogRecoveryAction
): Promise<RecoveryResult> {
  switch (action) {
    case 'restart_gateway':
      return await restartGateway()
    case 'run_doctor':
      return await runDoctor()
    case 'health_check':
      return { ok: true, action, message: 'Health check performed' }
    default:
      return {
        ok: false,
        action,
        message: `Recovery action ${action} not implemented`,
      }
  }
}

async function restartGateway(): Promise<RecoveryResult> {
  try {
    const result = await reloadGatewayForConfigChange('watchdog-auto-recovery', {
      preferEnsureWhenNotRunning: true,
    })

    if (result?.ok && result?.running) {
      return {
        ok: true,
        action: 'restart_gateway',
        message: 'Gateway restarted successfully',
      }
    }

    return {
      ok: false,
      action: 'restart_gateway',
      message: 'Gateway restart failed',
      detail: result?.stderr || result?.stdout,
    }
  } catch (error) {
    return {
      ok: false,
      action: 'restart_gateway',
      message: 'Gateway restart failed with exception',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runDoctor(): Promise<RecoveryResult> {
  try {
    const result = await ensureGatewayReady({
      skipRuntimePrecheck: true,
    }, 'watchdog-doctor-recovery')

    if (result?.ok && result?.running) {
      return {
        ok: true,
        action: 'run_doctor',
        message: 'Doctor recovery succeeded',
      }
    }

    return {
      ok: false,
      action: 'run_doctor',
      message: 'Doctor recovery failed',
      detail: result?.stderr || result?.stdout || result?.summary,
    }
  } catch (error) {
    return {
      ok: false,
      action: 'run_doctor',
      message: 'Doctor recovery failed with exception',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export function getRecoveryActionSequence(): WatchdogRecoveryAction[] {
  return ['restart_gateway', 'run_doctor']
}
