import { describe, expect, it } from 'vitest'

import channelActionsContractSource from '../channels-page-channel-actions-contract.ts?raw'

describe('channels-page-channel-actions-contract module', () => {
  it('keeps the channel-actions input and output contract behind one dedicated module', () => {
    expect(channelActionsContractSource).toContain("import type {")
    expect(channelActionsContractSource).toContain('ChannelsPageAccountNameBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageChannelEnabledBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageChannelIdentityBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageChannelNameBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageConfigChannelBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageFetchChannelsBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageOnPageErrorBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPagePairingAccountBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPagePendingChannelId,')
    expect(channelActionsContractSource).toContain("} from './channels-page-data-contract'")
    expect(channelActionsContractSource).toContain(
      "import type { ChannelsPageTargetModalOpenHandlers } from './channels-page-target-modals-contract'"
    )
    expect(channelActionsContractSource).toContain('export interface ChannelsPageChannelActionChannel')
    expect(channelActionsContractSource).toContain(
      'export interface ChannelsPageChannelActionsOptions<Channel extends ChannelsPageChannelActionChannel>'
    )
    expect(channelActionsContractSource).toContain(
      'export type ChannelsPageAsyncChannelActionHandler<Channel> = (channel: Channel) => Promise<void>'
    )
    expect(channelActionsContractSource).toContain(
      'export type ChannelsPageSurfaceChannelActionHandler<Channel> = ('
    )
    expect(channelActionsContractSource).toContain('export interface ChannelsPageChannelSurfaceActionHandlers<Channel>')
    expect(channelActionsContractSource).toContain('export interface ChannelsPageTogglingChannelBinding {')
    expect(channelActionsContractSource).toContain(
      'export interface ChannelsPageChannelActionsResult<Channel extends ChannelsPageChannelActionChannel>'
    )
    expect(channelActionsContractSource).toContain(
      'export interface ChannelsPageChannelActionChannel'
    )
    expect(channelActionsContractSource).toContain('ChannelsPageAccountNameBinding {}')
  })

  it('keeps fetch, page-error, and mutation handler fields in the shared channel-actions contract module', () => {
    expect(channelActionsContractSource).toContain('extends ChannelsPageChannelIdentityBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageChannelEnabledBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageChannelNameBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageConfigChannelBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPagePairingAccountBinding,')
    expect(channelActionsContractSource).toContain('ChannelsPageAccountNameBinding {}')
    expect(channelActionsContractSource).toContain('extends ChannelsPageFetchChannelsBinding<Channel>,')
    expect(channelActionsContractSource).toContain('ChannelsPageOnPageErrorBinding {}')
    expect(channelActionsContractSource).not.toContain('onPageError: ChannelsPagePageErrorHandler')
    expect(channelActionsContractSource).toContain('extends ChannelsPageTargetModalOpenHandlers<Channel> {')
    expect(channelActionsContractSource).toContain(') => Promise<unknown> | void')
    expect(channelActionsContractSource).toContain(
      'handleOpenModelConfig: ChannelsPageSurfaceChannelActionHandler<Channel>'
    )
    expect(channelActionsContractSource).toContain(
      'handleRepairFeishuPlugin: ChannelsPageSurfaceChannelActionHandler<Channel>'
    )
    expect(channelActionsContractSource).toContain('togglingChannelId: ChannelsPagePendingChannelId')
    expect(channelActionsContractSource).toContain('extends ChannelsPageTogglingChannelBinding {')
    expect(channelActionsContractSource).toContain('handleRemoveChannel: ChannelsPageAsyncChannelActionHandler<Channel>')
    expect(channelActionsContractSource).toContain('handleToggleChannelEnabled: ChannelsPageAsyncChannelActionHandler<Channel>')
  })
})
