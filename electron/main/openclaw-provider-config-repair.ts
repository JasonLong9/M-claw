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
const CUSTOM_OPENAI_DEEPSEEK_MIGRATION_JSON_PATH = '$.models.providers.custom-openai->deepseek'
const DEEPSEEK_PROVIDER_ID = 'deepseek'
const DEEPSEEK_PROVIDER_API = 'openai-completions'
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

function normalizeUrlForHostMatch(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function isOfficialDeepSeekBaseUrl(value: unknown): boolean {
  const normalized = normalizeUrlForHostMatch(value)
  if (!normalized) return false
  return (
    normalized === 'https://api.deepseek.com'
    || normalized === 'https://api.deepseek.com/'
    || normalized === 'https://api.deepseek.com/v1'
    || normalized === 'https://api.deepseek.com/v1/'
  )
}

function normalizeMigratedDeepSeekModelRef(value: string): string {
  const normalized = String(value || '').trim()
  if (!normalized) return normalized
  if (!normalized.startsWith(`${CUSTOM_OPENAI_PROVIDER_ID}/`)) return normalized
  return `${DEEPSEEK_PROVIDER_ID}/${normalized.slice(CUSTOM_OPENAI_PROVIDER_ID.length + 1)}`
}

function normalizeProviderModels(models: unknown): Array<Record<string, any>> {
  if (!Array.isArray(models)) return []
  return models
    .map((entry): Record<string, any> | null => {
      if (!isPlainObject(entry)) return null
      const id = String(entry.id || '').trim()
      if (!id) return null
      return {
        ...entry,
        id,
        name: String(entry.name || id).trim() || id,
      }
    })
    .filter((entry): entry is Record<string, any> => entry !== null)
}

export interface OpenClawProviderConfigRepairResult {
  changed: boolean
  config: Record<string, any> | null
  repairedJsonPaths: string[]
  providerMigrations?: Array<{ fromProvider: string; toProvider: string }>
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
  const providerMigrations: Array<{ fromProvider: string; toProvider: string }> = []

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
  if (isPlainObject(customOpenAiProviderConfig) && isOfficialDeepSeekBaseUrl(customOpenAiProviderConfig.baseUrl)) {
    nextConfig = changed ? nextConfig : cloneJsonValue(config)
    nextConfig.models = isPlainObject(nextConfig.models) ? nextConfig.models : {}
    nextConfig.models.providers = isPlainObject(nextConfig.models.providers) ? nextConfig.models.providers : {}

    const existingDeepSeekProviderConfig = isPlainObject(nextConfig.models.providers[DEEPSEEK_PROVIDER_ID])
      ? nextConfig.models.providers[DEEPSEEK_PROVIDER_ID]
      : {}
    const migratedModels = [
      ...normalizeProviderModels(customOpenAiProviderConfig.models),
      ...normalizeProviderModels(existingDeepSeekProviderConfig.models).filter(
        (candidate) =>
          !normalizeProviderModels(customOpenAiProviderConfig.models).some((entry) => entry.id === candidate.id)
      ),
    ]

    nextConfig.models.providers[DEEPSEEK_PROVIDER_ID] = {
      ...existingDeepSeekProviderConfig,
      api: DEEPSEEK_PROVIDER_API,
      baseUrl: DEEPSEEK_BASE_URL,
      ...(migratedModels.length > 0 ? { models: migratedModels } : {}),
    }
    delete nextConfig.models.providers[CUSTOM_OPENAI_PROVIDER_ID]

    const primaryModel = String(nextConfig.agents?.defaults?.model?.primary || '').trim()
    if (primaryModel.startsWith(`${CUSTOM_OPENAI_PROVIDER_ID}/`)) {
      nextConfig.agents = isPlainObject(nextConfig.agents) ? nextConfig.agents : {}
      nextConfig.agents.defaults = isPlainObject(nextConfig.agents.defaults) ? nextConfig.agents.defaults : {}
      nextConfig.agents.defaults.model = isPlainObject(nextConfig.agents.defaults.model)
        ? nextConfig.agents.defaults.model
        : {}
      nextConfig.agents.defaults.model.primary = normalizeMigratedDeepSeekModelRef(primaryModel)
    }

    if (isPlainObject(nextConfig.agents?.defaults?.models)) {
      const nextAgentModels: Record<string, any> = {}
      for (const [modelRef, modelConfig] of Object.entries(nextConfig.agents.defaults.models)) {
        nextAgentModels[normalizeMigratedDeepSeekModelRef(modelRef)] = modelConfig
      }
      nextConfig.agents.defaults.models = nextAgentModels
    }

    changed = true
    repairedJsonPaths.push(CUSTOM_OPENAI_DEEPSEEK_MIGRATION_JSON_PATH)
    providerMigrations.push({
      fromProvider: CUSTOM_OPENAI_PROVIDER_ID,
      toProvider: DEEPSEEK_PROVIDER_ID,
    })
  }

  if (
    isPlainObject(customOpenAiProviderConfig)
    && Object.prototype.hasOwnProperty.call(customOpenAiProviderConfig, 'enabled')
    && !isOfficialDeepSeekBaseUrl(customOpenAiProviderConfig.baseUrl)
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
      providerMigrations: [],
    }
  }

  return {
    changed: true,
    config: nextConfig,
    repairedJsonPaths,
    providerMigrations,
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
