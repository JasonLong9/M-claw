import { describe, expect, it } from 'vitest'

import configModalSource from '../ChannelsPageConfigModal.tsx?raw'

describe('ChannelsPageConfigModal', () => {
  it('keeps the shared config wrapper contract for connect-step advance, pairing intro derivation, and refresh or repair gating', () => {
    expect(configModalSource).toContain("import ChannelConfigModalShell from './ChannelConfigModalShell'")
    expect(configModalSource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(configModalSource).toContain("import type { ChannelConnectNextPayload } from '../pages/ChannelConnect'")
    expect(configModalSource).toContain('getPairingIntroCopy,')
    expect(configModalSource).toContain('resolveChannelConnectAdvance,')
    expect(configModalSource).toContain('type ChannelPairingTarget,')
    expect(configModalSource).toContain('type ChannelsConfigStep,')
    expect(configModalSource).toContain('configStep: ChannelsConfigStep')
    expect(configModalSource).toContain('selectedTarget: ChannelPairingTarget | null')
    expect(configModalSource).toContain('refreshTargetKey: string')
    expect(configModalSource).toContain('canRepairSharedStatus?: boolean')
    expect(configModalSource).toContain('onSelectChannelId: (value: string | null) => void')
    expect(configModalSource).toContain('onSelectTarget: (value: ChannelPairingTarget | null) => void')
    expect(configModalSource).toContain('onSetConfigStep: (value: ChannelsConfigStep) => void')
  })

  it('renders one shared config wrapper that computes pairing intro and delegates the shell wiring', () => {
    expect(configModalSource).toContain('const pairingIntro = getPairingIntroCopy(selectedTarget)')
    expect(configModalSource).toContain('const handleChannelConnectNext = (payload: ChannelConnectNextPayload) => {')
    expect(configModalSource).toContain('const advance = resolveChannelConnectAdvance({')
    expect(configModalSource).toContain('if (advance.shouldComplete) {')
    expect(configModalSource).toContain('onSelectChannelId(advance.selectedTarget?.channelId || null)')
    expect(configModalSource).toContain('onSelectTarget(advance.selectedTarget)')
    expect(configModalSource).toContain('onSetConfigStep(advance.nextStep)')
    expect(configModalSource).toContain('<ChannelConfigModalShell')
    expect(configModalSource).toContain('onChannelConnectNext={handleChannelConnectNext}')
    expect(configModalSource).toContain('pairingIntroTitle={pairingIntro.title}')
    expect(configModalSource).toContain('pairingIntroMessage={pairingIntro.message}')
    expect(configModalSource).toContain('sharedStatusRepairHint="如共享飞书运行时阻塞，请先在这里一键修复；刷新共享状态后再继续配对。"')
    expect(configModalSource).toContain('onRepairSharedStatus={canRepairSharedStatus ? onRepairSharedStatus : null}')
    expect(configModalSource).toContain('onRefreshMissing={refreshTargetKey ? onRefreshMissing : null}')
    expect(configModalSource).toContain("onBackToChannelConnect={() => onSetConfigStep('channel-connect')}")
    expect(configModalSource).toContain('completeLabel="开始对话"')
  })
})
