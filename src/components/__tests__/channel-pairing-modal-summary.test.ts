import { describe, expect, it } from 'vitest'

import channelPairingModalSummarySource from '../ChannelPairingModalSummary.tsx?raw'

describe('ChannelPairingModalSummary', () => {
  it('keeps the shared pairing-summary contract for badges, shared status, and runtime state', () => {
    expect(channelPairingModalSummarySource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(channelPairingModalSummarySource).toContain('badges: Array<{')
    expect(channelPairingModalSummarySource).toContain('summary: string')
    expect(channelPairingModalSummarySource).toContain('sharedStatusAlert?: FeishuSharedStatusAlertState | null')
    expect(channelPairingModalSummarySource).toContain('sharedStatusRepairHint?: string')
    expect(channelPairingModalSummarySource).toContain('sharedStatusRepairing?: boolean')
    expect(channelPairingModalSummarySource).toContain('onRepairSharedStatus?: (() => void) | null')
    expect(channelPairingModalSummarySource).toContain('runtimeSummary?: string')
    expect(channelPairingModalSummarySource).toContain('runtimeSummaryColor?: string')
  })

  it('renders one shared summary block with badge rows, shared-status repair wiring, and runtime alert copy', () => {
    expect(channelPairingModalSummarySource).toContain('{badges.map((badge) => (')
    expect(channelPairingModalSummarySource).toContain('{summary}')
    expect(channelPairingModalSummarySource).toContain('<FeishuSharedStatusAlert')
    expect(channelPairingModalSummarySource).toContain('repairHint={sharedStatusRepairHint}')
    expect(channelPairingModalSummarySource).toContain('repairing={sharedStatusRepairing}')
    expect(channelPairingModalSummarySource).toContain('onRepair={onRepairSharedStatus}')
    expect(channelPairingModalSummarySource).toContain('title="当前运行时状态"')
    expect(channelPairingModalSummarySource).toContain('{runtimeSummary}')
  })
})
