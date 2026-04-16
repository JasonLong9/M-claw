import type {
  DashboardChatAvailability,
  DashboardChatAvailabilityState,
} from '../shared/chat-panel'
import type { OpenClawRuntimeReconcileStore } from '../shared/gateway-runtime-reconcile-state'
import { resolveEffectiveGatewayRunning } from '../shared/gateway-effective-running'

export interface ChatPageAvailabilityState {
  availabilityState: DashboardChatAvailabilityState
  canSend: boolean
  gatewayRunning: boolean
  connectedModels: string[]
  defaultModel: string
  availabilityMessage: string
}

export interface ChatPageAvailabilityApi {
  getChatAvailability: () => Promise<DashboardChatAvailability>
  gatewayHealth: () => Promise<{ running?: boolean } | null | undefined>
  readConfig: () => Promise<Record<string, any> | null>
  getRuntimeReconcileState?: () => Promise<OpenClawRuntimeReconcileStore | null>
}

export interface ChatAvailabilityGatewayStartRecoveryInput {
  state: ChatPageAvailabilityState
  gatewayConfirmedRunning: boolean
}

function isGenericAvailabilityFailureMessage(message: string): boolean {
  return message === '聊天状态读取失败，请稍后重试'
}

function shouldReplaceSendableCompatibilityMessage(message: string): boolean {
  const normalized = String(message || '').trim()
  if (!normalized) return false
  return (
    normalized.includes('尚未完成就绪确认') ||
    normalized.includes('网关当前未运行') ||
    normalized.includes('读取模型状态失败') ||
    normalized.includes('聊天状态读取失败') ||
    normalized.includes('握手异常') ||
    normalized.includes('握手失败') ||
    normalized.toLowerCase().includes('handshake') ||
    normalized.toLowerCase().includes('control ui') ||
    normalized.toLowerCase().includes('websocket 1006') ||
    isGenericAvailabilityFailureMessage(normalized)
  )
}

function buildCompatibilityAvailabilityMessage(message: string): string {
  return message.includes('models status --json')
    ? '网关已接通；当前 OpenClaw 版本不支持 models status --json，可直接发送消息验证运行时可用性。'
    : '网关已接通，当前版本正按兼容模式运行；可以直接对话，无需再等待握手状态刷新。'
}

function normalizeModelList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return Array.from(
    new Set(
      input
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  )
}

function extractDefaultModelFromConfig(config: Record<string, any> | null): string {
  return String(config?.defaultModel ?? config?.agents?.defaults?.model?.primary ?? config?.model ?? '').trim()
}

function fromAvailability(availability: DashboardChatAvailability): ChatPageAvailabilityState {
  const connectedModels = normalizeModelList(availability.connectedModels)
  const defaultModel = String(availability.defaultModel || connectedModels[0] || '').trim()
  const availabilityState = availability.state || (availability.ready ? 'ready' : 'offline')

  return {
    availabilityState,
    canSend: Boolean(availability.canSend),
    gatewayRunning: Boolean(availability.gatewayRunning),
    connectedModels,
    defaultModel,
    availabilityMessage: availabilityState === 'ready' ? '' : String(availability.message || '').trim(),
  }
}

async function enrichAvailabilityWithConfig(
  state: ChatPageAvailabilityState,
  api: ChatPageAvailabilityApi
): Promise<ChatPageAvailabilityState> {
  if (state.defaultModel || state.connectedModels.length > 0) return state

  try {
    const config = await api.readConfig()
    const defaultModel = extractDefaultModelFromConfig(config)
    if (!defaultModel) return state
    return {
      ...state,
      defaultModel,
    }
  } catch {
    return state
  }
}

async function readRuntimeReconcileState(
  api: ChatPageAvailabilityApi
): Promise<OpenClawRuntimeReconcileStore | null> {
  if (!api.getRuntimeReconcileState) return null
  try {
    return await api.getRuntimeReconcileState()
  } catch {
    return null
  }
}

