import { cancelActiveCommands } from './cli'
import { stopFeishuInstallerSession } from './feishu-installer-session'
import { stopFeishuOfficialCliSession } from './feishu-official-cli-session'
import { stopWeixinInstallerSession } from './weixin-installer-session'
import { stopWatchdog } from './watchdog'

const EXIT_CANCEL_DOMAINS = [
  'gateway',
  'config-write',
  'chat',
  'oauth',
  'capabilities',
  'models',
  'env',
  'plugin-install',
  'feishu-installer',
  'feishu-lark-cli',
  'weixin-installer',
  'upgrade',
  'env-setup',
  'global',
] as const

export interface AppExitCleanupResult {
  canceledDomains: string[]
  failedDomains: string[]
  installerStopped: boolean
}

function shouldLogCleanupSummary(): boolean {
  return process.env.NODE_ENV !== 'test'
}

export async function runAppExitCleanup(): Promise<AppExitCleanupResult> {
  stopWatchdog()

  const domainCancelResult = await cancelActiveCommands([...EXIT_CANCEL_DOMAINS])
    .catch(() => ({
      canceledDomains: [] as string[],
      failedDomains: [...EXIT_CANCEL_DOMAINS] as string[],
      untouchedDomains: [] as string[],
    }))
  const canceledDomains = [...domainCancelResult.canceledDomains]
  const failedDomains = [...domainCancelResult.failedDomains]

  let installerStopped = false
  try {
    const [feishuStopResult, weixinStopResult] = await Promise.all([
      Promise.all([stopFeishuInstallerSession(), stopFeishuOfficialCliSession()]).then(([installer, guided]) => ({
        ok: Boolean(installer?.ok) && Boolean(guided?.ok),
      })),
      stopWeixinInstallerSession(),
    ])
    installerStopped = Boolean(feishuStopResult?.ok) && Boolean(weixinStopResult?.ok)
  } catch {
    installerStopped = false
  }

  if (shouldLogCleanupSummary()) {
    console.info(
      `[app-exit-cleanup] canceledDomains=${canceledDomains.join(',') || '-'} failedDomains=${failedDomains.join(',') || '-'} installerStopped=${installerStopped}`
    )
  }

  return {
    canceledDomains,
    failedDomains,
    installerStopped,
  }
}
