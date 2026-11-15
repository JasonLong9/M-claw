import { atomicWriteFile, atomicWriteJson } from './atomic-write'
import { callLocalTool, digestSkill, tracePath, type AgentTrace } from './local-agent'
import { readOptionalFile } from './memory/sqlite-store'
import { resolveUserDataDirectory } from './memory/local-memory-provider'

const { randomUUID } = process.getBuiltinModule('node:crypto') as typeof import('node:crypto')
const { lstat } = (process.getBuiltinModule('node:fs') as typeof import('node:fs')).promises
const { join } = process.getBuiltinModule('node:path') as typeof import('node:path')

type Candidate = {
  id: string
  slug: string
  traceId: string
  tools: string[]
  markdown: string
  digest: string
  status: 'draft' | 'evaluated' | 'approved'
  mode?: 'pipeline'
  evaluation?: { digest: string; cases: number }
}

const fixtures = {
  count_characters: { input: 'a😀中', expected: '3' },
  sort_lines: { input: 'banana\napple\n', expected: 'apple\nbanana' },
}

function candidateFile(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('候选版本 ID 无效')
  return join(resolveUserDataDirectory(), 'skill-candidates', `${id}.json`)
}

function renderSkill(slug: string, tools: string[], version: string, mode?: Candidate['mode']): string {
  if (mode === 'pipeline') {
    const steps = tools.map((tool, index) => {
      const input = index === 0 ? 'the supplied text' : 'the preceding step’s output'
      return `${index + 1}. Run ${tool} on ${input}.`
    }).join('\n')
    return `---\nname: ${slug}\ndescription: Replay an approved sequence of text transformations on supplied text.\n---\n\n# Text transformation\n\nM-claw version: ${version}\n\n${steps}\n\nReturn the last output.\n`
  }
  const instructions = tools.map((tool) => tool === 'count_characters'
    ? '- When the user requests a character count, count Unicode code points and return the count.'
    : '- When the user requests sorting, sort nonempty lines in ascending order and show the result.').join('\n')
  return `---\nname: ${slug}\ndescription: Handle the text operations demonstrated in the associated M-claw run.\n---\n\n# Text operations\n\nM-claw version: ${version}\n\n${instructions}\n`
}

async function readCandidate(id: string): Promise<Candidate> {
  const raw = await readOptionalFile(candidateFile(id))
  if (!raw) throw new Error('找不到候选版本')
  const candidate = JSON.parse(raw.toString('utf8')) as Candidate
  if (candidate.id !== id || !/^mclaw-[a-z0-9-]{1,40}$/.test(candidate.slug) ||
    !Array.isArray(candidate.tools) || !candidate.tools.length || candidate.tools.length > 4 ||
    (candidate.mode !== undefined && candidate.mode !== 'pipeline') ||
    candidate.tools.some((tool) => !Object.hasOwn(fixtures, tool)) ||
    renderSkill(candidate.slug, candidate.tools, id, candidate.mode) !== candidate.markdown ||
    digestSkill(candidate.markdown) !== candidate.digest) throw new Error('候选 Skill 校验失败')
  return candidate
}

export async function draftSkill(traceId: string, name: string): Promise<string> {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) throw new Error('Skill 名称仅使用小写字母、数字和连字符')
  const raw = await readOptionalFile(tracePath(traceId))
  if (!raw) throw new Error('找不到运行轨迹')
  const trace = JSON.parse(raw.toString('utf8')) as AgentTrace
  if (trace.id !== traceId || trace.transitions.at(-1)?.state !== 'completed') throw new Error('仅使用成功完成的运行轨迹')
  const toolRuns = trace.transitions.filter(({ state }) => state === 'tool')
  if (!toolRuns.length || toolRuns.length > 4 || toolRuns.some(({ tool, ok, input }, index) =>
    !ok || !tool || !Object.hasOwn(fixtures, tool) || input !== (index ? 'previous-output' : 'task')
  )) throw new Error('请使用新的成功文本处理轨迹，且每一步须消费前一步的结果')
  const tools = toolRuns.map(({ tool }) => tool!)
  const id = randomUUID()
  const slug = `mclaw-${name}`
  const markdown = renderSkill(slug, tools, id, 'pipeline')
  await atomicWriteJson(candidateFile(id), { id, slug, traceId, tools, markdown, digest: digestSkill(markdown), status: 'draft', mode: 'pipeline' }, { mode: 0o600 })
  return `候选版本 ${id}\n\n${markdown}`
}

function replay(tools: string[], input: string): string {
  return tools.reduce((text, tool) => callLocalTool(tool, JSON.stringify({ text })), input)
}

const regressionInputs = ['b\na\n\na', '😀\r\n中\r\na', '\n', '42\n2']

