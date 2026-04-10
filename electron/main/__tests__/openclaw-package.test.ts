import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import * as openClawPackage from '../openclaw-package'
import {
  getCommandPathLookupInvocation,
  readOpenClawPackageInfo,
  resolveOpenClawBinaryPath,
  resolveOpenClawPackageRoot,
} from '../openclaw-package'
import { buildTestEnv } from './test-env'

const { inspectBundledOpenClawDeliveryStatusMock } = vi.hoisted(() => ({
  inspectBundledOpenClawDeliveryStatusMock: vi.fn(),
}))

vi.mock('../openclaw-bundled-manifest', () => ({
  inspectBundledOpenClawDeliveryStatus: inspectBundledOpenClawDeliveryStatusMock,
}))

const fs = process.getBuiltinModule('fs') as typeof import('node:fs')
const os = process.getBuiltinModule('os') as typeof import('node:os')
const path = process.getBuiltinModule('path') as typeof import('node:path')

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qclaw-openclaw-package-'))
  tempDirs.push(dir)
  return dir
}

const IS_WINDOWS = process.platform === 'win32'

function createFakeOpenClawInstall(): {
  tempDir: string
  commandPath: string
  packageRoot: string
  packageJsonPath: string
} {
  const tempDir = makeTempDir()
  const packageRoot = path.join(tempDir, 'lib', 'node_modules', 'openclaw')
  const binDir = path.join(tempDir, 'bin')
  fs.mkdirSync(packageRoot, { recursive: true })
  fs.mkdirSync(binDir, { recursive: true })

  const packageJsonPath = path.join(packageRoot, 'package.json')
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        name: 'openclaw',
        version: '2026.3.8',
        bin: { openclaw: 'openclaw.mjs' },
      },
      null,
      2
    )
  )
  const mjsTarget = path.join(packageRoot, 'openclaw.mjs')
  fs.writeFileSync(mjsTarget, '#!/usr/bin/env node\nconsole.log("openclaw")\n')

  let commandPath: string
  if (IS_WINDOWS) {
    // On Windows, npm creates a .cmd shim; resolve will follow the real path
    commandPath = path.join(binDir, 'openclaw.cmd')
    fs.writeFileSync(commandPath, `@node "${mjsTarget}" %*\r\n`)
  } else {
    commandPath = path.join(binDir, 'openclaw')
    fs.symlinkSync(mjsTarget, commandPath)
  }

  return { tempDir, commandPath, packageRoot, packageJsonPath }
}

function createNestedBinaryOpenClawInstall(): {
  tempDir: string
  commandPath: string
  packageRoot: string
  packageJsonPath: string
} {
  const tempDir = makeTempDir()
  const packageRoot = path.join(tempDir, 'lib', 'node_modules', 'openclaw')
  const nestedBinDir = path.join(packageRoot, 'bin')
  const shimDir = path.join(tempDir, 'bin')
  fs.mkdirSync(packageRoot, { recursive: true })
  fs.mkdirSync(nestedBinDir, { recursive: true })
  fs.mkdirSync(shimDir, { recursive: true })

  const packageJsonPath = path.join(packageRoot, 'package.json')
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        name: 'openclaw',
        version: '2026.3.8',
        bin: { openclaw: 'bin/openclaw.mjs' },
      },
      null,
      2
    )
  )
  const mjsTarget = path.join(nestedBinDir, 'openclaw.mjs')
  fs.writeFileSync(mjsTarget, '#!/usr/bin/env node\nconsole.log("openclaw")\n')

  let commandPath: string
  if (IS_WINDOWS) {
    commandPath = path.join(shimDir, 'openclaw.cmd')
    fs.writeFileSync(commandPath, `@node "${mjsTarget}" %*\r\n`)
  } else {
    commandPath = path.join(shimDir, 'openclaw')
    fs.symlinkSync(mjsTarget, commandPath)
  }

  return { tempDir, commandPath, packageRoot, packageJsonPath }
}

function createWindowsNpmShimOpenClawInstall(): {
  tempDir: string
  commandPath: string
  packageRoot: string
  packageJsonPath: string
} {
  const tempDir = makeTempDir()
  const packageRoot = path.join(tempDir, 'node_modules', 'openclaw')
  fs.mkdirSync(packageRoot, { recursive: true })

  const packageJsonPath = path.join(packageRoot, 'package.json')
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        name: 'openclaw',
        version: '2026.3.24',
        bin: { openclaw: 'bin/openclaw.mjs' },
      },
      null,
      2
    )
  )

  const binDir = path.join(packageRoot, 'bin')
  fs.mkdirSync(binDir, { recursive: true })
  const mjsTarget = path.join(binDir, 'openclaw.mjs')
  fs.writeFileSync(mjsTarget, '#!/usr/bin/env node\nconsole.log("openclaw")\n')

  const commandPath = path.join(tempDir, 'openclaw.cmd')
  fs.writeFileSync(commandPath, `@node "${mjsTarget}" %*\r\n`)

  return { tempDir, commandPath, packageRoot, packageJsonPath }
}

