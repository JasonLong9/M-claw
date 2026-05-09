export interface DiagnosticsTraceEntry {
  phase: 'classify' | 'resolve_view' | 'corpus'
  step: string
  decision: string
  result: string
  corpus_snippet?: string
}

export interface DiagnosticsTrace {
  add(entry: DiagnosticsTraceEntry): void
}

export function createInMemoryTrace(): { trace: DiagnosticsTrace; entries(): DiagnosticsTraceEntry[] } {
  const items: DiagnosticsTraceEntry[] = []
  const trace: DiagnosticsTrace = {
    add(entry) {
      items.push(entry)
    },
  }
  return { trace, entries: () => [...items] }
}

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+\S+/gi, 'Bearer <redacted>'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, 'sk-<redacted>'],
  [/\borg-[A-Za-z0-9_-]{20,}\b/g, 'org-<redacted>'],
  [/\b(token|key|secret|password|api_key|apiKey|auth_token|authToken)\s*[:=]\s*\S+/gi, '$1=<redacted>'],
  [/"[^"]*token[^"]*"\s*:\s*"[^"]+"/gi, '"<token-key>":"<redacted>"'],
]

export function sanitizeDiagnosticsText(raw: string, maxLen = 500): string {
  let sanitized = raw
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement)
  }
  if (sanitized.length > maxLen) {
    sanitized = sanitized.slice(0, maxLen) + '…'
  }
  return sanitized
}
