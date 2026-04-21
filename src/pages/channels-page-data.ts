import { useEffect, useRef, useState } from 'react'

import { getChannelDefinition } from '../lib/openclaw-channel-registry'
import { createPageDataCache } from '../lib/page-data-cache'
import {
  listFeishuBots,
  listResidualLegacyFeishuAgentIds,
  sanitizeFeishuPluginConfig,
} from './feishu-bots'
import type {
  ChannelsPageChannelInfo,
  ChannelsPageDataOptions,
  ChannelsPageDataResult,
  ChannelsPageFetchChannelsOptions,
  ChannelsPageSnapshot,
  FeishuRuntimeStatusState,
} from './channels-page-data-contract'
import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'
import { resolveManagedChannelIdentity } from '../shared/managed-channel-identity'
import { getManagedChannelPluginByChannelId } from '../shared/managed-channel-plugin-registry'

type FeishuRuntimeStatusRecord = Record<
  string,
  {
    runtimeState: FeishuRuntimeStatusState
    summary: string
    issues: string[]
  }
>

const CHANNELS_PAGE_CACHE_TTL_MS = 60 * 1000
const channelsPageCache = createPageDataCache<ChannelsPageSnapshot>({ ttlMs: CHANNELS_PAGE_CACHE_TTL_MS })

