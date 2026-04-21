import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, ActionIcon, Badge, Button, Card, Group, Modal, ScrollArea, SegmentedControl, Text, TextInput, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { QRCodeSVG } from 'qrcode.react'
import FeishuInstallTutorialModal from './FeishuInstallTutorialModal'
import {
  detectFeishuIsolationDrift,
  listFeishuBots,
  normalizeFeishuOfficialPluginConfig,
  removeFeishuBotConfigForPluginState,
  sanitizeFeishuPluginConfig,
  type FeishuBotItem,
} from '../pages/feishu-bots'
import { applyFeishuMultiBotIsolation } from '../lib/feishu-multi-bot-routing'
import {
  extractFeishuAsciiQr,
  extractFeishuExistingBotPromptKey,
  extractFeishuLiveQrUrl,
  FEISHU_OFFICIAL_GUIDE_URL,
  FEISHU_OFFICIAL_INSTALL_COMMAND,
} from '../lib/feishu-installer'
import { toUserFacingCliFailureMessage, toUserFacingUnknownErrorMessage } from '../lib/user-facing-cli-feedback'

interface FeishuBotManagerModalProps {
  opened: boolean
  onClose: () => void
}

type PairingStatusMap = Record<string, { pairedCount: number; pairedUsers: string[] }>
type FeishuBotManagerRefreshResourcesApi =
  Pick<typeof window.api, 'getFeishuInstallerState'>
type FeishuRuntimeStatusState = 'online' | 'offline' | 'degraded' | 'disabled'
type FeishuBotManagerSetupMode = 'create' | 'link'
type FeishuBotManagerModeStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type FeishuBotManagerSelectedBotStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type RuntimeStatusMap = Record<
  string,
  {
    accountId: string
    agentId: string
    workspace: string
    enabled: boolean
    credentialsComplete: boolean
    gatewayRunning: boolean
    runtimeState: FeishuRuntimeStatusState
    summary: string
    issues: string[]
  }
>

function getRuntimeBadgeColor(state: FeishuRuntimeStatusState | undefined): string {
  if (state === 'online') return 'teal'
  if (state === 'degraded') return 'yellow'
  if (state === 'disabled') return 'gray'
  return 'red'
}

function getRuntimeLabel(state: FeishuRuntimeStatusState | undefined): string {
  if (state === 'online') return '在线'
  if (state === 'degraded') return '待修复'
  if (state === 'disabled') return '已禁用'
  return '离线'
}

