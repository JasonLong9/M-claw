import { describe, expect, it } from 'vitest'

import feishuTargetRefreshContractSource from '../channels-page-feishu-target-refresh-contract.ts?raw'

describe('channels-page-feishu-target-refresh-contract module', () => {
  it('keeps the target-refresh bindings plus input and output contracts behind one dedicated module', () => {
    expect(feishuTargetRefreshContractSource).toContain("import type { MutableRefObject } from 'react'")
    expect(feishuTargetRefreshContractSource).toContain("import type { ChannelPairingTargetRef } from './channels-page-utils'")
    expect(feishuTargetRefreshContractSource).toContain('export interface FeishuTargetRefreshBindings {')
    expect(feishuTargetRefreshContractSource).toContain('export type ChannelsPageFeishuTargetRefreshChannels = () => Promise<unknown>')
    expect(feishuTargetRefreshContractSource).toContain('export interface ChannelsPageFeishuTargetRefreshChannelsBinding {')
    expect(feishuTargetRefreshContractSource).toContain(
      'export type ChannelsPageTargetRefInput = ChannelPairingTargetRef | null | undefined'
    )
    expect(feishuTargetRefreshContractSource).toContain(
      'export interface ChannelsPageFeishuTargetRefreshOptions'
    )
    expect(feishuTargetRefreshContractSource).toContain(
      'export interface ChannelsPageFeishuTargetSelectionBinding {'
    )
    expect(feishuTargetRefreshContractSource).toContain('export interface ChannelsPageFeishuTargetRefreshControls {')
    expect(feishuTargetRefreshContractSource).toContain(
      'export interface ChannelsPageFeishuTargetRefreshResult'
    )
    expect(feishuTargetRefreshContractSource).toContain('export interface ChannelsPagePairingKeyBinding {')
    expect(feishuTargetRefreshContractSource).toContain('target: ChannelsPageTargetRefInput')
  })

  it('keeps guarded refresh binding setters and refresh result fields in the shared contract module', () => {
    expect(feishuTargetRefreshContractSource).toContain('requestIdRef: MutableRefObject<number>')
    expect(feishuTargetRefreshContractSource).toContain('setRefreshing: (value: boolean) => void')
    expect(feishuTargetRefreshContractSource).toContain('setCheckedKey: (value: string) => void')
    expect(feishuTargetRefreshContractSource).toContain('refreshChannels: ChannelsPageFeishuTargetRefreshChannels')
    expect(feishuTargetRefreshContractSource).toContain(
      'extends ChannelsPageFeishuTargetRefreshChannelsBinding,'
    )
    expect(feishuTargetRefreshContractSource).toContain(
      'ChannelsPageFeishuTargetSelectionBinding {}'
    )
    expect(feishuTargetRefreshContractSource).toContain('active: boolean')
    expect(feishuTargetRefreshContractSource).toContain(
      'export type ChannelsPageTargetRefInput = ChannelPairingTargetRef | null | undefined'
    )
    expect(feishuTargetRefreshContractSource).toContain(
      'extends ChannelsPageFeishuTargetRefreshControls,'
    )
    expect(feishuTargetRefreshContractSource).toContain('ChannelsPagePairingKeyBinding {')
    expect(feishuTargetRefreshContractSource).toContain('pairingKey: string')
    expect(feishuTargetRefreshContractSource).toContain('refreshingTargetChannel: boolean')
    expect(feishuTargetRefreshContractSource).toContain('checkedTargetKey: string')
    expect(feishuTargetRefreshContractSource).toContain("refreshTargetChannelStatus: (pairingKey: string) => Promise<void>")
  })
})
