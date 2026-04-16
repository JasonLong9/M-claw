import { describe, expect, it } from 'vitest'
import { classifySendErrorCode } from '../chat-send-error-code'

describe('classifySendErrorCode', () => {
  it('keeps explicit gateway offline failures mapped to gateway-offline', () => {
    expect(classifySendErrorCode('gateway offline')).toBe('gateway-offline')
    expect(classifySendErrorCode('Gateway not running')).toBe('gateway-offline')
    expect(classifySendErrorCode('gateway service not loaded')).toBe('gateway-offline')
    expect(classifySendErrorCode('gateway connection refused')).toBe('gateway-offline')
  })

  it('does not misclassify generic gateway request failures as gateway-offline', () => {
    expect(classifySendErrorCode('gateway request failed')).toBe('command-failed')
    expect(classifySendErrorCode('gateway connect failed')).toBe('command-failed')
    expect(classifySendErrorCode('gateway websocket closed')).toBe('command-failed')
  })
})
