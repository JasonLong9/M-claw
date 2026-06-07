import type {
  ChatImageAttachment,
  ChatMessage,
  ChatMessageStatus,
  ChatUsage,
} from '../../shared/chat-panel'
import {
  collectAssistantLocalPaths,
  splitAssistantMessageSections,
  splitEmbeddedMessageTimestamp,
} from '../../shared/chat-visible-text'

export interface PendingAssistantPreview {
  sending: boolean
  started: boolean
  stopping: boolean
  text?: string
  model?: string
  usage?: ChatUsage
}

export interface ChatMessageDisplayText {
  body: string
  embeddedTimestamp: string
  reasoning: string
}

export interface RenderedChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  reasoning: string
  rawText: string
  localPaths: string[]
  embeddedTimestamp: string
  createdAt: number
  status?: ChatMessageStatus
  model?: string
  usage?: ChatUsage
  images?: ChatImageAttachment[]
  sourceMessageIds: string[]
}

export interface BuildRenderedChatMessagesInput {
  baseMessages: ChatMessage[]
  pendingUserText?: string
  pendingAssistant: PendingAssistantPreview
  now?: () => number
}

interface AssistantClusterEntry {
  message: ChatMessage
  display: ChatMessageDisplayText
  visibleText: string
  images: ChatImageAttachment[]
}

function joinDistinctTextBlocks(blocks: string[]): string {
  const deduped: string[] = []
  const seen = new Set<string>()

  for (const block of blocks.map((value) => String(value || '').trim()).filter(Boolean)) {
    const dedupeKey = block.replace(/\s+/g, ' ').trim()
    if (!dedupeKey || seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    deduped.push(block)
  }

  return deduped.join('\n\n').trim()
}

function dedupeImages(images: ChatImageAttachment[]): ChatImageAttachment[] {
  const deduped: ChatImageAttachment[] = []
  const seen = new Set<string>()

  for (const image of Array.isArray(images) ? images : []) {
    const url = String(image?.url || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    deduped.push(image)
  }

  return deduped
}

function isPathOnlyText(text: string): boolean {
  const normalized = String(text || '').trim()
  if (!normalized) return false

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return false

  return lines.every((line) => /^[a-z]:[\\/]/i.test(line))
}

function isLikelyIntermediateAssistantBody(text: string): boolean {
  const normalized = String(text || '').trim()
  if (!normalized) return false

  if (/^(?:reasoning(?:_content)?|thinking(?:_content)?|analysis)$/i.test(normalized)) return true
  if (isPathOnlyText(normalized)) return true

  return false
}

function looksLikeAnswerContinuation(text: string): boolean {
  const normalized = String(text || '').trim()
  if (!normalized) return false

  return (
    normalized.startsWith('- ') ||
    normalized.startsWith('* ') ||
    /^\d+[.)\u3001]/.test(normalized) ||
    /^(?:文件|路径|位置|结果|说明|总结|保存|输出)\s*[:：]/u.test(normalized) ||
    normalized.includes('\n- ') ||
    normalized.includes('\n* ')
  )
}

function normalizeRenderedMessageRole(role: ChatMessage['role']): RenderedChatMessage['role'] {
  return role === 'user' ? 'user' : 'assistant'
}

function buildVisibleTextForEntry(display: ChatMessageDisplayText, role: RenderedChatMessage['role']): string {
  if (role !== 'assistant') {
    return String(display.body || '').trim()
  }
  return joinDistinctTextBlocks([display.reasoning, display.body])
}

function buildRenderedMessageFromSingleMessage(message: ChatMessage): RenderedChatMessage {
  const role = normalizeRenderedMessageRole(message.role)
  const display = resolveChatMessageDisplayText(
    message.text,
    message.role === 'assistant' ? 'assistant' : message.role
  )

  return {
    id: message.id,
    role,
    text: display.body,
    reasoning: role === 'assistant' ? display.reasoning : '',
    rawText: String(message.text || ''),
    localPaths: role === 'assistant' ? collectAssistantLocalPaths(display.body) : [],
    embeddedTimestamp: display.embeddedTimestamp,
    createdAt: message.createdAt,
    status: message.status,
    model: message.model,
    usage: message.usage,
    images: Array.isArray(message.images) ? dedupeImages(message.images) : [],
    sourceMessageIds: [message.id],
  }
}

function buildAssistantClusterEntry(message: ChatMessage): AssistantClusterEntry {
  const display = resolveChatMessageDisplayText(
    message.text,
    message.role === 'assistant' ? 'assistant' : message.role
  )

  return {
    message,
    display,
    visibleText: buildVisibleTextForEntry(display, normalizeRenderedMessageRole(message.role)),
    images: Array.isArray(message.images) ? dedupeImages(message.images) : [],
  }
}

function findAssistantFinalStart(entries: AssistantClusterEntry[]): number {
  const lastMeaningfulIndex = (() => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]
      if (entry.display.body || entry.images.length > 0 || entry.visibleText) {
        return index
      }
    }
    return -1
  })()

  if (lastMeaningfulIndex <= 0) return Math.max(0, lastMeaningfulIndex)

  let finalStart = lastMeaningfulIndex
  while (finalStart > 0) {
    const previous = entries[finalStart - 1]
    const current = entries[finalStart]
    if (previous.message.role !== 'assistant') break
    if (!previous.display.body || previous.display.reasoning) break
    if (isLikelyIntermediateAssistantBody(previous.display.body)) break
    if (
      !looksLikeAnswerContinuation(previous.display.body) &&
      !looksLikeAnswerContinuation(current.display.body)
    ) {
      break
    }
    finalStart -= 1
  }

  return finalStart
}

