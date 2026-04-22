import type { ChatMemoryEntry } from '../../../src/shared/chat-memory'
import type { MemoryProvider } from './memory-types'

const MAX_MEMORY_PROMPT_CHARS = 1600
const MAX_USER_MEMORY_ENTRIES = 4
const MAX_SESSION_MEMORY_ENTRIES = 4

function appendEntriesSection(lines: string[], title: string, entries: ChatMemoryEntry[]): void {
  if (entries.length === 0) return
  lines.push(`### ${title}`)
  entries.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.content}`)
  })
}

function buildMemoryConflictKey(content: string): string {
  const normalized = String(content || '').trim()
  if (!normalized) return ''

  if (/(?:默认|以后|尽量).{0,8}用中文回复|默认使用中文回复/u.test(normalized)) return 'reply-language'
  if (/(?:默认|以后|尽量).{0,8}用英文回复|默认使用英文回复/u.test(normalized)) return 'reply-language'
  if (/(?:回复|回答).{0,10}(?:简洁|简短|精简)|(?:尽量).{0,6}(?:简洁|简短|精简)/u.test(normalized)) return 'reply-verbosity'
  if (/(?:回复|回答).{0,10}(?:详细|完整|充分)|(?:尽量).{0,8}(?:详细|完整|充分|展开说明)/u.test(normalized)) return 'reply-verbosity'
  if (/(?:测试步骤|验证步骤)/u.test(normalized)) return 'reply-validation'
  if (/(?:windows|macos|linux)/i.test(normalized)) return 'environment'
  if (/(?:第一行|首行|开头).{0,18}(?:输出|写|显示|加上?|带上?)/u.test(normalized)) return 'reply-prefix'
  if (/(?:末尾|结尾|最后一行).{0,18}(?:输出|写|显示|加上?|带上?)/u.test(normalized)) return 'reply-suffix'

  return ''
}

function collapseConflictingEntries(entries: ChatMemoryEntry[], limit: number): ChatMemoryEntry[] {
  const sortedEntries = [...entries].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt
    if (left.source !== right.source) return left.source === 'manual' ? -1 : 1
    return left.createdAt - right.createdAt
  })

  const dedupedEntries: ChatMemoryEntry[] = []
  const seenConflictKeys = new Set<string>()
  for (const entry of sortedEntries) {
    const conflictKey = buildMemoryConflictKey(entry.content)
    if (conflictKey) {
      if (seenConflictKeys.has(conflictKey)) continue
      seenConflictKeys.add(conflictKey)
    }
    dedupedEntries.push(entry)
    if (dedupedEntries.length >= limit) break
  }

  return dedupedEntries
}

export async function buildMemoryContext(params: {
  provider: MemoryProvider
  sessionId?: string
  messageText: string
}): Promise<{ prompt: string; entries: ChatMemoryEntry[] }> {
  const entries = await params.provider.retrieve({
    sessionId: params.sessionId,
    query: params.messageText,
    maxResults: 12,
  })
  if (entries.length === 0) {
    return {
      prompt: '',
      entries: [],
    }
  }

  const userEntries = collapseConflictingEntries(
    entries.filter((entry) => entry.scope === 'user'),
    MAX_USER_MEMORY_ENTRIES
  )
  const sessionEntries = collapseConflictingEntries(
    entries.filter((entry) => entry.scope === 'session'),
    MAX_SESSION_MEMORY_ENTRIES
  )
  const selectedEntries = [...userEntries, ...sessionEntries]
  if (selectedEntries.length === 0) {
    return {
      prompt: '',
      entries: [],
    }
  }

  const lines = [
    '以下是 Mclaw 本地记忆中的高优先级用户偏好与上下文。',
    '当这些记忆与当前请求相关时，请直接执行，不要只在回答里复述“我记住了”。',
    '优先级规则：本轮用户明确新指令 > 当前会话记忆 > 全局偏好 > 自动学习到的推断偏好。',
    '如果某条记忆描述的是回复语言、格式、开头/结尾标记、是否附测试步骤等要求，请在最终回复中直接落实。',
  ]
  appendEntriesSection(lines, '全局偏好', userEntries)
  appendEntriesSection(lines, '当前会话记忆', sessionEntries)

  let prompt = ''
  for (const line of lines) {
    const nextPrompt = prompt ? `${prompt}\n${line}` : line
    if (nextPrompt.length > MAX_MEMORY_PROMPT_CHARS) break
    prompt = nextPrompt
  }

  return {
    prompt,
    entries: selectedEntries,
  }
}
