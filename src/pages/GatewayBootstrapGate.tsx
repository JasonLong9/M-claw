import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Text } from '@mantine/core'
import BrandWordmark from '@/components/BrandWordmark'
import {
  createDashboardEntryBootstrapState,
  resolveDashboardEntryBootstrapCopy,
  resolveDashboardEntryBootstrapProgress,
  type DashboardEntryPairingSummary,
  type DashboardEntrySnapshot,
  type DashboardEntryBootstrapState,
  type DashboardEntryBootstrapTaskKey,
  type DashboardEntryBootstrapTaskStatus,
} from '../shared/dashboard-entry-bootstrap'
import {
  resolveGatewayBootstrapFailureView,
  type GatewayBootstrapFailureView,
} from '../shared/gateway-bootstrap-diagnostics'
import { createInMemoryTrace } from '../shared/gateway-diagnostics-trace'
import {
  getUpstreamModelStatusLike,
  readOpenClawUpstreamModelState,
} from '../shared/upstream-model-state'
import type { OpenClawRuntimeReconcileStore } from '../shared/gateway-runtime-reconcile-state'
import { resolveEffectiveGatewayRunning } from '../shared/gateway-effective-running'
import { listFeishuBots, sanitizeFeishuPluginConfig } from './feishu-bots'

interface FeishuRuntimeStatusSummary {
  runtimeState: 'online' | 'offline' | 'degraded' | 'disabled'
  summary: string
  issues: string[]
}

type DashboardChatAvailabilityResult = Awaited<ReturnType<typeof window.api.getChatAvailability>>
type GatewayEnsureRunningResult = Awaited<ReturnType<typeof window.api.ensureGatewayRunning>>

export interface DashboardEntryBootstrapApi {
  ensureGatewayRunning: (
    options?: { skipRuntimePrecheck?: boolean; requestId?: string }
  ) => Promise<GatewayEnsureRunningResult>
  getChatAvailability: () => Promise<Awaited<ReturnType<typeof window.api.getChatAvailability>>>
  gatewayHealth: () => Promise<GatewayHealthCheckResult>
  getOpenClawRuntimeReconcileState: () => Promise<OpenClawRuntimeReconcileStore>
  readConfig: () => Promise<Record<string, any> | null>
  getModelUpstreamState: () => Promise<Awaited<ReturnType<typeof window.api.getModelUpstreamState>>>
  getModelStatus: () => Promise<{ ok: boolean; data?: Record<string, any> | null }>
  pairingFeishuStatus: (accountIds: string[]) => Promise<Record<string, { pairedCount: number; pairedUsers: string[] }>>
  getFeishuRuntimeStatus: () => Promise<Record<string, FeishuRuntimeStatusSummary>>
  saveDiagnosticsTrace: (entries: unknown[]) => Promise<void>
  repairIncompatiblePlugins?: (
    options?: {
      scopePluginIds?: string[]
      quarantineOfficialManagedPlugins?: boolean
      restoreConfiguredManagedChannels?: boolean
    }
  ) => Promise<{ ok?: boolean; summary?: string; stderr?: string } | null>
  gatewayForceRestart?: () => Promise<{ ok?: boolean; stdout?: string; stderr?: string }>
  repairManagedChannelPlugin?: (channelId: string) => Promise<{ kind?: string; summary?: string; message?: string } | null>
}

interface GatewayHealthCheckResult {
  running: boolean
  summary?: string
  raw?: string
  stderr?: string
  code?: number | null
  stateCode?: GatewayEnsureRunningResult['stateCode']
}

export interface DashboardEntryBootstrapFlowResult {
  snapshot: DashboardEntrySnapshot
  softWarnings: string[]
}

type TaskDetailState = Record<DashboardEntryBootstrapTaskKey, string>

const INITIAL_TASK_STATE = createDashboardEntryBootstrapState()

const INITIAL_TASK_DETAILS: TaskDetailState = {
  gateway: '进入控制面板前先自动启动并确认 Gateway 已就绪，避免首屏仍显示离线。',
  config: '读取控制面板首屏所需的共享配置快照。',
  pairing: '汇总渠道接通、飞书运行态和配对摘要。',
}

function createTaskDetailState(): TaskDetailState {
  return { ...INITIAL_TASK_DETAILS }
}

