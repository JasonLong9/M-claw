import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { runLocalAgent, saveAgentTrace } from '../local-agent'
import { buildChatMemoryContext, clearChatSummary, recordChatSummary } from '../memory'
import { LocalMemoryProvider } from '../memory/local-memory-provider'
import { activateSkill, approveSkill, draftSkill, evaluateSkill, runPublishedSkill } from '../skill-release'

const { mkdir, mkdtemp, readFile, rm, writeFile } = (process.getBuiltinModule('node:fs') as typeof import('node:fs')).promises
const { tmpdir } = process.getBuiltinModule('node:os') as typeof import('node:os')
const { join } = process.getBuiltinModule('node:path') as typeof import('node:path')

const model = { baseUrl: 'http://127.0.0.1:8080/v1', model: 'test-model' }
const response = (message: object) => Response.json({ choices: [{ message }] })
const call = (name: string, args: object) => ({
  content: null,
  tool_calls: [{ id: 'call-1', type: 'function', function: { name, arguments: JSON.stringify(args) } }],
})

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mclaw-completion-'))
  vi.stubEnv('QCLAW_USER_DATA_DIR', directory)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

it('retries the model, feeds back a tool result and records the completed run', async () => {
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(response(call('count_characters', { text: 'a😀' })))
    .mockResolvedValueOnce(response({ content: '两字符' }))
  const result = await runLocalAgent('数一数', '', model, request)
  expect(result.answer).toBe('两字符')
  expect(result.trace.transitions.map(({ state }) => state)).toEqual(['model', 'retry', 'tool', 'model', 'completed'])
  const payload = JSON.parse(String(request.mock.calls[2][1]?.body))
  expect(payload.messages.at(-1)).toEqual({ role: 'tool', tool_call_id: 'call-1', content: '2' })
})

it('reports bad tool arguments and ends when the step budget is used', async () => {
  const request = vi.fn<typeof fetch>().mockImplementation(async () => response(call('sort_lines', { text: 1 })))
  const result = await runLocalAgent('排序', '', model, request, 2)
  expect(result.ok).toBe(false)
  expect(result.trace.transitions.filter(({ state }) => state === 'tool').every(({ ok }) => ok === false)).toBe(true)
  expect(result.trace.transitions.at(-1)?.state).toBe('exhausted')
})

it('migrates JSON into SQLite once, preserves concurrent writes and injects only this session summary', async () => {
  const legacy = join(directory, 'memory', 'memories.json')
  await mkdir(join(directory, 'memory'))
  await writeFile(legacy, JSON.stringify({ version: 1, entries: [
    { id: 'legacy', content: '旧偏好', scope: 'user', source: 'manual', createdAt: 1, updatedAt: 1 },
  ] }))
  const provider = new LocalMemoryProvider()
  await Promise.all(['第一项', '第二项'].map((content) => provider.commit({ content, scope: 'user', source: 'manual' })))
  expect((await new LocalMemoryProvider().list()).map(({ content }) => content)).toEqual(expect.arrayContaining(['旧偏好', '第一项', '第二项']))
  expect((await readFile(join(directory, 'memory', 'memories.sqlite3'))).subarray(0, 15).toString()).toBe('SQLite format 3')
  expect(await provider.delete('legacy')).toBe(true)
  expect((await provider.list()).some(({ id }) => id === 'legacy')).toBe(false)
  await recordChatSummary('session-a', '主题桐花', '确认')
  expect((await buildChatMemoryContext({ sessionId: 'session-a', messageText: '继续' })).prompt).toContain('主题桐花')
  expect((await buildChatMemoryContext({ sessionId: 'session-b', messageText: '继续' })).prompt).not.toContain('主题桐花')
  await clearChatSummary('session-a')
  expect((await buildChatMemoryContext({ sessionId: 'session-a', messageText: '继续' })).prompt).not.toContain('主题桐花')
})

it('requires evaluation and approval, then publishes and rolls back two trace-based Skill versions', async () => {
  const workspaceSkills = join(directory, 'workspace', 'skills')
  const prepare = async (tool: string) => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(call(tool, { text: 'b\na' })))
      .mockResolvedValueOnce(response({ content: '完成' }))
    const { trace } = await runLocalAgent('处理文本', '', model, request)
    await saveAgentTrace(trace)
    const version = (await draftSkill(trace.id, 'text')).match(/[0-9a-f-]{36}/)![0]
    await expect(activateSkill(version, workspaceSkills, false)).rejects.toThrow('未通过审批')
    const evaluation = await evaluateSkill(version)
    const checksum = evaluation.match(/[0-9a-f]{64}/)![0]
    await expect(approveSkill(version, 'invalid')).rejects.toThrow('完整指纹')
    await approveSkill(version, checksum)
    return version
  }
  const first = await prepare('sort_lines')
  const second = await prepare('count_characters')
  const path = join(workspaceSkills, 'mclaw-text', 'SKILL.md')
  await activateSkill(first, workspaceSkills, false)
  await activateSkill(second, workspaceSkills, false)
  expect(await readFile(path, 'utf8')).toContain(second)
  await expect(runPublishedSkill('text', 'b\na', workspaceSkills)).resolves.toBe('3')
  await activateSkill(first, workspaceSkills, true)
  expect(await readFile(path, 'utf8')).toContain(first)
  await expect(runPublishedSkill('text', 'b\na', workspaceSkills)).resolves.toBe('a\nb')
})

it('derives an ordered pipeline without storing tool arguments and reuses it on new inputs', async () => {
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response(call('sort_lines', { text: 'z-secret\na-secret\n\n' })))
    .mockResolvedValueOnce(response(call('count_characters', { text: 'a-secret\nz-secret' })))
    .mockResolvedValueOnce(response({ content: '完成' }))
  const { trace } = await runLocalAgent('排序后计数', '', model, request)
  await saveAgentTrace(trace)
  expect(JSON.stringify(trace)).not.toContain('secret')
  const draft = await draftSkill(trace.id, 'sorted-length')
  const id = draft.match(/[0-9a-f-]{36}/)![0]
  expect(draft).toMatch(/1\. Run sort_lines[\s\S]+2\. Run count_characters/)
  const evaluation = await evaluateSkill(id)
  expect(evaluation).toContain('6/6')
  await approveSkill(id, evaluation.match(/[0-9a-f]{64}/)![0])
  const workspace = join(directory, 'skills')
  await activateSkill(id, workspace, false)
  await expect(runPublishedSkill('sorted-length', '😀\n\na\n', workspace)).resolves.toBe('3')
})

it('rejects a trace whose second tool used unrelated input', async () => {
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response(call('sort_lines', { text: 'b\na' })))
    .mockResolvedValueOnce(response(call('count_characters', { text: 'unrelated' })))
    .mockResolvedValueOnce(response({ content: '完成' }))
  const { trace } = await runLocalAgent('两项操作', '', model, request)
  await saveAgentTrace(trace)
  await expect(draftSkill(trace.id, 'independent')).rejects.toThrow('前一步')
})
