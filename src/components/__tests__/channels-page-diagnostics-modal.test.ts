import { describe, expect, it } from 'vitest'

import diagnosticsModalSource from '../ChannelsPageDiagnosticsModal.tsx?raw'

describe('ChannelsPageDiagnosticsModal', () => {
  it('keeps the shared diagnostics wrapper contract for target state, helper derivation, and repair gating', () => {
    expect(diagnosticsModalSource).toContain("import type { FeishuDiagnosticsRepairOutcome } from './FeishuDiagnosticsModal'")
    expect(diagnosticsModalSource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(diagnosticsModalSource).toContain("import FeishuDiagnosticsModalShell from './FeishuDiagnosticsModalShell'")
    expect(diagnosticsModalSource).toContain('opened: boolean')
    expect(diagnosticsModalSource).toContain('channel: ChannelsPageDiagnosticsModalChannel | null')
    expect(diagnosticsModalSource).toContain('fallbackChannel?: ChannelsPageDiagnosticsModalChannel | null')
    expect(diagnosticsModalSource).toContain('targetKey: string')
    expect(diagnosticsModalSource).toContain('canRepairSharedStatus?: boolean')
    expect(diagnosticsModalSource).toContain('getTitle: (')
    expect(diagnosticsModalSource).toContain('getBotLabel: (')
    expect(diagnosticsModalSource).toContain('onRefreshMissing: () => void')
    expect(diagnosticsModalSource).toContain('onRepairSharedStatus: () => Promise<FeishuDiagnosticsRepairOutcome>')
  })

  it('renders one shared diagnostics wrapper that computes shell props from the page helper layer', () => {
    expect(diagnosticsModalSource).toContain('<FeishuDiagnosticsModalShell')
    expect(diagnosticsModalSource).toContain('pendingTitle={getTitle(channel, fallbackChannel)}')
    expect(diagnosticsModalSource).toContain('missingTitle={getTitle(fallbackChannel)}')
    expect(diagnosticsModalSource).toContain('onRefreshMissing={targetKey ? onRefreshMissing : null}')
    expect(diagnosticsModalSource).toContain('accountId={channel?.pairingAccountId || undefined}')
    expect(diagnosticsModalSource).toContain('botLabel={getBotLabel(channel, fallbackChannel)}')
    expect(diagnosticsModalSource).toContain('agentId={channel?.agentId}')
    expect(diagnosticsModalSource).toContain('sharedStatusAlert={sharedStatusAlert}')
    expect(diagnosticsModalSource).toContain('repairingSharedStatus={repairingSharedStatus}')
    expect(diagnosticsModalSource).toContain('onRepairSharedStatus={canRepairSharedStatus && channel ? onRepairSharedStatus : null}')
  })
})