function createGenericFailureView(
  title: string,
  detail: string,
  hints: string[] = []
): GatewayBootstrapFailureView {
  return { title, detail, hints }
}

function summarizeConfig(config: Record<string, any> | null): string {
  if (!config || typeof config !== 'object') {
    return '共享配置为空，已按空配置快照继续。'
  }

  const channelCount = Object.keys(config.channels || {}).length
  const providerCount = Object.keys(config.models || {}).length
  return `已读取共享配置，发现 ${channelCount} 个渠道配置、${providerCount} 个模型提供商配置。`
}

function formatProbeErrorMessage(prefix: string, error: unknown): string {
  return `${prefix}${error instanceof Error && error.message ? `：${error.message}` : ''}`
}

function normalizeGatewayFailureInput(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      ok: false,
      running: false,
      stdout: '',
      stderr: error.message,
      code: 1,
      summary: error.message,
    }
  }

  if (typeof error === 'string') {
    return {
      ok: false,
      running: false,
      stdout: '',
      stderr: error,
      code: 1,
      summary: error,
    }
  }

  return error
}

function buildGatewayReadyDetail(
  ensureResult: GatewayEnsureRunningResult,
  health: GatewayHealthCheckResult | null,
  chatAvailability: DashboardChatAvailabilityResult | null,
  runtimeStore: OpenClawRuntimeReconcileStore | null
): string {
  const parts: string[] = []
  const summary =
    String(health?.summary || chatAvailability?.message || ensureResult.summary || '').trim()
    || String(runtimeStore?.runtime.lastReconcileSummary || '').trim()

  if (summary) {
    parts.push(summary)
  }
  if (ensureResult.autoInstalledGatewayService) {
    parts.push('已自动补齐 Gateway 服务')
  }
  if (
    ensureResult.autoPortMigrated === true
    && Number.isFinite(ensureResult.effectivePort)
    && ensureResult.effectivePort > 0
  ) {
    parts.push(`当前使用端口 ${ensureResult.effectivePort}`)
  }

  return parts.join('；') || 'Gateway 已启动并确认可用。'
}

function buildGatewayHealthFailureInput(
  ensureResult: GatewayEnsureRunningResult,
  health: GatewayHealthCheckResult,
  chatAvailability: DashboardChatAvailabilityResult | null
): GatewayEnsureRunningResult {
  const summary =
    String(health.summary || chatAvailability?.message || ensureResult.summary || '').trim()
    || 'Gateway 启动后仍未通过健康确认。'

  return {
    ...ensureResult,
    ok: false,
    running: false,
    summary,
    stateCode: health.stateCode || ensureResult.stateCode,
    stderr: String(health.stderr || ensureResult.stderr || summary).trim(),
    stdout: String(health.raw || ensureResult.stdout || '').trim(),
    code: health.code ?? ensureResult.code,
    diagnostics: {
      doctor: ensureResult.diagnostics?.doctor ?? null,
      lastHealth: health,
      ...(ensureResult.diagnostics?.portOwner !== undefined
        ? { portOwner: ensureResult.diagnostics.portOwner }
        : {}),
      ...(ensureResult.diagnostics?.controlUiApp !== undefined
        ? { controlUiApp: ensureResult.diagnostics.controlUiApp }
        : {}),
    },
  }
}

