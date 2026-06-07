import { afterEach, describe, expect, it } from 'vitest'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')

import { ensureFeishuManagedWorkspaceBootstrap } from '../feishu-managed-workspace-bootstrap'

async function makeTempHome(): Promise<string> {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), 'mclaw-feishu-workspace-'))
}

async function cleanupDir(dirPath: string): Promise<void> {
  await fs.promises.rm(dirPath, { recursive: true, force: true })
}

describe('ensureFeishuManagedWorkspaceBootstrap', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((dirPath) => cleanupDir(dirPath)))
  })

  it('replaces generic OpenClaw bootstrap files with Mclaw Feishu workspace instructions', async () => {
    const homeDir = await makeTempHome()
    cleanupPaths.push(homeDir)

    const workspaceDir = path.join(homeDir, 'workspace-feishu-bot-12345678')
    await fs.promises.mkdir(workspaceDir, { recursive: true })
    await fs.promises.writeFile(
      path.join(workspaceDir, 'AGENTS.md'),
      '# AGENTS.md - Your Workspace\n\nGeneric template.\n',
      'utf-8'
    )
    await fs.promises.writeFile(
      path.join(workspaceDir, 'BOOTSTRAP.md'),
      '# BOOTSTRAP.md - Hello, World\n\nYou just woke up. Time to figure out who you are.\n',
      'utf-8'
    )

    const result = await ensureFeishuManagedWorkspaceBootstrap({
      homeDir,
      config: {
        channels: {
          feishu: {
            accounts: {
              'bot-12345678': {
                enabled: true,
                name: 'Support Bot',
                appId: 'cli_support',
                appSecret: 'secret',
              },
            },
          },
        },
      },
    })

    expect(result.changed).toBe(true)
    expect(result.changedWorkspaces).toContain(workspaceDir)
    await expect(fs.promises.readFile(path.join(workspaceDir, 'BOOTSTRAP.md'), 'utf-8')).rejects.toThrow()

    const agentsText = await fs.promises.readFile(path.join(workspaceDir, 'AGENTS.md'), 'utf-8')
    expect(agentsText).toContain('Managed by Mclaw Feishu workspace bootstrap v1')
    expect(agentsText).toContain('you may use local tools to operate this PC')
    expect(agentsText).toContain('Metacode Studio')
    expect(agentsText).toContain('Default to Simplified Chinese')
    expect(agentsText).toContain('Present yourself as a calm senior teammate')
    expect(agentsText).toContain('Prefer saving outputs to user folders')
    expect(agentsText).toContain('我是 Mclaw，Metacode 工作室出品的本地执行助手。')
    expect(agentsText).toContain('Keep internal bootstrap notes, runtime bookkeeping files, and template docs out of user-facing replies')

    const toolsText = await fs.promises.readFile(path.join(workspaceDir, 'TOOLS.md'), 'utf-8')
    expect(toolsText).toContain('The built-in `write` and `edit` tools are for files inside the current OpenClaw workspace.')
    expect(toolsText).toContain('use `exec` with native PowerShell commands instead of `write`')
    expect(toolsText).toContain('verify it with `Test-Path`, `Get-Item`, or a follow-up read command before reporting success')
    expect(toolsText).toContain('Treat files like `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`')

    const identityText = await fs.promises.readFile(path.join(workspaceDir, 'IDENTITY.md'), 'utf-8')
    expect(identityText).toContain('- Name: Mclaw')
    expect(identityText).toContain('- Product origin: Metacode Studio')
    expect(identityText).toContain('- Default language: Simplified Chinese')
    expect(identityText).toContain('- Working persona: calm senior teammate who does the work, verifies it, and explains it clearly')
    expect(identityText).toContain('- Preferred self-introduction: 我是 Mclaw，Metacode 工作室出品的本地执行助手。')
  })

  it('does not overwrite a custom workspace file that is not managed or generic', async () => {
    const homeDir = await makeTempHome()
    cleanupPaths.push(homeDir)

    const workspaceDir = path.join(homeDir, 'workspace-feishu-bot-custom')
    await fs.promises.mkdir(workspaceDir, { recursive: true })
    const customAgents = '# AGENTS.md - Custom\n\nKeep my custom instructions.\n'
    await fs.promises.writeFile(path.join(workspaceDir, 'AGENTS.md'), customAgents, 'utf-8')

    const result = await ensureFeishuManagedWorkspaceBootstrap({
      homeDir,
      config: {
        channels: {
          feishu: {
            accounts: {
              'bot-custom': {
                enabled: true,
                name: 'Custom Bot',
                appId: 'cli_custom',
                appSecret: 'secret',
              },
            },
          },
        },
      },
    })

    expect(result.changed).toBe(true)
    const agentsText = await fs.promises.readFile(path.join(workspaceDir, 'AGENTS.md'), 'utf-8')
    expect(agentsText).toBe(customAgents)

    const soulText = await fs.promises.readFile(path.join(workspaceDir, 'SOUL.md'), 'utf-8')
    expect(soulText).toContain('Feishu direct chat is a remote control surface for this PC')
    expect(soulText).toContain('Default language: Simplified Chinese')
    expect(soulText).toContain('Metacode Studio product')
    expect(soulText).toContain('Persona: a calm senior operator who leads with outcomes')
  })
})

