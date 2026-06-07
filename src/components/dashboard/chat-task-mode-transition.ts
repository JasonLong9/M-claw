export function isTrackedCodingConversationSession(
  activeSessionId: string | undefined,
  codingSessionIds: Iterable<string>
): boolean {
  const normalizedActiveSessionId = String(activeSessionId || '').trim()
  if (!normalizedActiveSessionId) return false

  for (const sessionId of codingSessionIds) {
    if (String(sessionId || '').trim() === normalizedActiveSessionId) {
      return true
    }
  }

  return false
}
