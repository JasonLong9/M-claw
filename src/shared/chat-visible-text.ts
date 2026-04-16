const TOOL_PAYLOAD_ALLOWED_KEYS = new Set([
  'chars',
  'cmd',
  'command',
  'cwd',
  'id',
  'justification',
  'login',
  'maxoutputtokens',
  'maxtokens',
  'path',
  'prefixrule',
  'sandboxpermissions',
  'sessionid',
  'shell',
  'target',
  'timeout',
  'tty',
  'workdir',
  'yieldms',
  'yieldtimems',
])

const TOOL_PAYLOAD_STRONG_KEYS = new Set([
  'cmd',
  'command',
  'cwd',
  'justification',
  'path',
  'prefixrule',
  'sandboxpermissions',
  'shell',
  'timeout',
  'workdir',
  'yieldms',
  'yieldtimems',
])

export const CHAT_REPLY_REJECTED_PATH_PATTERN =
  /\b(id|session|model|provider|usage|token|finish|status|type|role|path|key|command|cmd|workdir|cwd|timeout|yield(?:ms|time_ms|_ms|_time_ms)?|prefix(?:rule|_rule)?|justification|shell|sandbox(?:permissions|_permissions)?|login|tty|event|tool|toolcall|arguments?|partialjson|thinking|signature|encrypted|summary)\b/i

const EMBEDDED_IMAGE_DATA_URL_PATTERN =
  /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]{128,}/gi
const EMBEDDED_RAW_IMAGE_BASE64_PATTERNS = [
  /\/9j\/[a-z0-9+/=\r\n]{512,}/gi,
  /iVBORw0KGgo[a-z0-9+/=\r\n]{256,}/gi,
  /R0lGOD[a-z0-9+/=\r\n]{256,}/gi,
  /UklGR[a-z0-9+/=\r\n]{256,}/gi,
  /Qk0[a-z0-9+/=\r\n]{256,}/gi,
  /PHN2Zy[a-z0-9+/=\r\n]{256,}/gi,
  /PD94bWwg[a-z0-9+/=\r\n]{256,}/gi,
]

function normalizeToolPayloadKey(key: string): string {
  return String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stripEmbeddedImagePayloads(text: string): string {
  let cleaned = String(text || '').trim()
  if (!cleaned) return ''

  cleaned = cleaned.replace(EMBEDDED_IMAGE_DATA_URL_PATTERN, '')
  for (const pattern of EMBEDDED_RAW_IMAGE_BASE64_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }

  return cleaned
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[：:][ \t]*$/g, '')
    .trim()
}

export function isInvisibleAssistantToolPayload(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((item) => isInvisibleAssistantToolPayload(item))
  }

  if (!isRecord(value)) return false
  const normalizedKeys = Object.keys(value)
    .map((key) => normalizeToolPayloadKey(key))
    .filter(Boolean)

  if (normalizedKeys.length === 0) return false
  if (!normalizedKeys.some((key) => TOOL_PAYLOAD_STRONG_KEYS.has(key))) return false

  return normalizedKeys.every((key) => TOOL_PAYLOAD_ALLOWED_KEYS.has(key))
}

export function sanitizeAssistantVisibleText(text: string): string {
  return stripEmbeddedImagePayloads(text)
}

export function sanitizeAssistantRawFallbackText(text: string): string {
  const normalized = String(text || '').trim()
  if (!normalized) return ''

  if (/^[\[{]/.test(normalized)) {
    try {
      const parsed = JSON.parse(normalized) as unknown
      if (isInvisibleAssistantToolPayload(parsed)) return ''
    } catch {
      // Not valid JSON, keep the original text.
    }
  }

  return stripEmbeddedImagePayloads(normalized)
}