function expectedPipelineOutput(tools: string[], input: string): string {
  let text = input
  for (const tool of tools) {
    if (tool === 'count_characters') {
      text = String([...text.matchAll(/./gsu)].length)
    } else {
      const lines = text.replace(/\r\n/g, '\n').split('\n').filter((line) => line.length)
      lines.sort((left, right) => left < right ? -1 : left === right ? 0 : 1)
      text = lines.join('\n')
    }
  }
  return text
}

export async function evaluateSkill(id: string): Promise<string> {
  const candidate = await readCandidate(id)
  for (const tool of candidate.tools) {
    const { input, expected } = fixtures[tool as keyof typeof fixtures]
    if (callLocalTool(tool, JSON.stringify({ text: input })) !== expected) throw new Error(`工具回归未通过：${tool}`)
  }
  if (candidate.mode === 'pipeline') {
    for (const input of regressionInputs) {
      if (replay(candidate.tools, input) !== expectedPipelineOutput(candidate.tools, input)) {
        throw new Error('Skill 组合回归未通过')
      }
    }
  }
  const cases = candidate.tools.length + (candidate.mode === 'pipeline' ? regressionInputs.length : 0)
  const evaluated = {
    ...candidate,
    status: candidate.status === 'draft' ? 'evaluated' : candidate.status,
    evaluation: { digest: candidate.digest, cases },
  }
  await atomicWriteJson(candidateFile(id), evaluated, { mode: 0o600 })
  return `通过回归 ${cases}/${cases}，审批指纹 ${candidate.digest}\n\n${candidate.markdown}`
}

export async function approveSkill(id: string, digest: string): Promise<string> {
  const candidate = await readCandidate(id)
  if (candidate.status !== 'evaluated' || candidate.digest !== digest ||
    (candidate.mode === 'pipeline' && candidate.evaluation?.digest !== digest)) {
    throw new Error('审批需要已评测版本和完整指纹')
  }
  await atomicWriteJson(candidateFile(id), { ...candidate, status: 'approved' }, { mode: 0o600 })
  return `已审批 ${id}`
}

export async function runPublishedSkill(name: string, input: string, workspaceSkills: string): Promise<string> {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name) || !input.trim() || input.length > 4000) {
    throw new Error('需要 Skill 名称及不超过 4000 字符的文本')
  }
  const slug = `mclaw-${name}`
  const raw = await readOptionalFile(join(workspaceSkills, slug, 'SKILL.md'))
  const markdown = raw?.toString('utf8')
  const id = markdown?.match(/^M-claw version: ([0-9a-f-]{36})$/m)?.[1]
  if (!id) throw new Error('未找到已发布的 Skill')
  const candidate = await readCandidate(id)
  if (candidate.slug !== slug || candidate.mode !== 'pipeline' || candidate.status !== 'approved' ||
    candidate.evaluation?.digest !== candidate.digest || candidate.markdown !== markdown) {
    throw new Error('该 Skill 需要由已评测和审批的组合版本发布')
  }
  return replay(candidate.tools, input) || '（空结果）'
}

export async function activateSkill(id: string, workspaceSkills: string, rollback: boolean): Promise<string> {
  const candidate = await readCandidate(id)
  if (candidate.status !== 'approved') throw new Error('版本尚未通过审批')
  const directory = join(workspaceSkills, candidate.slug)
  const activePath = join(directory, 'SKILL.md')
  const info = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  if (info && !info.isDirectory()) throw new Error('Skill 路径不是普通目录')
  const active = await readOptionalFile(activePath)
  if (active) {
    const oldId = active.toString('utf8').match(/^M-claw version: ([0-9a-f-]{36})$/m)?.[1]
    if (!oldId) throw new Error('该 Skill 名称已被占用')
    const old = await readCandidate(oldId)
    if (old.slug !== candidate.slug || old.markdown !== active.toString('utf8')) throw new Error('当前 Skill 已被外部修改')
    // Record the outgoing version before replacing it. The active file is the
    // source of truth; this also repairs a crash after activation.
    await atomicWriteFile(publishedVersionFile(oldId), old.digest, { mode: 0o600 })
    if (oldId === id) return `版本 ${id} 已生效`
  } else if (rollback || info) {
    throw new Error('没有可切换的已发布版本，或目标目录已被占用')
  }
  if (rollback && (await readOptionalFile(publishedVersionFile(id)))?.toString('utf8') !== candidate.digest) {
    throw new Error('只能回滚到曾发布的版本')
  }
  await atomicWriteFile(activePath, candidate.markdown)
  return `${rollback ? '已回滚' : '已发布'} ${candidate.slug} @ ${id}`
}

function publishedVersionFile(id: string): string {
  return join(resolveUserDataDirectory(), 'skill-candidates', `${id}.published`)
}
