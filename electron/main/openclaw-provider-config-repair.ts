function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneJsonValue<T>(value: T): T {
  if (value === undefined) return value
  return JSON.parse(JSON.stringify(value)) as T
}

const MINIMAX_PORTAL_PROVIDER_ID = 'minimax-portal'
const MINIMAX_PORTAL_PROVIDER_API = 'anthropic-messages'
const MINIMAX_PORTAL_PROVIDER_API_JSON_PATH = '$.models.providers.minimax-portal.api'
const CUSTOM_OPENAI_PROVIDER_ID = 'custom-openai'
const CUSTOM_OPENAI_ENABLED_JSON_PATH = '$.models.providers.custom-openai.enabled'

export interface OpenClawProviderConfigRepairResult {
  changed: boolean
  config: Record<string, any> | null
  repairedJsonPaths: string[]
}

export function repairKnownProviderConfigGaps(
  config: Record<string, any> | null | undefined
): OpenClawProviderConfigRepairResult {
  if (!isPlainObject(config)) {
    return {
      changed: false,
      config: config ?? null,
      repairedJsonPaths: [],
    }
  }

  let changed = false
  let nextConfig: Record<string, any> = config
  const repairedJsonPaths: string[] = []

  const minimaxProviderConfig = config.models?.providers?.[MINIMAX_PORTAL_PROVIDER_ID]
  if (isPlainObject(minimaxProviderConfig)) {
    const currentApi = String(minimaxProviderConfig.api || '').trim()
    if (!currentApi) {
      nextConfig = changed ? nextConfig : cloneJsonValue(config)
      nextConfig.models = isPlainObject(nextConfig.models) ? nextConfig.models : {}
      nextConfig.models.providers = isPlainObject(nextConfig.models.providers) ? nextConfig.models.providers : {}
      nextConfig.models.providers[MINIMAX_PORTAL_PROVIDER_ID] = {
        ...minimaxProviderConfig,
        api: MINIMAX_PORTAL_PROVIDER_API,
      }
      changed = true
      repairedJsonPaths.push(MINIMAX_PORTAL_PROVIDER_API_JSON_PATH)
    }
  }

  const customOpenAiProviderConfig = config.models?.providers?.[CUSTOM_OPENAI_PROVIDER_ID]
  if (
    isPlainObject(customOpenAiProviderConfig)
    && Object.prototype.hasOwnProperty.call(customOpenAiProviderConfig, 'enabled')
  ) {
    nextConfig = changed ? nextConfig : cloneJsonValue(config)
    nextConfig.models = isPlainObject(nextConfig.models) ? nextConfig.models : {}
    nextConfig.models.providers = isPlainObject(nextConfig.models.providers) ? nextConfig.models.providers : {}
    const nextCustomOpenAiProviderConfig = {
      ...nextConfig.models.providers[CUSTOM_OPENAI_PROVIDER_ID],
    }
    delete nextCustomOpenAiProviderConfig.enabled
    nextConfig.models.providers[CUSTOM_OPENAI_PROVIDER_ID] = nextCustomOpenAiProviderConfig
    changed = true
    repairedJsonPaths.push(CUSTOM_OPENAI_ENABLED_JSON_PATH)
  }

  if (!changed) {
    return {
      changed: false,
      config,
      repairedJsonPaths: [],
    }
  }

  return {
    changed: true,
    config: nextConfig,
    repairedJsonPaths,
  }
}

export async function repairKnownProviderConfigGapsOnDisk(params: {
  readConfig: () => Promise<Record<string, any> | null>
  writeConfig: (config: Record<string, any>) => Promise<void>
}): Promise<OpenClawProviderConfigRepairResult> {
  const currentConfig = await params.readConfig().catch(() => null)
  const repairResult = repairKnownProviderConfigGaps(currentConfig)
  if (!repairResult.changed || !repairResult.config) {
    return repairResult
  }

  await params.writeConfig(repairResult.config)
  return repairResult
}
