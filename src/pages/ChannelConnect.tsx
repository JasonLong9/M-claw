import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Alert, Badge, Button, Card, PasswordInput, ScrollArea, SegmentedControl, Stack, Tabs, Text, TextInput, Title, Modal, Loader, CopyButton, ActionIcon, Tooltip, Group } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { QRCodeSVG } from 'qrcode.react'
import FeishuInstallTutorialModal from '../components/FeishuInstallTutorialModal'
import {
  applyChannelConfig,
  getChannelDefinition,
  getChannelPluginInstallLabel,
  isChannelPluginConfigured,
  isPluginAlreadyInstalledError,
  listChannelDefinitions,
  resolveChannelPluginAllowId,
  syncWeixinChannelAccounts,
  stripLegacyOpenClawRootKeys,
  validateChannelForm,
} from '../lib/openclaw-channel-registry'
import { getManagedChannelPluginByChannelId } from '../shared/managed-channel-plugin-registry'
import type { SetupModelContext } from './ModelCenter'
import type { DingtalkOfficialSetupResult } from '../shared/dingtalk-official-setup'
import {
  addFeishuBotConfig,
  listFeishuBots,
  reconcileFeishuOfficialPluginConfig,
  sanitizeFeishuPluginConfig,
  stripFeishuOfficialPluginConfig,
} from './feishu-bots'
import { shouldShowSkipButtonForFeishuPairing } from './channel-connect-skip'
import {
  extractFeishuAsciiQr,
  extractFeishuExistingBotPromptKey,
  extractFeishuLiveQrUrl,
  FEISHU_OFFICIAL_GUIDE_URL,
} from '../lib/feishu-installer'
import { toUserFacingCliFailureMessage, toUserFacingUnknownErrorMessage } from '../lib/user-facing-cli-feedback'
import type { ManagedChannelPluginStatusView } from '../shared/managed-channel-plugin-lifecycle'
import { pollWithBackoff } from '../shared/polling'
import { UI_RUNTIME_DEFAULTS } from '../shared/runtime-policies'

type Status = 'form' | 'installing' | 'starting' | 'connected' | 'error'

export interface ChannelConnectNextPayload {
  channelId: string
  accountId?: string
  accountName?: string
  skipPairing?: boolean
}

export type ChannelConnectBindingStrategy = 'qr-binding' | 'cli-channels-add' | 'config-write'
export type ManagedPluginInstallStrategy = 'reuse-installed-plugin' | 'install-plugin'
type FeishuPathMode = 'create' | 'link'
type FeishuLinkSourceMode = 'existing' | 'manual'
type ManagedPluginPrepareResult = Awaited<ReturnType<typeof window.api.prepareManagedChannelPluginForSetup>>
type ManagedPluginRepairResult = Awaited<ReturnType<typeof window.api.repairManagedChannelPlugin>>
type FeishuOfficialCliStatusView = Awaited<ReturnType<typeof window.api.getFeishuOfficialCliStatus>>
type FeishuOfficialCliSessionView = Awaited<ReturnType<typeof window.api.getFeishuOfficialCliSessionState>>
type FeishuOfficialCliSessionMode = NonNullable<FeishuOfficialCliSessionView['mode']>
type OAuthUrlOpenResult = Awaited<ReturnType<typeof window.api.openOAuthUrl>>
type RepairIncompatiblePluginsOptions = Parameters<typeof window.api.repairIncompatiblePlugins>[0]
type ManagedPluginInstallPreflightApi =
  Pick<typeof window.api, 'prepareManagedChannelPluginForSetup'>
type FeishuRefreshResourcesApi =
  Pick<typeof window.api, 'getFeishuInstallerState' | 'getFeishuOfficialCliSessionState'>
type ChannelConnectGatewayReadyApi =
  Pick<typeof window.api, 'reloadGatewayAfterChannelChange'>
  & Partial<Pick<typeof window.api, 'repairManagedChannelPlugin' | 'getManagedChannelPluginStatus' | 'ensureGatewayRunning'>>

const CHANNELS = listChannelDefinitions()

export function resolveChannelConnectBindingStrategy(
  channel: { useQrBinding?: boolean; useCliChannelsAdd?: boolean } | null | undefined
): ChannelConnectBindingStrategy {
  if (channel?.useQrBinding) return 'qr-binding'
  if (channel?.useCliChannelsAdd) return 'cli-channels-add'
  return 'config-write'
}

export function resolveManagedPluginInstallStrategy(params: {
  pluginConfigured: boolean
  pluginInstalledOnDisk: boolean
  forceInstall?: boolean
}): ManagedPluginInstallStrategy {
  if (params.forceInstall) {
    return 'install-plugin'
  }
  if (params.pluginInstalledOnDisk) {
    return 'reuse-installed-plugin'
  }
  return 'install-plugin'
}

export function isSafeAlreadyInstalledManagedPluginInstallError(detail: string): boolean {
  return isPluginAlreadyInstalledError(detail)
    && !String(detail || '').includes('已自动隔离')
    && !String(detail || '').includes('安全修复失败')
}

