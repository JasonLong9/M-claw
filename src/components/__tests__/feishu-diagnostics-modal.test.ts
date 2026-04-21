import { describe, expect, it } from 'vitest'

import modalSource from '../FeishuDiagnosticsModal.tsx?raw'

describe('FeishuDiagnosticsModal', () => {
  it('accepts the shared feishu status alert and exposes an inline repair hook for blocked channels', () => {
    expect(modalSource).toContain("import FeishuSharedStatusAlert, { type FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(modalSource).toContain('sharedStatusAlert?: FeishuSharedStatusAlertState | null')
    expect(modalSource).toContain('repairingSharedStatus?: boolean')
    expect(modalSource).toContain('onRepairSharedStatus?: (() => Promise<FeishuDiagnosticsRepairOutcome>) | null')
    expect(modalSource).toContain('const probeBlockedBySharedStatus = Boolean(sharedStatusAlert)')
    expect(modalSource).toContain('{sharedStatusAlert && (')
    expect(modalSource).toContain('<FeishuSharedStatusAlert')
    expect(modalSource).toContain('alert={sharedStatusAlert}')
    expect(modalSource).toContain('repairHint="Run repair here, refresh the shared status, and then continue with the diagnostic probes."')
    expect(modalSource).toContain('repairDisabled={listening || sending}')
    expect(modalSource).toContain('onRepair={onRepairSharedStatus ? () => void handleRepairSharedStatus() : null}')
  })

  it('keeps the existing diagnostics actions while gating probes behind the shared-status repair and refreshing local context after repair', () => {
    expect(modalSource).toContain('window.api.listenFeishuBotDiagnosticActivity')
    expect(modalSource).toContain('window.api.sendFeishuDiagnosticMessage')
    expect(modalSource).toContain("title=\"Probe blocked\"")
    expect(modalSource).toContain('disabled={sending || probeBlockedBySharedStatus}')
    expect(modalSource).toContain('disabled={!selectedOpenId || listening || probeBlockedBySharedStatus}')
    expect(modalSource).toContain('await loadPairedAccounts()')
    expect(modalSource).toContain('setRepairResult(result)')
  })
})
