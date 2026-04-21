import { describe, expect, it } from 'vitest'
import {
  getOfficialChannelStageColor,
  getOfficialChannelStageLabel,
  getOfficialChannelStageStateLabel,
} from '../official-channel-status-view'

describe('official channel status view helpers', () => {
  it('maps the shared stage ids to user-facing labels', () => {
    expect(getOfficialChannelStageLabel('installed')).toBe('Installed')
    expect(getOfficialChannelStageLabel('registered')).toBe('Registered')
    expect(getOfficialChannelStageLabel('loaded')).toBe('Loaded')
    expect(getOfficialChannelStageLabel('ready')).toBe('Ready')
  })

  it('keeps unknown state explicit instead of pretending ready exists', () => {
    expect(getOfficialChannelStageStateLabel('verified')).toBe('Verified')
    expect(getOfficialChannelStageStateLabel('missing')).toBe('Missing')
    expect(getOfficialChannelStageStateLabel('unknown')).toBe('Unknown / unverified')
    expect(getOfficialChannelStageColor('verified')).toBe('teal')
    expect(getOfficialChannelStageColor('missing')).toBe('red')
    expect(getOfficialChannelStageColor('unknown')).toBe('gray')
  })
})