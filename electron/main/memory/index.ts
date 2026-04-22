import type {
  ChatMemoryDeleteResult,
  ChatMemoryEntry,
  ChatMemoryListRequest,
  ChatMemorySaveRequest,
  ChatMemorySaveResult,
} from '../../../src/shared/chat-memory'
import { LocalMemoryProvider } from './local-memory-provider'
import { extractMemoryCommitParams, isExplicitMemoryInstructionText } from './memory-extractor'
import { buildMemoryContext } from './memory-retriever'
import type { MemoryProvider } from './memory-types'

let providerSingleton: MemoryProvider | null = null

function getProvider(): MemoryProvider {
  if (!providerSingleton) {
    providerSingleton = new LocalMemoryProvider()
  }
  return providerSingleton
}

export async function listChatMemories(request: ChatMemoryListRequest = {}): Promise<ChatMemoryEntry[]> {
  return getProvider().list({
    sessionId: String(request.sessionId || '').trim() || undefined,
  })
}

export async function saveChatMemory(request: ChatMemorySaveRequest): Promise<ChatMemorySaveResult> {
  const content = String(request.content || '').trim()
  if (!content) {
    return {
      ok: false,
      messageText: '记忆内容不能为空',
    }
  }

  const provider = getProvider()
  if (request.id) {
    const updated = await provider.update(request.id, content)
    if (!updated) {
      return {
        ok: false,
        messageText: '未找到要更新的记忆',
      }
    }
    return {
      ok: true,
      action: updated.action,
      entry: updated.entry,
    }
  }

  if (request.scope === 'session' && !String(request.sessionId || '').trim()) {
    return {
      ok: false,
      messageText: '保存当前会话记忆时缺少会话 ID',
    }
  }

  const result = await provider.commit({
    scope: request.scope,
    content,
    source: 'manual',
    sessionId: String(request.sessionId || '').trim() || undefined,
  })
  return {
    ok: true,
    action: result.action,
    entry: result.entry,
  }
}

export async function deleteChatMemory(memoryId: string): Promise<ChatMemoryDeleteResult> {
  const normalizedMemoryId = String(memoryId || '').trim()
  if (!normalizedMemoryId) {
    return {
      ok: false,
      memoryId: normalizedMemoryId,
      messageText: '记忆 ID 不能为空',
    }
  }
  const deleted = await getProvider().delete(normalizedMemoryId)
  return {
    ok: deleted,
    memoryId: normalizedMemoryId,
    messageText: deleted ? undefined : '未找到要删除的记忆',
  }
}

export async function buildChatMemoryContext(params: {
  sessionId: string
  messageText: string
}): Promise<{ prompt: string; entries: ChatMemoryEntry[] }> {
  return buildMemoryContext({
    provider: getProvider(),
    sessionId: params.sessionId,
    messageText: params.messageText,
  })
}

export async function captureChatMemoriesFromTurn(params: {
  sessionId: string
  userMessage: string
}): Promise<Array<{ action: 'created' | 'updated'; entry: ChatMemoryEntry }>> {
  const candidates = extractMemoryCommitParams({
    sessionId: params.sessionId,
    userMessage: params.userMessage,
  })
  if (candidates.length === 0) return []

  const results: Array<{ action: 'created' | 'updated'; entry: ChatMemoryEntry }> = []
  for (const candidate of candidates) {
    const result = await getProvider().commit(candidate)
    if (result.action === 'created' || result.action === 'updated') {
      results.push({
        action: result.action,
        entry: result.entry,
      })
    }
  }
  return results
}

export { isExplicitMemoryInstructionText }
