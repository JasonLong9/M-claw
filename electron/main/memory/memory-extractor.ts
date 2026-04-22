import type { MemoryCommitParams } from './memory-types'

const PREFERENCE_RULES: Array<{
  pattern: RegExp
  content: string
}> = [
  {
    pattern: /(?:请|以后|默认|尽量).{0,8}用中文(?:回复|回答|输出)?/i,
    content: '默认使用中文回复。',
  },
  {
    pattern: /(?:请|以后|默认|尽量).{0,8}用英文(?:回复|回答|输出)?/i,
    content: '默认使用英文回复。',
  },
  {
    pattern: /(?:回答|回复|输出).{0,6}(?:简洁|简短|精简)|(?:请|尽量).{0,6}(?:简洁|简短|精简)/i,
    content: '回复尽量简洁。',
  },
  {
    pattern: /(?:回答|回复|输出).{0,6}(?:详细|完整|充分)|(?:请|尽量).{0,6}(?:详细|完整|充分|展开说明)/i,
    content: '回复尽量详细完整。',
  },
  {
    pattern: /(?:给我|附上|带上|包含).{0,20}(?:测试步骤|验证步骤)|(?:测试步骤|验证步骤).{0,10}(?:也要|一起给)/i,
    content: '涉及修改或方案时附上测试或验证步骤。',
  },
  {
    pattern: /(?:我在|我是).{0,8}windows/i,
    content: '用户当前主要在 Windows 环境下使用或开发。',
  },
  {
    pattern: /(?:我在|我是).{0,8}mac(?:os)?/i,
    content: '用户当前主要在 macOS 环境下使用或开发。',
  },
  {
    pattern: /(?:我在|我是).{0,8}linux/i,
    content: '用户当前主要在 Linux 环境下使用或开发。',
  },
]

const SESSION_EXPLICIT_PATTERNS = [
  /(?:在这个会话里|本次会话(?:里)?)(?:请)?记住[:：]?\s*(.+)$/i,
  /(?:这个会话里|本次会话(?:里)?)(?:默认|保持)[:：]?\s*(.+)$/i,
]

const USER_EXPLICIT_PATTERNS = [
  /^(?:请)?记住[:：]?\s*(.+)$/i,
  /(?:以后|之后)(?:默认|都)?[:：]?\s*(.+)$/i,
]

function normalizeExplicitMemoryContent(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/^[：:，,\-—\s]+/, '')
    .slice(0, 300)
}

function normalizeComparableCandidateContent(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/使用/g, '用')
    .replace(/以后|之后|默认|请|尽量|都/g, ' ')
    .replace(/[：:，,。！？、；;.!?'"`“”‘’()[\]{}<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchExplicitMemoryContent(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const matched = pattern.exec(text)
    if (!matched?.[1]) continue
    const normalized = normalizeExplicitMemoryContent(matched[1])
    if (normalized) return normalized
  }
  return ''
}

function pushCandidate(
  candidates: MemoryCommitParams[],
  nextCandidate: MemoryCommitParams | null
): void {
  if (!nextCandidate?.content) return
  const comparable = nextCandidate.content.trim()
  if (!comparable) return
  const comparableNormalized = normalizeComparableCandidateContent(comparable)
  if (
    candidates.some((candidate) => {
      const candidateComparable = normalizeComparableCandidateContent(candidate.content)
      const isSameComparable =
        candidateComparable === comparableNormalized ||
        candidateComparable.includes(comparableNormalized) ||
        comparableNormalized.includes(candidateComparable)
      return (
        candidate.scope === nextCandidate.scope &&
        (candidate.sessionId || '') === (nextCandidate.sessionId || '') &&
        (
          candidate.content === comparable ||
          (candidateComparable.length >= 4 &&
            comparableNormalized.length >= 4 &&
            isSameComparable)
        )
      )
    })
  ) {
    return
  }
  candidates.push({
    ...nextCandidate,
    content: comparable,
  })
}

export function isExplicitMemoryInstructionText(userMessage: string): boolean {
  const text = String(userMessage || '').trim()
  if (!text) return false
  return Boolean(
    matchExplicitMemoryContent(text, SESSION_EXPLICIT_PATTERNS) ||
    matchExplicitMemoryContent(text, USER_EXPLICIT_PATTERNS)
  )
}

export function extractMemoryCommitParams(params: {
  userMessage: string
  sessionId: string
}): MemoryCommitParams[] {
  const text = String(params.userMessage || '').trim()
  const sessionId = String(params.sessionId || '').trim()
  if (!text || !sessionId) return []

  const candidates: MemoryCommitParams[] = []
  const sessionExplicit = matchExplicitMemoryContent(text, SESSION_EXPLICIT_PATTERNS)
  if (sessionExplicit) {
    pushCandidate(candidates, {
      scope: 'session',
      content: sessionExplicit,
      source: 'manual',
      sessionId,
    })
  }

  const userExplicit = matchExplicitMemoryContent(text, USER_EXPLICIT_PATTERNS)
  if (userExplicit) {
    pushCandidate(candidates, {
      scope: 'user',
      content: userExplicit,
      source: 'manual',
    })
  }

  for (const rule of PREFERENCE_RULES) {
    if (!rule.pattern.test(text)) continue
    pushCandidate(candidates, {
      scope: 'user',
      content: rule.content,
      source: 'auto',
    })
  }

  return candidates
}
