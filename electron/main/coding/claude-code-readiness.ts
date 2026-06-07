import type {
  ClaudeCodeAuthState,
  ClaudeCodeInstallGuide,
  ClaudeCodeStatusSnapshot,
} from '../../../src/shared/coding-mode'
import { CODING_MODEL_PROFILE_OPTIONS } from '../../../src/shared/coding-mode'
import {
  buildClaudeCodeCommandEnv,
  inspectBundledClaudeCodeRuntime,
  inspectBundledGitRuntime,
  inspectClaudeCodeOfflineBundle,
  resolveClaudeCodeCommand,
  resolveClaudeCodeGitCommand,
  resolveClaudeCodeManagedBinDir,
  resolveClaudeCodeManagedPrefix,
  resolveClaudeCodeSpawnCommand,
} from './claude-code-runtime'

const childProcess = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')

const CLAUDE_CODE_IGNORED_STDERR_PATTERNS = [
  /^warning:\s*no stdin data received in \d+s, proceeding without it\./i,
  /^if piping from a slow command, redirect stdin explicitly:/i,
]

interface CommandRunResult {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
  error?: string
}

interface AuthStatusPayload {
  loggedIn?: boolean
  authenticated?: boolean
  authMethod?: string
  apiProvider?: string
  apiKeySource?: string
  [key: string]: unknown
}

export interface ClaudeCodeStatusOptions {
  platform?: NodeJS.Platform
  arch?: string
  env?: NodeJS.ProcessEnv
  userDataDir?: string
  resourcesPath?: string
  cwd?: string
  runCommand?: (command: string, args: string[], params: { env: NodeJS.ProcessEnv }) => Promise<CommandRunResult>
}

