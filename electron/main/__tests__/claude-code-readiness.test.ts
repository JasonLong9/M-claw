import { afterEach, describe, expect, it, vi } from 'vitest'
import { getClaudeCodeStatus } from '../coding/claude-code-readiness'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

const { mkdtemp, rm, mkdir, writeFile } = fs.promises
const tempDirs: string[] = []

interface MockCommandResult {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
  error?: string
}

function createRunCommand(
  responses: Record<string, MockCommandResult>
) {
  return vi.fn(async (command: string, args: string[]) => {
    const key = `${command} ${args.join(' ')}`.trim()
    return responses[key] || {
      ok: false,
      stdout: '',
      stderr: `unexpected command: ${key}`,
      code: 1,
    }
  })
}

async function createTempRepoRoot(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mclaw-claude-readiness-'))
  tempDirs.push(directory)
  return directory
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeFixtureFile(filePath: string, contents = ''): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, 'utf8')
}

async function createBundledRuntimeFixture(rootDir: string): Promise<void> {
  await writeJson(path.join(rootDir, 'resources', 'openclaw-bundle', 'manifest.json'), {
    schemaVersion: 1,
    product: 'Mclaw',
    openclawVersion: '2026.4.23',
    defaultDeliveryMode: 'bundled-runtime',
    targetDeliveryMode: 'bundled-runtime',
    artifacts: {
      runtime: [
        {
          platform: 'win32',
          arch: 'x64',
          directoryName: 'windows-x64',
          version: '2026.4.23',
        },
      ],
      managedPlugins: [],
    },
  })
  await writeFixtureFile(path.join(rootDir, 'resources', 'openclaw-bundle', 'runtime', 'windows-x64', 'node.exe'))
  await writeFixtureFile(path.join(rootDir, 'resources', 'dev-tools-bundle', 'windows-x64', 'git', 'cmd', 'git.exe'))
  await writeFixtureFile(path.join(rootDir, 'resources', 'dev-tools-bundle', 'windows-x64', 'git', 'bin', 'bash.exe'))
  await writeFixtureFile(path.join(rootDir, 'resources', 'dev-tools-bundle', 'windows-x64', 'claude-code', 'claude.cmd'))
  await writeJson(
    path.join(rootDir, 'resources', 'dev-tools-bundle', 'windows-x64', 'claude-code', 'node_modules', '@anthropic-ai', 'claude-code', 'package.json'),
    {
      name: '@anthropic-ai/claude-code',
      version: '1.0.1',
    }
  )
  await writeFixtureFile(
    path.join(rootDir, 'resources', 'dev-tools-bundle', 'windows-x64', 'claude-code', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
    'console.log("ok")\n'
  )
}

const isolatedEnv = {
  APP_ROOT: 'D:\\workspace\\Mclaw',
  VITE_PUBLIC: 'D:\\workspace\\Mclaw\\dist',
} as NodeJS.ProcessEnv

afterEach(async () => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop()
    if (!target) continue
    await rm(target, { recursive: true, force: true })
  }
})

