import type { Dispatch, SetStateAction } from 'react'
import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'

export type FeishuRuntimeStatusState = 'online' | 'offline' | 'degraded' | 'disabled'
export type ChannelsPagePairingState = 'paired' | 'pending' | 'not_required'
export type ChannelsPageProvisionSource = 'created' | 'linked' | 'unknown'

export interface ChannelsPagePairingRequirementBinding {
  pairingRequired: boolean
}

export interface ChannelsPagePairingAccountBinding {
  pairingAccountId?: string
}

export interface ChannelsPageChannelIdentityBinding {
  id: string
  channelId: string
}

export interface ChannelsPageChannelEnabledBinding {
  enabled: boolean
}

export interface ChannelsPageChannelNameBinding {
  name: string
}

export interface ChannelsPageConfigChannelBinding {
  configChannelId: string
}

export interface ChannelsPageAgentBinding {
  agentId?: string
}

export interface ChannelsPageAccountNameBinding {
  accountName?: string
}

export interface ChannelsPageChannelInfo
  extends ChannelsPageChannelIdentityBinding,
    ChannelsPageChannelEnabledBinding,
    ChannelsPageChannelNameBinding,
    ChannelsPageConfigChannelBinding,
    ChannelsPageAgentBinding,
    ChannelsPageAccountNameBinding,
    ChannelsPagePairingRequirementBinding,
    ChannelsPagePairingAccountBinding {
  platform: string
  credentials: Record<string, string>
  pairingState: ChannelsPagePairingState
  pairedCount: number
  pairingUsers: string[]
  isFeishuBot?: boolean
  provisionSource?: ChannelsPageProvisionSource
  runtimeState?: FeishuRuntimeStatusState
  runtimeSummary?: string
  runtimeIssues?: string[]
  pluginStatus?: ManagedChannelPluginStatusView | null
}

export interface ChannelsPageSnapshot {
  channels: ChannelsPageChannelInfo[]
}

export type ChannelsPageChannelSnapshotsSyncHandler<Channel> = (nextChannels: Channel[]) => void

export interface ChannelsPageDataOptions {
  syncSelectedChannelSnapshots: ChannelsPageChannelSnapshotsSyncHandler<ChannelsPageChannelInfo>
}

export interface ChannelsPageFetchChannelsOptions {
  background?: boolean
}

export type ChannelsPageFetchChannels<Channel> = (
  options?: ChannelsPageFetchChannelsOptions
) => Promise<Channel[]>

export interface ChannelsPageFetchChannelsBinding<Channel> {
  fetchChannels: ChannelsPageFetchChannels<Channel>
}

export interface ChannelsPageChannelsBinding<Channel> {
  channels: Channel[]
}

export type ChannelsPageNullableChannel<Channel> = Channel | null

export type ChannelsPageNullableStringSetter = Dispatch<SetStateAction<string | null>>

export type ChannelsPagePendingChannelId = string | null

export interface ChannelsPageLoadingBinding {
  loading: boolean
}

export type ChannelsPagePageErrorHandler = (message: string) => void

export interface ChannelsPageSetPageErrorBinding {
  setError: ChannelsPagePageErrorHandler
}

export interface ChannelsPageOnPageErrorBinding {
  onPageError: ChannelsPagePageErrorHandler
}

export type ChannelsPageVoidHandler = () => void

export type ChannelsPageAsyncVoidHandler = () => Promise<void>

export type ChannelsPageRefreshChannelsHandler = ChannelsPageAsyncVoidHandler

export interface ChannelsPageRefreshFeedbackBinding {
  refreshing: boolean
  error: string
  legacyFeishuAgentIds: string[]
  handleRefreshChannels: ChannelsPageRefreshChannelsHandler
}

export interface ChannelsPageDataResult
  extends ChannelsPageFetchChannelsBinding<ChannelsPageChannelInfo>,
    ChannelsPageChannelsBinding<ChannelsPageChannelInfo>,
    ChannelsPageRefreshFeedbackBinding,
    ChannelsPageLoadingBinding {
  setError: Dispatch<SetStateAction<string>>
}