async function summarizePairing(
  api: DashboardEntryBootstrapApi,
  config: Record<string, any> | null
): Promise<{
  summary: string
  data: DashboardEntryPairingSummary | null
  warnings: string[]
}> {
  const normalizedConfig = sanitizeFeishuPluginConfig(config)
  const feishuBots = listFeishuBots(normalizedConfig)
  const otherChannelCount = Object.keys(config?.channels || {}).filter((id) => id !== 'feishu').length

  if (feishuBots.length === 0) {
    return {
      summary:
        otherChannelCount > 0
          ? `已整理 ${otherChannelCount} 个非飞书渠道状态，当前没有需要汇总的飞书 Bot。`
          : '当前没有需要汇总的渠道配对状态。',
      data: {
        feishuBotCount: 0,
        pairedBotCount: 0,
        degradedBotCount: 0,
        offlineBotCount: 0,
        otherChannelCount,
      },
      warnings: [],
    }
  }

  const accountIds = feishuBots.map((bot) => bot.accountId)
  const warnings: string[] = []
  const [pairingStatus, runtimeStatus] = await Promise.all([
    api.pairingFeishuStatus(accountIds).catch((error) => {
      warnings.push(formatProbeErrorMessage('飞书配对状态读取失败', error))
      return null
    }),
    api.getFeishuRuntimeStatus().catch((error) => {
      warnings.push(formatProbeErrorMessage('飞书运行态读取失败', error))
      return null
    }),
  ])

  if (!pairingStatus || !runtimeStatus) {
    return {
      summary: `已读取 ${feishuBots.length} 个飞书 Bot 的基础配置，但配对或运行态快照暂不可用。`,
      data: null,
      warnings,
    }
  }

  const pairedCount = feishuBots.filter((bot) => Number(pairingStatus[bot.accountId]?.pairedCount || 0) > 0).length
  const degradedCount = feishuBots.filter((bot) => runtimeStatus[bot.accountId]?.runtimeState === 'degraded').length
  const offlineCount = feishuBots.filter((bot) => runtimeStatus[bot.accountId]?.runtimeState === 'offline').length

  return {
    summary: `已整理 ${feishuBots.length} 个飞书 Bot 的状态，其中 ${pairedCount} 个已配对，${degradedCount} 个待修复，${offlineCount} 个离线。`,
    data: {
      feishuBotCount: feishuBots.length,
      pairedBotCount: pairedCount,
      degradedBotCount: degradedCount,
      offlineBotCount: offlineCount,
      otherChannelCount,
    },
    warnings,
  }
}

