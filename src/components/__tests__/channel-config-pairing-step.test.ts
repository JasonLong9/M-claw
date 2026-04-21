import { describe, expect, it } from 'vitest'

import channelConfigPairingStepSource from '../ChannelConfigPairingStep.tsx?raw'

describe('ChannelConfigPairingStep', () => {
  it('keeps the shared config-pairing step contract for target state, shared repair state, and gate routing', () => {
    expect(channelConfigPairingStepSource).toContain("import PairingCode from '../pages/PairingCode'")
    expect(channelConfigPairingStepSource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(channelConfigPairingStepSource).toContain('target: ChannelConfigPairingTarget | null')
    expect(channelConfigPairingStepSource).toContain('introTitle: string')
    expect(channelConfigPairingStepSource).toContain('introMessage: string')
    expect(channelConfigPairingStepSource).toContain('sharedStatusAlert?: FeishuSharedStatusAlertState | null')
    expect(channelConfigPairingStepSource).toContain('statusPending: boolean')
    expect(channelConfigPairingStepSource).toContain('missingAfterRefresh: boolean')
    expect(channelConfigPairingStepSource).toContain('blockedBySharedStatus: boolean')
    expect(channelConfigPairingStepSource).toContain('onRefreshMissing?: (() => void) | null')
    expect(channelConfigPairingStepSource).toContain('onBackToChannelConnect: () => void')
    expect(channelConfigPairingStepSource).toContain('onComplete: () => void')
  })

  it('renders one shared config-pairing step that switches between missing, gate, and pairing-code states', () => {
    expect(channelConfigPairingStepSource).toContain("if (!target?.channelId) {")
    expect(channelConfigPairingStepSource).toContain('title="Recently connected channel not found"')
    expect(channelConfigPairingStepSource).toContain('<ChannelConfigPairingSummary')
    expect(channelConfigPairingStepSource).toContain('<FeishuTargetGateAlert state="pending" surface="config-pairing" />')
    expect(channelConfigPairingStepSource).toContain('surface="config-pairing"')
    expect(channelConfigPairingStepSource).toContain('onRefresh={onRefreshMissing}')
    expect(channelConfigPairingStepSource).toContain('onSecondaryAction={onBackToChannelConnect}')
    expect(channelConfigPairingStepSource).toContain('<FeishuTargetGateAlert state="blocked" surface="config-pairing" />')
    expect(channelConfigPairingStepSource).toContain('<PairingCode')
    expect(channelConfigPairingStepSource).toContain('onBack={onBackToChannelConnect}')
    expect(channelConfigPairingStepSource).toContain('onComplete={onComplete}')
    expect(channelConfigPairingStepSource).toContain('onSkip={onComplete}')
  })
})
