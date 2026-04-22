import { useState, useEffect } from 'react'
import { ActionIcon, Alert, Button, Loader, Modal, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ENV_CHECK_UI_POLICY, getEnvCheckSupportActionsForIssueKind, type EnvCheckSupportAction } from '../shared/env-check-policy'
import {
  classifyMacGitToolsIssue,
  classifyMacNodeInstallerFailure,
  classifyWindowsNodeInstallerFailure,
  classifyNodeInstallerDownloadFailure,
  createNodeInstallerIssue,
  type NodeInstallerIssue,
  type NodeInstallerIssueKind,
} from '../shared/node-installer-issues'
import { UI_RUNTIME_DEFAULTS } from '../shared/runtime-policies'
import {
  applyBaselineBackupBypassToDiscovery,
  buildManualBackupWarning,
  compareLooseVersions,
  hasInitializedOpenClawConfig,
  resolveOpenClawInstallDecision,
  shouldEnsureBaselineBackup,
  type OpenClawBaselineBackupEnsureResult,
  type OpenClawDiscoveryResult,
  type OpenClawInstallCandidate,
  type OpenClawLatestVersionCheckResult,
  type EnvCheckReadyPayload,
} from '../shared/openclaw-phase1'
import type { OpenClawUpgradeCheckResult } from '../shared/openclaw-phase4'
import type { OpenClawBackupRootInfo } from '../shared/openclaw-phase3'
import {
  buildOpenClawMigrationSmokeSummary,
  MAX_SUPPORTED_OPENCLAW_VERSION,
  MIN_SUPPORTED_OPENCLAW_VERSION,
  type OpenClawMigrationSmokeSummary,
  PINNED_OPENCLAW_VERSION,
  resolveOpenClawTargetVersionLabel,
} from '../shared/openclaw-version-policy'
import BrandWordmark from '@/components/BrandWordmark'
import tooltips from '@/constants/tooltips.json'

const MIN_NODE_VERSION = '22.16.0'
const MAX_OPENCLAW_LATEST_CHECK_ATTEMPTS = 3
const ENV_CHECK_TOOLTIPS = tooltips.envCheck
const OPENCLAW_NPM_MIRROR_SUMMARY = [
  'npmmirror',
  '腾讯云镜像',
  '华为云镜像',
  'npm 官方源',
].join('、')
const OPENCLAW_MANUAL_INSTALL_COMMANDS = [
  `npm install -g openclaw@${PINNED_OPENCLAW_VERSION} --registry=https://registry.npmmirror.com`,
  `npm install -g openclaw@${PINNED_OPENCLAW_VERSION} --registry=https://mirrors.cloud.tencent.com/npm/`,
  `npm install -g openclaw@${PINNED_OPENCLAW_VERSION} --registry=https://repo.huaweicloud.com/repository/npm/`,
]
const ENV_CHECK_STEP_TOOLTIPS: Record<string, string> = {
  node: ENV_CHECK_TOOLTIPS.nodeRuntime,
  openclaw: ENV_CHECK_TOOLTIPS.openClawCli,
  gateway: ENV_CHECK_TOOLTIPS.gatewayService,
}

interface CliResultLikeForGuidance {
  stdout?: string
  stderr?: string
  code?: number | null
  npmRegistryAttempts?: Array<{
    mirrorId: string
    label: string
    registryUrl: string | null
    ok: boolean
    canceled?: boolean
  }>
}

interface EnvCheckNodeCheckResultLike {
  installed: boolean
  version?: string
  needsUpgrade: boolean
  meetsRequirement?: boolean
  requiredVersion: string
  targetVersion: string
  installStrategy?: 'nvm' | 'installer'
}

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

export function buildOpenClawInstallFailureGuidance(result: CliResultLikeForGuidance | null | undefined): string {
  const stdout = String(result?.stdout || '').trim()
  const stderr = String(result?.stderr || '').trim()
  const output = `${stderr}\n${stdout}`.trim()
  const attempts = Array.isArray(result?.npmRegistryAttempts) ? result!.npmRegistryAttempts : []
  const attemptedMirrors =
    attempts.length > 0
      ? attempts
          .map((attempt) => String(attempt.label || attempt.registryUrl || attempt.mirrorId || '').trim())
          .filter(Boolean)
      : []

  const lines: string[] = ['OpenClaw 本地内置本体释放失败，且网络兜底部署也未完成。']

  if (attemptedMirrors.length > 0) {
    lines.push(`Mclaw 仅在本地内置载荷不可用时才会触发网络兜底，本次已尝试以下源：${attemptedMirrors.join('、')}。`)
    lines.push('通常不需要 VPN，但需要至少能访问一个公共镜像源。')
  }

  if (
    containsAny(output, [
      /UNABLE_TO_GET_ISSUER_CERT_LOCALLY/i,
      /SELF_SIGNED_CERT/i,
      /UNABLE_TO_VERIFY_LEAF_SIGNATURE/i,
      /CERT_HAS_EXPIRED/i,
      /certificate/i,
      /TLS/i,
    ])
  ) {
    lines.push('检测到 npm/TLS 证书校验失败，通常是公司代理、证书注入或自定义 npm 证书配置导致。')
    lines.push('建议先清理 npm 证书覆盖或切换到可直连镜像的网络环境后再重试。')
  } else if (
    containsAny(output, [
      /EACCES/i,
      /EPERM/i,
      /permission denied/i,
      /拒绝访问/,
      /访问被拒绝/,
      /icacls/i,
    ])
  ) {
    lines.push('检测到目录读写权限异常，这可能是杀毒软件拦截，或此前使用过管理员身份导致了文件所有权错乱。')
    const platformState =
      typeof window !== 'undefined' ? resolveEnvCheckPlatformState(window.api?.platform) : null
    if (platformState?.isMac) {
      lines.push('macOS 下，您可能需要检查对应目录的所有权：')
      lines.push('sudo chown -R $USER ~/.npm ~/.openclaw')
    } else {
      lines.push('Windows 下，您可以尝试在 PowerShell 中执行以下命令修复所有权后再重试：')
      lines.push('icacls "$env:USERPROFILE\\.openclaw" /grant "$env:USERNAME:(OI)(CI)F" /T')
      lines.push('icacls "$env:USERPROFILE\\.npm" /grant "$env:USERNAME:(OI)(CI)F" /T')
    }
  } else if (
    containsAny(output, [
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /network/i,
      /connect/i,
      /socket/i,
      /fetch failed/i,
      /timeout/i,
    ])
  ) {
    lines.push('检测到网络连接失败，请确认当前网络、代理或防火墙没有拦截公共下载请求。')
  }

  lines.push('如反复失败，您仍可临时手动补装外部 OpenClaw 运行环境作为兜底路径；完成后重启 Mclaw：')
  for (const command of OPENCLAW_MANUAL_INSTALL_COMMANDS) {
    lines.push(command)
  }

  if (output) {
    lines.push('')
    lines.push(`原始错误：${output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 4).join(' | ')}`)
  } else if (result?.code !== undefined && result?.code !== null) {
    lines.push('')
    lines.push(`原始错误：安装进程退出码 ${result.code}`)
  }

  return lines.join('\n')
}

function parseNodeVersion(version: string) {
  const match = String(version || '').trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!match) return null
  return {
    major: Number(match[1] || 0),
    minor: Number(match[2] || 0),
    patch: Number(match[3] || 0),
  }
}

function compareNodeVersions(left: string, right: string): number {
  const leftParsed = parseNodeVersion(left)
  const rightParsed = parseNodeVersion(right)
  if (!leftParsed || !rightParsed) return 0
  if (leftParsed.major !== rightParsed.major) return leftParsed.major - rightParsed.major
  if (leftParsed.minor !== rightParsed.minor) return leftParsed.minor - rightParsed.minor
  return leftParsed.patch - rightParsed.patch
}

function isNodeVersionAtLeast(version: string, minimumVersion: string): boolean {
  return compareNodeVersions(version, minimumVersion) >= 0
}

export function shouldOfferManualNodeUpgrade(version: string, minimumVersion: string = MIN_NODE_VERSION): boolean {
  return Boolean(String(version || '').trim()) && !isNodeVersionAtLeast(version, minimumVersion)
}

function resolveActiveOpenClawCandidate(
  discovery: OpenClawDiscoveryResult | null | undefined
): OpenClawInstallCandidate | null {
  if (!discovery) return null
  return discovery.candidates.find((candidate) => candidate.candidateId === discovery.activeCandidateId) || null
}

function applyBaselineBackupToCandidate(
  discovery: OpenClawDiscoveryResult,
  candidateId: string,
  backup: NonNullable<OpenClawInstallCandidate['baselineBackup']>
): OpenClawDiscoveryResult {
  return {
    ...discovery,
    candidates: discovery.candidates.map((candidate) =>
      candidate.candidateId === candidateId
        ? { ...candidate, baselineBackup: backup, baselineBackupBypass: null }
        : candidate
    ),
  }
}

function buildTakeoverFailure(
  candidate: OpenClawInstallCandidate,
  message?: string,
  manualBackupAction?: {
    displaySourcePath?: string
    displaySuggestedArchivePath?: string
  }
): OpenClawTakeoverFailure {
  return {
    candidateId: candidate.candidateId,
    displaySourcePath:
      String(manualBackupAction?.displaySourcePath || '').trim() ||
      String(candidate.displayStateRoot || '').trim() ||
      String(candidate.stateRoot || '').trim() ||
      '未知目录',
    displaySuggestedArchivePath: String(manualBackupAction?.displaySuggestedArchivePath || '').trim(),
    message: String(message || '').trim() || '自动备份失败，请稍后重试。',
  }
}

function shouldShowTakeoverNotice(candidate: OpenClawInstallCandidate): boolean {
  return candidate.ownershipState !== 'qclaw-installed'
}

interface OpenClawLatestRetryResult {
  result: OpenClawLatestVersionCheckResult
  attempts: number
}

