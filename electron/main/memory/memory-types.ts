import type { ChatMemoryEntry, ChatMemoryScope, ChatMemorySource } from '../../../src/shared/chat-memory'

export type { ChatMemoryEntry, ChatMemoryScope, ChatMemorySource }

export interface MemoryRetrieveParams {
  sessionId?: string
  query?: string
  maxResults?: number
}

export interface MemoryCommitParams {
  scope: ChatMemoryScope
  content: string
  source: ChatMemorySource
  sessionId?: string
}

export interface MemoryUpsertResult {
  action: 'created' | 'updated' | 'unchanged'
  entry: ChatMemoryEntry
}

export interface MemoryProvider {
  retrieve(params: MemoryRetrieveParams): Promise<ChatMemoryEntry[]>
  commit(params: MemoryCommitParams): Promise<MemoryUpsertResult>
  list(params?: { sessionId?: string }): Promise<ChatMemoryEntry[]>
  update(id: string, content: string): Promise<MemoryUpsertResult | null>
  delete(id: string): Promise<boolean>
}
