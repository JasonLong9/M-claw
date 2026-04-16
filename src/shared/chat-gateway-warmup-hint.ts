const DEFAULT_CHAT_GATEWAY_WARMUP_HINT_MS = 90_000

let chatGatewayWarmupHintUntilMs = 0

export function markChatGatewayWarmupHint(
  durationMs = DEFAULT_CHAT_GATEWAY_WARMUP_HINT_MS,
  now = Date.now()
): number {
  const normalizedDurationMs = Math.max(1_000, Math.floor(durationMs))
  chatGatewayWarmupHintUntilMs = Math.max(chatGatewayWarmupHintUntilMs, now + normalizedDurationMs)
  return chatGatewayWarmupHintUntilMs
}

export function hasActiveChatGatewayWarmupHint(now = Date.now()): boolean {
  return now < chatGatewayWarmupHintUntilMs
}

export function clearChatGatewayWarmupHint(): void {
  chatGatewayWarmupHintUntilMs = 0
}