export async function runDashboardEntryBootstrapFlow(
  api: DashboardEntryBootstrapApi,
  options: {
    onTaskUpdate?: (
      key: DashboardEntryBootstrapTaskKey,
      status: DashboardEntryBootstrapTaskStatus,
      detail: string
    ) => void
  } = {}
): Promise<DashboardEntryBootstrapFlowResult> {
  const notify = (
    key: DashboardEntryBootstrapTaskKey,
    status: DashboardEntryBootstrapTaskStatus,
    detail: string
  ) => options.onTaskUpdate?.(key, status, detail)

  const traceAndResolveView = (input: unknown): GatewayBootstrapFailureView => {
    const { trace, entries } = createInMemoryTrace()
    const view = resolveGatewayBootstrapFailureView(input, trace)
    api.saveDiagnosticsTrace(entries()).catch(() => {})
    return view
  }
  let forceDegradedGatewayBypass = false

  const attemptForcedGatewayRecovery = async (
    failedEnsureResult: GatewayEnsureRunningResult
  ): Promise<GatewayEnsureRunningResult | null> => {
    const corpus = `${failedEnsureResult.summary || ''}\n${failedEnsureResult.stderr || ''}\n${failedEnsureResult.stdout || ''}`
    const looksLikePluginFailure =
      failedEnsureResult.stateCode === 'plugin_load_failure'
      || /plugin|allowlist|manifest|unknown channel id|failed to load plugin/i.test(corpus)
    if (!looksLikePluginFailure && failedEnsureResult.stateCode !== 'config_invalid') {
      return null
    }

    notify('gateway', 'active', '检测到网关插件异常，正在执行自动修复...')
    try {
      if (api.repairIncompatiblePlugins) {
        await api.repairIncompatiblePlugins({
          quarantineOfficialManagedPlugins: true,
          restoreConfiguredManagedChannels: true,
        }).catch(() => null)
      }
      if (api.gatewayForceRestart) {
        await api.gatewayForceRestart().catch(() => null)
      }
    } catch {
      // best effort only
    }

    let retryEnsureResult = await api.ensureGatewayRunning({
      skipRuntimePrecheck: true,
      requestId: 'dashboard-entry-bootstrap-recovery',
    }).catch(() => null)

    const retryCorpus = `${retryEnsureResult?.summary || ''}\n${retryEnsureResult?.stderr || ''}\n${retryEnsureResult?.stdout || ''}`
    const retryStillPluginFailure =
      !retryEnsureResult?.ok
      && (
        retryEnsureResult?.stateCode === 'plugin_load_failure'
        || /plugin|allowlist|manifest|unknown channel id|failed to load plugin/i.test(retryCorpus)
      )

    if (retryStillPluginFailure && api.repairManagedChannelPlugin) {
      notify('gateway', 'active', '正在执行托管插件定向修复（飞书 / 个人微信）...')
      await api.repairManagedChannelPlugin('feishu').catch(() => null)
      await api.repairManagedChannelPlugin('openclaw-weixin').catch(() => null)
      if (api.gatewayForceRestart) {
        await api.gatewayForceRestart().catch(() => null)
      }
      retryEnsureResult = await api.ensureGatewayRunning({
        skipRuntimePrecheck: true,
        requestId: 'dashboard-entry-bootstrap-recovery-managed',
      }).catch(() => null)
    }

    if (retryEnsureResult && retryEnsureResult.ok && retryEnsureResult.running === true) {
      notify('gateway', 'active', '自动修复已完成，正在重新确认网关状态...')
      return retryEnsureResult
    }
    return null
  }

  notify('config', 'active', '正在读取共享配置...')
  const config = await api.readConfig().catch((error) => {
    notify('config', 'error', '共享配置读取失败，当前无法安全进入控制面板。')
    throw createGenericFailureView(
      '共享配置暂时不可读取',
      `当前无法读取共享配置，所以不能安全进入控制面板。${error instanceof Error ? ` ${error.message}` : ''}`,
      ['先点击“重试最终检查”再试一次。', '如果问题持续存在，再回到配置向导重新整理当前机器上的配置。']
    )
  })
  notify('config', 'done', summarizeConfig(config))

  const softWarnings: string[] = []
  notify('gateway', 'active', '正在自动启动并确认 Gateway...')
  let ensureResult = await api.ensureGatewayRunning({
    skipRuntimePrecheck: true,
    requestId: 'dashboard-entry-bootstrap',
  }).catch((error) => {
    const failureView = traceAndResolveView(normalizeGatewayFailureInput(error))
    notify('gateway', 'error', failureView.detail)
    throw failureView
  })
  if (!ensureResult.ok || ensureResult.running !== true) {
    const recoveredResult = await attemptForcedGatewayRecovery(ensureResult)
    if (recoveredResult) {
      ensureResult = recoveredResult
    }
  }
  if (!ensureResult.ok || ensureResult.running !== true) {
    const pluginLikeFailure =
      ensureResult.stateCode === 'plugin_load_failure'
      || /plugin|allowlist|manifest|unknown channel id|failed to load plugin/i.test(
        `${ensureResult.summary || ''}\n${ensureResult.stderr || ''}\n${ensureResult.stdout || ''}`
      )
    if (pluginLikeFailure) {
      forceDegradedGatewayBypass = true
      softWarnings.push(
        '当前机器的网关插件链路仍未完全恢复，已降级放行到控制面板。请在控制面板内执行插件修复后再重试网关。'
      )
      notify('gateway', 'warning', '网关插件链路异常，已降级放行进入控制面板。')
    } else {
      const failureView = traceAndResolveView(ensureResult)
      notify('gateway', 'error', failureView.detail)
      throw failureView
    }
  }

  notify('gateway', 'active', 'Gateway 已启动，正在读取控制面板首屏状态...')
  const gatewayWarningCountBeforeProbe = softWarnings.length
  const [chatAvailability, health, runtimeStore] = await Promise.all([
    api.getChatAvailability().catch(() => null),
    api.gatewayHealth().catch((error) => {
      softWarnings.push(formatProbeErrorMessage('Gateway 健康确认读取失败，控制面板会按已启动状态继续', error))
      return null
    }),
    api.getOpenClawRuntimeReconcileState().catch(() => null),
  ])
  const runtimeHintsRunning = resolveEffectiveGatewayRunning({
    healthRunning: health?.running === true,
    runtimeStore,
  })
  if (health?.running === false) {
    // The CLI health check (`openclaw health --json`) can return false
    // negatives when the binary resolution path is degraded (e.g. incomplete
    // bundled runtime, where.exe hanging on network drives). When other
    // signals confirm the Gateway is actually available — ensureGatewayRunning
    // already verified via port/socket probes, the runtime store says ready,
    // or chat availability detected a running Gateway — accept degraded
    // readiness instead of blocking entry to the dashboard.
    if (
      runtimeHintsRunning ||
      chatAvailability?.gatewayRunning === true ||
      ensureResult.running === true
    ) {
      softWarnings.push(
        'Gateway 健康探针暂未确认可用，但运行时状态已指示 Gateway 正在运行，控制面板会按已启动状态继续。'
      )
    } else if (!forceDegradedGatewayBypass) {
      const failureView = traceAndResolveView(
        buildGatewayHealthFailureInput(ensureResult, health, chatAvailability)
      )
      notify('gateway', 'error', failureView.detail)
      throw failureView
    } else {
      softWarnings.push('网关健康探针未通过，当前以降级模式进入控制面板。')
    }
  }
  if (
    health === null
    && chatAvailability?.gatewayRunning !== true
    && !runtimeHintsRunning
    && softWarnings.length === gatewayWarningCountBeforeProbe
  ) {
    softWarnings.push('Gateway 已自动启动，但实时状态快照还未刷新完成，控制面板会按已启动状态继续。')
  }
  const gatewayRunning = !forceDegradedGatewayBypass
  notify('gateway', 'done', buildGatewayReadyDetail(ensureResult, health, chatAvailability, runtimeStore))

  const upstreamModelState = await readOpenClawUpstreamModelState(api.getModelUpstreamState)
  const upstreamModelStatus = getUpstreamModelStatusLike(upstreamModelState)
  if (upstreamModelState.fallbackUsed && upstreamModelState.fallbackReason) {
    softWarnings.push(`模型上游状态暂不可用，已回退到 CLI 状态快照：${upstreamModelState.fallbackReason}`)
  }

  let modelStatus = upstreamModelStatus
  if (!modelStatus) {
    const modelStatusResult = await api.getModelStatus().catch(() => null)
    modelStatus = modelStatusResult?.ok ? ((modelStatusResult.data as Record<string, any>) || null) : null
  }
  if (!modelStatus) {
    softWarnings.push('模型状态读取失败：控制面板将先按配置快照显示模型信息。')
  }

  let pairingSummaryData: DashboardEntryPairingSummary | null = null
  notify('pairing', 'active', '正在整理配对状态...')
  try {
    const pairingSummary = await summarizePairing(api, config)
    pairingSummaryData = pairingSummary.data
    if (pairingSummary.warnings.length > 0) {
      notify('pairing', 'warning', pairingSummary.summary)
      softWarnings.push(...pairingSummary.warnings)
    } else {
      notify('pairing', 'done', pairingSummary.summary)
    }
  } catch (error) {
    notify('pairing', 'warning', '配对摘要读取失败，进入控制面板后会按需重新刷新。')
    softWarnings.push(`配对状态整理失败：${error instanceof Error ? error.message : String(error)}`)
  }

  return {
    snapshot: {
      gatewayRunning,
      config,
      pairingSummary: pairingSummaryData,
      modelStatus,
      loadedAt: new Date().toISOString(),
    },
    softWarnings,
  }
}