function collectAssistantReplyLocalPaths(entries: AssistantClusterEntry[], finalStart: number): string[] {
  const finalVisibleText = joinDistinctTextBlocks(
    entries
      .slice(Math.max(0, finalStart))
      .map((entry) => entry.display.body)
  )
  const finalVisiblePaths = collectAssistantLocalPaths(finalVisibleText)
  if (finalVisiblePaths.length > 0) {
    return finalVisiblePaths
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entryPaths = collectAssistantLocalPaths(entries[index]?.display.body || '')
    if (entryPaths.length > 0) {
      return entryPaths
    }
  }

  return []
}

function buildAssistantRenderedMessage(cluster: ChatMessage[]): RenderedChatMessage | null {
  if (!Array.isArray(cluster) || cluster.length === 0) return null

  const entries = cluster.map(buildAssistantClusterEntry)
  const finalStart = findAssistantFinalStart(entries)
  const reasoningParts: string[] = []
  const finalParts: string[] = []
  const rawTextParts = cluster
    .map((message) => String(message.text || '').trim())
    .filter(Boolean)
  const images = dedupeImages(entries.flatMap((entry) => entry.images))
  const localPaths = collectAssistantReplyLocalPaths(entries, finalStart)

  for (const [index, entry] of entries.entries()) {
    if (index < finalStart) {
      if (entry.visibleText) {
        reasoningParts.push(entry.visibleText)
      }
      continue
    }

    if (entry.display.reasoning) {
      reasoningParts.push(entry.display.reasoning)
    }
    if (entry.display.body) {
      finalParts.push(entry.display.body)
    }
  }

  let reasoning = joinDistinctTextBlocks(reasoningParts)
  let text = joinDistinctTextBlocks(finalParts)
  if (!text) {
    const fallbackVisible = joinDistinctTextBlocks([entries.at(-1)?.visibleText || ''])
    text = fallbackVisible
    if (fallbackVisible && reasoning === fallbackVisible) {
      reasoning = ''
    }
  }
  if (!text && !reasoning && images.length === 0) {
    return null
  }

  const finalSource =
    entries.at(-1) ||
    entries[entries.length - 1]
  if (!finalSource) return null

  return {
    id:
      cluster.length === 1
        ? finalSource.message.id
        : `${cluster[0].id}::${finalSource.message.id}`,
    role: 'assistant',
    text,
    reasoning,
    rawText: rawTextParts.join('\n\n'),
    localPaths,
    embeddedTimestamp: finalSource.display.embeddedTimestamp,
    createdAt: finalSource.message.createdAt,
    status: finalSource.message.status,
    model:
      String(finalSource.message.model || '').trim()
      || entries
        .slice()
        .reverse()
        .map((entry) => String(entry.message.model || '').trim())
        .find(Boolean)
      || undefined,
    usage: finalSource.message.usage,
    images,
    sourceMessageIds: cluster.map((message) => message.id),
  }
}

