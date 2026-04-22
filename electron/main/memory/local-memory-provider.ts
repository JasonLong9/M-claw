import type { ChatMemoryEntry, ChatMemoryScope, ChatMemorySource } from '../../../src/shared/chat-memory'
import { atomicWriteJson } from '../atomic-write'
import type { MemoryCommitParams, MemoryProvider, MemoryRetrieveParams, MemoryUpsertResult } from './memory-types'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const crypto = process.getBuiltinModule('node:crypto') as typeof import('node:crypto')
const { readFile } = fs.promises
const { homedir } = os
const { randomUUID } = crypto

interface StoredMemoryStore {
  version: 1
  entries: ChatMemoryEntry[]
}

const STORE_VERSION = 1
const STORE_RELATIVE_PATH = path.join('memory', 'memories.json')
const MAX_USER_MEMORIES = 60
const MAX_SESSION_MEMORIES_PER_SESSION = 30

function resolveUserDataDirectory(): string {
  return String(process.env.QCLAW_USER_DATA_DIR || path.join(homedir(), '.qclaw-lite')).trim()
}

function resolveStorePath(): string {
  return path.join(resolveUserDataDirectory(), STORE_RELATIVE_PATH)
}

function normalizeScope(value: unknown): ChatMemoryScope | undefined {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'user' || normalized === 'session') return normalized
  return undefined
}

function normalizeSource(value: unknown): ChatMemorySource | undefined {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'auto' || normalized === 'manual') return normalized
  return undefined
}

function normalizeMemoryContent(value: unknown): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 500)
}