export function buildManagedPluginScopedRepairOptions(
  channel: Pick<NonNullable<ReturnType<typeof getChannelDefinition>>, 'plugin'> | null | undefined
): RepairIncompatiblePluginsOptions | null {
  const pluginAllowId = channel ? resolveChannelPluginAllowId(channel) : undefined
  const scopePluginIds = Array.from(
    new Set(
      [pluginAllowId, ...(channel?.plugin?.cleanupPluginIds || [])]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )

  if (scopePluginIds.length === 0) return null

  return {
    scopePluginIds,
    quarantineOfficialManagedPlugins: true,
  }
}

function getManagedPluginInstalledOnDiskFromStatus(
  status: ManagedChannelPluginStatusView
): boolean {
  return status.stages.some((stage) => stage.id === 'installed' && stage.state === 'verified')
}

function resolveFeishuOfficialCliAuthBadgeColor(
  authState: FeishuOfficialCliStatusView['authState'] | null | undefined
): string {
  if (!authState) return 'blue'
  if (authState === 'authenticated') return 'success'
  if (authState === 'unauthenticated') return 'warning'
  if (authState === 'error') return 'danger'
  return 'gray'
}

function resolveFeishuOfficialCliAuthBadgeLabel(
  authState: FeishuOfficialCliStatusView['authState'] | null | undefined
): string {
  if (!authState) return '检测中'
  if (authState === 'authenticated') return '已登录'
  if (authState === 'unauthenticated') return '未登录'
  if (authState === 'error') return '探测失败'
  return '状态未知'
}

export function resolveFeishuOfficialCliSessionModeLabel(
  mode: FeishuOfficialCliSessionMode | null | undefined
): string {
  if (mode === 'config-init-new') return '初始化配置'
  if (mode === 'auth-login-recommend') return '浏览器登录'
  if (mode === 'auth-login-no-wait') return '设备码登录'
  return '空闲'
}

export function resolveFeishuOfficialCliSessionCommand(
  mode: FeishuOfficialCliSessionMode | null | undefined
): string {
  if (mode === 'config-init-new') return 'lark-cli config init --new'
  if (mode === 'auth-login-recommend') return 'lark-cli auth login --recommend'
  if (mode === 'auth-login-no-wait') return 'lark-cli auth login --no-wait'
  return ''
}

export function resolveFeishuOfficialCliSessionStartState(
  mode: FeishuOfficialCliSessionMode | null | undefined
): {
  sessionId: string
  mode: FeishuOfficialCliSessionMode | null
  running: true
  output: string
  exitCode: null
  canceled: false
  input: string
  latestAuthUrl: string
  latestUserCode: string
  notice: string
} {
  return {
    sessionId: '',
    mode: mode || null,
    running: true,
    output: '',
    exitCode: null,
    canceled: false,
    input: '',
    latestAuthUrl: '',
    latestUserCode: '',
    notice: resolveFeishuOfficialCliSessionLiveNotice({
      mode: mode || null,
      running: true,
    }),
  }
}

export function resolveFeishuInstallerSessionStartState(): {
  sessionId: string
  running: true
  output: string
  exitCode: null
  canceled: false
  input: string
  notice: string
} {
  return {
    sessionId: '',
    running: true,
    output: '',
    exitCode: null,
    canceled: false,
    input: '',
    notice: resolveFeishuInstallerSessionLiveNotice({
      running: true,
      hasLiveQr: false,
      hasOutput: false,
    }),
  }
}

export function resolveFeishuChannelViewResetState(): {
  botSetupMode: 'create'
  linkSourceMode: 'existing'
  createStartConfigSnapshot: null
  officialPluginInstalled: false
  officialPluginConfigured: false
  officialPluginConfigChanged: false
  officialPluginBundledPayloadAvailable: false
  bots: Array<ReturnType<typeof listFeishuBots>[number]>
  pairingStatusByBot: Record<string, { pairedCount: number; pairedUsers: string[] }>
  selectedExistingBotAccountId: string
  officialCliStatus: null
  installerSessionId: string
  installerRunning: false
  installerOutput: string
  installerExitCode: null
  installerCanceled: false
  installerBusy: false
  installerInput: string
  installerNotice: string
  officialCliSessionId: string
  officialCliSessionMode: null
  officialCliSessionRunning: false
  officialCliSessionOutput: string
  officialCliSessionExitCode: null
  officialCliSessionCanceled: false
  officialCliSessionBusy: false
  officialCliSessionInput: string
  officialCliSessionLatestAuthUrl: string
  officialCliSessionLatestUserCode: string
  officialCliSessionNotice: string
  preparingManualBinding: false
  manualBindingPreparePhase: 'idle'
  showInstallTutorial: false
  finishingSetup: false
  refreshingState: false
} {
  return {
    botSetupMode: 'create',
    linkSourceMode: 'existing',
    createStartConfigSnapshot: null,
    officialPluginInstalled: false,
    officialPluginConfigured: false,
    officialPluginConfigChanged: false,
    officialPluginBundledPayloadAvailable: false,
    bots: [],
    pairingStatusByBot: {},
    selectedExistingBotAccountId: '',
    officialCliStatus: null,
    installerSessionId: '',
    installerRunning: false,
    installerOutput: '',
    installerExitCode: null,
    installerCanceled: false,
    installerBusy: false,
    installerInput: '',
    installerNotice: '',
    officialCliSessionId: '',
    officialCliSessionMode: null,
    officialCliSessionRunning: false,
    officialCliSessionOutput: '',
    officialCliSessionExitCode: null,
    officialCliSessionCanceled: false,
    officialCliSessionBusy: false,
    officialCliSessionInput: '',
    officialCliSessionLatestAuthUrl: '',
    officialCliSessionLatestUserCode: '',
    officialCliSessionNotice: '',
    preparingManualBinding: false,
    manualBindingPreparePhase: 'idle',
    showInstallTutorial: false,
    finishingSetup: false,
    refreshingState: false,
  }
}

export async function loadFeishuRefreshResources<TSetupState>(params: {
  api: FeishuRefreshResourcesApi
  loadSetupState: () => Promise<TSetupState>
  loadOfficialCliStatus: () => Promise<FeishuOfficialCliStatusView | null>
}): Promise<{
  setupState: TSetupState
  installerSnapshot: Awaited<ReturnType<typeof window.api.getFeishuInstallerState>> | null
  officialCliSessionSnapshot: FeishuOfficialCliSessionView | null
  officialCliStatus: FeishuOfficialCliStatusView | null
}> {
  const [setupState, installerSnapshot, officialCliSessionSnapshot, officialCliStatus] = await Promise.all([
    params.loadSetupState(),
    params.api.getFeishuInstallerState().catch(() => null),
    params.api.getFeishuOfficialCliSessionState().catch(() => null),
    params.loadOfficialCliStatus().catch(() => null),
  ])

  return {
    setupState,
    installerSnapshot,
    officialCliSessionSnapshot,
    officialCliStatus,
  }
}

export function resolveFeishuStopRequestFeedback(params: {
  target: 'official-cli' | 'installer'
  ok: boolean
}): { notice: string; error: string } {
  if (params.ok) {
    return params.target === 'official-cli'
      ? {
          notice: 'Stopping the official guided session...',
          error: '',
        }
      : {
          notice: '已请求终止飞书官方安装器，正在停止...',
          error: '',
        }
  }

  return params.target === 'official-cli'
    ? {
        notice: '',
        error: 'Failed to stop the official lark-cli guided session. Please retry.',
      }
    : {
        notice: '',
      error: '终止飞书官方安装器失败，请稍后重试。',
      }
}

export function resolveFeishuStatusRefreshOptions(
  preparingManualBinding: boolean
): {
  userInitiated: true
  recoverManualBindingIfReady: boolean
} {
  return {
    userInitiated: true,
    recoverManualBindingIfReady: preparingManualBinding,
  }
}

export function getFeishuSessionInputFailureMessage(params: {
  target: 'official-cli' | 'installer'
  detail?: string
  error?: unknown
}): string {
  const fallback =
    params.target === 'installer'
      ? '写入飞书官方安装器失败'
      : 'Failed to write to the official lark-cli guided session.'

  if (typeof params.error !== 'undefined') {
    return toUserFacingUnknownErrorMessage(params.error, fallback)
  }

  return toUserFacingCliFailureMessage({
    stderr: params.detail,
    fallback,
  })
}

export function shouldResetFeishuSessionDraftOnSnapshot(params: {
  currentSessionId?: string | null
  nextSessionId?: string | null
  active?: boolean | null
}): boolean {
  const currentSessionId = String(params.currentSessionId || '').trim()
  const nextSessionId = String(params.nextSessionId || '').trim()

  if (!params.active) return true
  if (!nextSessionId) return true
  return currentSessionId !== nextSessionId
}

export function resolveFeishuOfficialCliSessionStartPlan(params: {
  requestedMode: FeishuOfficialCliSessionMode
  currentMode?: FeishuOfficialCliSessionMode | null
  hasActiveSession: boolean
}): {
  mode: FeishuOfficialCliSessionMode | null
  shouldPrimeFreshStartState: boolean
} {
  if (params.hasActiveSession) {
    return {
      mode: params.currentMode || null,
      shouldPrimeFreshStartState: false,
    }
  }

  return {
    mode: params.requestedMode,
    shouldPrimeFreshStartState: true,
  }
}

export function resolveFeishuInstallerStartPlan(params: {
  requestedMode: 'create' | 'link'
  currentMode: 'create' | 'link'
  hasActiveSession: boolean
}): {
  mode: 'create' | 'link'
  shouldPrimeFreshStartState: boolean
  createSnapshotAction: 'capture' | 'clear' | 'preserve'
} {
  if (params.hasActiveSession) {
    return {
      mode: params.currentMode,
      shouldPrimeFreshStartState: false,
      createSnapshotAction: 'preserve',
    }
  }

  return {
    mode: params.requestedMode,
    shouldPrimeFreshStartState: true,
    createSnapshotAction: params.requestedMode === 'create' ? 'capture' : 'clear',
  }
}

export function resolveFeishuSessionReuseNotice(params: {
  target: 'official-cli' | 'installer'
  requestedMode?: FeishuOfficialCliSessionMode | null
  currentMode?: FeishuOfficialCliSessionMode | null
}): string {
  if (params.target === 'installer') {
    return '飞书官方安装器已在运行中，Mclaw 已重新连接到当前安装会话，不会重复启动第二个安装器。'
  }

  const currentLabel = resolveFeishuOfficialCliSessionModeLabel(params.currentMode)
  const requestedLabel = resolveFeishuOfficialCliSessionModeLabel(params.requestedMode)

  if (
    params.currentMode
    && params.requestedMode
    && params.currentMode !== params.requestedMode
  ) {
    return `An official ${currentLabel} session is already running. Mclaw reattached to it instead of starting a new ${requestedLabel} session.`
  }

  return `An official ${currentLabel} session is already running. Mclaw reattached to it instead of starting a second one.`
}

export function resolveFeishuInstallerSessionLiveNotice(params: {
  running: boolean
  hasLiveQr?: boolean
  hasOutput?: boolean
}): string {
  if (!params.running) return ''

  if (params.hasLiveQr) {
    return '飞书官方安装器仍在运行，请扫描下方本次生成的二维码；机器人创建完成后再继续后续步骤。'
  }

  if (params.hasOutput) {
    return '飞书官方安装器仍在运行，请查看下方实时输出；只有出现“本次安装器二维码”后再扫码。'
  }

  return '飞书官方安装器仍在运行，正在等待本次二维码生成。'
}

export function resolveFeishuInstallerSessionExitNotice(params: {
  canceled: boolean
  exitCode: number | null | undefined
}): string {
  if (params.canceled) {
    return '飞书官方安装器已取消；如果还需要新的二维码，可随时重新启动。'
  }

  if ((params.exitCode ?? null) === 0) {
    return '飞书官方安装器已完成，请查看下方刷新后的本地状态，并在机器人出现后继续。'
  }

  if (params.exitCode !== null && typeof params.exitCode !== 'undefined') {
    return `飞书官方安装器已退出，退出码为 ${params.exitCode}；请先检查下方输出，再决定是否重试。`
  }

  return ''
}

export function resolveFeishuInstallerOutputState(output?: string): {
  hasLiveQr: boolean
  hasOutput: boolean
} {
  const normalizedOutput = String(output || '')
  return {
    hasLiveQr:
      extractFeishuAsciiQr(normalizedOutput).length > 0
      || Boolean(extractFeishuLiveQrUrl(normalizedOutput)),
    hasOutput: Boolean(normalizedOutput.trim()),
  }
}

export function resolveFeishuOfficialCliSessionExitNotice(params: {
  mode: FeishuOfficialCliSessionMode | null | undefined
  canceled: boolean
  exitCode: number | null | undefined
  authState: FeishuOfficialCliStatusView['authState'] | null | undefined
}): string {
  if (params.canceled) {
    return '官方引导会话已取消；如需继续，可随时重新启动。'
  }

  if ((params.exitCode ?? null) === 0) {
    if (
      (params.mode === 'auth-login-recommend' || params.mode === 'auth-login-no-wait')
      && params.authState === 'authenticated'
    ) {
      return '已确认飞书官方 CLI 登录完成；请继续下方托管的 `openclaw-lark` 运行时配置。'
    }
    if (params.mode === 'config-init-new') {
      return '官方 config-init 已完成；请查看下方刷新的本地状态，再继续托管的 `openclaw-lark` 运行时路径。'
    }
    return '官方引导命令已结束，但后续状态还未确认；请查看刷新后的状态，必要时重试。'
  }

  if (params.exitCode !== null && typeof params.exitCode !== 'undefined') {
    return `官方引导会话已退出，退出码为 ${params.exitCode}；重试前请先查看下方输出。`
  }

  return ''
}

export function resolveFeishuOfficialCliSessionSnapshotNotice(params: {
  active: boolean
  mode: FeishuOfficialCliSessionMode | null | undefined
  latestAuthUrl?: string
  latestUserCode?: string
  canceled: boolean
  exitCode: number | null | undefined
  authState: FeishuOfficialCliStatusView['authState'] | null | undefined
}): string {
  if (params.active) {
    return resolveFeishuOfficialCliSessionLiveNotice({
      mode: params.mode,
      running: true,
      hasAuthUrl: Boolean(String(params.latestAuthUrl || '').trim()),
      hasUserCode: Boolean(String(params.latestUserCode || '').trim()),
    })
  }

  return resolveFeishuOfficialCliSessionExitNotice({
    mode: params.mode,
    canceled: params.canceled,
    exitCode: params.exitCode,
    authState: params.authState,
  })
}

export function resolveFeishuOfficialCliSessionLiveNotice(params: {
  mode: FeishuOfficialCliSessionMode | null | undefined
  running: boolean
  hasAuthUrl?: boolean
  hasUserCode?: boolean
}): string {
  if (!params.running) return ''

  if (params.mode === 'auth-login-no-wait') {
    if (params.hasUserCode || params.hasAuthUrl) {
      return '官方设备码登录仍在进行中；请使用下方的验证链接或设备码完成验证。'
    }
    return '官方设备码登录仍在进行中；如果浏览器没有自动打开，请使用下方的链接或设备码继续。'
  }

  if (params.mode === 'auth-login-recommend') {
    if (params.hasAuthUrl) {
      return '官方引导登录仍在进行中；如果浏览器没有自动打开，请使用下方的验证链接继续。'
    }
    return '官方引导登录仍在进行中；请先完成浏览器授权，随后 Mclaw 会自动重新检查 CLI 登录状态。'
  }

  if (params.mode === 'config-init-new') {
    return '官方 config-init 仍在进行中；完成后 Mclaw 会自动刷新本地飞书配置状态。'
  }

  return '官方 lark-cli 引导会话仍在进行中；继续前请先查看下方实时输出。'
}

export function resolveFeishuOfficialCliGuidedFlowPurpose(params: {
  authState: FeishuOfficialCliStatusView['authState'] | null | undefined
  sessionMode: FeishuOfficialCliSessionMode | null | undefined
  sessionRunning: boolean
}): { label: string; detail: string } {
  const modeLabel = resolveFeishuOfficialCliSessionModeLabel(params.sessionMode)
  const authMode =
    params.sessionMode === 'auth-login-recommend' || params.sessionMode === 'auth-login-no-wait'

  if (params.sessionRunning) {
    return {
      label: '执行区',
      detail: authMode
        ? `${modeLabel}正在执行；请先在这里完成官方登录，再回到上方“下一步建议”。`
        : `${modeLabel}正在执行；请先查看实时输出并完成这一步，再执行上方建议的后续动作。`,
    }
  }

  if (params.authState === 'unauthenticated') {
    return {
      label: '执行区',
      detail: '只有在上方“下一步建议”要求官方登录时，才在这里启动官方登录步骤。',
    }
  }

  if (params.authState === 'authenticated') {
    return {
      label: '执行区',
      detail: '这里只有在需要执行官方 CLI 动作时才使用，例如初始化官方配置或补做登录恢复；下一步以“下一步建议”为准。',
    }
  }

  if (params.authState === 'error' || params.authState === 'unknown') {
    return {
      label: '执行区',
      detail: '只有在上方“下一步建议”要求刷新或重试时，才在这里重新执行登录或初始化配置。',
    }
  }

  return {
    label: '执行区',
    detail: '这里用于执行上方“下一步建议”当前推荐的官方 CLI 步骤。',
  }
}

export function resolveFeishuOfficialCliSessionStatus(params: {
  mode: FeishuOfficialCliSessionMode | null | undefined
  running: boolean
  exitCode: number | null | undefined
  canceled: boolean
  authState: FeishuOfficialCliStatusView['authState'] | null | undefined
  hasAuthUrl?: boolean
  hasUserCode?: boolean
}): { color: string; label: string; detail: string } {
  const modeLabel = resolveFeishuOfficialCliSessionModeLabel(params.mode)
  const isAuthMode =
    params.mode === 'auth-login-recommend' || params.mode === 'auth-login-no-wait'

  if (params.running) {
    if (params.mode === 'auth-login-no-wait' && params.hasUserCode) {
      return {
        color: 'blue',
        label: '等待设备码验证',
        detail: '设备码登录正在进行中；请使用下方显示的设备码完成官方验证后再返回。',
      }
    }
    if (isAuthMode && params.hasAuthUrl) {
      return {
        color: 'blue',
        label: '等待浏览器验证',
        detail: `${modeLabel}正在运行；如果浏览器没有自动打开，请使用下方的链接或设备码继续。`,
      }
    }
    return {
      color: 'blue',
      label: '运行中',
      detail: `${modeLabel}正在 Mclaw 中运行；请查看下方实时输出，并在这里完成官方流程。`,
    }
  }

  if (params.canceled) {
    return {
      color: 'gray',
      label: '已取消',
      detail: `${modeLabel}已在完成前取消；如需继续，请重新启动。`,
    }
  }

  if (params.exitCode === 0) {
    if (isAuthMode && params.authState === 'authenticated') {
      return {
        color: 'teal',
        label: '登录已就绪',
        detail: '官方 CLI 登录已完成，Mclaw 已检测到飞书 CLI 处于已登录状态；可以继续下方托管运行时配置。',
      }
    }
    if (isAuthMode) {
      return {
        color: 'yellow',
        label: '待刷新登录状态',
        detail: '引导登录命令已结束，但 Mclaw 还未确认登录状态；如有需要，请刷新状态或重新执行登录。',
      }
    }
    return {
      color: 'teal',
      label: '初始化已完成',
      detail: '官方 config-init 已完成；请刷新本地状态，再继续托管的 `openclaw-lark` 运行时路径。',
    }
  }

  if (params.exitCode !== null && params.exitCode !== undefined) {
    return {
      color: 'red',
      label: `退出 ${params.exitCode}`,
      detail: `${modeLabel}执行失败；重试前请先查看下方官方 CLI 输出。`,
    }
  }

  return {
    color: 'gray',
    label: '未开始',
    detail: '当你需要由 Mclaw 驱动浏览器或设备码登录时，可在这里启动官方引导 CLI 流程。',
  }
}

export type FeishuOfficialOnboardingAction =
  | 'refresh-status'
  | 'start-auth-login-recommend'
  | 'start-auth-login-no-wait'
  | 'start-config-init-new'
  | 'focus-guided-flow'
  | 'open-auth-url'
  | 'copy-device-code'
  | 'finish-create'
  | 'finish-link'
  | 'start-create'
  | 'start-link'
  | 'switch-link-existing'
  | 'switch-link-manual'
  | 'focus-create'
  | 'focus-link'

export function resolveFeishuOfficialOnboardingActionLabel(
  action: FeishuOfficialOnboardingAction
): string {
  if (action === 'refresh-status') return '刷新状态'
  if (action === 'start-auth-login-recommend') return '启动引导登录'
  if (action === 'start-auth-login-no-wait') return '使用设备码'
  if (action === 'start-config-init-new') return '初始化官方配置'
  if (action === 'focus-guided-flow') return '查看官方 CLI'
  if (action === 'open-auth-url') return '打开验证页面'
  if (action === 'copy-device-code') return '复制设备码'
  if (action === 'finish-create') return '完成新建配置'
  if (action === 'finish-link') return '完成关联配置'
  if (action === 'start-create') return '新建机器人'
  if (action === 'start-link') return '关联已有机器人'
  if (action === 'switch-link-existing') return '复用已检测到机器人'
  if (action === 'switch-link-manual') return '改用手动绑定'
  if (action === 'focus-create') return '继续新建流程'
  return '继续关联流程'
}

export type FeishuOfficialCliGuidedFlowAction =
  | FeishuOfficialOnboardingAction
  | 'stop-official-cli-session'

export function resolveFeishuOfficialCliGuidedFlowActionLabel(
  action: FeishuOfficialCliGuidedFlowAction
): string {
  if (action === 'stop-official-cli-session') return '停止会话'
  return resolveFeishuOfficialOnboardingActionLabel(action)
}

export function resolveFeishuOfficialOnboardingSummary(params: {
  setupMode: 'create' | 'link'
  linkSourceMode: FeishuLinkSourceMode
  botCount: number
  selectedExistingBotName?: string
  pluginInstalled: boolean
  officialPluginConfigured: boolean
  pluginConfigChanged?: boolean
}): Array<{ label: string; value: string }> {
  const currentTargetValue = resolveFeishuOfficialOnboardingCurrentTarget({
    setupMode: params.setupMode,
    linkSourceMode: params.linkSourceMode,
    botCount: params.botCount,
    selectedExistingBotName: params.selectedExistingBotName,
  })
  const runtimePluginValue = resolveFeishuOfficialOnboardingRuntimeSummary({
    pluginInstalled: params.pluginInstalled,
    officialPluginConfigured: params.officialPluginConfigured,
    pluginConfigChanged: params.pluginConfigChanged,
  })

  if (params.setupMode === 'create') {
    return [
      { label: '路径', value: '新建机器人' },
      {
        label: '当前目标',
        value: currentTargetValue,
      },
      { label: '运行时插件', value: runtimePluginValue },
      { label: '完成后', value: '跳过配对并继续' },
    ]
  }

  return [
    { label: '路径', value: '关联已有机器人' },
    {
      label: '当前目标',
      value: currentTargetValue,
    },
    { label: '运行时插件', value: runtimePluginValue },
    { label: '完成后', value: '继续飞书配对' },
  ]
}

export function resolveFeishuOfficialOnboardingCurrentTarget(params: {
  setupMode: 'create' | 'link'
  linkSourceMode: FeishuLinkSourceMode
  botCount: number
  selectedExistingBotName?: string
}): string {
  if (params.setupMode === 'create') {
    if (params.botCount === 0) return '等待扫码新建'
    return params.botCount === 1 ? '检测到 1 个机器人' : `检测到 ${params.botCount} 个机器人`
  }

  if (params.linkSourceMode === 'manual') {
    return '手动填写 App ID / App Secret'
  }

  if (params.selectedExistingBotName) {
    return `复用 ${params.selectedExistingBotName}`
  }

  if (params.botCount > 0) {
    return '复用已检测到机器人'
  }

  return '暂无可复用机器人'
}

export function resolveFeishuPathNavigatorItems(
  activeMode: FeishuPathMode
): Array<{ mode: FeishuPathMode; label: string; active: boolean }> {
  return resolveFeishuPathDescriptors().map((item) => ({
    mode: item.mode,
    label: item.navigatorLabel,
    active: activeMode === item.mode,
  }))
}

export function resolveFeishuPathDescriptors(): Array<{
  mode: FeishuPathMode
  overviewTitle: string
  overviewDetail: string
  cardTitle: string
  cardDetail: string
  navigatorLabel: string
}> {
  return [
    {
      mode: 'create',
      overviewTitle: '路径 A：新建机器人',
      overviewDetail: '普通用户优先路径：验证官方安装器、扫码创建、自动回填和新建完成后的收尾状态。',
      cardTitle: '路径 A：新建机器人',
      cardDetail: '默认推荐大多数用户走这条；扫码创建后由 Mclaw 自动回填并继续后续流程。',
      navigatorLabel: '查看新建路径',
    },
    {
      mode: 'link',
      overviewTitle: '路径 B：关联已有机器人',
      overviewDetail: '高级兜底路径：验证插件就绪检查、手填 App ID / App Secret、已有机器人绑定和后续配对流程。',
      cardTitle: '路径 B：关联已有机器人',
      cardDetail: '适合已经有飞书应用，或在扫码创建失败后回退到手动凭证绑定。',
      navigatorLabel: '查看关联路径',
    },
  ]
}

export function resolveFeishuOfficialOnboardingRuntimeSummary(params: {
  pluginInstalled: boolean
  officialPluginConfigured: boolean
  pluginConfigChanged?: boolean
}): string {
  if (params.pluginInstalled && params.officialPluginConfigured) {
    return '磁盘中已就绪'
  }

  if (params.pluginInstalled && params.pluginConfigChanged) {
    return '待同步配置后复用'
  }

  if (params.pluginInstalled) {
    return '进入时校验配置'
  }

  return '首次使用时安装'
}

export function resolveFeishuOfficialOnboardingRuntimeDetail(params: {
  pluginInstalled: boolean
  officialPluginConfigured: boolean
  pluginConfigChanged?: boolean
  bundledPayloadAvailable?: boolean
}): string {
  if (params.pluginInstalled && params.officialPluginConfigured) {
    return '托管的 `openclaw-lark` 运行时插件和共享配置都已就绪。'
  }

  if (params.pluginInstalled && params.pluginConfigChanged) {
    return '托管的 `openclaw-lark` 运行时插件已在本地，但在手动绑定前 Mclaw 还需要先同步共享配置。'
  }

  if (params.pluginInstalled) {
    return '托管的 `openclaw-lark` 运行时插件已在本地，进入该路径时 Mclaw 会再次检查共享配置。'
  }

  if (params.bundledPayloadAvailable) {
    return '进入该路径时，Mclaw 会从打包产物内置内容安装 `openclaw-lark` 运行时插件。'
  }

  return '进入该路径时，Mclaw 会安装托管的 `openclaw-lark` 运行时插件。'
}

export function resolveFeishuOfficialOnboardingLinkPathDetail(params: {
  linkSourceMode: FeishuLinkSourceMode
  linkHasProgress: boolean
  linkCanFinish: boolean
  selectedExistingBotName?: string
  selectedPathHasProgress?: boolean
}): string {
  const activePathHasProgress = params.selectedPathHasProgress ?? params.linkHasProgress

  if (params.linkCanFinish && params.linkSourceMode === 'existing') {
    return params.selectedExistingBotName
      ? `已可以使用「${params.selectedExistingBotName}」完成关联。`
      : '已可以使用当前选中的可复用机器人完成关联。'
  }

  if (params.linkCanFinish && params.linkSourceMode === 'manual') {
    return '手动 App ID / App Secret 路径已可完成。'
  }

  if (params.linkSourceMode === 'manual') {
    return activePathHasProgress
      ? '手动 App ID / App Secret 路径已有进度。'
      : '下一步请继续手动 App ID / App Secret 路径。'
  }

  if (activePathHasProgress) {
    return '关联已有机器人路径已有进度。'
  }

  return '下一步请继续关联已有机器人路径。'
}

export function resolveFeishuLinkPathEntryStatus(params: {
  officialPluginInstalled: boolean
  officialPluginConfigured: boolean
  officialPluginConfigChanged?: boolean
}): { color: string; label: string; detail: string } {
  if (params.officialPluginInstalled && params.officialPluginConfigured) {
    return {
      color: 'teal',
      label: '关联路径就绪',
      detail: '已检测到飞书官方插件和共享配置；点击“关联已有机器人”后可直接进入已有机器人选择或手动绑定。',
    }
  }

  if (params.officialPluginInstalled && params.officialPluginConfigChanged) {
    return {
      color: 'blue',
      label: '待同步插件配置',
      detail: '已检测到飞书官方插件；点击“关联已有机器人”后会先补齐 Mclaw 需要的共享配置，然后进入手动绑定。',
    }
  }

  if (params.officialPluginInstalled) {
    return {
      color: 'blue',
      label: '待校验插件状态',
      detail: '已检测到飞书官方插件；点击“关联已有机器人”后会先复查共享配置，再决定是否直接进入手动绑定。',
    }
  }

  return {
    color: 'gray',
    label: '将自动安装插件',
    detail: '尚未发现飞书官方插件；点击“关联已有机器人”后会先自动安装，再进入手动绑定。',
  }
}

export function resolveFeishuExistingLinkNoBotActions(): {
  primaryAction: FeishuOfficialOnboardingAction
  secondaryAction: FeishuOfficialOnboardingAction
} {
  return {
    primaryAction: 'switch-link-manual',
    secondaryAction: 'start-create',
  }
}

export function resolveFeishuExistingLinkNoBotStatus(params: {
  officialPluginInstalled: boolean
  officialPluginConfigured: boolean
  officialPluginConfigChanged?: boolean
}): { color: string; label: string; detail: string } {
  const runtimeIntro = resolveFeishuLinkPathPanelIntro({
    botCount: 0,
    linkSourceMode: 'manual',
    officialPluginInstalled: params.officialPluginInstalled,
    officialPluginConfigured: params.officialPluginConfigured,
    officialPluginConfigChanged: params.officialPluginConfigChanged,
  })

  return {
    color: 'warning',
    label: '暂无可复用机器人',
    detail: `当前还没有检测到可复用机器人；如果你已经有 App ID / App Secret，建议切到手动绑定，否则先新建机器人。${runtimeIntro.detail}`,
  }
}

export function shouldUseFeishuExistingLinkNoBotRecovery(params: {
  setupMode: 'create' | 'link'
  linkSourceMode: FeishuLinkSourceMode
  botCount: number
  linkCanFinish: boolean
  preparingManualBinding: boolean
  manualCredentialInput: boolean
  manualCredentialsReady: boolean
}): boolean {
  return (
    params.setupMode === 'link'
    && params.linkSourceMode === 'existing'
    && params.botCount === 0
    && !params.linkCanFinish
    && !params.preparingManualBinding
    && !params.manualCredentialInput
    && !params.manualCredentialsReady
  )
}

function resolveFeishuExistingLinkNoBotNextStep(params: {
  runtimeHint: string
  cliOptional: boolean
}): {
  color: string
  title: string
  detail: string
  primaryAction: FeishuOfficialOnboardingAction | null
  secondaryAction: FeishuOfficialOnboardingAction | null
} {
  const missingBotActions = resolveFeishuExistingLinkNoBotActions()
  const cliPrefix = params.cliOptional
    ? '当前机器未安装飞书官方 CLI，但你仍然可以继续本地托管路径。'
    : ''

  return {
    color: 'yellow',
    title: '暂无可复用机器人',
    detail: `${cliPrefix}${cliPrefix ? ' ' : ''}当前没有可复用的已检测机器人；如果你已有 App ID / App Secret，请切到手动绑定，否则先新建机器人。${params.runtimeHint ? ` ${params.runtimeHint}` : ''}`,
    primaryAction: missingBotActions.primaryAction,
    secondaryAction: missingBotActions.secondaryAction,
  }
}

export function resolveFeishuLinkPathPanelIntro(params: {
  botCount: number
  linkSourceMode: FeishuLinkSourceMode
  officialPluginInstalled: boolean
  officialPluginConfigured: boolean
  officialPluginConfigChanged?: boolean
}): { color: string; label: string; detail: string } {
  if (params.officialPluginInstalled && params.officialPluginConfigured) {
    return params.botCount > 0 && params.linkSourceMode === 'existing'
      ? {
          color: 'teal',
          label: '插件已就绪',
          detail: '已确认飞书官方插件可用。你可以直接复用已检测到的机器人，也可以切到手动模式输入新的 App ID / App Secret。',
        }
      : {
          color: 'teal',
          label: '插件已就绪',
          detail: '已确认飞书官方插件可用，现在可以手动填写已有机器人的 App ID / App Secret；完成机器人配置后，再继续输入飞书配对码。',
        }
  }

  if (params.officialPluginInstalled && params.officialPluginConfigChanged) {
    return params.botCount > 0 && params.linkSourceMode === 'existing'
      ? {
          color: 'blue',
          label: '待同步配置',
          detail: '已检测到飞书官方插件和机器人配置；继续关联路径时，Mclaw 会先补齐共享配置，再开放复用或手动绑定。',
        }
      : {
          color: 'blue',
          label: '待同步配置',
          detail: '已检测到飞书官方插件；继续关联路径时，Mclaw 会先补齐共享配置，再开放手动绑定。',
        }
  }

  if (params.officialPluginInstalled) {
    return params.botCount > 0 && params.linkSourceMode === 'existing'
      ? {
          color: 'blue',
          label: '待校验状态',
          detail: '已检测到飞书官方插件；继续关联路径时，Mclaw 仍会先复查共享配置，再开放复用或手动绑定。',
        }
      : {
          color: 'blue',
          label: '待校验状态',
          detail: '已检测到飞书官方插件；继续关联路径时，Mclaw 仍会先复查共享配置，再开放手动绑定。',
        }
  }

  return params.botCount > 0 && params.linkSourceMode === 'existing'
    ? {
        color: 'gray',
        label: '待安装插件',
        detail: '已检测到飞书机器人配置，但官方插件尚未落盘；继续关联路径时，Mclaw 会先自动安装插件，再开放复用或手动绑定。',
      }
    : {
        color: 'gray',
        label: '待安装插件',
        detail: '尚未发现飞书官方插件；继续关联路径时，Mclaw 会先自动安装，再开放手动绑定。',
      }
}

export function resolveFeishuCreatePathStatus(params: {
  finishingSetup: boolean
  botCount: number
  installerRunning: boolean
  installerOutput?: string
}): { color: string; label: string; detail: string } {
  if (params.finishingSetup) {
    return {
      color: 'blue',
      label: '收尾中',
      detail: '正在把新建机器人的结果写回 Mclaw。',
    }
  }

  if (params.botCount > 0) {
    return {
      color: 'success',
      label: '已检测到机器人',
      detail: '已经发现可用的飞书机器人，当前可以点击“完成机器人配置”。',
    }
  }

  if (params.installerRunning) {
    return {
      color: 'warning',
      label: '创建流程进行中',
      detail: '官方安装器正在运行，请继续完成扫码、命名或确认步骤。',
    }
  }

  if (String(params.installerOutput || '').trim()) {
    return {
      color: 'blue',
      label: '等待确认结果',
      detail: '已经有安装器输出，请结合日志和刷新状态判断是否已创建完成。',
    }
  }

  return {
    color: 'gray',
    label: '未开始',
    detail: '点击“新建机器人”后开始官方安装器创建流程。',
  }
}

export function resolveFeishuLinkPathStatus(params: {
  finishingSetup: boolean
  preparingManualBinding: boolean
  manualBindingPreparePhase?: FeishuManualBindingPreparePhase
  linkSourceMode: FeishuLinkSourceMode
  selectedExistingBotName?: string
  manualCredentialsReady: boolean
  manualCredentialInput: boolean
  botCount: number
  officialPluginInstalled: boolean
  officialPluginConfigured: boolean
  officialPluginConfigChanged?: boolean
}): { color: string; label: string; detail: string } {
  if (params.finishingSetup) {
    return {
      color: 'blue',
      label: '绑定收尾中',
      detail: '正在把已有机器人的配置写回 Mclaw。',
    }
  }

  if (params.preparingManualBinding) {
    return resolveFeishuManualBindingPreparationStatus(params.manualBindingPreparePhase || 'idle')
  }

  if (params.linkSourceMode === 'existing' && params.botCount === 0) {
    return resolveFeishuExistingLinkNoBotStatus({
      officialPluginInstalled: params.officialPluginInstalled,
      officialPluginConfigured: params.officialPluginConfigured,
      officialPluginConfigChanged: params.officialPluginConfigChanged,
    })
  }

  if (params.linkSourceMode === 'existing' && params.botCount > 0) {
    return {
      color: 'success',
      label: '将复用现有机器人',
      detail: params.selectedExistingBotName
        ? `当前会直接复用「${params.selectedExistingBotName}」完成绑定。`
        : '当前会直接复用已检测到的机器人完成绑定。',
    }
  }

  if (params.linkSourceMode === 'manual' && params.manualCredentialsReady) {
    return {
      color: 'success',
      label: '可直接绑定',
      detail: 'App ID / App Secret 已满足要求，可以点击“完成机器人配置”。',
    }
  }

  if (params.linkSourceMode === 'manual' && params.manualCredentialInput) {
    return {
      color: 'blue',
      label: '待补全字段',
      detail:
        params.botCount > 0
          ? '已经开始填写已有机器人参数；如需回退，也可以直接切回复用已检测到的机器人。'
          : '已经开始填写已有机器人参数，请先补齐必填字段。',
    }
  }

  if (params.linkSourceMode === 'manual') {
    return {
      color: 'gray',
      label: params.botCount > 0 ? '手动模式' : '待输入凭证',
      detail:
        params.botCount > 0
          ? '当前处于手动绑定模式；如果不想继续填凭证，也可以切回复用已检测到的机器人。'
          : '当前处于手动绑定模式，请填写 App ID / App Secret。',
    }
  }

  return resolveFeishuLinkPathEntryStatus({
    officialPluginInstalled: params.officialPluginInstalled,
    officialPluginConfigured: params.officialPluginConfigured,
    officialPluginConfigChanged: params.officialPluginConfigChanged,
  })
}

export function resolveFeishuCreatePathCardActions(params: {
  finishingSetup: boolean
  createCanFinish: boolean
  installerRunning: boolean
  installerOutput?: string
}): {
  primaryAction: FeishuOfficialOnboardingAction | null
  secondaryAction: FeishuOfficialOnboardingAction | null
} {
  if (params.finishingSetup) {
    return {
      primaryAction: null,
      secondaryAction: null,
    }
  }

  if (params.createCanFinish) {
    return {
      primaryAction: 'finish-create',
      secondaryAction: 'focus-create',
    }
  }

  if (params.installerRunning || String(params.installerOutput || '').trim()) {
    return {
      primaryAction: 'focus-create',
      secondaryAction: 'refresh-status',
    }
  }

  return {
    primaryAction: 'start-create',
    secondaryAction: null,
  }
}

export function resolveFeishuLinkPathCardActions(params: {
  finishingSetup: boolean
  preparingManualBinding: boolean
  linkCanFinish: boolean
  linkSourceMode: FeishuLinkSourceMode
  botCount: number
  manualCredentialInput: boolean
}): {
  primaryAction: FeishuOfficialOnboardingAction | null
  secondaryAction: FeishuOfficialOnboardingAction | null
} {
  if (params.finishingSetup) {
    return {
      primaryAction: null,
      secondaryAction: null,
    }
  }

  if (params.linkCanFinish) {
    return {
      primaryAction: 'finish-link',
      secondaryAction: 'focus-link',
    }
  }

  if (params.preparingManualBinding) {
    return {
      primaryAction: 'focus-link',
      secondaryAction: null,
    }
  }

  if (params.linkSourceMode === 'existing') {
    if (params.botCount > 0) {
      return {
        primaryAction: 'focus-link',
        secondaryAction: null,
      }
    }

    return resolveFeishuExistingLinkNoBotActions()
  }

  if (params.botCount > 0 && !params.manualCredentialInput) {
    return {
      primaryAction: 'switch-link-existing',
      secondaryAction: 'focus-link',
    }
  }

  if (params.manualCredentialInput) {
    return {
      primaryAction: 'focus-link',
      secondaryAction: params.botCount > 0 ? 'switch-link-existing' : null,
    }
  }

  return {
    primaryAction: 'focus-link',
    secondaryAction: params.botCount > 0 ? 'switch-link-existing' : null,
  }
}

export function resolveFeishuOfficialOnboardingBlockers(params: {
  cliAvailable: boolean | null | undefined
  authState: FeishuOfficialCliStatusView['authState'] | null | undefined
  sessionMode: FeishuOfficialCliSessionMode | null | undefined
  sessionRunning: boolean
  hasAuthUrl?: boolean
  hasUserCode?: boolean
  clipboardAvailable?: boolean
  setupMode: 'create' | 'link'
  botCount: number
  installerRunning: boolean
  installerOutput?: string
  preparingManualBinding: boolean
  manualBindingPreparePhase?: FeishuManualBindingPreparePhase
  manualCredentialInput: boolean
  manualCredentialsReady: boolean
  createCanFinish: boolean
  linkCanFinish: boolean
  linkSourceMode: FeishuLinkSourceMode
}): Array<{
  label: string
  detail: string
  primaryAction: FeishuOfficialOnboardingAction | null
  secondaryAction: FeishuOfficialOnboardingAction | null
}> {
  const authMode =
    params.sessionMode === 'auth-login-recommend' || params.sessionMode === 'auth-login-no-wait'

  if (params.sessionRunning) {
    if (authMode && params.hasUserCode) {
      if (params.clipboardAvailable === false && params.hasAuthUrl) {
        return [
          {
            label: '设备码登录',
            detail: '设备码登录仍在等待验证；请打开官方验证页面，使用下方当前设备码完成验证后再回来。',
            primaryAction: 'open-auth-url',
            secondaryAction: 'focus-guided-flow',
          },
        ]
      }

      if (params.clipboardAvailable === false) {
        return [
          {
            label: '设备码登录',
            detail: '设备码登录仍在等待验证；请使用下方当前设备码完成官方确认后再回来。',
            primaryAction: 'focus-guided-flow',
            secondaryAction: null,
          },
        ]
      }

      return [
        {
          label: '设备码登录',
          detail: '设备码登录仍在等待验证；请复制当前设备码，完成官方确认后再回来。',
          primaryAction: 'copy-device-code',
          secondaryAction: 'focus-guided-flow',
        },
      ]
    }

    if (authMode && params.hasAuthUrl) {
      return [
        {
          label: '官方登录',
          detail: '当前引导登录会话仍在等待浏览器或设备码确认。',
          primaryAction: 'open-auth-url',
          secondaryAction: 'focus-guided-flow',
        },
      ]
    }

    return [
      {
        label: '官方 CLI 会话',
        detail: `${resolveFeishuOfficialCliSessionModeLabel(params.sessionMode)}仍在 Mclaw 中运行。`,
        primaryAction: 'focus-guided-flow',
        secondaryAction: null,
      },
    ]
  }

  if (params.cliAvailable && params.authState === 'unauthenticated') {
    return [
      {
        label: '官方登录',
        detail: '请先完成官方 `lark-cli` 登录，托管运行时路径之后才能进入可完成状态。',
        primaryAction: 'start-auth-login-recommend',
        secondaryAction: 'start-auth-login-no-wait',
      },
    ]
  }

  if (params.cliAvailable && (params.authState === 'error' || params.authState === 'unknown')) {
    return [
      {
        label: '官方 CLI 状态',
        detail: '请刷新状态或重新执行引导登录，让 Mclaw 重新确认当前 `lark-cli` 状态。',
        primaryAction: 'refresh-status',
        secondaryAction: 'start-auth-login-recommend',
      },
    ]
  }

  if (params.setupMode === 'create') {
    if (params.createCanFinish) return []

    if (params.manualCredentialInput && !params.manualCredentialsReady) {
        return [
          {
            label: '凭证',
            detail: '已经开始填写 App ID / App Secret，但在两个必填字段补齐前，新建路径还不能完成。',
            primaryAction: 'focus-create',
            secondaryAction: null,
          },
      ]
    }

    if (params.installerRunning) {
      return [
        {
          label: '新建流程',
          detail: '托管新建流程仍在进行中，Mclaw 还没有恢复出可直接完成的机器人配置。',
          primaryAction: 'focus-create',
          secondaryAction: null,
        },
      ]
    }

    if (String(params.installerOutput || '').trim()) {
      return [
        {
          label: '新建机器人',
          detail: '新建流程已经有输出，但 Mclaw 还没有从中恢复出可复用的机器人。',
          primaryAction: 'focus-create',
          secondaryAction: 'refresh-status',
        },
      ]
    }

    return [
      {
        label: '新建机器人',
        detail: '目前还没有检测到新建机器人；请启动或继续新建流程，直到 Mclaw 成功恢复机器人。',
        primaryAction: 'start-create',
        secondaryAction: null,
      },
    ]
  }

  if (params.linkCanFinish) return []

  if (params.linkSourceMode === 'existing') {
    if (params.botCount > 0) {
      return [
        {
          label: '可复用机器人',
          detail: '已经检测到机器人，但当前关联状态还不能直接完成；请刷新本地状态后再试。',
          primaryAction: 'focus-link',
          secondaryAction: 'refresh-status',
        },
      ]
    }

    const missingBotActions = resolveFeishuExistingLinkNoBotActions()
    return [
      {
        label: '可复用机器人',
        detail: '当前还没有可复用的已检测机器人；如果你已有凭证，请切到手动绑定，否则先新建机器人。',
        primaryAction: missingBotActions.primaryAction,
        secondaryAction: missingBotActions.secondaryAction,
      },
    ]
  }

  if (params.preparingManualBinding) {
    const preparationStatus = resolveFeishuManualBindingPreparationStatus(
      params.manualBindingPreparePhase || 'idle'
    )
    return [
      {
        label: preparationStatus.label,
        detail: preparationStatus.detail,
        primaryAction: 'focus-link',
        secondaryAction: null,
      },
    ]
  }

  if (params.manualCredentialInput && !params.manualCredentialsReady) {
    return [
      {
        label: '凭证',
        detail: '已经开始填写 App ID / App Secret，但在两个字段都补齐前，手动关联模式还不能完成。',
        primaryAction: 'focus-link',
        secondaryAction: params.botCount > 0 ? 'switch-link-existing' : null,
      },
    ]
  }

  return [
    {
      label: '凭证',
      detail: '当前已切到手动关联模式，但还没有填写 App ID / App Secret。',
      primaryAction: params.botCount > 0 ? 'switch-link-existing' : 'focus-link',
      secondaryAction: params.botCount > 0 ? 'focus-link' : null,
    },
  ]
}

export function resolveFeishuOfficialOnboardingLiveAssist(params: {
  sessionMode: FeishuOfficialCliSessionMode | null | undefined
  sessionRunning: boolean
  latestAuthUrl?: string
  latestUserCode?: string
  clipboardAvailable?: boolean
}): Array<{
  label: string
  detail: string
  value: string
  primaryAction: FeishuOfficialOnboardingAction | null
  secondaryAction: FeishuOfficialOnboardingAction | null
  copyValue?: string
  copyLabel?: string
}> {
  const authMode =
    params.sessionMode === 'auth-login-recommend' || params.sessionMode === 'auth-login-no-wait'
  if (!params.sessionRunning || !authMode) return []

  const items: Array<{
    label: string
    detail: string
    value: string
    primaryAction: FeishuOfficialOnboardingAction | null
    secondaryAction: FeishuOfficialOnboardingAction | null
    copyValue?: string
    copyLabel?: string
  }> = []

  const latestAuthUrl = String(params.latestAuthUrl || '').trim()
  if (latestAuthUrl) {
    items.push({
      label: '验证链接',
      detail: '如果官方浏览器步骤没有自动打开，请使用这个链接继续。',
      value: latestAuthUrl,
      primaryAction: 'open-auth-url',
      secondaryAction: 'focus-guided-flow',
      copyValue: params.clipboardAvailable === false ? undefined : latestAuthUrl,
      copyLabel: params.clipboardAvailable === false ? undefined : '复制链接',
    })
  }

  const latestUserCode = String(params.latestUserCode || '').trim()
  if (latestUserCode) {
    items.push({
      label: '设备码',
      detail: '请在设备码流程展示的官方验证页面中使用这个设备码。',
      value: latestUserCode,
      primaryAction: null,
      secondaryAction: 'focus-guided-flow',
      copyValue: params.clipboardAvailable === false ? undefined : latestUserCode,
      copyLabel: params.clipboardAvailable === false ? undefined : '复制设备码',
    })
  }

  return items
}

export function resolveFeishuOfficialCliGuidedFlowActions(params: {
  authState: FeishuOfficialCliStatusView['authState'] | null | undefined
  sessionMode: FeishuOfficialCliSessionMode | null | undefined
  sessionRunning: boolean
  sessionExitCode: number | null | undefined
  sessionCanceled: boolean
}): FeishuOfficialCliGuidedFlowAction[] {
  if (params.sessionRunning) {
    return ['stop-official-cli-session']
  }

  const configInitFinished =
    params.sessionMode === 'config-init-new'
    && !params.sessionCanceled
    && params.sessionExitCode === 0

  if (params.authState === 'unauthenticated') {
    return ['start-auth-login-recommend', 'start-auth-login-no-wait']
  }

  if (params.authState === 'error' || params.authState === 'unknown') {
    return ['refresh-status', 'start-auth-login-recommend']
  }

  if (params.authState === 'authenticated') {
    return configInitFinished
      ? ['refresh-status']
      : ['start-config-init-new', 'refresh-status']
  }

  return ['refresh-status']
}

function resolveFeishuOfficialOnboardingRuntimeAction(params: {
  setupMode: 'create' | 'link'
  createHasProgress: boolean
  linkHasProgress: boolean
  createCanFinish: boolean
  linkCanFinish: boolean
}): FeishuOfficialOnboardingAction {
  if (params.setupMode === 'create') {
    if (params.createCanFinish) return 'finish-create'
    return params.createHasProgress ? 'focus-create' : 'start-create'
  }
  if (params.linkCanFinish) return 'finish-link'
  return params.linkHasProgress ? 'focus-link' : 'start-link'
}

function buildFeishuOfficialOnboardingRuntimeDetail(params: {
  setupMode: 'create' | 'link'
  createHasProgress: boolean
  linkHasProgress: boolean
  selectedLinkPathHasProgress: boolean
  createCanFinish: boolean
  linkCanFinish: boolean
  linkSourceMode: FeishuLinkSourceMode
  pluginInstalled: boolean
  officialPluginConfigured: boolean
  pluginConfigChanged?: boolean
  bundledPayloadAvailable?: boolean
  selectedExistingBotName?: string
}): string {
  const runtimeHint = resolveFeishuOfficialOnboardingRuntimeDetail({
    pluginInstalled: params.pluginInstalled,
    officialPluginConfigured: params.officialPluginConfigured,
    pluginConfigChanged: params.pluginConfigChanged,
    bundledPayloadAvailable: params.bundledPayloadAvailable,
  })

  if (params.setupMode === 'create') {
    if (params.createCanFinish) {
      return `托管新建机器人路径已可完成。${runtimeHint}`
    }
    if (params.createHasProgress) {
      return `托管新建机器人路径已有进度。${runtimeHint}`
    }
    return `下一步请继续托管新建机器人路径。${runtimeHint}`
  }

  return `${resolveFeishuOfficialOnboardingLinkPathDetail({
    linkSourceMode: params.linkSourceMode,
    linkHasProgress: params.linkHasProgress,
    selectedPathHasProgress: params.selectedLinkPathHasProgress,
    linkCanFinish: params.linkCanFinish,
    selectedExistingBotName: params.selectedExistingBotName,
  })} ${runtimeHint}`
}

export function resolveFeishuOfficialOnboardingNextStep(params: {
  cliAvailable: boolean | null | undefined
  authState: FeishuOfficialCliStatusView['authState'] | null | undefined
  sessionMode: FeishuOfficialCliSessionMode | null | undefined
  sessionRunning: boolean
  sessionExitCode: number | null | undefined
  sessionCanceled: boolean
  hasAuthUrl?: boolean
  hasUserCode?: boolean
  setupMode: 'create' | 'link'
  pluginInstalled: boolean
  officialPluginConfigured: boolean
  pluginConfigChanged?: boolean
  bundledPayloadAvailable?: boolean
  botCount: number
  installerRunning: boolean
  installerOutput?: string
  preparingManualBinding: boolean
  manualCredentialInput: boolean
  manualCredentialsReady: boolean
  createCanFinish: boolean
  linkCanFinish: boolean
  linkSourceMode: FeishuLinkSourceMode
  selectedExistingBotName?: string
}): {
  color: string
  title: string
  detail: string
  primaryAction: FeishuOfficialOnboardingAction | null
  secondaryAction: FeishuOfficialOnboardingAction | null
} {
  const createHasProgress =
    params.botCount > 0 || params.installerRunning || Boolean(String(params.installerOutput || '').trim())
  const linkHasProgress =
    params.botCount > 0 || params.preparingManualBinding || params.manualCredentialInput || params.manualCredentialsReady
  const selectedLinkPathHasProgress =
    params.linkSourceMode === 'manual'
      ? params.preparingManualBinding || params.manualCredentialInput || params.manualCredentialsReady
      : linkHasProgress
  const runtimeAction = resolveFeishuOfficialOnboardingRuntimeAction({
    setupMode: params.setupMode,
    createHasProgress,
    linkHasProgress,
    createCanFinish: params.createCanFinish,
    linkCanFinish: params.linkCanFinish,
  })
  const runtimeDetail = buildFeishuOfficialOnboardingRuntimeDetail({
    setupMode: params.setupMode,
    createHasProgress,
    linkHasProgress,
    selectedLinkPathHasProgress,
    createCanFinish: params.createCanFinish,
    linkCanFinish: params.linkCanFinish,
    linkSourceMode: params.linkSourceMode,
    pluginInstalled: params.pluginInstalled,
    officialPluginConfigured: params.officialPluginConfigured,
    pluginConfigChanged: params.pluginConfigChanged,
    bundledPayloadAvailable: params.bundledPayloadAvailable,
    selectedExistingBotName: params.selectedExistingBotName,
  })
  const runtimeHint = resolveFeishuOfficialOnboardingRuntimeDetail({
    pluginInstalled: params.pluginInstalled,
    officialPluginConfigured: params.officialPluginConfigured,
    pluginConfigChanged: params.pluginConfigChanged,
    bundledPayloadAvailable: params.bundledPayloadAvailable,
  })
  const shouldRecoverExistingLinkNoBot = shouldUseFeishuExistingLinkNoBotRecovery({
    setupMode: params.setupMode,
    linkSourceMode: params.linkSourceMode,
    botCount: params.botCount,
    linkCanFinish: params.linkCanFinish,
    preparingManualBinding: params.preparingManualBinding,
    manualCredentialInput: params.manualCredentialInput,
    manualCredentialsReady: params.manualCredentialsReady,
  })
  const authMode =
    params.sessionMode === 'auth-login-recommend' || params.sessionMode === 'auth-login-no-wait'
  const configInitFinished =
    params.sessionMode === 'config-init-new'
    && !params.sessionRunning
    && !params.sessionCanceled
    && params.sessionExitCode === 0

  if (params.sessionRunning) {
    if (authMode && params.hasAuthUrl) {
      return {
        color: 'blue',
        title: '完成浏览器验证',
        detail: '引导登录会话仍在进行中；请先完成下方展示的浏览器或设备码验证，再进入下一步。',
        primaryAction: null,
        secondaryAction: null,
      }
    }

    if (authMode && params.hasUserCode) {
      return {
        color: 'blue',
        title: '完成设备码验证',
        detail: '设备码登录会话仍在进行中；请先完成下方展示的验证步骤，再进入下一步。',
        primaryAction: null,
        secondaryAction: null,
      }
    }

    return {
      color: 'blue',
      title: '继续当前会话',
      detail: `${resolveFeishuOfficialCliSessionModeLabel(params.sessionMode)}仍在 Mclaw 中运行；请先完成这个官方 CLI 步骤，再执行这里建议的后续动作。`,
      primaryAction: null,
      secondaryAction: null,
    }
  }

  if (!params.cliAvailable) {
    if (shouldRecoverExistingLinkNoBot) {
      return resolveFeishuExistingLinkNoBotNextStep({
        runtimeHint,
        cliOptional: true,
      })
    }

    return {
      color: 'gray',
      title: 'CLI 可选',
      detail: `当前机器未安装飞书官方 CLI，但你仍然可以继续下方托管运行时路径。${runtimeDetail}`,
      primaryAction: runtimeAction,
      secondaryAction: null,
    }
  }

  if (params.authState === 'unauthenticated') {
    return {
      color: 'blue',
      title: '先完成官方登录',
      detail: '请先完成飞书官方登录，这样 Mclaw 才能在后续步骤里复用同一个已登录环境。',
      primaryAction: 'start-auth-login-recommend',
      secondaryAction: 'start-auth-login-no-wait',
    }
  }

  if (params.authState === 'error') {
    return {
      color: 'red',
      title: '重新检查登录状态',
      detail: 'Mclaw 已找到 `lark-cli`，但读取当前登录状态失败；请先刷新一次，如仍失败，再从此页重新执行引导登录。',
      primaryAction: 'refresh-status',
      secondaryAction: 'start-auth-login-recommend',
    }
  }

  if (params.authState === 'unknown') {
    return {
      color: 'yellow',
      title: '确认官方登录状态',
      detail: 'Mclaw 目前还不能可靠判断当前 `lark-cli` 登录状态；请刷新状态或重新执行引导登录，让下一步判断变得确定。',
      primaryAction: 'refresh-status',
      secondaryAction: 'start-auth-login-recommend',
    }
  }

  if (params.authState === 'authenticated') {
    if (shouldRecoverExistingLinkNoBot) {
      return resolveFeishuExistingLinkNoBotNextStep({
        runtimeHint,
        cliOptional: false,
      })
    }

    if (configInitFinished) {
      return {
        color: 'teal',
        title: runtimeAction === 'finish-create' || runtimeAction === 'finish-link'
          ? '可以完成配置'
          : '继续运行时配置',
        detail: `官方 CLI 登录和 config-init 看起来都已完成。${runtimeDetail}`,
        primaryAction: runtimeAction,
        secondaryAction:
          runtimeAction === 'finish-create'
            ? 'focus-create'
            : runtimeAction === 'finish-link'
              ? 'focus-link'
              : null,
      }
    }

    return {
      color: 'teal',
      title:
        runtimeAction === 'finish-create' || runtimeAction === 'finish-link'
          ? '登录已就绪，可完成配置'
          : '登录已就绪',
      detail:
        runtimeAction === 'finish-create' || runtimeAction === 'finish-link'
          ? `官方 CLI 登录已就绪。${runtimeDetail} 你现在可以完成托管配置；如果仍想补做官方初始化，“初始化官方配置”仍然是可选项。`
          : `官方 CLI 登录已就绪。${runtimeDetail} 如果你仍想补做官方应用初始化，可以在继续前执行“初始化官方配置”。`,
      primaryAction: runtimeAction,
      secondaryAction:
        runtimeAction === 'finish-create'
          ? 'focus-create'
          : runtimeAction === 'finish-link'
            ? 'focus-link'
            : 'start-config-init-new',
    }
  }

  return {
    color: 'gray',
    title: '刷新状态',
    detail: '请刷新官方 CLI 状态，或重新执行引导登录，以重新建立清晰可判断的下一步。',
    primaryAction: 'refresh-status',
    secondaryAction: 'start-auth-login-recommend',
  }
}

function hasVerifiedManagedPluginInstallAndRegistration(
  status: ManagedChannelPluginStatusView
): boolean {
  return getManagedPluginInstalledOnDiskFromStatus(status)
    && getManagedPluginStageState(status, 'registered') === 'verified'
}

function getManagedPluginStageState(
  status: ManagedChannelPluginStatusView,
  stageId: ManagedChannelPluginStatusView['stages'][number]['id']
): ManagedChannelPluginStatusView['stages'][number]['state'] | undefined {
  return status.stages.find((stage) => stage.id === stageId)?.state
}

function hasBlockingManagedChannelReadyState(
  status: ManagedChannelPluginStatusView
): boolean {
  return getManagedPluginStageState(status, 'ready') === 'missing'
}

function canProceedWithPendingFeishuManagedReadyState(
  channelId: string,
  status: ManagedChannelPluginStatusView,
  options?: { allowPendingManagedReady?: boolean }
): boolean {
  if (!options?.allowPendingManagedReady) return false
  if (channelId !== 'feishu') return false

  return hasVerifiedManagedPluginInstallAndRegistration(status)
    && getManagedPluginStageState(status, 'loaded') !== 'missing'
}

async function confirmManagedChannelStatusAfterGatewayReady(
  api: Pick<ChannelConnectGatewayReadyApi, 'getManagedChannelPluginStatus'>,
  channelId: string,
  options?: { requireStatus?: boolean; allowPendingManagedReady?: boolean }
): Promise<{ ok: boolean; message?: string }> {
  if (!api.getManagedChannelPluginStatus) return { ok: true }

  const status = await api.getManagedChannelPluginStatus(channelId).catch(() => null)
  if (!status) {
    return options?.requireStatus
      ? { ok: false, message: 'Gateway 启动失败' }
      : { ok: true }
  }

  if (!hasVerifiedManagedPluginInstallAndRegistration(status)) {
    return {
      ok: false,
      message: status.summary || 'Gateway 启动失败',
    }
  }

  if (hasBlockingManagedChannelReadyState(status)) {
    if (canProceedWithPendingFeishuManagedReadyState(channelId, status, options)) {
      return { ok: true }
    }
    return {
      ok: false,
      message: status.summary || '渠道运行态尚未就绪',
    }
  }

  return { ok: true }
}

function isRepairableChannelConnectGatewayStateCode(stateCode: unknown): boolean {
  return stateCode === 'plugin_load_failure' || stateCode === 'config_invalid'
}

function shouldSkipTargetedManagedRepair(channelId: string): boolean {
  return channelId === 'openclaw-weixin'
}

function getGatewayReadyFailureMessage(
  result: Partial<{
    summary: string
    stderr: string
    stdout: string
  }>,
  fallback = 'Gateway 启动失败'
): string {
  const summary = String(result.summary || '').trim()
  if (summary) return summary

  const fallbackMessage = String(result.stderr || '').trim()
    || String(result.stdout || '').trim()
    || fallback
  return toUserFacingCliFailureMessage({
    stderr: fallbackMessage,
    fallback,
  })
}

const FEISHU_OFFICIAL_AUTH_URL_OPEN_FAILURE_FALLBACK =
  '打开飞书官方验证页面失败；请使用下方显示的验证链接继续手动完成。'

export function getFeishuOfficialAuthUrlOpenFailureMessage(
  result: Pick<OAuthUrlOpenResult, 'stderr' | 'stdout'>
): string {
  return toUserFacingCliFailureMessage({
    stderr: result.stderr,
    stdout: result.stdout,
    fallback: FEISHU_OFFICIAL_AUTH_URL_OPEN_FAILURE_FALLBACK,
  })
}

function getManagedChannelRepairFailureMessage(result: ManagedPluginRepairResult): string {
  if (result.kind === 'manual-action-required') return result.reason
  if (result.kind === 'gateway-reload-failed') return result.reloadReason
  if (result.kind === 'install-failed' || result.kind === 'repair-failed') return result.error
  if (result.kind === 'config-sync-required') return result.reason
  if (result.kind === 'plugin-ready-channel-not-ready') return result.blockingReason
  if (result.kind === 'capability-blocked') {
    return result.missingCapabilities.join('；') || result.status.summary
  }
  if (result.kind === 'quarantine-failed') {
    return result.status.summary || `插件隔离失败：${result.failureKind}`
  }
  return result.status.summary || 'Gateway 启动失败'
}

export async function resolveManagedPluginInstallPreflight(
  api: ManagedPluginInstallPreflightApi,
  params: {
    channel: Pick<NonNullable<ReturnType<typeof getChannelDefinition>>, 'id' | 'plugin'> | null | undefined
    pluginConfigured: boolean
  }
): Promise<{
  pluginInstalledOnDisk: boolean
  pluginInstallStrategy: ManagedPluginInstallStrategy
  prepareResult: ManagedPluginPrepareResult | null
}> {
  const prepareResult = params.channel
    ? await api.prepareManagedChannelPluginForSetup(params.channel.id)
    : null

  if (!prepareResult) {
    return {
      pluginInstalledOnDisk: false,
      pluginInstallStrategy: 'install-plugin',
      prepareResult: null,
    }
  }

  if (prepareResult.kind === 'prepare-failed') {
    throw new Error(prepareResult.error || '插件兼容性预检失败，请稍后重试。')
  }

  if (prepareResult.kind === 'capability-blocked') {
    throw new Error(
      prepareResult.missingCapabilities.join('；') || '当前环境暂不支持该插件安装能力。'
    )
  }

  const pluginInstalledOnDisk =
    'status' in prepareResult
      ? getManagedPluginInstalledOnDiskFromStatus(prepareResult.status)
      : false
  const forceInstall =
    prepareResult.kind === 'manual-action-required'
    || (prepareResult.kind === 'config-sync-required' && !pluginInstalledOnDisk)
    || (prepareResult.kind === 'ok' && prepareResult.action === 'install-before-setup')

  return {
    pluginInstalledOnDisk,
    pluginInstallStrategy: resolveManagedPluginInstallStrategy({
      pluginConfigured: params.pluginConfigured,
      pluginInstalledOnDisk,
      forceInstall,
    }),
    prepareResult,
  }
}

function extractAsciiQrBlock(text: string): string {
  const lines = String(text || '').split(/\r?\n/)
  let bestBlock = ''
  let currentBlock: string[] = []

  const flushCurrent = () => {
    if (currentBlock.length >= 8) {
      const candidate = currentBlock.join('\n').trimEnd()
      if (candidate.length > bestBlock.length) {
        bestBlock = candidate
      }
    }
    currentBlock = []
  }

  for (const line of lines) {
    const looksLikeQrLine = /[█▄▀]/.test(line) && line.replace(/\s/g, '').length >= 12
    if (looksLikeQrLine) {
      currentBlock.push(line)
      continue
    }

    if (currentBlock.length > 0) {
      flushCurrent()
    }
  }

  flushCurrent()
  return bestBlock
}

async function writeConfigDirect(
  config: Record<string, unknown>,
  reason: 'channel-connect-sanitize' | 'channel-connect-onboard-prepare' | 'channel-connect-configure' = 'channel-connect-configure'
) {
  const result = await window.api.writeConfigGuarded({ config, reason })
  if (!result.ok) {
    throw new Error(result.message || '共享配置写入失败')
  }
}

async function writeConfigPatch(
  beforeConfig: Record<string, any> | null | undefined,
  afterConfig: Record<string, any>,
  reason: 'channel-connect-sanitize' | 'channel-connect-onboard-prepare' | 'channel-connect-configure' = 'channel-connect-configure'
) {
  const result = await window.api.applyConfigPatchGuarded({
    beforeConfig: beforeConfig || {},
    afterConfig,
    reason,
  })
  if (!result.ok) {
    throw new Error(result.message || '共享配置写入失败')
  }
}

export function buildChannelConnectCompletionCopy(
  channel: Pick<NonNullable<ReturnType<typeof getChannelDefinition>>, 'id' | 'name' | 'skipPairing'> | null | undefined
): string {
  if (!channel) return ''
  if (channel.id === 'dingtalk') {
    return [
      '⚠️ 当前只确认插件安装、最小配置补丁和 Gateway 重载已完成。',
      '钉钉 `loaded / ready` 仍待上游状态证明，当前状态按 `unknown / 未证实` 处理。',
    ].join('\n')
  }

  if (channel.skipPairing) {
    return `${channel.name} 渠道已就绪，可以开始使用了。`
  }

  if (channel.id === 'feishu') {
    return '现在请先在飞书里给机器人发一条消息，拿到配对信息后，建议直接粘贴机器人完整回复；然后点击“下一步：输入飞书配对码”继续完成接入。'
  }

  return `现在请在 ${channel.name} 中给机器人发一条消息，获取配对码；然后点击“下一步：输入配对码”继续完成接入。`
}

export function buildChannelConnectConnectedActionLabel(
  channel: Pick<NonNullable<ReturnType<typeof getChannelDefinition>>, 'id' | 'skipPairing'> | null | undefined
): string {
  if (!channel || channel.skipPairing) return '完成配置'
  if (channel.id === 'feishu') return '下一步：输入飞书配对码'
  return '下一步：输入配对码'
}

export function shouldShowChannelConnectSkipButton(params: {
  canSkip: boolean
  forceShowSkip?: boolean
}): boolean {
  return Boolean(params.forceShowSkip || params.canSkip)
}

export function buildDingtalkOfficialSetupLog(result: DingtalkOfficialSetupResult): string {
  const lines: string[] = []

  for (const item of result.evidence) {
    const isGatewayFailure = item.source === 'gateway' && result.gatewayResult?.running !== true
    lines.push(`${isGatewayFailure ? '⚠️' : '✅'} ${item.message}`)
    if (item.jsonPaths && item.jsonPaths.length > 0) {
      lines.push(`变更路径：${item.jsonPaths.join(', ')}`)
    }
    lines.push('')
  }

  if (!result.ok && result.message) {
    lines.push(`❌ ${result.message}`)
    lines.push('')
  }

  return lines.join('\n')
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function listPluginCleanupTargets(channel: { plugin?: { cleanupPluginIds?: string[] } } | null | undefined): string[] {
  const seen = new Set<string>()
  const cleanupTargets: string[] = []
  for (const pluginId of channel?.plugin?.cleanupPluginIds || []) {
    const normalizedPluginId = String(pluginId || '').trim()
    if (!normalizedPluginId || seen.has(normalizedPluginId)) continue
    seen.add(normalizedPluginId)
    cleanupTargets.push(normalizedPluginId)
  }
  return cleanupTargets
}

export function captureFeishuBotConfigSnapshot(
  config: Record<string, any> | null
): Record<string, any> | null {
  if (listFeishuBots(config).length === 0) return null

  const feishuConfig = config?.channels?.feishu
  if (!feishuConfig || typeof feishuConfig !== 'object' || Array.isArray(feishuConfig)) {
    return null
  }

  return cloneJsonValue(feishuConfig)
}

export function restoreCapturedFeishuBotConfig(
  config: Record<string, any> | null,
  feishuConfigSnapshot: Record<string, any> | null
): Record<string, any> {
  const nextConfig =
    config && typeof config === 'object' && !Array.isArray(config)
      ? cloneJsonValue(config)
      : {}

  if (!feishuConfigSnapshot) return nextConfig

  if (!nextConfig.channels || typeof nextConfig.channels !== 'object' || Array.isArray(nextConfig.channels)) {
    nextConfig.channels = {}
  }

  nextConfig.channels.feishu = cloneJsonValue(feishuConfigSnapshot)
  return nextConfig
}

function normalizeFeishuConfigText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readFeishuBotCredentials(
  config: Record<string, any> | null,
  accountId: string
): { name: string; appId: string; appSecret: string } | null {
  const feishu = config?.channels?.feishu
  if (!feishu || typeof feishu !== 'object' || Array.isArray(feishu)) {
    return null
  }

  if (accountId === 'default') {
    const appId = normalizeFeishuConfigText(feishu.appId)
    const appSecret = normalizeFeishuConfigText(feishu.appSecret)
    if (!appId || !appSecret) return null
    return {
      name: normalizeFeishuConfigText(feishu.name),
      appId,
      appSecret,
    }
  }

  const account = feishu.accounts?.[accountId]
  if (!account || typeof account !== 'object' || Array.isArray(account)) {
    return null
  }

  const appId = normalizeFeishuConfigText(account.appId)
  const appSecret = normalizeFeishuConfigText(account.appSecret)
  if (!appId || !appSecret) return null

  return {
    name: normalizeFeishuConfigText(account.name),
    appId,
    appSecret,
  }
}

export function mergeFeishuCreateModeBots(params: {
  currentConfig: Record<string, any> | null
  previousFeishuConfigSnapshot: Record<string, any> | null | undefined
}): {
  nextConfig: Record<string, any>
  addedBots: Array<{ accountId: string; accountName: string; appId: string }>
} {
  const currentConfig =
    params.currentConfig && typeof params.currentConfig === 'object' && !Array.isArray(params.currentConfig)
      ? cloneJsonValue(params.currentConfig)
      : {}
  const previousSnapshot = params.previousFeishuConfigSnapshot
    ? cloneJsonValue(params.previousFeishuConfigSnapshot)
    : null

  if (!previousSnapshot) {
    return {
      nextConfig: currentConfig,
      addedBots: [],
    }
  }

  const previousBots = listFeishuBots(wrapFeishuConfigSnapshot(previousSnapshot))
  const currentBots = listFeishuBots(currentConfig)
  if (previousBots.length === 0 || currentBots.length === 0) {
    return {
      nextConfig: currentConfig,
      addedBots: [],
    }
  }

  const previousAppIds = new Set(previousBots.map((bot) => bot.appId.trim().toLowerCase()))
  const incomingBots = currentBots.filter((bot) => !previousAppIds.has(bot.appId.trim().toLowerCase()))
  if (incomingBots.length === 0) {
    return {
      nextConfig: currentConfig,
      addedBots: [],
    }
  }

  let nextConfig = restoreCapturedFeishuBotConfig(currentConfig, previousSnapshot)
  const addedBots: Array<{ accountId: string; accountName: string; appId: string }> = []
  const mergedAppIds = new Set(previousAppIds)

  for (const bot of incomingBots) {
    const credentials = readFeishuBotCredentials(currentConfig, bot.accountId)
    if (!credentials) continue

    const normalizedAppId = credentials.appId.trim().toLowerCase()
    if (mergedAppIds.has(normalizedAppId)) continue

    const added = addFeishuBotConfig(nextConfig, {
      name: credentials.name || bot.name,
      appId: credentials.appId,
      appSecret: credentials.appSecret,
      provisionSource: 'created',
    })
    nextConfig = added.nextConfig
    const matchedBot = listFeishuBots(nextConfig).find((candidate) => candidate.accountId === added.accountId)
    addedBots.push({
      accountId: added.accountId,
      accountName: matchedBot?.name || credentials.name || bot.name || `Bot ${added.accountId}`,
      appId: credentials.appId,
    })
    mergedAppIds.add(normalizedAppId)
  }

  return {
    nextConfig,
    addedBots,
  }
}

export function canFinishFeishuCreateMode(
  hasExistingBotConfig: boolean,
  manualCredentialsReady: boolean
): boolean {
  return hasExistingBotConfig || manualCredentialsReady
}

export function canFinishFeishuLinkMode(
  finishStrategy: 'manual' | 'existing' | 'invalid-manual' | 'none'
): boolean {
  return finishStrategy === 'manual' || finishStrategy === 'existing'
}

export function shouldSkipFeishuPairingAfterSetup(
  _setupMode: FeishuPathMode
): boolean {
  return false
}

export function hasFeishuManualCredentialInput(formData: Record<string, string>): boolean {
  return Boolean(String(formData.appId || '').trim() || String(formData.appSecret || '').trim())
}

export function resolveFeishuLinkModeFinishStrategy(
  sourceMode: 'existing' | 'manual',
  existingBotCount: number,
  hasManualCredentialInput: boolean,
  manualCredentialsReady: boolean
): 'manual' | 'existing' | 'invalid-manual' | 'none' {
  if (sourceMode === 'existing') {
    return existingBotCount > 0 ? 'existing' : 'none'
  }

  if (hasManualCredentialInput) {
    return manualCredentialsReady ? 'manual' : 'invalid-manual'
  }

  return 'none'
}

export function resolveFeishuCreateModeFinishStrategy(
  existingBotCount: number,
  hasManualCredentialInput: boolean,
  manualCredentialsReady: boolean
): 'manual' | 'existing' | 'invalid-manual' | 'none' {
  if (hasManualCredentialInput) {
    return manualCredentialsReady ? 'manual' : 'invalid-manual'
  }

  if (existingBotCount > 0) {
    return 'existing'
  }

  return 'none'
}

export function resolveFeishuPreparedLinkSourceMode(
  existingBotCount: number
): FeishuLinkSourceMode {
  return existingBotCount > 0 ? 'existing' : 'manual'
}

export function resolveFeishuPreparedLinkNotice(params: {
  prefix: string
  existingBotCount: number
}): string {
  return params.existingBotCount > 0
    ? `${params.prefix}现在可以继续关联已有机器人；你可以直接复用已检测到的机器人，也可以切到手动模式输入 App ID / App Secret；完成机器人配置后，再继续输入飞书配对码。`
    : `${params.prefix}现在可以手动填写已有机器人的 App ID / App Secret；完成机器人配置后，再继续输入飞书配对码。`
}

export function resolveFeishuPreparedLinkRecovery(params: {
  normalizedConfig?: Record<string, any> | null
  fallbackExistingBotCount?: number
  prefix: string
}): {
  existingBotCount: number
  sourceMode: FeishuLinkSourceMode
  notice: string
  createStartConfigSnapshot: null
} {
  const fallbackExistingBotCount = Math.max(0, Number(params.fallbackExistingBotCount || 0))
  const existingBotCount = params.normalizedConfig
    ? listFeishuBots(params.normalizedConfig).length
    : fallbackExistingBotCount

  return {
    existingBotCount,
    sourceMode: resolveFeishuPreparedLinkSourceMode(existingBotCount),
    notice: resolveFeishuPreparedLinkNotice({
      prefix: params.prefix,
      existingBotCount,
    }),
    createStartConfigSnapshot: null,
  }
}

export function shouldValidateFeishuManualCredentials(
  setupMode: 'create' | 'link',
  hasManualCredentialInput: boolean,
  manualCredentialsReady: boolean
): boolean {
  return setupMode === 'link' && hasManualCredentialInput && manualCredentialsReady
}

export type FeishuManualBindingPreparePhase =
  | 'idle'
  | 'checking'
  | 'syncing'
  | 'installing'
  | 'verifying'

interface FeishuManualBindingPluginStateLike {
  installedOnDisk: boolean
  officialPluginConfigured: boolean
  configChanged: boolean
}

export function isFeishuManualBindingReady(
  state: Pick<FeishuManualBindingPluginStateLike, 'installedOnDisk' | 'officialPluginConfigured'>
): boolean {
  return state.installedOnDisk && state.officialPluginConfigured
}

export function canPrepareFeishuManualBindingWithoutInstall(
  state: FeishuManualBindingPluginStateLike
): boolean {
  return state.installedOnDisk && (state.officialPluginConfigured || state.configChanged)
}

type FeishuAutoRecoveryTarget = 'wait' | 'heal-config' | 'recover-manual' | 'recover-create'

export function hasRecoveredFeishuCreateMode(params: {
  previousFeishuConfigSnapshot?: Record<string, any> | null
  nextConfig: Record<string, any> | null
}): boolean {
  const nextBots = listFeishuBots(params.nextConfig)
  if (nextBots.length === 0) return false

  const previousBots = listFeishuBots(wrapFeishuConfigSnapshot(params.previousFeishuConfigSnapshot))
  if (previousBots.length === 0) return true

  const previousAppIds = new Set(previousBots.map((bot) => bot.appId.trim().toLowerCase()))
  return nextBots.some((bot) => !previousAppIds.has(bot.appId.trim().toLowerCase()))
}

export function resolveFeishuAutoRecoveryTarget(params: {
  setupMode: 'create' | 'link'
  pluginState: FeishuManualBindingPluginStateLike
  nextConfig: Record<string, any> | null
  previousFeishuConfigSnapshot?: Record<string, any> | null
}): FeishuAutoRecoveryTarget {
  if (params.setupMode === 'create') {
    return hasRecoveredFeishuCreateMode({
      previousFeishuConfigSnapshot: params.previousFeishuConfigSnapshot,
      nextConfig: params.nextConfig,
    })
      ? 'recover-create'
      : 'wait'
  }

  if (isFeishuManualBindingReady(params.pluginState)) {
    return 'recover-manual'
  }

  if (canPrepareFeishuManualBindingWithoutInstall(params.pluginState) && params.pluginState.configChanged) {
    return 'heal-config'
  }

  return 'wait'
}

async function cancelBackgroundFeishuPluginInstall(): Promise<void> {
  try {
    await window.api.cancelCommandDomain('plugin-install')
  } catch {
    // Best effort only; the recovered UI state should not depend on process cancellation succeeding.
  }
}

async function stopBackgroundFeishuInstaller(): Promise<void> {
  try {
    await window.api.stopFeishuInstaller()
  } catch {
    // Best effort only; the recovered UI state should not depend on installer shutdown succeeding.
  }
}

export function resolveFeishuManualBindingPreparationCopy(
  phase: FeishuManualBindingPreparePhase
): { title: string; description: string; hint?: string } {
  if (phase === 'checking') {
    return {
      title: '正在检查飞书官方插件',
      description: '先确认当前机器上是否已经有可复用的飞书官方插件和必要配置。',
    }
  }

  if (phase === 'syncing') {
    return {
      title: '正在同步飞书插件配置',
      description: '检测到官方插件已存在，正在补齐 Mclaw 需要的配置，随后直接进入手动绑定。',
    }
  }

  if (phase === 'installing') {
    return {
      title: '正在安装飞书官方插件',
      description: '当前环境还没有飞书官方插件，正在通过 npx 下载并安装。',
      hint: '首次安装通常最慢，可能需要 1 到 3 分钟，请耐心等待。',
    }
  }

  if (phase === 'verifying') {
    return {
      title: '正在验证插件状态',
      description: '安装或同步已经完成，正在做最后一次状态确认，马上切到手动绑定表单。',
    }
  }

  return {
    title: '准备关联已有机器人',
    description: '正在初始化飞书官方插件检查流程。',
  }
}

export function resolveFeishuManualBindingPreparationStatus(
  phase: FeishuManualBindingPreparePhase
): { color: string; label: string; detail: string } {
  const copy = resolveFeishuManualBindingPreparationCopy(phase)
  const detail = [copy.description, copy.hint].filter(Boolean).join(' ')

  if (phase === 'checking') {
    return {
      color: 'warning',
      label: '检查插件中',
      detail,
    }
  }

  if (phase === 'syncing') {
    return {
      color: 'warning',
      label: '同步配置中',
      detail,
    }
  }

  if (phase === 'installing') {
    return {
      color: 'warning',
      label: '安装插件中',
      detail,
    }
  }

  if (phase === 'verifying') {
    return {
      color: 'blue',
      label: '验证状态中',
      detail,
    }
  }

  return {
    color: 'warning',
    label: '准备中',
    detail,
  }
}

export function resolveSelectedFeishuExistingBotAccountId(
  bots: Array<{ accountId: string }>,
  selectedAccountId?: string | null
): string {
  const normalizedSelectedAccountId = String(selectedAccountId || '').trim()
  if (
    normalizedSelectedAccountId
    && bots.some((bot) => bot.accountId === normalizedSelectedAccountId)
  ) {
    return normalizedSelectedAccountId
  }

  return String(bots[0]?.accountId || '').trim()
}

function wrapFeishuConfigSnapshot(
  feishuConfigSnapshot: Record<string, any> | null | undefined
): Record<string, any> | null {
  if (!feishuConfigSnapshot) return null
  return {
    channels: {
      feishu: cloneJsonValue(feishuConfigSnapshot),
    },
  }
}

export function resolveFeishuPairingTarget(params: {
  setupMode: 'create' | 'link'
  finishStrategy: 'manual' | 'existing' | 'invalid-manual' | 'none'
  previousFeishuConfigSnapshot?: Record<string, any> | null
  nextConfig: Record<string, any> | null
  manualAppId?: string
  manualBotName?: string
  selectedAccountId?: string
}): { accountId: string; accountName: string } | null {
  const nextBots = listFeishuBots(params.nextConfig)
  if (nextBots.length === 0) return null

  if (params.setupMode === 'link') {
    const selected = nextBots.find((bot) => bot.accountId === params.selectedAccountId)
    return selected ? { accountId: selected.accountId, accountName: selected.name } : null
  }

  if (params.finishStrategy === 'manual') {
    const manualAppId = String(params.manualAppId || '').trim().toLowerCase()
    const matchedBot = nextBots.find((bot) => bot.appId.trim().toLowerCase() === manualAppId)
    if (matchedBot) {
      return { accountId: matchedBot.accountId, accountName: matchedBot.name }
    }
  }

  const previousBots = listFeishuBots(wrapFeishuConfigSnapshot(params.previousFeishuConfigSnapshot))
  const previousAccountIds = new Set(previousBots.map((bot) => bot.accountId))
  const previousAppIds = new Set(previousBots.map((bot) => bot.appId.trim().toLowerCase()))
  const newBots = nextBots.filter(
    (bot) => !previousAccountIds.has(bot.accountId) || !previousAppIds.has(bot.appId.trim().toLowerCase())
  )

  const preferredNewBot = newBots.find((bot) => !bot.isDefault) || newBots[0]
  if (preferredNewBot) {
    return { accountId: preferredNewBot.accountId, accountName: preferredNewBot.name }
  }

  const onlyBot = nextBots.length === 1 ? nextBots[0] : null
  if (onlyBot) {
    return { accountId: onlyBot.accountId, accountName: onlyBot.name }
  }

  const defaultBot = nextBots.find((bot) => bot.accountId === 'default') || nextBots[0]
  return defaultBot ? { accountId: defaultBot.accountId, accountName: defaultBot.name } : null
}

export async function ensureGatewayReadyForChannelConnect(
  api: ChannelConnectGatewayReadyApi,
  appendLog: (message: string) => void,
  options?: { channelId?: string; allowPendingManagedReady?: boolean }
): Promise<{ ok: boolean; message?: string }> {
  const result = await api.reloadGatewayAfterChannelChange()
  const running = 'running' in result && result.running === true
  const summary =
    'summary' in result && typeof result.summary === 'string'
      ? result.summary
      : ''
  if (!result.ok || !running) {
    const managedChannelId = String(options?.channelId || '').trim()
    const managedChannel = managedChannelId
      ? getManagedChannelPluginByChannelId(managedChannelId)
      : null
    const skipTargetedManagedRepair = managedChannel
      ? shouldSkipTargetedManagedRepair(managedChannel.channelId)
      : false
    const stateCode =
      'stateCode' in result && typeof result.stateCode === 'string'
        ? result.stateCode
        : ''
    if (
      managedChannel
      && isRepairableChannelConnectGatewayStateCode(stateCode)
      && api.ensureGatewayRunning
      && api.getManagedChannelPluginStatus
      && (skipTargetedManagedRepair || api.repairManagedChannelPlugin)
    ) {
      if (!skipTargetedManagedRepair) {
        const repairResult = await api.repairManagedChannelPlugin!(managedChannel.channelId)
        if (repairResult.kind !== 'ok') {
          return {
            ok: false,
            message: getManagedChannelRepairFailureMessage(repairResult),
          }
        }
      }

      const ensureResult = await api.ensureGatewayRunning({ skipRuntimePrecheck: true })
      if (!ensureResult.ok || ensureResult.running !== true) {
        return {
          ok: false,
          message: getGatewayReadyFailureMessage(ensureResult),
        }
      }

      if (
        ensureResult.autoPortMigrated === true &&
        typeof ensureResult.effectivePort === 'number'
      ) {
        appendLog(`⚠️ Gateway 端口已自动切换到 ${ensureResult.effectivePort}，程序会继续使用新端口。\n\n`)
      }

      const statusCheck = await confirmManagedChannelStatusAfterGatewayReady(
        api,
        managedChannel.channelId,
        { requireStatus: true }
      )
      if (!statusCheck.ok) {
        return statusCheck
      }

      return { ok: true }
    }

    return {
      ok: false,
      message: getGatewayReadyFailureMessage(result),
    }
  }

  if (
    'autoPortMigrated' in result &&
    result.autoPortMigrated === true &&
    'effectivePort' in result &&
    typeof result.effectivePort === 'number'
  ) {
    appendLog(`⚠️ Gateway 端口已自动切换到 ${result.effectivePort}，程序会继续使用新端口。\n\n`)
  }

  const managedChannelId = String(options?.channelId || '').trim()
  if (managedChannelId) {
    const statusCheck = await confirmManagedChannelStatusAfterGatewayReady(
      api,
      managedChannelId
    )
    if (!statusCheck.ok) {
      return statusCheck
    }
  }

  return { ok: true }
}

export function canFinalizeWeixinSetup(params: {
  configuredAccounts: Array<{ configured: boolean }>
}): boolean {
  return params.configuredAccounts.some((account) => account.configured)
}

export default function ChannelConnect({
  onNext,
  onBack,
  onSkip,
  setupModelContext,
  initialChannelId,
  forceShowSkip = false,
}: {
  onNext: (payload: ChannelConnectNextPayload) => void
  onBack: () => void
  onSkip: () => void
  setupModelContext: SetupModelContext | null
  initialChannelId?: string
  forceShowSkip?: boolean
}) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(initialChannelId || '')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Status>('form')
  const [log, setLog] = useState('')
  const [error, setError] = useState('')
  const [canSkip, setCanSkip] = useState(false)
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const [bindingMode, setBindingMode] = useState<'qr' | 'manual'>('qr')
  const [feishuBots, setFeishuBots] = useState<ReturnType<typeof listFeishuBots>>([])
  const [pairingStatusByBot, setPairingStatusByBot] = useState<Record<string, { pairedCount: number; pairedUsers: string[] }>>({})
  const [feishuBotSetupMode, setFeishuBotSetupMode] = useState<'create' | 'link'>('create')
  const [feishuOfficialPluginInstalled, setFeishuOfficialPluginInstalled] = useState(false)
  const [feishuOfficialPluginConfigured, setFeishuOfficialPluginConfigured] = useState(false)
  const [feishuOfficialPluginConfigChanged, setFeishuOfficialPluginConfigChanged] = useState(false)
  const [feishuOfficialPluginBundledPayloadAvailable, setFeishuOfficialPluginBundledPayloadAvailable] = useState(false)
  const [feishuLinkSourceMode, setFeishuLinkSourceMode] = useState<FeishuLinkSourceMode>('existing')
  const [selectedFeishuExistingBotAccountId, setSelectedFeishuExistingBotAccountId] = useState('')
  const [feishuOfficialCliStatus, setFeishuOfficialCliStatus] = useState<FeishuOfficialCliStatusView | null>(null)
  const [showFeishuOfficialCliAdvanced, setShowFeishuOfficialCliAdvanced] = useState(false)
  const [feishuOfficialCliSessionId, setFeishuOfficialCliSessionId] = useState('')
  const [feishuOfficialCliSessionMode, setFeishuOfficialCliSessionMode] = useState<FeishuOfficialCliSessionMode | null>(null)
  const [feishuOfficialCliSessionRunning, setFeishuOfficialCliSessionRunning] = useState(false)
  const [feishuOfficialCliSessionOutput, setFeishuOfficialCliSessionOutput] = useState('')
  const [feishuOfficialCliSessionExitCode, setFeishuOfficialCliSessionExitCode] = useState<number | null>(null)
  const [feishuOfficialCliSessionCanceled, setFeishuOfficialCliSessionCanceled] = useState(false)
  const [feishuOfficialCliSessionBusy, setFeishuOfficialCliSessionBusy] = useState(false)
  const [feishuOfficialCliSessionInput, setFeishuOfficialCliSessionInput] = useState('')
  const [feishuOfficialCliSessionLatestAuthUrl, setFeishuOfficialCliSessionLatestAuthUrl] = useState('')
  const [feishuOfficialCliSessionLatestUserCode, setFeishuOfficialCliSessionLatestUserCode] = useState('')
  const [feishuOfficialCliSessionNotice, setFeishuOfficialCliSessionNotice] = useState('')
  const [feishuInstallerSessionId, setFeishuInstallerSessionId] = useState('')
  const [feishuInstallerRunning, setFeishuInstallerRunning] = useState(false)
  const [feishuInstallerOutput, setFeishuInstallerOutput] = useState('')
  const [feishuInstallerExitCode, setFeishuInstallerExitCode] = useState<number | null>(null)
  const [feishuInstallerCanceled, setFeishuInstallerCanceled] = useState(false)
  const [feishuInstallerBusy, setFeishuInstallerBusy] = useState(false)
  const [feishuInstallerInput, setFeishuInstallerInput] = useState('')
  const [feishuInstallerNotice, setFeishuInstallerNotice] = useState('')
  const [showFeishuInstallTutorial, setShowFeishuInstallTutorial] = useState(false)
  const [finishingFeishuSetup, setFinishingFeishuSetup] = useState(false)
  const [refreshingFeishuState, setRefreshingFeishuState] = useState(false)
  const [preparingFeishuManualBinding, setPreparingFeishuManualBinding] = useState(false)
  const [feishuManualBindingPreparePhase, setFeishuManualBindingPreparePhase] =
    useState<FeishuManualBindingPreparePhase>('idle')
  const [weixinInstallerSessionId, setWeixinInstallerSessionId] = useState('')
  const [weixinInstallerRunning, setWeixinInstallerRunning] = useState(false)
  const [weixinInstallerOutput, setWeixinInstallerOutput] = useState('')
  const [weixinInstallerExitCode, setWeixinInstallerExitCode] = useState<number | null>(null)
  const [weixinInstallerCanceled, setWeixinInstallerCanceled] = useState(false)
  const [weixinInstallerBusy, setWeixinInstallerBusy] = useState(false)
  const [finishingWeixinSetup, setFinishingWeixinSetup] = useState(false)
  const [weixinInstallerNewAccountIds, setWeixinInstallerNewAccountIds] = useState<string[]>([])

  // WeChat Work QR binding state
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrAuthUrl, setQrAuthUrl] = useState('')
  const [qrStatus, setQrStatus] = useState<'loading' | 'ready' | 'scanned' | 'error'>('loading')
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qrResolveRef = useRef<((result: { botId: string; secret: string } | null) => void) | null>(null)
  const feishuInstallerPromptAutoReplyKeyRef = useRef('')
  const feishuInstallerOutputRef = useRef('')
  const feishuCreateStartConfigSnapshotRef = useRef<Record<string, any> | null>(null)
  const feishuManualBindingRequestVersionRef = useRef(0)

  // Track completed phases so retry skips plugin install
  const pluginInstalledRef = useRef(false)

  const selectedChannel = getChannelDefinition(selectedChannelId)
  const channelValidation = validateChannelForm(selectedChannel, formData)
  const canConnect = !!selectedChannel && (
    (selectedChannel.useQrBinding && bindingMode === 'qr') ||
    channelValidation.ok
  )
  const feishuBotsOrdered = useMemo(
    () =>
      [...feishuBots].sort((left, right) => {
        const leftPaired = pairingStatusByBot[left.accountId]?.pairedCount || 0
        const rightPaired = pairingStatusByBot[right.accountId]?.pairedCount || 0
        if ((leftPaired > 0) !== (rightPaired > 0)) return leftPaired > 0 ? -1 : 1
        if (leftPaired !== rightPaired) return rightPaired - leftPaired
        if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
        return left.name.localeCompare(right.name, 'zh-CN')
      }),
    [feishuBots, pairingStatusByBot]
  )
  const resolvedSelectedFeishuExistingBotAccountId = useMemo(
    () => resolveSelectedFeishuExistingBotAccountId(feishuBotsOrdered, selectedFeishuExistingBotAccountId),
    [feishuBotsOrdered, selectedFeishuExistingBotAccountId]
  )
  const selectedFeishuExistingBot = useMemo(
    () => feishuBotsOrdered.find((bot) => bot.accountId === resolvedSelectedFeishuExistingBotAccountId) || null,
    [feishuBotsOrdered, resolvedSelectedFeishuExistingBotAccountId]
  )
  const selectedFeishuExistingBotMeta = useMemo(() => {
    if (!selectedFeishuExistingBot) return ''
    const pairedCount = pairingStatusByBot[selectedFeishuExistingBot.accountId]?.pairedCount || 0
    return [
      selectedFeishuExistingBot.accountId,
      selectedFeishuExistingBot.isDefault ? 'default' : '',
      pairedCount > 0 ? `${pairedCount} paired` : '',
    ].filter(Boolean).join(' · ')
  }, [pairingStatusByBot, selectedFeishuExistingBot])
  const feishuInstallerAsciiQr = useMemo(
    () => extractFeishuAsciiQr(feishuInstallerOutput),
    [feishuInstallerOutput]
  )
  const weixinInstallerAsciiQr = useMemo(
    () => extractAsciiQrBlock(weixinInstallerOutput),
    [weixinInstallerOutput]
  )
  const feishuManualBindingPreparationCopy = useMemo(
    () => resolveFeishuManualBindingPreparationCopy(feishuManualBindingPreparePhase),
    [feishuManualBindingPreparePhase]
  )
  const feishuInstallerQrUrl = useMemo(
    () => extractFeishuLiveQrUrl(feishuInstallerOutput),
    [feishuInstallerOutput]
  )
  const feishuManualCredentialsReady =
    selectedChannel?.id === 'feishu' &&
    feishuBotSetupMode === 'link' &&
    channelValidation.ok
  const feishuHasManualCredentialInput =
    selectedChannel?.id === 'feishu' &&
    feishuBotSetupMode === 'link' &&
    hasFeishuManualCredentialInput(formData)
  const feishuCreateModeFinishStrategy = resolveFeishuCreateModeFinishStrategy(
    feishuBotsOrdered.length,
    Boolean(feishuHasManualCredentialInput),
    Boolean(feishuManualCredentialsReady)
  )
  const feishuLinkModeFinishStrategy = resolveFeishuLinkModeFinishStrategy(
    feishuLinkSourceMode,
    feishuBotsOrdered.length,
    Boolean(feishuHasManualCredentialInput),
    Boolean(feishuManualCredentialsReady)
  )
  const feishuCreateModeCanFinish = canFinishFeishuCreateMode(
    feishuBotsOrdered.length > 0,
    Boolean(feishuManualCredentialsReady)
  )
  const feishuLinkModeCanFinish = canFinishFeishuLinkMode(
    feishuLinkModeFinishStrategy
  )
  const showInlineFeishuManualError =
    status === 'form' &&
    selectedChannel?.id === 'feishu' &&
    feishuBotSetupMode === 'link' &&
    feishuLinkSourceMode === 'manual' &&
    Boolean(error)
  const feishuCreatePathStatus = resolveFeishuCreatePathStatus({
    finishingSetup: finishingFeishuSetup,
    botCount: feishuBotsOrdered.length,
    installerRunning: feishuInstallerRunning,
    installerOutput: feishuInstallerOutput,
  })
  const feishuLinkPathStatus = resolveFeishuLinkPathStatus({
    finishingSetup: finishingFeishuSetup,
    preparingManualBinding: preparingFeishuManualBinding,
    manualBindingPreparePhase: feishuManualBindingPreparePhase,
    linkSourceMode: feishuLinkSourceMode,
    selectedExistingBotName: selectedFeishuExistingBot?.name,
    manualCredentialsReady: Boolean(feishuManualCredentialsReady),
    manualCredentialInput: Boolean(feishuHasManualCredentialInput),
    botCount: feishuBotsOrdered.length,
    officialPluginInstalled: feishuOfficialPluginInstalled,
    officialPluginConfigured: feishuOfficialPluginConfigured,
    officialPluginConfigChanged: feishuOfficialPluginConfigChanged,
  })
  const feishuLinkPathPanelIntro = resolveFeishuLinkPathPanelIntro({
    botCount: feishuBotsOrdered.length,
    linkSourceMode: feishuLinkSourceMode,
    officialPluginInstalled: feishuOfficialPluginInstalled,
    officialPluginConfigured: feishuOfficialPluginConfigured,
    officialPluginConfigChanged: feishuOfficialPluginConfigChanged,
  })
  const feishuCreatePathCardActions = resolveFeishuCreatePathCardActions({
    finishingSetup: finishingFeishuSetup,
    createCanFinish: feishuCreateModeCanFinish && feishuCreateModeFinishStrategy !== 'invalid-manual',
    installerRunning: feishuInstallerRunning,
    installerOutput: feishuInstallerOutput,
  })
  const feishuLinkPathCardActions = resolveFeishuLinkPathCardActions({
    finishingSetup: finishingFeishuSetup,
    preparingManualBinding: preparingFeishuManualBinding,
    linkCanFinish: feishuLinkModeCanFinish,
    linkSourceMode: feishuLinkSourceMode,
    botCount: feishuBotsOrdered.length,
    manualCredentialInput: Boolean(feishuHasManualCredentialInput),
  })
  const feishuPathDescriptors = resolveFeishuPathDescriptors()
  const feishuCreatePathDescriptor =
    feishuPathDescriptors.find((item) => item.mode === 'create') || feishuPathDescriptors[0]
  const feishuLinkPathDescriptor =
    feishuPathDescriptors.find((item) => item.mode === 'link') || feishuPathDescriptors[1]
  const feishuPathNavigatorItems = resolveFeishuPathNavigatorItems(feishuBotSetupMode)
  const feishuOfficialCliSessionStatus = resolveFeishuOfficialCliSessionStatus({
    mode: feishuOfficialCliSessionMode,
    running: feishuOfficialCliSessionRunning,
    exitCode: feishuOfficialCliSessionExitCode,
    canceled: feishuOfficialCliSessionCanceled,
    authState: feishuOfficialCliStatus?.authState,
    hasAuthUrl: Boolean(feishuOfficialCliSessionLatestAuthUrl),
    hasUserCode: Boolean(feishuOfficialCliSessionLatestUserCode),
  })
  const feishuOfficialCliNextStep = resolveFeishuOfficialOnboardingNextStep({
    cliAvailable: feishuOfficialCliStatus?.available,
    authState: feishuOfficialCliStatus?.authState,
    sessionMode: feishuOfficialCliSessionMode,
    sessionRunning: feishuOfficialCliSessionRunning,
    sessionExitCode: feishuOfficialCliSessionExitCode,
    sessionCanceled: feishuOfficialCliSessionCanceled,
    hasAuthUrl: Boolean(feishuOfficialCliSessionLatestAuthUrl),
    hasUserCode: Boolean(feishuOfficialCliSessionLatestUserCode),
    setupMode: feishuBotSetupMode,
    pluginInstalled: feishuOfficialPluginInstalled,
    officialPluginConfigured: feishuOfficialPluginConfigured,
    pluginConfigChanged: feishuOfficialPluginConfigChanged,
    bundledPayloadAvailable: feishuOfficialPluginBundledPayloadAvailable,
    botCount: feishuBotsOrdered.length,
    installerRunning: feishuInstallerRunning,
    installerOutput: feishuInstallerOutput,
    preparingManualBinding: preparingFeishuManualBinding,
    manualCredentialInput: Boolean(feishuHasManualCredentialInput),
    manualCredentialsReady: Boolean(feishuManualCredentialsReady),
    createCanFinish: feishuCreateModeCanFinish && feishuCreateModeFinishStrategy !== 'invalid-manual',
    linkCanFinish: feishuLinkModeCanFinish,
    linkSourceMode: feishuLinkSourceMode,
    selectedExistingBotName: selectedFeishuExistingBot?.name,
  })
  const feishuOfficialCliNextStepSummary = resolveFeishuOfficialOnboardingSummary({
    setupMode: feishuBotSetupMode,
    linkSourceMode: feishuLinkSourceMode,
    botCount: feishuBotsOrdered.length,
    selectedExistingBotName: selectedFeishuExistingBot?.name,
    pluginInstalled: feishuOfficialPluginInstalled,
    officialPluginConfigured: feishuOfficialPluginConfigured,
    pluginConfigChanged: feishuOfficialPluginConfigChanged,
  })
  const feishuOfficialCliClipboardAvailable =
    typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function'
  const feishuOfficialCliNextStepBlockers = resolveFeishuOfficialOnboardingBlockers({
    cliAvailable: feishuOfficialCliStatus?.available,
    authState: feishuOfficialCliStatus?.authState,
    sessionMode: feishuOfficialCliSessionMode,
    sessionRunning: feishuOfficialCliSessionRunning,
    hasAuthUrl: Boolean(feishuOfficialCliSessionLatestAuthUrl),
    hasUserCode: Boolean(feishuOfficialCliSessionLatestUserCode),
    clipboardAvailable: feishuOfficialCliClipboardAvailable,
    setupMode: feishuBotSetupMode,
    botCount: feishuBotsOrdered.length,
    installerRunning: feishuInstallerRunning,
    installerOutput: feishuInstallerOutput,
    preparingManualBinding: preparingFeishuManualBinding,
    manualBindingPreparePhase: feishuManualBindingPreparePhase,
    manualCredentialInput: Boolean(feishuHasManualCredentialInput),
    manualCredentialsReady: Boolean(feishuManualCredentialsReady),
    createCanFinish: feishuCreateModeCanFinish && feishuCreateModeFinishStrategy !== 'invalid-manual',
    linkCanFinish: feishuLinkModeCanFinish,
    linkSourceMode: feishuLinkSourceMode,
  })
  const feishuOfficialCliLiveAssist = resolveFeishuOfficialOnboardingLiveAssist({
    sessionMode: feishuOfficialCliSessionMode,
    sessionRunning: feishuOfficialCliSessionRunning,
    latestAuthUrl: feishuOfficialCliSessionLatestAuthUrl,
    latestUserCode: feishuOfficialCliSessionLatestUserCode,
    clipboardAvailable: feishuOfficialCliClipboardAvailable,
  })
  const feishuOfficialCliGuidedFlowActions = resolveFeishuOfficialCliGuidedFlowActions({
    authState: feishuOfficialCliStatus?.authState,
    sessionMode: feishuOfficialCliSessionMode,
    sessionRunning: feishuOfficialCliSessionRunning,
    sessionExitCode: feishuOfficialCliSessionExitCode,
    sessionCanceled: feishuOfficialCliSessionCanceled,
  })
  const feishuOfficialCliGuidedFlowPurpose = resolveFeishuOfficialCliGuidedFlowPurpose({
    authState: feishuOfficialCliStatus?.authState,
    sessionMode: feishuOfficialCliSessionMode,
    sessionRunning: feishuOfficialCliSessionRunning,
  })

  useEffect(() => {
    if (!feishuOfficialCliStatus?.available) {
      setShowFeishuOfficialCliAdvanced(false)
    }
  }, [feishuOfficialCliStatus?.available])

  const applyFeishuInstallerSnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof window.api.getFeishuInstallerState>>) => {
      const output = String(snapshot.output || '')
      const outputState = resolveFeishuInstallerOutputState(output)
      const nextSessionId = snapshot.sessionId || ''
      const shouldResetEphemeralState = shouldResetFeishuSessionDraftOnSnapshot({
        currentSessionId: feishuInstallerSessionId,
        nextSessionId,
        active: snapshot.active,
      })
      feishuInstallerOutputRef.current = output
      setFeishuInstallerSessionId(nextSessionId)
      setFeishuInstallerRunning(snapshot.active)
      setFeishuInstallerOutput(output)
      setFeishuInstallerExitCode(snapshot.code ?? null)
      setFeishuInstallerCanceled(Boolean(snapshot.canceled))
      if (shouldResetEphemeralState) {
        feishuInstallerPromptAutoReplyKeyRef.current = ''
        setFeishuInstallerInput('')
      }
      setFeishuInstallerNotice(
        snapshot.active
          ? resolveFeishuInstallerSessionLiveNotice({
              running: true,
              hasLiveQr: outputState.hasLiveQr,
              hasOutput: outputState.hasOutput,
            })
          : resolveFeishuInstallerSessionExitNotice({
              canceled: Boolean(snapshot.canceled),
              exitCode: snapshot.code ?? null,
            })
      )
    },
    [feishuInstallerSessionId]
  )

  const applyFeishuOfficialCliSessionSnapshot = useCallback(
    (
      snapshot: FeishuOfficialCliSessionView,
      authStateOverride?: FeishuOfficialCliStatusView['authState'] | null
    ) => {
      const latestAuthUrl = String(snapshot.latestAuthUrl || '').trim()
      const latestUserCode = String(snapshot.latestUserCode || '').trim()
      const nextSessionId = snapshot.sessionId || ''
      setFeishuOfficialCliSessionId(nextSessionId)
      setFeishuOfficialCliSessionMode(snapshot.mode || null)
      setFeishuOfficialCliSessionRunning(snapshot.active)
      setFeishuOfficialCliSessionOutput(snapshot.output || '')
      setFeishuOfficialCliSessionExitCode(snapshot.code ?? null)
      setFeishuOfficialCliSessionCanceled(Boolean(snapshot.canceled))
      if (shouldResetFeishuSessionDraftOnSnapshot({
        currentSessionId: feishuOfficialCliSessionId,
        nextSessionId,
        active: snapshot.active,
      })) {
        setFeishuOfficialCliSessionInput('')
      }
      setFeishuOfficialCliSessionLatestAuthUrl(latestAuthUrl)
      setFeishuOfficialCliSessionLatestUserCode(latestUserCode)
      setFeishuOfficialCliSessionNotice(
        resolveFeishuOfficialCliSessionSnapshotNotice({
          active: Boolean(snapshot.active),
          mode: snapshot.mode || null,
          latestAuthUrl,
          latestUserCode,
          canceled: Boolean(snapshot.canceled),
          exitCode: snapshot.code ?? null,
          authState: authStateOverride ?? feishuOfficialCliStatus?.authState,
        })
      )
    },
    [feishuOfficialCliSessionId, feishuOfficialCliStatus?.authState]
  )

  const applyWeixinInstallerSnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof window.api.getWeixinInstallerState>>) => {
      setWeixinInstallerSessionId(snapshot.sessionId || '')
      setWeixinInstallerRunning(snapshot.active)
      setWeixinInstallerOutput(snapshot.output || '')
      setWeixinInstallerExitCode(snapshot.code ?? null)
      setWeixinInstallerCanceled(Boolean(snapshot.canceled))
      setWeixinInstallerNewAccountIds(snapshot.newAccountIds || [])
    },
    []
  )

  const invalidateFeishuManualBindingRequest = useCallback(() => {
    feishuManualBindingRequestVersionRef.current += 1
  }, [])

  const loadFeishuSetupState = useCallback(async (options?: { syncConfig?: boolean }) => {
    let pluginState = await window.api.getFeishuOfficialPluginState()
    if (options?.syncConfig && pluginState.configChanged) {
      try {
        await writeConfigDirect(pluginState.normalizedConfig)
        pluginState = await window.api.getFeishuOfficialPluginState()
      } catch {
        // Keep using the normalized in-memory state even if self-healing writes fail.
      }
    }

    const normalizedConfig = pluginState.normalizedConfig
    const bots = listFeishuBots(normalizedConfig)
    setFeishuOfficialPluginInstalled(pluginState.installedOnDisk)
    setFeishuOfficialPluginConfigured(pluginState.officialPluginConfigured)
    setFeishuOfficialPluginConfigChanged(pluginState.configChanged)
    setFeishuOfficialPluginBundledPayloadAvailable(pluginState.bundledPayloadAvailable)
    setFeishuBots(bots)

    if (bots.length === 0) {
      setPairingStatusByBot({})
      setCanSkip(false)
      return { pluginState, bots }
    }

    const pairingStatus = await window.api.pairingFeishuStatus(bots.map((bot) => bot.accountId))
    setPairingStatusByBot(pairingStatus)
    setCanSkip(shouldShowSkipButtonForFeishuPairing(pairingStatus))
    return { pluginState, bots }
  }, [])

  const refreshFeishuBotsFromConfig = useCallback(async () => {
    return loadFeishuSetupState({ syncConfig: true })
  }, [loadFeishuSetupState])

  const loadFeishuOfficialCliStatus = useCallback(async () => {
    const status = await window.api.getFeishuOfficialCliStatus()
    setFeishuOfficialCliStatus(status)
    return status
  }, [])

  const refreshFeishuSetupState = useCallback(
    async (options?: {
      userInitiated?: boolean
      recoverManualBindingIfReady?: boolean
    }) => {
      setRefreshingFeishuState(true)
      try {
        const {
          setupState,
          installerSnapshot,
          officialCliSessionSnapshot,
          officialCliStatus,
        } = await loadFeishuRefreshResources({
          api: window.api,
          loadSetupState: () => loadFeishuSetupState({ syncConfig: true }),
          loadOfficialCliStatus: () => loadFeishuOfficialCliStatus(),
        })

        if (installerSnapshot) {
          applyFeishuInstallerSnapshot(installerSnapshot)
        }
        if (officialCliSessionSnapshot) {
          applyFeishuOfficialCliSessionSnapshot(
            officialCliSessionSnapshot,
            officialCliStatus?.authState
          )
        }

        if (
          options?.recoverManualBindingIfReady &&
          isFeishuManualBindingReady(setupState.pluginState)
        ) {
          const preparedLinkRecovery = resolveFeishuPreparedLinkRecovery({
            normalizedConfig: setupState.pluginState.normalizedConfig,
            fallbackExistingBotCount: feishuBotsOrdered.length,
            prefix: '已刷新到最新状态，飞书官方插件已就绪，',
          })
          invalidateFeishuManualBindingRequest()
          setPreparingFeishuManualBinding(false)
          setFeishuManualBindingPreparePhase('idle')
          feishuCreateStartConfigSnapshotRef.current = preparedLinkRecovery.createStartConfigSnapshot
          setFeishuBotSetupMode('link')
          setFeishuLinkSourceMode(preparedLinkRecovery.sourceMode)
          setError('')
          setShowFieldErrors(false)
          setFeishuInstallerNotice(preparedLinkRecovery.notice)
          void cancelBackgroundFeishuPluginInstall()
          return true
        }

        const recoveryTarget = resolveFeishuAutoRecoveryTarget({
          setupMode: feishuBotSetupMode,
          pluginState: setupState.pluginState,
          nextConfig: setupState.pluginState.normalizedConfig,
          previousFeishuConfigSnapshot: feishuCreateStartConfigSnapshotRef.current,
        })

        if (options?.userInitiated) {
          if (recoveryTarget === 'recover-create') {
            void stopBackgroundFeishuInstaller()
            setError('')
            setFeishuInstallerNotice(
              '已刷新到最新配置，检测到飞书机器人信息，Mclaw 会停止后台安装器；现在可以直接点击“完成机器人配置”，随后继续输入飞书配对码。'
            )
          } else if (setupState.pluginState.installedOnDisk) {
            setFeishuInstallerNotice(
              '已检测到飞书官方插件已落盘；如果页面还没自动切换，可以继续点击“刷新状态”重新确认。'
            )
          } else {
            setFeishuInstallerNotice('已刷新当前状态，飞书官方插件仍在安装中；如安装器仍在运行，请稍后再试。')
          }
        }

        return false
      } catch (e: any) {
        if (options?.userInitiated) {
          setError(toUserFacingUnknownErrorMessage(e, '刷新飞书安装状态失败'))
        }
        return false
      } finally {
        setRefreshingFeishuState(false)
      }
    },
    [
      applyFeishuInstallerSnapshot,
      applyFeishuOfficialCliSessionSnapshot,
      feishuBotSetupMode,
      invalidateFeishuManualBindingRequest,
      loadFeishuSetupState,
      loadFeishuOfficialCliStatus,
    ]
  )

  useEffect(() => {
    if (selectedChannel?.id !== 'feishu') return

    const shouldPollManualRecovery = preparingFeishuManualBinding
    const shouldPollCreateRecovery = feishuInstallerRunning && feishuBotSetupMode === 'create'
    if (!shouldPollManualRecovery && !shouldPollCreateRecovery) return

    const setupMode: 'create' | 'link' = shouldPollManualRecovery ? 'link' : 'create'
    const manualBindingRequestVersion = feishuManualBindingRequestVersionRef.current
    let disposed = false

    const pollRecoveryState = async () => {
      const result = await pollWithBackoff({
        policy: UI_RUNTIME_DEFAULTS.feishuSetupRecovery.poll,
        shouldAbort: () => disposed,
        execute: async () => {
          const installerSnapshot = await window.api.getFeishuInstallerState().catch(() => null)
          if (installerSnapshot && !disposed) {
            applyFeishuInstallerSnapshot(installerSnapshot)
          }

          let setupState = await loadFeishuSetupState({ syncConfig: false })
          let recoveryTarget = resolveFeishuAutoRecoveryTarget({
            setupMode,
            pluginState: setupState.pluginState,
            nextConfig: setupState.pluginState.normalizedConfig,
            previousFeishuConfigSnapshot: feishuCreateStartConfigSnapshotRef.current,
          })

          if (recoveryTarget === 'heal-config') {
            try {
              await writeConfigDirect(setupState.pluginState.normalizedConfig)
              if (disposed) {
                return {
                  setupState,
                  recoveryTarget: 'wait' as const,
                }
              }
              setupState = await loadFeishuSetupState({ syncConfig: false })
              recoveryTarget = resolveFeishuAutoRecoveryTarget({
                setupMode,
                pluginState: setupState.pluginState,
                nextConfig: setupState.pluginState.normalizedConfig,
                previousFeishuConfigSnapshot: feishuCreateStartConfigSnapshotRef.current,
              })
            } catch {
              recoveryTarget = 'wait'
            }
          }

          return {
            setupState,
            recoveryTarget,
          }
        },
        isSuccess: (value) =>
          value.recoveryTarget === 'recover-manual' || value.recoveryTarget === 'recover-create',
      })

      if (!result.ok || !result.value || disposed) return

      if (result.value.recoveryTarget === 'recover-manual') {
        if (feishuManualBindingRequestVersionRef.current !== manualBindingRequestVersion) return
        const preparedLinkRecovery = resolveFeishuPreparedLinkRecovery({
          normalizedConfig: result.value.setupState.pluginState.normalizedConfig,
          fallbackExistingBotCount: feishuBotsOrdered.length,
          prefix: '已自动检测到飞书官方插件已就绪，',
        })
        invalidateFeishuManualBindingRequest()
        setPreparingFeishuManualBinding(false)
        setFeishuManualBindingPreparePhase('idle')
        feishuCreateStartConfigSnapshotRef.current = preparedLinkRecovery.createStartConfigSnapshot
        setFeishuBotSetupMode('link')
        setFeishuLinkSourceMode(preparedLinkRecovery.sourceMode)
        setError('')
        setShowFieldErrors(false)
        setFeishuInstallerNotice(preparedLinkRecovery.notice)
        void cancelBackgroundFeishuPluginInstall()
        return
      }

      if (result.value.recoveryTarget === 'recover-create') {
        void stopBackgroundFeishuInstaller()
        setError('')
        setFeishuInstallerNotice(
          '已自动检测到飞书机器人配置，Mclaw 会停止后台安装器；现在可以直接点击“完成机器人配置”，随后继续输入飞书配对码。'
        )
      }
    }

    void pollRecoveryState().catch(() => {
      // Best effort only; manual refresh and installer exit still provide fallback recovery.
    })

    return () => {
      disposed = true
    }
  }, [
    applyFeishuInstallerSnapshot,
    feishuBotSetupMode,
    feishuInstallerRunning,
    invalidateFeishuManualBindingRequest,
    loadFeishuSetupState,
    preparingFeishuManualBinding,
    selectedChannel?.id,
  ])

  useEffect(() => {
    let disposed = false

    const detectSkipAvailability = async () => {
      try {
        await refreshFeishuBotsFromConfig()
      } catch {
        if (!disposed) setCanSkip(false)
      }
    }

    void detectSkipAvailability()

    return () => {
      disposed = true
    }
  }, [refreshFeishuBotsFromConfig])

  useEffect(() => {
    const nextSelectedAccountId = resolveSelectedFeishuExistingBotAccountId(
      feishuBotsOrdered,
      selectedFeishuExistingBotAccountId
    )
    if (nextSelectedAccountId !== selectedFeishuExistingBotAccountId) {
      setSelectedFeishuExistingBotAccountId(nextSelectedAccountId)
    }
  }, [feishuBotsOrdered, selectedFeishuExistingBotAccountId])

  useEffect(() => {
    if (selectedChannel?.id !== 'feishu' || feishuBotSetupMode !== 'link') return
    if (feishuBotsOrdered.length === 0 && feishuLinkSourceMode !== 'manual') {
      setFeishuLinkSourceMode('manual')
    }
  }, [feishuBotSetupMode, feishuBotsOrdered.length, feishuLinkSourceMode, selectedChannel?.id])

  useEffect(() => {
    const unsubscribe = window.api.onFeishuOfficialCliSessionEvent((payload) => {
      if (payload.type === 'started') {
        const nextState = resolveFeishuOfficialCliSessionStartState(
          (payload.mode as FeishuOfficialCliSessionMode | null) || null
        )
        setFeishuOfficialCliSessionId(payload.sessionId || nextState.sessionId)
        setFeishuOfficialCliSessionMode(nextState.mode)
        setFeishuOfficialCliSessionRunning(nextState.running)
        setFeishuOfficialCliSessionOutput(nextState.output)
        setFeishuOfficialCliSessionExitCode(nextState.exitCode)
        setFeishuOfficialCliSessionCanceled(nextState.canceled)
        setFeishuOfficialCliSessionInput(nextState.input)
        setFeishuOfficialCliSessionLatestAuthUrl(nextState.latestAuthUrl)
        setFeishuOfficialCliSessionLatestUserCode(nextState.latestUserCode)
        setFeishuOfficialCliSessionNotice(nextState.notice)
        return
      }

      if (payload.type === 'output') {
        setFeishuOfficialCliSessionOutput((current) => current + String(payload.chunk || ''))
        return
      }

      if (payload.type === 'challenge') {
        const latestAuthUrl = String(payload.latestAuthUrl || '').trim()
        const latestUserCode = String(payload.latestUserCode || '').trim()
        const sessionMode = (payload.mode as FeishuOfficialCliSessionMode | null) || feishuOfficialCliSessionMode
        setFeishuOfficialCliSessionLatestAuthUrl(latestAuthUrl)
        setFeishuOfficialCliSessionLatestUserCode(latestUserCode)
        setFeishuOfficialCliSessionNotice(
          resolveFeishuOfficialCliSessionLiveNotice({
            mode: sessionMode,
            running: true,
            hasAuthUrl: Boolean(latestAuthUrl),
            hasUserCode: Boolean(latestUserCode),
          })
        )
        return
      }

      if (payload.type === 'exit') {
        setFeishuOfficialCliSessionRunning(false)
        setFeishuOfficialCliSessionExitCode(payload.code ?? null)
        setFeishuOfficialCliSessionCanceled(Boolean(payload.canceled))
        setFeishuOfficialCliSessionLatestAuthUrl(String(payload.latestAuthUrl || '').trim())
        setFeishuOfficialCliSessionLatestUserCode(String(payload.latestUserCode || '').trim())
        void (async () => {
          const refreshedStatus = await loadFeishuOfficialCliStatus().catch(() => null)
          await refreshFeishuSetupState().catch(() => {
            // Best effort only; the official CLI flow should not fail the page refresh path.
          })

          setFeishuOfficialCliSessionNotice(
            resolveFeishuOfficialCliSessionExitNotice({
              mode: (payload.mode as FeishuOfficialCliSessionMode | null) || null,
              canceled: Boolean(payload.canceled),
              exitCode: payload.code ?? null,
              authState: refreshedStatus?.authState,
            })
          )
        })()
      }
    })

    return unsubscribe
  }, [feishuOfficialCliSessionMode, loadFeishuOfficialCliStatus, refreshFeishuSetupState])

  useEffect(() => {
    if (feishuOfficialCliSessionRunning) return
    if (
      !feishuOfficialCliSessionCanceled
      && feishuOfficialCliSessionExitCode === null
      && !feishuOfficialCliSessionMode
    ) {
      return
    }

    setFeishuOfficialCliSessionNotice(
      resolveFeishuOfficialCliSessionExitNotice({
        mode: feishuOfficialCliSessionMode,
        canceled: feishuOfficialCliSessionCanceled,
        exitCode: feishuOfficialCliSessionExitCode,
        authState: feishuOfficialCliStatus?.authState,
      })
    )
  }, [
    feishuOfficialCliSessionCanceled,
    feishuOfficialCliSessionExitCode,
    feishuOfficialCliSessionMode,
    feishuOfficialCliSessionRunning,
    feishuOfficialCliStatus?.authState,
  ])

  useEffect(() => {
    const unsubscribe = window.api.onFeishuInstallerEvent((payload) => {
      if (payload.type === 'started') {
        const nextState = resolveFeishuInstallerSessionStartState()
        feishuInstallerPromptAutoReplyKeyRef.current = ''
        feishuInstallerOutputRef.current = ''
        setFeishuInstallerSessionId(payload.sessionId || nextState.sessionId)
        setFeishuInstallerRunning(nextState.running)
        setFeishuInstallerOutput(nextState.output)
        setFeishuInstallerExitCode(nextState.exitCode)
        setFeishuInstallerCanceled(nextState.canceled)
        setFeishuInstallerInput(nextState.input)
        setFeishuInstallerNotice(nextState.notice)
        return
      }

      if (payload.type === 'output') {
        const nextOutput = feishuInstallerOutputRef.current + String(payload.chunk || '')
        const outputState = resolveFeishuInstallerOutputState(nextOutput)
        feishuInstallerOutputRef.current = nextOutput
        setFeishuInstallerOutput(nextOutput)
        setFeishuInstallerNotice(
          resolveFeishuInstallerSessionLiveNotice({
            running: true,
            hasLiveQr: outputState.hasLiveQr,
            hasOutput: outputState.hasOutput,
          })
        )
        return
      }

      if (payload.type === 'exit') {
        setFeishuInstallerRunning(false)
        setFeishuInstallerExitCode(payload.code ?? null)
        setFeishuInstallerCanceled(Boolean(payload.canceled))
        setFeishuInstallerNotice(
          resolveFeishuInstallerSessionExitNotice({
            canceled: Boolean(payload.canceled),
            exitCode: payload.code ?? null,
          })
        )
        feishuInstallerPromptAutoReplyKeyRef.current = ''
        void refreshFeishuBotsFromConfig().catch(() => {
          // Ignore refresh failures after installer exit.
        })
      }
    })

    return unsubscribe
  }, [refreshFeishuBotsFromConfig])

  useEffect(() => {
    if (selectedChannel?.id !== 'feishu') return
    let disposed = false

    void loadFeishuRefreshResources({
      api: window.api,
      loadSetupState: () => loadFeishuSetupState({ syncConfig: true }),
      loadOfficialCliStatus: () => loadFeishuOfficialCliStatus(),
    }).then((resources) => {
      if (disposed) return
      if (resources.installerSnapshot) {
        applyFeishuInstallerSnapshot(resources.installerSnapshot)
      }
      if (resources.officialCliSessionSnapshot) {
        applyFeishuOfficialCliSessionSnapshot(
          resources.officialCliSessionSnapshot,
          resources.officialCliStatus?.authState
        )
      }
    }).catch(() => {
      // Ignore preload failures here.
    })

    return () => {
      disposed = true
    }
  }, [
    applyFeishuInstallerSnapshot,
    applyFeishuOfficialCliSessionSnapshot,
    loadFeishuSetupState,
    loadFeishuRefreshResources,
    loadFeishuOfficialCliStatus,
    selectedChannel?.id,
  ])

  useEffect(() => {
    if (selectedChannel?.id !== 'feishu' || !feishuInstallerRunning) return

    const promptKeyBase = extractFeishuExistingBotPromptKey(feishuInstallerOutput)
    if (!promptKeyBase) return

    const autoReply = feishuBotSetupMode === 'link' ? 'y' : 'n'
    const promptKey = `${feishuBotSetupMode}:${promptKeyBase}:${autoReply}`
    if (feishuInstallerPromptAutoReplyKeyRef.current === promptKey) return

    feishuInstallerPromptAutoReplyKeyRef.current = promptKey
    setFeishuInstallerNotice(
      feishuBotSetupMode === 'link'
        ? '检测到官方安装器询问是否复用已有飞书机器人，Mclaw 已自动回复 “Y”。'
        : '检测到官方安装器询问是否复用已有飞书机器人，Mclaw 已自动回复 “n”，继续走新建机器人流程。'
    )

    void sendFeishuInstallerInput(`${autoReply}\n`).then((ok) => {
      if (!ok) {
        feishuInstallerPromptAutoReplyKeyRef.current = ''
      }
    })
  }, [feishuBotSetupMode, feishuInstallerOutput, feishuInstallerRunning, selectedChannel?.id])

  const handleChannelChange = (channelId: string) => {
    const feishuResetState = resolveFeishuChannelViewResetState()
    invalidateFeishuManualBindingRequest()
    setSelectedChannelId(channelId)
    setFormData({})
    setStatus('form')
    setLog('')
    setError('')
    setCanSkip(false)
    setShowFieldErrors(false)
    setBindingMode('qr')
    feishuCreateStartConfigSnapshotRef.current = feishuResetState.createStartConfigSnapshot
    setFeishuBotSetupMode(feishuResetState.botSetupMode)
    setFeishuLinkSourceMode(feishuResetState.linkSourceMode)
    setFeishuOfficialPluginInstalled(feishuResetState.officialPluginInstalled)
    setFeishuOfficialPluginConfigured(feishuResetState.officialPluginConfigured)
    setFeishuOfficialPluginConfigChanged(feishuResetState.officialPluginConfigChanged)
    setFeishuOfficialPluginBundledPayloadAvailable(feishuResetState.officialPluginBundledPayloadAvailable)
    setFeishuBots(feishuResetState.bots)
    setPairingStatusByBot(feishuResetState.pairingStatusByBot)
    setSelectedFeishuExistingBotAccountId(feishuResetState.selectedExistingBotAccountId)
    setFeishuOfficialCliStatus(feishuResetState.officialCliStatus)
    setFeishuInstallerSessionId(feishuResetState.installerSessionId)
    setFeishuInstallerRunning(feishuResetState.installerRunning)
    setFeishuInstallerOutput(feishuResetState.installerOutput)
    setFeishuInstallerExitCode(feishuResetState.installerExitCode)
    setFeishuInstallerCanceled(feishuResetState.installerCanceled)
    setFeishuInstallerBusy(feishuResetState.installerBusy)
    setFeishuInstallerNotice(feishuResetState.installerNotice)
    setFeishuInstallerInput(feishuResetState.installerInput)
    setFeishuOfficialCliSessionId(feishuResetState.officialCliSessionId)
    setFeishuOfficialCliSessionMode(feishuResetState.officialCliSessionMode)
    setFeishuOfficialCliSessionRunning(feishuResetState.officialCliSessionRunning)
    setFeishuOfficialCliSessionOutput(feishuResetState.officialCliSessionOutput)
    setFeishuOfficialCliSessionExitCode(feishuResetState.officialCliSessionExitCode)
    setFeishuOfficialCliSessionCanceled(feishuResetState.officialCliSessionCanceled)
    setFeishuOfficialCliSessionBusy(feishuResetState.officialCliSessionBusy)
    setFeishuOfficialCliSessionInput(feishuResetState.officialCliSessionInput)
    setFeishuOfficialCliSessionLatestAuthUrl(feishuResetState.officialCliSessionLatestAuthUrl)
    setFeishuOfficialCliSessionLatestUserCode(feishuResetState.officialCliSessionLatestUserCode)
    setFeishuOfficialCliSessionNotice(feishuResetState.officialCliSessionNotice)
    setPreparingFeishuManualBinding(feishuResetState.preparingManualBinding)
    setFeishuManualBindingPreparePhase(feishuResetState.manualBindingPreparePhase)
    setShowFeishuInstallTutorial(feishuResetState.showInstallTutorial)
    setFinishingFeishuSetup(feishuResetState.finishingSetup)
    setRefreshingFeishuState(feishuResetState.refreshingState)
    feishuInstallerPromptAutoReplyKeyRef.current = ''
    feishuInstallerOutputRef.current = ''
    setWeixinInstallerSessionId('')
    setWeixinInstallerRunning(false)
    setWeixinInstallerOutput('')
    setWeixinInstallerExitCode(null)
    setWeixinInstallerCanceled(false)
    setWeixinInstallerBusy(false)
    setFinishingWeixinSetup(false)
    setWeixinInstallerNewAccountIds([])
    pluginInstalledRef.current = false
  }

  const handleFieldChange = (key: string, value: string) => {
    if (
      selectedChannel?.id === 'feishu'
      && feishuBotSetupMode === 'link'
      && (key === 'appId' || key === 'appSecret' || key === 'name')
      && feishuLinkSourceMode !== 'manual'
    ) {
      setFeishuLinkSourceMode('manual')
    }
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleFeishuLinkSourceModeChange = (value: string) => {
    setFeishuLinkSourceMode(value as FeishuLinkSourceMode)
    setError('')
    setShowFieldErrors(false)
  }

  const sendFeishuInstallerInput = async (input: string) => {
    const sessionId = String(feishuInstallerSessionId || '').trim()
    if (!sessionId) {
      setError('飞书官方安装器尚未启动。')
      return false
    }

    try {
      const result = await window.api.sendFeishuInstallerInput(sessionId, input)
      if (!result.ok) {
        setError(
          getFeishuSessionInputFailureMessage({
            target: 'installer',
            detail: result.message,
          })
        )
        return false
      }

      setError('')
      return true
    } catch (e: any) {
      setError(
        getFeishuSessionInputFailureMessage({
          target: 'installer',
          error: e,
        })
      )
      return false
    }
  }

  const sendFeishuOfficialCliSessionInput = async (input: string) => {
    const sessionId = String(feishuOfficialCliSessionId || '').trim()
    if (!sessionId) {
      setError('飞书官方 lark-cli 引导会话尚未启动。')
      return false
    }

    try {
      const result = await window.api.sendFeishuOfficialCliSessionInput(sessionId, input)
      if (!result.ok) {
        setError(
          getFeishuSessionInputFailureMessage({
            target: 'official-cli',
            detail: result.message,
          })
        )
        return false
      }

      setError('')
      return true
    } catch (e: any) {
      setError(
        getFeishuSessionInputFailureMessage({
          target: 'official-cli',
          error: e,
        })
      )
      return false
    }
  }

  const startFeishuOfficialCliGuidedFlow = async (mode: FeishuOfficialCliSessionMode) => {
    setFeishuOfficialCliSessionBusy(true)
    setError('')
    try {
      const current = await window.api.getFeishuOfficialCliSessionState()
      const startPlan = resolveFeishuOfficialCliSessionStartPlan({
        requestedMode: mode,
        currentMode: feishuOfficialCliSessionMode,
        hasActiveSession: current.active,
      })
      if (current.active) {
        setFeishuOfficialCliSessionMode(startPlan.mode)
        applyFeishuOfficialCliSessionSnapshot(current)
        setFeishuOfficialCliSessionNotice(
          resolveFeishuSessionReuseNotice({
            target: 'official-cli',
            requestedMode: mode,
            currentMode: current.mode || null,
          })
        )
        return
      }

      const nextState = resolveFeishuOfficialCliSessionStartState(mode)
      if (startPlan.shouldPrimeFreshStartState) {
        setFeishuOfficialCliSessionId(nextState.sessionId)
        setFeishuOfficialCliSessionMode(nextState.mode)
        setFeishuOfficialCliSessionOutput(nextState.output)
        setFeishuOfficialCliSessionExitCode(nextState.exitCode)
        setFeishuOfficialCliSessionCanceled(nextState.canceled)
        setFeishuOfficialCliSessionInput(nextState.input)
        setFeishuOfficialCliSessionLatestAuthUrl(nextState.latestAuthUrl)
        setFeishuOfficialCliSessionLatestUserCode(nextState.latestUserCode)
        setFeishuOfficialCliSessionNotice(nextState.notice)
      }

      const snapshot = await window.api.startFeishuOfficialCliSession(mode)
      applyFeishuOfficialCliSessionSnapshot(snapshot)
      if (!snapshot.sessionId || !snapshot.active) {
        throw new Error(snapshot.output || 'Failed to start the official lark-cli guided session.')
      }
    } catch (e: any) {
      setError(toUserFacingUnknownErrorMessage(e, 'Failed to start the official lark-cli guided session.'))
    } finally {
      setFeishuOfficialCliSessionBusy(false)
    }
  }

  const stopFeishuOfficialCliGuidedFlow = async () => {
    setFeishuOfficialCliSessionBusy(true)
    setError('')
    try {
      const result = await window.api.stopFeishuOfficialCliSession()
      const feedback = resolveFeishuStopRequestFeedback({
        target: 'official-cli',
        ok: result.ok,
      })
      if (feedback.notice) {
        setFeishuOfficialCliSessionNotice(feedback.notice)
      }
      if (feedback.error) {
        setError(feedback.error)
      }
    } catch (e: any) {
      setError(
        toUserFacingUnknownErrorMessage(
          e,
          resolveFeishuStopRequestFeedback({
            target: 'official-cli',
            ok: false,
          }).error
        )
      )
    } finally {
      setFeishuOfficialCliSessionBusy(false)
    }
  }

  const startFeishuInstallerFlow = async (mode: 'create' | 'link') => {
    setFeishuInstallerBusy(true)
    setError('')
    try {
      const current = await window.api.getFeishuInstallerState()
      const startPlan = resolveFeishuInstallerStartPlan({
        requestedMode: mode,
        currentMode: feishuBotSetupMode,
        hasActiveSession: current.active,
      })
      if (current.active) {
        setFeishuBotSetupMode(startPlan.mode)
        applyFeishuInstallerSnapshot(current)
        setFeishuInstallerNotice(
          resolveFeishuSessionReuseNotice({
            target: 'installer',
          })
        )
        return
      }

      const nextState = resolveFeishuInstallerSessionStartState()
      if (startPlan.shouldPrimeFreshStartState) {
        invalidateFeishuManualBindingRequest()
        setFeishuBotSetupMode(startPlan.mode)
        feishuInstallerPromptAutoReplyKeyRef.current = ''
        feishuInstallerOutputRef.current = ''
        setFeishuInstallerSessionId(nextState.sessionId)
        setFeishuInstallerOutput(nextState.output)
        setFeishuInstallerExitCode(nextState.exitCode)
        setFeishuInstallerCanceled(nextState.canceled)
        setFeishuInstallerInput(nextState.input)
        setFeishuInstallerNotice(nextState.notice)
      }

      if (startPlan.createSnapshotAction === 'capture') {
        const config = sanitizeFeishuPluginConfig(await window.api.readConfig())
        feishuCreateStartConfigSnapshotRef.current = captureFeishuBotConfigSnapshot(config)
      } else if (startPlan.createSnapshotAction === 'clear') {
        feishuCreateStartConfigSnapshotRef.current = null
      }

      const snapshot = await window.api.startFeishuInstaller(mode)
      applyFeishuInstallerSnapshot(snapshot)
      if (!snapshot.sessionId || !snapshot.active) {
        setError(String(snapshot.output || '启动飞书官方安装器失败'))
        return
      }
    } catch (e: any) {
      setError(toUserFacingUnknownErrorMessage(e, '启动飞书官方安装器失败'))
    } finally {
      setFeishuInstallerBusy(false)
    }
  }

  const stopFeishuInstallerFlow = async () => {
    setFeishuInstallerBusy(true)
    setError('')
    try {
      const result = await window.api.stopFeishuInstaller()
      const feedback = resolveFeishuStopRequestFeedback({
        target: 'installer',
        ok: result.ok,
      })
      if (feedback.notice) {
        setFeishuInstallerNotice(feedback.notice)
      }
      if (feedback.error) {
        setError(feedback.error)
      }
    } catch (e: any) {
      setError(
        toUserFacingUnknownErrorMessage(
          e,
          resolveFeishuStopRequestFeedback({
            target: 'installer',
            ok: false,
          }).error
        )
      )
    } finally {
      setFeishuInstallerBusy(false)
    }
  }

  const startWeixinInstallerFlow = async () => {
    setWeixinInstallerBusy(true)
    setError('')
    try {
      const current = await window.api.getWeixinInstallerState()
      if (current.active) {
        applyWeixinInstallerSnapshot(current)
        return
      }

      await resolveManagedPluginInstallPreflight(window.api, {
        channel: getChannelDefinition('openclaw-weixin'),
        pluginConfigured: false,
      })

      const snapshot = await window.api.startWeixinInstaller()
      applyWeixinInstallerSnapshot(snapshot)
      if (!snapshot.sessionId || !snapshot.active) {
        throw new Error(snapshot.output || '个人微信安装器启动失败')
      }
    } catch (e: any) {
      setError(toUserFacingUnknownErrorMessage(e, '启动个人微信安装器失败'))
    } finally {
      setWeixinInstallerBusy(false)
    }
  }

  const stopWeixinInstallerFlow = async () => {
    setWeixinInstallerBusy(true)
    setError('')
    try {
      const result = await window.api.stopWeixinInstaller()
      if (!result.ok) {
        setError('终止个人微信安装器失败，请稍后重试。')
        return
      }
      setWeixinInstallerOutput((current) =>
        current.trimEnd()
          ? `${current.replace(/\s*$/, '')}\n\n[Mclaw] 已请求终止个人微信安装器，正在停止...\n`
          : '[Mclaw] 已请求终止个人微信安装器，正在停止...\n'
      )
    } finally {
      setWeixinInstallerBusy(false)
    }
  }

  const finishWeixinChannelConnect = useCallback(async (newAccountIdsInput?: string[]) => {
    setFinishingWeixinSetup(true)
    setError('')

    try {
      const existingConfig = await window.api.readConfig()
      const sanitizedConfig = stripLegacyOpenClawRootKeys(existingConfig)
      if (JSON.stringify(existingConfig || {}) !== JSON.stringify(sanitizedConfig)) {
        await writeConfigDirect(sanitizedConfig, 'channel-connect-sanitize')
      }

      const config = (await window.api.readConfig()) || {}
      const enabledConfig = applyChannelConfig(config, 'openclaw-weixin', {})
      const weixinAccounts = await window.api.listWeixinAccounts()
      const configuredAccounts = weixinAccounts.filter((account) => account.configured)
      if (!canFinalizeWeixinSetup({ configuredAccounts })) {
        throw new Error('个人微信登录结果未写入本地账号状态，请重新扫码后重试。')
      }

      const nextConfig = syncWeixinChannelAccounts(
        enabledConfig,
        configuredAccounts.map((account) => ({
          accountId: account.accountId,
          name: account.name || account.accountId,
          enabled: account.enabled,
        }))
      )
      await writeConfigDirect(nextConfig)

      const gatewayReady = await ensureGatewayReadyForChannelConnect(window.api, () => {
        // Keep the wizard focused; errors are surfaced below the form.
      }, { channelId: 'openclaw-weixin' })
      if (!gatewayReady.ok) {
        // Feishu setup should continue into the pairing step even if the reload is still settling.
      }

      const successAccountId =
        String(newAccountIdsInput?.[0] || '').trim()
        || (
          configuredAccounts.length === 1
            ? String(configuredAccounts[0]?.name || configuredAccounts[0]?.accountId || '').trim()
            : ''
        )
      notifications.show({
        color: 'teal',
        title: '个人微信接入成功',
        message: successAccountId
          ? `扫码登录已完成，账号「${successAccountId}」已同步到控制面板。`
          : '扫码登录已完成，账号已同步到控制面板。',
      })

      onNext({
        channelId: 'openclaw-weixin',
        skipPairing: true,
      })
    } catch (e: any) {
      setError(toUserFacingUnknownErrorMessage(e, '个人微信配置完成收尾失败'))
    } finally {
      setFinishingWeixinSetup(false)
    }
  }, [onNext])

  const prepareFeishuManualBinding = async () => {
    const requestVersion = feishuManualBindingRequestVersionRef.current + 1
    feishuManualBindingRequestVersionRef.current = requestVersion

    setPreparingFeishuManualBinding(true)
    setFeishuManualBindingPreparePhase('checking')
    setError('')
    setShowFieldErrors(false)
    setFeishuInstallerNotice('')

    try {
      const initialState = await window.api.getFeishuOfficialPluginState()
      if (feishuManualBindingRequestVersionRef.current !== requestVersion) return

      if (canPrepareFeishuManualBindingWithoutInstall(initialState)) {
        let readyState = initialState
        if (initialState.configChanged) {
          setFeishuManualBindingPreparePhase('syncing')
          await writeConfigDirect(initialState.normalizedConfig)
          if (feishuManualBindingRequestVersionRef.current !== requestVersion) return
          readyState = await window.api.getFeishuOfficialPluginState()
          if (feishuManualBindingRequestVersionRef.current !== requestVersion) return
        }

        if (isFeishuManualBindingReady(readyState)) {
          const preparedLinkRecovery = resolveFeishuPreparedLinkRecovery({
            normalizedConfig: readyState.normalizedConfig,
            fallbackExistingBotCount: feishuBotsOrdered.length,
            prefix: initialState.configChanged
              ? '已同步飞书官方插件配置，'
              : '已确认飞书官方插件可用，',
          })
          setFeishuManualBindingPreparePhase('verifying')
          feishuCreateStartConfigSnapshotRef.current = preparedLinkRecovery.createStartConfigSnapshot
          setFeishuBotSetupMode('link')
          setFeishuLinkSourceMode(preparedLinkRecovery.sourceMode)
          setFeishuInstallerNotice(preparedLinkRecovery.notice)
          void refreshFeishuBotsFromConfig().catch(() => {
            // Keep the manual binding form available even if background refresh fails.
          })
          return
        }
      }

      setFeishuManualBindingPreparePhase('installing')
      const ensureResult = await window.api.ensureFeishuOfficialPluginReady()
      if (feishuManualBindingRequestVersionRef.current !== requestVersion) return
      if (!ensureResult.ok || !ensureResult.state.installedOnDisk) {
        throw new Error(
          ensureResult.message ||
            toUserFacingCliFailureMessage({
              stderr: ensureResult.stderr,
              stdout: ensureResult.stdout,
              fallback: '飞书官方插件尚未就绪',
            })
        )
      }

      const preparedLinkRecovery = resolveFeishuPreparedLinkRecovery({
        normalizedConfig: ensureResult.state.normalizedConfig,
        fallbackExistingBotCount: feishuBotsOrdered.length,
        prefix: ensureResult.installedThisRun
          ? '已自动补装飞书官方插件，'
          : '已确认飞书官方插件可用，',
      })
      setFeishuManualBindingPreparePhase('verifying')
      feishuCreateStartConfigSnapshotRef.current = preparedLinkRecovery.createStartConfigSnapshot
      setFeishuBotSetupMode('link')
      setFeishuLinkSourceMode(preparedLinkRecovery.sourceMode)
      setFeishuInstallerNotice(preparedLinkRecovery.notice)
      void refreshFeishuBotsFromConfig().catch(() => {
        // Keep the manual binding form available even if background refresh fails.
      })
    } catch (e: any) {
      if (feishuManualBindingRequestVersionRef.current !== requestVersion) return
      setError(toUserFacingUnknownErrorMessage(e, '准备关联已有机器人失败'))
    } finally {
      if (feishuManualBindingRequestVersionRef.current === requestVersion) {
        setFeishuManualBindingPreparePhase('idle')
        setPreparingFeishuManualBinding(false)
      }
    }
  }

  const finishFeishuChannelConnect = async () => {
    setFinishingFeishuSetup(true)
    setError('')

    try {
      await stopBackgroundFeishuInstaller()

      const existingConfig = await window.api.readConfig()
      const sanitizedConfig = stripLegacyOpenClawRootKeys(existingConfig)
      const preservedFeishuConfig = captureFeishuBotConfigSnapshot(sanitizedConfig)
      if (JSON.stringify(existingConfig || {}) !== JSON.stringify(sanitizedConfig)) {
        await writeConfigDirect(sanitizedConfig, 'channel-connect-sanitize')
      }

      const config = sanitizeFeishuPluginConfig(await window.api.readConfig())
      let nextConfig = config
      let pairingTarget: { accountId: string; accountName: string } | null = null

      if (feishuBotSetupMode === 'link') {
        if (feishuLinkModeFinishStrategy === 'manual') {
          const credentialCheck = await window.api.validateFeishuCredentials(
            channelValidation.values.appId,
            channelValidation.values.appSecret,
            config?.channels?.feishu?.domain
          )
          if (!credentialCheck.ok) {
            throw new Error(
              toUserFacingCliFailureMessage({
                stderr: credentialCheck.stderr,
                stdout: credentialCheck.stdout,
                fallback: '飞书 App ID / App Secret 校验失败，请检查后重试。',
              })
            )
          }

          const existingBots = listFeishuBots(config)
          if (existingBots.length > 0) {
            const added = addFeishuBotConfig(config, {
              name: String(formData.name || '').trim() || '飞书 Bot',
              appId: channelValidation.values.appId,
              appSecret: channelValidation.values.appSecret,
              provisionSource: 'linked',
            })
            nextConfig = added.nextConfig
            pairingTarget = {
              accountId: added.accountId,
              accountName: String(formData.name || '').trim() || `Bot ${added.accountId}`,
            }
          } else {
            nextConfig = applyChannelConfig(config, 'feishu', channelValidation.values)
            if (nextConfig.channels?.feishu) {
              nextConfig.channels.feishu.mclawProvisionSource = 'linked'
            }
            const matchedBot = listFeishuBots(nextConfig).find(
              (bot) => bot.appId.trim().toLowerCase() === channelValidation.values.appId.trim().toLowerCase()
            )
            pairingTarget = matchedBot
              ? {
                  accountId: matchedBot.accountId,
                  accountName: matchedBot.name,
                }
              : null
          }
        } else if (feishuLinkModeFinishStrategy === 'existing') {
          pairingTarget = resolveFeishuPairingTarget({
            setupMode: 'link',
            finishStrategy: 'existing',
            nextConfig: config,
            selectedAccountId: resolvedSelectedFeishuExistingBotAccountId,
          })
          if (!pairingTarget) {
            throw new Error('当前没有可直接复用的飞书机器人，请先刷新状态或改用手动绑定。')
          }
        } else {
          setShowFieldErrors(true)
          throw new Error(
            feishuLinkModeFinishStrategy === 'invalid-manual'
              ? '手动绑定信息未填写完整，请补全 App ID 和 App Secret 后再继续。'
              : '请先选择一个已检测到的飞书机器人，或补全 App ID 和 App Secret 后再继续。'
          )
        }

        if (feishuInstallerRunning) {
          await window.api.stopFeishuInstaller().catch(() => {
            // Manual binding can continue even if the installer process has already exited.
          })
        }
      } else {
        const mergedCreateResult = mergeFeishuCreateModeBots({
          currentConfig: config,
          previousFeishuConfigSnapshot: feishuCreateStartConfigSnapshotRef.current,
        })
        nextConfig = mergedCreateResult.nextConfig
        if (mergedCreateResult.addedBots.length > 0) {
          pairingTarget = {
            accountId: mergedCreateResult.addedBots[0].accountId,
            accountName: mergedCreateResult.addedBots[0].accountName,
          }
        }

        if (listFeishuBots(nextConfig).length === 0) {
          throw new Error('请先完成飞书机器人创建后再继续。')
        }
      }

      nextConfig = reconcileFeishuOfficialPluginConfig(nextConfig)

      await writeConfigDirect(nextConfig)
      await refreshFeishuBotsFromConfig()

      if (!pairingTarget && feishuBotSetupMode === 'create') {
        pairingTarget = resolveFeishuPairingTarget({
          setupMode: feishuBotSetupMode,
          finishStrategy: feishuCreateModeFinishStrategy,
          previousFeishuConfigSnapshot: preservedFeishuConfig,
          nextConfig,
          manualAppId: channelValidation.values.appId,
          manualBotName: formData.name,
        })
      }

      const gatewayReady = await ensureGatewayReadyForChannelConnect(window.api, () => {
        // Keep the wizard UI focused; setup errors are surfaced directly below the form.
      }, { channelId: 'feishu', allowPendingManagedReady: true })
      if (!gatewayReady.ok) {
        // Feishu setup should continue into the pairing step even if the reload is still settling.
      }

      await refreshFeishuBotsFromConfig()
      const resolvedFeishuAccountName = pairingTarget?.accountName || (feishuBotSetupMode === 'create' ? '新建飞书机器人' : '已有飞书机器人')
      notifications.show({
        color: 'teal',
        title: feishuBotSetupMode === 'create' ? '新建机器人已接入' : '已有机器人已绑定',
        message:
          feishuBotSetupMode === 'create'
            ? `已检测到并接入飞书 Bot「${resolvedFeishuAccountName}」。接下来会继续进入后续确认步骤。`
            : `已完成飞书 Bot「${resolvedFeishuAccountName}」的绑定校验。接下来会继续进入飞书配对步骤。`,
      })
      onNext({
        channelId: 'feishu',
        accountId: pairingTarget?.accountId,
        accountName: pairingTarget?.accountName,
        skipPairing: shouldSkipFeishuPairingAfterSetup(feishuBotSetupMode),
      })
    } catch (e: any) {
      setError(toUserFacingUnknownErrorMessage(e, '飞书配置完成收尾失败'))
    } finally {
      setFinishingFeishuSetup(false)
    }
  }

  useEffect(() => {
    const unsubscribe = window.api.onWeixinInstallerEvent((payload) => {
      if (payload.type === 'started') {
        setWeixinInstallerSessionId(payload.sessionId || '')
        setWeixinInstallerRunning(true)
        setWeixinInstallerExitCode(null)
        setWeixinInstallerCanceled(false)
        setWeixinInstallerNewAccountIds([])
        return
      }

      if (payload.type === 'output') {
        setWeixinInstallerOutput((current) => current + String(payload.chunk || ''))
        return
      }

      if (payload.type === 'exit') {
        setWeixinInstallerRunning(false)
        setWeixinInstallerExitCode(payload.code ?? null)
        setWeixinInstallerCanceled(Boolean(payload.canceled))
        setWeixinInstallerNewAccountIds(payload.newAccountIds || [])

        if (payload.ok && !payload.canceled) {
          void finishWeixinChannelConnect(payload.newAccountIds || [])
          return
        }

        if (!payload.canceled) {
          setError('个人微信连接未完成，请重试。')
        }
      }
    })

    return unsubscribe
  }, [finishWeixinChannelConnect])

  useEffect(() => {
    if (selectedChannel?.id !== 'openclaw-weixin') return

    window.api
      .getWeixinInstallerState()
      .then((snapshot) => {
        applyWeixinInstallerSnapshot(snapshot)
      })
      .catch(() => {
        // Ignore preload failures.
      })
  }, [applyWeixinInstallerSnapshot, selectedChannel?.id])

  const cleanupQrPolling = useCallback(() => {
    if (qrTimerRef.current) {
      clearInterval(qrTimerRef.current)
      qrTimerRef.current = null
    }
  }, [])

  const handleQrClose = useCallback(() => {
    cleanupQrPolling()
    setShowQrModal(false)
    // If the modal is closed manually before scan completes, resolve with null
    if (qrResolveRef.current) {
      qrResolveRef.current(null)
      qrResolveRef.current = null
    }
  }, [cleanupQrPolling])

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      cleanupQrPolling()
    }
  }, [cleanupQrPolling])

  /**
   * Opens the WeChat Work QR modal and returns a Promise that resolves
   * with { botId, secret } on successful scan, or null if cancelled/timed out.
   */
  const startQrBinding = (): Promise<{ botId: string; secret: string } | null> => {
    return new Promise(async (resolve) => {
      qrResolveRef.current = resolve
      setQrStatus('loading')
      setQrAuthUrl('')
      setShowQrModal(true)

      const genResult = await window.api.wecomQrGenerate()
      if (!genResult.ok || !genResult.scode || !genResult.authUrl) {
        setQrStatus('error')
        resolve(null)
        qrResolveRef.current = null
        return
      }

      setQrAuthUrl(genResult.authUrl)
      setQrStatus('ready')

      const scode = genResult.scode
      let elapsed = 0
      const POLL_INTERVAL = 3000
      const TIMEOUT = 180000

      qrTimerRef.current = setInterval(async () => {
        elapsed += POLL_INTERVAL
        if (elapsed > TIMEOUT) {
          cleanupQrPolling()
          setQrStatus('error')
          resolve(null)
          qrResolveRef.current = null
          return
        }

        const checkResult = await window.api.wecomQrCheckResult(scode)
        if (checkResult.ok && checkResult.status === 'success' && checkResult.botId && checkResult.secret) {
          cleanupQrPolling()
          setQrStatus('scanned')
          setShowQrModal(false)
          resolve({ botId: checkResult.botId, secret: checkResult.secret })
          qrResolveRef.current = null
        } else if (!checkResult.ok || checkResult.status === 'error') {
          cleanupQrPolling()
          setQrStatus('error')
          resolve(null)
          qrResolveRef.current = null
        }
      }, POLL_INTERVAL)
    })
  }

  const doConnect = async () => {
    if (!selectedChannel) return
    if (selectedChannel.id === 'openclaw-weixin') {
      await startWeixinInstallerFlow()
      return
    }
    if (bindingMode === 'manual' && !channelValidation.ok) {
      setShowFieldErrors(true)
      return
    }

    if (selectedChannel.id === 'dingtalk') {
      setStatus('installing')
      setError('')
      setLog((prev) => prev + '正在检查并配置钉钉官方插件...\n')

      try {
        const result = await window.api.setupDingtalkOfficialChannel(formData)
        setLog((prev) => prev + buildDingtalkOfficialSetupLog(result))

        if (!result.ok) {
          setError(
            result.message ||
            toUserFacingCliFailureMessage({
              stderr: result.stderr,
              stdout: result.stdout,
              fallback: '钉钉配置失败',
            })
          )
          setStatus('error')
          return
        }

        pluginInstalledRef.current = true
        setLog(
          (prev) =>
            prev +
            `✅ ${selectedChannel.name} 配置完成！\n\n${buildChannelConnectCompletionCopy(selectedChannel)}\n`
        )
        setStatus('connected')
      } catch (e: any) {
        setError(toUserFacingUnknownErrorMessage(e, '钉钉配置失败'))
        setStatus('error')
      }
      return
    }

    // 先清理配置中的无效根级别 key，否则后续 openclaw 命令会校验失败
    let currentConfig = await window.api.readConfig().catch(() => null)

    try {
      const sanitizedConfig = stripLegacyOpenClawRootKeys(currentConfig)
      const existingSerialized = JSON.stringify(currentConfig || {})
      const sanitizedSerialized = JSON.stringify(sanitizedConfig)
      if (existingSerialized !== sanitizedSerialized) {
        await writeConfigPatch(currentConfig, sanitizedConfig, 'channel-connect-sanitize')
        currentConfig = sanitizedConfig
      }
    } catch {
      // 配置文件可能不存在，忽略
    }

    // 安装插件（如果需要且尚未安装）
    if (!pluginInstalledRef.current) {
      const pluginAlreadyConfigured = isChannelPluginConfigured(currentConfig, selectedChannel.id)
      let managedPluginInstallPreflight: Awaited<ReturnType<typeof resolveManagedPluginInstallPreflight>> | null = null

      try {
        managedPluginInstallPreflight = await resolveManagedPluginInstallPreflight(window.api, {
          channel: selectedChannel,
          pluginConfigured: pluginAlreadyConfigured,
        })
      } catch (e: any) {
        setError(toUserFacingUnknownErrorMessage(e, '插件兼容性预检失败，请稍后重试。'))
        setStatus('error')
        return
      }

      if (selectedChannel.plugin?.npxSpecifier) {
        // 官方插件通过 npx 安装
        setStatus('installing')
        const pluginInstalledOnDisk = managedPluginInstallPreflight?.pluginInstalledOnDisk || false
        const pluginInstallStrategy =
          managedPluginInstallPreflight?.pluginInstallStrategy ||
          resolveManagedPluginInstallStrategy({
            pluginConfigured: pluginAlreadyConfigured,
            pluginInstalledOnDisk,
            forceInstall: false,
          })

        if (pluginInstallStrategy === 'reuse-installed-plugin') {
          setLog(`检测到 ${selectedChannel.name} 官方插件已安装，跳过重装...\n`)
        } else if (pluginAlreadyConfigured) {
          setLog(`检测到 ${selectedChannel.name} 配置中已有安装记录，但磁盘插件缺失，准备重新安装...\n`)
        } else {
          setLog(`正在安装 ${selectedChannel.name} 官方插件...\n`)
        }
        try {
          if (pluginInstallStrategy === 'install-plugin') {
            const result = await window.api.installPluginNpx(
              selectedChannel.plugin.npxSpecifier,
              selectedChannel.plugin.allowId ? [selectedChannel.plugin.allowId] : undefined
            )
            if (!result.ok) {
              if (isSafeAlreadyInstalledManagedPluginInstallError(result.stderr || '')) {
                setLog(prev => prev + '✅ 官方插件已存在，跳过重装\n\n')
              } else {
                setError(
                  toUserFacingCliFailureMessage({
                    stderr: result.stderr,
                    stdout: result.stdout,
                    fallback: '插件安装失败，请检查网络与 npm 环境后重试。',
                  })
                )
                setStatus('error')
                return
              }
            } else {
              setLog(prev => prev + `✅ 官方插件已安装\n\n`)
            }
          } else {
            setLog(prev => prev + '✅ 已复用已安装插件\n\n')
          }
        } catch (e: any) {
          setError(toUserFacingUnknownErrorMessage(e, '插件安装失败，请检查网络与 npm 环境后重试。'))
          setStatus('error')
          return
        }
      } else if (selectedChannel.plugin?.packageName) {
        // 插件通过 openclaw plugins install 安装
        setStatus('installing')
        const pluginAllowId = resolveChannelPluginAllowId(selectedChannel)
        const pluginInstalledOnDisk = managedPluginInstallPreflight?.pluginInstalledOnDisk || false
        const pluginInstallStrategy =
          managedPluginInstallPreflight?.pluginInstallStrategy ||
          resolveManagedPluginInstallStrategy({
            pluginConfigured: pluginAlreadyConfigured,
            pluginInstalledOnDisk,
            forceInstall: false,
          })

        if (pluginInstallStrategy === 'reuse-installed-plugin') {
          setLog(`检测到 ${selectedChannel.name} 官方插件已安装，跳过重装...\n`)
        } else if (pluginAlreadyConfigured) {
          setLog(`检测到 ${selectedChannel.name} 配置中已有安装记录，但磁盘插件缺失，准备重新安装...\n`)
        } else {
          setLog(`正在安装插件 ${selectedChannel.plugin.packageName}...\n`)
        }
        try {
          if (pluginInstallStrategy === 'install-plugin') {
            const cleanupTargets = listPluginCleanupTargets(selectedChannel)
            if (cleanupTargets.length > 0) {
              setLog(prev => prev + `正在清理 ${selectedChannel.name} 历史插件残留...\n`)
              for (const pluginId of cleanupTargets) {
                try {
                  await window.api.uninstallPlugin(pluginId)
                } catch {
                  // 旧版插件不存在或当前 CLI 不支持卸载时，继续安装最新官方插件。
                }
              }
              setLog(prev => prev + '✅ 历史插件检查完成\n\n')
            }

            const result = await window.api.installPlugin(
              selectedChannel.plugin.packageName,
              selectedChannel.plugin.allowId ? [selectedChannel.plugin.allowId] : undefined
            )
            if (!result.ok) {
              // 如果是"已存在"错误，跳过安装继续
              if (isSafeAlreadyInstalledManagedPluginInstallError(result.stderr || '')) {
                setLog(prev => prev + `✅ 插件已存在，跳过安装\n\n`)
              } else {
                setError(
                  toUserFacingCliFailureMessage({
                    stderr: result.stderr,
                    stdout: result.stdout,
                    fallback: '插件安装失败，请检查网络与权限后重试。',
                  })
                )
                setStatus('error')
                return
              }
            } else {
              setLog(prev => prev + `✅ 插件已安装\n\n`)
            }
          } else {
            setLog(prev => prev + '✅ 已复用已安装插件\n\n')
          }
        } catch (e: any) {
          setError(toUserFacingUnknownErrorMessage(e, '插件安装失败，请检查网络与权限后重试。'))
          setStatus('error')
          return
        }
      }

      pluginInstalledRef.current = true
    } // end plugin install guard

    setStatus('starting')
    setError('')

    try {
      // 写入渠道配置
      const bindingStrategy = resolveChannelConnectBindingStrategy(selectedChannel)
      if (bindingStrategy === 'qr-binding' && bindingMode === 'qr') {
        // QR 扫码绑定（企业微信）
        setLog(prev => prev + `正在生成 ${selectedChannel.name} 扫码绑定二维码...\n`)
        const qrResult = await startQrBinding()
        if (!qrResult) {
          setError('扫码绑定已取消或超时')
          setStatus('error')
          return
        }
        setLog(prev => prev + `✅ 扫码绑定成功\n\n`)

        // 用扫码返回的 botId/secret 写入配置（复用 applyChannelConfig）
        setLog(prev => prev + `正在写入 ${selectedChannel.name} 配置...\n`)
        const config = (await window.api.readConfig()) || {}
        const nextConfig = applyChannelConfig(config, selectedChannel.id, {
          botId: qrResult.botId,
          secret: qrResult.secret,
        })
        await writeConfigDirect(nextConfig)
        setLog(prev => prev + `✅ ${selectedChannel.name} 配置已写入\n\n`)
      } else {
        // 合并写入 openclaw.json 配置文件
        setLog(prev => prev + `正在写入 ${selectedChannel.name} 配置...\n`)

        const config = (await window.api.readConfig()) || {}
        const prevFeishuAppId = config.channels?.feishu?.appId
        const nextConfig = applyChannelConfig(config, selectedChannel.id, formData)
        await writeConfigPatch(config, nextConfig)
        setLog(prev => prev + `✅ ${selectedChannel.name} 配置已写入\n\n`)

        if (
          selectedChannel.id === 'feishu' &&
          prevFeishuAppId &&
          prevFeishuAppId.trim() !== formData.appId?.trim()
        ) {
          setLog(
            prev =>
              prev +
              '⚠️ 检测到飞书 App ID 发生变化。请在飞书中确认你正在给”新应用对应的机器人”发消息，否则消息不会进入当前网关。\n\n'
          )
        }
      }

      // 启动或重启 Gateway
      setLog(prev => prev + '正在启动 Gateway...\n')
      const gatewayReady = await ensureGatewayReadyForChannelConnect(window.api, (message) => {
        setLog(prev => prev + message)
      }, { channelId: selectedChannel.id })
      if (!gatewayReady.ok) {
        setError(
          toUserFacingCliFailureMessage({
            stderr: gatewayReady.message,
            fallback: 'Gateway 启动失败',
          })
        )
        setStatus('error')
        return
      }

      setLog(prev => prev + '✅ Gateway 已启动\n')

      if (selectedChannel.id !== 'dingtalk') {
        // 飞书/企微等渠道需要等待长连接初始化。
        setLog(prev => prev + '正在建立与 IM 平台的连接...\n')
        await new Promise(resolve => setTimeout(resolve, 3000))
        setLog(prev => prev + '✅ 连接已建立\n\n')
      }

      setLog(
        prev =>
          prev +
          `✅ ${selectedChannel.name} 配置完成！\n\n${buildChannelConnectCompletionCopy(selectedChannel)}\n`
      )
      setStatus('connected')
    } catch (e: any) {
      setError(toUserFacingUnknownErrorMessage(e, '配置失败'))
      setStatus('error')
    }
  }

  const focusFeishuSetupPath = useCallback((mode: 'create' | 'link') => {
    setFeishuBotSetupMode(mode)
    if (mode !== 'create') {
      feishuCreateStartConfigSnapshotRef.current = null
    }
    if (typeof document === 'undefined') return

    window.setTimeout(() => {
      document
        .getElementById(mode === 'create' ? 'feishu-create-path-card' : 'feishu-link-path-card')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }, [])

  const focusFeishuOfficialCliGuidedFlow = useCallback(() => {
    if (typeof document === 'undefined') return

    window.setTimeout(() => {
      document
        .getElementById('feishu-official-cli-guided-flow-card')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }, [])

  const handleFeishuOfficialOnboardingAction = useCallback(
    async (action: FeishuOfficialOnboardingAction | null | undefined) => {
      if (!action) return

      if (action === 'refresh-status') {
        await refreshFeishuSetupState(
          resolveFeishuStatusRefreshOptions(preparingFeishuManualBinding)
        )
        return
      }
      if (action === 'start-auth-login-recommend') {
        await startFeishuOfficialCliGuidedFlow('auth-login-recommend')
        return
      }
      if (action === 'start-auth-login-no-wait') {
        await startFeishuOfficialCliGuidedFlow('auth-login-no-wait')
        return
      }
      if (action === 'start-config-init-new') {
        await startFeishuOfficialCliGuidedFlow('config-init-new')
        return
      }
      if (action === 'focus-guided-flow') {
        focusFeishuOfficialCliGuidedFlow()
        return
      }
      if (action === 'open-auth-url') {
        if (feishuOfficialCliSessionLatestAuthUrl) {
          try {
            const result = await window.api.openOAuthUrl(feishuOfficialCliSessionLatestAuthUrl)
            if (!result.ok) {
              notifications.show({
                color: 'red',
                title: 'Open browser failed',
                message: getFeishuOfficialAuthUrlOpenFailureMessage(result),
              })
            }
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Open browser failed',
              message: toUserFacingUnknownErrorMessage(
                error,
                FEISHU_OFFICIAL_AUTH_URL_OPEN_FAILURE_FALLBACK
              ),
            })
          }
        }
        focusFeishuOfficialCliGuidedFlow()
        return
      }
      if (action === 'copy-device-code') {
        try {
          if (!feishuOfficialCliSessionLatestUserCode || !navigator.clipboard?.writeText) {
            throw new Error('当前设备码会话不可用剪贴板。')
          }
          await navigator.clipboard.writeText(feishuOfficialCliSessionLatestUserCode)
          notifications.show({
            color: 'teal',
            title: '设备码已复制',
            message: '当前飞书设备码已复制到剪贴板。',
          })
        } catch (error) {
          notifications.show({
            color: 'red',
            title: '复制失败',
            message: error instanceof Error ? error.message : '复制当前设备码失败。',
          })
        }
        focusFeishuOfficialCliGuidedFlow()
        return
      }
      if (action === 'finish-create' || action === 'finish-link') {
        await finishFeishuChannelConnect()
        return
      }
      if (action === 'start-create') {
        await startFeishuInstallerFlow('create')
        return
      }
      if (action === 'start-link') {
        await prepareFeishuManualBinding()
        return
      }
      if (action === 'switch-link-existing') {
        setFeishuBotSetupMode('link')
        setFeishuLinkSourceMode('existing')
        focusFeishuSetupPath('link')
        return
      }
      if (action === 'switch-link-manual') {
        setFeishuBotSetupMode('link')
        setFeishuLinkSourceMode('manual')
        focusFeishuSetupPath('link')
        return
      }
      if (action === 'focus-create') {
        focusFeishuSetupPath('create')
        return
      }
      focusFeishuSetupPath('link')
    },
    [
      feishuOfficialCliSessionLatestAuthUrl,
      feishuOfficialCliSessionLatestUserCode,
      focusFeishuSetupPath,
      focusFeishuOfficialCliGuidedFlow,
      finishFeishuChannelConnect,
      prepareFeishuManualBinding,
      preparingFeishuManualBinding,
      refreshFeishuSetupState,
      startFeishuInstallerFlow,
      startFeishuOfficialCliGuidedFlow,
    ]
  )

  const isFeishuOfficialOnboardingActionLoading = (action: FeishuOfficialOnboardingAction): boolean => {
    if (action === 'refresh-status') return refreshingFeishuState
    if (action === 'start-config-init-new') {
      return feishuOfficialCliSessionBusy && feishuOfficialCliSessionMode === 'config-init-new'
    }
    if (action === 'start-auth-login-recommend') {
      return feishuOfficialCliSessionBusy && feishuOfficialCliSessionMode === 'auth-login-recommend'
    }
    if (action === 'start-auth-login-no-wait') {
      return feishuOfficialCliSessionBusy && feishuOfficialCliSessionMode === 'auth-login-no-wait'
    }
    if (action === 'start-create') {
      return feishuInstallerBusy && feishuBotSetupMode === 'create'
    }
    if (action === 'start-link') return preparingFeishuManualBinding
    if (action === 'finish-create' || action === 'finish-link') return finishingFeishuSetup
    return false
  }

  const isFeishuOfficialOnboardingActionDisabled = (action: FeishuOfficialOnboardingAction): boolean => {
    if (
      action === 'focus-create'
      || action === 'focus-link'
      || action === 'switch-link-existing'
      || action === 'switch-link-manual'
      || action === 'focus-guided-flow'
    ) {
      return finishingFeishuSetup
    }
    if (action === 'open-auth-url') return finishingFeishuSetup || !feishuOfficialCliSessionLatestAuthUrl
    if (action === 'copy-device-code') {
      return (
        finishingFeishuSetup
        || !feishuOfficialCliSessionLatestUserCode
        || !feishuOfficialCliClipboardAvailable
      )
    }
    if (action === 'finish-create' || action === 'finish-link') {
      return finishingFeishuSetup || feishuOfficialCliSessionRunning || preparingFeishuManualBinding
    }
    if (action === 'refresh-status') return feishuOfficialCliSessionRunning || finishingFeishuSetup
    if (
      action === 'start-config-init-new'
      || action === 'start-auth-login-recommend'
      || action === 'start-auth-login-no-wait'
    ) {
      return feishuOfficialCliSessionRunning || finishingFeishuSetup
    }
    if (action === 'start-create') {
      return feishuOfficialCliSessionRunning || preparingFeishuManualBinding || finishingFeishuSetup
    }
    if (action === 'start-link') {
      return feishuOfficialCliSessionRunning || feishuInstallerRunning || feishuInstallerBusy || finishingFeishuSetup
    }
    return false
  }

  const handleFeishuOfficialCliGuidedFlowAction = useCallback(
    async (action: FeishuOfficialCliGuidedFlowAction) => {
      if (action === 'stop-official-cli-session') {
        await stopFeishuOfficialCliGuidedFlow()
        return
      }

      await handleFeishuOfficialOnboardingAction(action)
    },
    [handleFeishuOfficialOnboardingAction, stopFeishuOfficialCliGuidedFlow]
  )

  const isFeishuOfficialCliGuidedFlowActionLoading = (
    action: FeishuOfficialCliGuidedFlowAction
  ): boolean => {
    if (action === 'stop-official-cli-session') return false
    return isFeishuOfficialOnboardingActionLoading(action)
  }

  const isFeishuOfficialCliGuidedFlowActionDisabled = (
    action: FeishuOfficialCliGuidedFlowAction
  ): boolean => {
    if (action === 'stop-official-cli-session') {
      return !feishuOfficialCliSessionRunning || feishuOfficialCliSessionBusy
    }

    return isFeishuOfficialOnboardingActionDisabled(action)
  }

  return (
    <div className="w-full">
      <Title order={3} size="lg" fw={600} mb={4}>连接 IM 渠道</Title>
      <Text size="sm" c="dimmed" mb="lg">选择并配置您的即时通讯平台</Text>

      {status === 'form' && (
        <>
          <Tabs
            value={selectedChannelId || null}
            onChange={(value) => handleChannelChange(value || '')}
          >
            <Tabs.List grow mb="md">
              {CHANNELS.map(channel => (
                <Tabs.Tab key={channel.id} value={channel.id} fz="sm">
                  <img src={channel.logo} alt={channel.name} style={{ width: 16, height: 16, display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
                  {channel.name}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>

          {selectedChannel && (
            <div className="space-y-3 mb-4 p-3 app-bg-tertiary border app-border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={selectedChannel.logo} alt={selectedChannel.name} className="w-5 h-5" />
                  <span className="text-sm font-medium app-text-primary">{selectedChannel.name}</span>
                </div>
                <a
                  href={selectedChannel.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs app-text-success hover:app-text-success shrink-0"
                >
                  帮助 →
                </a>
              </div>

              <Text size="xs" c="dimmed">{selectedChannel.helpText}</Text>

              {selectedChannel.id === 'feishu' ? (
                <div className="space-y-4">
                  <div className="rounded-xl border app-border bg-black/20 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <Text size="sm" fw={600}>飞书接入</Text>
                        <Text size="xs" c="dimmed">
                          默认先走“新建机器人”；如果你已经有飞书应用，或扫码创建失败，再切到“关联已有机器人”。
                        </Text>
                      </div>
                      <Badge size="xs" variant="light" color="blue">两条路径</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {feishuPathDescriptors.map((item) => (
                        <div
                          key={item.mode}
                          className="rounded-lg border app-border-light app-bg-tertiary px-3 py-2"
                        >
                          <Text size="xs" fw={600}>{item.overviewTitle}</Text>
                          <Text size="xs" c="dimmed" mt={4}>
                            {item.overviewDetail}
                          </Text>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Text size="xs" c="dimmed">
                      上方只保留路径切换和通用工具；真正执行动作请点下方路径卡里的按钮。
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      {feishuPathNavigatorItems.map((item) => (
                        <Button
                          key={item.mode}
                          variant={item.active ? 'filled' : 'light'}
                          color="success"
                          size="xs"
                          onClick={() => focusFeishuSetupPath(item.mode)}
                        >
                          {item.label}
                        </Button>
                      ))}
                      <Button
                        variant="light"
                        size="xs"
                        onClick={() => setShowFeishuInstallTutorial(true)}
                      >
                        查看教程
                      </Button>
                      <Button
                        variant="subtle"
                        size="xs"
                        color="danger"
                        onClick={() => void stopFeishuInstallerFlow()}
                        disabled={!feishuInstallerRunning || feishuInstallerBusy || preparingFeishuManualBinding}
                      >
                        中止安装
                      </Button>
                      <Button
                        variant="light"
                        size="xs"
                        onClick={() =>
                          void refreshFeishuSetupState(
                            resolveFeishuStatusRefreshOptions(preparingFeishuManualBinding)
                          )
                        }
                        loading={refreshingFeishuState}
                        disabled={finishingFeishuSetup}
                      >
                        刷新状态
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Card
                      id="feishu-create-path-card"
                      withBorder
                      radius="md"
                      padding="md"
                      className="app-bg-secondary"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Text size="sm" fw={600}>{feishuCreatePathDescriptor.cardTitle}</Text>
                          <Text size="xs" c="dimmed" mt={4}>
                            {feishuCreatePathDescriptor.cardDetail}
                          </Text>
                        </div>
                        <Badge size="xs" variant="light" color={feishuCreatePathStatus.color}>
                          {feishuCreatePathStatus.label}
                        </Badge>
                      </div>
                      <Text size="xs" mt="sm">{feishuCreatePathStatus.detail}</Text>
                      {(feishuCreatePathCardActions.primaryAction || feishuCreatePathCardActions.secondaryAction) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {feishuCreatePathCardActions.primaryAction && (
                            <Button
                              size="xs"
                              variant="light"
                              color={feishuCreatePathStatus.color}
                              loading={isFeishuOfficialOnboardingActionLoading(feishuCreatePathCardActions.primaryAction)}
                              disabled={isFeishuOfficialOnboardingActionDisabled(feishuCreatePathCardActions.primaryAction)}
                              onClick={() => void handleFeishuOfficialOnboardingAction(feishuCreatePathCardActions.primaryAction)}
                            >
                              {resolveFeishuOfficialOnboardingActionLabel(feishuCreatePathCardActions.primaryAction)}
                            </Button>
                          )}
                          {feishuCreatePathCardActions.secondaryAction && (
                            <Button
                              size="xs"
                              variant="subtle"
                              color="gray"
                              loading={isFeishuOfficialOnboardingActionLoading(feishuCreatePathCardActions.secondaryAction)}
                              disabled={isFeishuOfficialOnboardingActionDisabled(feishuCreatePathCardActions.secondaryAction)}
                              onClick={() => void handleFeishuOfficialOnboardingAction(feishuCreatePathCardActions.secondaryAction)}
                            >
                              {resolveFeishuOfficialOnboardingActionLabel(feishuCreatePathCardActions.secondaryAction)}
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>

                    <Card
                      id="feishu-link-path-card"
                      withBorder
                      radius="md"
                      padding="md"
                      className="app-bg-secondary"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Text size="sm" fw={600}>{feishuLinkPathDescriptor.cardTitle}</Text>
                          <Text size="xs" c="dimmed" mt={4}>
                            {feishuLinkPathDescriptor.cardDetail}
                          </Text>
                        </div>
                        <Badge size="xs" variant="light" color={feishuLinkPathStatus.color}>
                          {feishuLinkPathStatus.label}
                        </Badge>
                      </div>
                      <Text size="xs" mt="sm">{feishuLinkPathStatus.detail}</Text>
                      {(feishuLinkPathCardActions.primaryAction || feishuLinkPathCardActions.secondaryAction) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {feishuLinkPathCardActions.primaryAction && (
                            <Button
                              size="xs"
                              variant="light"
                              color={feishuLinkPathStatus.color}
                              loading={isFeishuOfficialOnboardingActionLoading(feishuLinkPathCardActions.primaryAction)}
                              disabled={isFeishuOfficialOnboardingActionDisabled(feishuLinkPathCardActions.primaryAction)}
                              onClick={() => void handleFeishuOfficialOnboardingAction(feishuLinkPathCardActions.primaryAction)}
                            >
                              {resolveFeishuOfficialOnboardingActionLabel(feishuLinkPathCardActions.primaryAction)}
                            </Button>
                          )}
                          {feishuLinkPathCardActions.secondaryAction && (
                            <Button
                              size="xs"
                              variant="subtle"
                              color="gray"
                              loading={isFeishuOfficialOnboardingActionLoading(feishuLinkPathCardActions.secondaryAction)}
                              disabled={isFeishuOfficialOnboardingActionDisabled(feishuLinkPathCardActions.secondaryAction)}
                              onClick={() => void handleFeishuOfficialOnboardingAction(feishuLinkPathCardActions.secondaryAction)}
                            >
                              {resolveFeishuOfficialOnboardingActionLabel(feishuLinkPathCardActions.secondaryAction)}
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  </div>

                  <Card withBorder radius="md" padding="md" className="app-bg-secondary">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <Text size="sm" fw={600}>可选：飞书官方 CLI</Text>
                        <Text size="xs" c="dimmed">
                          仅用于补充官方登录状态和高级调试；不影响下方默认的飞书接入流程。
                        </Text>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          size="xs"
                          variant="light"
                          color={
                            feishuOfficialCliStatus
                              ? feishuOfficialCliStatus.available
                                ? 'success'
                                : 'gray'
                              : 'blue'
                          }
                        >
                          {feishuOfficialCliStatus
                            ? feishuOfficialCliStatus.available
                              ? '已安装'
                              : '未安装'
                            : '检测中'}
                        </Badge>
                        <Badge
                          size="xs"
                          variant="light"
                          color={resolveFeishuOfficialCliAuthBadgeColor(feishuOfficialCliStatus?.authState)}
                        >
                          {resolveFeishuOfficialCliAuthBadgeLabel(feishuOfficialCliStatus?.authState)}
                        </Badge>
                        {feishuOfficialCliStatus?.available && (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => setShowFeishuOfficialCliAdvanced((current) => !current)}
                          >
                            {showFeishuOfficialCliAdvanced ? '收起高级工具' : '显示高级工具'}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <Text size="xs">
                        {feishuOfficialCliStatus?.summary || '正在读取飞书官方 CLI 的本地状态...'}
                      </Text>
                      {feishuOfficialCliStatus?.version && (
                        <Text size="xs" c="dimmed">
                          版本：{feishuOfficialCliStatus.version}
                        </Text>
                      )}
                      {feishuOfficialCliStatus && (
                        <Text size="xs" c="dimmed">
                          状态命令：{feishuOfficialCliStatus.statusCommand.join(' ')}
                        </Text>
                      )}
                      {feishuOfficialCliStatus?.recommendedAction && (
                        <div className="rounded-lg border app-border-light app-bg-tertiary px-3 py-2 text-[11px] leading-5 app-text-tertiary">
                          {feishuOfficialCliStatus.recommendedAction}
                        </div>
                      )}
                      {feishuOfficialCliStatus?.statusError && feishuOfficialCliStatus.authState === 'error' && (
                        <Text size="xs" c="dimmed">
                          诊断：{feishuOfficialCliStatus.statusError}
                        </Text>
                      )}
                    </div>
                  </Card>

                  {showFeishuOfficialCliAdvanced && feishuOfficialCliStatus?.available && (
                    <Card
                      id="feishu-official-cli-guided-flow-card"
                      withBorder
                      radius="md"
                      padding="md"
                      className="app-bg-secondary"
                    >
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Text size="sm" fw={600}>下一步建议</Text>
                              <Badge size="xs" variant="light" color="gray">决策区</Badge>
                            </div>
                            <Text size="xs" c="dimmed">
                              这里根据官方 CLI 状态和当前托管路径给出下一步操作建议；下方“官方 CLI 执行区”只负责执行官方 CLI 步骤。
                            </Text>
                          </div>
                          <Badge size="xs" variant="light" color={feishuOfficialCliNextStep.color}>
                            {feishuOfficialCliNextStep.title}
                          </Badge>
                        </div>

                        <div className="rounded-lg border app-border-light app-bg-tertiary px-3 py-2">
                          <Text size="xs">{feishuOfficialCliNextStep.detail}</Text>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          {feishuOfficialCliNextStepSummary.map((item) => (
                            <div
                              key={item.label}
                              className="rounded-lg border app-border-light app-bg-tertiary px-3 py-2"
                            >
                              <Text size="xs" fw={600}>{item.label}</Text>
                              <Text size="xs" c="dimmed" mt={4}>{item.value}</Text>
                            </div>
                          ))}
                        </div>

                        {feishuOfficialCliNextStepBlockers.length > 0 && (
                          <div className="space-y-2">
                            <Text size="xs" fw={600}>仍阻塞完成</Text>
                            <div className="grid gap-2 md:grid-cols-2">
                              {feishuOfficialCliNextStepBlockers.map((item) => (
                                <div
                                  key={`${item.label}:${item.detail}`}
                                  className="rounded-lg border app-border-light app-bg-tertiary px-3 py-2"
                                >
                                  <Text size="xs" fw={600}>{item.label}</Text>
                                  <Text size="xs" c="dimmed" mt={4}>{item.detail}</Text>
                                  {(item.primaryAction || item.secondaryAction) && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {item.primaryAction && (
                                        <Button
                                          size="xs"
                                          variant="light"
                                          color="yellow"
                                          loading={isFeishuOfficialOnboardingActionLoading(item.primaryAction)}
                                          disabled={isFeishuOfficialOnboardingActionDisabled(item.primaryAction)}
                                          onClick={() => void handleFeishuOfficialOnboardingAction(item.primaryAction)}
                                        >
                                          {resolveFeishuOfficialOnboardingActionLabel(item.primaryAction)}
                                        </Button>
                                      )}
                                      {item.secondaryAction && (
                                        <Button
                                          size="xs"
                                          variant="subtle"
                                          color="gray"
                                          loading={isFeishuOfficialOnboardingActionLoading(item.secondaryAction)}
                                          disabled={isFeishuOfficialOnboardingActionDisabled(item.secondaryAction)}
                                          onClick={() => void handleFeishuOfficialOnboardingAction(item.secondaryAction)}
                                        >
                                          {resolveFeishuOfficialOnboardingActionLabel(item.secondaryAction)}
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {feishuOfficialCliLiveAssist.length > 0 && (
                          <div className="space-y-2">
                            <Text size="xs" fw={600}>当前验证信息</Text>
                            <div className="grid gap-2 md:grid-cols-2">
                              {feishuOfficialCliLiveAssist.map((item) => (
                                <div
                                  key={`${item.label}:${item.value}`}
                                  className="rounded-lg border app-border-light app-bg-tertiary px-3 py-2"
                                >
                                  <Text size="xs" fw={600}>{item.label}</Text>
                                  <Text size="xs" c="dimmed" mt={4}>{item.detail}</Text>
                                  <Text size="xs" mt={6} lineClamp={item.label === '验证链接' ? 2 : undefined}>
                                    {item.value}
                                  </Text>
                                  {(item.primaryAction || item.secondaryAction || item.copyValue) && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {item.primaryAction && (
                                        <Button
                                          size="xs"
                                          variant="light"
                                          color="blue"
                                          loading={isFeishuOfficialOnboardingActionLoading(item.primaryAction)}
                                          disabled={isFeishuOfficialOnboardingActionDisabled(item.primaryAction)}
                                          onClick={() => void handleFeishuOfficialOnboardingAction(item.primaryAction)}
                                        >
                                          {resolveFeishuOfficialOnboardingActionLabel(item.primaryAction)}
                                        </Button>
                                      )}
                                      {item.secondaryAction && (
                                        <Button
                                          size="xs"
                                          variant="subtle"
                                          color="gray"
                                          loading={isFeishuOfficialOnboardingActionLoading(item.secondaryAction)}
                                          disabled={isFeishuOfficialOnboardingActionDisabled(item.secondaryAction)}
                                          onClick={() => void handleFeishuOfficialOnboardingAction(item.secondaryAction)}
                                        >
                                          {resolveFeishuOfficialOnboardingActionLabel(item.secondaryAction)}
                                        </Button>
                                      )}
                                      {item.copyValue && (
                                        <CopyButton value={item.copyValue} timeout={2000}>
                                          {({ copied, copy }) => (
                                            <Button size="xs" variant="subtle" color="gray" onClick={copy}>
                                  {copied ? '已复制' : item.copyLabel || '复制'}
                                            </Button>
                                          )}
                                        </CopyButton>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(feishuOfficialCliNextStep.primaryAction || feishuOfficialCliNextStep.secondaryAction) && (
                          <div className="flex flex-wrap gap-2">
                            {feishuOfficialCliNextStep.primaryAction && (
                              <Button
                                size="xs"
                                variant="light"
                                color={feishuOfficialCliNextStep.color}
                                loading={isFeishuOfficialOnboardingActionLoading(feishuOfficialCliNextStep.primaryAction)}
                                disabled={isFeishuOfficialOnboardingActionDisabled(feishuOfficialCliNextStep.primaryAction)}
                                onClick={() => void handleFeishuOfficialOnboardingAction(feishuOfficialCliNextStep.primaryAction)}
                              >
                                {resolveFeishuOfficialOnboardingActionLabel(feishuOfficialCliNextStep.primaryAction)}
                              </Button>
                            )}
                            {feishuOfficialCliNextStep.secondaryAction && (
                              <Button
                                size="xs"
                                variant="subtle"
                                color="gray"
                                loading={isFeishuOfficialOnboardingActionLoading(feishuOfficialCliNextStep.secondaryAction)}
                                disabled={isFeishuOfficialOnboardingActionDisabled(feishuOfficialCliNextStep.secondaryAction)}
                                onClick={() => void handleFeishuOfficialOnboardingAction(feishuOfficialCliNextStep.secondaryAction)}
                              >
                                {resolveFeishuOfficialOnboardingActionLabel(feishuOfficialCliNextStep.secondaryAction)}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {showFeishuOfficialCliAdvanced && feishuOfficialCliStatus?.available && (
                    <Card withBorder radius="md" padding="md" className="app-bg-secondary">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Text size="sm" fw={600}>官方 CLI 执行区</Text>
                              <Badge size="xs" variant="light" color="gray">
                                {feishuOfficialCliGuidedFlowPurpose.label}
                              </Badge>
                            </div>
                            <Text size="xs" c="dimmed">
                              {feishuOfficialCliGuidedFlowPurpose.detail}
                            </Text>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge size="xs" variant="light" color={feishuOfficialCliSessionRunning ? 'blue' : 'gray'}>
                              {resolveFeishuOfficialCliSessionModeLabel(feishuOfficialCliSessionMode)}
                            </Badge>
                            <Badge size="xs" variant="light" color={feishuOfficialCliSessionStatus.color}>
                              {feishuOfficialCliSessionStatus.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="rounded-lg border app-border-light app-bg-tertiary px-3 py-2">
                          <Text size="xs">{feishuOfficialCliSessionStatus.detail}</Text>
                          {feishuOfficialCliSessionNotice && (
                            <Text size="xs" c="dimmed" mt={6}>
                              {feishuOfficialCliSessionNotice}
                            </Text>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {feishuOfficialCliGuidedFlowActions.map((action, index) => (
                            <Button
                              key={action}
                              size="xs"
                              variant={index === 0 ? 'light' : 'subtle'}
                              color={action === 'stop-official-cli-session' ? 'red' : index === 0 ? 'blue' : 'gray'}
                              onClick={() => void handleFeishuOfficialCliGuidedFlowAction(action)}
                              loading={isFeishuOfficialCliGuidedFlowActionLoading(action)}
                              disabled={isFeishuOfficialCliGuidedFlowActionDisabled(action)}
                            >
                              {resolveFeishuOfficialCliGuidedFlowActionLabel(action)}
                            </Button>
                          ))}
                        </div>

                        {(feishuOfficialCliSessionMode || feishuOfficialCliSessionOutput.trim()) && (
                          <div className="space-y-2">
                            {resolveFeishuOfficialCliSessionCommand(feishuOfficialCliSessionMode) && (
                              <Text size="xs" c="dimmed">
                                命令：{resolveFeishuOfficialCliSessionCommand(feishuOfficialCliSessionMode)}
                              </Text>
                            )}
                            {feishuOfficialCliLiveAssist.map((item) => (
                              <div
                                key={`guided-flow:${item.label}:${item.value}`}
                                className="rounded-lg border app-border-light app-bg-tertiary px-3 py-2"
                              >
                                <Text size="xs" fw={600}>{item.label}</Text>
                                <Text size="xs" c="dimmed" mt={4}>{item.detail}</Text>
                                <Text size="xs" mt={6} lineClamp={item.label === '验证链接' ? 2 : undefined}>
                                  {item.value}
                                </Text>
                                {(item.primaryAction || item.copyValue) && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.primaryAction && (
                                      <Button
                                        size="compact-xs"
                                        variant="light"
                                        loading={isFeishuOfficialOnboardingActionLoading(item.primaryAction)}
                                        disabled={isFeishuOfficialOnboardingActionDisabled(item.primaryAction)}
                                        onClick={() => void handleFeishuOfficialOnboardingAction(item.primaryAction)}
                                      >
                                        {resolveFeishuOfficialOnboardingActionLabel(item.primaryAction)}
                                      </Button>
                                    )}
                                    {item.copyValue && (
                                      <CopyButton value={item.copyValue} timeout={2000}>
                                        {({ copied, copy }) => (
                                          <Button size="compact-xs" variant="subtle" onClick={copy}>
                                            {copied ? '已复制' : item.copyLabel || '复制'}
                                          </Button>
                                        )}
                                      </CopyButton>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="rounded-lg border app-border-light bg-black/40 px-3 py-3">
                              <ScrollArea.Autosize mah={180}>
                                <pre className="text-[11px] leading-5 whitespace-pre-wrap break-words text-gray-200">
                                  {feishuOfficialCliSessionOutput || '当前还没有飞书官方 CLI 输出。'}
                                </pre>
                              </ScrollArea.Autosize>
                            </div>
                            <Group gap="xs" align="flex-end">
                              <TextInput
                                label="发送输入"
                                size="xs"
                                className="flex-1 min-w-[220px]"
                                value={feishuOfficialCliSessionInput}
                                onChange={(event) => setFeishuOfficialCliSessionInput(event.currentTarget.value)}
                                placeholder="向当前会话发送文本"
                                disabled={!feishuOfficialCliSessionRunning}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault()
                                    const raw = feishuOfficialCliSessionInput.trim()
                                    if (!raw) return
                                    void sendFeishuOfficialCliSessionInput(raw.endsWith('\n') ? raw : `${raw}\n`).then((ok) => {
                                      if (ok) setFeishuOfficialCliSessionInput('')
                                    })
                                  }
                                }}
                              />
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => void sendFeishuOfficialCliSessionInput('\u001b[A')}
                                disabled={!feishuOfficialCliSessionRunning}
                              >
                                上移
                              </Button>
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => void sendFeishuOfficialCliSessionInput('\u001b[B')}
                                disabled={!feishuOfficialCliSessionRunning}
                              >
                                下移
                              </Button>
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => void sendFeishuOfficialCliSessionInput('\r')}
                                disabled={!feishuOfficialCliSessionRunning}
                              >
                                确认
                              </Button>
                              <Button
                                size="xs"
                                variant="subtle"
                                color="red"
                                onClick={() => void sendFeishuOfficialCliSessionInput('\u0003')}
                                disabled={!feishuOfficialCliSessionRunning}
                              >
                                Ctrl+C
                              </Button>
                              <Button
                                size="xs"
                                onClick={() => {
                                  const raw = feishuOfficialCliSessionInput.trim()
                                  if (!raw) return
                                  void sendFeishuOfficialCliSessionInput(raw.endsWith('\n') ? raw : `${raw}\n`).then((ok) => {
                                    if (ok) setFeishuOfficialCliSessionInput('')
                                  })
                                }}
                                disabled={!feishuOfficialCliSessionRunning || !feishuOfficialCliSessionInput.trim()}
                              >
                                发送
                              </Button>
                            </Group>
                            {(feishuOfficialCliSessionExitCode !== null || feishuOfficialCliSessionCanceled) && !feishuOfficialCliSessionRunning && (
                              <Text size="xs" c="dimmed">
                                会话结果：{feishuOfficialCliSessionCanceled ? '已取消' : feishuOfficialCliSessionExitCode === 0 ? '成功' : `退出码 ${feishuOfficialCliSessionExitCode}`}
                              </Text>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {showFeishuOfficialCliAdvanced && feishuOfficialCliStatus && !feishuOfficialCliStatus.available && (
                    <Card withBorder radius="md" padding="md" className="app-bg-secondary">
                      <div className="space-y-3">
                        <div>
                          <Text size="sm" fw={600}>建议准备飞书官方 CLI (lark-cli)</Text>
                          <Text size="xs" c="dimmed">
                            这是飞书官方推荐的底层 CLI，可用于后续的扫码登录、权限分配和 API 调试；它不会替代当前页面里的官方插件安装器。
                          </Text>
                        </div>
                        <div className="flex justify-end">
                          <Button size="xs" variant="light" color="blue" onClick={loadFeishuOfficialCliStatus}>
                            安装后刷新状态
                          </Button>
                        </div>
                        <div className="rounded-md bg-black/40 flex items-center justify-between pl-3 pr-1 py-1 font-mono text-[11px] text-gray-300">
                          <code>npm install -g @larksuite/cli</code>
                          <CopyButton value="npm install -g @larksuite/cli" timeout={2000}>
                            {({ copied, copy }) => (
                              <Tooltip label={copied ? '已复制' : '复制命令'} withArrow position="right">
                                <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy} variant="subtle" size="sm">
                                  {copied ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                  )}
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </CopyButton>
                        </div>
                      </div>
                    </Card>
                  )}

                  {preparingFeishuManualBinding ? (
                    <div className="rounded-xl border app-border bg-black/20 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <Loader size="sm" color="teal" mt={2} />
                        <div className="space-y-1.5">
                          <Text size="sm" fw={600}>{feishuManualBindingPreparationCopy.title}</Text>
                          <Text size="xs" c="dimmed">
                            {feishuManualBindingPreparationCopy.description}
                          </Text>
                          {feishuManualBindingPreparationCopy.hint && (
                            <Text size="xs" c="dimmed">
                              {feishuManualBindingPreparationCopy.hint}
                            </Text>
                          )}
                          <Text size="xs" c="dimmed">
                            Mclaw 会自动轮询插件状态；如果插件其实已经装好、但页面还没切换，也可以点击上方“刷新状态”立即重试。
                          </Text>
                        </div>
                      </div>
                    </div>
                  ) : feishuBotSetupMode === 'create' ? (
                    <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
                      {feishuInstallerAsciiQr ? (
                        <div className="rounded-xl border app-border bg-black px-3 py-3 overflow-auto">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] font-medium text-emerald-300">本次创建流程的真实二维码</p>
                            <Badge size="xs" variant="light" color="success">已刷新</Badge>
                          </div>
                          <pre className="whitespace-pre font-mono text-[8px] leading-[1.1] text-zinc-100">
                            {feishuInstallerAsciiQr}
                          </pre>
                        </div>
                      ) : feishuInstallerQrUrl ? (
                        <div className="flex flex-col items-center rounded-xl border app-border bg-black/20 px-4 py-4">
                          <div className="mb-2 flex w-full items-center justify-between gap-2">
                            <p className="text-[11px] font-medium app-text-secondary">本次创建流程二维码</p>
                            <Badge
                              size="xs"
                              variant="light"
                              color="success"
                            >
                              已刷新
                            </Badge>
                          </div>
                          <QRCodeSVG value={feishuInstallerQrUrl} size={180} includeMargin />
                          <p className="mt-2 text-center text-[11px] app-text-muted">
                            只扫描这里实时刷新的二维码；教程截图里的二维码只是示意图。
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center rounded-xl border border-dashed app-border bg-black/20 px-4 py-4">
                          <div className="mb-2 flex w-full items-center justify-between gap-2">
                            <p className="text-[11px] font-medium app-text-secondary">本次创建流程二维码</p>
                            <Badge
                              size="xs"
                              variant="light"
                              color={feishuInstallerRunning ? 'warning' : 'gray'}
                            >
                              {feishuInstallerRunning ? '等待生成' : '未生成'}
                            </Badge>
                          </div>
                          <p className="text-center text-sm app-text-primary">当前还没有拿到本次创建流程二维码。</p>
                          <p className="mt-2 text-center text-[11px] app-text-muted">
                            {feishuInstallerRunning
                              ? '请先等待下方输出刷新；只有这里出现二维码后再扫码，教程截图里的二维码不要扫。'
                              : '重新启动创建流程后，二维码会显示在这里。'}
                          </p>
                          {feishuInstallerRunning && (
                            <div className="mt-3 w-full">
                              <div className="mb-1 flex items-center justify-between text-[11px] app-text-muted">
                                <span>正在等待本次创建流程二维码</span>
                                <span>加载中</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full app-bg-tertiary">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"
                                  style={{
                                    width: '38%',
                                    animation: 'feishuQrProgress 1.4s ease-in-out infinite',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2 text-xs leading-6 app-text-tertiary">
                        <p className="font-medium app-text-secondary">新建机器人</p>
                        <p>大多数用户直接用飞书扫码创建新的官方机器人即可，不需要先手填 App ID / App Secret。</p>
                        <a
                          href={FEISHU_OFFICIAL_GUIDE_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-[11px] app-text-success hover:opacity-80"
                        >
                          打开飞书官网使用指南
                        </a>
                        <p className="text-[11px] leading-5 app-text-muted">
                          如果你已经在飞书开放平台创建好了机器人，或扫码创建失败后需要手动回退，请点击上方“关联已有机器人”，
                          Mclaw 会先确认飞书官方插件真实可用；缺失时会先自动补装，再开放手动绑定。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl border app-border bg-black/20 px-3 py-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-medium app-text-secondary">运行态入口提示</p>
                          <Badge
                            size="xs"
                            variant="light"
                            color={feishuLinkPathPanelIntro.color}
                          >
                            {feishuLinkPathPanelIntro.label}
                          </Badge>
                        </div>
                        <Text size="xs" c="dimmed">
                          {feishuLinkPathPanelIntro.detail}
                        </Text>
                      </div>
                      {feishuBotsOrdered.length > 0 && (
                        <div className="rounded-xl border app-border bg-black/20 px-3 py-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-medium app-text-secondary">绑定方式</p>
                            <Badge
                              size="xs"
                              variant="light"
                              color={feishuLinkSourceMode === 'existing' ? 'success' : 'blue'}
                            >
                              {feishuLinkSourceMode === 'existing' ? '复用模式' : '手动模式'}
                            </Badge>
                          </div>
                          <SegmentedControl
                            value={feishuLinkSourceMode}
                            onChange={handleFeishuLinkSourceModeChange}
                            data={[
                              { label: '复用已检测到机器人', value: 'existing' },
                              { label: '手动输入凭证', value: 'manual' },
                            ]}
                            size="xs"
                            fullWidth
                          />
                        </div>
                      )}
                      {feishuBotsOrdered.length > 0 && feishuLinkSourceMode === 'existing' && (
                        <div className="rounded-xl border app-border bg-black/20 px-3 py-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-medium app-text-secondary">已检测到的机器人</p>
                            <Badge
                              size="xs"
                              variant="light"
                              color="success"
                            >
                              {feishuBotsOrdered.length} 个可复用
                            </Badge>
                          </div>
                          <p className="mb-3 text-[11px] leading-5 app-text-muted">
                            保持当前模式时，底部“完成机器人配置”会直接复用这里选中的机器人。
                          </p>
                          {feishuBotsOrdered.length > 1 ? (
                            <SegmentedControl
                              value={resolvedSelectedFeishuExistingBotAccountId}
                              onChange={setSelectedFeishuExistingBotAccountId}
                              data={feishuBotsOrdered.map((bot) => ({
                                label: bot.name,
                                value: bot.accountId,
                              }))}
                              size="xs"
                              fullWidth
                            />
                          ) : (
                            <div className="rounded-lg border app-border-light app-bg-tertiary px-3 py-2">
                              <Text size="xs" fw={600}>{feishuBotsOrdered[0]?.name}</Text>
                            </div>
                          )}
                          {selectedFeishuExistingBot && (
                            <Text size="xs" c="dimmed" mt="sm">
                              当前选中：{' '}
                              {selectedFeishuExistingBot.name}
                              {selectedFeishuExistingBotMeta ? ` (${selectedFeishuExistingBotMeta})` : ''}
                            </Text>
                          )}
                        </div>
                      )}
                      {(feishuLinkSourceMode === 'manual' || feishuBotsOrdered.length === 0) && (
                        <div className="rounded-xl border app-border bg-black/20 px-3 py-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-medium app-text-secondary">手动绑定</p>
                            <Badge
                            size="xs"
                            variant="light"
                            color={feishuManualCredentialsReady ? 'success' : 'gray'}
                          >
                            {feishuManualCredentialsReady ? '可直接绑定' : '填写后可用'}
                          </Badge>
                        </div>
                          <p className="mb-3 text-[11px] leading-5 app-text-muted">
                            仅当你已经拿到了已有飞书机器人的 App ID / App Secret，或扫码创建失败需要回退时，再在这里输入，
                            然后点击下方“完成机器人配置”。
                          </p>
                        <div className="space-y-2">
                          <TextInput
                            label="App ID"
                            value={formData.appId || ''}
                            onChange={(e) => handleFieldChange('appId', e.currentTarget.value)}
                            placeholder="cli_xxxxxxxxxx"
                            error={
                              showFieldErrors || (formData.appId || '').trim()
                                ? channelValidation.fieldErrors.appId
                                : undefined
                            }
                            size="xs"
                          />
                          <PasswordInput
                            label="App Secret"
                            value={formData.appSecret || ''}
                            onChange={(e) => handleFieldChange('appSecret', e.currentTarget.value)}
                            placeholder="应用密钥"
                            error={
                              showFieldErrors || (formData.appSecret || '').trim()
                                ? channelValidation.fieldErrors.appSecret
                                : undefined
                            }
                            size="xs"
                          />
                        </div>
                        {showInlineFeishuManualError && (
                          <Alert color="red" variant="light" title="手动绑定失败" mt="sm">
                            {error}
                          </Alert>
                        )}
                        </div>
                      )}
                    </div>
                  )}

                  {(feishuInstallerRunning || feishuInstallerOutput.trim() || feishuInstallerExitCode !== null) && (
                    <Card withBorder radius="md" padding="md" className="app-bg-secondary">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <Text size="sm" fw={600}>官方安装器输出</Text>
                        <Badge
                          size="xs"
                          variant="light"
                          color={
                            feishuInstallerRunning
                              ? 'warning'
                              : feishuInstallerExitCode === 0
                                ? 'success'
                                : 'red'
                          }
                        >
                          {feishuInstallerRunning ? '运行中' : feishuInstallerExitCode === 0 ? '已完成' : '已退出'}
                        </Badge>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2">
                        <Button
                          variant="light"
                          size="compact-xs"
                          onClick={() => void sendFeishuInstallerInput('\u001b[A')}
                          disabled={!feishuInstallerRunning}
                        >
                          上移
                        </Button>
                        <Button
                          variant="light"
                          size="compact-xs"
                          onClick={() => void sendFeishuInstallerInput('\u001b[B')}
                          disabled={!feishuInstallerRunning}
                        >
                          下移
                        </Button>
                        <Button
                          variant="light"
                          size="compact-xs"
                          color="success"
                          onClick={() => void sendFeishuInstallerInput('\r')}
                          disabled={!feishuInstallerRunning}
                        >
                          确认
                        </Button>
                        <Button
                          variant="subtle"
                          size="compact-xs"
                          color="danger"
                          onClick={() => void sendFeishuInstallerInput('\u0003')}
                          disabled={!feishuInstallerRunning}
                        >
                          Ctrl+C
                        </Button>
                      </div>

                      <Text size="xs" c="dimmed" mb="sm">
                        如果安装器停在等待输入，请优先看上方提示卡和下方日志末尾；完成登录、选项确认或机器人命名后，再继续刷新当前状态。
                      </Text>

                      <ScrollArea.Autosize mah={220} type="auto" offsetScrollbars>
                        <pre className="rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-6 text-zinc-200 whitespace-pre-wrap break-words">
                          {feishuInstallerOutput.trim() || '安装器已启动；如果暂时没有输出，请继续等待或按提示完成当前步骤。'}
                        </pre>
                      </ScrollArea.Autosize>

                      <div className="mt-3 flex items-center gap-2">
                        <TextInput
                          size="xs"
                          className="flex-1"
                          value={feishuInstallerInput}
                          onChange={(e) => setFeishuInstallerInput(e.currentTarget.value)}
                          placeholder="向官方安装器发送输入，例如机器人名称或回车"
                          disabled={!feishuInstallerRunning}
                        />
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => {
                            const raw = feishuInstallerInput
                            if (!raw) return
                            void sendFeishuInstallerInput(raw.endsWith('\n') ? raw : `${raw}\n`).then((ok) => {
                              if (ok) setFeishuInstallerInput('')
                            })
                          }}
                          disabled={!feishuInstallerRunning || !feishuInstallerInput.trim()}
                        >
                          发送
                        </Button>
                      </div>
                    </Card>
                  )}

                  {feishuInstallerNotice && (
                    <Alert color="blue" variant="light" title="飞书安装提示">
                      {feishuInstallerNotice}
                    </Alert>
                  )}
                </div>
              ) : selectedChannel.id === 'openclaw-weixin' ? (
                <div className="space-y-3">
                  <Text size="sm" c="dimmed">
                    点击“开始连接”后，Mclaw 会安装个人微信插件，并在下方命令输出里直接展示二维码。请使用微信扫码并在手机上确认授权。
                  </Text>
                  <Text size="xs" c="dimmed">
                    如果二维码过期，安装器会自动刷新；连接成功后，账号会自动同步到控制面板中。当前版本暂不支持给其他微信用户做配对授权，仅扫码登录的这个微信账号可直接使用。
                  </Text>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="filled"
                      color="success"
                      size="xs"
                      onClick={() => void startWeixinInstallerFlow()}
                      loading={weixinInstallerBusy}
                      disabled={weixinInstallerRunning || finishingWeixinSetup}
                    >
                      开始连接
                    </Button>
                    <Button
                      variant="subtle"
                      size="xs"
                      color="danger"
                      onClick={() => void stopWeixinInstallerFlow()}
                      disabled={!weixinInstallerRunning || weixinInstallerBusy || finishingWeixinSetup}
                    >
                      中止安装
                    </Button>
                  </div>

                  {(weixinInstallerRunning || weixinInstallerOutput.trim() || weixinInstallerExitCode !== null) && (
                    <div className="space-y-3">
                      {weixinInstallerAsciiQr && (
                        <Card withBorder radius="md" padding="md" className="app-bg-secondary">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <Text size="sm" fw={600}>个人微信二维码</Text>
                              <Text size="xs" c="dimmed" mt={4}>
                                这里会优先展示当前可扫码的完整二维码，不需要在日志里滚动查找。
                              </Text>
                            </div>
                            <Badge size="xs" variant="light" color={weixinInstallerRunning ? 'success' : 'gray'}>
                              {weixinInstallerRunning ? '可扫码' : '最后一次二维码'}
                            </Badge>
                          </div>

                          <div className="rounded-lg bg-black px-4 py-4 overflow-auto">
                            <pre className="mx-auto w-fit whitespace-pre font-mono text-[8px] leading-[1.05] tracking-[-0.02em] text-zinc-100">
                              {weixinInstallerAsciiQr}
                            </pre>
                          </div>
                        </Card>
                      )}

                      <Card withBorder radius="md" padding="md" className="app-bg-secondary">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Text size="sm" fw={600}>个人微信安装器输出</Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color={
                              finishingWeixinSetup
                                ? 'blue'
                                : weixinInstallerRunning
                                  ? 'warning'
                                  : weixinInstallerExitCode === 0
                                    ? 'success'
                                    : weixinInstallerCanceled
                                      ? 'gray'
                                      : 'red'
                            }
                          >
                            {finishingWeixinSetup
                              ? '同步中'
                              : weixinInstallerRunning
                                ? '运行中'
                                : weixinInstallerCanceled
                                  ? '已取消'
                                  : weixinInstallerExitCode === 0
                                    ? '已完成'
                                    : '已退出'}
                          </Badge>
                        </div>

                        <ScrollArea.Autosize mah={420} type="auto" offsetScrollbars>
                          <pre className="rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-5 text-zinc-200 whitespace-pre overflow-x-auto">
                            {weixinInstallerOutput.trim() || '安装器已启动，正在等待输出...'}
                          </pre>
                        </ScrollArea.Autosize>

                        {weixinInstallerNewAccountIds.length > 0 && (
                          <Text size="xs" c="dimmed" mt="sm">
                            新增账号：{weixinInstallerNewAccountIds.join(', ')}
                          </Text>
                        )}
                      </Card>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {selectedChannel.plugin && (
                    <div className="text-xs app-text-muted app-bg-tertiary border app-border-light rounded px-2 py-1.5">
                      将自动安装: {getChannelPluginInstallLabel(selectedChannel)}
                    </div>
                  )}

                  {selectedChannel.useQrBinding && selectedChannel.fields.length > 0 && (
                    <SegmentedControl
                      value={bindingMode}
                      onChange={(value) => setBindingMode(value as 'qr' | 'manual')}
                      data={[
                        { label: '扫码绑定', value: 'qr' },
                        { label: '手动配置', value: 'manual' },
                      ]}
                      size="xs"
                      fullWidth
                    />
                  )}

                  {bindingMode === 'qr' && selectedChannel.useQrBinding ? (
                    <Text size="xs" c="dimmed">
                      点击"连接"后将生成二维码，使用{selectedChannel.name}扫码完成绑定
                    </Text>
                  ) : (
                    selectedChannel.fields.map((field) => {
                      const fieldValue = formData[field.key] || ''
                      const fieldError =
                        showFieldErrors || fieldValue.trim()
                          ? channelValidation.fieldErrors[field.key]
                          : ''
                      const InputComponent = field.type === 'password' ? PasswordInput : TextInput
                      return (
                        <div key={field.key}>
                          <InputComponent
                            label={field.label}
                            value={fieldValue}
                            onChange={(e) => handleFieldChange(field.key, e.currentTarget.value)}
                            placeholder={field.placeholder}
                            error={fieldError || undefined}
                            size="sm"
                          />
                        </div>
                      )
                    })
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={onBack}
              variant="default"
              size="sm"
              className="flex-1"
            >
              返回
            </Button>
            {shouldShowChannelConnectSkipButton({ canSkip, forceShowSkip }) && (
              <Button
                onClick={onSkip}
                variant="default"
                size="sm"
                className="flex-1"
              >
                跳过
              </Button>
            )}
            {selectedChannel?.id === 'feishu' ? (
              <Button
                onClick={() => void finishFeishuChannelConnect()}
                disabled={
                  (
                    feishuBotSetupMode === 'link'
                      ? !feishuLinkModeCanFinish || feishuLinkModeFinishStrategy === 'invalid-manual'
                      : !feishuCreateModeCanFinish || feishuCreateModeFinishStrategy === 'invalid-manual'
                  ) || finishingFeishuSetup
                }
                loading={finishingFeishuSetup}
                color="success"
                size="sm"
                className="flex-1"
              >
                完成机器人配置
              </Button>
            ) : selectedChannel?.id === 'openclaw-weixin' ? (
              <Button
                onClick={() => void startWeixinInstallerFlow()}
                disabled={weixinInstallerRunning || weixinInstallerBusy || finishingWeixinSetup}
                loading={weixinInstallerBusy || finishingWeixinSetup}
                color="success"
                size="sm"
                className="flex-1"
              >
                开始连接
              </Button>
            ) : (
              <Button
                onClick={doConnect}
                disabled={!canConnect}
                color="success"
                size="sm"
                className="flex-1"
              >
                连接
              </Button>
            )}
          </div>
          {error && !showInlineFeishuManualError && (
            <Alert mt="sm" color="red" variant="light" title="操作失败">
              {error}
            </Alert>
          )}
        </>
      )}

      {(status === 'installing' || status === 'starting' || status === 'connected' || status === 'error') && (
        <>
          {/* 进度提示 */}
          {(status === 'installing' || status === 'starting') && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs app-text-tertiary">
                  {status === 'installing' ? '正在安装插件...' : '正在启动服务...'}
                </span>
                <span className="text-xs app-text-muted">请稍候</span>
              </div>
              {/* 动画进度条 */}
              <div className="h-1 app-bg-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-progress"
                  style={{
                    width: '30%',
                    animation: 'progress 2s ease-in-out infinite'
                  }}
                />
              </div>
              <style>{`
                @keyframes progress {
                  0% { width: 10%; margin-left: 0; }
                  50% { width: 40%; margin-left: 30%; }
                  100% { width: 10%; margin-left: 90%; }
                }
              `}</style>
            </div>
          )}

          <div className="app-bg-tertiary border app-border rounded-lg p-3 mb-4 font-mono text-xs app-text-secondary whitespace-pre-wrap max-h-40 overflow-y-auto">
            {log}
            {(status === 'installing' || status === 'starting') && (
              <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </div>

          {status === 'connected' && (
            <Button
              onClick={() => onNext({ channelId: selectedChannelId })}
              color="success"
              size="sm"
              fullWidth
            >
              {buildChannelConnectConnectedActionLabel(selectedChannel)}
            </Button>
          )}

          {status === 'error' && (
            <div>
              <Text size="xs" c="danger" mb="sm">{error}</Text>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setStatus('form')
                    setLog('')
                    setError('')
                    pluginInstalledRef.current = false
                  }}
                  variant="default"
                  size="sm"
                  className="flex-1"
                >
                  返回修改
                </Button>
                <Button
                  onClick={doConnect}
                  color="success"
                  size="sm"
                  className="flex-1"
                >
                  重试
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <FeishuInstallTutorialModal
        opened={showFeishuInstallTutorial}
        onClose={() => setShowFeishuInstallTutorial(false)}
      />

      <Modal
        opened={showQrModal}
        onClose={handleQrClose}
        size="sm"
        title={<Text fw={600}>企业微信扫码绑定</Text>}
        centered
      >
        <Stack align="center" gap="md" py="sm">
          {qrStatus === 'loading' && (
            <>
              <Loader size="sm" />
              <Text size="sm" c="dimmed">正在生成二维码...</Text>
            </>
          )}
          {qrStatus === 'ready' && qrAuthUrl && (
            <>
              <Text size="sm" c="dimmed">请使用企业微信扫描以下二维码</Text>
              <QRCodeSVG value={qrAuthUrl} size={220} />
              <Text size="xs" c="dimmed">二维码有效期 3 分钟</Text>
              <Loader size="sm" />
              <Text size="xs" c="dimmed">等待扫码中...</Text>
            </>
          )}
          {qrStatus === 'error' && (
            <Text size="sm" c="red">二维码生成失败或已超时，请关闭后重试</Text>
          )}
        </Stack>
      </Modal>
      <style>{`
        @keyframes feishuQrProgress {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(290%); }
        }
      `}</style>
    </div>
  )
}