async function fromFallback(api: ChatPageAvailabilityApi): Promise<ChatPageAvailabilityState> {
  let gatewayRunning = false
  try {
    const [health, runtimeStore] = await Promise.all([
      api.gatewayHealth().catch(() => null),
      readRuntimeReconcileState(api),
    ])
    gatewayRunning = resolveEffectiveGatewayRunning({
      healthRunning: Boolean(health?.running),
      runtimeStore,
    })
  } catch {
    gatewayRunning = false
  }

  let defaultModel = ''
  try {
    const config = await api.readConfig()
    defaultModel = extractDefaultModelFromConfig(config)
  } catch {
    defaultModel = ''
  }

  return {
    availabilityState: 'error',
    canSend: false,
    gatewayRunning,
    connectedModels: [],
    defaultModel,
    availabilityMessage: '聊天状态读取失败，请稍后重试',
  }
}

export async function resolveChatPageAvailabilityState(
  api: ChatPageAvailabilityApi
): Promise<ChatPageAvailabilityState> {
  try {
    const availability = await api.getChatAvailability()
    const enrichedState = await enrichAvailabilityWithConfig(fromAvailability(availability), api)
    const runtimeStore = await readRuntimeReconcileState(api)
    return recoverChatAvailabilityAfterGatewayStart({
      state: enrichedState,
      gatewayConfirmedRunning: resolveEffectiveGatewayRunning({
        healthRunning: enrichedState.gatewayRunning,
        runtimeStore,
      }),
    })
  } catch {
    return fromFallback(api)
  }
}

export function recoverChatAvailabilityAfterGatewayStart(
  input: ChatAvailabilityGatewayStartRecoveryInput
): ChatPageAvailabilityState {
  const state = input.state
  const availabilityMessage = String(state.availabilityMessage || '').trim()

  if (input.gatewayConfirmedRunning && state.canSend) {
    if (state.availabilityState !== 'ready' && shouldReplaceSendableCompatibilityMessage(availabilityMessage)) {
      return {
        ...state,
        availabilityState: 'degraded',
        gatewayRunning: true,
        availabilityMessage: buildCompatibilityAvailabilityMessage(availabilityMessage),
      }
    }
    return state
  }

  if (!input.gatewayConfirmedRunning) return state

  const hasSavedModel = state.connectedModels.length > 0 || Boolean(String(state.defaultModel || '').trim())
  if (!hasSavedModel) return state
  if (state.availabilityState === 'no-model' || state.availabilityState === 'loading') return state

  const modelsStatusUnsupported = availabilityMessage.includes('models status --json')

  // On legacy runtimes (e.g. OpenClaw 2026.3.24 on Windows), the gateway health probe
  // may return false negatives even after the gateway has been started. We treat ANY
  // non-ready/non-no-model state as recoverable when the user just explicitly started
  // the gateway and we have saved models. The 'no-model' and 'loading' exclusions above
  // prevent false positives.
  const gatewayReadinessPending =
    state.availabilityState === 'offline'
    || state.availabilityState === 'error'
    || availabilityMessage.includes('尚未完成就绪确认')
    || availabilityMessage.includes('网关当前未运行')
    || availabilityMessage.includes('读取模型状态失败')
    || availabilityMessage.includes('聊天状态读取失败')
    || isGenericAvailabilityFailureMessage(availabilityMessage)
  if (!modelsStatusUnsupported && !gatewayReadinessPending) return state

  return {
    ...state,
    availabilityState: 'degraded',
    canSend: true,
    gatewayRunning: true,
    availabilityMessage: modelsStatusUnsupported
      ? buildCompatibilityAvailabilityMessage(availabilityMessage)
      : '网关启动命令已执行；当前版本的健康探针尚未完成就绪确认，已先放行直接发送消息验证实际对话链路。',
  }
}
