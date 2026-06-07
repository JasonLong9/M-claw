import { extractFeishuRoutingBots, getFeishuManagedAgentId } from '../../src/lib/feishu-multi-bot-routing'
import { extractConfiguredDefaultModel } from '../../src/shared/model-config-gateway'
import { repairAgentAuthProfilesFromOtherAgentStores } from './local-model-probe'

const path = process.getBuiltinModule('node:path') as typeof import('node:path')

function normalizeText(value: unknown): string {
  return String(value || '').trim()
}

function addModelProvider(providerIds: Set<string>, modelRef: unknown): void {
  const normalizedModelRef = normalizeText(modelRef)
  if (!normalizedModelRef) return
  const separatorIndex = normalizedModelRef.indexOf('/')
  if (separatorIndex <= 0) return
  const providerId = normalizedModelRef.slice(0, separatorIndex).trim().toLowerCase()
  if (providerId) {
    providerIds.add(providerId)
  }
}

function addModelProviderCollection(providerIds: Set<string>, values: unknown): void {
  if (!Array.isArray(values)) return
  for (const value of values) {
    addModelProvider(providerIds, value)
  }
}

function collectConfiguredProviderIds(config: Record<string, any> | null | undefined): string[] {
  const providerIds = new Set<string>()
  const normalizedConfig =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, any>)
      : {}

  addModelProvider(providerIds, extractConfiguredDefaultModel(normalizedConfig))

  const defaultModelConfig = normalizedConfig?.agents?.defaults?.model as Record<string, any> | undefined
  addModelProvider(providerIds, defaultModelConfig?.primary)
  addModelProvider(providerIds, defaultModelConfig?.image)
  addModelProviderCollection(providerIds, defaultModelConfig?.fallbacks)
  addModelProviderCollection(providerIds, defaultModelConfig?.imageFallbacks)
  addModelProviderCollection(providerIds, defaultModelConfig?.image_fallbacks)

  const defaultModels = normalizedConfig?.agents?.defaults?.models as Record<string, any> | undefined
  if (defaultModels && typeof defaultModels === 'object' && !Array.isArray(defaultModels)) {
    for (const modelRef of Object.keys(defaultModels)) {
      addModelProvider(providerIds, modelRef)
    }
  }

  const agents = Array.isArray(normalizedConfig?.agents?.list) ? normalizedConfig.agents.list : []
  for (const agent of agents) {
    if (!agent || typeof agent !== 'object' || Array.isArray(agent)) continue
    addModelProvider(providerIds, agent.model?.primary)
    addModelProvider(providerIds, agent.model?.image)
    addModelProviderCollection(providerIds, agent.model?.fallbacks)
    addModelProviderCollection(providerIds, agent.model?.imageFallbacks)
    addModelProviderCollection(providerIds, agent.model?.image_fallbacks)

    const agentModels = agent.models
    if (agentModels && typeof agentModels === 'object' && !Array.isArray(agentModels)) {
      for (const modelRef of Object.keys(agentModels)) {
        addModelProvider(providerIds, modelRef)
      }
    }
  }

  return Array.from(providerIds)
}

export interface EnsureFeishuManagedAgentAuthBootstrapResult {
  ok: boolean
  changed: boolean
  providerIds: string[]
  targetAgentIds: string[]
  updatedAgentIds: string[]
  importedProfileIds: string[]
  importedProviders: string[]
  sourceAuthStorePaths: string[]
  error?: string
}

export async function ensureFeishuManagedAgentAuthBootstrap(params: {
  homeDir: string
  config: Record<string, any> | null | undefined
  providerIds?: string[]
}): Promise<EnsureFeishuManagedAgentAuthBootstrapResult> {
  const homeDir = normalizeText(params.homeDir)
  if (!homeDir) {
    return {
      ok: true,
      changed: false,
      providerIds: [],
      targetAgentIds: [],
      updatedAgentIds: [],
      importedProfileIds: [],
      importedProviders: [],
      sourceAuthStorePaths: [],
    }
  }

  const targetAgentIds = extractFeishuRoutingBots(params.config || null).map((bot) =>
    getFeishuManagedAgentId(bot.accountId)
  )
  if (targetAgentIds.length === 0) {
    return {
      ok: true,
      changed: false,
      providerIds: [],
      targetAgentIds: [],
      updatedAgentIds: [],
      importedProfileIds: [],
      importedProviders: [],
      sourceAuthStorePaths: [],
    }
  }

  const providerIds = Array.from(
    new Set(
      (params.providerIds && params.providerIds.length > 0
        ? params.providerIds
        : collectConfiguredProviderIds(params.config)
      )
        .map((providerId) => normalizeText(providerId).toLowerCase())
        .filter(Boolean)
    )
  )
  if (providerIds.length === 0) {
    return {
      ok: true,
      changed: false,
      providerIds: [],
      targetAgentIds,
      updatedAgentIds: [],
      importedProfileIds: [],
      importedProviders: [],
      sourceAuthStorePaths: [],
    }
  }

  const repairResult = await repairAgentAuthProfilesFromOtherAgentStores(
    {
      providerIds,
      targetAgentIds,
    },
    {
      resolveRuntimePaths: async () => ({
        homeDir,
      }),
    }
  )

  const updatedAuthStorePaths = new Set(
    (Array.isArray(repairResult.updatedAuthStorePaths) ? repairResult.updatedAuthStorePaths : []).map((value) =>
      path.resolve(String(value || ''))
    )
  )
  const updatedAgentIds = targetAgentIds.filter((agentId) =>
    updatedAuthStorePaths.has(path.resolve(path.join(homeDir, 'agents', agentId, 'agent', 'auth-profiles.json')))
  )

  return {
    ok: repairResult.ok,
    changed: repairResult.ok && repairResult.repaired,
    providerIds,
    targetAgentIds,
    updatedAgentIds,
    importedProfileIds: Array.isArray(repairResult.importedProfileIds) ? repairResult.importedProfileIds : [],
    importedProviders: Array.isArray(repairResult.importedProviders) ? repairResult.importedProviders : [],
    sourceAuthStorePaths: Array.isArray(repairResult.sourceAuthStorePaths) ? repairResult.sourceAuthStorePaths : [],
    ...(repairResult.error ? { error: repairResult.error } : {}),
  }
}
