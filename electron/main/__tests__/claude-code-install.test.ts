import { afterEach, describe, expect, it, vi } from 'vitest'
import { installClaudeCode } from '../coding/claude-code-install'
import type { ClaudeCodeStatusSnapshot } from '../../../src/shared/coding-mode'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

const { mkdtemp, rm } = fs.promises
const tempDirs: string[] = []

async function createTempUserDataDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mclaw-claude-install-'))
  tempDirs.push(directory)
  return directory
}

function createStatus(overrides: Partial<ClaudeCodeStatusSnapshot> = {}): ClaudeCodeStatusSnapshot {
  return {
    platform: 'win32',
    command: 'claude.cmd',
    installed: true,
    version: '1.0.1',
    gitAvailable: true,
    authState: 'unknown',
    ready: true,
    setupState: 'ready',
    summary: 'Claude Code 已就绪',
    installGuide: {
      primaryInstallCommand: 'npm install -g @anthropic-ai/claude-code',
      alternativeInstallCommands: [],
      loginCommand: '',
      verifyCommands: ['claude --version', 'git --version'],
      docsUrl: 'https://code.claude.com/docs/en/quickstart',
      links: [],
      notes: [],
      supportsOneClickInstall: true,
      installModeLabel: 'Mclaw 一键安装（在线）',
      networkRequired: true,
      offlineBundleAvailable: false,
      bundledRuntimeAvailable: false,
    },
    modelProfiles: [],
    diagnostics: {},
    ...overrides,
  }
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop()
    if (!target) continue
    await rm(target, { recursive: true, force: true })
  }
})

describe('claude-code-install', () => {
  it('returns immediately when the bundled runtime is already ready', async () => {
    const userDataDir = await createTempUserDataDir()
    const getStatus = vi.fn().mockResolvedValue(
      createStatus({
        summary: 'Mclaw 内置开发运行时已就绪',
        installGuide: {
          ...createStatus().installGuide,
          installModeLabel: 'Mclaw 内置开发运行时',
          networkRequired: false,
          offlineBundleAvailable: true,
          bundledRuntimeAvailable: true,
        },
        diagnostics: {
          commandSource: 'bundled-runtime',
          gitSource: 'bundled-runtime',
        },
      })
    )

    const result = await installClaudeCode({
      platform: 'win32',
      userDataDir,
      runCommand: vi.fn(),
      getStatus,
      createCacheEnv: vi.fn(),
      cleanupCacheEnv: vi.fn(),
    })

    expect(result.ok).toBe(true)
    expect(result.ready).toBe(true)
    expect(result.strategy).toBe('bundled-runtime')
    expect(result.summary).toContain('内置开发运行时已就绪')
    expect(result.attempts[0]?.label).toBe('内置开发运行时')
  })

  it('falls back to the npm mirror when the first online source fails', async () => {
    const userDataDir = await createTempUserDataDir()
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        stdout: '',
        stderr: 'ETIMEDOUT registry.npmjs.org',
        code: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        stdout: 'added 1 package',
        stderr: '',
        code: 0,
      })
    const readyStatus = createStatus({
      diagnostics: {
        commandSource: 'managed-install',
        gitSource: 'system-path',
      },
    })
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(
        createStatus({
          installed: false,
          ready: false,
          setupState: 'install-required',
          summary: '需要初始化开发环境',
        })
      )
      .mockResolvedValueOnce(readyStatus)

    const result = await installClaudeCode({
      platform: 'win32',
      userDataDir,
      runCommand,
      getStatus,
      createCacheEnv: vi.fn().mockResolvedValue({
        cacheDir: path.join(userDataDir, 'cache'),
        env: {},
      }),
      cleanupCacheEnv: vi.fn().mockResolvedValue(undefined),
    })

    expect(result.ok).toBe(true)
    expect(result.ready).toBe(true)
    expect(result.attempts).toHaveLength(2)
    expect(result.attempts[0]?.label).toBe('npm 官方源')
    expect(result.attempts[1]?.label).toBe('npm 镜像源')
    expect(runCommand).toHaveBeenCalledTimes(2)
  })

  it('surfaces follow-up prerequisite work when install succeeded but readiness is still blocked', async () => {
    const userDataDir = await createTempUserDataDir()
    const blockedStatus: ClaudeCodeStatusSnapshot = createStatus({
      ready: false,
      gitAvailable: false,
      setupState: 'prerequisite-required',
      summary: '已检测到 Claude Code，但当前平台还缺少开发模式前置依赖。',
      diagnostics: {
        commandSource: 'managed-install',
        gitSource: 'missing',
      },
    })
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(
        createStatus({
          installed: false,
          ready: false,
          setupState: 'install-required',
          summary: '需要初始化开发环境',
        })
      )
      .mockResolvedValueOnce(blockedStatus)

    const result = await installClaudeCode({
      platform: 'win32',
      userDataDir,
      runCommand: vi.fn().mockResolvedValue({
        ok: true,
        stdout: 'added 1 package',
        stderr: '',
        code: 0,
      }),
      getStatus,
      createCacheEnv: vi.fn().mockResolvedValue({
        cacheDir: path.join(userDataDir, 'cache'),
        env: {},
      }),
      cleanupCacheEnv: vi.fn().mockResolvedValue(undefined),
    })

    expect(result.ok).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.summary).toContain('前置依赖')
  })

  it('returns a clear message when npm is unavailable for one-click install', async () => {
    const userDataDir = await createTempUserDataDir()
    const getStatus = vi.fn().mockResolvedValue(
      createStatus({
        installed: false,
        ready: false,
        setupState: 'install-required',
        summary: '需要初始化开发环境',
      })
    )

    const result = await installClaudeCode({
      platform: 'win32',
      userDataDir,
      runCommand: vi.fn().mockResolvedValue({
        ok: false,
        stdout: '',
        stderr: "'npm.cmd' is not recognized as an internal or external command",
        code: 1,
      }),
      getStatus,
      createCacheEnv: vi.fn().mockResolvedValue({
        cacheDir: path.join(userDataDir, 'cache'),
        env: {},
      }),
      cleanupCacheEnv: vi.fn().mockResolvedValue(undefined),
    })

    expect(result.ok).toBe(false)
    expect(result.installed).toBe(false)
    expect(result.summary).toContain('Node / npm')
  })
})
