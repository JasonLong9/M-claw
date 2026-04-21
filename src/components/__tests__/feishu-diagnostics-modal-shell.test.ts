import { describe, expect, it } from 'vitest'

import diagnosticsShellSource from '../FeishuDiagnosticsModalShell.tsx?raw'

describe('FeishuDiagnosticsModalShell', () => {
  it('keeps the shared diagnostics-shell contract for pending, missing, and ready diagnostics states', () => {
    expect(diagnosticsShellSource).toContain("import FeishuDiagnosticsModal, {")
    expect(diagnosticsShellSource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(diagnosticsShellSource).toContain('opened: boolean')
    expect(diagnosticsShellSource).toContain('pending: boolean')
    expect(diagnosticsShellSource).toContain('pendingTitle: string')
    expect(diagnosticsShellSource).toContain('missing: boolean')
    expect(diagnosticsShellSource).toContain('missingTitle: string')
    expect(diagnosticsShellSource).toContain('refreshing?: boolean')
    expect(diagnosticsShellSource).toContain('onRefreshMissing?: (() => void) | null')
    expect(diagnosticsShellSource).toContain('accountId?: string')
    expect(diagnosticsShellSource).toContain('botLabel?: string')
    expect(diagnosticsShellSource).toContain('onRepairSharedStatus?: (() => Promise<FeishuDiagnosticsRepairOutcome>) | null')
  })

  it('renders one shared diagnostics shell that switches between gate modals and the live diagnostics modal', () => {
    expect(diagnosticsShellSource).toContain('if (!opened) return null')
    expect(diagnosticsShellSource).toContain('if (pending) {')
    expect(diagnosticsShellSource).toContain('title={pendingTitle}')
    expect(diagnosticsShellSource).toContain('<FeishuTargetGateAlert state="pending" surface="diagnostics" />')
    expect(diagnosticsShellSource).toContain('if (missing) {')
    expect(diagnosticsShellSource).toContain('title={missingTitle}')
    expect(diagnosticsShellSource).toContain('refreshing={refreshing}')
    expect(diagnosticsShellSource).toContain('onRefresh={onRefreshMissing}')
    expect(diagnosticsShellSource).toContain('onSecondaryAction={onClose}')
    expect(diagnosticsShellSource).toContain("botLabel = 'Feishu bot'")
    expect(diagnosticsShellSource).toContain('if (!accountId) return null')
    expect(diagnosticsShellSource).toContain('<FeishuDiagnosticsModal')
    expect(diagnosticsShellSource).toContain('sharedStatusAlert={sharedStatusAlert}')
    expect(diagnosticsShellSource).toContain('repairingSharedStatus={repairingSharedStatus}')
  })
})
