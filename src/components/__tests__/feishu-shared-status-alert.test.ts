import { describe, expect, it } from 'vitest'

import alertSource from '../FeishuSharedStatusAlert.tsx?raw'

describe('FeishuSharedStatusAlert', () => {
  it('keeps the shared alert contract focused on title, message, and the repair action shell', () => {
    expect(alertSource).toContain('export interface FeishuSharedStatusAlertState {')
    expect(alertSource).toContain("color: 'yellow' | 'red'")
    expect(alertSource).toContain('title: string')
    expect(alertSource).toContain('message: string')
    expect(alertSource).toContain('repairHint: string')
    expect(alertSource).toContain('repairDisabled?: boolean')
    expect(alertSource).toContain('onRepair?: (() => void) | null')
  })

  it('renders one shared repair CTA layout instead of duplicating alert markup per surface', () => {
    expect(alertSource).toContain('<Alert color={alert.color} variant="light" title={alert.title}>')
    expect(alertSource).toContain('<Text size="sm">{alert.message}</Text>')
    expect(alertSource).toContain('{repairHint}')
    expect(alertSource).toContain('loading={repairing}')
    expect(alertSource).toContain('disabled={repairDisabled}')
    expect(alertSource).toContain('onClick={onRepair}')
    expect(alertSource).toContain('修复飞书插件')
  })
})
