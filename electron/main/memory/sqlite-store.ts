import initSqlJs from 'sql.js'
import { atomicWriteFile } from '../atomic-write'
import type { ChatMemoryEntry } from './memory-types'

const queues = new Map<string, Promise<unknown>>()
const { readFile } = (process.getBuiltinModule('node:fs') as typeof import('node:fs')).promises
let sqlite: ReturnType<typeof initSqlJs> | undefined

export async function readOptionalFile(path: string): Promise<Buffer | undefined> {
  try {
    return await readFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export function withMemoryStore<T>(
  path: string,
  legacyEntries: () => Promise<ChatMemoryEntry[]>,
  operation: (entries: ChatMemoryEntry[]) => { result: T; changed?: boolean }
): Promise<T> {
  const pending = (queues.get(path) || Promise.resolve()).catch(() => {}).then(async () => {
    const engine = await (sqlite ??= initSqlJs())
    const bytes = await readOptionalFile(path)
    const db = new engine.Database(bytes)
    try {
      let entries: ChatMemoryEntry[]
      if (bytes) {
        const rows = db.exec('SELECT id, scope, session_id, content, source, created_at, updated_at FROM memories')
        entries = (rows[0]?.values || []).map(([id, scope, session, content, source, created, updated]) => ({
          id: String(id), scope: scope as ChatMemoryEntry['scope'], sessionId: session == null ? undefined : String(session),
          content: String(content), source: source as ChatMemoryEntry['source'],
          createdAt: Number(created), updatedAt: Number(updated),
        }))
      } else {
        db.run(`CREATE TABLE memories (
          id TEXT PRIMARY KEY, scope TEXT NOT NULL CHECK (scope IN ('user','session')),
          session_id TEXT, content TEXT NOT NULL, source TEXT NOT NULL CHECK (source IN ('auto','manual')),
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
          CHECK (scope <> 'session' OR session_id IS NOT NULL)
        )`)
        entries = await legacyEntries()
      }

      const { result, changed } = operation(entries)
      if (!bytes || changed) {
        db.run('BEGIN')
        db.run('DELETE FROM memories')
        const insert = db.prepare('INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?)')
        try {
          for (const entry of entries) {
            insert.run([entry.id, entry.scope, entry.sessionId ?? null, entry.content, entry.source, entry.createdAt, entry.updatedAt])
          }
        } finally {
          insert.free()
        }
        db.run('COMMIT')
        await atomicWriteFile(path, db.export(), { mode: 0o600, description: 'SQLite 聊天记忆' })
      }
      return result
    } finally {
      db.close()
    }
  })
  queues.set(path, pending)
  void pending.finally(() => {
    if (queues.get(path) === pending) queues.delete(path)
  }).catch(() => {})
  return pending
}