function normalizeComparableMemoryContent(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/使用/g, '用')
    .replace(/以后|之后|默认|请|尽量|都/g, ' ')
    .replace(/[`"'“”‘’]/g, '')
    .replace(/[，。！？、；：,.!?;:()\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeEntry(value: unknown): ChatMemoryEntry | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<ChatMemoryEntry>
  const id = String(record.id || '').trim()
  const scope = normalizeScope(record.scope)
  const content = normalizeMemoryContent(record.content)
  const source = normalizeSource(record.source)
  const sessionId = String(record.sessionId || '').trim() || undefined
  if (!id || !scope || !content || !source) return null
  if (scope === 'session' && !sessionId) return null

  const createdAt = Number(record.createdAt)
  const updatedAt = Number(record.updatedAt)
  return {
    id,
    scope,
    content,
    source,
    sessionId,
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
  }
}

function scoreEntry(entry: ChatMemoryEntry, normalizedQuery: string): number {
  let score = entry.scope === 'session' ? 120 : 80
  if (normalizedQuery) {
    const normalizedContent = normalizeComparableMemoryContent(entry.content)
    if (normalizedContent && normalizedQuery.includes(normalizedContent)) {
      score += 40
    } else if (normalizedContent && normalizedContent.includes(normalizedQuery)) {
      score += 20
    }
  }
  return score
}

function trimStoreEntries(entries: ChatMemoryEntry[]): ChatMemoryEntry[] {
  const userEntries = entries
    .filter((entry) => entry.scope === 'user')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_USER_MEMORIES)

  const sessionEntries = entries
    .filter((entry) => entry.scope === 'session')
    .sort((left, right) => right.updatedAt - left.updatedAt)

  const perSessionCount = new Map<string, number>()
  const trimmedSessionEntries: ChatMemoryEntry[] = []
  for (const entry of sessionEntries) {
    const sessionId = String(entry.sessionId || '').trim()
    if (!sessionId) continue
    const nextCount = (perSessionCount.get(sessionId) || 0) + 1
    if (nextCount > MAX_SESSION_MEMORIES_PER_SESSION) continue
    perSessionCount.set(sessionId, nextCount)
    trimmedSessionEntries.push(entry)
  }

  return [...userEntries, ...trimmedSessionEntries].sort((left, right) => right.updatedAt - left.updatedAt)
}

async function loadStore(): Promise<StoredMemoryStore> {
  try {
    const raw = await readFile(resolveStorePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoredMemoryStore>
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.map((entry) => sanitizeEntry(entry)).filter((entry): entry is ChatMemoryEntry => Boolean(entry))
      : []
    return {
      version: STORE_VERSION,
      entries: trimStoreEntries(entries),
    }
  } catch {
    return {
      version: STORE_VERSION,
      entries: [],
    }
  }
}

async function saveStore(store: StoredMemoryStore): Promise<void> {
  await atomicWriteJson(resolveStorePath(), store, {
    description: '聊天记忆存储',
  })
}

function findExistingEntryIndex(entries: ChatMemoryEntry[], params: {
  id?: string
  scope: ChatMemoryScope
  sessionId?: string
  content: string
}): number {
  const normalizedId = String(params.id || '').trim()
  if (normalizedId) return entries.findIndex((entry) => entry.id === normalizedId)

  const comparableContent = normalizeComparableMemoryContent(params.content)
  return entries.findIndex((entry) => {
    if (entry.scope !== params.scope) return false
    if ((entry.sessionId || undefined) !== (params.sessionId || undefined)) return false
    return normalizeComparableMemoryContent(entry.content) === comparableContent
  })
}

export class LocalMemoryProvider implements MemoryProvider {
  async retrieve(params: MemoryRetrieveParams): Promise<ChatMemoryEntry[]> {
    const normalizedSessionId = String(params.sessionId || '').trim()
    const normalizedQuery = normalizeComparableMemoryContent(String(params.query || ''))
    const maxResults = Number.isFinite(params.maxResults) && Number(params.maxResults) > 0
      ? Math.min(12, Math.max(1, Number(params.maxResults)))
      : 8
    const store = await loadStore()
    return store.entries
      .filter((entry) => entry.scope === 'user' || (normalizedSessionId && entry.scope === 'session' && entry.sessionId === normalizedSessionId))
      .sort((left, right) => {
        const scoreDelta = scoreEntry(right, normalizedQuery) - scoreEntry(left, normalizedQuery)
        if (scoreDelta !== 0) return scoreDelta
        if (left.source !== right.source) return left.source === 'manual' ? -1 : 1
        return right.updatedAt - left.updatedAt
      })
      .slice(0, maxResults)
  }

  async commit(params: MemoryCommitParams): Promise<MemoryUpsertResult> {
    const scope = params.scope
    const source = params.source
    const content = normalizeMemoryContent(params.content)
    const sessionId = String(params.sessionId || '').trim() || undefined
    if (!content) {
      throw new Error('记忆内容不能为空')
    }
    if (scope === 'session' && !sessionId) {
      throw new Error('保存会话记忆时缺少 sessionId')
    }

    const now = Date.now()
    const store = await loadStore()
    const existingIndex = findExistingEntryIndex(store.entries, {
      scope,
      sessionId,
      content,
    })
    if (existingIndex >= 0) {
      const existing = store.entries[existingIndex]
      const sameComparableContent =
        normalizeComparableMemoryContent(existing.content) === normalizeComparableMemoryContent(content)
      const preserveManualContent =
        existing.source === 'manual' &&
        source === 'auto' &&
        sameComparableContent
      const unchanged =
        (
          existing.content === content ||
          preserveManualContent
        ) &&
        existing.scope === scope &&
        (existing.sessionId || undefined) === sessionId &&
        (existing.source === 'manual' || existing.source === source)
      const nextEntry: ChatMemoryEntry = unchanged
        ? existing
        : {
            ...existing,
            content,
            source: existing.source === 'manual' ? 'manual' : source,
            updatedAt: now,
          }
      if (!unchanged) {
        store.entries[existingIndex] = nextEntry
        store.entries = trimStoreEntries(store.entries)
        await saveStore(store)
      }
      return {
        action: unchanged ? 'unchanged' : 'updated',
        entry: unchanged ? existing : nextEntry,
      }
    }

    const entry: ChatMemoryEntry = {
      id: randomUUID(),
      scope,
      content,
      source,
      sessionId,
      createdAt: now,
      updatedAt: now,
    }
    store.entries.unshift(entry)
    store.entries = trimStoreEntries(store.entries)
    await saveStore(store)
    return {
      action: 'created',
      entry,
    }
  }

  async list(params: { sessionId?: string } = {}): Promise<ChatMemoryEntry[]> {
    const normalizedSessionId = String(params.sessionId || '').trim()
    const store = await loadStore()
    return store.entries
      .filter((entry) => entry.scope === 'user' || (normalizedSessionId && entry.sessionId === normalizedSessionId))
      .sort((left, right) => right.updatedAt - left.updatedAt)
  }

  async update(id: string, content: string): Promise<MemoryUpsertResult | null> {
    const normalizedId = String(id || '').trim()
    const normalizedContent = normalizeMemoryContent(content)
    if (!normalizedId || !normalizedContent) return null

    const now = Date.now()
    const store = await loadStore()
    const existingIndex = findExistingEntryIndex(store.entries, {
      id: normalizedId,
      scope: 'user',
      content: normalizedContent,
    })
    if (existingIndex < 0) return null
    const existing = store.entries[existingIndex]
    const unchanged = existing.content === normalizedContent
    const nextEntry: ChatMemoryEntry = unchanged
      ? existing
      : {
          ...existing,
          content: normalizedContent,
          updatedAt: now,
        }
    if (!unchanged) {
      store.entries[existingIndex] = nextEntry
      store.entries = trimStoreEntries(store.entries)
      await saveStore(store)
    }
    return {
      action: unchanged ? 'unchanged' : 'updated',
      entry: nextEntry,
    }
  }

  async delete(id: string): Promise<boolean> {
    const normalizedId = String(id || '').trim()
    if (!normalizedId) return false
    const store = await loadStore()
    const nextEntries = store.entries.filter((entry) => entry.id !== normalizedId)
    if (nextEntries.length === store.entries.length) return false
    store.entries = nextEntries
    await saveStore(store)
    return true
  }
}
