import type {
  ClaudeCodeInstallAttempt,
  ClaudeCodeInstallResult,
  ClaudeCodeStatusSnapshot,
} from '../../../src/shared/coding-mode'
import { cleanupIsolatedNpmCacheEnv, createIsolatedNpmCacheEnv } from '../npm-cache-env'
import { getClaudeCodeStatus, type ClaudeCodeStatusOptions } from './claude-code-readiness'
import {
  buildClaudeCodeCommandEnv,
  CLAUDE_CODE_NPM_PACKAGE,
  inspectClaudeCodeOfflineBundle,
  resolveClaudeCodeManagedPrefix,
} from './claude-code-runtime'

const fsPromises = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

interface ShellLikeResult {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
  canceled?: boolean
}

interface IsolatedCacheEnv {
  cacheDir: string
  env: NodeJS.ProcessEnv
}

export interface ClaudeCodeInstallOptions extends Omit<ClaudeCodeStatusOptions, 'runCommand'> {
  runCommand?: (
    command: string,
    args: string[],
    timeout?: number,
    options?: { controlDomain?: 'env-setup'; env?: Partial<NodeJS.ProcessEnv> }
  ) => Promise<ShellLikeResult>
  getStatus?: (options?: ClaudeCodeStatusOptions) => Promise<ClaudeCodeStatusSnapshot>
  createCacheEnv?: (cacheRootDir: string) => Promise<IsolatedCacheEnv>
  cleanupCacheEnv?: (cacheDir: string | null | undefined) => Promise<void>
}

const CLAUDE_CODE_INSTALL_TIMEOUT_MS = 8 * 60 * 1000
const ONLINE_REGISTRY_ATTEMPTS = [
  { label: 'npm 官方源', registryUrl: null },
  { label: 'npm 镜像源', registryUrl: 'https://registry.npmmirror.com' },
] as const

function isLikelyCommandMissing(detail: string): boolean {
  return /not recognized|not found|enoent|cannot find/i.test(detail)
}

function isLikelyNetworkFailure(detail: string): boolean {
  return /etimedout|econnreset|econnrefused|enotfound|network|proxy|certificate|ssl|fetch failed/i.test(detail)
}

function buildInstallArgs(packageSpec: string, managedPrefix: string, registryUrl?: string | null): string[] {
  const args = [
    'install',
    '--prefix',
    managedPrefix,
    '--no-fund',
    '--no-audit',
  ]
  if (registryUrl) {
    args.push('--registry', registryUrl)
  }
  args.push(packageSpec)
  return args
}

function buildFailureSummary(params: {
  lastResult: ShellLikeResult | null
  offlineBundleAvailable: boolean
  bundledRuntimeAvailable: boolean
}): string {
  const combined = `${String(params.lastResult?.stderr || '')}\n${String(params.lastResult?.stdout || '')}`.trim()
  if (params.bundledRuntimeAvailable) {
    return 'Mclaw 内置开发环境初始化失败。请先稍后重试；如果仍失败，建议重新安装当前 Windows 验收包。'
  }
  if (isLikelyCommandMissing(combined)) {
    return 'Claude Code 初始化失败：当前构建没有找到可用的 Node / npm 运行时，暂时无法执行自动准备。'
  }
  if (isLikelyNetworkFailure(combined)) {
    return params.offlineBundleAvailable
      ? 'Claude Code 初始化失败：内置离线包准备未完成，且在线回退也未成功，请稍后重试。'
      : 'Claude Code 初始化失败：当前版本未内置离线包，且在线源暂时不可达。请检查网络/代理后重试。'
  }
  return 'Claude Code 初始化失败，请查看开发模式说明或稍后重试。'
}

async function runInstallCommand(
  command: string,
  args: string[],
  timeout?: number,
  options?: { controlDomain?: 'env-setup'; env?: Partial<NodeJS.ProcessEnv> }
): Promise<ShellLikeResult> {
  const cliModule = await import('../cli')
  return cliModule.runShell(command, args, timeout, options)
}

function buildNoopResult(params: {
  status: ClaudeCodeStatusSnapshot
  summary: string
  ok: boolean
  attempts: ClaudeCodeInstallAttempt[]
}): ClaudeCodeInstallResult {
  return {
    ok: params.ok,
    installed: params.status.installed,
    ready: params.status.ready,
    strategy:
      params.status.diagnostics.commandSource === 'bundled-runtime'
        ? 'bundled-runtime'
        : 'managed-npm',
    usedOfflineBundle: false,
    requiresNetwork: false,
    summary: params.summary,
    stdout: '',
    stderr: '',
    attempts: params.attempts,
    status: params.status,
  }
}