export default function GatewayBootstrapGate({
  onReady,
  onReconfigure,
}: {
  onReady: (snapshot: DashboardEntrySnapshot) => void
  onReconfigure: () => void
}) {
  const [taskState, setTaskState] = useState<DashboardEntryBootstrapState>(INITIAL_TASK_STATE)
  const [taskDetails, setTaskDetails] = useState<TaskDetailState>(INITIAL_TASK_DETAILS)
  const [fatalError, setFatalError] = useState<GatewayBootstrapFailureView | null>(null)
  const [softWarnings, setSoftWarnings] = useState<string[]>([])
  const [bootstrapping, setBootstrapping] = useState(false)
  const [fallbackSnapshot, setFallbackSnapshot] = useState<DashboardEntrySnapshot | null>(null)
  const activeAttemptRef = useRef(0)
  const bootstrappingRef = useRef(false)

  const progressPercent = useMemo(
    () => resolveDashboardEntryBootstrapProgress(taskState),
    [taskState]
  )
  const heroCopy = useMemo(
    () => resolveDashboardEntryBootstrapCopy(taskState),
    [taskState]
  )

  const updateTask = (
    key: DashboardEntryBootstrapTaskKey,
    status: DashboardEntryBootstrapTaskStatus,
    detail?: string
  ) => {
    setTaskState((current) => ({ ...current, [key]: status }))
    if (detail) {
      setTaskDetails((current) => ({ ...current, [key]: detail }))
    }
  }

  const runBootstrap = async () => {
    if (bootstrappingRef.current) return
    bootstrappingRef.current = true
    setBootstrapping(true)
    activeAttemptRef.current += 1
    const attemptId = activeAttemptRef.current
    setTaskState(createDashboardEntryBootstrapState())
    setTaskDetails(createTaskDetailState())
    setFatalError(null)
    setSoftWarnings([])
    setFallbackSnapshot(null)

    try {
      const result = await runDashboardEntryBootstrapFlow(window.api, {
        onTaskUpdate: updateTask,
      })
      if (attemptId !== activeAttemptRef.current) return
      setSoftWarnings(result.softWarnings)
      setFallbackSnapshot(result.snapshot)
      window.setTimeout(() => {
        if (attemptId === activeAttemptRef.current) {
          onReady(result.snapshot)
        }
      }, 240)
    } catch (cause) {
      if (attemptId !== activeAttemptRef.current) return
      const fallbackView =
        cause && typeof cause === 'object' && 'title' in cause
          ? (cause as GatewayBootstrapFailureView)
          : createGenericFailureView(
              '最终检查没有完成',
              `进入控制面板前的最终检查被中断。${cause instanceof Error ? ` ${cause.message}` : ''}`,
              ['先点击“重试最终检查”再试一次。', '如果问题持续存在，再回到配置向导重新整理当前机器上的配置。']
            )
      setFatalError(fallbackView)
      setFallbackSnapshot({
        gatewayRunning: false,
        config: null,
        pairingSummary: null,
        modelStatus: null,
        loadedAt: new Date().toISOString(),
      })
    } finally {
      if (attemptId === activeAttemptRef.current) {
        bootstrappingRef.current = false
        setBootstrapping(false)
      }
    }
  }

  useEffect(() => {
    void runBootstrap()
  }, [])

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4">
      <div
        className="select-none pointer-events-none"
        style={{ animation: 'bounce-gentle 1.5s ease-in-out infinite' }}
      >
        <BrandWordmark size="hero" />
      </div>
      <style>{`
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
      <Text size="lg" fw={600} className="app-text-primary">正在进入控制面板</Text>

      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <Text size="xs" c="dimmed">{heroCopy.title}</Text>
          <Text size="xs" c="dimmed">{progressPercent}%</Text>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--app-bg-inset)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: fatalError ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-brand-5)',
            }}
          />
        </div>
      </div>

      <Text size="xs" c="dimmed" ta="center" lh={1.6}>
        {heroCopy.detail}
      </Text>

      {softWarnings.length > 0 && (
        <Alert color="yellow" variant="light" w="100%" title="已降级继续" styles={{ title: { fontSize: 'var(--mantine-font-size-xs)' } }}>
          {softWarnings.map((warning) => (
            <Text key={warning} size="xs">{warning}</Text>
          ))}
        </Alert>
      )}

      {fatalError && (
        <Alert color="red" variant="light" w="100%" title={fatalError.title} styles={{ title: { fontSize: 'var(--mantine-font-size-xs)' } }}>
          <Text size="xs" mb={fatalError.hints.length > 0 ? 'xs' : 0}>{fatalError.detail}</Text>
          {fatalError.hints.map((hint) => (
            <Text key={hint} size="xs" c="dimmed">- {hint}</Text>
          ))}
        </Alert>
      )}

      {(fatalError || !bootstrapping) && (
        <div className="flex gap-2">
          <Button onClick={() => void runBootstrap()} disabled={bootstrapping} size="xs">
            {bootstrapping ? '检查中...' : fatalError ? '重试' : '重新检查'}
          </Button>
          {fatalError && (
            <Button
              variant="light"
              color="yellow"
              size="xs"
              onClick={() => {
                onReady(
                  fallbackSnapshot || {
                    gatewayRunning: false,
                    config: null,
                    pairingSummary: null,
                    modelStatus: null,
                    loadedAt: new Date().toISOString(),
                  }
                )
              }}
            >
              强制进入
            </Button>
          )}
          <Button onClick={onReconfigure} variant="default" size="xs" disabled={bootstrapping}>
            配置向导
          </Button>
        </div>
      )}
    </div>
  )
}

