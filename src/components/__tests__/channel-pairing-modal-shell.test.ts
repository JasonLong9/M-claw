import { describe, expect, it } from 'vitest'

import pairingModalShellSource from '../ChannelPairingModalShell.tsx?raw'

describe('ChannelPairingModalShell', () => {
  it('keeps the shared pairing-modal shell contract for summary, target gates, and pairing completion', () => {
    expect(pairingModalShellSource).toContain("import PairingCode from '../pages/PairingCode'")
    expect(pairingModalShellSource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(pairingModalShellSource).toContain('opened: boolean')
    expect(pairingModalShellSource).toContain('channel: ChannelPairingModalChannel | null')
    expect(pairingModalShellSource).toContain('targetKey?: string')
    expect(pairingModalShellSource).toContain('summary: string')
    expect(pairingModalShellSource).toContain('sharedStatusAlert?: FeishuSharedStatusAlertState | null')
    expect(pairingModalShellSource).toContain('pending: boolean')
    expect(pairingModalShellSource).toContain('missing: boolean')
    expect(pairingModalShellSource).toContain('blocked: boolean')
    expect(pairingModalShellSource).toContain('onRefreshMissing?: (() => void) | null')
    expect(pairingModalShellSource).toContain('onComplete: () => void')
  })

  it('renders one shared pairing-modal shell that switches between gate alerts and dashboard pairing', () => {
    expect(pairingModalShellSource).toContain('if (!channel && !targetKey) return null')
    expect(pairingModalShellSource).toContain("title={channel?.name ? `${channel.name} pairing` : 'Channel pairing'}")
    expect(pairingModalShellSource).toContain('<ChannelPairingModalSummary')
    expect(pairingModalShellSource).toContain('<FeishuTargetGateAlert state="pending" surface="pairing-modal" />')
    expect(pairingModalShellSource).toContain('surface="pairing-modal"')
    expect(pairingModalShellSource).toContain('refreshing={refreshing}')
    expect(pairingModalShellSource).toContain('onRefresh={onRefreshMissing}')
    expect(pairingModalShellSource).toContain('onSecondaryAction={onClose}')
    expect(pairingModalShellSource).toContain('<FeishuTargetGateAlert state="blocked" surface="pairing-modal" />')
    expect(pairingModalShellSource).toContain('<PairingCode')
    expect(pairingModalShellSource).toContain('surface="dashboard"')
    expect(pairingModalShellSource).toContain('onBack={onClose}')
    expect(pairingModalShellSource).toContain('onComplete={onComplete}')
    expect(pairingModalShellSource).toContain('showSkip={false}')
  })
})
