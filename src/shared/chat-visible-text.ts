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
const EMBEDDED_MESSAGE_TIMESTAMP_PATTERN =
  /^\[((?:[A-Za-z]{3}\s+)?\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?\s+GMT[+-]\d{1,2})\]\s*/

const MACHINE_ARTIFACT_LINE_PATTERNS = [
  /^\s*(?:reasoning(?:_content)?|thinking(?:_content)?|analysis|tool(?:_result|_call)?|assistant_response)\s*:?\s*$/i,
  /^\s*(?:stdout|stderr)\(\d+chars\)=/i,
  /^\s*(?:stdout|stderr):/i,
  /^\s*headers?:\s*\{/i,
  /^\s*(?:status|statuscode|http status)\s*:/i,
  /^\s*(?:search_query|image_query|web_fetch|open|click|find|screenshot|finance|weather|sports|time)\b/i,
  /^\s*(?:shell_command|apply_patch|update_plan|spawn_agent|send_input|wait_agent|close_agent)\b/i,
  /^\s*<!doctype html/i,
  /^\s*<\/?(?:html|head|body|script|style|meta|title|div|span|section|article|main|header|footer|p|pre|code|table|tr|td|th|ul|ol|li|a|img|svg|path)\b[^>]*>\s*$/i,
  /^\s*(?:PS\s+[A-Za-z]:[\\/].*>|[A-Za-z]:[\\/].*>)\s*/i,
  /^\s*curl\s+/i,
]

const REASONING_PREFIXES = [
  'let me',
  'first,',
  'first ',
  'next,',
  'to start,',
  'my plan is',
  'i will',
  "i'll",
  "i'm going to",
  'i am going to',
  "i'm checking",
  'i am checking',
  "i'm looking",
  'i am looking',
  "i'm searching",
  'i am searching',
  '\u6211\u6765',
  '\u6211\u5148',
  '\u8ba9\u6211',
  '\u5148\u6765',
  '\u5148\u53bb',
  '\u5148\u5e2e\u4f60',
  '\u63a5\u4e0b\u6765',
  '\u4e0b\u9762\u6211\u5148',
  '\u4e3a\u4e86',
  '\u6b63\u5728',
]

const FINAL_PREFIXES = [
  'done',
  'completed',
  'finished',
  'saved',
  'created',
  'updated',
  "here's",
  'here is',
  'result',
  'results',
  'output',
  'path',
  'file path',
  '\u5b8c\u6210',
  '\u5df2\u5b8c\u6210',
  '\u5df2\u7ecf',
  '\u5df2\u4e3a',
  '\u5df2\u5728',
  '\u5df2\u5c06',
  '\u7ed3\u679c',
  '\u6587\u4ef6\u8def\u5f84',
  '\u6587\u4ef6\u4f4d\u7f6e',
  '\u6587\u4ef6\u5df2',
  '\u4fdd\u5b58\u5728',
  '\u5df2\u4fdd\u5b58',
  '\u5df2\u521b\u5efa',
  '\u5df2\u751f\u6210',
  '\u5df2\u5199\u5165',
  '\u5df2\u66f4\u65b0',
  '\u4f60\u53ef\u4ee5',
]

const REASONING_PATTERNS = [
  /^(?:to|in order to)\b/i,
  /^(?:checking|looking up|searching for|opening|creating|writing|saving|fetching|reading|inspecting)\b/i,
]

const FINAL_PATTERNS = [
  /(?:file|output|report).*(?:saved|created|written|updated)/i,
  /(?:\u5df2|\u5df2\u7ecf).*(?:\u4fdd\u5b58|\u521b\u5efa|\u751f\u6210|\u5199\u5165|\u66f4\u65b0)/u,
  /(?:\u6587\u4ef6|\u5185\u5bb9).*(?:\u4fdd\u5b58|\u521b\u5efa|\u751f\u6210|\u5199\u5165|\u66f4\u65b0)/u,
]

type AssistantLineKind = 'reasoning' | 'final' | 'neutral'

export interface ChatMessageTimestampParts {
  body: string
  embeddedTimestamp: string
}

export interface AssistantMessageSections {
  finalText: string
  reasoningText: string
}

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
    .replace(/[ \t]*(?::|\uFF1A)\s*$/u, '')
    .trim()
}

