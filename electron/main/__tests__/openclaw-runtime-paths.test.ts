import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetRuntimeOpenClawPathsCache, resolveRuntimeOpenClawPaths } from '../openclaw-runtime-paths'
import { buildTestEnv } from './test-env'
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

describe('resolveRuntimeOpenClawPaths', () => {
  afterEach(() => {
    resetRuntimeOpenClawPathsCache()
  })

  it('prefers CLI-reported config and state paths over the default ~/.openclaw layout', async () => {
    const runCommand = async (_binaryPath: string, args: string[]) => {
      if (args.join(' ') === 'config file') {
        return {
          ok: true,
          stdout: '~/Library/Application Support/OpenClaw/profiles/main/openclaw.json\n',
          stderr: '',
          code: 0,
        }
      }

      if (args.join(' ') === 'backup create --dry-run --json') {
        return {
          ok: true,
          stdout: JSON.stringify({
            assets: [
              {
                kind: 'state',
                sourcePath: '/Users/alice/Library/Application Support/OpenClaw/profiles/main',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }

      throw new Error(`Unexpected args: ${args.join(' ')}`)
    }

    const paths = await resolveRuntimeOpenClawPaths({
      binaryPath: '/usr/local/bin/openclaw',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
      }),
      cacheTtlMs: 0,
      runCommand,
    })

    expect(paths).toEqual({
      homeDir: '/Users/alice/Library/Application Support/OpenClaw/profiles/main',
      configFile: '/Users/alice/Library/Application Support/OpenClaw/profiles/main/openclaw.json',
      envFile: '/Users/alice/Library/Application Support/OpenClaw/profiles/main/.env',
      credentialsDir: '/Users/alice/Library/Application Support/OpenClaw/profiles/main/credentials',
      modelCatalogCacheFile:
        '/Users/alice/Library/Application Support/OpenClaw/profiles/main/qclaw-model-catalog-cache.json',
      displayHomeDir: '~/Library/Application Support/OpenClaw/profiles/main',
      displayConfigFile: '~/Library/Application Support/OpenClaw/profiles/main/openclaw.json',
      displayEnvFile: '~/Library/Application Support/OpenClaw/profiles/main/.env',
      displayCredentialsDir: '~/Library/Application Support/OpenClaw/profiles/main/credentials',
      displayModelCatalogCacheFile:
        '~/Library/Application Support/OpenClaw/profiles/main/qclaw-model-catalog-cache.json',
    })
  })

  it('ignores doctor noise before the reported config path', async () => {
    const runCommand = async (_binaryPath: string, args: string[]) => {
      if (args.join(' ') === 'config file') {
        return {
          ok: true,
          stdout: [
            '│',
            '◇  Doctor changes ────────────────────────────╮',
            '│                                             │',
            '│  feishu configured, enabled automatically.  │',
            '│                                             │',
            '├─────────────────────────────────────────────╯',
            '~/.openclaw/openclaw.json',
            '',
          ].join('\n'),
          stderr: '',
          code: 0,
        }
      }

      if (args.join(' ') === 'backup create --dry-run --json') {
        return {
          ok: true,
          stdout: JSON.stringify({
            assets: [
              {
                kind: 'state',
                sourcePath: '/Users/alice/.openclaw',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }

      throw new Error(`Unexpected args: ${args.join(' ')}`)
    }

    const paths = await resolveRuntimeOpenClawPaths({
      binaryPath: '/usr/local/bin/openclaw',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
      }),
      cacheTtlMs: 0,
      runCommand,
    })

    expect(paths.homeDir).toBe('/Users/alice/.openclaw')
    expect(paths.configFile).toBe('/Users/alice/.openclaw/openclaw.json')
    expect(paths.displayConfigFile).toBe('~/.openclaw/openclaw.json')
  })

  it('falls back to default paths when runtime probing fails', async () => {
    const paths = await resolveRuntimeOpenClawPaths({
      binaryPath: '/usr/local/bin/openclaw',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
        QCLAW_USER_DATA_DIR: '/Users/alice/Library/Application Support/Mclaw',
      }),
      cacheTtlMs: 0,
      runCommand: async () => ({
        ok: false,
        stdout: '',
        stderr: 'command failed',
        code: 1,
      }),
    })

    expect(paths.homeDir).toBe('/Users/alice/Library/Application Support/Mclaw/openclaw-state')
    expect(paths.configFile).toBe('/Users/alice/Library/Application Support/Mclaw/openclaw-state/openclaw.json')
  })

  it('ignores runtime-reported paths outside the managed userData root when managed mode is active', async () => {
    const managedUserDataDir = '/Users/alice/Library/Application Support/Mclaw'
    const paths = await resolveRuntimeOpenClawPaths({
      binaryPath: '/usr/local/bin/openclaw',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
        QCLAW_USER_DATA_DIR: managedUserDataDir,
      }),
      cacheTtlMs: 0,
      runCommand: async (_binaryPath: string, args: string[]) => {
        if (args.join(' ') === 'config file') {
          return {
            ok: true,
            stdout: '/Users/alice/.openclaw/openclaw.json\n',
            stderr: '',
            code: 0,
          }
        }
        if (args.join(' ') === 'backup create --dry-run --json') {
          return {
            ok: true,
            stdout: JSON.stringify({
              assets: [
                {
                  kind: 'state',
                  sourcePath: '/Users/alice/.openclaw',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }
        throw new Error(`Unexpected args: ${args.join(' ')}`)
      },
    })

    expect(paths.homeDir).toBe('/Users/alice/Library/Application Support/Mclaw/openclaw-state')
    expect(paths.configFile).toBe('/Users/alice/Library/Application Support/Mclaw/openclaw-state/openclaw.json')
  })

  it('normalizes duplicated .openclaw state roots and prefers the state-root config when available', async () => {
    const managedUserDataDir = '/Users/alice/Library/Application Support/Mclaw'
    const managedStateRoot = '/Users/alice/Library/Application Support/Mclaw/openclaw-state'
    const normalizedStateRoot = path.posix.join(managedStateRoot, '.openclaw')
    const duplicatedStateRoot = path.posix.join(normalizedStateRoot, '.openclaw')
    const stateRootConfigPath = path.posix.join(normalizedStateRoot, 'openclaw.json')

    const paths = await resolveRuntimeOpenClawPaths({
      binaryPath: '/usr/local/bin/openclaw',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
        QCLAW_USER_DATA_DIR: managedUserDataDir,
      }),
      cacheTtlMs: 0,
      pathExists: async (targetPath: string) => {
        return targetPath === stateRootConfigPath
      },
      runCommand: async (_binaryPath: string, args: string[]) => {
        if (args.join(' ') === 'config file') {
          return {
            ok: true,
            stdout: `${managedStateRoot}/openclaw.json\n`,
            stderr: '',
            code: 0,
          }
        }
        if (args.join(' ') === 'backup create --dry-run --json') {
          return {
            ok: true,
            stdout: JSON.stringify({
              assets: [
                {
                  kind: 'state',
                  sourcePath: duplicatedStateRoot,
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }
        throw new Error(`Unexpected args: ${args.join(' ')}`)
      },
    })

    expect(paths.homeDir).toBe(normalizedStateRoot)
    expect(paths.configFile).toBe(stateRootConfigPath)
  })


  it('reuses one in-flight probe for concurrent callers', async () => {
    let releaseProbe: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      releaseProbe = resolve
    })
    const runCommand = vi.fn(async (_binaryPath: string, args: string[]) => {
      await gate
      if (args.join(' ') === 'config file') {
        return {
          ok: true,
          stdout: '/Users/alice/.openclaw/openclaw.json\n',
          stderr: '',
          code: 0,
        }
      }
      if (args.join(' ') === 'backup create --dry-run --json') {
        return {
          ok: true,
          stdout: JSON.stringify({
            assets: [
              {
                kind: 'state',
                sourcePath: '/Users/alice/.openclaw',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }
      throw new Error(`Unexpected args: ${args.join(' ')}`)
    })

    const first = resolveRuntimeOpenClawPaths({
      binaryPath: '/usr/local/bin/openclaw',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
      }),
      runCommand,
    })
    const second = resolveRuntimeOpenClawPaths({
      binaryPath: '/usr/local/bin/openclaw',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
      }),
      runCommand,
    })

    releaseProbe?.()

    const [firstPaths, secondPaths] = await Promise.all([first, second])
    expect(firstPaths).toEqual(secondPaths)
    expect(runCommand).toHaveBeenCalledTimes(2)
  })

  it('reuses the cached runtime paths within the ttl window', async () => {
    const runCommand = vi.fn(async (_binaryPath: string, args: string[]) => {
      if (args.join(' ') === 'config file') {
        return {
          ok: true,
          stdout: '/Users/alice/.openclaw/openclaw.json\n',
          stderr: '',
          code: 0,
        }
      }
      if (args.join(' ') === 'backup create --dry-run --json') {
        return {
          ok: true,
          stdout: JSON.stringify({
            assets: [
              {
                kind: 'state',
                sourcePath: '/Users/alice/.openclaw',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }
      throw new Error(`Unexpected args: ${args.join(' ')}`)
    })

    const first = await resolveRuntimeOpenClawPaths({
      binaryPath: '/usr/local/bin/openclaw',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
      }),
      cacheTtlMs: 15_000,
      runCommand,
    })
    const second = await resolveRuntimeOpenClawPaths({
      binaryPath: '/usr/local/bin/openclaw',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
      }),
      cacheTtlMs: 15_000,
      runCommand,
    })

    expect(first).toEqual(second)
    expect(runCommand).toHaveBeenCalledTimes(2)
  })
})
