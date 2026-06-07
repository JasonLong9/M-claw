import { useState } from 'react'

import { removeWeixinChannelAccountConfig } from '../lib/openclaw-channel-registry'
import type {
  ChannelsPageChannelActionChannel,
  ChannelsPageChannelActionsOptions,
  ChannelsPageChannelActionsResult,
} from './channels-page-channel-actions-contract'
import { removeFeishuBotConfigForPluginState, sanitizeFeishuPluginConfig } from './feishu-bots'

export function useChannelsPageChannelActions<Channel extends ChannelsPageChannelActionChannel>({
  fetchChannels,
  onPageError,
}: ChannelsPageChannelActionsOptions<Channel>): ChannelsPageChannelActionsResult<Channel> {
  const [togglingChannelId, setTogglingChannelId] = useState<string | null>(null)
  const [removingChannelId, setRemovingChannelId] = useState<string | null>(null)

  const handleRemoveChannel = async (channel: Channel) => {
    if (removingChannelId && removingChannelId !== channel.id) return
    if (!confirm(`确定要移除渠道「${channel.name}」吗？`)) return

    setRemovingChannelId(channel.id)
    try {
      const config = sanitizeFeishuPluginConfig(await window.api.readConfig())
      if (config) {
        const feishuPluginState = await window.api.getFeishuOfficialPluginState()
        const beforeConfig = JSON.parse(JSON.stringify(config)) as Record<string, any>
        let nextConfig = JSON.parse(JSON.stringify(config)) as Record<string, any>
        if (channel.channelId === 'feishu' && channel.pairingAccountId) {
          nextConfig = removeFeishuBotConfigForPluginState(
            config,
            channel.pairingAccountId,
            feishuPluginState.installedOnDisk
          )
        } else if (channel.channelId === 'openclaw-weixin' && channel.pairingAccountId) {
          const removeStateResult = await window.api.removeWeixinAccount(channel.pairingAccountId)
          if (!removeStateResult.ok) {
            throw new Error(`删除已配对微信账号状态失败：${channel.pairingAccountId}`)
          }
          nextConfig = removeWeixinChannelAccountConfig(config, channel.pairingAccountId)
        } else {
          if (!nextConfig.channels || typeof nextConfig.channels !== 'object') {
            nextConfig.channels = {}
          }
          delete nextConfig.channels[channel.configChannelId]
        }
        const writeResult = await window.api.applyConfigPatchGuarded({
          beforeConfig,
          afterConfig: nextConfig,
          reason: 'channels-remove-channel',
        })
        if (!writeResult.ok) {
          throw new Error(writeResult.message || '更新渠道配置失败。')
        }
        await fetchChannels({ background: true })
      }
    } catch (error) {
      onPageError('移除渠道失败：' + (error as Error).message)
    } finally {
      setRemovingChannelId(null)
    }
  }

  const handleToggleChannelEnabled = async (channel: Channel) => {
    if (togglingChannelId && togglingChannelId !== channel.id) {
      return
    }
    setTogglingChannelId(channel.id)
    onPageError('')
    try {
      const config = sanitizeFeishuPluginConfig(await window.api.readConfig())
      if (!config || typeof config !== 'object') {
        throw new Error('当前没有可更新的渠道配置。')
      }

      const beforeConfig = JSON.parse(JSON.stringify(config)) as Record<string, any>
      const nextConfig = JSON.parse(JSON.stringify(config)) as Record<string, any>
      const nextEnabled = !channel.enabled

      if (!nextConfig.channels || typeof nextConfig.channels !== 'object') {
        nextConfig.channels = {}
      }

      if (channel.channelId === 'feishu' && channel.pairingAccountId) {
        if (!nextConfig.channels.feishu || typeof nextConfig.channels.feishu !== 'object') {
          throw new Error('未找到飞书渠道配置。')
        }

        if (channel.pairingAccountId === 'default') {
          nextConfig.channels.feishu.enabled = nextEnabled
        } else {
          const accounts = nextConfig.channels.feishu.accounts as Record<string, any> | undefined
          if (!accounts || typeof accounts !== 'object' || !accounts[channel.pairingAccountId]) {
            throw new Error(`缺少飞书机器人账号配置：${channel.pairingAccountId}`)
          }
          const accountConfig = accounts[channel.pairingAccountId]
          if (!accountConfig || typeof accountConfig !== 'object' || Array.isArray(accountConfig)) {
            throw new Error(`飞书机器人账号配置格式无效：${channel.pairingAccountId}`)
          }
          accountConfig.enabled = nextEnabled
        }
      } else if (channel.channelId === 'openclaw-weixin' && channel.pairingAccountId) {
        const existingWeixinChannel = nextConfig.channels['openclaw-weixin'] as Record<string, any> | undefined
        const weixinChannel =
          existingWeixinChannel && typeof existingWeixinChannel === 'object' && !Array.isArray(existingWeixinChannel)
            ? existingWeixinChannel
            : {
                enabled: true,
                accounts: {},
              }
        nextConfig.channels['openclaw-weixin'] = weixinChannel
        const accounts =
          weixinChannel.accounts && typeof weixinChannel.accounts === 'object' && !Array.isArray(weixinChannel.accounts)
            ? (weixinChannel.accounts as Record<string, any>)
            : {}
        if (!accounts[channel.pairingAccountId]) {
          accounts[channel.pairingAccountId] = {
            enabled: channel.enabled,
            name: channel.accountName || channel.name,
          }
        }
        weixinChannel.accounts = accounts
        const accountConfig = accounts[channel.pairingAccountId]
        if (!accountConfig || typeof accountConfig !== 'object' || Array.isArray(accountConfig)) {
          throw new Error(`微信账号配置格式无效：${channel.pairingAccountId}`)
        }
        accountConfig.enabled = nextEnabled
      } else {
        const targetChannel = nextConfig.channels[channel.configChannelId] as Record<string, any> | undefined
        if (!targetChannel || typeof targetChannel !== 'object' || Array.isArray(targetChannel)) {
          throw new Error(`缺少渠道配置记录：${channel.configChannelId}`)
        }
        targetChannel.enabled = nextEnabled
      }

      const writeResult = await window.api.applyConfigPatchGuarded({
        beforeConfig,
        afterConfig: nextConfig,
        reason: 'unknown',
      })
      if (!writeResult.ok) {
        throw new Error(writeResult.message || '更新渠道配置失败。')
      }
      await fetchChannels({ background: true })
    } catch (error) {
      onPageError(`${channel.enabled ? '停用渠道失败：' : '启用渠道失败：'}${(error as Error).message}`)
    } finally {
      setTogglingChannelId(null)
    }
  }

  return {
    togglingChannelId,
    removingChannelId,
    handleRemoveChannel,
    handleToggleChannelEnabled,
  }
}
