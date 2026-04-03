import { PINNED_OPENCLAW_VERSION } from '../../src/shared/openclaw-version-policy'
import { inspectBundledOpenClawDeliveryStatus } from './openclaw-bundled-manifest'
import { resolveBundledOpenClawPayloadPath } from './openclaw-bundled-payload'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')

export interface BundledOpenClawInstallPlan {
  platform: NodeJS.Platform
  arch: string
  preferredSource: 'bundled-runtime' | 'bundled-fallback' | 'online-fallback'
  runtimeBinaryPath: string | null
  runtimePath: string | null
  payloadPath: string | null
  manifestPath: string | null
  defaultDeliveryMode: 'bundled-runtime' | 'bundled-fallback' | 'online-fallback' | 'external' | null
  targetDeliveryMode: 'bundled-runtime' | 'bundled-fallback' | 'online-fallback' | 'external' | null
  warnings: string[]
}

export function resolveBundledOpenClawInstallPlan(options: {
  version?: string
  cwd?: string
  resourcesPath?: string
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  arch?: string
  exists?: (candidatePath: string) => boolean
  readFile?: (candidatePath: string) => string
} = {}): BundledOpenClawInstallPlan {
  const exists = options.exists || ((candidatePath: string) => fs.existsSync(candidatePath))
  const platform = options.platform || process.platform
  const arch = String(options.arch || process.arch).trim()
  const version = String(options.version || PINNED_OPENCLAW_VERSION).trim() || PINNED_OPENCLAW_VERSION

  const deliveryStatus = inspectBundledOpenClawDeliveryStatus({
    cwd: options.cwd,
    resourcesPath: options.resourcesPath,
    env: options.env,
    platform,
    arch,
    exists,
    readFile: options.readFile,
  })
  const payloadPath = resolveBundledOpenClawPayloadPath({
    version,
    cwd: options.cwd,
    resourcesPath: options.resourcesPath,
    env: options.env,
    exists,
  })

  const warnings: string[] = []
  if (deliveryStatus.error) {
    warnings.push(`Bundled manifest error: ${deliveryStatus.error}`)
  }
  if (
    deliveryStatus.defaultDeliveryMode &&
    deliveryStatus.targetDeliveryMode &&
    deliveryStatus.defaultDeliveryMode !== deliveryStatus.targetDeliveryMode
  ) {
    warnings.push(
      `Bundled delivery mode is ${deliveryStatus.defaultDeliveryMode}, target mode is ${deliveryStatus.targetDeliveryMode}.`
    )
  }
  if (deliveryStatus.runtimePath && !deliveryStatus.runtimeBinaryPath) {
    warnings.push(`Bundled runtime directory exists but no runtime binary was found: ${deliveryStatus.runtimePath}`)
  }
  if (!deliveryStatus.runtimeBinaryPath && !payloadPath) {
    warnings.push(`No bundled runtime binary or tgz payload found for ${platform}-${arch}.`)
  }

  const preferredSource =
    deliveryStatus.runtimeBinaryPath ? 'bundled-runtime' : payloadPath ? 'bundled-fallback' : 'online-fallback'

  return {
    platform,
    arch,
    preferredSource,
    runtimeBinaryPath: deliveryStatus.runtimeBinaryPath,
    runtimePath: deliveryStatus.runtimePath,
    payloadPath,
    manifestPath: deliveryStatus.manifestPath,
    defaultDeliveryMode: deliveryStatus.defaultDeliveryMode,
    targetDeliveryMode: deliveryStatus.targetDeliveryMode,
    warnings,
  }
}
