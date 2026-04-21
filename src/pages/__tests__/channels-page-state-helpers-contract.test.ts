import { describe, expect, it } from 'vitest'

import stateHelpersContractSource from '../channels-page-state-helpers-contract.ts?raw'

describe('channels-page-state-helpers-contract module', () => {
  it('keeps the shared helper-layer types behind one dedicated module', () => {
    expect(stateHelpersContractSource).toContain("import type {")
    expect(stateHelpersContractSource).toContain('ChannelsPageChannelEnabledBinding,')
    expect(stateHelpersContractSource).toContain('ChannelsPageFetchChannelsBinding,')
    expect(stateHelpersContractSource).toContain('ChannelsPageNullableChannel,')
    expect(stateHelpersContractSource).toContain('ChannelsPagePairingRequirementBinding,')
    expect(stateHelpersContractSource).toContain('ChannelsPagePairingState,')
    expect(stateHelpersContractSource).toContain('ChannelsPageProvisionSource,')
    expect(stateHelpersContractSource).toContain("} from './channels-page-data-contract'")
    expect(stateHelpersContractSource).toContain(
      "import type { ChannelsPagePairingKeyBinding } from './channels-page-feishu-target-refresh-contract'"
    )
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageSharedStatusAlert {')
    expect(stateHelpersContractSource).toContain(
      'export type ChannelsPageRepairActionVisibilityResolver<Channel> = (channel: Channel) => boolean'
    )
    expect(stateHelpersContractSource).toContain('export type ChannelsPageSharedStatusAlertResolver<Channel> = (')
    expect(stateHelpersContractSource).toContain('export type ChannelsPageSharedStatusChannel<')
    expect(stateHelpersContractSource).toContain('export type ChannelsPageManagedStatusChannel<')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageManagedStatusResolvers<Channel> {')
    expect(stateHelpersContractSource).toContain('export type ChannelsPageLatestChannelSnapshotResolver<Channel extends { id: string }> = (')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageLatestChannelSnapshotResolverBinding<')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageLatestChannelSnapshotAccessBinding<')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageManagedStatusAccessBinding<')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageStateHelperFallbackChannelBinding<Channel> {')
    expect(stateHelpersContractSource).toContain(
      'export interface ChannelsPageStateHelperRepairingPluginChannelBinding {'
    )
    expect(stateHelpersContractSource).toContain(
      'export interface ChannelsPageStateHelperRefreshStatusBinding {'
    )
    expect(stateHelpersContractSource).toContain(
      'export interface ChannelsPageStateHelperBlockedBySharedStatusBinding {'
    )
    expect(stateHelpersContractSource).toContain(
      'export interface ChannelsPageStateHelperRepairStateBinding {'
    )
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageStateHelperTargetStateOptions<Channel>')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageStateHelperTargetState<Channel>')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageChannelStatusBadgeDescriptor {')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageChannelStatusBadgeChannel')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageChannelStatusBadgeOptions {')
    expect(stateHelpersContractSource).toContain('export type ChannelsPageChannelStatusBadgeDeriver = (')
    expect(stateHelpersContractSource).toContain('export interface ChannelsPageChannelStatusBadgeDeriverBinding {')
  })

  it('keeps shared alert, derived target-state, and badge option fields in the helper contract module', () => {
    expect(stateHelpersContractSource).toContain("color: 'yellow' | 'red'")
    expect(stateHelpersContractSource).toContain('channel: Channel')
    expect(stateHelpersContractSource).toContain(') => ChannelsPageSharedStatusAlert | null')
    expect(stateHelpersContractSource).toContain('channelId: string')
    expect(stateHelpersContractSource).toContain('pluginStatus?: unknown | null')
    expect(stateHelpersContractSource).toContain('pairingAccountId?: string')
    expect(stateHelpersContractSource).toContain("Pick<Channel, 'channelId' | 'pluginStatus'>")
    expect(stateHelpersContractSource).toContain("Pick<Channel, 'channelId' | 'pairingAccountId' | 'pluginStatus'>")
    expect(stateHelpersContractSource).toContain('shouldShowRepairAction: ChannelsPageRepairActionVisibilityResolver<Channel>')
    expect(stateHelpersContractSource).toContain('getSharedStatusAlert: ChannelsPageSharedStatusAlertResolver<Channel>')
    expect(stateHelpersContractSource).toContain("current: Pick<Channel, 'id'> | null | undefined")
    expect(stateHelpersContractSource).toContain('resolveLatestChannelSnapshot: ChannelsPageLatestChannelSnapshotResolver<Channel>')
    expect(stateHelpersContractSource).toContain('extends ChannelsPageFetchChannelsBinding<Channel>,')
    expect(stateHelpersContractSource).toContain('ChannelsPageLatestChannelSnapshotResolverBinding<Channel> {}')
    expect(stateHelpersContractSource).toContain('extends ChannelsPageManagedStatusResolvers<ResolverChannel>,')
    expect(stateHelpersContractSource).toContain('ChannelsPageLatestChannelSnapshotAccessBinding<AccessChannel> {}')
    expect(stateHelpersContractSource).toContain('fallbackChannel?: ChannelsPageNullableChannel<Channel>')
    expect(stateHelpersContractSource).toContain('repairingPluginChannelId?: string | null')
    expect(stateHelpersContractSource).toContain('statusPending: boolean')
    expect(stateHelpersContractSource).toContain('missingAfterRefresh: boolean')
    expect(stateHelpersContractSource).toContain(
      'extends ChannelsPageStateHelperFallbackChannelBinding<Channel>,'
    )
    expect(stateHelpersContractSource).toContain(
      'ChannelsPageStateHelperRepairingPluginChannelBinding {'
    )
    expect(stateHelpersContractSource).toContain(
      'extends ChannelsPageStateHelperRefreshStatusBinding,'
    )
    expect(stateHelpersContractSource).toContain(
      'ChannelsPageStateHelperBlockedBySharedStatusBinding {'
    )
    expect(stateHelpersContractSource).toContain(
      'ChannelsPageStateHelperRepairStateBinding {'
    )
    expect(stateHelpersContractSource).toContain('ChannelsPagePairingKeyBinding {')
    expect(stateHelpersContractSource).toContain('targetChannel: ChannelsPageNullableChannel<Channel>')
    expect(stateHelpersContractSource).toContain('channelForSurface: ChannelsPageNullableChannel<Channel>')
    expect(stateHelpersContractSource).toContain('sharedStatusAlert: ChannelsPageSharedStatusAlert | null')
    expect(stateHelpersContractSource).toContain('extends ChannelsPageChannelEnabledBinding,')
    expect(stateHelpersContractSource).toContain('canRepair: boolean')
    expect(stateHelpersContractSource).toContain('repairing: boolean')
    expect(stateHelpersContractSource).toContain('pairingState: ChannelsPagePairingState')
    expect(stateHelpersContractSource).toContain('ChannelsPagePairingRequirementBinding {')
    expect(stateHelpersContractSource).toContain('includePairingState?: boolean')
    expect(stateHelpersContractSource).toContain('includeProvisionSource?: boolean')
    expect(stateHelpersContractSource).toContain('provisionSource?: ChannelsPageProvisionSource')
    expect(stateHelpersContractSource).toContain('channel: ChannelsPageChannelStatusBadgeChannel | null | undefined')
    expect(stateHelpersContractSource).toContain(') => ChannelsPageChannelStatusBadgeDescriptor[]')
    expect(stateHelpersContractSource).toContain('deriveChannelStatusBadges: ChannelsPageChannelStatusBadgeDeriver')
  })
})
