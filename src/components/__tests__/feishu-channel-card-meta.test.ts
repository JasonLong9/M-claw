import { describe, expect, it } from 'vitest'

import metaSource from '../FeishuChannelCardMeta.tsx?raw'

describe('FeishuChannelCardMeta', () => {
  it('keeps the shared Feishu card meta shell for provision, runtime, and shared-status details', () => {
    expect(metaSource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(metaSource).toContain('provisionDescription: string')
    expect(metaSource).toContain('showProvisionConfirmation?: boolean')
    expect(metaSource).toContain('runtimeSummary?: string')
    expect(metaSource).toContain('sharedStatusAlert?: FeishuSharedStatusAlertState | null')
  })

  it('renders one shared block for provision confirmation, runtime summary, and shared-status alert content', () => {
    expect(metaSource).toContain('{provisionDescription}')
    expect(metaSource).toContain('title="Provision source needs confirmation"')
    expect(metaSource).toContain('Runtime status: {runtimeSummary}')
    expect(metaSource).toContain('title={sharedStatusAlert.title}')
    expect(metaSource).toContain('{sharedStatusAlert.message}')
  })
})
