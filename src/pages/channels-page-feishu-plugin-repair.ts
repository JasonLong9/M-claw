import { useState } from 'react'

import type { FeishuDiagnosticsRepairOutcome } from '../components/FeishuDiagnosticsModal'
import type {
  ChannelsPageFeishuPluginRepairChannel,
  ChannelsPageFeishuPluginRepairOptions,
  ChannelsPageFeishuPluginRepairRequestOptions,
  ChannelsPageFeishuPluginRepairResult,
} from './channels-page-feishu-plugin-repair-contract'
import { runManagedChannelRepairFlow } from '../shared/managed-channel-repair'

export function useChannelsPageFeishuPluginRepair<Channel extends ChannelsPageFeishuPluginRepairChannel>({
  fetchChannels,
  resolveLatestChannelSnapshot,
  shouldShowRepairAction,
  getSharedStatusAlert,
  onPageError,
}: ChannelsPageFeishuPluginRepairOptions<Channel>): ChannelsPageFeishuPluginRepairResult<Channel> {
  const [repairingPluginChannelId, setRepairingPluginChannelId] = useState<string | null>(null)

  const repairFeishuPlugin = async (
    channel: Channel,
    options?: ChannelsPageFeishuPluginRepairRequestOptions
  ): Promise<FeishuDiagnosticsRepairOutcome> => {
    if (!shouldShowRepairAction(channel)) {
      return {
        ok: true,
        message: channel.pluginStatus?.summary || 'The current Feishu plugin state does not require repair.',
      }
    }

    const surface = options?.surface || 'page'

    setRepairingPluginChannelId(channel.channelId)
    if (surface === 'page') {
      onPageError('')
    }

    try {
      const outcome = await runManagedChannelRepairFlow({
        getManagedChannelPluginStatus: (channelId) => window.api.getManagedChannelPluginStatus(channelId),
        repairManagedChannelPlugin: (channelId) => window.api.repairManagedChannelPlugin(channelId),
      }, channel.channelId)

      if (!outcome.ok) {
        throw new Error(outcome.summary || 'Failed to repair the managed channel plugin.')
      }

      const refreshedChannels = await fetchChannels({ background: true })
      const refreshedChannel = resolveLatestChannelSnapshot(refreshedChannels, channel)
      const refreshedStatusAlert = refreshedChannel ? getSharedStatusAlert(refreshedChannel) : null

      if (refreshedStatusAlert) {
        return {
          ok: false,
          message: `Repair completed, but Feishu runtime still reports: ${refreshedStatusAlert.message}`,
        }
      }

      return {
        ok: true,
        message: refreshedChannel?.pluginStatus?.summary || outcome.summary || 'Feishu plugin repair completed.',
      }
    } catch (error) {
      const message = `Failed to repair the Feishu plugin: ${(error as Error).message}`
      if (surface === 'page') {
        onPageError(message)
      }
      return {
        ok: false,
        message,
      }
    } finally {
      setRepairingPluginChannelId(null)
    }
  }

  const handleRepairFeishuPlugin = async (channel: Channel) => {
    const result = await repairFeishuPlugin(channel, { surface: 'page' })
    if (!result.ok) {
      onPageError(result.message)
    }
  }

  return {
    repairingPluginChannelId,
    repairFeishuPlugin,
    handleRepairFeishuPlugin,
  }
}
