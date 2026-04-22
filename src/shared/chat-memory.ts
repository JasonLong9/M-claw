export type ChatMemoryScope = 'user' | 'session'

export type ChatMemorySource = 'auto' | 'manual'

export interface ChatMemoryEntry {
  id: string
  scope: ChatMemoryScope
  content: string
  source: ChatMemorySource
  createdAt: number
  updatedAt: number
  sessionId?: string
}

export interface ChatMemoryListRequest {
  sessionId?: string
}

export interface ChatMemorySaveRequest {
  id?: string
  scope: ChatMemoryScope
  content: string
  sessionId?: string
}

export interface ChatMemorySaveResult {
  ok: boolean
  action?: 'created' | 'updated' | 'unchanged'
  entry?: ChatMemoryEntry
  messageText?: string
}

export interface ChatMemoryDeleteResult {
  ok: boolean
  memoryId: string
  messageText?: string
}