function groupBaseMessages(messages: ChatMessage[]): RenderedChatMessage[] {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const rendered: RenderedChatMessage[] = []

  for (let index = 0; index < normalizedMessages.length; index += 1) {
    const message = normalizedMessages[index]
    if (!message) continue

    if (message.role === 'user') {
      rendered.push(buildRenderedMessageFromSingleMessage(message))
      continue
    }

    const assistantCluster: ChatMessage[] = [message]
    while (index + 1 < normalizedMessages.length && normalizedMessages[index + 1]?.role !== 'user') {
      assistantCluster.push(normalizedMessages[index + 1])
      index += 1
    }

    const groupedAssistant = buildAssistantRenderedMessage(assistantCluster)
    if (groupedAssistant) {
      rendered.push(groupedAssistant)
    }
  }

  return rendered
}

export function resolveChatMessageDisplayText(
  text: string,
  role: ChatMessage['role'] = 'assistant'
): ChatMessageDisplayText {
  const timestampParts = splitEmbeddedMessageTimestamp(text)
  const normalized = timestampParts.body
  if (!normalized) {
    return {
      body: '',
      embeddedTimestamp: '',
      reasoning: '',
    }
  }

  if (role !== 'assistant') {
    return {
      body: normalized,
      embeddedTimestamp: timestampParts.embeddedTimestamp,
      reasoning: '',
    }
  }

  const sections = splitAssistantMessageSections(normalized)
  if (!sections.finalText && !sections.reasoningText) {
    return {
      body: '',
      embeddedTimestamp: timestampParts.embeddedTimestamp,
      reasoning: '',
    }
  }

  return {
    body: sections.finalText || normalized,
    embeddedTimestamp: timestampParts.embeddedTimestamp,
    reasoning: sections.reasoningText,
  }
}

export function buildRenderedChatMessages(input: BuildRenderedChatMessagesInput): RenderedChatMessage[] {
  const now = input.now ?? Date.now
  const renderedMessages = groupBaseMessages(input.baseMessages)
  const pendingUserText = String(input.pendingUserText || '').trim()
  const hasSameTailUserMessage = (() => {
    if (!pendingUserText) return false
    const tail = renderedMessages.length > 0 ? renderedMessages[renderedMessages.length - 1] : null
    if (!tail || tail.role !== 'user') return false
    const normalizedExisting = String(tail.text || '').trim().replace(/\s+/g, ' ')
    const normalizedPending = pendingUserText.replace(/\s+/g, ' ')
    return normalizedExisting === normalizedPending
  })()

  if (pendingUserText && !hasSameTailUserMessage) {
    renderedMessages.push({
      id: '__pending-user__',
      role: 'user',
      text: pendingUserText,
      reasoning: '',
      rawText: pendingUserText,
      localPaths: [],
      embeddedTimestamp: '',
      createdAt: now(),
      status: 'pending',
      images: [],
      sourceMessageIds: ['__pending-user__'],
    })
  }

  const pendingAssistantText = String(input.pendingAssistant.text || '')
  const shouldShowAssistantPreview =
    input.pendingAssistant.started ||
    input.pendingAssistant.stopping ||
    Boolean(pendingAssistantText.trim())

  if (!shouldShowAssistantPreview) {
    return renderedMessages
  }

  const previewText =
    pendingAssistantText || (input.pendingAssistant.stopping ? '正在停止回答...' : 'AI 正在思考...')
  const previewMessage = buildAssistantRenderedMessage([
    {
      id: '__pending-assistant__',
      role: 'assistant',
      text: previewText,
      createdAt: now() + 1,
      status: 'pending',
      model: String(input.pendingAssistant.model || '').trim() || undefined,
      usage: input.pendingAssistant.usage,
    },
  ])

  if (previewMessage) {
    renderedMessages.push(previewMessage)
  }

  return renderedMessages
}

export function shouldShowFullscreenChatLoader(params: {
  loadingSessions: boolean
  loadingTranscript: boolean
  renderedMessageCount: number
  suppressFullscreenLoader?: boolean
}): boolean {
  if (params.suppressFullscreenLoader) return false
  return params.renderedMessageCount === 0 && (params.loadingSessions || params.loadingTranscript)
}
