import { describe, expect, it } from 'vitest'

import { isTrackedCodingConversationSession } from './chat-task-mode-transition'

describe('isTrackedCodingConversationSession', () => {
  it('matches tracked session ids after trimming whitespace', () => {
    expect(isTrackedCodingConversationSession(' coding-session ', ['coding-session'])).toBe(true)
  })

  it('returns false for untracked session ids', () => {
    expect(isTrackedCodingConversationSession('plain-session', ['coding-session'])).toBe(false)
  })
})