afterEach(() => {
  inspectBundledOpenClawDeliveryStatusMock.mockReset()
  inspectBundledOpenClawDeliveryStatusMock.mockReturnValue({
    manifestPath: null,
    manifest: null,
    platform: process.platform,
    arch: process.arch,
    defaultDeliveryMode: null,
    targetDeliveryMode: null,
    runtimeArtifact: null,
    runtimePath: null,
    runtimeBinaryPath: null,
  })
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  }
})

beforeEach(() => {
  inspectBundledOpenClawDeliveryStatusMock.mockReturnValue({
    manifestPath: null,
    manifest: null,
    platform: process.platform,
    arch: process.arch,
    defaultDeliveryMode: null,
    targetDeliveryMode: null,
    runtimeArtifact: null,
    runtimePath: null,
    runtimeBinaryPath: null,
  })
})

describe('resolveOpenClawBinaryPath', () => {
  it('resolves the binary path via command lookup', async () => {
    const install = createFakeOpenClawInstall()

    const resolved = await resolveOpenClawBinaryPath({
      commandPathResolver: async (commandName) => {
        expect(commandName).toBe('openclaw')
        return install.commandPath
      },
    })

    expect(resolved).toBe(install.commandPath)
  })

  it('falls back to the Windows APPDATA npm shim when where.exe lookup fails', async () => {
    const fallbackBinary = 'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.cmd'

    const resolved = await resolveOpenClawBinaryPath({
      commandPathResolver: async () => {
        throw new Error('INFO: Could not find files for the given pattern(s).')
      },
      platform: 'win32',
      env: buildTestEnv({
        APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
      }),
      fileExists: (candidate: string) => candidate === fallbackBinary,
    })

    expect(resolved).toBe(fallbackBinary)
  })

  it('returns an actionable message when command lookup cannot find openclaw', async () => {
    await expect(
      resolveOpenClawBinaryPath({
        commandPathResolver: async () => {
          throw new Error('INFO: Could not find files for the given pattern(s).')
        },
        platform: 'win32',
        env: buildTestEnv(),
        fileExists: () => false,
      })
    ).rejects.toThrow(/Unable to locate the openclaw command/i)
  })

  it('falls back to the bundled runtime binary when PATH lookup misses', async () => {
    inspectBundledOpenClawDeliveryStatusMock.mockReturnValue({
      manifestPath: 'D:\\bundle\\manifest.json',
      manifest: {} as any,
      platform: 'win32',
      arch: 'x64',
      defaultDeliveryMode: 'bundled-runtime',
      targetDeliveryMode: 'bundled-runtime',
      runtimeArtifact: {} as any,
      runtimePath: 'D:\\bundle\\runtime\\windows-x64',
      runtimeBinaryPath: 'D:\\bundle\\runtime\\windows-x64\\openclaw.cmd',
    })

    const resolved = await resolveOpenClawBinaryPath({
      commandPathResolver: async () => {
        throw new Error('INFO: Could not find files for the given pattern(s).')
      },
      platform: 'win32',
      env: buildTestEnv(),
      fileExists: () => false,
    })

    expect(resolved).toBe('D:\\bundle\\runtime\\windows-x64\\openclaw.cmd')
  })

  it('prefers npm prefix bins before static fallback directories when command lookup misses', async () => {
    const resolved = await resolveOpenClawBinaryPath({
      commandPathResolver: async () => {
        throw new Error('openclaw: command not found')
      },
      npmPrefixResolver: async () => '/Users/alice/.volta/tools/image',
      platform: 'darwin',
      env: buildTestEnv({
        HOME: '/Users/alice',
      }),
      fileExists: (candidate: string) => candidate === '/Users/alice/.volta/tools/image/bin/openclaw',
    })

    expect(resolved).toBe('/Users/alice/.volta/tools/image/bin/openclaw')
  })

  it('derives a deterministic openclaw binary path directly from an npm global prefix', async () => {
    const install = createFakeOpenClawInstall()

    // On Windows the shim is a .cmd file; on POSIX it's a bare binary in bin/.
    // We test with the actual platform so the candidate list matches our fixture.
    const resolved = await (openClawPackage as any).resolveOpenClawBinaryPathFromNpmPrefix({
      npmPrefix: install.tempDir,
      platform: process.platform,
      env: buildTestEnv({ HOME: os.homedir() }),
      // The fixture commandPath is the real file; we accept both on Windows due to layout differences
      fileExists: (candidate: string) => {
        if (IS_WINDOWS) {
          // npm global on Windows puts shims directly at <prefix>/openclaw.cmd — match that
          return candidate === path.join(install.tempDir, 'openclaw.cmd')
        }
        return candidate === install.commandPath
      },
    })

    const expectedPath = IS_WINDOWS
      ? path.join(install.tempDir, 'openclaw.cmd')
      : install.commandPath
    expect(resolved).toBe(expectedPath)
  })
})

