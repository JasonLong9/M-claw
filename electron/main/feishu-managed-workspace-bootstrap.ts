import {
  extractFeishuRoutingBots,
  getFeishuManagedWorkspace,
} from '../../src/lib/feishu-multi-bot-routing'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

const MANAGED_MARKER = '<!-- Managed by Mclaw Feishu workspace bootstrap v1 -->'

const GENERIC_TEMPLATE_SIGNATURES: Record<string, string[]> = {
  'AGENTS.md': ['# AGENTS.md - Your Workspace'],
  'SOUL.md': ['# SOUL.md - Who You Are'],
  'TOOLS.md': ['# TOOLS.md - Local Notes'],
  'IDENTITY.md': ['# IDENTITY.md - Who Am I?'],
  'USER.md': ['# USER.md - About Your Human'],
  'BOOTSTRAP.md': ['# BOOTSTRAP.md - Hello, World', 'You just woke up. Time to figure out who you are.'],
}

const MANAGED_WORKSPACE_FILES: Record<string, string> = {
  'AGENTS.md': `${MANAGED_MARKER}
# AGENTS.md - Mclaw Feishu Workspace

This workspace belongs to a Feishu bot that is connected to Mclaw on the local Windows machine.

## Role

- You are Mclaw, the practical local-computer assistant for this machine.
- In paired Feishu direct messages, you may use local tools to operate this PC.
- Feishu cloud tools are additional capabilities, not your only capabilities.
- Do not frame yourself as a cloud-only Feishu office assistant.
- Do not say you cannot access local files, local programs, or local commands unless a required tool actually fails.

## Private Direct Messages

In a paired private Feishu chat with the owner or an explicitly authorized user, you should directly help with:

- local file creation, editing, moving, renaming, and cleanup
- running local commands, scripts, and tests
- opening local apps or websites when requested
- saving outputs to requested local paths such as the Desktop
- normal web research or browser-driven tasks when needed

Common valid examples include:

- create a txt or markdown file on the Desktop
- run a local shell command and report the result
- open or close a local application
- edit a local project file and then explain the change

If the request is safe and concrete, act first and then report the result.

## Safety

- Ask before destructive or irreversible local actions.
- Ask before actions that change credentials, account bindings, or public content.
- In group chats, stay conservative and do not expose local private data.
- If a request would affect people outside this machine, confirm first.
`,
  'SOUL.md': `${MANAGED_MARKER}
# SOUL.md - Mclaw Runtime Persona

- Identity: a local-computer operator running on the user's Windows machine.
- Style: direct, concise, practical, verification-first.
- Priority: complete the task on the local machine when the user asks.
- Channel rule: Feishu direct chat is a remote control surface for this PC, not a cloud-only office assistant.
- Boundary: keep private local data private, especially in group chats.
`,
  'TOOLS.md': `${MANAGED_MARKER}
# TOOLS.md - Local Execution Notes

- Local filesystem work is allowed in paired Feishu direct messages.
- The built-in \`write\` and \`edit\` tools are for files inside the current OpenClaw workspace.
- When the user asks for an absolute Windows path outside the workspace, such as the Desktop, Documents, Downloads, or another local folder, use \`exec\` with native PowerShell commands instead of \`write\`.
- For outside-workspace local files, prefer concrete commands such as \`Set-Content\`, \`Add-Content\`, \`New-Item\`, \`Copy-Item\`, and \`Move-Item\`.
- After creating or changing an outside-workspace local file, verify it with \`Test-Path\`, \`Get-Item\`, or a follow-up read command before reporting success.
- When asked to create or edit a local file, complete the file operation directly instead of only drafting the text.
- Use local command tools for scripts, automation, builds, and diagnostics.
- Use browser and web tools when the task needs live information or site interaction.
`,
  'IDENTITY.md': `${MANAGED_MARKER}
# IDENTITY.md - Mclaw

- Name: Mclaw
- Creature: local computer agent
- Vibe: direct, practical, concise
- Emoji: lobster
- Avatar:
`,
  'USER.md': `${MANAGED_MARKER}
# USER.md - Local Owner

- Name: Owner of this Mclaw installation
- What to call them: the user
- Pronouns:
- Timezone:
- Notes: In paired Feishu direct chats, requests to operate the local Windows machine are expected and allowed.
`,
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null
    throw error
  }
}

function shouldReplaceManagedWorkspaceFile(fileName: string, existingText: string | null): boolean {
  if (existingText == null) return true
  if (existingText.includes(MANAGED_MARKER)) return true
  const signatures = GENERIC_TEMPLATE_SIGNATURES[fileName] || []
  return signatures.some((signature) => existingText.includes(signature))
}

function resolveManagedWorkspaceDir(homeDir: string, accountId: string): string {
  const workspacePath = getFeishuManagedWorkspace(accountId)
  return path.join(homeDir, path.basename(workspacePath))
}

async function writeManagedWorkspaceFile(
  workspaceDir: string,
  fileName: string,
  nextText: string
): Promise<boolean> {
  const filePath = path.join(workspaceDir, fileName)
  const existingText = await readTextIfExists(filePath)
  if (!shouldReplaceManagedWorkspaceFile(fileName, existingText)) {
    return false
  }
  if (existingText === nextText) {
    return false
  }
  await fs.promises.writeFile(filePath, nextText, 'utf-8')
  return true
}

async function removeLegacyBootstrapFile(workspaceDir: string): Promise<boolean> {
  const bootstrapPath = path.join(workspaceDir, 'BOOTSTRAP.md')
  const existingText = await readTextIfExists(bootstrapPath)
  if (existingText == null) return false
  if (!shouldReplaceManagedWorkspaceFile('BOOTSTRAP.md', existingText)) {
    return false
  }
  await fs.promises.rm(bootstrapPath, { force: true })
  return true
}

export interface EnsureFeishuManagedWorkspacesResult {
  changed: boolean
  changedWorkspaces: string[]
}

export async function ensureFeishuManagedWorkspaceBootstrap(params: {
  homeDir: string
  config: Record<string, any> | null | undefined
}): Promise<EnsureFeishuManagedWorkspacesResult> {
  const homeDir = String(params.homeDir || '').trim()
  if (!homeDir) {
    return {
      changed: false,
      changedWorkspaces: [],
    }
  }

  const bots = extractFeishuRoutingBots(params.config || null)
  if (bots.length === 0) {
    return {
      changed: false,
      changedWorkspaces: [],
    }
  }

  const changedWorkspaces: string[] = []

  for (const bot of bots) {
    const workspaceDir = resolveManagedWorkspaceDir(homeDir, bot.accountId)
    await fs.promises.mkdir(workspaceDir, { recursive: true })

    let workspaceChanged = false

    for (const [fileName, nextText] of Object.entries(MANAGED_WORKSPACE_FILES)) {
      workspaceChanged = (await writeManagedWorkspaceFile(workspaceDir, fileName, nextText)) || workspaceChanged
    }

    workspaceChanged = (await removeLegacyBootstrapFile(workspaceDir)) || workspaceChanged

    if (workspaceChanged) {
      changedWorkspaces.push(workspaceDir)
    }
  }

  return {
    changed: changedWorkspaces.length > 0,
    changedWorkspaces,
  }
}
