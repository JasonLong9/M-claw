export type ChatSendErrorCode =
  | 'gateway-offline'
  | 'command-failed'
  | 'parse-failed'
  | 'timeout'
  | 'invalid-input'
  | 'canceled'

export function classifySendErrorCode(message: string): ChatSendErrorCode {
  const normalized = String(message || '').trim().toLowerCase()
  if (!normalized) return 'command-failed'
  if (/timeout|timed out/.test(normalized)) return 'timeout'
  if (
    /gateway/.test(normalized)
    && (
      /offline|unreachable|not running|not loaded/.test(normalized)
      || /connection refused|econnrefused|did not become reachable/.test(normalized)
      || /service not loaded|service not installed/.test(normalized)
    )
  ) {
    return 'gateway-offline'
  }
  return 'command-failed'
}