describe('getCommandPathLookupInvocation', () => {
  it('uses where.exe on Windows instead of /bin/sh', () => {
    const invocation = getCommandPathLookupInvocation('openclaw', 'win32')
    expect(invocation).toEqual({
      command: 'where.exe',
      args: ['openclaw'],
      shell: false,
    })
  })

  it('uses POSIX shell command lookup on non-Windows platforms', () => {
    const invocation = getCommandPathLookupInvocation('openclaw', {
      platform: 'darwin',
      env: buildTestEnv({ SHELL: '/bin/zsh' }),
    })
    expect(invocation.command).toBe('/bin/zsh')
    expect(invocation.args[0]).toBe('-lc')
    expect(invocation.args[1]).toContain('command -v')
    expect(invocation.shell).toBe(false)
  })
})

describe('resolveOpenClawPackageRoot', () => {
  it('resolves the package root from the actual openclaw binary path', async () => {
    const install = createFakeOpenClawInstall()
    // On Windows .cmd shims don't follow into the module tree via realpath,
    // so pass the .mjs source directly to exercise the package-root walk logic.
    const probePath = IS_WINDOWS
      ? path.join(install.packageRoot, 'openclaw.mjs')
      : install.commandPath

    const packageRoot = await resolveOpenClawPackageRoot({
      binaryPath: probePath,
    })

    expect(packageRoot).toBe(fs.realpathSync(install.packageRoot))
  })

  it('walks parent directories when the resolved binary lives under a package bin subdirectory', async () => {
    const install = createNestedBinaryOpenClawInstall()
    const probePath = IS_WINDOWS
      ? path.join(install.packageRoot, 'bin', 'openclaw.mjs')
      : install.commandPath

    const packageRoot = await resolveOpenClawPackageRoot({
      binaryPath: probePath,
    })

    expect(packageRoot).toBe(fs.realpathSync(install.packageRoot))
  })

  it('resolves the package root from a Windows npm global shim layout', async () => {
    if (!IS_WINDOWS) return

    const install = createWindowsNpmShimOpenClawInstall()
    const packageRoot = await resolveOpenClawPackageRoot({
      binaryPath: install.commandPath,
    })

    expect(packageRoot).toBe(fs.realpathSync(install.packageRoot))
  })

  it('rejects malformed layouts that do not contain an adjacent openclaw package.json', async () => {
    const tempDir = makeTempDir()
    const fakeBinary = path.join(tempDir, 'openclaw')
    fs.writeFileSync(fakeBinary, '#!/usr/bin/env node\n')

    await expect(
      resolveOpenClawPackageRoot({
        binaryPath: fakeBinary,
      })
    ).rejects.toThrow(/package\.json/i)
  })
})

describe('readOpenClawPackageInfo', () => {
  it('reads version information from the resolved package.json', async () => {
    const install = createFakeOpenClawInstall()
    // On Windows, pass the .mjs file directly — the .cmd shim has no realpath traversal
    // into the module tree, and the package-root walk logic is what we're actually testing.
    const probePath = IS_WINDOWS
      ? path.join(install.packageRoot, 'openclaw.mjs')
      : install.commandPath

    const info = await readOpenClawPackageInfo({
      binaryPath: probePath,
    })

    const resolvedPackageRoot = fs.realpathSync(install.packageRoot)
    const resolvedPackageJsonPath = fs.realpathSync(install.packageJsonPath)
    const expectedResolvedBinaryPath = IS_WINDOWS
      ? fs.realpathSync(path.join(install.packageRoot, 'openclaw.mjs'))
      : path.join(resolvedPackageRoot, 'openclaw.mjs')

    expect(info).toMatchObject({
      name: 'openclaw',
      version: '2026.3.8',
      packageRoot: resolvedPackageRoot,
      packageJsonPath: resolvedPackageJsonPath,
      binaryPath: probePath,
      resolvedBinaryPath: expectedResolvedBinaryPath,
    })
  })
})
