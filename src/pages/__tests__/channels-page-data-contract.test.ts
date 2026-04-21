import { describe, expect, it } from 'vitest'

import dataContractSource from '../channels-page-data-contract.ts?raw'

describe('channels-page-data-contract module', () => {
  it('keeps the data types plus the data-hook input and output contract behind one dedicated module', () => {
    expect(dataContractSource).toContain("import type { Dispatch, SetStateAction } from 'react'")
    expect(dataContractSource).toContain("import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'")
    expect(dataContractSource).toContain("export type FeishuRuntimeStatusState = 'online' | 'offline' | 'degraded' | 'disabled'")
    expect(dataContractSource).toContain("export type ChannelsPagePairingState = 'paired' | 'pending' | 'not_required'")
    expect(dataContractSource).toContain("export type ChannelsPageProvisionSource = 'created' | 'linked' | 'unknown'")
    expect(dataContractSource).toContain('export interface ChannelsPagePairingRequirementBinding {')
    expect(dataContractSource).toContain('export interface ChannelsPagePairingAccountBinding {')
    expect(dataContractSource).toContain('export interface ChannelsPageChannelIdentityBinding {')
    expect(dataContractSource).toContain('export interface ChannelsPageChannelEnabledBinding {')
    expect(dataContractSource).toContain('export interface ChannelsPageChannelNameBinding {')
    expect(dataContractSource).toContain('export interface ChannelsPageConfigChannelBinding {')
    expect(dataContractSource).toContain('export interface ChannelsPageAgentBinding {')
    expect(dataContractSource).toContain('export interface ChannelsPageAccountNameBinding {')
    expect(dataContractSource).toContain('export interface ChannelsPageChannelInfo')
    expect(dataContractSource).toContain('export interface ChannelsPageSnapshot {')
    expect(dataContractSource).toContain(
      'export type ChannelsPageChannelSnapshotsSyncHandler<Channel> = (nextChannels: Channel[]) => void'
    )
    expect(dataContractSource).toContain('export interface ChannelsPageDataOptions {')
    expect(dataContractSource).toContain('export interface ChannelsPageFetchChannelsOptions {')
    expect(dataContractSource).toContain('export type ChannelsPageFetchChannels<Channel> = (')
    expect(dataContractSource).toContain('export interface ChannelsPageFetchChannelsBinding<Channel> {')
    expect(dataContractSource).toContain('export interface ChannelsPageChannelsBinding<Channel> {')
    expect(dataContractSource).toContain('export type ChannelsPageNullableChannel<Channel> = Channel | null')
    expect(dataContractSource).toContain('export type ChannelsPageNullableStringSetter = Dispatch<SetStateAction<string | null>>')
    expect(dataContractSource).toContain('export type ChannelsPagePendingChannelId = string | null')
    expect(dataContractSource).toContain('export interface ChannelsPageLoadingBinding {')
    expect(dataContractSource).toContain('export type ChannelsPagePageErrorHandler = (message: string) => void')
    expect(dataContractSource).toContain('export interface ChannelsPageSetPageErrorBinding {')
    expect(dataContractSource).toContain('export interface ChannelsPageOnPageErrorBinding {')
    expect(dataContractSource).toContain('export type ChannelsPageVoidHandler = () => void')
    expect(dataContractSource).toContain('export type ChannelsPageAsyncVoidHandler = () => Promise<void>')
    expect(dataContractSource).toContain('export type ChannelsPageRefreshChannelsHandler = ChannelsPageAsyncVoidHandler')
    expect(dataContractSource).toContain('export interface ChannelsPageRefreshFeedbackBinding {')
    expect(dataContractSource).toContain(
      'export interface ChannelsPageDataResult'
    )
    expect(dataContractSource).toContain(
      'syncSelectedChannelSnapshots: ChannelsPageChannelSnapshotsSyncHandler<ChannelsPageChannelInfo>'
    )
  })

  it('keeps channel state, plugin status fields, fetch lifecycle, and page-error actions in the shared data contract module', () => {
    expect(dataContractSource).toContain('pluginStatus?: ManagedChannelPluginStatusView | null')
    expect(dataContractSource).toContain('pairingState: ChannelsPagePairingState')
    expect(dataContractSource).toContain('extends ChannelsPageChannelIdentityBinding,')
    expect(dataContractSource).toContain('ChannelsPageChannelEnabledBinding,')
    expect(dataContractSource).toContain('ChannelsPageChannelNameBinding,')
    expect(dataContractSource).toContain('ChannelsPageConfigChannelBinding,')
    expect(dataContractSource).toContain('ChannelsPageAgentBinding,')
    expect(dataContractSource).toContain('ChannelsPageAccountNameBinding,')
    expect(dataContractSource).toContain('ChannelsPagePairingRequirementBinding,')
    expect(dataContractSource).toContain('ChannelsPagePairingAccountBinding {')
    expect(dataContractSource).toContain('provisionSource?: ChannelsPageProvisionSource')
    expect(dataContractSource).toContain('channels: ChannelsPageChannelInfo[]')
    expect(dataContractSource).toContain('channels: ChannelsPageChannelInfo[]')
    expect(dataContractSource).toContain('loading: boolean')
    expect(dataContractSource).toContain('refreshing: boolean')
    expect(dataContractSource).toContain('error: string')
    expect(dataContractSource).toContain('legacyFeishuAgentIds: string[]')
    expect(dataContractSource).toContain('setError: Dispatch<SetStateAction<string>>')
    expect(dataContractSource).toContain('background?: boolean')
    expect(dataContractSource).toContain('options?: ChannelsPageFetchChannelsOptions')
    expect(dataContractSource).toContain('fetchChannels: ChannelsPageFetchChannels<Channel>')
    expect(dataContractSource).toContain('channels: Channel[]')
    expect(dataContractSource).toContain('export type ChannelsPageNullableChannel<Channel> = Channel | null')
    expect(dataContractSource).toContain(
      'export type ChannelsPageChannelSnapshotsSyncHandler<Channel> = (nextChannels: Channel[]) => void'
    )
    expect(dataContractSource).toContain('export type ChannelsPageNullableStringSetter = Dispatch<SetStateAction<string | null>>')
    expect(dataContractSource).toContain('export type ChannelsPagePendingChannelId = string | null')
    expect(dataContractSource).toContain('export interface ChannelsPageLoadingBinding {')
    expect(dataContractSource).toContain('export type ChannelsPagePageErrorHandler = (message: string) => void')
    expect(dataContractSource).toContain('onPageError: ChannelsPagePageErrorHandler')
    expect(dataContractSource).toContain('export type ChannelsPageVoidHandler = () => void')
    expect(dataContractSource).toContain('export type ChannelsPageAsyncVoidHandler = () => Promise<void>')
    expect(dataContractSource).toContain('export type ChannelsPageRefreshChannelsHandler = ChannelsPageAsyncVoidHandler')
    expect(dataContractSource).toContain(
      'extends ChannelsPageFetchChannelsBinding<ChannelsPageChannelInfo>,'
    )
    expect(dataContractSource).toContain('ChannelsPageChannelsBinding<ChannelsPageChannelInfo>,')
    expect(dataContractSource).toContain('ChannelsPageRefreshFeedbackBinding {')
    expect(dataContractSource).toContain('ChannelsPageLoadingBinding {')
    expect(dataContractSource).toContain('handleRefreshChannels: ChannelsPageRefreshChannelsHandler')
  })
})