export async function installClaudeCode(
  options: ClaudeCodeInstallOptions = {}
): Promise<ClaudeCodeInstallResult> {
  const platform = options.platform || process.platform
  const env = buildClaudeCodeCommandEnv({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const managedPrefix = resolveClaudeCodeManagedPrefix({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const offlineBundleStatus = inspectClaudeCodeOfflineBundle({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })
  const runCommand = options.runCommand || runInstallCommand
  const getStatus = options.getStatus || getClaudeCodeStatus
  const createCacheEnv = options.createCacheEnv || createIsolatedNpmCacheEnv
  const cleanupCacheEnv = options.cleanupCacheEnv || cleanupIsolatedNpmCacheEnv

  const currentStatus = await getStatus({
    platform,
    arch: options.arch,
    env: options.env,
    userDataDir: options.userDataDir,
    resourcesPath: options.resourcesPath,
    cwd: options.cwd,
  })

  if (currentStatus.ready && currentStatus.diagnostics.commandSource === 'bundled-runtime') {
    return buildNoopResult({
      status: currentStatus,
      summary: 'Mclaw 内置开发运行时已就绪，无需额外安装。',
      ok: true,
      attempts: [
        {
          label: '内置开发运行时',
          ok: true,
          detail: '已直接使用当前包内置的 Claude Code 与 Git 运行时。',
        },
      ],
    })
  }

  if (
    currentStatus.installGuide.bundledRuntimeAvailable
    && currentStatus.setupState === 'prerequisite-required'
    && currentStatus.gitAvailable === false
  ) {
    return buildNoopResult({
      status: currentStatus,
      summary: '当前 Mclaw 包内置的 Git 运行时仍不可用，请重新安装当前 Windows 验收包。',
      ok: false,
      attempts: [
        {
          label: '内置开发运行时',
          ok: false,
          detail: 'Git for Windows 内置运行时检查失败，无法通过在线安装修复。',
        },
      ],
    })
  }

  await fsPromises.mkdir(managedPrefix, { recursive: true })

  const attempts: ClaudeCodeInstallAttempt[] = []
  const cacheRootDir = path.join(managedPrefix, '.npm-cache')
  const isolatedCache = await createCacheEnv(cacheRootDir)
  const installEnv: NodeJS.ProcessEnv = {
    ...env,
    ...(isolatedCache.env || {}),
  }

  let lastResult: ShellLikeResult | null = null
  let usedOfflineBundle = false

  try {
    if (offlineBundleStatus.available && offlineBundleStatus.packageSpec) {
      const offlineResult = await runCommand(
        'npm',
        buildInstallArgs(offlineBundleStatus.packageSpec, managedPrefix),
        CLAUDE_CODE_INSTALL_TIMEOUT_MS,
        {
          controlDomain: 'env-setup',
          env: installEnv,
        }
      )
      attempts.push({
        label: offlineBundleStatus.label,
        ok: offlineResult.ok,
        detail: offlineResult.ok ? '已完成应用内离线准备。' : String(offlineResult.stderr || offlineResult.stdout || '').trim(),
      })
      lastResult = offlineResult
      if (offlineResult.ok) {
        usedOfflineBundle = true
      }
    }

    if (!lastResult?.ok) {
      for (const onlineAttempt of ONLINE_REGISTRY_ATTEMPTS) {
        const result = await runCommand(
          'npm',
          buildInstallArgs(CLAUDE_CODE_NPM_PACKAGE, managedPrefix, onlineAttempt.registryUrl),
          CLAUDE_CODE_INSTALL_TIMEOUT_MS,
          {
            controlDomain: 'env-setup',
            env: installEnv,
          }
        )
        attempts.push({
          label: onlineAttempt.label,
          registryUrl: onlineAttempt.registryUrl,
          ok: result.ok,
          detail: result.ok ? '' : String(result.stderr || result.stdout || '').trim(),
        })
        lastResult = result
        if (result.ok) {
          break
        }
      }
    }

    if (!lastResult?.ok) {
      return {
        ok: false,
        installed: false,
        ready: false,
        strategy: usedOfflineBundle ? 'bundled-offline' : 'managed-npm',
        usedOfflineBundle,
        requiresNetwork: !(offlineBundleStatus.available || currentStatus.installGuide.bundledRuntimeAvailable),
        summary: buildFailureSummary({
          lastResult,
          offlineBundleAvailable: offlineBundleStatus.available,
          bundledRuntimeAvailable: currentStatus.installGuide.bundledRuntimeAvailable,
        }),
        stdout: String(lastResult?.stdout || '').trim(),
        stderr: String(lastResult?.stderr || '').trim(),
        attempts,
      }
    }

    const status = await getStatus({
      platform,
      arch: options.arch,
      env: options.env,
      userDataDir: options.userDataDir,
      resourcesPath: options.resourcesPath,
      cwd: options.cwd,
    })

    return {
      ok: true,
      installed: status.installed,
      ready: status.ready,
      strategy: usedOfflineBundle ? 'bundled-offline' : 'managed-npm',
      usedOfflineBundle,
      requiresNetwork: !usedOfflineBundle,
      summary: status.ready
        ? status.diagnostics.commandSource === 'managed-install'
          ? '开发环境已准备完成，可以直接用于 Mclaw 开发模式。'
          : status.summary
        : status.summary,
      stdout: String(lastResult.stdout || '').trim(),
      stderr: String(lastResult.stderr || '').trim(),
      attempts,
      status,
    }
  } finally {
    await cleanupCacheEnv(isolatedCache.cacheDir).catch(() => undefined)
  }
}
