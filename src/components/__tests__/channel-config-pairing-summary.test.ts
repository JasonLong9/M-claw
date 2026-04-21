import { describe, expect, it } from 'vitest'

import channelConfigPairingSummarySource from '../ChannelConfigPairingSummary.tsx?raw'

describe('ChannelConfigPairingSummary', () => {
  it('keeps the shared config-pairing summary contract for intro copy and shared repair state', () => {
    expect(channelConfigPairingSummarySource).toContain("import type { FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'")
    expect(channelConfigPairingSummarySource).toContain('introTitle: string')
    expect(channelConfigPairingSummarySource).toContain('introMessage: string')
    expect(channelConfigPairingSummarySource).toContain('sharedStatusAlert?: FeishuSharedStatusAlertState | null')
    expect(channelConfigPairingSummarySource).toContain('sharedStatusRepairHint?: string')
    expect(channelConfigPairingSummarySource).toContain('sharedStatusRepairing?: boolean')
    expect(channelConfigPairingSummarySource).toContain('onRepairSharedStatus?: (() => void) | null')
  })

  it('renders one shared config-pairing summary block with the intro alert and shared-status repair wiring', () => {
    expect(channelConfigPairingSummarySource).toContain('color="success"')
    expect(channelConfigPairingSummarySource).toContain('title={introTitle}')
    expect(channelConfigPairingSummarySource).toContain('{introMessage}')
    expect(channelConfigPairingSummarySource).toContain('<FeishuSharedStatusAlert')
    expect(channelConfigPairingSummarySource).toContain('alert={sharedStatusAlert}')
    expect(channelConfigPairingSummarySource).toContain('repairHint={sharedStatusRepairHint}')
    expect(channelConfigPairingSummarySource).toContain('repairing={sharedStatusRepairing}')
    expect(channelConfigPairingSummarySource).toContain('onRepair={onRepairSharedStatus}')
  })
})
