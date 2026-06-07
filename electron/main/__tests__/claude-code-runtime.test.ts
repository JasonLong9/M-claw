import { afterEach, describe, expect, it } from 'vitest'
import {
  buildClaudeCodeCommandEnv,
  inspectClaudeCodeOfflineBundle,
  resolveClaudeCodeCommand,
  resolveClaudeCodeGitCommand,
  resolveClaudeCodeSpawnCommand,
} from '../coding/claude-code-runtime'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

const { mkdtemp, rm, mkdir, writeFile } = fs.promises
const tempDirs: string[] = []

async function createTempRepoRoot(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mclaw-claude-runtime-'))
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

describe('claude-code-runtime', () => {
  it('prefers the bundled Windows dev-tools runtime and injects bundled Git into PATH', async () => {
    const repoRoot = await createTempRepoRoot()
    const userDataDir = path.join(repoRoot, 'userData')
    await createBundledRuntimeFixture(repoRoot)

    const commandResolution = resolveClaudeCodeCommand({
      platform: 'win32',
      arch: 'x64',
      cwd: repoRoot,
      resourcesPath: path.join(repoRoot, 'resources'),
      userDataDir,
      env: isolatedEnv,
    })
    const gitResolution = resolveClaudeCodeGitCommand({
      platform: 'win32',
      arch: 'x64',
      cwd: repoRoot,
      resourcesPath: path.join(repoRoot, 'resources'),
      userDataDir,
      env: isolatedEnv,
    })
    const env = buildClaudeCodeCommandEnv({
      platform: 'win32',
      arch: 'x64',
      cwd: repoRoot,
      resourcesPath: path.join(repoRoot, 'resources'),
      userDataDir,
      env: isolatedEnv,
    })
    const offlineBundle = inspectClaudeCodeOfflineBundle({
      platform: 'win32',
      arch: 'x64',
      cwd: repoRoot,
      resourcesPath: path.join(repoRoot, 'resources'),
      userDataDir,
      env: isolatedEnv,
    })

    expect(commandResolution.source).toBe('bundled-runtime')
    expect(commandResolution.command).toContain(path.join('openclaw-bundle', 'runtime', 'windows-x64', 'node.exe'))
    expect(commandResolution.argsPrefix[0]).toContain(path.join('claude-code', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'))
    expect(commandResolution.bundledClaudePath).toContain(path.join('dev-tools-bundle', 'windows-x64', 'claude-code'))

    expect(gitResolution.source).toBe('bundled-runtime')
    expect(gitResolution.command).toContain(path.join('dev-tools-bundle', 'windows-x64', 'git', 'cmd', 'git.exe'))
    expect(gitResolution.gitBashPath).toContain(path.join('dev-tools-bundle', 'windows-x64', 'git', 'bin', 'bash.exe'))

    expect(env.PATH).toContain(path.join('dev-tools-bundle', 'windows-x64', 'claude-code'))
    expect(env.PATH).toContain(path.join('dev-tools-bundle', 'windows-x64', 'git', 'cmd'))
    expect(env.PATH).toContain(path.join('dev-tools-bundle', 'windows-x64', 'git', 'bin'))
    expect(env.CLAUDE_CODE_GIT_BASH_PATH).toContain(path.join('dev-tools-bundle', 'windows-x64', 'git', 'bin', 'bash.exe'))

    expect(offlineBundle.available).toBe(true)
    expect(offlineBundle.source).toBe('bundled-runtime')
    expect(offlineBundle.packageSpec).toContain(path.join('claude-code', 'node_modules', '@anthropic-ai', 'claude-code'))
  })

  it('wraps Windows cmd shims through hidden cmd execution for Claude Code spawns', () => {
    const resolved = resolveClaudeCodeSpawnCommand(
      'C:\\Users\\alice\\AppData\\Roaming\\npm\\claude.cmd',
      ['--print', 'hello world'],
      {
        platform: 'win32',
        env: {
          ...isolatedEnv,
          ComSpec: 'C:\\Windows\\System32\\cmd.exe',
        },
      }
    )

    expect(resolved.command).toBe('C:\\Windows\\System32\\cmd.exe')
    expect(resolved.shell).toBe(false)
    expect(resolved.args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    expect(resolved.args[3]).toContain('claude.cmd')
    expect(resolved.args[3]).toContain('"hello world"')
  })
})
