import { afterEach, describe, expect, it } from 'vitest'
import { inspectCodingWorkspacePath, routeChatTask } from '../chat-task-router'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

const { mkdtemp, rm, writeFile, mkdir } = fs.promises

const tempDirs: string[] = []
const originalUserDataDir = process.env.QCLAW_USER_DATA_DIR

async function createProjectDir(marker = 'package.json'): Promise<string> {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'mclaw-chat-task-router-'))
  tempDirs.push(projectDir)
  if (marker === '.git') {
    await mkdir(path.join(projectDir, '.git'), { recursive: true })
  } else {
    await writeFile(path.join(projectDir, marker), '{}', 'utf8')
  }
  return projectDir
}

async function createPlainDir(): Promise<string> {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'mclaw-chat-task-router-plain-'))
  tempDirs.push(projectDir)
  return projectDir
}

afterEach(async () => {
  if (originalUserDataDir == null) delete process.env.QCLAW_USER_DATA_DIR
  else process.env.QCLAW_USER_DATA_DIR = originalUserDataDir

  while (tempDirs.length > 0) {
    const target = tempDirs.pop()
    if (!target) continue
    await rm(target, { recursive: true, force: true })
  }
})

describe('chat task router', () => {
  it('rejects coding mode when the workspace path is missing', () => {
    const decision = routeChatTask({
      requestedTaskMode: 'coding-executor',
      workspacePath: '',
    })

    expect(decision.mode).toBe('normal-chat')
    expect(decision.reason).toContain('项目目录')
  })

  it('reports project markers for a valid coding workspace', async () => {
    const projectDir = await createProjectDir('package.json')

    const status = inspectCodingWorkspacePath(projectDir)

    expect(status.ready).toBe(true)
    expect(status.setupState).toBe('ready')
    expect(status.detectedMarkers).toContain('package.json')
    expect(status.summary).toContain('已识别为开发项目目录')
  })

  it('normalizes surrounding quotes before checking the workspace path', async () => {
    const projectDir = await createProjectDir('package.json')

    const status = inspectCodingWorkspacePath(`"${projectDir}"`)

    expect(status.ready).toBe(true)
    expect(status.normalizedPath).toBe(projectDir)
  })

  it('accepts a plain folder as a greenfield workspace for coding mode', async () => {
    const projectDir = await createPlainDir()

    const status = inspectCodingWorkspacePath(projectDir)

    expect(status.ready).toBe(true)
    expect(status.setupState).toBe('new-project')
    expect(status.summary).toContain('从 0 开始创建新项目')
  })

  it('blocks protected Mclaw runtime directories from being used as coding workspaces', async () => {
    const userDataDir = await createPlainDir()
    const protectedDir = path.join(userDataDir, 'openclaw-state')
    await mkdir(protectedDir, { recursive: true })
    process.env.QCLAW_USER_DATA_DIR = userDataDir

    const status = inspectCodingWorkspacePath(protectedDir)

    expect(status.ready).toBe(false)
    expect(status.setupState).toBe('not-project')
    expect(status.summary).toContain('Mclaw')
    expect(status.summary).toContain('受保护目录')
  })

  it('routes to Claude Code when the workspace looks like a project and the session is local', async () => {
    const projectDir = await createProjectDir('package.json')

    const decision = routeChatTask({
      requestedTaskMode: 'coding-executor',
      workspacePath: projectDir,
      codingModelProfileId: 'claude-code-current',
      matchedSession: {
        sessionId: 'local-session',
        sessionKey: 'local-session',
        agentId: 'main',
        updatedAt: Date.now(),
        kind: 'direct',
        hasLocalTranscript: true,
        localOnly: true,
      },
    })

    expect(decision).toEqual({
      mode: 'coding-executor',
      workspacePath: projectDir,
    })
  })

  it('also routes to Claude Code for a brand-new empty workspace when the session is local', async () => {
    const projectDir = await createPlainDir()

    const decision = routeChatTask({
      requestedTaskMode: 'coding-executor',
      workspacePath: projectDir,
      codingModelProfileId: 'claude-code-current',
      matchedSession: {
        sessionId: 'local-session',
        sessionKey: 'local-session',
        agentId: 'main',
        updatedAt: Date.now(),
        kind: 'direct',
        hasLocalTranscript: true,
        localOnly: true,
      },
    })

    expect(decision).toEqual({
      mode: 'coding-executor',
      workspacePath: projectDir,
    })
  })

  it('rejects coding mode when a coming-soon coding model is selected', async () => {
    const projectDir = await createProjectDir('package.json')

    const decision = routeChatTask({
      requestedTaskMode: 'coding-executor',
      workspacePath: projectDir,
      codingModelProfileId: 'platform-kimi',
      matchedSession: {
        sessionId: 'local-session',
        sessionKey: 'local-session',
        agentId: 'main',
        updatedAt: Date.now(),
        kind: 'direct',
        hasLocalTranscript: true,
        localOnly: true,
      },
    })

    expect(decision.mode).toBe('normal-chat')
    expect(decision.reason).toContain('还未接入 Mclaw 开发模式')
    expect(decision.reason).toContain('Claude Code 当前模型')
  })

  it('rejects coding mode for upstream direct sessions even when the project path is valid', async () => {
    const projectDir = await createProjectDir('.git')

    const decision = routeChatTask({
      requestedTaskMode: 'coding-executor',
      workspacePath: projectDir,
      matchedSession: {
        sessionId: 'remote-session',
        sessionKey: 'agent:main:remote-session',
        agentId: 'main',
        updatedAt: Date.now(),
        kind: 'direct',
        hasLocalTranscript: true,
        authorityKind: 'upstream-direct',
        localOnly: false,
      },
    })

    expect(decision.mode).toBe('normal-chat')
    expect(decision.reason).toContain('本地 direct 会话')
  })
})
