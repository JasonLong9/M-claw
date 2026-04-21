import { describe, expect, it } from 'vitest'

import pairingModalSource from '../ChannelsPagePairingModal.tsx?raw'

describe('ChannelsPagePairingModal', () => {
  it('keeps the shared pairing-modal wrapper contract for pairing state, helper derivation, and shared-status repair wiring', () => {
    expect(pairingModalSource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(pairingModalSource).toContain("import ChannelPairingModalShell from './ChannelPairingModalShell'")
    expect(pairingModalSource).toContain('opened: boolean')
    expect(pairingModalSource).toContain('channel: ChannelsPagePairingModalChannel | null')
    expect(pairingModalSource).toContain('targetKey: string')
    expect(pairingModalSource).toContain('canRepairSharedStatus?: boolean')
    expect(pairingModalSource).toContain('getBadges: (channel: ChannelsPagePairingModalChannel | null | undefined) => ChannelsPagePairingModalBadge[]')
    expect(pairingModalSource).toContain('getSummary: (channel: ChannelsPagePairingModalChannel | null | undefined) => string')
    expect(pairingModalSource).toContain("getRuntimeSummaryColor: (state: ChannelsPagePairingModalChannel['runtimeState']) => string")
    expect(pairingModalSource).toContain('onRepairSharedStatus: () => void')
    expect(pairingModalSource).toContain('onRefreshMissing: () => void')
    expect(pairingModalSource).toContain('onComplete: () => void')
  })

  it('renders one shared pairing-modal wrapper that computes shell props from the page helper layer', () => {
    expect(pairingModalSource).toContain('<ChannelPairingModalShell')
    expect(pairingModalSource).toContain('badges={getBadges(channel)}')
    expect(pairingModalSource).toContain('summary={getSummary(channel)}')
    expect(pairingModalSource).toContain('sharedStatusRepairHint="如共享飞书运行时阻塞，请先在这里一键修复；刷新共享状态后再继续配对。"')
    expect(pairingModalSource).toContain('onRepairSharedStatus={canRepairSharedStatus ? onRepairSharedStatus : null}')
    expect(pairingModalSource).toContain("runtimeSummary={channel?.channelId === 'feishu' ? channel.runtimeSummary : undefined}")
    expect(pairingModalSource).toContain('runtimeSummaryColor={getRuntimeSummaryColor(channel?.runtimeState)}')
    expect(pairingModalSource).toContain('refreshing={refreshing}')
    expect(pairingModalSource).toContain('onRefreshMissing={targetKey ? onRefreshMissing : null}')
    expect(pairingModalSource).toContain('onComplete={onComplete}')
  })
})
