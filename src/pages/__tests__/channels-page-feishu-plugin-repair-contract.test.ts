import { describe, expect, it } from 'vitest'

import feishuPluginRepairContractSource from '../channels-page-feishu-plugin-repair-contract.ts?raw'

describe('channels-page-feishu-plugin-repair-contract module', () => {
  it('keeps the plugin-repair input and output contract behind one dedicated module', () => {
    expect(feishuPluginRepairContractSource).toContain("import type { FeishuDiagnosticsRepairOutcome } from '../components/FeishuDiagnosticsModal'")
    expect(feishuPluginRepairContractSource).toContain(
      "import type { ChannelsPageAsyncChannelActionHandler } from './channels-page-channel-actions-contract'"
    )
    expect(feishuPluginRepairContractSource).toContain("import type {")
    expect(feishuPluginRepairContractSource).toContain('ChannelsPageChannelIdentityBinding,')
    expect(feishuPluginRepairContractSource).toContain('ChannelsPageOnPageErrorBinding,')
    expect(feishuPluginRepairContractSource).toContain('ChannelsPagePendingChannelId,')
    expect(feishuPluginRepairContractSource).toContain("} from './channels-page-data-contract'")
    expect(feishuPluginRepairContractSource).toContain('ChannelsPageManagedStatusAccessBinding,')
    expect(feishuPluginRepairContractSource).toContain("} from './channels-page-state-helpers-contract'")
    expect(feishuPluginRepairContractSource).toContain('export interface ChannelsPageFeishuPluginRepairChannel')
    expect(feishuPluginRepairContractSource).toContain(
      'export interface ChannelsPageFeishuPluginRepairOptions<Channel extends ChannelsPageFeishuPluginRepairChannel>'
    )
    expect(feishuPluginRepairContractSource).toContain("export type ChannelsPageFeishuPluginRepairSurface = 'page' | 'pairing' | 'diagnostics'")
    expect(feishuPluginRepairContractSource).toContain('export interface ChannelsPageFeishuPluginRepairRequestOptions {')
    expect(feishuPluginRepairContractSource).toContain('export type ChannelsPageFeishuPluginRepairHandler<Channel> = (')
    expect(feishuPluginRepairContractSource).toContain('export interface ChannelsPageFeishuPluginRepairBinding<Channel> {')
    expect(feishuPluginRepairContractSource).toContain('export interface ChannelsPageRepairingPluginChannelBinding {')
    expect(feishuPluginRepairContractSource).toContain(
      'export interface ChannelsPageFeishuPluginRepairResult<Channel extends ChannelsPageFeishuPluginRepairChannel>'
    )
    expect(feishuPluginRepairContractSource).toContain('extends ChannelsPageManagedStatusAccessBinding<Channel, Channel>,')
    expect(feishuPluginRepairContractSource).toContain('ChannelsPageOnPageErrorBinding {}')
  })

  it('reuses the shared managed-status helper interface for plugin-repair contract wiring', () => {
    expect(feishuPluginRepairContractSource).toContain('extends ChannelsPageChannelIdentityBinding {')
    expect(feishuPluginRepairContractSource).toContain('extends ChannelsPageManagedStatusAccessBinding<Channel, Channel>,')
    expect(feishuPluginRepairContractSource).toContain('ChannelsPageOnPageErrorBinding {}')
    expect(feishuPluginRepairContractSource).not.toContain('onPageError: ChannelsPagePageErrorHandler')
    expect(feishuPluginRepairContractSource).toContain('repairFeishuPlugin: ChannelsPageFeishuPluginRepairHandler<Channel>')
    expect(feishuPluginRepairContractSource).toContain('extends ChannelsPageFeishuPluginRepairBinding<Channel>,')
    expect(feishuPluginRepairContractSource).toContain('ChannelsPageRepairingPluginChannelBinding {')
    expect(feishuPluginRepairContractSource).toContain('repairingPluginChannelId: ChannelsPagePendingChannelId')
    expect(feishuPluginRepairContractSource).toContain('surface?: ChannelsPageFeishuPluginRepairSurface')
    expect(feishuPluginRepairContractSource).toContain('options?: ChannelsPageFeishuPluginRepairRequestOptions')
    expect(feishuPluginRepairContractSource).toContain(
      'handleRepairFeishuPlugin: ChannelsPageAsyncChannelActionHandler<Channel>'
    )
  })
})