export function useChannelsPageData({
  syncSelectedChannelSnapshots,
}: ChannelsPageDataOptions): ChannelsPageDataResult {
  const initialSnapshotRef = useRef<ChannelsPageSnapshot | null>(channelsPageCache.get()?.data || null)
  const initialSnapshot = initialSnapshotRef.current
  const [channels, setChannels] = useState<ChannelsPageChannelInfo[]>(initialSnapshot?.channels || [])
  const [loading, setLoading] = useState(!initialSnapshot)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [legacyFeishuAgentIds, setLegacyFeishuAgentIds] = useState<string[]>([])

  const fetchChannels = async (
    options?: ChannelsPageFetchChannelsOptions
  ): Promise<ChannelsPageChannelInfo[]> => {
    const background = Boolean(options?.background)
    if (!background) {
      setLoading(true)
    }

    try {
      setError('')
      const [config, feishuPluginState, weixinAccounts] = await Promise.all([
        window.api.readConfig(),
        window.api.getFeishuOfficialPluginState().catch(() => null),
        window.api.listWeixinAccounts().catch(() => []),
      ])
      if (!config) {
        setChannels([])
        syncSelectedChannelSnapshots([])
        setLegacyFeishuAgentIds([])
        channelsPageCache.set({ channels: [] })
        return []
      }

      const channelList: ChannelsPageChannelInfo[] = []
      const pluginStatusCache: Partial<Record<string, ManagedChannelPluginStatusView | null>> = {}
      const loadManagedPluginStatus = async (
        channelId: string
      ): Promise<ManagedChannelPluginStatusView | null> => {
        if (channelId in pluginStatusCache) {
          return pluginStatusCache[channelId] ?? null
        }

        const status = await window.api.getManagedChannelPluginStatus(channelId).catch(() => null)
        pluginStatusCache[channelId] = status
        return status
      }
      const feishuRuntimeStatus: FeishuRuntimeStatusRecord = await window.api
        .getFeishuRuntimeStatus()
        .catch(() => ({} as FeishuRuntimeStatusRecord))

      const normalizedConfig = feishuPluginState?.normalizedConfig || sanitizeFeishuPluginConfig(config)
      if (feishuPluginState?.configChanged) {
        void window.api.applyConfigPatchGuarded({
          beforeConfig: config,
          afterConfig: normalizedConfig,
          reason: 'unknown',
        }).catch(() => {
          // Keep listing channels even if the background healing write fails.
        })
      }
      setLegacyFeishuAgentIds(listResidualLegacyFeishuAgentIds(normalizedConfig))

      if (normalizedConfig.channels?.feishu) {
        const feishuPluginStatus = await loadManagedPluginStatus('feishu')
        const feishuBots = listFeishuBots(normalizedConfig)
        try {
          const feishuPairingStatus = await window.api.pairingFeishuStatus(feishuBots.map((bot) => bot.accountId))
          for (const bot of feishuBots) {
            const pairing = feishuPairingStatus[bot.accountId]
            const pairedCount = Number(pairing?.pairedCount || 0)
            channelList.push({
              id: `feishu:${bot.accountId}`,
              channelId: 'feishu',
              configChannelId: 'feishu',
              name: bot.name,
              accountName: bot.name,
              platform: 'feishu',
              enabled: bot.enabled,
              credentials: {},
              pairingRequired: true,
              pairingState: pairedCount > 0 ? 'paired' : 'pending',
              pairedCount,
              pairingUsers: pairing?.pairedUsers || [],
              pairingAccountId: bot.accountId,
              agentId: bot.agentId,
              isFeishuBot: true,
              provisionSource: bot.provisionSource,
              runtimeState: feishuRuntimeStatus[bot.accountId]?.runtimeState,
              runtimeSummary: feishuRuntimeStatus[bot.accountId]?.summary,
              runtimeIssues: feishuRuntimeStatus[bot.accountId]?.issues || [],
              pluginStatus: feishuPluginStatus,
            })
          }
        } catch {
          for (const bot of feishuBots) {
            channelList.push({
              id: `feishu:${bot.accountId}`,
              channelId: 'feishu',
              configChannelId: 'feishu',
              name: bot.name,
              accountName: bot.name,
              platform: 'feishu',
              enabled: bot.enabled,
              credentials: {},
              pairingRequired: true,
              pairingState: 'pending',
              pairedCount: 0,
              pairingUsers: [],
              pairingAccountId: bot.accountId,
              agentId: bot.agentId,
              isFeishuBot: true,
              provisionSource: bot.provisionSource,
              runtimeState: feishuRuntimeStatus[bot.accountId]?.runtimeState,
              runtimeSummary: feishuRuntimeStatus[bot.accountId]?.summary,
              runtimeIssues: feishuRuntimeStatus[bot.accountId]?.issues || [],
              pluginStatus: feishuPluginStatus,
            })
          }
        }
      }

      const weixinConfig = config.channels?.['openclaw-weixin']
      if (weixinAccounts.length > 0 || (weixinConfig && typeof weixinConfig === 'object')) {
        const weixinPluginStatus = await loadManagedPluginStatus('openclaw-weixin')
        const weixinConfigAccounts =
          weixinConfig && typeof weixinConfig === 'object' && !Array.isArray(weixinConfig)
            ? (weixinConfig.accounts as Record<string, any> | undefined)
            : undefined
        const accountIds = new Set<string>(weixinAccounts.map((account) => account.accountId))
        if (weixinConfigAccounts && typeof weixinConfigAccounts === 'object') {
          for (const accountId of Object.keys(weixinConfigAccounts)) {
            if (accountId.trim()) accountIds.add(accountId.trim())
          }
        }

        for (const accountId of accountIds) {
          const state = weixinAccounts.find((account) => account.accountId === accountId)
          const configEntry =
            weixinConfigAccounts && typeof weixinConfigAccounts === 'object'
              ? (weixinConfigAccounts[accountId] as Record<string, any> | undefined)
              : undefined
          const enabled =
            typeof configEntry?.enabled === 'boolean'
              ? configEntry.enabled
              : state?.enabled !== false
          channelList.push({
            id: `openclaw-weixin:${accountId}`,
            channelId: 'openclaw-weixin',
            configChannelId: 'openclaw-weixin',
            name: String(configEntry?.name || state?.name || accountId).trim() || accountId,
            accountName: String(configEntry?.name || state?.name || accountId).trim() || accountId,
            platform: 'openclaw-weixin',
            enabled,
            credentials: {},
            pairingRequired: false,
            pairingState: 'not_required',
            pairedCount: 0,
            pairingUsers: [],
            pairingAccountId: accountId,
            pluginStatus: weixinPluginStatus,
          })
        }
      }

      for (const [id, cfg] of Object.entries(config.channels || {})) {
        if (id === 'feishu' || id === 'openclaw-weixin') continue
        const channelConfig = (cfg || {}) as Record<string, any>
        const normalizedPlatform =
          (typeof channelConfig.domain === 'string' && channelConfig.domain.trim()) ||
          (id === 'dingtalk-connector' ? 'dingtalk' : id)
        const identity = resolveManagedChannelIdentity({
          configChannelId: id,
          platform: normalizedPlatform,
        })
        const channelDef = getChannelDefinition(identity.channelId) || getChannelDefinition(identity.platform)
        const pairingRequired = !channelDef?.skipPairing
        const pairingState: ChannelsPageChannelInfo['pairingState'] = !pairingRequired
          ? 'not_required'
          : 'pending'
        const pluginStatus = getManagedChannelPluginByChannelId(identity.channelId)
          ? await loadManagedPluginStatus(identity.channelId)
          : null

        channelList.push({
          id,
          channelId: identity.channelId,
          configChannelId: identity.configChannelId,
          name: channelConfig.name || channelDef?.name || identity.channelId || id,
          platform: identity.platform,
          enabled: channelConfig.enabled !== false,
          credentials: channelConfig.credentials || {},
          pairingRequired,
          pairingState,
          pairedCount: 0,
          pairingUsers: [],
          pairingAccountId: undefined,
          pluginStatus,
        })
      }

      setChannels(channelList)
      syncSelectedChannelSnapshots(channelList)
      channelsPageCache.set({ channels: channelList })
      return channelList
    } catch (error) {
      setError('加载渠道列表失败：' + (error as Error).message)
      return []
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }

  const handleRefreshChannels = async () => {
    setRefreshing(true)
    try {
      await fetchChannels({ background: true })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchChannels({ background: Boolean(initialSnapshot) })
  }, [initialSnapshot])

  return {
    channels,
    loading,
    refreshing,
    error,
    legacyFeishuAgentIds,
    setError,
    fetchChannels,
    handleRefreshChannels,
  }
}
