import { isLikelyMclawInternalPath } from './mclaw-protected-paths'

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

const DETECTED_WINDOWS_PATH_PATTERN = /[a-z]:[\\/][^\r\n<>:"|?*]+/gi

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

const INTERNAL_ASSISTANT_BOOTSTRAP_WRITE_PATTERN =
  /^successfully wrote \d+ bytes to memory\/\d{4}-\d{2}-\d{2}\.md$/i

const INTERNAL_ASSISTANT_BOOTSTRAP_TRIGGER_PATTERNS = [
  /^#\s*(?:identity|user|soul|bootstrap|agents|tools)\.md\b/i,
  /fill this in during your first conversation/i,
  /you just woke up\. time to figure out who you are\./i,
  /you're not a chatbot\. you're becoming someone\./i,
  /learn about the person you're helping\./i,
  /this isn't just metadata\./i,
  /good luck out there\. make it count\./i,
  /be genuinely helpful, not performatively helpful\./i,
  /each session, you wake up fresh\./i,
]

const INTERNAL_ASSISTANT_BOOTSTRAP_LINE_PATTERNS = [
  ...INTERNAL_ASSISTANT_BOOTSTRAP_TRIGGER_PATTERNS,
  /^#{1,3}\s*(?:the conversation|after you know who you are|connect \(optional\)|when you are done|core truths|boundaries|vibe|continuity)\b/i,
  /^notes:\s*$/i,
  /^update these files with what you learned/i,
  /^then open `?soul\.md`? together and talk about:/i,
  /^ask how they want to reach you:/i,
  /^guide them through whichever they pick\./i,
  /^write it down\. make it real\./i,
  /^for avatars, use a workspace-relative path like `avatars\/openclaw\.png`\./i,
  /^save this file at the workspace root as `identity\.md`\./i,
  /^[_*`-]*this file is yours to evolve\./i,
  /^[_*`-]*good luck out there\./i,
  /^[-*]\s*\*\*(?:name|creature|vibe|emoji|avatar|pronouns|timezone|notes|what to call them|just here|whatsapp|telegram)\*\*/i,
  /^[-*]\s*`?(?:identity|user)\.md`?\b/i,
  /^[-*]\s*(?:what matters to them|how they want you to behave|any boundaries or preferences|private things stay private|when in doubt, ask before acting externally|never send half-baked replies to messaging surfaces|you're not the user's voice)\b/i,
  /^_?\((?:pick something you like|ai\?|how do you come across\?|your signature|workspace-relative path|optional)/i,
]

const USER_FACING_RESPONSE_START_PATTERNS = [
  /^(?:hello|hi|hey)\b/i,
  /^(?:\u4f60\u597d|\u597d\u7684|\u660e\u767d\u4e86|\u53ef\u4ee5|\u6ca1\u95ee\u9898|\u6211\u4f1a|\u6211\u662f|\u5f53\u7136|\u63a5\u4e0b\u6765|\u522b\u62c5\u5fc3)/u,
]

const OPENCLAW_LOG_FOLLOW_DIAGNOSTIC_LINE_PATTERN =
  /^\s*logs:\s*openclaw\s+logs\s+--follow\s*$/i

const MACHINE_ARTIFACT_LINE_PATTERNS = [
  /^\s*(?:reasoning(?:_content)?|thinking(?:_content)?|analysis|tool(?:_result|_call)?|assistant_response)\s*:?\s*$/i,
  /^\s*(?:思考过程|推理过程|分析过程)\s*[:：]?\s*$/u,
  OPENCLAW_LOG_FOLLOW_DIAGNOSTIC_LINE_PATTERN,
  /^\s*memory\s+dir\s+not\s+found\s*$/i,
  /^\s*MEMORY\.md\s+not\s+found\s*$/i,
  /^\s*NO_MEMORY_DIR\s*$/i,
  /^\s*NO_MEMORY_FILE\s*$/i,
  /^\s*\+\s*ls\s+-la\s+memory\b/i,
  /^\s*ls\s+-la\s+memory\b/i,
  /^\s*if\s+\(-not\s+\(Test-Path\s+memory\/?\)\)/i,
  /^\s*\+\s+.*Test-Path\s+memory/i,
  /^\s*Get-ChildItem\s*:/i,
  /^\s*\+\s+(?:CategoryInfo|FullyQualifiedErrorId)\s*:/i,
  /^\s*\+\s*~{2,}\s*$/i,
  /^\s*\(Command exited with code \d+\)\s*$/i,
  /^\s*At line:\d+\s+char:\d+\s*$/i,
  /^\s*�+.*(?:λ|ַ|�)\s*:\s*\d+/u,
  /^\s*\+\s*Get-ChildItem\b/i,
  /^\s*\S+\s*:\s*InvalidArgument:\s*\(\)\s*\[Get-ChildItem\]/i,
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

const ASSISTANT_METADATA_JSON_KEY_SET = new Set([
  'results',
  'provider',
  'citations',
  'mode',
  'model',
  'usage',
  'tokens',
  'status',
  'meta',
])

const REASONING_PREFIXES = [
  '思考过程',
  '推理过程',
  '分析过程',
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

function looksLikeUserFacingResponseStart(line: string): boolean {
  const normalized = String(line || '').trim()
  if (!normalized) return false
  if (/^(?:[#*_`-]|>)/.test(normalized)) return false
  if (USER_FACING_RESPONSE_START_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  return /[\u4e00-\u9fff]/u.test(normalized)
}

function stripKnownAssistantBootstrapNoise(text: string): string {
  const normalizedText = String(text || '').replace(/\r\n?/g, '\n').trim()
  if (!normalizedText) return ''

  let bootstrapMode = false
  let removedAny = false
  const cleanedLines: string[] = []

  for (const rawLine of normalizedText.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      if (!bootstrapMode) cleanedLines.push('')
      continue
    }

    if (INTERNAL_ASSISTANT_BOOTSTRAP_WRITE_PATTERN.test(line)) {
      bootstrapMode = true
      removedAny = true
      continue
    }

    if (INTERNAL_ASSISTANT_BOOTSTRAP_TRIGGER_PATTERNS.some((pattern) => pattern.test(line))) {
      bootstrapMode = true
      removedAny = true
      continue
    }

    if (bootstrapMode) {
      if (
        looksLikeUserFacingResponseStart(line) &&
        !INTERNAL_ASSISTANT_BOOTSTRAP_LINE_PATTERNS.some((pattern) => pattern.test(line))
      ) {
        bootstrapMode = false
        cleanedLines.push(line)
        continue
      }

      removedAny = true
      continue
    }

    cleanedLines.push(line)
  }

  if (!removedAny) return normalizedText

  return cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
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
  const normalizedLower = normalized.toLowerCase()
  if (MACHINE_ARTIFACT_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  if (looksLikeToolPayloadJson(normalized)) return true
  if (normalizedLower.includes('heartbeat.md')) return true
  if (isLikelyMclawInternalPath(normalized)) return true

  if (/^(?:\{|\[).+(?:\}|\])$/.test(normalized)) {
    if (looksLikeAssistantMetadataJson(normalized)) return true
    const keyHits = (
      normalized.match(
        /"(?:command|workdir|cwd|timeout|yieldMs|stdout|stderr|headers|status|body|response|path|shell|sandboxPermissions)"/gi
      ) || []
    ).length
    if (keyHits >= 2) return true
  }

  return false
}

function looksLikeAssistantMetadataJson(text: string): boolean {
  const normalized = String(text || '').trim()
  if (!normalized || !/^[\[{]/.test(normalized)) return false

  try {
    const parsed = JSON.parse(normalized) as unknown
    const records = Array.isArray(parsed) ? parsed.filter(isRecord) : isRecord(parsed) ? [parsed] : []
    if (records.length === 0) return false

    return records.every((record) => {
      const keys = Object.keys(record)
        .map((key) => normalizeToolPayloadKey(key))
        .filter(Boolean)
      if (keys.length === 0) return false
      const metadataHits = keys.filter((key) => ASSISTANT_METADATA_JSON_KEY_SET.has(key)).length
      return metadataHits >= Math.max(2, Math.ceil(keys.length / 2))
    })
  } catch {
    return /"(?:results|provider|citations|mode)"\s*:/.test(normalized)
  }
}

function stripAssistantMetadataJsonBlocks(text: string): string {
  const normalized = String(text || '').replace(/\r\n?/g, '\n')
  if (!normalized) return ''

  const blockPattern = /\{[\s\S]*?\}/g
  let result = normalized
  for (const match of normalized.matchAll(blockPattern)) {
    const block = String(match[0] || '').trim()
    if (!block) continue
    if (!looksLikeAssistantMetadataJson(block)) continue
    result = result.replace(match[0], '')
  }
  return result
}

export function isAssistantMachineArtifactOnlyText(text: string): boolean {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.length > 0 && lines.every((line) => isMachineArtifactLine(line))
}

function isOpenClawLogFollowDiagnosticOnlyText(text: string): boolean {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.length > 0 && lines.every((line) => OPENCLAW_LOG_FOLLOW_DIAGNOSTIC_LINE_PATTERN.test(line))
}

function buildMeaningfulAssistantLines(text: string): string[] {
  const normalizedLines = stripAssistantMetadataJsonBlocks(stripKnownAssistantBootstrapNoise(String(text || '')))
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

  if (/^(?:思考过程|推理过程|分析过程|thinking|reasoning|analysis)$/iu.test(normalized)) {
    return 'reasoning'
  }

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

  if (isLikelyMclawInternalPath(normalized)) return false

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

function shouldRejectDetectedLocalPathMatch(sourceText: string, match: RegExpMatchArray): boolean {
  const rawMatch = String(match[0] || '')
  if (!rawMatch) return true

  if (/^[a-z]:[\\/]{2,}/i.test(rawMatch)) {
    return true
  }

  const matchIndex = typeof match.index === 'number' ? match.index : -1
  if (matchIndex > 0) {
    const previousChar = sourceText[matchIndex - 1] || ''
    if (/[a-z0-9]/i.test(previousChar)) {
      return true
    }
  }

  return false
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
  const normalized = stripKnownAssistantBootstrapNoise(stripEmbeddedImagePayloads(text))
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

  const cleaned = stripKnownAssistantBootstrapNoise(stripEmbeddedImagePayloads(normalized))
  if (!cleaned) return ''
  if (isOpenClawLogFollowDiagnosticOnlyText(cleaned)) return ''

  const meaningfulLines = buildMeaningfulAssistantLines(cleaned)
  if (meaningfulLines.length > 0) {
    return meaningfulLines.join('\n').trim()
  }

  return cleaned
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
    for (const match of variant.matchAll(DETECTED_WINDOWS_PATH_PATTERN)) {
      if (shouldRejectDetectedLocalPathMatch(variant, match)) continue
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
