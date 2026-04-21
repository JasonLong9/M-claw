import type {
  ChannelsPageChannelEnabledBinding,
  ChannelsPageFetchChannelsBinding,
  ChannelsPageNullableChannel,
  ChannelsPagePairingState,
  ChannelsPagePairingRequirementBinding,
  ChannelsPageProvisionSource,
} from './channels-page-data-contract'
import type { ChannelsPagePairingKeyBinding } from './channels-page-feishu-target-refresh-contract'

export interface ChannelsPageSharedStatusAlert {
  color: 'yellow' | 'red'
  title: string
  message: string
}

export type ChannelsPageRepairActionVisibilityResolver<Channel> = (channel: Channel) => boolean

export type ChannelsPageSharedStatusAlertResolver<Channel> = (
  channel: Channel
) => ChannelsPageSharedStatusAlert | null

export type ChannelsPageSharedStatusChannel<
  Channel extends {
    channelId: string
    pluginStatus?: unknown | null
  },
> = Pick<Channel, 'channelId' | 'pluginStatus'>

export type ChannelsPageManagedStatusChannel<
  Channel extends {
    channelId: string
    pairingAccountId?: string
    pluginStatus?: unknown | null
  },
> = Pick<Channel, 'channelId' | 'pairingAccountId' | 'pluginStatus'>

export interface ChannelsPageManagedStatusResolvers<Channel> {
  shouldShowRepairAction: ChannelsPageRepairActionVisibilityResolver<Channel>
  getSharedStatusAlert: ChannelsPageSharedStatusAlertResolver<Channel>
}

export type ChannelsPageLatestChannelSnapshotResolver<Channel extends { id: string }> = (
  channels: Channel[],
  current: Pick<Channel, 'id'> | null | undefined
) => Channel | null

export interface ChannelsPageLatestChannelSnapshotResolverBinding<
  Channel extends {
    id: string
  },
> {
  resolveLatestChannelSnapshot: ChannelsPageLatestChannelSnapshotResolver<Channel>
}

export interface ChannelsPageLatestChannelSnapshotAccessBinding<
  Channel extends {
    id: string
  },
> extends ChannelsPageFetchChannelsBinding<Channel>,
    ChannelsPageLatestChannelSnapshotResolverBinding<Channel> {}

export interface ChannelsPageManagedStatusAccessBinding<
  ResolverChannel,
  AccessChannel extends {
    id: string
  },
> extends ChannelsPageManagedStatusResolvers<ResolverChannel>,
    ChannelsPageLatestChannelSnapshotAccessBinding<AccessChannel> {}

export interface ChannelsPageStateHelperFallbackChannelBinding<Channel> {
  fallbackChannel?: ChannelsPageNullableChannel<Channel>
}

export interface ChannelsPageStateHelperRepairingPluginChannelBinding {
  repairingPluginChannelId?: string | null
}

export interface ChannelsPageStateHelperRefreshStatusBinding {
  statusPending: boolean
  missingAfterRefresh: boolean
}

export interface ChannelsPageStateHelperBlockedBySharedStatusBinding {
  blockedBySharedStatus: boolean
}

export interface ChannelsPageStateHelperRepairStateBinding {
  canRepair: boolean
  repairing: boolean
}

export interface ChannelsPageStateHelperTargetStateOptions<Channel>
  extends ChannelsPageStateHelperFallbackChannelBinding<Channel>,
    ChannelsPageStateHelperRepairingPluginChannelBinding {
  refreshing?: boolean
  checkedKey?: string
}

export interface ChannelsPageStateHelperTargetState<Channel>
  extends ChannelsPageStateHelperRefreshStatusBinding,
    ChannelsPageStateHelperBlockedBySharedStatusBinding,
    ChannelsPageStateHelperRepairStateBinding,
    ChannelsPagePairingKeyBinding {
  targetChannel: ChannelsPageNullableChannel<Channel>
  channelForSurface: ChannelsPageNullableChannel<Channel>
  sharedStatusAlert: ChannelsPageSharedStatusAlert | null
}

export interface ChannelsPageChannelStatusBadgeDescriptor {
  key: string
  color: string
  label: string
}

export interface ChannelsPageChannelStatusBadgeChannel
  extends ChannelsPageChannelEnabledBinding,
    ChannelsPagePairingRequirementBinding {
  channelId: string
  pairingState: ChannelsPagePairingState
  provisionSource?: ChannelsPageProvisionSource
  runtimeState?: 'online' | 'offline' | 'degraded' | 'disabled'
}

export interface ChannelsPageChannelStatusBadgeOptions {
  includePairingState?: boolean
  includeProvisionSource?: boolean
}

export type ChannelsPageChannelStatusBadgeDeriver = (
  channel: ChannelsPageChannelStatusBadgeChannel | null | undefined,
  options?: ChannelsPageChannelStatusBadgeOptions
) => ChannelsPageChannelStatusBadgeDescriptor[]

export interface ChannelsPageChannelStatusBadgeDeriverBinding {
  deriveChannelStatusBadges: ChannelsPageChannelStatusBadgeDeriver
}
