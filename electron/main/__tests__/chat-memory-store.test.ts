import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalMemoryProvider } from '../memory/local-memory-provider'
import { buildMemoryContext } from '../memory/memory-retriever'
import { extractMemoryCommitParams } from '../memory/memory-extractor'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const { mkdtemp, rm } = fs.promises

const RETRYABLE_RM_CODES = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM'])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function removeWithRetry(targetPath: string): Promise<void> {
  const normalized = String(targetPath || '').trim()
  if (!normalized) return

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(normalized, { recursive: true, force: true })
      return
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code || '') : ''
      if (!RETRYABLE_RM_CODES.has(code) || attempt === 9) throw error
      await sleep(100 * (attempt + 1))
    }
  }
}

describe('local memory provider', () => {
  let userDataDir = ''
  const originalUserDataDir = process.env.QCLAW_USER_DATA_DIR

  beforeEach(async () => {
    userDataDir = await mkdtemp(path.join(os.tmpdir(), 'qclaw-memory-store-'))
    process.env.QCLAW_USER_DATA_DIR = userDataDir
  })

  afterEach(async () => {
    if (userDataDir) {
      await removeWithRetry(userDataDir)
      userDataDir = ''
    }
    process.env.QCLAW_USER_DATA_DIR = originalUserDataDir
  })

  it('commits, lists, updates, and deletes user/session memories', async () => {
    const provider = new LocalMemoryProvider()

    const userResult = await provider.commit({
      scope: 'user',
      source: 'manual',
      content: '以后默认用中文回复',
    })
    const sessionResult = await provider.commit({
      scope: 'session',
      source: 'manual',
      sessionId: 'session-a',
      content: '本次会话里只做记忆基础版。',
    })

    const listed = await provider.list({ sessionId: 'session-a' })
    expect(listed.map((entry) => entry.id)).toEqual([sessionResult.entry.id, userResult.entry.id])

    const updated = await provider.update(userResult.entry.id, '以后默认用中文回复，并附上验证步骤')
    expect(updated?.action).toBe('updated')
    expect(updated?.entry.content).toBe('以后默认用中文回复，并附上验证步骤')

    await expect(provider.delete(sessionResult.entry.id)).resolves.toBe(true)
    const afterDelete = await provider.list({ sessionId: 'session-a' })
    expect(afterDelete).toHaveLength(1)
    expect(afterDelete[0]?.scope).toBe('user')
  })

  it('dedupes comparable preference memories and preserves manual wording', async () => {
    const provider = new LocalMemoryProvider()

    const manualResult = await provider.commit({
      scope: 'user',
      source: 'manual',
      content: '以后默认用中文回复',
    })
    const autoResult = await provider.commit({
      scope: 'user',
      source: 'auto',
      content: '默认使用中文回复。',
    })

    expect(autoResult.action).toBe('unchanged')

    const listed = await provider.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(manualResult.entry.id)
    expect(listed[0]?.content).toBe('以后默认用中文回复')
    expect(listed[0]?.source).toBe('manual')
  })

  it('lists only global memories when no session id is provided', async () => {
    const provider = new LocalMemoryProvider()

    await provider.commit({
      scope: 'user',
      source: 'manual',
      content: '给我测试步骤',
    })
    await provider.commit({
      scope: 'session',
      source: 'manual',
      sessionId: 'session-a',
      content: '只处理当前会话上下文',
    })
    await provider.commit({
      scope: 'session',
      source: 'manual',
      sessionId: 'session-b',
      content: '另一个会话的临时约束',
    })

    const listed = await provider.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]?.scope).toBe('user')
    expect(listed[0]?.content).toBe('给我测试步骤')
  })

  it('builds grouped memory context text for prompt injection', async () => {
    const provider = new LocalMemoryProvider()

    await provider.commit({
      scope: 'user',
      source: 'manual',
      content: '以后默认用中文回复',
    })
    await provider.commit({
      scope: 'session',
      source: 'manual',
      sessionId: 'session-context',
      content: '当前会话先只交付记忆基础版',
    })

    const result = await buildMemoryContext({
      provider,
      sessionId: 'session-context',
      messageText: '继续推进当前会话',
    })

    expect(result.entries).toHaveLength(2)
    expect(result.prompt).toContain('高优先级用户偏好与上下文')
    expect(result.prompt).toContain('请直接执行，不要只在回答里复述“我记住了”')
    expect(result.prompt).toContain('全局偏好')
    expect(result.prompt).toContain('以后默认用中文回复')
    expect(result.prompt).toContain('当前会话记忆')
    expect(result.prompt).toContain('当前会话先只交付记忆基础版')
  })

  it('keeps only the latest conflicting reply-format memory in the injected context', async () => {
    const provider = new LocalMemoryProvider()

    await provider.commit({
      scope: 'user',
      source: 'manual',
      content: '以后每次回复第一行先输出【旧格式】',
    })
    await provider.commit({
      scope: 'user',
      source: 'manual',
      content: '以后每次回复第一行先输出【新格式】',
    })

    const result = await buildMemoryContext({
      provider,
      sessionId: 'session-prefix-conflict',
      messageText: '说一句你好',
    })

    expect(result.prompt).toContain('以后每次回复第一行先输出【新格式】')
    expect(result.prompt).not.toContain('以后每次回复第一行先输出【旧格式】')
  })

  it('avoids duplicate candidates when explicit remember text also matches a stable preference rule', () => {
    const candidates = extractMemoryCommitParams({
      sessionId: 'session-explicit',
      userMessage: '请记住：以后默认用中文回复',
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      scope: 'user',
      source: 'manual',
      content: '以后默认用中文回复',
    })
  })
})