function looksLikeToolPayloadJson(text: string): boolean {
  const normalized = String(text || '').trim()
  if (!normalized || !/^[\[{]/.test(normalized)) return false

  try {
    const parsed = JSON.parse(normalized) as unknown
    if (isInvisibleAssistantToolPayload(parsed)) return true
    if (Array.isArray(parsed)) {
      return parsed.length > 0 && parsed.every((item) => isInvisibleAssistantToolPayload(item))
    }
    if (!isRecord(parsed)) return false

    const joinedKeys = Object.keys(parsed)
      .map((key) => normalizeToolPayloadKey(key))
      .filter(Boolean)
      .join(',')
    return /(?:headers|status|statuscode|stdout|stderr|body|response|request|command|workdir|cwd|timeout|yieldms|shell|sandboxpermissions)/.test(
      joinedKeys
    )
  } catch {
    return /"(?:headers|status|statusCode|stdout|stderr|body|response|request|command|workdir|cwd|timeout|yieldMs|shell|sandboxPermissions)"/i.test(
      normalized
    )
  }
}

function isMachineArtifactLine(line: string): boolean {
  const normalized = String(line || '').trim()
  if (!normalized) return false
  if (MACHINE_ARTIFACT_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  if (looksLikeToolPayloadJson(normalized)) return true

  if (/^(?:\{|\[).+(?:\}|\])$/.test(normalized)) {
    const keyHits = (
      normalized.match(
        /"(?:command|workdir|cwd|timeout|yieldMs|stdout|stderr|headers|status|body|response|path|shell|sandboxPermissions)"/gi
      ) || []
    ).length
    if (keyHits >= 2) return true
  }

  return false
}

function buildMeaningfulAssistantLines(text: string): string[] {
  const normalizedLines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (normalizedLines.length === 0) return []

  return normalizedLines.filter((line) => !isMachineArtifactLine(line))
}

function normalizeHeuristicLine(line: string): string {
  return String(line || '').trim().toLowerCase()
}

function startsWithAnyPrefix(line: string, prefixes: string[]): boolean {
  const normalized = normalizeHeuristicLine(line)
  return prefixes.some((prefix) => normalized.startsWith(prefix))
}

function matchesAnyPattern(line: string, patterns: RegExp[]): boolean {
  const normalized = String(line || '').trim()
  return patterns.some((pattern) => pattern.test(normalized))
}

function classifyAssistantLine(line: string): AssistantLineKind {
  const normalized = String(line || '').trim()
  if (!normalized) return 'neutral'

  if (
    startsWithAnyPrefix(normalized, FINAL_PREFIXES) ||
    matchesAnyPattern(normalized, FINAL_PATTERNS) ||
    /[A-Za-z]:[\\/]/.test(normalized) ||
    normalized.startsWith('- ') ||
    normalized.startsWith('* ') ||
    /^\d+[.)\u3001]/.test(normalized)
  ) {
    return 'final'
  }

  if (
    startsWithAnyPrefix(normalized, REASONING_PREFIXES) ||
    matchesAnyPattern(normalized, REASONING_PATTERNS)
  ) {
    return 'reasoning'
  }

  return 'neutral'
}

function findAssistantFinalStartIndex(lines: string[]): number {
  if (lines.length <= 1) return 0

  const classifications = lines.map((line) => classifyAssistantLine(line))
  const firstExplicitFinalIndex = classifications.findIndex((classification) => classification === 'final')
  const hasReasoning = classifications.includes('reasoning')

  if (firstExplicitFinalIndex >= 0) {
    let finalStart = firstExplicitFinalIndex
    while (finalStart > 0 && classifications[finalStart - 1] === 'neutral') {
      finalStart -= 1
    }
    return hasReasoning && finalStart > 0 ? finalStart : 0
  }

  if (!hasReasoning) return 0

  const lastReasoningIndex = classifications.lastIndexOf('reasoning')
  return lastReasoningIndex >= 0 && lastReasoningIndex < lines.length - 1
    ? lastReasoningIndex + 1
    : 0
}

function normalizeComparableWindowsPath(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[\\/]+/g, '\\')
    .replace(/[\\/]+$/g, '')
    .toLowerCase()
}

function isWindowsFileLikePath(targetPath: string): boolean {
  return /[\\/][^\\/]+\.[a-z0-9]{1,16}$/i.test(String(targetPath || '').trim())
}

function isUserFacingAssistantLocalPath(candidatePath: string): boolean {
  const normalized = String(candidatePath || '')
    .trim()
    .replace(/[\\/]+/g, '\\')
    .toLowerCase()
  if (!normalized) return false

  const fileName = normalized.split('\\').filter(Boolean).pop() || ''
  if (fileName === 'heartbeat.md') return false

  if (normalized.includes('\\mclaw\\openclaw-state\\')) return false
  if (normalized.includes('\\.openclaw\\workspace-')) return false
  if (normalized.includes('\\.openclaw\\media\\browser\\')) return false
  if (normalized.includes('\\.openclaw\\')) return false

  return true
}

function isPathEqualOrWithinWindowsDirectory(candidatePath: string, directoryPath: string): boolean {
  const normalizedCandidate = normalizeComparableWindowsPath(candidatePath)
  const normalizedDirectory = normalizeComparableWindowsPath(directoryPath)
  if (!normalizedCandidate || !normalizedDirectory) return false
  return normalizedCandidate === normalizedDirectory || normalizedCandidate.startsWith(`${normalizedDirectory}\\`)
}

function trimDetectedLocalPath(candidate: string): string {
  const normalized = String(candidate || '')
    .trim()
    .replace(/^['"`(<{\[]+/, '')
    .replace(/['"`)>}\]]+$/, '')
    .replace(/[\uFF0C\u3002\u3001\uFF1B;\uFF1A:!\uFF01?\uFF1F]+$/g, '')
    .replace(/\\\\/g, '\\')

  const fileMatch = normalized.match(
    /^[a-z]:[\\/].*?\.[a-z0-9]{1,16}(?=$|[\s"'`)\]}>,\uFF0C\u3002\u3001\uFF1B;\uFF1A:!\uFF01?\uFF1F])/i
  )
  if (fileMatch?.[0]) {
    return fileMatch[0]
  }

  const directoryMatch = normalized.match(/^[a-z]:[\\/][^<>:"|?*\r\n]+/i)
  return directoryMatch?.[0] || normalized
}

export function splitEmbeddedMessageTimestamp(text: string): ChatMessageTimestampParts {
  const normalized = String(text || '').trim()
  if (!normalized) {
    return {
      body: '',
      embeddedTimestamp: '',
    }
  }

  const matched = normalized.match(EMBEDDED_MESSAGE_TIMESTAMP_PATTERN)
  if (!matched) {
    return {
      body: normalized,
      embeddedTimestamp: '',
    }
  }

  const body = normalized.slice(matched[0].length).trim()
  if (!body) {
    return {
      body: normalized,
      embeddedTimestamp: '',
    }
  }

  return {
    body,
    embeddedTimestamp: matched[1],
  }
}

export function splitAssistantMessageSections(text: string): AssistantMessageSections {
  const stripped = splitEmbeddedMessageTimestamp(text).body
  const meaningfulLines = buildMeaningfulAssistantLines(stripped)
  if (meaningfulLines.length === 0) {
    return {
      finalText: '',
      reasoningText: '',
    }
  }

  const finalStart = findAssistantFinalStartIndex(meaningfulLines)
  if (finalStart <= 0) {
    return {
      finalText: meaningfulLines.join('\n'),
      reasoningText: '',
    }
  }

  const reasoningLines = meaningfulLines.slice(0, finalStart)
  const finalLines = meaningfulLines.slice(finalStart)
  if (reasoningLines.length === 0 || finalLines.length === 0) {
    return {
      finalText: meaningfulLines.join('\n'),
      reasoningText: '',
    }
  }

  return {
    finalText: finalLines.join('\n').trim(),
    reasoningText: reasoningLines.join('\n').trim(),
  }
}

export function normalizeComparableChatText(text: string): string {
  const stripped = splitEmbeddedMessageTimestamp(text).body
  return String(stripped || '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeComparableVisibleChatText(
  text: string,
  role: 'assistant' | 'user' | 'system' = 'assistant'
): string {
  const stripped = splitEmbeddedMessageTimestamp(text).body
  const visibleText =
    role === 'assistant'
      ? sanitizeAssistantVisibleText(stripped) || sanitizeAssistantRawFallbackText(stripped)
      : stripped
  return String(visibleText || '')
    .replace(/\s+/g, ' ')
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
  const normalized = stripEmbeddedImagePayloads(text)
  if (!normalized) return ''
  const meaningfulLines = buildMeaningfulAssistantLines(normalized)
  return meaningfulLines.join('\n').trim()
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

export function collectAssistantLocalPaths(text: string): string[] {
  const normalizedText = String(text || '')
  if (!normalizedText) return []

  const variants = Array.from(
    new Set(
      [
        normalizedText,
        normalizedText.includes('\\\\') ? normalizedText.replace(/\\\\/g, '\\') : '',
      ].filter(Boolean)
    )
  )

  const collectedPaths: string[] = []
  for (const variant of variants) {
    for (const match of variant.matchAll(/[a-z]:[\\/][^\r\n<>:"|?*]+/gi)) {
      const normalizedPath = trimDetectedLocalPath(match[0] || '')
        .replace(/[\\/]+$/g, '')
        .replace(/[\\/]+/g, '\\')
      if (!normalizedPath) continue
      collectedPaths.push(normalizedPath)
    }
  }

  const dedupedPaths: string[] = []
  const seenComparablePaths = new Set<string>()
  for (const candidatePath of collectedPaths) {
    if (!isUserFacingAssistantLocalPath(candidatePath)) continue
    const comparablePath = normalizeComparableWindowsPath(candidatePath)
    if (!comparablePath || seenComparablePaths.has(comparablePath)) continue
    seenComparablePaths.add(comparablePath)
    dedupedPaths.push(candidatePath)
  }

  const filePaths = dedupedPaths.filter((candidatePath) => isWindowsFileLikePath(candidatePath))
  if (filePaths.length === 0) return dedupedPaths

  return dedupedPaths.filter((candidatePath) => {
    if (isWindowsFileLikePath(candidatePath)) return true
    return !filePaths.some((filePath) => isPathEqualOrWithinWindowsDirectory(filePath, candidatePath))
  })
}

export function describeLocalPathLabel(targetPath: string): string {
  const normalized = String(targetPath || '')
    .trim()
    .replace(/[\\/]+$/g, '')
    .replace(/[\\/]+/g, '\\')
  if (!normalized) return '\u6587\u4ef6'
  const segments = normalized.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] || normalized
}