export function shouldResetFeishuBotManagerInstallerEphemeralState(params: {
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

export function resolveFeishuBotManagerInstallerStartState(): {
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
    notice: resolveFeishuBotManagerInstallerLiveNotice({
      running: true,
      hasLiveQr: false,
      hasOutput: false,
    }),
  }
}

export function resolveFeishuBotManagerInstallerStartPlan(params: {
  requestedMode: 'create' | 'link'
  currentMode: 'create' | 'link'
  hasActiveSession: boolean
}): {
  mode: 'create' | 'link'
  shouldPrimeFreshStartState: boolean
} {
  if (params.hasActiveSession) {
    return {
      mode: params.currentMode,
      shouldPrimeFreshStartState: false,
    }
  }

  return {
    mode: params.requestedMode,
    shouldPrimeFreshStartState: true,
  }
}

export function resolveFeishuBotManagerInstallerReuseNotice(): string {
  return '飞书官方安装器已在运行中，Mclaw 已重新连接到当前安装会话，不会重复启动第二个安装器。'
}

export function resolveFeishuBotManagerInstallerActionState(params: {
  mode: FeishuBotManagerSetupMode
  availableLinkedBotCount: number
  selectedLinkedBotName?: string
}): {
  label: string
  disabled: boolean
  description: string
} {
  if (params.mode === 'link') {
    if (params.availableLinkedBotCount <= 0) {
      return {
        label: '复用已有机器人',
        disabled: true,
        description: '当前还没有可复用的飞书机器人，请先创建一个。',
      }
    }

    if (String(params.selectedLinkedBotName || '').trim()) {
      return {
        label: '复用已有机器人',
        disabled: false,
        description: `准备复用「${String(params.selectedLinkedBotName).trim()}」。当官方安装器出现复用提示时，Mclaw 会自动确认；如果后续仍要求选择目标，请在下方控制台里继续确认。`,
      }
    }

    return {
      label: '复用已有机器人',
      disabled: false,
      description: '当官方安装器出现复用入口时，Mclaw 会继续走复用已有机器人的路径。',
    }
  }

  return {
    label: '新建机器人',
    disabled: false,
    description: '启动飞书官方安装器，并创建一个新的飞书机器人。',
  }
}

export function resolveFeishuBotManagerInstallerConsoleHint(params: {
  mode: FeishuBotManagerSetupMode
  selectedLinkedBotName?: string
}): string {
  if (params.mode === 'link') {
    const selectedLinkedBotName = String(params.selectedLinkedBotName || '').trim()
    if (selectedLinkedBotName) {
      return `复用流程开始后，Mclaw 会在复用提示上自动回答“Y”；如果官方安装器继续要求选择目标，请在下方控制台里确认与「${selectedLinkedBotName}」对应的选项。`
    }

    return '复用流程开始后，Mclaw 会在复用提示上自动回答“Y”；如果官方安装器继续要求选择目标，请在下方控制台里继续确认。'
  }

  return '如果安装器停在等待输入，请优先看上方提示卡和日志末尾；完成扫码、机器人命名或选项确认后，再继续刷新当前状态。'
}

export function getFeishuBotManagerInstallerModeStorageKey(sessionId: string): string {
  return `mclaw:feishu-bot-manager:installer-mode:${String(sessionId || '').trim()}`
}

export function readFeishuBotManagerInstallerSessionMode(params: {
  sessionId?: string | null
  storage?: FeishuBotManagerModeStorageLike | null
}): FeishuBotManagerSetupMode | null {
  const sessionId = String(params.sessionId || '').trim()
  if (!sessionId || !params.storage) return null

  try {
    const storedValue = params.storage.getItem(getFeishuBotManagerInstallerModeStorageKey(sessionId))
    return storedValue === 'create' || storedValue === 'link' ? storedValue : null
  } catch {
    return null
  }
}

export function writeFeishuBotManagerInstallerSessionMode(params: {
  sessionId?: string | null
  mode: FeishuBotManagerSetupMode
  storage?: FeishuBotManagerModeStorageLike | null
}): void {
  const sessionId = String(params.sessionId || '').trim()
  if (!sessionId || !params.storage) return

  try {
    params.storage.setItem(getFeishuBotManagerInstallerModeStorageKey(sessionId), params.mode)
  } catch {
    // Best effort only; mode persistence should never break installer flow.
  }
}

export function clearFeishuBotManagerInstallerSessionMode(params: {
  sessionId?: string | null
  storage?: FeishuBotManagerModeStorageLike | null
}): void {
  const sessionId = String(params.sessionId || '').trim()
  if (!sessionId || !params.storage) return

  try {
    params.storage.removeItem(getFeishuBotManagerInstallerModeStorageKey(sessionId))
  } catch {
    // Best effort only; cleanup failure should not block UI updates.
  }
}

export function shouldLockFeishuBotManagerSetupMode(params: {
  running: boolean
  busy: boolean
}): boolean {
  return params.running || params.busy
}

export function resolveFeishuBotManagerSetupModeLockNotice(params: {
  mode: FeishuBotManagerSetupMode
  running: boolean
  busy: boolean
}): string {
  if (!shouldLockFeishuBotManagerSetupMode(params)) return ''

  const modeLabel = params.mode === 'link' ? '复用已有机器人' : '新建机器人'

  if (params.running) {
    return `飞书官方安装器正在运行，当前会话已锁定为「${modeLabel}」，避免中途切换路径。`
  }

  return `飞书官方安装器正在启动或停止中，请稍候；当前会话会继续按「${modeLabel}」路径执行。`
}

export function getFeishuBotManagerInstallerSelectedBotStorageKey(sessionId: string): string {
  return `mclaw:feishu-bot-manager:installer-selected-bot:${String(sessionId || '').trim()}`
}

export function readFeishuBotManagerInstallerSelectedBotAccountId(params: {
  sessionId?: string | null
  storage?: FeishuBotManagerSelectedBotStorageLike | null
}): string {
  const sessionId = String(params.sessionId || '').trim()
  if (!sessionId || !params.storage) return ''

  try {
    return String(
      params.storage.getItem(getFeishuBotManagerInstallerSelectedBotStorageKey(sessionId)) || ''
    ).trim()
  } catch {
    return ''
  }
}

export function writeFeishuBotManagerInstallerSelectedBotAccountId(params: {
  sessionId?: string | null
  accountId?: string | null
  storage?: FeishuBotManagerSelectedBotStorageLike | null
}): void {
  const sessionId = String(params.sessionId || '').trim()
  const accountId = String(params.accountId || '').trim()
  if (!sessionId || !params.storage || !accountId) return

  try {
    params.storage.setItem(
      getFeishuBotManagerInstallerSelectedBotStorageKey(sessionId),
      accountId
    )
  } catch {
    // Best effort only; selected target persistence should never block installer flow.
  }
}

export function clearFeishuBotManagerInstallerSelectedBotAccountId(params: {
  sessionId?: string | null
  storage?: FeishuBotManagerSelectedBotStorageLike | null
}): void {
  const sessionId = String(params.sessionId || '').trim()
  if (!sessionId || !params.storage) return

  try {
    params.storage.removeItem(getFeishuBotManagerInstallerSelectedBotStorageKey(sessionId))
  } catch {
    // Best effort only; cleanup failure should not block UI updates.
  }
}

export function shouldLockFeishuBotManagerLinkedBotSelection(params: {
  mode: FeishuBotManagerSetupMode
  running: boolean
  busy: boolean
}): boolean {
  return params.mode === 'link' && (params.running || params.busy)
}

export function resolveFeishuBotManagerLinkedBotSelectionLockNotice(params: {
  selectedLinkedBotName?: string
  running: boolean
  busy: boolean
}): string {
  if (
    !shouldLockFeishuBotManagerLinkedBotSelection({
      mode: 'link',
      running: params.running,
      busy: params.busy,
    })
  ) {
    return ''
  }

  const targetLabel = String(params.selectedLinkedBotName || '').trim()
    ? `「${String(params.selectedLinkedBotName).trim()}」`
    : '当前选中的机器人'

  if (params.running) {
    return `飞书官方安装器正在运行，已锁定复用目标${targetLabel}，避免会话中途漂移。`
  }

  return `飞书官方安装器正在启动或停止中，请稍候；复用目标${targetLabel}暂时不可更改。`
}

export function shouldLockFeishuBotManagerConfigMutations(params: {
  running: boolean
  busy: boolean
}): boolean {
  return params.running || params.busy
}

export function resolveFeishuBotManagerConfigMutationLockNotice(params: {
  running: boolean
  busy: boolean
}): string {
  if (!shouldLockFeishuBotManagerConfigMutations(params)) return ''

  if (params.running) {
    return '飞书官方安装器正在运行，暂时不能删除机器人或修改多 Bot 隔离配置。'
  }

  return '飞书官方安装器正在启动或停止中，请稍候；暂时不能删除机器人或修改多 Bot 隔离配置。'
}

export function resolveFeishuBotManagerMaintenanceLockNotice(params: {
  deletingBotName?: string
  deletingBotAccountId?: string
  repairingIsolation: boolean
}): string {
  if (params.repairingIsolation) {
    return '正在修复多 Bot 隔离配置，请等待写入完成后再刷新列表或启动飞书官方安装器。'
  }

  const deletingBotName = String(params.deletingBotName || '').trim()
  if (deletingBotName) {
    return `正在删除「${deletingBotName}」，请等待操作完成后再刷新列表或启动飞书官方安装器。`
  }

  const deletingBotAccountId = String(params.deletingBotAccountId || '').trim()
  if (deletingBotAccountId) {
    return `正在删除 Bot（${deletingBotAccountId}），请等待操作完成后再刷新列表或启动飞书官方安装器。`
  }

  return ''
}

export function resolveFeishuBotManagerInstallerLiveNotice(params: {
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

export function resolveFeishuBotManagerInstallerOutputState(output?: string): {
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

export function resolveFeishuBotManagerInstallerExitNotice(params: {
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

export function resolveFeishuBotManagerInstallerSnapshotNotice(params: {
  active: boolean
  output?: string
  canceled: boolean
  exitCode: number | null | undefined
}): string {
  if (params.active) {
    const outputState = resolveFeishuBotManagerInstallerOutputState(params.output)
    return resolveFeishuBotManagerInstallerLiveNotice({
      running: true,
      hasLiveQr: outputState.hasLiveQr,
      hasOutput: outputState.hasOutput,
    })
  }

  return resolveFeishuBotManagerInstallerExitNotice({
    canceled: params.canceled,
    exitCode: params.exitCode,
  })
}

export function resolveFeishuBotManagerInstallerStopFeedback(params: {
  ok: boolean
}): {
  notice: string
  error: string
} {
  if (params.ok) {
    return {
      notice: '正在请求停止飞书官方安装器……',
      error: '',
    }
  }

  return {
    notice: '',
    error: '终止飞书官方安装器失败，请稍后重试。',
  }
}

export async function loadFeishuBotManagerRefreshResources<TState>(params: {
  api: FeishuBotManagerRefreshResourcesApi
  loadState: () => Promise<TState>
}): Promise<{
  state: TState
  installerSnapshot: Awaited<ReturnType<typeof window.api.getFeishuInstallerState>> | null
}> {
  const [state, installerSnapshot] = await Promise.all([
    params.loadState(),
    params.api.getFeishuInstallerState().catch(() => null),
  ])

  return {
    state,
    installerSnapshot,
  }
}

export function getFeishuBotManagerInstallerInputFailureMessage(params: {
  detail?: string
  error?: unknown
}): string {
  const fallback = '写入飞书官方安装器失败'

  if (typeof params.error !== 'undefined') {
    return toUserFacingUnknownErrorMessage(params.error, fallback)
  }

  return toUserFacingCliFailureMessage({
    stderr: params.detail,
    fallback,
  })
}

export function getFeishuBotManagerActionFailureMessage(params: {
  error: unknown
  fallback: string
}): string {
  return toUserFacingUnknownErrorMessage(params.error, params.fallback)
}

export default function FeishuBotManagerModal({
  opened,
  onClose,
}: FeishuBotManagerModalProps) {
  const getInstallerModeStorage = useCallback((): FeishuBotManagerModeStorageLike | null => {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  }, [])
  const [feishuBots, setFeishuBots] = useState<FeishuBotItem[]>([])
  const [pairingStatusByBot, setPairingStatusByBot] = useState<PairingStatusMap>({})
  const [runtimeStatusByBot, setRuntimeStatusByBot] = useState<RuntimeStatusMap>({})
  const [selectedLinkedFeishuBotId, setSelectedLinkedFeishuBotId] = useState('')
  const [feishuOfficialPluginInstalled, setFeishuOfficialPluginInstalled] = useState(false)
  const [feishuBotSetupMode, setFeishuBotSetupMode] = useState<FeishuBotManagerSetupMode>('create')
  const [feishuInstallerSessionId, setFeishuInstallerSessionId] = useState('')
  const [feishuInstallerRunning, setFeishuInstallerRunning] = useState(false)
  const [feishuInstallerOutput, setFeishuInstallerOutput] = useState('')
  const [feishuInstallerExitCode, setFeishuInstallerExitCode] = useState<number | null>(null)
  const [feishuInstallerCanceled, setFeishuInstallerCanceled] = useState(false)
  const [feishuInstallerBusy, setFeishuInstallerBusy] = useState(false)
  const [feishuInstallerInput, setFeishuInstallerInput] = useState('')
  const [feishuInstallerNotice, setFeishuInstallerNotice] = useState('')
  const [showFeishuInstallTutorial, setShowFeishuInstallTutorial] = useState(false)
  const [botError, setBotError] = useState('')
  const [botListRefreshing, setBotListRefreshing] = useState(false)
  const [deletingBotId, setDeletingBotId] = useState('')
  const [repairingIsolation, setRepairingIsolation] = useState(false)
  const [isolationDrift, setIsolationDrift] = useState(() => detectFeishuIsolationDrift(null))

  const feishuInstallerPromptAutoReplyKeyRef = useRef('')
  const feishuInstallerOutputRef = useRef('')
  const pendingFeishuInstallerModeRef = useRef<FeishuBotManagerSetupMode | null>(null)
  const pendingFeishuInstallerSelectedBotIdRef = useRef('')

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
  const deletingFeishuBot =
    feishuBotsOrdered.find((bot) => bot.accountId === deletingBotId) || null
  const selectedLinkedFeishuBot =
    feishuBotsOrdered.find((bot) => bot.accountId === selectedLinkedFeishuBotId) || feishuBotsOrdered[0] || null
  const feishuInstallerAsciiQr = useMemo(
    () => extractFeishuAsciiQr(feishuInstallerOutput),
    [feishuInstallerOutput]
  )
  const feishuInstallerQrUrl = useMemo(
    () => extractFeishuLiveQrUrl(feishuInstallerOutput),
    [feishuInstallerOutput]
  )
  const feishuInstallerActionState = useMemo(
    () => resolveFeishuBotManagerInstallerActionState({
      mode: feishuBotSetupMode,
      availableLinkedBotCount: feishuBotsOrdered.length,
      selectedLinkedBotName: selectedLinkedFeishuBot?.name,
    }),
    [feishuBotSetupMode, feishuBotsOrdered.length, selectedLinkedFeishuBot?.name]
  )
  const feishuInstallerConsoleHint = useMemo(
    () => resolveFeishuBotManagerInstallerConsoleHint({
      mode: feishuBotSetupMode,
      selectedLinkedBotName: selectedLinkedFeishuBot?.name,
    }),
    [feishuBotSetupMode, selectedLinkedFeishuBot?.name]
  )
  const feishuSetupModeLocked = useMemo(
    () => shouldLockFeishuBotManagerSetupMode({
      running: feishuInstallerRunning,
      busy: feishuInstallerBusy,
    }),
    [feishuInstallerBusy, feishuInstallerRunning]
  )
  const feishuLinkedBotSelectionLocked = useMemo(
    () => shouldLockFeishuBotManagerLinkedBotSelection({
      mode: feishuBotSetupMode,
      running: feishuInstallerRunning,
      busy: feishuInstallerBusy,
    }),
    [feishuBotSetupMode, feishuInstallerBusy, feishuInstallerRunning]
  )
  const feishuConfigMutationLocked = useMemo(
    () => shouldLockFeishuBotManagerConfigMutations({
      running: feishuInstallerRunning,
      busy: feishuInstallerBusy,
    }),
    [feishuInstallerBusy, feishuInstallerRunning]
  )
  const feishuConfigMutationLockNotice = useMemo(
    () => resolveFeishuBotManagerConfigMutationLockNotice({
      running: feishuInstallerRunning,
      busy: feishuInstallerBusy,
    }),
    [feishuInstallerBusy, feishuInstallerRunning]
  )
  const feishuMaintenanceLockNotice = useMemo(
    () => resolveFeishuBotManagerMaintenanceLockNotice({
      deletingBotName: deletingFeishuBot?.name,
      deletingBotAccountId: deletingBotId,
      repairingIsolation,
    }),
    [deletingBotId, deletingFeishuBot?.name, repairingIsolation]
  )
  const feishuSetupModeLockNotice = useMemo(
    () => resolveFeishuBotManagerSetupModeLockNotice({
      mode: feishuBotSetupMode,
      running: feishuInstallerRunning,
      busy: feishuInstallerBusy,
    }),
    [feishuBotSetupMode, feishuInstallerBusy, feishuInstallerRunning]
  )
  const feishuLinkedBotSelectionLockNotice = useMemo(
    () => resolveFeishuBotManagerLinkedBotSelectionLockNotice({
      selectedLinkedBotName: selectedLinkedFeishuBot?.name,
      running: feishuInstallerRunning,
      busy: feishuInstallerBusy,
    }),
    [feishuInstallerBusy, feishuInstallerRunning, selectedLinkedFeishuBot?.name]
  )

  const applyFeishuInstallerSnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof window.api.getFeishuInstallerState>>) => {
      const output = String(snapshot.output || '')
      const nextSessionId = snapshot.sessionId || ''
      const storage = getInstallerModeStorage()
      const restoredMode = readFeishuBotManagerInstallerSessionMode({
        sessionId: nextSessionId,
        storage,
      })
      const restoredSelectedBotAccountId = readFeishuBotManagerInstallerSelectedBotAccountId({
        sessionId: nextSessionId,
        storage,
      })
      const shouldResetEphemeralState = shouldResetFeishuBotManagerInstallerEphemeralState({
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
      if (snapshot.active && restoredMode) {
        setFeishuBotSetupMode(restoredMode)
      }
      if (snapshot.active && restoredSelectedBotAccountId) {
        setSelectedLinkedFeishuBotId(restoredSelectedBotAccountId)
      }
      if (shouldResetEphemeralState) {
        feishuInstallerPromptAutoReplyKeyRef.current = ''
        setFeishuInstallerInput('')
        if (!snapshot.active) {
          clearFeishuBotManagerInstallerSessionMode({
            sessionId: feishuInstallerSessionId,
            storage,
          })
          clearFeishuBotManagerInstallerSelectedBotAccountId({
            sessionId: feishuInstallerSessionId,
            storage,
          })
          pendingFeishuInstallerModeRef.current = null
          pendingFeishuInstallerSelectedBotIdRef.current = ''
        }
      }
      setFeishuInstallerNotice(
        resolveFeishuBotManagerInstallerSnapshotNotice({
          active: Boolean(snapshot.active),
          output,
          canceled: Boolean(snapshot.canceled),
          exitCode: snapshot.code ?? null,
        })
      )
    },
    [feishuInstallerSessionId, getInstallerModeStorage]
  )

  const refreshFeishuBotsFromConfig = useCallback(async () => {
    const pluginState = await window.api.getFeishuOfficialPluginState()
    const normalizedConfig = pluginState.normalizedConfig
    if (pluginState.configChanged) {
      void (async () => {
        const writeResult = await window.api.applyConfigPatchGuarded({
          beforeConfig: await window.api.readConfig().then((value) => (
            value && typeof value === 'object' ? value : {}
          )),
          afterConfig: normalizedConfig,
          reason: 'unknown',
        })
        if (!writeResult.ok) {
          throw new Error(writeResult.message || '修复飞书配置写入失败')
        }
      })().catch(() => {
        // Keep the in-memory list even if background healing fails.
      })
    }

    const bots = listFeishuBots(normalizedConfig)
    const drift = detectFeishuIsolationDrift(normalizedConfig)
    setFeishuOfficialPluginInstalled(pluginState.installedOnDisk)
    setFeishuBots(bots)
    setIsolationDrift(drift)
    setSelectedLinkedFeishuBotId((current) => {
      if (current && bots.some((bot) => bot.accountId === current)) return current
      return bots[0]?.accountId || ''
    })

    if (bots.length === 0) {
      setPairingStatusByBot({})
      setRuntimeStatusByBot({})
      return
    }

    const [pairingStatus, runtimeStatus] = await Promise.all([
      window.api.pairingFeishuStatus(bots.map((bot) => bot.accountId)),
      window.api.getFeishuRuntimeStatus().catch(() => ({} as RuntimeStatusMap)),
    ])
    setPairingStatusByBot(pairingStatus)
    setRuntimeStatusByBot(runtimeStatus)
  }, [])

  const refreshBotModalState = useCallback(async () => {
    setBotListRefreshing(true)
    setBotError('')
    try {
      const resources = await loadFeishuBotManagerRefreshResources({
        api: window.api,
        loadState: refreshFeishuBotsFromConfig,
      })
      if (resources.installerSnapshot) {
        applyFeishuInstallerSnapshot(resources.installerSnapshot)
      }
    } catch (e) {
      setBotError(
        getFeishuBotManagerActionFailureMessage({
          error: e,
          fallback: '刷新飞书 Bot 列表失败',
        })
      )
    } finally {
      setBotListRefreshing(false)
    }
  }, [applyFeishuInstallerSnapshot, refreshFeishuBotsFromConfig])

  useEffect(() => {
    const unsubscribe = window.api.onFeishuInstallerEvent((payload) => {
      if (payload.type === 'started') {
        const nextState = resolveFeishuBotManagerInstallerStartState()
        const storage = getInstallerModeStorage()
        const startedMode =
          pendingFeishuInstallerModeRef.current
          || readFeishuBotManagerInstallerSessionMode({
            sessionId: payload.sessionId,
            storage,
          })
          || feishuBotSetupMode
        const startedSelectedBotId =
          pendingFeishuInstallerSelectedBotIdRef.current
          || readFeishuBotManagerInstallerSelectedBotAccountId({
            sessionId: payload.sessionId,
            storage,
          })
          || selectedLinkedFeishuBotId
        feishuInstallerPromptAutoReplyKeyRef.current = ''
        feishuInstallerOutputRef.current = nextState.output
        writeFeishuBotManagerInstallerSessionMode({
          sessionId: payload.sessionId,
          mode: startedMode,
          storage,
        })
        if (startedMode === 'link' && startedSelectedBotId) {
          writeFeishuBotManagerInstallerSelectedBotAccountId({
            sessionId: payload.sessionId,
            accountId: startedSelectedBotId,
            storage,
          })
          setSelectedLinkedFeishuBotId(startedSelectedBotId)
        }
        pendingFeishuInstallerModeRef.current = null
        pendingFeishuInstallerSelectedBotIdRef.current = ''
        setFeishuBotSetupMode(startedMode)
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
        const outputState = resolveFeishuBotManagerInstallerOutputState(nextOutput)
        feishuInstallerOutputRef.current = nextOutput
        setFeishuInstallerOutput(nextOutput)
        setFeishuInstallerNotice(
          resolveFeishuBotManagerInstallerLiveNotice({
            running: true,
            hasLiveQr: outputState.hasLiveQr,
            hasOutput: outputState.hasOutput,
          })
        )
        return
      }

      if (payload.type === 'exit') {
        clearFeishuBotManagerInstallerSessionMode({
          sessionId: payload.sessionId,
          storage: getInstallerModeStorage(),
        })
        clearFeishuBotManagerInstallerSelectedBotAccountId({
          sessionId: payload.sessionId,
          storage: getInstallerModeStorage(),
        })
        pendingFeishuInstallerModeRef.current = null
        pendingFeishuInstallerSelectedBotIdRef.current = ''
        setFeishuInstallerRunning(false)
        setFeishuInstallerExitCode(payload.code ?? null)
        setFeishuInstallerCanceled(Boolean(payload.canceled))
        setFeishuInstallerNotice(
          resolveFeishuBotManagerInstallerExitNotice({
            canceled: Boolean(payload.canceled),
            exitCode: payload.code ?? null,
          })
        )
        feishuInstallerPromptAutoReplyKeyRef.current = ''
        void refreshFeishuBotsFromConfig().catch(() => {
          // Ignore refresh failure after installer exit.
        })
      }
    })

    return unsubscribe
  }, [feishuBotSetupMode, getInstallerModeStorage, refreshFeishuBotsFromConfig, selectedLinkedFeishuBotId])

  useEffect(() => {
    if (!opened) return
    void refreshBotModalState()
  }, [opened, refreshBotModalState])

  useEffect(() => {
    if (!opened) {
      setShowFeishuInstallTutorial(false)
    }
  }, [opened])

  useEffect(() => {
    if (!opened || !feishuInstallerRunning) return

    let disposed = false
    let lastActive = true

    const pollInstallerSnapshot = async () => {
      while (!disposed) {
        try {
          const snapshot = await window.api.getFeishuInstallerState()
          if (disposed) return

          applyFeishuInstallerSnapshot(snapshot)
          if (lastActive && !snapshot.active) {
            void refreshFeishuBotsFromConfig().catch(() => {
              // Best effort only; the event stream already handles the normal refresh path.
            })
            return
          }

          lastActive = Boolean(snapshot.active)
        } catch {
          // Best effort only; the live event stream remains the primary source of truth.
        }

        await new Promise((resolve) => setTimeout(resolve, 1200))
      }
    }

    void pollInstallerSnapshot()

    return () => {
      disposed = true
    }
  }, [applyFeishuInstallerSnapshot, feishuInstallerRunning, opened, refreshFeishuBotsFromConfig])

  useEffect(() => {
    if (!opened || !feishuInstallerRunning) return
    const promptKeyBase = extractFeishuExistingBotPromptKey(feishuInstallerOutput)
    if (!promptKeyBase) return

    const autoReply = feishuBotSetupMode === 'link' ? 'y' : 'n'
    const promptKey = `${feishuBotSetupMode}:${promptKeyBase}:${autoReply}`
    if (feishuInstallerPromptAutoReplyKeyRef.current === promptKey) return

    feishuInstallerPromptAutoReplyKeyRef.current = promptKey
    setFeishuInstallerNotice(
      feishuBotSetupMode === 'link'
        ? '检测到官方安装器询问是否复用已有飞书机器人，Mclaw 已自动回复“Y”。'
        : '检测到官方安装器询问是否复用已有飞书机器人，Mclaw 已自动回复“n”，继续走新建机器人流程。'
    )

    void sendFeishuInstallerInput(`${autoReply}\n`).then((ok) => {
      if (!ok) {
        feishuInstallerPromptAutoReplyKeyRef.current = ''
      }
    })
  }, [opened, feishuBotSetupMode, feishuInstallerOutput, feishuInstallerRunning])

  const sendFeishuInstallerInput = async (input: string) => {
    const sessionId = String(feishuInstallerSessionId || '').trim()
    if (!sessionId) {
      setBotError('飞书官方安装器尚未启动。')
      return false
    }

    try {
      const result = await window.api.sendFeishuInstallerInput(sessionId, input)
      if (!result.ok) {
        setBotError(
          getFeishuBotManagerInstallerInputFailureMessage({
            detail: result.message,
          })
        )
        return false
      }

      setBotError('')
      return true
    } catch (e) {
      setBotError(
        getFeishuBotManagerInstallerInputFailureMessage({
          error: e,
        })
      )
      return false
    }
  }

  const startFeishuInstallerFlow = async (mode: FeishuBotManagerSetupMode) => {
    setFeishuInstallerBusy(true)
    setBotError('')
    try {
      const storage = getInstallerModeStorage()
      const selectedLinkTargetAccountId =
        mode === 'link'
          ? String(selectedLinkedFeishuBot?.accountId || selectedLinkedFeishuBotId || '').trim()
          : ''
      const current = await window.api.getFeishuInstallerState()
      const startPlan = resolveFeishuBotManagerInstallerStartPlan({
        requestedMode: mode,
        currentMode: feishuBotSetupMode,
        hasActiveSession: current.active,
      })
      if (current.active) {
        writeFeishuBotManagerInstallerSessionMode({
          sessionId: current.sessionId,
          mode: startPlan.mode,
          storage,
        })
        if (startPlan.mode === 'link' && selectedLinkTargetAccountId) {
          writeFeishuBotManagerInstallerSelectedBotAccountId({
            sessionId: current.sessionId,
            accountId: selectedLinkTargetAccountId,
            storage,
          })
        }
        setFeishuBotSetupMode(startPlan.mode)
        applyFeishuInstallerSnapshot(current)
        setFeishuInstallerNotice(resolveFeishuBotManagerInstallerReuseNotice())
        return
      }

      const nextState = resolveFeishuBotManagerInstallerStartState()
      if (startPlan.shouldPrimeFreshStartState) {
        pendingFeishuInstallerModeRef.current = startPlan.mode
        pendingFeishuInstallerSelectedBotIdRef.current =
          startPlan.mode === 'link' ? selectedLinkTargetAccountId : ''
        const startNotice =
          startPlan.mode === 'create'
            ? '正在启动 Mclaw 内置飞书创建流程，二维码会显示在这里。'
            : nextState.notice
        setFeishuBotSetupMode(startPlan.mode)
        feishuInstallerPromptAutoReplyKeyRef.current = ''
        feishuInstallerOutputRef.current = nextState.output
        setFeishuInstallerSessionId(nextState.sessionId)
        setFeishuInstallerRunning(nextState.running)
        setFeishuInstallerOutput(nextState.output)
        setFeishuInstallerExitCode(nextState.exitCode)
        setFeishuInstallerCanceled(nextState.canceled)
        setFeishuInstallerInput(nextState.input)
        setFeishuInstallerNotice(startNotice)
      }

      const snapshot = await window.api.startFeishuInstaller(mode)
      writeFeishuBotManagerInstallerSessionMode({
        sessionId: snapshot.sessionId,
        mode: startPlan.mode,
        storage,
      })
      if (startPlan.mode === 'link' && selectedLinkTargetAccountId) {
        writeFeishuBotManagerInstallerSelectedBotAccountId({
          sessionId: snapshot.sessionId,
          accountId: selectedLinkTargetAccountId,
          storage,
        })
      }
      pendingFeishuInstallerModeRef.current = null
      pendingFeishuInstallerSelectedBotIdRef.current = ''
      applyFeishuInstallerSnapshot(snapshot)
      if (!snapshot.sessionId || !snapshot.active) {
        setBotError(String(snapshot.output || '启动飞书官方安装器失败。'))
        return
      }
    } catch (e) {
      setBotError(
        getFeishuBotManagerActionFailureMessage({
          error: e,
          fallback: '启动飞书官方安装器失败。',
        })
      )
    } finally {
      pendingFeishuInstallerModeRef.current = null
      pendingFeishuInstallerSelectedBotIdRef.current = ''
      setFeishuInstallerBusy(false)
    }
  }

  const stopFeishuInstallerFlow = async () => {
    setFeishuInstallerBusy(true)
    setBotError('')
    try {
      const result = await window.api.stopFeishuInstaller()
      const feedback = resolveFeishuBotManagerInstallerStopFeedback({
        ok: result.ok,
      })
      if (feedback.notice) {
        setFeishuInstallerNotice(feedback.notice)
      }
      if (feedback.error) {
        setBotError(feedback.error)
      }
    } catch {
      setBotError(
        resolveFeishuBotManagerInstallerStopFeedback({
          ok: false,
        }).error
      )
    } finally {
      setFeishuInstallerBusy(false)
    }
  }

  const handleDeleteBot = async (bot: FeishuBotItem) => {
    setDeletingBotId(bot.accountId)
    setBotError('')
    try {
      const config = sanitizeFeishuPluginConfig(await window.api.readConfig())
      const pluginState = await window.api.getFeishuOfficialPluginState()
      const normalizedConfig = removeFeishuBotConfigForPluginState(
        config,
        bot.accountId,
        pluginState.installedOnDisk
      )
      const writeResult = await window.api.applyConfigPatchGuarded({
        beforeConfig: config,
        afterConfig: normalizedConfig,
        reason: 'dashboard-delete-feishu-bot',
      })
      if (!writeResult.ok) {
        throw new Error(writeResult.message || '删除飞书 Bot 配置失败')
      }
      await refreshFeishuBotsFromConfig()
    } catch (e) {
      setBotError(
        getFeishuBotManagerActionFailureMessage({
          error: e,
          fallback: '删除飞书 Bot 失败',
        })
      )
    } finally {
      setDeletingBotId('')
    }
  }

  const handleRepairIsolation = async () => {
    setRepairingIsolation(true)
    setBotError('')
    try {
      const config = sanitizeFeishuPluginConfig(await window.api.readConfig())
      const pluginState = await window.api.getFeishuOfficialPluginState()
      const nextConfig = applyFeishuMultiBotIsolation(config)
      const normalizedConfig = normalizeFeishuOfficialPluginConfig(
        nextConfig,
        pluginState.installedOnDisk
      )
      const writeResult = await window.api.applyConfigPatchGuarded({
        beforeConfig: config,
        afterConfig: normalizedConfig,
        reason: 'unknown',
      })
      if (!writeResult.ok) {
        throw new Error(writeResult.message || '修复飞书多 Bot 隔离写入失败')
      }
      await refreshFeishuBotsFromConfig()
    } catch (e) {
      setBotError(
        getFeishuBotManagerActionFailureMessage({
          error: e,
          fallback: '修复飞书多 Bot 隔离失败',
        })
      )
    } finally {
      setRepairingIsolation(false)
    }
  }

  const handleClose = () => {
    setBotError('')
    setFeishuInstallerNotice('')
    setFeishuInstallerInput('')
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size="xl"
      title={
        <Group gap="xs">
          <Text size="sm" fw={600}>飞书 Bot 管理</Text>
          <Tooltip label="刷新列表" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => void refreshBotModalState()}
              loading={botListRefreshing}
              disabled={deletingBotId !== '' || repairingIsolation}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      }
    >
      <div className="space-y-3">
        {/* Bot list */}
        <ScrollArea.Autosize mah={200}>
          <div className="space-y-1.5">
            {feishuBotsOrdered.length === 0 && (
              <Text size="xs" c="dimmed" ta="center" py="md">还没有已配置的飞书 Bot</Text>
            )}

            {feishuBotsOrdered.map((bot) => {
              const pairing = pairingStatusByBot[bot.accountId]
              const pairedCount = pairing?.pairedCount || 0
              const runtime = runtimeStatusByBot[bot.accountId]
              return (
                <Group
                  key={bot.accountId}
                  justify="space-between"
                  wrap="nowrap"
                  gap="sm"
                  py={6}
                  px="xs"
                  className="border app-border rounded-lg"
                  style={{ transition: 'border-color 0.15s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--app-hover-border)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '' }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="xs" fw={500} className="app-text-primary" lineClamp={1}>{bot.name}</Text>
                      {bot.isDefault && <Badge size="xs" variant="light" color="blue">默认</Badge>}
                      <Badge size="xs" variant="light" color={pairedCount > 0 ? 'teal' : 'yellow'}>
                        {pairedCount > 0 ? `已配对 ${pairedCount}` : '待配对'}
                      </Badge>
                      <Badge size="xs" variant="light" color={getRuntimeBadgeColor(runtime?.runtimeState)}>
                        {getRuntimeLabel(runtime?.runtimeState)}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1} mt={2}>
                      {bot.accountId} · Agent：{bot.agentId}
                    </Text>
                    {runtime?.issues?.[0] && (
                      <Text size="xs" c="yellow" mt={2}>{runtime.issues[0]}</Text>
                    )}
                  </div>
                  <Button
                    variant="light"
                    color="red"
                    size="compact-xs"
                    onClick={() => void handleDeleteBot(bot)}
                    loading={deletingBotId === bot.accountId}
                    disabled={repairingIsolation || feishuConfigMutationLocked}
                  >
                    删除
                  </Button>
                </Group>
              )
            })}
          </div>
        </ScrollArea.Autosize>
        {feishuConfigMutationLockNotice && (
          <Text size="xs" c="yellow">
            {feishuConfigMutationLockNotice}
          </Text>
        )}
        {feishuMaintenanceLockNotice && (
          <Text size="xs" c="yellow">
            {feishuMaintenanceLockNotice}
          </Text>
        )}

        {/* Multi-bot isolation */}
        <Group justify="space-between" wrap="nowrap" className="border app-border rounded-lg px-3 py-2.5">
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text size="xs" fw={500} className="app-text-primary">多 Bot 隔离</Text>
            <Text size="xs" c="dimmed">
              {isolationDrift.needsRepair
                ? '当前隔离配置不完整，需要修复。'
                : '多账号并行模式所需的隔离路由已经配置完成。'}
            </Text>
          </div>
          <Button
            variant={isolationDrift.needsRepair ? 'filled' : 'light'}
            size="compact-xs"
            onClick={() => void handleRepairIsolation()}
            loading={repairingIsolation}
            disabled={deletingBotId !== '' || feishuConfigMutationLocked}
          >
            修复隔离
          </Button>
        </Group>

        {isolationDrift.needsRepair && (
          <Alert color="yellow" variant="light" title="检测到隔离漂移" styles={{ title: { fontSize: 'var(--mantine-font-size-xs)' } }}>
            <Text size="xs">
              {!isolationDrift.dmScopeCorrect ? 'session.dmScope 尚未设置为 per-account-channel-peer。' : ''}
              {isolationDrift.missingAgentIds.length > 0 ? `缺失 Agent：${isolationDrift.missingAgentIds.join(', ')}。` : ''}
              {isolationDrift.workspaceMismatches.length > 0 ? `工作区不一致：${isolationDrift.workspaceMismatches.join(', ')}。` : ''}
              {isolationDrift.missingBindingAccountIds.length > 0 ? `缺失绑定：${isolationDrift.missingBindingAccountIds.join(', ')}。` : ''}
              {isolationDrift.conflictingBindingAccountIds.length > 0 ? `绑定冲突：${isolationDrift.conflictingBindingAccountIds.join(', ')}。` : ''}
            </Text>
          </Alert>
        )}

        {/* Installer actions */}
        <div className="space-y-2">
          <SegmentedControl
            fullWidth
            size="xs"
            value={feishuBotSetupMode}
            onChange={(value) => setFeishuBotSetupMode(value as 'create' | 'link')}
            disabled={feishuSetupModeLocked}
            data={[
              { label: '新建机器人', value: 'create' },
              { label: '复用已有机器人', value: 'link' },
            ]}
          />
          <Text size="xs" c="dimmed">
            {feishuInstallerActionState.description}
          </Text>
          {feishuSetupModeLockNotice && (
            <Text size="xs" c="yellow">
              {feishuSetupModeLockNotice}
            </Text>
          )}
        </div>

        <Group gap="xs">
          <Button
            variant="light"
            size="xs"
            onClick={() => void startFeishuInstallerFlow(feishuBotSetupMode)}
            loading={feishuInstallerBusy}
            disabled={feishuInstallerActionState.disabled || deletingBotId !== '' || repairingIsolation}
          >
            {feishuInstallerActionState.label}
          </Button>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setShowFeishuInstallTutorial(true)}
          >
            查看教程
          </Button>
          <Button
            variant="subtle"
            color="red"
            size="xs"
            onClick={() => void stopFeishuInstallerFlow()}
            disabled={!feishuInstallerRunning || feishuInstallerBusy}
          >
            中止安装
          </Button>
        </Group>

        {feishuBotSetupMode === 'create' ? (
          <div className="border app-border rounded-lg p-3 space-y-3">
            <div className="flex flex-col items-center gap-2">
              {feishuInstallerAsciiQr ? (
                <div className="w-full overflow-auto rounded-lg p-2" style={{ backgroundColor: 'var(--app-bg-inset)' }}>
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" c="dimmed">本次创建流程的真实二维码</Text>
                    <Badge size="xs" variant="light" color="teal">已刷新</Badge>
                  </Group>
                  <pre className="whitespace-pre font-mono text-[8px] leading-[1.1] app-text-primary">
                    {feishuInstallerAsciiQr}
                  </pre>
                </div>
              ) : feishuInstallerQrUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">本次创建流程二维码</Text>
                    <Badge
                      size="xs"
                      variant="light"
                      color="teal"
                    >
                      已刷新
                    </Badge>
                  </Group>
                  <QRCodeSVG value={feishuInstallerQrUrl} size={160} includeMargin />
                  <Text size="xs" c="dimmed" ta="center">
                    只扫描这里实时刷新的二维码；教程截图里的二维码只是示意图。
                  </Text>
                </div>
              ) : (
                <div
                  className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-4"
                  style={{ borderColor: 'var(--app-border-color)', backgroundColor: 'var(--app-bg-inset)' }}
                >
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">本次创建流程二维码</Text>
                    <Badge
                      size="xs"
                      variant="light"
                      color={feishuInstallerRunning ? 'yellow' : 'gray'}
                    >
                      {feishuInstallerRunning ? '等待生成' : '未生成'}
                    </Badge>
                  </Group>
                  <Text size="sm" ta="center">当前还没有拿到本次创建流程二维码。</Text>
                  <Text size="xs" c="dimmed" ta="center">
                    {feishuInstallerRunning
                      ? '请先等待下方输出刷新；只有这里出现二维码后再扫码，教程截图里的二维码不要扫。'
                      : '重新启动创建流程后，二维码会显示在这里。'}
                  </Text>
                </div>
              )}
              <Text
                size="xs"
                c="dimmed"
                component="a"
                href={FEISHU_OFFICIAL_GUIDE_URL}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'underline', cursor: 'pointer' }}
              >
                打开飞书官方使用指南
              </Text>
            </div>
            <Text size="xs" c="dimmed">
              当前新建流程优先走 Mclaw 内置二维码链路，不再额外弹出终端；备用命令：<code style={{ fontSize: '10px' }}>{FEISHU_OFFICIAL_INSTALL_COMMAND}</code>
            </Text>
          </div>
        ) : (
          <div className="border app-border rounded-lg p-3 space-y-2">
            <Text size="xs" className="app-text-secondary">请选择一个已接入 OpenClaw 的飞书机器人。</Text>
            {feishuLinkedBotSelectionLockNotice && (
              <Text size="xs" c="yellow">
                {feishuLinkedBotSelectionLockNotice}
              </Text>
            )}
            {feishuBotsOrdered.length === 0 ? (
              <Text size="xs" c="dimmed">当前还没有可复用的飞书机器人，请先创建一个。</Text>
            ) : (
              <>
                <div className="space-y-1.5">
                  {feishuBotsOrdered.map((bot) => {
                    const selected = selectedLinkedFeishuBot?.accountId === bot.accountId
                    const pairing = pairingStatusByBot[bot.accountId]
                    const pairedCount = pairing?.pairedCount || 0
                    return (
                      <Group
                        key={`select-${bot.accountId}`}
                        justify="space-between"
                        wrap="nowrap"
                        py={6}
                        px="xs"
                        className="border rounded-md cursor-pointer"
                        style={{
                          borderColor: selected ? 'var(--app-hover-border)' : 'var(--app-border)',
                          backgroundColor: selected ? 'var(--app-bg-tertiary)' : undefined,
                          transition: 'border-color 0.15s ease, background-color 0.15s ease',
                          cursor: feishuLinkedBotSelectionLocked ? 'not-allowed' : 'pointer',
                          opacity: feishuLinkedBotSelectionLocked && !selected ? 0.72 : 1,
                        }}
                        onClick={() => {
                          if (feishuLinkedBotSelectionLocked) return
                          setSelectedLinkedFeishuBotId(bot.accountId)
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <Text size="xs" fw={500} className="app-text-primary" lineClamp={1}>{bot.name}</Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>{bot.accountId}</Text>
                        </div>
                        <Badge size="xs" variant="light" color={pairedCount > 0 ? 'teal' : 'yellow'}>
                          {pairedCount > 0 ? `已配对 ${pairedCount}` : '待配对'}
                        </Badge>
                      </Group>
                    )
                  })}
                </div>

                {selectedLinkedFeishuBot && (
                  <Text size="xs" c="dimmed">
                    已选择「{selectedLinkedFeishuBot.name}」。{' '}
                    {feishuOfficialPluginInstalled
                      ? '当前环境中已存在飞书官方插件，后续会尽量直接复用已有配置。'
                      : '如果当前环境缺少飞书官方插件，Mclaw 会在进入复用流程前自动补装。'}
                  </Text>
                )}
              </>
            )}
          </div>
        )}

        {/* Installer console */}
        <div className="border app-border rounded-lg p-3 space-y-2">
          <Group justify="space-between">
            <div>
              <Text size="xs" fw={500} className="app-text-primary">安装器控制台</Text>
              <Text size="xs" c="dimmed">
                {feishuInstallerRunning
                  ? '安装器运行中'
                  : feishuInstallerExitCode === null
                    ? '尚未启动'
                    : feishuInstallerCanceled
                      ? '已取消'
                      : feishuInstallerExitCode === 0
                        ? '已完成'
                        : `已退出（${feishuInstallerExitCode ?? ''}）`}
              </Text>
            </div>
            <Badge size="xs" variant="light" color={feishuInstallerRunning ? 'teal' : 'gray'}>
              {feishuInstallerRunning ? '运行中' : '已停止'}
            </Badge>
          </Group>

          <Text size="xs" c="dimmed">
            {feishuInstallerConsoleHint}
          </Text>

          <Group gap={4}>
            <Button variant="light" size="compact-xs" onClick={() => void sendFeishuInstallerInput('\u001b[A')} disabled={!feishuInstallerRunning}>上移</Button>
            <Button variant="light" size="compact-xs" onClick={() => void sendFeishuInstallerInput('\u001b[B')} disabled={!feishuInstallerRunning}>下移</Button>
            <Button variant="light" size="compact-xs" onClick={() => void sendFeishuInstallerInput('\r')} disabled={!feishuInstallerRunning}>确认</Button>
            <Button variant="subtle" size="compact-xs" color="red" onClick={() => void sendFeishuInstallerInput('\u0003')} disabled={!feishuInstallerRunning}>Ctrl+C</Button>
          </Group>

          <ScrollArea.Autosize mah={180} className="rounded-md" style={{ backgroundColor: 'var(--app-bg-inset)' }}>
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 app-text-secondary px-3 py-2">
              {feishuInstallerOutput || '安装器输出会显示在这里。'}
            </pre>
          </ScrollArea.Autosize>

          <Group gap="xs">
            <TextInput
              size="xs"
              style={{ flex: 1 }}
              value={feishuInstallerInput}
              onChange={(e) => setFeishuInstallerInput(e.currentTarget.value)}
              placeholder="向安装器发送自定义输入"
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
          </Group>
        </div>

        {feishuInstallerNotice && (
          <Alert color="blue" variant="light" styles={{ title: { fontSize: 'var(--mantine-font-size-xs)' } }} title="安装提示">
            <Text size="xs">{feishuInstallerNotice}</Text>
          </Alert>
        )}

        {botError && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setBotError('')}>
            <Text size="xs">{botError}</Text>
          </Alert>
        )}
      </div>

      <FeishuInstallTutorialModal
        opened={showFeishuInstallTutorial}
        onClose={() => setShowFeishuInstallTutorial(false)}
      />
    </Modal>
  )
}