function inspectBundledRuntimeAvailability(
  options: Pick<ClaudeCodeStatusOptions, 'platform' | 'arch' | 'env' | 'userDataDir' | 'resourcesPath' | 'cwd'>
): {
  bundledClaudeAvailable: boolean
  bundledGitAvailable: boolean
  bundledRuntimeAvailable: boolean
} {
  const bundledClaudeRuntime = inspectBundledClaudeCodeRuntime({
    platform: options.platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const bundledGitRuntime = inspectBundledGitRuntime({
    platform: options.platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })

  const platform = options.platform || process.platform
  return {
    bundledClaudeAvailable: bundledClaudeRuntime.available,
    bundledGitAvailable: bundledGitRuntime.available,
    bundledRuntimeAvailable:
      bundledClaudeRuntime.available && (platform !== 'win32' || bundledGitRuntime.available),
  }
}

function buildClaudeCodeInstallGuide(
  platform: NodeJS.Platform,
  options: Pick<ClaudeCodeStatusOptions, 'arch' | 'env' | 'userDataDir' | 'resourcesPath' | 'cwd'>
): ClaudeCodeInstallGuide {
  const docsUrl = 'https://code.claude.com/docs/en/quickstart'
  const offlineBundleStatus = inspectClaudeCodeOfflineBundle({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const bundledAvailability = inspectBundledRuntimeAvailability({
    platform,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const installModeLabel = bundledAvailability.bundledRuntimeAvailable
    ? 'Mclaw 内置开发运行时'
    : offlineBundleStatus.available
      ? 'Mclaw 内置离线安装'
      : 'Mclaw 一键安装（在线）'

  const sharedNotes = bundledAvailability.bundledRuntimeAvailable
    ? [
        '当前 Windows 构建已内置 Claude Code 与 Git for Windows 运行时，正常情况下不需要用户手动安装。',
        '只有你主动进入开发模式并处理本地项目任务时，Mclaw 才会检查或初始化这套运行时；普通聊天不受影响。',
        '后续开发模型服务会通过 Mclaw 中台统一接入；当前阶段先把本地开发执行链路与基础引导打通。',
      ]
    : [
        offlineBundleStatus.available
          ? '当前构建已内置 Claude Code 离线包，点击“初始化开发环境”会优先把 CLI 准备到 Mclaw 的应用管理目录。'
          : '当前构建暂未内置完整开发运行时；点击“初始化开发环境”后，Mclaw 会优先尝试应用内离线包，再按需回退到 npm 官方源与镜像源。',
        '普通聊天不需要 Claude Code；只有你主动进入开发模式时，Mclaw 才会检查或安装它。',
        'Mclaw 当前基础版只要求本机具备 Claude Code 执行能力；后续模型接入会统一走 Mclaw 中台。',
      ]

  if (platform === 'win32') {
    return {
      primaryInstallCommand: bundledAvailability.bundledRuntimeAvailable ? '' : 'npm install -g @anthropic-ai/claude-code',
      alternativeInstallCommands: bundledAvailability.bundledRuntimeAvailable
        ? []
        : [
            'irm https://claude.ai/install.ps1 | iex',
            'winget install Anthropic.ClaudeCode',
          ],
      loginCommand: '',
      verifyCommands: ['claude --version', 'git --version'],
      docsUrl,
      links: [
        { label: 'Claude Code 快速开始', url: docsUrl },
      ],
      notes: sharedNotes,
      supportsOneClickInstall: true,
      installModeLabel,
      networkRequired: !(bundledAvailability.bundledRuntimeAvailable || offlineBundleStatus.available),
      offlineBundleAvailable: offlineBundleStatus.available,
      bundledRuntimeAvailable: bundledAvailability.bundledRuntimeAvailable,
    }
  }

  if (platform === 'darwin') {
    return {
      primaryInstallCommand: 'brew install --cask claude-code',
      alternativeInstallCommands: [
        'curl -fsSL https://claude.ai/install.sh | bash',
        'npm install -g @anthropic-ai/claude-code',
      ],
      loginCommand: '',
      verifyCommands: ['claude --version'],
      docsUrl,
      links: [
        { label: 'Claude Code 快速开始', url: docsUrl },
        { label: 'Homebrew', url: 'https://brew.sh/' },
      ],
      notes: [
        ...sharedNotes,
        'macOS 的内置开发运行时会在后续单独接入；当前先保留 Claude Code 兼容说明。',
      ],
      supportsOneClickInstall: true,
      installModeLabel,
      networkRequired: !offlineBundleStatus.available,
      offlineBundleAvailable: offlineBundleStatus.available,
      bundledRuntimeAvailable: bundledAvailability.bundledRuntimeAvailable,
    }
  }

  return {
    primaryInstallCommand: 'npm install -g @anthropic-ai/claude-code',
    alternativeInstallCommands: [
      'curl -fsSL https://claude.ai/install.sh | bash',
    ],
    loginCommand: '',
    verifyCommands: ['claude --version'],
    docsUrl,
    links: [
      { label: 'Claude Code 快速开始', url: docsUrl },
    ],
    notes: [
      ...sharedNotes,
      'Linux / WSL 当前仍以外部安装为主，后续再补内置运行时。',
    ],
    supportsOneClickInstall: true,
    installModeLabel,
    networkRequired: !offlineBundleStatus.available,
    offlineBundleAvailable: offlineBundleStatus.available,
    bundledRuntimeAvailable: bundledAvailability.bundledRuntimeAvailable,
  }
}

function buildDefaultEnv(options: ClaudeCodeStatusOptions = {}): NodeJS.ProcessEnv {
  return buildClaudeCodeCommandEnv({
    platform: options.platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
}

async function defaultRunCommand(
  command: string,
  args: string[],
  params: { env: NodeJS.ProcessEnv }
): Promise<CommandRunResult> {
  return new Promise((resolve) => {
    let completed = false
    let stdout = ''
    let stderr = ''

    const finish = (result: CommandRunResult) => {
      if (completed) return
      completed = true
      resolve(result)
    }

    let proc: import('node:child_process').ChildProcess | null = null
    try {
      const spawnCommand = resolveClaudeCodeSpawnCommand(command, args, {
        platform: process.platform,
        env: params.env,
      })
      proc = childProcess.spawn(spawnCommand.command, spawnCommand.args, {
        env: params.env,
        shell: spawnCommand.shell,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (error) {
      finish({
        ok: false,
        stdout: '',
        stderr: '',
        code: null,
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }

    proc.stdout?.on('data', (chunk) => {
      stdout = `${stdout}${chunk.toString()}`
    })

    proc.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString()}`
    })

    proc.on('error', (error) => {
      finish({
        ok: false,
        stdout,
        stderr,
        code: null,
        error: error.message,
      })
    })

    proc.on('close', (code) => {
      const normalizedStderr = stderr
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !CLAUDE_CODE_IGNORED_STDERR_PATTERNS.some((pattern) => pattern.test(line)))
        .join('\n')
        .trim()
      finish({
        ok: code === 0,
        stdout: stdout.trim(),
        stderr: normalizedStderr,
        code,
      })
    })
  })
}

function extractCommandNotFoundError(result: CommandRunResult): boolean {
  const combined = `${result.error || ''}\n${result.stderr}\n${result.stdout}`.toLowerCase()
  return /not found|not recognized|enoent|cannot find|is not recognized|无法将.*识别/.test(combined)
}

function extractVersion(stdout: string): string | undefined {
  const normalized = String(stdout || '').trim()
  const match = /(\d+\.\d+\.\d+)/.exec(normalized)
  return match?.[1] || normalized || undefined
}

function parseAuthState(result: CommandRunResult): {
  state: ClaudeCodeAuthState
  payload: AuthStatusPayload | null
} {
  const stdout = String(result.stdout || '').trim()
  const stderr = String(result.stderr || '').trim()
  const combined = `${stdout}\n${stderr}`.toLowerCase()

  try {
    const payload = JSON.parse(stdout) as AuthStatusPayload
    if (typeof payload.loggedIn === 'boolean') {
      return {
        state: payload.loggedIn ? 'authenticated' : 'unauthenticated',
        payload,
      }
    }
    if (typeof payload.authenticated === 'boolean') {
      return {
        state: payload.authenticated ? 'authenticated' : 'unauthenticated',
        payload,
      }
    }
    return {
      state: payload.authMethod || payload.apiProvider ? 'authenticated' : 'unknown',
      payload,
    }
  } catch {
    if (/logged\s*in|authenticated|oauth/.test(combined)) {
      return {
        state: 'authenticated',
        payload: null,
      }
    }
    if (/not\s+logged\s*in|login required|sign in|unauthenticated/.test(combined)) {
      return {
        state: 'unauthenticated',
        payload: null,
      }
    }
    return {
      state: 'unknown',
      payload: null,
    }
  }
}

function buildSummary(params: {
  installed: boolean
  authState: ClaudeCodeAuthState
  setupState: ClaudeCodeStatusSnapshot['setupState']
  version?: string
  apiKeySource?: string
  commandSource: 'bundled-runtime' | 'managed-install' | 'system-path'
  bundledRuntimeAvailable: boolean
}): string {
  if (!params.installed) {
    return params.bundledRuntimeAvailable
      ? '当前没有检测到完整的 Mclaw 内置开发运行时。你可以先点击“初始化开发环境”；如果仍失败，建议重新安装当前 Windows 验收包。'
      : '开发模式需要先准备 Claude Code。你可以直接点面板里的“初始化开发环境”；普通聊天不受影响。'
  }

  if (params.setupState === 'prerequisite-required') {
    return params.commandSource === 'bundled-runtime' || params.bundledRuntimeAvailable
      ? '已检测到 Mclaw 内置开发运行时，但当前 Git 前置能力仍不可用；请先尝试“修复开发环境”，若仍失败请重新安装当前 Windows 包。'
      : '已检测到 Claude Code，但当前平台还缺少开发模式前置依赖；请先按面板提示补齐后再发送开发任务。'
  }

  if (params.setupState === 'check-failed') {
    return params.commandSource === 'bundled-runtime' || params.bundledRuntimeAvailable
      ? 'Mclaw 内置开发运行时检查失败。请先刷新环境检查；如果仍失败，建议重新安装当前 Windows 包。'
      : 'Claude Code 已安装，但当前状态检查失败。请先刷新环境检查，必要时重新执行初始化。'
  }

  const versionText = params.version ? `（${params.version}）` : ''
  const apiSourceText = params.apiKeySource ? ` 当前可见认证来源：${params.apiKeySource}。` : ''
  const authText =
    params.authState === 'authenticated'
      ? '已检测到本机可用认证状态。'
      : params.authState === 'unauthenticated'
        ? '当前基础版不要求在 Mclaw 内单独登录；后续由 Mclaw 中台统一接入模型服务。'
        : '认证状态暂未确认，当前先按可执行链路展示。'

  if (params.commandSource === 'bundled-runtime') {
    return `Mclaw 内置开发运行时已就绪${versionText}，可以直接用于开发模式。${authText}${apiSourceText}`
  }

  return `Claude Code 已就绪${versionText}，可以作为 Mclaw 开发模式的本地执行器。${authText}${apiSourceText}`
}

export async function getClaudeCodeStatus(
  options: ClaudeCodeStatusOptions = {}
): Promise<ClaudeCodeStatusSnapshot> {
  const platform = options.platform ?? process.platform
  const env = buildDefaultEnv(options)
  const runCommand = options.runCommand ?? defaultRunCommand
  const installGuide = buildClaudeCodeInstallGuide(platform, options)
  const offlineBundleStatus = inspectClaudeCodeOfflineBundle({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const managedInstallPath = resolveClaudeCodeManagedPrefix({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const managedBinDir = resolveClaudeCodeManagedBinDir({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const commandResolution = resolveClaudeCodeCommand({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const gitResolution = resolveClaudeCodeGitCommand({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })

  const diagnostics: ClaudeCodeStatusSnapshot['diagnostics'] = {
    managedInstallPath,
    managedBinDir,
    offlineBundlePath: offlineBundleStatus.bundlePath || undefined,
    bundledClaudePath: commandResolution.bundledClaudePath,
    bundledGitPath: gitResolution.gitPath,
    bundledGitBashPath: gitResolution.gitBashPath,
    commandSource: commandResolution.source,
    gitSource: gitResolution.source,
  }

  const command = commandResolution.displayCommand
  const versionResult = await runCommand(
    commandResolution.command,
    [...commandResolution.argsPrefix, '--version'],
    { env }
  )
  if (!versionResult.ok && extractCommandNotFoundError(versionResult)) {
    return {
      platform,
      command,
      installed: false,
      authState: 'unknown',
      ready: false,
      setupState: 'install-required',
      summary: buildSummary({
        installed: false,
        authState: 'unknown',
        setupState: 'install-required',
        commandSource: commandResolution.source,
        bundledRuntimeAvailable: installGuide.bundledRuntimeAvailable,
      }),
      installGuide,
      modelProfiles: CODING_MODEL_PROFILE_OPTIONS,
      diagnostics: {
        ...diagnostics,
        versionStdout: versionResult.stdout,
        versionStderr: versionResult.stderr,
        checkError: versionResult.error,
      },
    }
  }

  if (!versionResult.ok) {
    return {
      platform,
      command,
      installed: true,
      authState: 'unknown',
      ready: false,
      setupState: 'check-failed',
      summary: buildSummary({
        installed: true,
        authState: 'unknown',
        setupState: 'check-failed',
        commandSource: commandResolution.source,
        bundledRuntimeAvailable: installGuide.bundledRuntimeAvailable,
      }),
      installGuide,
      modelProfiles: CODING_MODEL_PROFILE_OPTIONS,
      diagnostics: {
        ...diagnostics,
        versionStdout: versionResult.stdout,
        versionStderr: versionResult.stderr,
        checkError: versionResult.error,
      },
    }
  }

  const version = extractVersion(versionResult.stdout)
  diagnostics.versionStdout = versionResult.stdout
  diagnostics.versionStderr = versionResult.stderr
  diagnostics.checkError = versionResult.error

  let gitAvailable: boolean | undefined
  if (platform === 'win32') {
    const gitResult = await runCommand(gitResolution.command, ['--version'], { env })
    gitAvailable = gitResult.ok
    diagnostics.gitStdout = gitResult.stdout
    diagnostics.gitStderr = gitResult.stderr || gitResult.error || ''
    diagnostics.gitSource = gitResult.ok ? gitResolution.source : 'missing'

    if (!gitAvailable) {
      return {
        platform,
        command,
        installed: true,
        version,
        gitAvailable,
        authState: 'unknown',
        ready: false,
        setupState: 'prerequisite-required',
        summary: buildSummary({
          installed: true,
          authState: 'unknown',
          setupState: 'prerequisite-required',
          version,
          commandSource: commandResolution.source,
          bundledRuntimeAvailable: installGuide.bundledRuntimeAvailable,
        }),
        installGuide,
        modelProfiles: CODING_MODEL_PROFILE_OPTIONS,
        diagnostics,
      }
    }
  }

  const authResult = await runCommand(
    commandResolution.command,
    [...commandResolution.argsPrefix, 'auth', 'status', '--json'],
    { env }
  )
  const parsedAuth = parseAuthState(authResult)
  diagnostics.authStdout = authResult.stdout
  diagnostics.authStderr = authResult.stderr || authResult.error || ''
  diagnostics.authMethod = parsedAuth.payload?.authMethod ? String(parsedAuth.payload.authMethod) : undefined
  diagnostics.apiProvider = parsedAuth.payload?.apiProvider ? String(parsedAuth.payload.apiProvider) : undefined
  diagnostics.apiKeySource = parsedAuth.payload?.apiKeySource ? String(parsedAuth.payload.apiKeySource) : undefined

  const setupState: ClaudeCodeStatusSnapshot['setupState'] = 'ready'

  return {
    platform,
    command,
    installed: true,
    version,
    gitAvailable,
    authState: parsedAuth.state,
    ready: true,
    setupState,
    summary: buildSummary({
      installed: true,
      authState: parsedAuth.state,
      setupState,
      version,
      apiKeySource: diagnostics.apiKeySource,
      commandSource: commandResolution.source,
      bundledRuntimeAvailable: installGuide.bundledRuntimeAvailable,
    }),
    installGuide,
    modelProfiles: CODING_MODEL_PROFILE_OPTIONS,
    diagnostics,
  }
}