describe('claude-code-readiness', () => {
  it('reports install-required when Claude Code is missing', async () => {
    const repoRoot = await createTempRepoRoot()
    const runCommand = createRunCommand({
      'claude.cmd --version': {
        ok: false,
        stdout: '',
        stderr: "'claude.cmd' is not recognized as an internal or external command",
        code: 1,
        error: 'not recognized',
      },
    })

    const status = await getClaudeCodeStatus({
      platform: 'win32',
      userDataDir: path.join(repoRoot, 'userData'),
      cwd: repoRoot,
      resourcesPath: path.join(repoRoot, 'resources'),
      runCommand,
      env: isolatedEnv,
    })

    expect(status.installed).toBe(false)
    expect(status.ready).toBe(false)
    expect(status.setupState).toBe('install-required')
    expect(status.command).toBe('claude.cmd')
    expect(status.installGuide.supportsOneClickInstall).toBe(true)
    expect(status.installGuide.installModeLabel).toContain('Mclaw')
    expect(status.summary).toContain('初始化开发环境')
    expect(runCommand).toHaveBeenCalledTimes(1)
  })

  it('reports prerequisite-required when Git is unavailable on Windows', async () => {
    const repoRoot = await createTempRepoRoot()
    const runCommand = createRunCommand({
      'claude.cmd --version': {
        ok: true,
        stdout: '1.0.1',
        stderr: '',
        code: 0,
      },
      'git.exe --version': {
        ok: false,
        stdout: '',
        stderr: "'git' is not recognized as an internal or external command",
        code: 1,
      },
    })

    const status = await getClaudeCodeStatus({
      platform: 'win32',
      userDataDir: path.join(repoRoot, 'userData'),
      cwd: repoRoot,
      resourcesPath: path.join(repoRoot, 'resources'),
      runCommand,
      env: isolatedEnv,
    })

    expect(status.installed).toBe(true)
    expect(status.ready).toBe(false)
    expect(status.setupState).toBe('prerequisite-required')
    expect(status.gitAvailable).toBe(false)
    expect(status.summary).toContain('前置依赖')
    expect(runCommand).toHaveBeenCalledTimes(2)
  })

  it('keeps Claude Code usable when the local CLI is installed but not authenticated', async () => {
    const repoRoot = await createTempRepoRoot()
    const runCommand = createRunCommand({
      'claude.cmd --version': {
        ok: true,
        stdout: '1.0.1',
        stderr: '',
        code: 0,
      },
      'git.exe --version': {
        ok: true,
        stdout: 'git version 2.49.0.windows.1',
        stderr: '',
        code: 0,
      },
      'claude.cmd auth status --json': {
        ok: true,
        stdout: JSON.stringify({ loggedIn: false }),
        stderr: '',
        code: 0,
      },
    })

    const status = await getClaudeCodeStatus({
      platform: 'win32',
      userDataDir: path.join(repoRoot, 'userData'),
      cwd: repoRoot,
      resourcesPath: path.join(repoRoot, 'resources'),
      runCommand,
      env: isolatedEnv,
    })

    expect(status.installed).toBe(true)
    expect(status.ready).toBe(true)
    expect(status.authState).toBe('unauthenticated')
    expect(status.setupState).toBe('ready')
    expect(status.summary).toContain('中台')
  })

  it('reports ready when the bundled dev runtime is available', async () => {
    const repoRoot = await createTempRepoRoot()
    const userDataDir = path.join(repoRoot, 'userData')
    await createBundledRuntimeFixture(repoRoot)

    const nodePath = path.join(repoRoot, 'resources', 'openclaw-bundle', 'runtime', 'windows-x64', 'node.exe')
    const gitPath = path.join(repoRoot, 'resources', 'dev-tools-bundle', 'windows-x64', 'git', 'cmd', 'git.exe')
    const cliPath = path.join(repoRoot, 'resources', 'dev-tools-bundle', 'windows-x64', 'claude-code', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    const runCommand = createRunCommand({
      [`${nodePath} ${cliPath} --version`]: {
        ok: true,
        stdout: '1.0.1',
        stderr: '',
        code: 0,
      },
      [`${gitPath} --version`]: {
        ok: true,
        stdout: 'git version 2.49.0.windows.1',
        stderr: '',
        code: 0,
      },
      [`${nodePath} ${cliPath} auth status --json`]: {
        ok: true,
        stdout: JSON.stringify({ loggedIn: false }),
        stderr: '',
        code: 0,
      },
    })

    const status = await getClaudeCodeStatus({
      platform: 'win32',
      arch: 'x64',
      userDataDir,
      cwd: repoRoot,
      resourcesPath: path.join(repoRoot, 'resources'),
      runCommand,
      env: isolatedEnv,
    })

    expect(status.installed).toBe(true)
    expect(status.ready).toBe(true)
    expect(status.setupState).toBe('ready')
    expect(status.installGuide.bundledRuntimeAvailable).toBe(true)
    expect(status.diagnostics.commandSource).toBe('bundled-runtime')
    expect(status.diagnostics.gitSource).toBe('bundled-runtime')
    expect(status.summary).toContain('Mclaw 内置开发运行时已就绪')
  })
})