interface RetryOpenClawLatestVersionCheckOptions {
  maxAttempts?: number
  delayMs?: number
  onAttemptStart?: (attempt: number) => void | Promise<void>
  onAttemptFailure?: (
    attempt: number,
    result: OpenClawLatestVersionCheckResult
  ) => void | Promise<void>
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function resolveEnvInstallProgressStep(options: {
  needNode: boolean
  shouldInstallOpenClawRuntime: boolean
}): 'node' | 'openclaw' | null {
  if (options.needNode) return 'node'
  if (options.shouldInstallOpenClawRuntime) return 'openclaw'
  return null
}

export function isMacPlatform(platform?: string): boolean {
  return platform === 'darwin'
}

export interface EnvCheckPlatformState {
  platform: string | undefined
  isMac: boolean
  shouldPrepareMacDeveloperTools: boolean
  shouldInspectNodeInstaller: boolean
}

export interface EnvCheckNodeInstallPlatformBehavior {
  platform: string | undefined
  shouldPrepareMacDeveloperTools: boolean
  shouldInspectNodeInstaller: boolean
  classifyInstallerFailure: (rawError: string) => NodeInstallerIssue
  installCompletedDescription: string
  installedDescription: string
  refreshDescription: string
  recheckDescription: string
  missingAfterInstallError: string
  missingAfterInstallMessage: string
}

export function resolveEnvCheckPlatformState(platform?: string): EnvCheckPlatformState {
  const isMac = isMacPlatform(platform)
  return {
    platform,
    isMac,
    shouldPrepareMacDeveloperTools: isMac,
    shouldInspectNodeInstaller: isMac,
  }
}

export function resolveNodeInstallPlatformBehavior(
  platform?: string
): EnvCheckNodeInstallPlatformBehavior {
  const platformState = resolveEnvCheckPlatformState(platform)
  return {
    platform,
    shouldPrepareMacDeveloperTools: platformState.shouldPrepareMacDeveloperTools,
    shouldInspectNodeInstaller: platformState.shouldInspectNodeInstaller,
    classifyInstallerFailure: (rawError: string) =>
      classifyNodeInstallerFailureForPlatform(platform, rawError),
    installCompletedDescription: '安装完成',
    installedDescription: '已安装',
    refreshDescription: '刷新环境变量...',
    recheckDescription: '重新检测 Node.js...',
    missingAfterInstallError: '安装后仍无法检测到',
    missingAfterInstallMessage:
      platform === 'win32'
        ? 'Node.js 安装后仍无法检测到。请先关闭并重新打开 Mclaw；如果仍然失败，请改为手动安装 Windows 版 Node.js。'
        : 'Node.js 安装后仍无法检测到。请重启应用或手动安装。',
  }
}

export interface EnvCheckOpenClawInstallBehavior {
  installedDescription: string
  refreshDescription: string
  resolveRecheckDescription: (needOpenClawRuntimeRecovery: boolean) => string
  missingAfterInstallError: string
  missingAfterInstallMessage: string[]
}

export interface EnvCheckGatewayBehavior {
  deferredCheckingDescription: string
  deferredStepVersion: string
  deferredReadyDescription: string
  resolveContinueLabel: (sharedConfigInitialized: boolean) => string
}

export interface EnvCheckGatewayDeferredStepState
  extends Pick<Step, 'status' | 'version' | 'description' | 'progress'> {}

export function resolveOpenClawInstallBehavior(): EnvCheckOpenClawInstallBehavior {
  return {
    installedDescription: '已安装',
    refreshDescription: '刷新环境变量...',
    resolveRecheckDescription: (needOpenClawRuntimeRecovery: boolean) =>
      needOpenClawRuntimeRecovery ? '正在验证 OpenClaw 运行环境...' : '重新检测 OpenClaw 运行环境...',
    missingAfterInstallError: '安装后仍无法检测到',
    missingAfterInstallMessage: [
      'OpenClaw 运行环境准备流程已执行，但当前仍无法检测到可用命令。',
      '这通常表示内置本体释放和 PATH 生效之间仍存在异常。',
      '请先重启 Mclaw 再试一次。',
      '如果仍失败，可临时在 PowerShell 中手动执行以下命令之一，再重新打开 Mclaw：',
      ...OPENCLAW_MANUAL_INSTALL_COMMANDS,
    ],
  }
}

export function resolveGatewayBehavior(): EnvCheckGatewayBehavior {
  return {
    deferredCheckingDescription: '当前先完成模型配置；点击进入控制面板后，Mclaw 会先自动启动并确认 Gateway，再进入主界面。',
    deferredStepVersion: '自动启动',
    deferredReadyDescription: '进入控制面板时会自动启动 Gateway 并确认本地对话可用，无需手动打开终端。',
    resolveContinueLabel: (sharedConfigInitialized: boolean) =>
      sharedConfigInitialized ? '进入控制面板' : '开始配置',
  }
}

export function shouldPrepareMacDeveloperTools(platform?: string): boolean {
  return resolveEnvCheckPlatformState(platform).shouldPrepareMacDeveloperTools
}

export function shouldInspectNodeInstallerForPlatform(platform?: string): boolean {
  return resolveEnvCheckPlatformState(platform).shouldInspectNodeInstaller
}

export function classifyNodeInstallerFailureForPlatform(
  platform: string | undefined,
  rawError: string
): NodeInstallerIssue {
  if (isMacPlatform(platform)) {
    return classifyMacNodeInstallerFailure(rawError)
  }

  if (platform === 'win32') {
    return classifyWindowsNodeInstallerFailure(rawError)
  }

  return createNodeInstallerIssue('installer-failed', rawError)
}

export function shouldRenderStartupIssueInline(
  issue: Pick<NodeInstallerIssue, 'kind'> | null | undefined,
  platform?: string
): boolean {
  return isMacPlatform(platform) && issue?.kind === 'xcode-clt-pending'
}

export async function retryOpenClawLatestVersionCheck(
  checkLatestVersion: () => Promise<OpenClawLatestVersionCheckResult>,
  options: RetryOpenClawLatestVersionCheckOptions = {}
): Promise<OpenClawLatestRetryResult> {
  const maxAttempts = Math.max(1, options.maxAttempts || MAX_OPENCLAW_LATEST_CHECK_ATTEMPTS)
  const delayMs = Math.max(0, options.delayMs || 0)

  let lastResult: OpenClawLatestVersionCheckResult = {
    ok: false,
    latestVersion: '',
    checkedAt: '',
    source: 'npm-registry',
    error: '最新版本检查未执行',
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await options.onAttemptStart?.(attempt)
    lastResult = await checkLatestVersion()
    if (lastResult.ok) {
      return { result: lastResult, attempts: attempt }
    }
    if (attempt < maxAttempts) {
      await options.onAttemptFailure?.(attempt, lastResult)
      if (delayMs > 0) {
        await wait(delayMs)
      }
    }
  }

  return { result: lastResult, attempts: maxAttempts }
}

type StepStatus = 'pending' | 'checking' | 'ok' | 'installing' | 'pending-install' | 'error' | 'canceled'

interface Step {
  id: string
  label: string
  description: string
  status: StepStatus
  version?: string
  error?: string
  progress?: number
}

interface FatalIssueState {
  message: string
  issueKind?: NodeInstallerIssueKind
}

interface EnvCheckRestartState {
  runAttempt: number
  steps: Step[]
  currentStep: number
  progress: number
  tipIndex: number
  fatalIssue: FatalIssueState | null
  startupIssuePrompt: NodeInstallerIssue | null
}

interface OpenClawVersionGateState {
  discovery: OpenClawDiscoveryResult | null
  activeCandidate: OpenClawInstallCandidate | null
  upgradeCheck: OpenClawUpgradeCheckResult | null
  migrationSmoke: OpenClawMigrationSmokeSummary | null
  canUpgrade: boolean
  canAutoCorrect: boolean
  blocksContinue: boolean
  statusLabel: string
  message: string
  manualHint?: string
}

export interface OpenClawSourceBadgeState {
  label: string
  title: string
}

export interface OpenClawDeliveryNoticeState {
  color: 'blue' | 'yellow'
  title: string
  message: string
}

export interface OpenClawTakeoverSummary {
  detected: boolean
  backupRootDirectory: string
  failures: OpenClawTakeoverFailure[]
}

type PluginRepairResult = Awaited<ReturnType<typeof window.api.repairIncompatiblePlugins>>

export function kickoffStartupPluginRepair(
  startRepair?: () => Promise<PluginRepairResult | null>
): void {
  if (!startRepair) return

  // Startup plugin repair is best-effort and should not block the first env check render/update.
  void startRepair().catch(() => null)
}

export interface OpenClawTakeoverFailure {
  candidateId: string
  displaySourcePath: string
  displaySuggestedArchivePath: string
  message: string
}

export function resolveActiveTakeoverFailure(
  takeoverSummary: OpenClawTakeoverSummary | null | undefined,
  candidateId: string
): OpenClawTakeoverFailure | null {
  const normalizedCandidateId = String(candidateId || '').trim()
  if (!takeoverSummary || !normalizedCandidateId) return null
  return takeoverSummary.failures.find((item) => item.candidateId === normalizedCandidateId) || null
}

export function clearTakeoverFailure(
  takeoverSummary: OpenClawTakeoverSummary | null | undefined,
  candidateId: string
): OpenClawTakeoverSummary | null {
  if (!takeoverSummary) return null
  return {
    ...takeoverSummary,
    failures: takeoverSummary.failures.filter((item) => item.candidateId !== candidateId),
  }
}

export function formatTakeoverFailureManualBackupWarning(
  failure: Pick<OpenClawTakeoverFailure, 'displaySourcePath' | 'displaySuggestedArchivePath'> | null | undefined
): string {
  if (!failure) return '自动备份失败，请手动备份。'
  return buildManualBackupWarning({
    sourcePath: failure.displaySourcePath,
    displaySourcePath: failure.displaySourcePath,
    suggestedArchivePath: failure.displaySuggestedArchivePath,
    displaySuggestedArchivePath: failure.displaySuggestedArchivePath,
  })
}

interface HistoryOnlyRecoveryFailureState {
  candidate: OpenClawInstallCandidate
  failure: OpenClawTakeoverFailure
}

interface HistoryOnlyRecoveryResult {
  discovery: OpenClawDiscoveryResult
  activeCandidate: OpenClawInstallCandidate
}

export function canContinueHistoryOnlyRecovery(
  candidate:
    | Pick<OpenClawInstallCandidate, 'ownershipState' | 'baselineBackup' | 'baselineBackupBypass'>
    | null
    | undefined,
  backupResult:
    | Pick<OpenClawBaselineBackupEnsureResult, 'ok' | 'backup'>
    | null
    | undefined
): boolean {
  if (!candidate || !backupResult?.ok) return false
  if (backupResult.backup || candidate.baselineBackup || candidate.baselineBackupBypass) return true
  return !(
    candidate.ownershipState === 'external-preexisting' ||
    candidate.ownershipState === 'unknown-external'
  )
}

export function isSupportedOpenClawVersion(
  version: string,
  minimumVersion: string = MIN_SUPPORTED_OPENCLAW_VERSION,
  maximumVersion: string = MAX_SUPPORTED_OPENCLAW_VERSION
): boolean {
  const normalizedVersion = String(version || '').trim()
  if (!normalizedVersion) return false
  return (
    compareLooseVersions(normalizedVersion, minimumVersion) >= 0 &&
    compareLooseVersions(normalizedVersion, maximumVersion) <= 0
  )
}

export function buildOpenClawGateState(
  discovery: OpenClawDiscoveryResult | null,
  upgradeCheck: OpenClawUpgradeCheckResult | null
): OpenClawVersionGateState {
  const activeCandidate = resolveActiveOpenClawCandidate(discovery)
  const migrationSmoke =
    activeCandidate && upgradeCheck
      ? buildOpenClawMigrationSmokeSummary({
          fromVersion: upgradeCheck.currentVersion || activeCandidate.version,
          toVersion: upgradeCheck.targetVersion,
        })
      : null
  if (!activeCandidate || !upgradeCheck) {
    return {
      discovery,
      activeCandidate: activeCandidate || null,
      upgradeCheck,
      migrationSmoke,
      canUpgrade: false,
      canAutoCorrect: false,
      blocksContinue: false,
      statusLabel: '',
      message: '',
    }
  }

  const needsTakeoverNotice = shouldShowTakeoverNotice(activeCandidate)
  const withTakeoverSuffix = (message: string): string =>
    needsTakeoverNotice ? `${message} 原配置数据不会被覆盖，并会额外进行备份接管。` : message
  const targetVersionLabel = resolveOpenClawTargetVersionLabel(upgradeCheck.targetVersion)

  switch (upgradeCheck.enforcement) {
    case 'optional_upgrade':
      return {
        discovery,
        activeCandidate,
        upgradeCheck,
        migrationSmoke,
        canUpgrade: true,
        canAutoCorrect: false,
        blocksContinue: false,
        statusLabel: `可升级至 ${targetVersionLabel}`,
        message: withTakeoverSuffix(
          `当前版本受支持，可按需升级至 ${targetVersionLabel}`
        ),
      }
    case 'auto_correct':
      return {
        discovery,
        activeCandidate,
        upgradeCheck,
        migrationSmoke,
        canUpgrade: false,
        canAutoCorrect: true,
        blocksContinue: true,
        statusLabel:
          upgradeCheck.targetAction === 'downgrade'
            ? `需回退至 ${targetVersionLabel}`
            : `需升级至 ${targetVersionLabel}`,
        message:
          upgradeCheck.targetAction === 'downgrade'
            ? `检测到超出支持范围的 OpenClaw 版本，正在自动回退至 ${targetVersionLabel}`
            : `检测到不受支持的 OpenClaw 版本，正在自动升级至 ${targetVersionLabel}`,
      }
    case 'manual_block':
      if (!upgradeCheck.blocksContinue) {
        return {
          discovery,
          activeCandidate,
          upgradeCheck,
          migrationSmoke,
          canUpgrade: false,
          canAutoCorrect: false,
          blocksContinue: false,
          statusLabel: `如需升级请手动切换至 ${targetVersionLabel}`,
          message:
            upgradeCheck.manualHint ||
            `当前版本受支持，可继续使用；如需升级至 ${targetVersionLabel}，请在原安装环境中手动处理。`,
          manualHint: upgradeCheck.manualHint,
        }
      }
      return {
        discovery,
        activeCandidate,
        upgradeCheck,
        migrationSmoke,
        canUpgrade: false,
        canAutoCorrect: false,
        blocksContinue: true,
        statusLabel: `需手动调整至 ${targetVersionLabel}`,
        message:
          upgradeCheck.manualHint ||
          `当前 OpenClaw 版本不在支持范围内，且当前安装来源暂不支持程序内自动纠偏，请先手动调整至 ${targetVersionLabel}`,
        manualHint: upgradeCheck.manualHint,
      }
    case 'none':
    default:
      return {
        discovery,
        activeCandidate,
        upgradeCheck,
        migrationSmoke,
        canUpgrade: false,
        canAutoCorrect: false,
        blocksContinue: false,
        statusLabel: '已处于受支持上限',
        message: withTakeoverSuffix('当前 OpenClaw 已是受支持上限版本'),
      }
  }
}

export function buildOpenClawAutoCorrectionConsentMessage(
  gateState:
    | Pick<OpenClawVersionGateState, 'activeCandidate' | 'upgradeCheck'>
    | null
    | undefined
): string {
  const currentVersion =
    String(gateState?.upgradeCheck?.currentVersion || '').trim() ||
    String(gateState?.activeCandidate?.version || '').trim() ||
    '未知版本'
  const targetVersion = resolveOpenClawTargetVersionLabel(gateState?.upgradeCheck?.targetVersion)
  const action = gateState?.upgradeCheck?.targetAction === 'downgrade' ? '回退' : '升级'

  return [
    '检测到当前 OpenClaw 版本不在 Mclaw 的支持范围内。',
    `当前版本：${currentVersion}`,
    `目标版本：${targetVersion}`,
    `Mclaw 将自动${action} OpenClaw 到受支持版本后再继续。`,
    '如果你不接受本次自动处理，Mclaw 将立即退出。',
    '',
    '是否继续？',
  ].join('\n')
}

export function canContinueWithOpenClawGate(
  gateState: Pick<OpenClawVersionGateState, 'blocksContinue'> | null | undefined,
  activeTakeoverBackupBlocked: boolean
): boolean {
  if (activeTakeoverBackupBlocked) return false
  return !gateState?.blocksContinue
}

export function canShowOpenClawUpgradeAction(
  gateState: Pick<OpenClawVersionGateState, 'canUpgrade' | 'canAutoCorrect'> | null | undefined,
  activeTakeoverBackupBlocked: boolean
): boolean {
  return Boolean(gateState && !activeTakeoverBackupBlocked && (gateState.canUpgrade || gateState.canAutoCorrect))
}

export function resolveOpenClawSourceBadgeState(
  candidate: Pick<OpenClawInstallCandidate, 'installSource' | 'deliveryMode'> | null | undefined
): OpenClawSourceBadgeState | null {
  if (!candidate) return null

  const deliveryMode = String(candidate.deliveryMode || '').trim()
  switch (deliveryMode) {
    case 'bundled-runtime':
      return {
        label: '内置本体',
        title: '当前使用安装包内置的 OpenClaw 运行本体。',
      }
    case 'bundled-fallback':
      return {
        label: '内置补位',
        title: '当前未命中目标内置 runtime，正在使用安装包内置补位载荷；请检查该平台 runtime 是否缺失、损坏或打包不完整。',
      }
    case 'online-fallback':
      return {
        label: '在线兜底',
        title: '当前未命中本地载荷，已进入在线补装兜底路径。',
      }
    case 'external':
      return {
        label: '外部环境',
        title: '当前使用的是系统中已有的 OpenClaw 运行环境。',
      }
    default:
      break
  }

  const installSource = String(candidate.installSource || '').trim()
  switch (installSource) {
    case 'npm-global':
      return {
        label: '全局 npm',
        title: '当前使用的是系统全局 npm 安装的 OpenClaw 运行环境。',
      }
    case 'homebrew':
      return {
        label: 'Homebrew',
        title: '当前使用的是 Homebrew 安装的 OpenClaw 运行环境。',
      }
    case 'nvm':
    case 'fnm':
    case 'asdf':
    case 'mise':
    case 'volta':
      return {
        label: installSource,
        title: `当前使用的是 ${installSource} 环境中的 OpenClaw。`,
      }
    case 'custom':
      return {
        label: '自定义安装',
        title: '当前使用的是用户自定义路径中的 OpenClaw 运行环境。',
      }
    case 'unknown':
      return {
        label: '未知来源',
        title: '当前 OpenClaw 来源暂未识别。',
      }
    default:
      return installSource
        ? {
            label: installSource,
            title: `当前 OpenClaw 来源：${installSource}`,
          }
        : null
  }
}

export function resolveOpenClawDeliveryNoticeState(
  discovery:
    | Pick<OpenClawDiscoveryResult, 'bundledDeliveryMode' | 'bundledTargetDeliveryMode'>
    | null
    | undefined
): OpenClawDeliveryNoticeState | null {
  const currentMode = String(discovery?.bundledDeliveryMode || '').trim()
  const targetMode = String(discovery?.bundledTargetDeliveryMode || '').trim()
  if (!currentMode || !targetMode || currentMode === targetMode) return null

  return {
    color: currentMode === 'bundled-fallback' && targetMode === 'bundled-runtime' ? 'yellow' : 'blue',
    title: '运行来源',
    message: `当前 OpenClaw 交付模式为 ${currentMode}，目标模式为 ${targetMode}。这通常表示当前平台没有命中目标本体路径，或当前安装包中的该平台内置 runtime 载荷缺失、损坏或打包不完整。`,
  }
}

export async function resolveTakeoverBackupRootDirectory(
  discovery: Pick<OpenClawDiscoveryResult, 'defaultBackupDirectory'> | null | undefined,
  getBackupRoot: () => Promise<Pick<OpenClawBackupRootInfo, 'displayRootDirectory'> | null | undefined>
): Promise<string> {
  const fallbackDirectory = String(discovery?.defaultBackupDirectory || '').trim()
  if (!fallbackDirectory) return ''

  try {
    const backupRoot = await getBackupRoot()
    const displayRootDirectory = String(backupRoot?.displayRootDirectory || '').trim()
    return displayRootDirectory || fallbackDirectory
  } catch {
    return fallbackDirectory
  }
}

function formatCancelDomainSummary(domains: string[]): string {
  if (!domains.length) return '无'
  return domains.join('、')
}

const INITIAL_STEPS: Step[] = [
  { id: 'node', label: 'Node.js 运行时', description: '检查或补齐 Node.js 依赖', status: 'pending' },
  { id: 'openclaw', label: 'OpenClaw 核心', description: '优先释放内置 OpenClaw 本体', status: 'pending' },
  { id: 'gateway', label: 'Gateway 服务', description: '完成模型配置后启动 Gateway，并验证本地直聊', status: 'pending' },
]

function createInitialSteps(): Step[] {
  return INITIAL_STEPS.map((step) => ({ ...step }))
}

export function resolveGatewayDeferredStepState(
  gatewayBehavior: EnvCheckGatewayBehavior = resolveGatewayBehavior()
): EnvCheckGatewayDeferredStepState {
  return {
    status: 'ok',
    version: gatewayBehavior.deferredStepVersion,
    description: gatewayBehavior.deferredReadyDescription,
    progress: 100,
  }
}

export function createEnvCheckReadyPayload(options: {
  hadOpenClawInstalled: boolean
  installedOpenClawDuringCheck: boolean
  sharedConfigInitialized: boolean
  discoveryResult: OpenClawDiscoveryResult | null
}): EnvCheckReadyPayload {
  return {
    hadOpenClawInstalled: options.hadOpenClawInstalled,
    installedOpenClawDuringCheck: options.installedOpenClawDuringCheck,
    gatewayRunning: false,
    sharedConfigInitialized: options.sharedConfigInitialized,
    discoveryResult: options.discoveryResult,
  }
}

export interface EnvCheckNodeCheckState {
  requiredVersion: string
  targetVersion: string
  needNode: boolean
  nodeNeedsUpgrade: boolean
}

export function resolveEnvCheckNodeCheckState(
  nodeResult: EnvCheckNodeCheckResultLike,
  fallbackRequiredVersion: string = MIN_NODE_VERSION
): EnvCheckNodeCheckState {
  return {
    requiredVersion: nodeResult.requiredVersion || fallbackRequiredVersion,
    targetVersion: nodeResult.targetVersion || '',
    needNode: !nodeResult.installed,
    nodeNeedsUpgrade: nodeResult.installed && nodeResult.needsUpgrade,
  }
}

export interface EnvCheckNodeStepState
  extends Pick<Step, 'status' | 'version' | 'description' | 'progress'> {
  latestNodeVersion: string
  blocksContinue: boolean
}

export interface EnvCheckNodeInstallPrepState
  extends Pick<Step, 'status' | 'description' | 'progress'> {
  shouldDownloadInstaller: boolean
}

export interface EnvCheckNodePostInstallRecheckState {
  refreshStep: Pick<Step, 'status' | 'description' | 'progress'>
  recheckStep: Pick<Step, 'status' | 'description' | 'progress'>
  successStep: Pick<Step, 'status' | 'version' | 'description' | 'progress'>
  failureStep: Pick<Step, 'status' | 'error'>
  failureIssueKind: NodeInstallerIssueKind
  failureMessage: string
}

export function resolveEnvCheckNodeStepState(options: {
  nodeResult: Pick<EnvCheckNodeCheckResultLike, 'installed' | 'version'>
  nodeCheckState: EnvCheckNodeCheckState
  nodeInstallBehavior?: Pick<EnvCheckNodeInstallPlatformBehavior, 'installedDescription'>
}): EnvCheckNodeStepState {
  const nodeInstallBehavior = options.nodeInstallBehavior || resolveNodeInstallPlatformBehavior()
  const latestNodeVersion = options.nodeCheckState.targetVersion || ''

  if (options.nodeCheckState.needNode) {
    return {
      status: 'pending-install',
      description: '未检测到 Node.js，系统将自动安装官方最新稳定版',
      progress: 20,
      latestNodeVersion,
      blocksContinue: false,
    }
  }

  if (options.nodeCheckState.nodeNeedsUpgrade) {
    return {
      status: 'pending-install',
      version: options.nodeResult.version,
      description: `OpenClaw 需要 Node.js ${options.nodeCheckState.requiredVersion} 或更高版本。当前版本过低，请先手动升级 Node.js 后再继续。`,
      progress: 20,
      latestNodeVersion,
      blocksContinue: true,
    }
  }

  return {
    status: 'ok',
    version: options.nodeResult.version,
    description: nodeInstallBehavior.installedDescription,
    progress: 100,
    latestNodeVersion: '',
    blocksContinue: false,
  }
}

export function resolveEnvCheckNodeInstallPrepState(options: {
  needNode: boolean
  installStrategy?: 'nvm' | 'installer'
  targetNodeVersion: string
}): EnvCheckNodeInstallPrepState | null {
  if (!options.needNode) return null

  const shouldDownloadInstaller = options.installStrategy !== 'nvm'
  if (shouldDownloadInstaller) {
    return {
      status: 'installing',
      description: `正在下载 Node.js ${options.targetNodeVersion}...`,
      progress: 35,
      shouldDownloadInstaller: true,
    }
  }

  return {
    status: 'installing',
    description: `正在通过 nvm 准备 Node.js ${options.targetNodeVersion}...`,
    progress: 45,
    shouldDownloadInstaller: false,
  }
}

export function resolveEnvCheckNodePostInstallRecheckState(options: {
  nodeInstallBehavior?: Pick<
    EnvCheckNodeInstallPlatformBehavior,
    'refreshDescription' | 'recheckDescription' | 'installedDescription' | 'missingAfterInstallError' | 'missingAfterInstallMessage'
  >
  newNodeResultVersion?: string
}): EnvCheckNodePostInstallRecheckState {
  const nodeInstallBehavior = options.nodeInstallBehavior || resolveNodeInstallPlatformBehavior()
  return {
    refreshStep: {
      status: 'checking',
      description: nodeInstallBehavior.refreshDescription,
      progress: 80,
    },
    recheckStep: {
      status: 'checking',
      description: nodeInstallBehavior.recheckDescription,
      progress: 85,
    },
    successStep: {
      status: 'ok',
      version: options.newNodeResultVersion,
      description: nodeInstallBehavior.installedDescription,
      progress: 90,
    },
    failureStep: {
      status: 'error',
      error: nodeInstallBehavior.missingAfterInstallError,
    },
    failureIssueKind: 'installer-failed',
    failureMessage: nodeInstallBehavior.missingAfterInstallMessage,
  }
}

export interface EnvCheckFinalizeState {
  gatewayStep: EnvCheckGatewayDeferredStepState
  progress: number
  isRunning: boolean
  readyPayload: EnvCheckReadyPayload
}

export function resolveEnvCheckFinalizeState(options: {
  gatewayBehavior?: EnvCheckGatewayBehavior
  hadOpenClawInstalled: boolean
  installedOpenClawDuringCheck: boolean
  sharedConfigInitialized: boolean
  discoveryResult: OpenClawDiscoveryResult | null
}): EnvCheckFinalizeState {
  const gatewayBehavior = options.gatewayBehavior || resolveGatewayBehavior()
  return {
    gatewayStep: resolveGatewayDeferredStepState(gatewayBehavior),
    progress: 100,
    isRunning: false,
    readyPayload: createEnvCheckReadyPayload({
      hadOpenClawInstalled: options.hadOpenClawInstalled,
      installedOpenClawDuringCheck: options.installedOpenClawDuringCheck,
      sharedConfigInitialized: options.sharedConfigInitialized,
      discoveryResult: options.discoveryResult,
    }),
  }
}

export function createEnvCheckRestartState(currentRunAttempt: number): EnvCheckRestartState {
  return {
    runAttempt: currentRunAttempt + 1,
    steps: createInitialSteps(),
    currentStep: 0,
    progress: 0,
    tipIndex: 0,
    fatalIssue: null,
    startupIssuePrompt: null,
  }
}

function TakeoverNotification({
  backupRootDirectory,
  failures,
  retryingCandidateId,
  onRetry,
}: {
  backupRootDirectory: string
  failures: OpenClawTakeoverFailure[]
  retryingCandidateId: string | null
  onRetry: (candidateId: string) => void
}) {
  useEffect(() => {
    const id = 'takeover-notice'
    notifications.show({
      id,
      title: '检测到已有 OpenClaw',
      message: `Mclaw 将额外备份配置数据，继续使用原有 OpenClaw。备份目录：${backupRootDirectory}`,
      color: 'brand',
      autoClose: 8000,
    })
    return () => { notifications.hide(id) }
  }, [backupRootDirectory])

  useEffect(() => {
    for (const failure of failures) {
      notifications.show({
        id: `takeover-fail-${failure.candidateId}`,
        title: '备份失败',
        message: formatTakeoverFailureManualBackupWarning(failure),
        color: 'red',
        autoClose: false,
      })
    }
  }, [failures])

  return null
}

function StartupIssueDialog({
  issue,
  supportActions,
  onClose,
  onRestart,
  platform,
}: {
  issue: NodeInstallerIssue
  supportActions: EnvCheckSupportAction[]
  onClose: () => void
  onRestart: () => void
  platform: string
}) {
  const showXcodeInstallHint = isMacPlatform(platform) && issue.kind === 'xcode-clt-pending'
  const restartLabel = showXcodeInstallHint ? '重试识别' : '重新执行准备流程'
  const restartColor = showXcodeInstallHint ? 'brand' : 'red'

  return (
    <Modal
      opened
      onClose={onClose}
      title={issue.title}
      size="md"
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <div className="space-y-4">
        <Text size="sm">{issue.message}</Text>
        {showXcodeInstallHint && (
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: 'var(--app-bg-inset)',
              border: '1px solid var(--app-border)',
            }}
          >
            <div className="flex items-end justify-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="h-20 w-20 rounded-3xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(180deg, #d9d9db 0%, #c5c5c7 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
                  }}
                >
                  <BrandWordmark size="body" />
                </div>
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--app-text-primary)' }} />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="relative h-20 w-20 rounded-3xl flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(73,210,255,0.95) 0%, rgba(42,145,255,0.95) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                  }}
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 4V14.5"
                      stroke="#f5fbff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M7.5 11.5L12 16L16.5 11.5"
                      stroke="#f5fbff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 19.5H18"
                      stroke="#f5fbff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--app-text-primary)' }} />
              </div>
            </div>
          </div>
        )}
        {!showXcodeInstallHint && issue.details && (
          <div
            className="rounded-lg p-3 text-xs whitespace-pre-wrap"
            style={{
              backgroundColor: 'var(--app-bg-inset)',
              border: '1px solid var(--app-border)',
              color: 'var(--app-text-secondary)',
            }}
          >
            {issue.details}
          </div>
        )}
        <div className="flex flex-wrap gap-2 justify-end">
          {supportActions.map((action) => (
            <Button
              key={`${action.kind}:${action.href}`}
              component="a"
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              color="brand"
            >
              {action.label}
            </Button>
          ))}
          <Button variant="default" onClick={onClose}>
            我知道了
          </Button>
          <Button color={restartColor} onClick={onRestart}>
            {restartLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function EnvCheck({
  onReady,
  pluginRepairRunning = false,
  pluginRepairResult = null,
  onRepairPlugins,
  onEnsurePluginRepairReady,
}: {
  onReady: (payload: EnvCheckReadyPayload) => void
  pluginRepairRunning?: boolean
  pluginRepairResult?: PluginRepairResult | null
  onRepairPlugins?: () => Promise<PluginRepairResult | null>
  onEnsurePluginRepairReady?: () => Promise<PluginRepairResult | null>
}) {
  const envCheckTiming = UI_RUNTIME_DEFAULTS.envCheck
  const loadingTips = ENV_CHECK_UI_POLICY.loadingTips
  const [steps, setSteps] = useState<Step[]>(() => createInitialSteps())
  const [currentStep, setCurrentStep] = useState(0)
  const [fatalIssue, setFatalIssue] = useState<FatalIssueState | null>(null)
  const [tipIndex, setTipIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [runAttempt, setRunAttempt] = useState(0)
  const [startupIssuePrompt, setStartupIssuePrompt] = useState<NodeInstallerIssue | null>(null)
  const [latestNodeVersion, setLatestNodeVersion] = useState('')
  const [nodeRequiredVersion, setNodeRequiredVersion] = useState(MIN_NODE_VERSION)
  const [nodeInstallStrategy, setNodeInstallStrategy] = useState<'nvm' | 'installer'>('installer')
  const [openClawGateState, setOpenClawGateState] = useState<OpenClawVersionGateState | null>(null)
  const [isRefreshingOpenClawVersion, setIsRefreshingOpenClawVersion] = useState(false)
  const [isUpgradingOpenClaw, setIsUpgradingOpenClaw] = useState(false)
  const [openClawUpgradeError, setOpenClawUpgradeError] = useState('')
  const [readyPayload, setReadyPayload] = useState<EnvCheckReadyPayload | null>(null)
  const [takeoverSummary, setTakeoverSummary] = useState<OpenClawTakeoverSummary | null>(null)
  const [retryingTakeoverCandidateId, setRetryingTakeoverCandidateId] = useState<string | null>(null)
  const [acknowledgingManualBackup, setAcknowledgingManualBackup] = useState(false)
  const [historyOnlyRecoveryFailure, setHistoryOnlyRecoveryFailure] =
    useState<HistoryOnlyRecoveryFailureState | null>(null)
  const [historyOnlyRecoveryConfirmOpened, setHistoryOnlyRecoveryConfirmOpened] = useState(false)

  const updateStep = (id: string, update: Partial<Step>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s))
  }

  const activeTakeoverFailureCandidateId = openClawGateState?.activeCandidate?.candidateId || ''
  const activeTakeoverFailure = resolveActiveTakeoverFailure(
    takeoverSummary,
    activeTakeoverFailureCandidateId
  )
  const activeTakeoverBackupBlocked = Boolean(activeTakeoverFailure)
  const pluginRepairErrorSummary =
    pluginRepairResult && !pluginRepairResult.ok
      ? String(pluginRepairResult.summary || '').trim()
      : ''
  const openClawSourceBadge = resolveOpenClawSourceBadgeState(openClawGateState?.activeCandidate)
  const openClawDeliveryNotice = resolveOpenClawDeliveryNoticeState(openClawGateState?.discovery)
  const [pluginRepairNoticeVisible, setPluginRepairNoticeVisible] = useState(Boolean(pluginRepairResult?.repaired))
  const [pluginRepairErrorVisible, setPluginRepairErrorVisible] = useState(Boolean(pluginRepairErrorSummary))
  const currentPlatform = window.api.platform
  const platformState = resolveEnvCheckPlatformState(currentPlatform)
  const nodeInstallPlatformBehavior = resolveNodeInstallPlatformBehavior(currentPlatform)
  const openClawInstallBehavior = resolveOpenClawInstallBehavior()
  const gatewayBehavior = resolveGatewayBehavior()

  useEffect(() => {
    setPluginRepairNoticeVisible(Boolean(pluginRepairResult?.repaired))
    setPluginRepairErrorVisible(Boolean(pluginRepairErrorSummary))
  }, [pluginRepairResult, pluginRepairErrorSummary])

  const resetEnvCheck = (nextRunAttempt = runAttempt) => {
    const restartState = createEnvCheckRestartState(nextRunAttempt)
    setFatalIssue(restartState.fatalIssue)
    setStartupIssuePrompt(restartState.startupIssuePrompt)
    setSteps(restartState.steps)
    setCurrentStep(restartState.currentStep)
    setProgress(restartState.progress)
    setTipIndex(restartState.tipIndex)
    setLatestNodeVersion('')
    setNodeRequiredVersion(MIN_NODE_VERSION)
    setNodeInstallStrategy('installer')
    setOpenClawGateState(null)
    setIsRefreshingOpenClawVersion(false)
    setIsUpgradingOpenClaw(false)
    setOpenClawUpgradeError('')
    setReadyPayload(null)
    setTakeoverSummary(null)
    setRetryingTakeoverCandidateId(null)
    setAcknowledgingManualBackup(false)
    setHistoryOnlyRecoveryFailure(null)
    setHistoryOnlyRecoveryConfirmOpened(false)
    setRunAttempt(restartState.runAttempt)
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex(prev => (prev + 1) % loadingTips.length)
    }, envCheckTiming.loadingTipRotateMs)
    return () => clearInterval(timer)
  }, [envCheckTiming.loadingTipRotateMs, loadingTips.length])

  useEffect(() => {
    const targetProgress = ((currentStep + 1) / steps.length) * 100
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= targetProgress) return prev
        return Math.min(prev + envCheckTiming.progressStep, targetProgress)
      })
    }, envCheckTiming.progressTickMs)
    return () => clearInterval(timer)
  }, [currentStep, envCheckTiming.progressStep, envCheckTiming.progressTickMs, steps.length])

  useEffect(() => {
    // 使用 setTimeout(..., 0) 延迟启动，防止 StrictMode 双重执行
    // 第一次假挂载会在卸载前被清理掉，只有真实挂载会执行
    const timeoutId = setTimeout(() => runChecks(), envCheckTiming.startupDelayMs)
    return () => clearTimeout(timeoutId)
  }, [envCheckTiming.startupDelayMs, runAttempt])

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const showStartupIssue = (issue: NodeInstallerIssue) => {
    setStartupIssuePrompt(issue)
  }

  const closeStartupIssue = () => {
    setStartupIssuePrompt(null)
  }

  const showFatalIssue = (issue: Pick<NodeInstallerIssue, 'kind' | 'message'>) => {
    setFatalIssue({ message: issue.message, issueKind: issue.kind })
  }

  const showFatalMessage = (message: string, issueKind?: NodeInstallerIssueKind) => {
    setFatalIssue({ message, issueKind })
  }

  const handleRestartEnvCheck = () => {
    closeStartupIssue()
    resetEnvCheck(runAttempt)
  }

  const inspectExistingOpenClaw = async (
    progress: number,
    options: { manualRefresh?: boolean } = {}
  ): Promise<OpenClawVersionGateState | null> => {
    setIsRefreshingOpenClawVersion(true)
    setOpenClawUpgradeError('')
    updateStep('openclaw', {
      status: 'checking',
      description: options.manualRefresh ? '正在刷新 OpenClaw 版本信息...' : '正在识别已有 OpenClaw 安装...',
      progress,
    })

    const discovery = await window.api.discoverOpenClaw().catch(() => null)
    const activeCandidate = resolveActiveOpenClawCandidate(discovery)
    if (!activeCandidate) {
      setIsRefreshingOpenClawVersion(false)
      setOpenClawGateState(null)
      setTakeoverSummary(null)
      return null
    }

    const upgradeCheck = await window.api.checkOpenClawUpgrade()
    const gateState = buildOpenClawGateState(discovery, upgradeCheck)
    let nextDiscovery = gateState.discovery
    const takeoverNoticeCandidates = (gateState.discovery?.candidates || []).filter((candidate) =>
      shouldShowTakeoverNotice(candidate)
    )
    const takeoverCandidates = (gateState.discovery?.candidates || []).filter((candidate) =>
      shouldEnsureBaselineBackup(candidate)
    )
    const takeoverFailures: OpenClawTakeoverFailure[] = []

    if (takeoverCandidates.length > 0 && nextDiscovery) {
      updateStep('openclaw', {
        status: 'checking',
        description: `正在为 ${takeoverCandidates.length} 个 OpenClaw 安装执行接管备份...`,
        progress,
      })

      for (const candidate of takeoverCandidates) {
        const backupResult = await window.api.ensureOpenClawBaselineBackup(candidate)
        if (backupResult.ok && backupResult.backup) {
          nextDiscovery = applyBaselineBackupToCandidate(
            nextDiscovery,
            candidate.candidateId,
            backupResult.backup
          )
          continue
        }

        takeoverFailures.push(
          buildTakeoverFailure(
            candidate,
            backupResult.message,
            backupResult.manualBackupAction
          )
        )
      }
    }

    const nextGateState = {
      ...gateState,
      discovery: nextDiscovery,
      activeCandidate: resolveActiveOpenClawCandidate(nextDiscovery),
    }

    const takeoverBackupRootDirectory =
      nextGateState.discovery && takeoverNoticeCandidates.length > 0
        ? await resolveTakeoverBackupRootDirectory(nextGateState.discovery, () => window.api.getOpenClawBackupRoot())
        : nextGateState.discovery?.defaultBackupDirectory || ''
    const nextTakeoverSummary =
      nextGateState.discovery
        ? {
            detected: takeoverNoticeCandidates.length > 0,
            backupRootDirectory: takeoverBackupRootDirectory,
            failures: takeoverFailures,
          }
        : null

    setTakeoverSummary(nextTakeoverSummary)

    const activeTakeoverFailure = resolveActiveTakeoverFailure(
      nextTakeoverSummary,
      nextGateState.activeCandidate?.candidateId || ''
    )

    if (nextGateState.canAutoCorrect && !activeTakeoverFailure) {
      const acceptedAutoCorrection = window.confirm(
        buildOpenClawAutoCorrectionConsentMessage(nextGateState)
      )
      if (!acceptedAutoCorrection) {
        setOpenClawGateState(nextGateState)
        setIsRefreshingOpenClawVersion(false)
        updateStep('openclaw', {
          status: 'pending-install',
          version: nextGateState.activeCandidate?.version || activeCandidate.version,
          description: '你未接受 OpenClaw 自动版本处理，Mclaw 即将退出。',
          progress: 100,
        })
        void window.api.quitApp().catch(() => null)
        return nextGateState
      }

      updateStep('openclaw', {
        status: 'installing',
        description: nextGateState.message,
        progress: Math.min(100, progress + 2),
      })

      const correctionResult = await window.api.runOpenClawUpgrade()
      if (!correctionResult.ok) {
        const failureMessage = correctionResult.message || 'OpenClaw 版本自动纠偏失败'
        setOpenClawUpgradeError(failureMessage)
        setOpenClawGateState(nextGateState)
        setIsRefreshingOpenClawVersion(false)
        updateStep('openclaw', {
          status: 'pending-install',
          version: nextGateState.activeCandidate?.version || activeCandidate.version,
          description: failureMessage,
          progress: 100,
        })
        return nextGateState
      }

      await window.api.refreshEnvironment().catch(() => null)
      return inspectExistingOpenClaw(progress, { manualRefresh: true })
    }

    setOpenClawGateState(nextGateState)
    setIsRefreshingOpenClawVersion(false)
    updateStep('openclaw', {
      status: nextGateState.blocksContinue ? 'pending-install' : 'ok',
      version: nextGateState.activeCandidate?.version || activeCandidate.version,
      description: nextGateState.message,
      progress: 100,
    })
    return nextGateState
  }

  const handleContinue = () => {
    if (!readyPayload) return
    onReady({
      ...readyPayload,
      discoveryResult: openClawGateState?.discovery || readyPayload.discoveryResult || null,
    })
  }

  const handleOpenClawRefresh = async () => {
    if (isRunning || isRefreshingOpenClawVersion || isUpgradingOpenClaw || acknowledgingManualBackup) return
    await inspectExistingOpenClaw(95, { manualRefresh: true })
  }

  const handleRetryTakeoverBackup = async (candidateId: string) => {
    if (isRunning || isRefreshingOpenClawVersion || isUpgradingOpenClaw || acknowledgingManualBackup) return
    if (!openClawGateState?.discovery) return

    const candidate =
      openClawGateState.discovery.candidates.find((item) => item.candidateId === candidateId) || null
    if (!candidate) return

    setRetryingTakeoverCandidateId(candidateId)
    try {
      const backupResult = await window.api.ensureOpenClawBaselineBackup(candidate)
      if (backupResult.ok && backupResult.backup) {
        const ensuredBackup = backupResult.backup
        setOpenClawGateState((current) => {
          if (!current?.discovery) return current
          const nextDiscovery = applyBaselineBackupToCandidate(
            current.discovery,
            candidateId,
            ensuredBackup
          )
          return {
            ...current,
            discovery: nextDiscovery,
            activeCandidate: resolveActiveOpenClawCandidate(nextDiscovery),
          }
        })
        setTakeoverSummary((current) => {
          if (!current) return current
          return clearTakeoverFailure(current, candidateId)
        })
        notifications.hide(`takeover-fail-${candidateId}`)
        return
      }

      setTakeoverSummary((current) => {
        if (!current) return current
        const nextFailure = buildTakeoverFailure(
          candidate,
          backupResult.message,
          backupResult.manualBackupAction
        )
        return {
          ...current,
          failures: current.failures.map((item) =>
            item.candidateId === candidateId ? nextFailure : item
          ),
        }
      })
    } finally {
      setRetryingTakeoverCandidateId(null)
    }
  }

  const handleAcknowledgeManualBackup = async () => {
    if (isRunning || isRefreshingOpenClawVersion || isUpgradingOpenClaw || acknowledgingManualBackup) return
    const activeCandidate = openClawGateState?.activeCandidate
    if (!activeCandidate || !activeTakeoverFailure) return

    setAcknowledgingManualBackup(true)
    try {
      const skipResult = await window.api.skipOpenClawBaselineBackup(activeCandidate)
      if (!skipResult.ok || !skipResult.bypass) {
        throw new Error(skipResult.message || '记录手动备份确认失败')
      }

      setOpenClawGateState((current) => {
        if (!current) return current
        const nextDiscovery = applyBaselineBackupBypassToDiscovery(current.discovery, skipResult.bypass)
        return {
          ...current,
          discovery: nextDiscovery,
          activeCandidate: resolveActiveOpenClawCandidate(nextDiscovery) || current.activeCandidate,
        }
      })
      setTakeoverSummary((current) => clearTakeoverFailure(current, activeCandidate.candidateId))
      notifications.hide(`takeover-fail-${activeCandidate.candidateId}`)
      notifications.show({
        title: '已记录手动备份确认',
        message: '你可以继续进入控制面板，后续数据治理会保留这条手动备份提醒。',
        color: 'brand',
        autoClose: 5000,
      })
    } catch (error) {
      notifications.show({
        title: '继续接管失败',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
        autoClose: 6000,
      })
    } finally {
      setAcknowledgingManualBackup(false)
    }
  }

  const handleConfirmHistoryOnlyManualBackup = async () => {
    if (isRunning || isRefreshingOpenClawVersion || isUpgradingOpenClaw || acknowledgingManualBackup) return
    if (!historyOnlyRecoveryFailure) return

    setAcknowledgingManualBackup(true)
    try {
      const skipResult = await window.api.skipOpenClawBaselineBackup(historyOnlyRecoveryFailure.candidate)
      if (!skipResult.ok || !skipResult.bypass) {
        throw new Error(skipResult.message || '记录手动备份确认失败')
      }

      setHistoryOnlyRecoveryConfirmOpened(false)
      notifications.show({
        title: '已记录手动备份确认',
        message: '将重新执行环境检查，并继续恢复历史 OpenClaw 运行环境。',
        color: 'brand',
        autoClose: 5000,
      })
      resetEnvCheck(runAttempt)
    } catch (error) {
      notifications.show({
        title: '继续恢复失败',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
        autoClose: 6000,
      })
    } finally {
      setAcknowledgingManualBackup(false)
    }
  }

  const handleOpenClawUpgrade = async () => {
    if (isRunning || isRefreshingOpenClawVersion || isUpgradingOpenClaw || activeTakeoverBackupBlocked) return
    setIsUpgradingOpenClaw(true)
    setOpenClawUpgradeError('')
    updateStep('openclaw', { status: 'installing', description: '正在升级 OpenClaw 运行环境...', progress: 92 })

    try {
      const upgradeResult = await window.api.runOpenClawUpgrade()
      if (!upgradeResult.ok) {
        throw new Error(upgradeResult.message || 'OpenClaw 升级失败')
      }

      await window.api.refreshEnvironment()
      resetEnvCheck(runAttempt)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setOpenClawUpgradeError(message)
      updateStep('openclaw', {
        status: openClawGateState?.blocksContinue ? 'pending-install' : 'ok',
        description: openClawGateState?.message || 'OpenClaw 升级失败，请稍后重试',
        error: '',
      })
      setIsUpgradingOpenClaw(false)
      return
    }

    setIsUpgradingOpenClaw(false)
  }

  const recoverHistoryOnlyOpenClaw = async (progress: number): Promise<HistoryOnlyRecoveryResult | null> => {
    updateStep('openclaw', {
      status: 'checking',
      description: '正在重新识别历史 OpenClaw 数据...',
      progress,
    })

    const recoveredDiscovery = await window.api.discoverOpenClaw().catch(() => null)
    const recoveredCandidate = resolveActiveOpenClawCandidate(recoveredDiscovery)
    if (!recoveredDiscovery || !recoveredCandidate) {
      showFatalMessage('历史 OpenClaw 运行环境补装后，仍无法识别可接管的安装。请重试或检查旧数据目录是否完整。')
      return null
    }

    updateStep('openclaw', {
      status: 'checking',
      description: '正在备份历史 OpenClaw 数据...',
      progress: Math.min(100, progress + 3),
    })

    const backupResult = await window.api.ensureOpenClawBaselineBackup(recoveredCandidate)
    if (!canContinueHistoryOnlyRecovery(recoveredCandidate, backupResult)) {
      const failure = buildTakeoverFailure(
        recoveredCandidate,
        backupResult.message,
        backupResult.manualBackupAction
      )
      const warning = backupResult.manualBackupAction
        ? buildManualBackupWarning(backupResult.manualBackupAction)
        : backupResult.message || '历史 OpenClaw 数据备份失败，请稍后重试。'
      setHistoryOnlyRecoveryFailure({
        candidate: recoveredCandidate,
        failure,
      })
      showFatalMessage(`历史数据恢复前备份失败。${warning}`)
      return null
    }

    setHistoryOnlyRecoveryFailure(null)
    await window.api.markManagedOpenClawInstall(recoveredCandidate.installFingerprint)
    const managedDiscovery = await window.api.discoverOpenClaw().catch(() => recoveredDiscovery)
    const managedCandidate = resolveActiveOpenClawCandidate(managedDiscovery) || recoveredCandidate

    const takeoverBackupRootDirectory = await resolveTakeoverBackupRootDirectory(
      managedDiscovery,
      () => window.api.getOpenClawBackupRoot()
    )

    setTakeoverSummary({
      detected: true,
      backupRootDirectory: takeoverBackupRootDirectory,
      failures: [],
    })

    updateStep('openclaw', {
      status: 'ok',
      version: managedCandidate.version,
      description: '已恢复历史 OpenClaw 运行环境并完成备份接管',
      progress: 100,
    })
    setCurrentStep(2)

    return {
      discovery: managedDiscovery,
      activeCandidate: managedCandidate,
    }
  }

  // 取消当前操作
  const handleCancel = async () => {
    if (isRunning) {
      const cancelResult = await window.api.cancelCommandDetailed()
      const canceled = cancelResult.canceledDomains.length > 0
      const canceledSummary = formatCancelDomainSummary(cancelResult.canceledDomains)
      const failedSummary = formatCancelDomainSummary(cancelResult.failedDomains)
      if (cancelResult.failedDomains.length > 0) {
        showFatalMessage(`操作已取消。已停止域：${canceledSummary}；停止失败域：${failedSummary}`)
        return
      }

      if (canceled) {
        // 标记当前步骤为已取消
        setSteps(prev => prev.map(s => s.id === steps[currentStep]?.id ? { ...s, status: 'canceled' } : s))
      }
      setIsRunning(false)

      if (canceled) {
        showFatalMessage(`操作已取消。已停止域：${canceledSummary}`)
        return
      }

      showFatalMessage('当前没有可取消的运行任务。')
    }
  }

  // 手动升级 Node.js
  const handleNodeUpgrade = async () => {
    setIsRunning(true)
    updateStep('node', { status: 'installing', description: '正在准备升级...', progress: 0 })

    try {
      // 1. 获取安装计划（会自动选官方最新稳定版）
      const plan = await window.api.resolveNodeInstallPlan()
      const shouldUseNvmInstall = nodeInstallStrategy === 'nvm'
      setLatestNodeVersion(plan.version)

      let installerPath: string | undefined
      if (shouldUseNvmInstall) {
        updateStep('node', { description: `正在通过 nvm 准备 Node.js ${plan.version}...`, progress: 15 })
      } else {
        // 2. 下载安装包
        updateStep('node', { description: `正在下载 Node.js ${plan.version}...`, progress: 10 })
        const downloadResult = await window.api.downloadNodeInstaller(plan)

        if (!downloadResult.ok) {
          throw new Error(downloadResult.error || '下载失败')
        }

        installerPath = downloadResult.path

        // 3. 平台专属安装包校验（当前仅 macOS 需要）
        if (nodeInstallPlatformBehavior.shouldInspectNodeInstaller) {
          updateStep('node', { description: '正在校验安装包...', progress: 40 })
          const inspection = await window.api.inspectNodeInstaller(installerPath)
          if (!inspection.ok && inspection.issue) {
            throw new Error(inspection.issue.message || '安装包校验失败')
          }
        }
      }

      // 4. 执行安装
      updateStep('node', { description: shouldUseNvmInstall ? '正在通过 nvm 安装 Node.js...' : '正在安装 Node.js...', progress: 50 })
      const installResult = await window.api.installEnv({
        needNode: true,
        needOpenClaw: false,
        nodeInstallerPath: installerPath,
        nodeInstallPlan: plan,
      })

      if (!installResult.ok) {
        throw new Error(installResult.stderr || '安装失败')
      }

      // 5. 刷新环境变量
      updateStep('node', {
        description: nodeInstallPlatformBehavior.refreshDescription,
        progress: 80,
      })
      await window.api.refreshEnvironment()

      // 6. 重新检测
      updateStep('node', {
        description: nodeInstallPlatformBehavior.recheckDescription,
        progress: 90,
      })
      const recheckResult = await window.api.checkNode()
      const requiredNodeVersion = recheckResult.requiredVersion || nodeRequiredVersion

      if (recheckResult.installed && isNodeVersionAtLeast(recheckResult.version, requiredNodeVersion)) {
        setLatestNodeVersion(recheckResult.targetVersion || plan.version)
        setNodeRequiredVersion(requiredNodeVersion)
        setIsRunning(false)
        resetEnvCheck(runAttempt)
      } else {
        throw new Error(`升级后版本仍未满足要求（当前: ${recheckResult.version}，要求: >= ${requiredNodeVersion}）`)
      }
    } catch (error) {
      updateStep('node', {
        status: 'pending-install',
        error: `升级失败: ${error instanceof Error ? error.message : String(error)}`
      })
      setIsRunning(false)
    }
  }

  // 清理函数 - 组件卸载时取消正在运行的命令
  useEffect(() => {
    return () => {
      // 直接调用 API 取消命令，不依赖组件状态
      window.api?.cancelCommands(['env-setup', 'upgrade', 'gateway', 'env']).then(() => {
        setIsRunning(false)
      })
    }
  }, [])

  const runChecks = async () => {
    // 双重检查：防止并发执行
    if (isRunning) {
      return
    }
    if (!window.api) {
      setFatalIssue({ message: '桌面运行环境初始化失败（window.api 不可用），请重启应用重试。' })
      return
    }
    setIsRunning(true)
    setFatalIssue(null)
    setStartupIssuePrompt(null)
    setLatestNodeVersion('')
    setOpenClawGateState(null)
    setOpenClawUpgradeError('')
    setReadyPayload(null)
    setTakeoverSummary(null)
    setRetryingTakeoverCandidateId(null)
    setAcknowledgingManualBackup(false)
    setHistoryOnlyRecoveryFailure(null)
    setHistoryOnlyRecoveryConfirmOpened(false)
    setIsRefreshingOpenClawVersion(false)
    setIsUpgradingOpenClaw(false)

    try {
      kickoffStartupPluginRepair(onEnsurePluginRepairReady)
      if (nodeInstallPlatformBehavior.shouldPrepareMacDeveloperTools) {
        updateStep('node', {
          status: 'checking',
          description: '正在检查 Git 与 Xcode Command Line Tools...',
          progress: 5,
        })
        await delay(envCheckTiming.transitionShortMs)
        const macGitToolsResult = await window.api.prepareMacGitTools()
        if (!macGitToolsResult.ok) {
          const issue = classifyMacGitToolsIssue(macGitToolsResult)
          updateStep('node', issue.kind === 'xcode-clt-pending'
            ? {
                status: 'pending-install',
                description: '请先完成 Xcode Command Line Tools 安装，再点击“重试识别”刷新状态',
                progress: 5,
                error: undefined,
              }
            : {
                status: 'error',
                description: issue.message,
                error: issue.title,
                progress: 5,
              })
          showStartupIssue(issue)
          setIsRunning(false)
          return
        }
      }

    // 第一步：检测 Node.js
    updateStep('node', { status: 'checking', description: '正在检查 Node.js...', progress: 10 })
    await delay(envCheckTiming.transitionStandardMs)
    const nodeResult = await window.api.checkNode()
    const nodeCheckState = resolveEnvCheckNodeCheckState(nodeResult, MIN_NODE_VERSION)
    const requiredNodeVersion = nodeCheckState.requiredVersion
    setNodeRequiredVersion(requiredNodeVersion)
    setNodeInstallStrategy(nodeResult.installStrategy)
    const nodeNeedsUpgrade = nodeCheckState.nodeNeedsUpgrade
    const needNode = nodeCheckState.needNode
    let nodeInstallPlan = null
    if (needNode) {
      try {
        nodeInstallPlan = await window.api.resolveNodeInstallPlan()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        updateStep('node', { status: 'error', error: '无法获取最新版本' })
        showFatalMessage(`无法获取最新 Node.js 稳定版安装信息，请检查网络后重试。${message ? ` 原始错误：${message}` : ''}`, 'download-failed')
        setIsRunning(false)
        return
      }
    }
    const targetNodeVersion = nodeInstallPlan?.version || nodeCheckState.targetVersion

    // 显示检测结果（无论是否安装，都先显示检测结果）
    const nodeStepState = resolveEnvCheckNodeStepState({
      nodeResult,
      nodeCheckState: {
        ...nodeCheckState,
        targetVersion: targetNodeVersion,
      },
      nodeInstallBehavior: nodeInstallPlatformBehavior,
    })
    setLatestNodeVersion(nodeStepState.latestNodeVersion)
    updateStep('node', {
      status: nodeStepState.status,
      version: nodeStepState.version,
      description: nodeStepState.description,
      progress: nodeStepState.progress,
    })
    if (nodeStepState.blocksContinue) {
      setIsRunning(false)
      return
    }
    if (nodeStepState.status === 'ok') {
      setCurrentStep(1)
    }

    // 第二步：检测 OpenClaw 运行环境
    updateStep('openclaw', { status: 'checking', description: '正在检查 OpenClaw 运行环境...', progress: needNode ? 25 : 20 })
    await delay(envCheckTiming.transitionShortMs)
    const openclawResult = await window.api.checkOpenClaw()
    const initialDiscovery = await window.api.discoverOpenClaw().catch(() => null)
    const installDecision = resolveOpenClawInstallDecision({
      discovery: initialDiscovery,
      cliInstalled: openclawResult.installed,
    })
    const hadOpenClawInstalled = installDecision.hadOpenClawInstalled
    const needOpenClawInstall = installDecision.shouldFreshInstall
    const needOpenClawRuntimeRecovery = installDecision.requiresRecovery
    const shouldInstallOpenClawRuntime = needOpenClawInstall || needOpenClawRuntimeRecovery
    const installProgressStepId = resolveEnvInstallProgressStep({
      needNode,
      shouldInstallOpenClawRuntime,
    })
    const readSharedConfigInitialized = async () => {
      try {
        const config = await window.api.readConfig()
        return hasInitializedOpenClawConfig(config)
      } catch {
        return false
      }
    }

    // 显示检测结果
    if (installDecision.requiresRecovery) {
      updateStep('openclaw', {
        status: 'pending-install',
        description: '检测到历史 OpenClaw 数据，待恢复运行环境',
        progress: needNode ? 30 : 25,
      })
    } else if (needOpenClawInstall) {
      updateStep('openclaw', {
        status: 'pending-install',
        description: '未检测到可用 OpenClaw 运行环境，将优先释放内置本体，必要时再回退公共下载源',
        progress: needNode ? 30 : 25,
      })
    } else {
      updateStep('openclaw', {
        status: 'ok',
        version: openclawResult.version,
        description: openClawInstallBehavior.installedDescription,
        progress: 100,
      })
      setCurrentStep(2)
    }

    // 如果都已安装，直接记录 Gateway 会在后续配置完成后再确认
    if (!needNode && !shouldInstallOpenClawRuntime) {
      const gateState = await inspectExistingOpenClaw(55)
      await delay(envCheckTiming.transitionStandardMs)
      updateStep('gateway', {
        status: 'checking',
        description: gatewayBehavior.deferredCheckingDescription,
        progress: 0,
      })
      await delay(envCheckTiming.transitionStandardMs)
      const sharedConfigInitialized = await readSharedConfigInitialized()
      const finalizeState = resolveEnvCheckFinalizeState({
        gatewayBehavior,
        hadOpenClawInstalled,
        installedOpenClawDuringCheck: false,
        sharedConfigInitialized,
        discoveryResult: gateState?.discovery || initialDiscovery || null,
      })
      updateStep('gateway', finalizeState.gatewayStep)
      setProgress(finalizeState.progress)
      await delay(envCheckTiming.transitionSettleMs)
      setIsRunning(finalizeState.isRunning)
      setReadyPayload(finalizeState.readyPayload)
      return
    }

    // 需要安装，准备安装参数
    let nodeInstallerPath: string | undefined
    const nodeInstallPrepState = resolveEnvCheckNodeInstallPrepState({
      needNode,
      installStrategy: nodeResult.installStrategy,
      targetNodeVersion,
    })
    const shouldDownloadNodeInstaller = nodeInstallPrepState?.shouldDownloadInstaller || false

    if (nodeInstallPrepState) {
      if (shouldDownloadNodeInstaller) {
        updateStep('node', nodeInstallPrepState)
        const downloadResult = await window.api.downloadNodeInstaller(nodeInstallPlan || undefined)
        if (!downloadResult.ok) {
          const issue = classifyNodeInstallerDownloadFailure(downloadResult.error || '')
          updateStep('node', { status: 'error', error: '下载失败' })
          showFatalIssue(issue)
          showStartupIssue(issue)
          setIsRunning(false)
          return
        }
        nodeInstallerPath = downloadResult.path

        if (nodeInstallPlatformBehavior.shouldInspectNodeInstaller) {
          const readiness = await window.api.inspectNodeInstaller(nodeInstallerPath)
          if (!readiness.ok && readiness.issue) {
            updateStep('node', { status: 'error', error: readiness.issue.title })
            showFatalIssue(readiness.issue)
            showStartupIssue(readiness.issue)
            setIsRunning(false)
            return
          }
        }

        updateStep('node', { status: 'installing', description: '等待安装...', progress: 45 })
      } else {
        updateStep('node', nodeInstallPrepState)
      }
    }

    if (shouldInstallOpenClawRuntime) {
      updateStep('openclaw', {
        status: 'installing',
        description: needOpenClawRuntimeRecovery ? '正在恢复 OpenClaw 运行环境...' : '等待安装...',
        progress: needNode ? 55 : 45,
      })
    }

    // 一次性安装所有需要的组件（只弹一次权限弹窗）
    if (installProgressStepId === 'node') {
      updateStep('node', { status: 'installing', description: '正在安装组件...', progress: 60 })
    } else if (installProgressStepId === 'openclaw') {
      updateStep('openclaw', {
        status: 'installing',
        description: needOpenClawRuntimeRecovery ? '正在恢复 OpenClaw 运行环境...' : '正在准备 OpenClaw 运行环境...',
        progress: 60,
      })
    }

    const installResult = await window.api.installEnv({
      needNode,
      needOpenClaw: shouldInstallOpenClawRuntime,
      nodeInstallerPath,
      nodeInstallPlan: nodeInstallPlan || undefined,
    })

    if (!installResult.ok) {
      const errDetail = installResult.stderr || installResult.stdout || '未知错误'
      if (needNode) {
        const issue = nodeInstallPlatformBehavior.classifyInstallerFailure(errDetail)
        updateStep('node', { status: 'error', error: '安装失败' })
        showFatalIssue(issue)
        showStartupIssue(issue)
      }
      if (shouldInstallOpenClawRuntime) {
        updateStep('openclaw', { status: 'error', error: '安装失败' })
      }
      if (!needNode) {
        showFatalMessage(buildOpenClawInstallFailureGuidance(installResult))
      }
      setIsRunning(false)
      return
    }

    if (installProgressStepId === 'node') {
      updateStep('node', {
        status: 'installing',
        description: nodeInstallPlatformBehavior.installCompletedDescription,
        progress: 75,
      })
    }

    // 重新检测
    if (needNode) {
      const nodePostInstallRecheckState = resolveEnvCheckNodePostInstallRecheckState({
        nodeInstallBehavior: nodeInstallPlatformBehavior,
      })
      // 先刷新环境变量，获取最新的 PATH
      updateStep('node', nodePostInstallRecheckState.refreshStep)
      await window.api.refreshEnvironment()
      await delay(envCheckTiming.transitionStandardMs)

      updateStep('node', nodePostInstallRecheckState.recheckStep)
      const newNodeResult = await window.api.checkNode()
      if (!newNodeResult.installed) {
        updateStep('node', nodePostInstallRecheckState.failureStep)
        showFatalMessage(
          nodePostInstallRecheckState.failureMessage,
          nodePostInstallRecheckState.failureIssueKind
        )
        setIsRunning(false)
        return
      }
      updateStep('node', {
        ...nodePostInstallRecheckState.successStep,
        version: newNodeResult.version,
      })
      setCurrentStep(1)
    }

    if (shouldInstallOpenClawRuntime) {
      updateStep('openclaw', {
        status: 'checking',
        description: openClawInstallBehavior.refreshDescription,
        progress: 85,
      })
      await window.api.refreshEnvironment()
      await delay(envCheckTiming.transitionStandardMs)

      updateStep('openclaw', {
        status: 'checking',
        description: openClawInstallBehavior.resolveRecheckDescription(needOpenClawRuntimeRecovery),
        progress: 90,
      })
      const newOpenclawResult = await window.api.checkOpenClaw()
      if (!newOpenclawResult.installed) {
        updateStep('openclaw', {
          status: 'error',
          error: openClawInstallBehavior.missingAfterInstallError,
        })
        showFatalMessage(openClawInstallBehavior.missingAfterInstallMessage.join('\n'))
        setIsRunning(false)
        return
      }
      updateStep('openclaw', {
        status: 'ok',
        version: newOpenclawResult.version,
        description: openClawInstallBehavior.installedDescription,
        progress: 95,
      })
      setCurrentStep(2)
    }

    let finalDiscoveryResult: OpenClawDiscoveryResult | null =
      shouldInstallOpenClawRuntime ? await window.api.discoverOpenClaw().catch(() => null) : initialDiscovery

    if (needOpenClawRuntimeRecovery) {
      const recoveryResult = await recoverHistoryOnlyOpenClaw(95)
      if (!recoveryResult) {
        setIsRunning(false)
        return
      }
      finalDiscoveryResult = recoveryResult.discovery
    }

    const finalGateState = await inspectExistingOpenClaw(95)
    finalDiscoveryResult = finalGateState?.discovery || finalDiscoveryResult

    await delay(envCheckTiming.transitionShortMs)

    // 第三步：记录 Gateway 会在后续配置完成后再确认
    updateStep('gateway', {
      status: 'checking',
      description: gatewayBehavior.deferredCheckingDescription,
      progress: 0,
    })
    await delay(envCheckTiming.transitionStandardMs)

    const sharedConfigInitialized = await readSharedConfigInitialized()
    const finalizeState = resolveEnvCheckFinalizeState({
      gatewayBehavior,
      hadOpenClawInstalled,
      installedOpenClawDuringCheck: shouldInstallOpenClawRuntime,
      sharedConfigInitialized,
      discoveryResult: finalDiscoveryResult,
    })
    updateStep('gateway', finalizeState.gatewayStep)

    setProgress(finalizeState.progress)
    await delay(envCheckTiming.transitionSettleMs)
    setIsRunning(finalizeState.isRunning)
    setReadyPayload(finalizeState.readyPayload)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      showFatalMessage(`环境检测过程中发生异常：${message}`)
      setIsRunning(false)
    }
  }

  const fatalSupportActions = getEnvCheckSupportActionsForIssueKind(fatalIssue?.issueKind)
  const startupSupportActions = getEnvCheckSupportActionsForIssueKind(startupIssuePrompt?.kind)
  const showInlineStartupIssue = shouldRenderStartupIssueInline(startupIssuePrompt, currentPlatform)
  const openClawMigrationSmoke = openClawGateState?.migrationSmoke || null
  const StatusIcon = ({ status }: { status: StepStatus }) => {
    switch (status) {
      case 'pending':
        return (
          <div className="w-8 h-8 rounded-full app-bg-tertiary flex items-center justify-center">
            <div className="w-2 h-2 rounded-full app-bg-tertiary" />
          </div>
        )
      case 'pending-install':
        return (
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--app-bg-inset)', border: '1px solid var(--app-border)' }}>
            <svg className="w-4 h-4 app-text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
        )
      case 'checking':
      case 'installing':
        return (
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--app-bg-inset)' }}>
            <Loader size={18} color="brand" />
          </div>
        )
      case 'ok':
        return (
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--mantine-color-brand-5)' }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--mantine-color-red-6)' }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      case 'canceled':
        return (
          <div className="w-8 h-8 rounded-full app-bg-tertiary flex items-center justify-center">
            <svg className="w-4 h-4 app-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-3">
        <div className="flex items-center justify-center mb-1">
          <BrandWordmark size="hero" />
        </div>
        <Text size="xs" c="dimmed" className="h-4 transition-opacity duration-500">
          {steps[currentStep]?.status === 'checking' || steps[currentStep]?.status === 'installing'
            ? steps[currentStep].description
            : loadingTips[tipIndex]}
        </Text>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Tooltip label={ENV_CHECK_TOOLTIPS.repairPluginEnvironment} withArrow>
            <Button
              size="compact-xs"
              variant="subtle"
              color="yellow"
              loading={pluginRepairRunning}
              onClick={() => { void onRepairPlugins?.() }}
            >
              修复坏插件环境
            </Button>
          </Tooltip>
        </div>
      </div>

      {pluginRepairResult?.repaired && pluginRepairNoticeVisible && (
        <Alert
          color="yellow"
          variant="light"
          mb="sm"
        title="已自动隔离异常插件"
          withCloseButton
          onClose={() => setPluginRepairNoticeVisible(false)}
        >
          <Text size="xs" className="leading-5">
            {pluginRepairResult.summary}
          </Text>
        </Alert>
      )}

      {pluginRepairErrorSummary && pluginRepairErrorVisible && (
        <Alert
          color="red"
          variant="light"
          mb="sm"
        title="插件环境修复失败"
          withCloseButton
          onClose={() => setPluginRepairErrorVisible(false)}
        >
          <Text size="xs" className="leading-5">
            {pluginRepairErrorSummary}
          </Text>
        </Alert>
      )}

      <div className="mb-5">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-bg-inset)' }}>
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%`, backgroundColor: 'var(--mantine-color-brand-5)' }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <Text size="xs" c="dimmed">准备中</Text>
          <Text size="xs" c="dimmed">{Math.round(progress)}%</Text>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {steps.map((step) => (
          <Tooltip
            key={step.id}
            label={ENV_CHECK_STEP_TOOLTIPS[step.id] || step.label}
            withArrow
            multiline
            maw={280}
          >
            <div
              className="flex items-center gap-3 p-3"
              style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'var(--app-border)',
                borderRadius: 'var(--mantine-radius-lg)',
                backgroundColor: 'var(--app-bg-input)',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                ...(step.status === 'checking' || step.status === 'installing'
                  ? { borderColor: 'var(--app-hover-border)', boxShadow: '0 0 8px var(--app-hover-glow)' }
                  : {}),
              }}
            >
              <StatusIcon status={step.status} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${
                  step.status === 'pending' ? 'app-text-muted' : 'app-text-primary'
                }`}>
                  {step.label}
                </div>
                <div className={`text-xs truncate ${
                  step.status === 'error' ? 'app-text-warning' :
                  step.status === 'ok' ? 'app-text-secondary' :
                  step.status === 'pending-install' ? 'app-text-warning' :
                  step.status === 'canceled' ? 'app-text-muted' :
                  step.status === 'checking' || step.status === 'installing' ? 'app-text-secondary' :
                  'app-text-muted'
                }`}>
                  {step.error || step.description}
                </div>
              </div>
              {step.version && step.status === 'ok' && (
                <div className="text-xs app-text-muted app-bg-tertiary px-2 py-1 rounded">
                  {step.version}
                </div>
              )}
              {step.id === 'openclaw' && step.version && step.status === 'pending-install' && (
                <div className="text-xs app-text-muted app-bg-tertiary px-2 py-1 rounded">
                  {step.version}
                </div>
              )}
              {step.id === 'node' && step.version && step.status === 'pending-install' && (
                <div className="text-xs app-text-muted app-bg-tertiary px-2 py-1 rounded">
                  {step.version}
                </div>
              )}
              {step.progress !== undefined && (step.status === 'installing' || step.status === 'checking') && (
                <div className="text-xs app-text-muted app-bg-tertiary px-2 py-1 rounded min-w-[3rem]">
                  {step.progress}%
                </div>
              )}
              {step.id === 'node' && step.version && step.status === 'pending-install' && shouldOfferManualNodeUpgrade(step.version, nodeRequiredVersion) && (
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  onClick={handleNodeUpgrade}
                  disabled={isRunning}
                >
                  手动升级
                </Button>
              )}
              {step.id === 'openclaw' && openClawGateState?.statusLabel && !isRunning && (
                <div className="text-xs app-text-muted">
                  {openClawGateState.statusLabel}
                </div>
              )}
              {step.id === 'openclaw' && openClawSourceBadge && !isRunning && (
                <Tooltip label={openClawSourceBadge.title} withArrow>
                  <div
                    className="text-[11px] px-2 py-1 rounded whitespace-nowrap"
                    style={{
                      color: 'var(--app-text-secondary)',
                      backgroundColor: 'var(--app-bg-tertiary)',
                      border: '1px solid var(--app-border)',
                    }}
                  >
                    {openClawSourceBadge.label}
                  </div>
                </Tooltip>
              )}
      {step.id === 'openclaw' && openClawGateState?.activeCandidate && !isRunning && (
                <>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => void handleOpenClawRefresh()}
                    disabled={isRefreshingOpenClawVersion || isUpgradingOpenClaw}
                    title="刷新 OpenClaw 版本"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                  </ActionIcon>
                  {canShowOpenClawUpgradeAction(openClawGateState, activeTakeoverBackupBlocked) && (
                    <Button
                      size="xs"
                      variant="light"
                      color="green"
                      onClick={() => void handleOpenClawUpgrade()}
                      disabled={isRefreshingOpenClawVersion || isUpgradingOpenClaw}
                      loading={isUpgradingOpenClaw}
                    >
                      {openClawGateState.canAutoCorrect ? '重试修正' : '一键升级'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </Tooltip>
        ))}
      </div>

      {openClawUpgradeError && (
        <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: 'var(--app-bg-inset)', border: '1px solid var(--mantine-color-red-5)' }}>
          {openClawSourceBadge && (
            <Text size="xs" c="dimmed" mb="xs">
              OpenClaw 来源：{openClawSourceBadge.label}
            </Text>
          )}
          <Text size="xs" c="red">{openClawUpgradeError}</Text>
        </div>
      )}

      {!isRunning && !fatalIssue && !startupIssuePrompt && readyPayload && openClawGateState?.manualHint && !activeTakeoverBackupBlocked && (
        <Alert
          color="yellow"
          variant="light"
          title="OpenClaw 需要手动处理版本"
          mb="sm"
        >
          {openClawSourceBadge && (
            <Text size="xs" c="dimmed" mb="xs">
              OpenClaw 来源：{openClawSourceBadge.label}
            </Text>
          )}
          <Text size="xs" c="dimmed">{openClawGateState.manualHint}</Text>
        </Alert>
      )}

      {!isRunning && !fatalIssue && !startupIssuePrompt && readyPayload && openClawDeliveryNotice && (
        <Alert
          color={openClawDeliveryNotice.color}
          variant="light"
          title={openClawDeliveryNotice.title}
          mb="sm"
        >
          <Text size="xs" c="dimmed">{openClawDeliveryNotice.message}</Text>
        </Alert>
      )}

      {!isRunning && !fatalIssue && !startupIssuePrompt && readyPayload && openClawMigrationSmoke && (
        <Alert
          color={openClawMigrationSmoke.requiresConservativeMode ? 'yellow' : 'blue'}
          variant="light"
          title="OpenClaw 迁移 Smoke"
          mb="sm"
        >
          {openClawSourceBadge && (
            <Text size="xs" c="dimmed" mb="xs">
              OpenClaw 来源：{openClawSourceBadge.label}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            迁移路径：{openClawMigrationSmoke.migrationPath}；baseline backup：
            {openClawMigrationSmoke.needsBaselineBackup ? '需要' : '不需要'}；保守兼容模式：
            {openClawMigrationSmoke.requiresConservativeMode ? '需要' : '不需要'}。
          </Text>
          <Text size="xs" c="dimmed" mt="xs">
            记忆目录审计：{openClawMigrationSmoke.memoryAuditRequired ? '需要' : '不需要'}；Agent 协同审计：
            {openClawMigrationSmoke.agentAuditRequired ? '需要' : '不需要'}。
          </Text>
          {openClawMigrationSmoke.recommendedChecks.map((item) => (
            <Text key={item} size="xs" c="dimmed" mt="xs">
              {item}
            </Text>
          ))}
        </Alert>
      )}

      {showInlineStartupIssue && startupIssuePrompt && (
        <div
          className="mb-4 rounded-lg p-3"
          style={{
            backgroundColor: 'var(--app-bg-inset)',
            border: '1px solid var(--app-hover-border)',
          }}
        >
          <Text size="sm" fw={500}>{startupIssuePrompt.title}</Text>
          <Text size="xs" c="dimmed" mt="xs">{startupIssuePrompt.message}</Text>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" color="brand" radius="md" onClick={handleRestartEnvCheck}>
              重试识别
            </Button>
            {startupSupportActions.map((action) => (
              <Button
                key={`${action.kind}:${action.href}`}
                component="a"
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                variant="light"
                color="brand"
                size="sm"
                radius="md"
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!isRunning && !fatalIssue && !startupIssuePrompt && readyPayload && takeoverSummary?.detected && (
        <TakeoverNotification
          backupRootDirectory={takeoverSummary.backupRootDirectory}
          failures={takeoverSummary.failures}
          retryingCandidateId={retryingTakeoverCandidateId}
          onRetry={handleRetryTakeoverBackup}
        />
      )}

      {fatalIssue && (
        <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--app-bg-inset)', border: '1px solid var(--mantine-color-red-5)' }}>
          {openClawSourceBadge && (
            <Text size="xs" c="dimmed" mb="xs">
              OpenClaw 来源：{openClawSourceBadge.label}
            </Text>
          )}
          <Text size="xs" c="red" mb="xs">{fatalIssue.message}</Text>
          <Button
          onClick={() => {
              resetEnvCheck(runAttempt)
            }}
            fullWidth
            size="sm"
            variant="light"
            color="red"
            radius="md"
          >
            重新执行准备流程
          </Button>
          {historyOnlyRecoveryFailure && (
            <Button
              onClick={() => setHistoryOnlyRecoveryConfirmOpened(true)}
              fullWidth
              size="sm"
              color="orange"
              radius="md"
              mt="xs"
              disabled={acknowledgingManualBackup}
            >
              已手动备份，确认继续
            </Button>
          )}
          {fatalSupportActions.map((action) => (
            <Button
              key={`${action.kind}:${action.href}`}
              component="a"
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              color="brand"
              size="xs"
              radius="md"
              mt="xs"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {startupIssuePrompt && !showInlineStartupIssue && (
        <StartupIssueDialog
          issue={startupIssuePrompt}
          supportActions={startupSupportActions}
          onClose={closeStartupIssue}
          onRestart={handleRestartEnvCheck}
          platform={currentPlatform}
        />
      )}

      {historyOnlyRecoveryFailure && (
        <Modal
          opened={historyOnlyRecoveryConfirmOpened}
          onClose={() => {
            if (acknowledgingManualBackup) return
            setHistoryOnlyRecoveryConfirmOpened(false)
          }}
          title="确认已完成手动备份"
          size="md"
          closeOnClickOutside={!acknowledgingManualBackup}
          closeOnEscape={!acknowledgingManualBackup}
        >
          <div className="space-y-4">
            <Text size="sm">
              请确认你已经完成手动备份，再继续恢复并接管历史 OpenClaw 运行环境。
            </Text>
            <Text size="xs" c="dimmed">
              {formatTakeoverFailureManualBackupWarning(historyOnlyRecoveryFailure.failure)}
            </Text>
            <Text size="xs" c="dimmed">
              确认后会重新执行环境检查，并继续后续流程。
            </Text>
            <div className="flex justify-end gap-2">
              <Button
                variant="default"
                onClick={() => setHistoryOnlyRecoveryConfirmOpened(false)}
                disabled={acknowledgingManualBackup}
              >
                取消
              </Button>
              <Button
                color="orange"
                onClick={() => void handleConfirmHistoryOnlyManualBackup()}
                loading={acknowledgingManualBackup}
              >
                确认继续
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {!isRunning && !fatalIssue && !startupIssuePrompt && readyPayload && activeTakeoverFailure && (
        <Alert
          color="yellow"
          variant="light"
          title="历史 OpenClaw 备份失败"
          mb="sm"
          styles={{ title: { fontSize: 'var(--mantine-font-size-sm)' } }}
        >
          {openClawSourceBadge && (
            <Text size="xs" c="dimmed" mb="xs">
              OpenClaw 来源：{openClawSourceBadge.label}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {formatTakeoverFailureManualBackupWarning(activeTakeoverFailure)}
          </Text>
          <Text size="xs" c="dimmed" mt="xs">
            为了避免在没有兜底备份的情况下直接接管旧安装，Mclaw 暂时阻止进入控制面板。你可以先重试自动备份；如果已经按上面的路径完成手动备份，也可以继续接管。
          </Text>
          {activeTakeoverFailure.message && activeTakeoverFailure.message !== '自动备份失败，请稍后重试。' && (
            <Text size="xs" c="yellow" mt="xs">
              系统返回：{activeTakeoverFailure.message}
            </Text>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="xs"
              variant="light"
              color="brand"
              onClick={() => void handleRetryTakeoverBackup(activeTakeoverFailure.candidateId)}
              loading={retryingTakeoverCandidateId === activeTakeoverFailure.candidateId}
              disabled={acknowledgingManualBackup}
            >
              重新备份
            </Button>
            <Button
              size="xs"
              color="orange"
              onClick={() => void handleAcknowledgeManualBackup()}
              loading={acknowledgingManualBackup}
              disabled={retryingTakeoverCandidateId === activeTakeoverFailure.candidateId}
            >
              我已手动备份，继续接管
            </Button>
          </div>
        </Alert>
      )}

      {!isRunning && !fatalIssue && !startupIssuePrompt && readyPayload && (
        <Button
          onClick={handleContinue}
          fullWidth
          size="sm"
          color="success"
          radius="md"
          disabled={!canContinueWithOpenClawGate(openClawGateState, activeTakeoverBackupBlocked)}
        >
          {gatewayBehavior.resolveContinueLabel(readyPayload.sharedConfigInitialized)}
        </Button>
      )}

      {isRunning && !startupIssuePrompt && (
        <Button
          onClick={handleCancel}
          fullWidth
          size="sm"
          variant="default"
          radius="md"
        >
          取消操作
        </Button>
      )}
    </div>
  )
}
