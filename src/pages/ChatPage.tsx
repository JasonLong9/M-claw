import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardChatPanel from '../components/dashboard/DashboardChatPanel'
import {
  recoverChatAvailabilityAfterGatewayStart,
  resolveChatPageAvailabilityState,
  type ChatPageAvailabilityState,
} from './chat-availability-state'
import { resolveChatSelectableModels } from './chat-model-options'
import { createNextRequestId, shouldApplyRequestResult } from './chat-request-guards'
import { pollWithBackoff } from '../shared/polling'
import { UI_RUNTIME_DEFAULTS } from '../shared/runtime-policies'
import { waitForDashboardGatewayRunning } from '../shared/dashboard-gateway-wait'
import {
  clearChatGatewayWarmupHint,
  hasActiveChatGatewayWarmupHint,
  markChatGatewayWarmupHint,
} from '../shared/chat-gateway-warmup-hint'

const INITIAL_AVAILABILITY_STATE: ChatPageAvailabilityState = {
  availabilityState: 'loading',
  canSend: false,
  gatewayRunning: false,
  connectedModels: [],
  defaultModel: '',
  availabilityMessage: '正在读取聊天状态...',
}

let cachedAvailabilityState: ChatPageAvailabilityState | null = null

const GATEWAY_START_RECOVERY_GRACE_MS = 60_000
const CHAT_PAGE_AUTO_GATEWAY_RETRY_COOLDOWN_MS = 15_000

export default function ChatPage() {
  const navigate = useNavigate()
  const [chatAvailability, setChatAvailability] = useState<ChatPageAvailabilityState>(
    cachedAvailabilityState ?? INITIAL_AVAILABILITY_STATE
  )
  const [gatewayActionPending, setGatewayActionPending] = useState(false)
  const [gatewayActionMessage, setGatewayActionMessage] = useState('')
  const availabilityStateRef = useRef<ChatPageAvailabilityState>(INITIAL_AVAILABILITY_STATE)
  const latestAvailabilityRequestIdRef = useRef(0)
  const availabilityInFlightRef = useRef(false)
  const gatewayStartRecoveryUntilRef = useRef(0)
  const gatewayWarmupPromiseRef = useRef<Promise<boolean> | null>(null)
  const autoGatewayRetryCooldownUntilRef = useRef(0)

  const loadAvailability = useCallback(async (): Promise<ChatPageAvailabilityState> => {
    const requestId = createNextRequestId(latestAvailabilityRequestIdRef.current)
    latestAvailabilityRequestIdRef.current = requestId
    availabilityInFlightRef.current = true

    try {
      const nextState = await resolveChatPageAvailabilityState({
        getChatAvailability: () => window.api.getChatAvailability(),
        gatewayHealth: () => window.api.gatewayHealth(),
        readConfig: () => window.api.readConfig(),
        getRuntimeReconcileState: () => window.api.getOpenClawRuntimeReconcileState(),
      })
      const recoveredState = recoverChatAvailabilityAfterGatewayStart({
        state: nextState,
        gatewayConfirmedRunning: Date.now() < gatewayStartRecoveryUntilRef.current,
      })

      // Keep a short recovery window after explicit starts so legacy runtimes can settle.
      if (recoveredState.canSend && recoveredState !== nextState) {
        gatewayStartRecoveryUntilRef.current = Date.now() + GATEWAY_START_RECOVERY_GRACE_MS
      }

      if (shouldApplyRequestResult(requestId, latestAvailabilityRequestIdRef.current)) {
        availabilityStateRef.current = recoveredState
        cachedAvailabilityState = recoveredState
        setChatAvailability(recoveredState)
      }
      return recoveredState
    } catch (error) {
      console.error('ChatPage: failed to resolve availability', error)
      return availabilityStateRef.current
    } finally {
      if (shouldApplyRequestResult(requestId, latestAvailabilityRequestIdRef.current)) {
        availabilityInFlightRef.current = false
      }
    }
  }, [])

  const waitForChatSendReady = useCallback(async (): Promise<ChatPageAvailabilityState> => {
    const readiness = await pollWithBackoff({
      policy: UI_RUNTIME_DEFAULTS.gatewayReadiness.poll,
      execute: async () => {
        const nextState = await loadAvailability()
        return recoverChatAvailabilityAfterGatewayStart({
          state: nextState,
          gatewayConfirmedRunning: Date.now() < gatewayStartRecoveryUntilRef.current,
        })
      },
      isSuccess: (state) => state.canSend,
    })

    return readiness.value || availabilityStateRef.current
  }, [loadAvailability])

  const ensureGatewayReady = useCallback(
    async (options: { source: 'auto' | 'manual' } = { source: 'manual' }): Promise<boolean> => {
      if (gatewayWarmupPromiseRef.current) {
        return gatewayWarmupPromiseRef.current
      }

      const task = (async () => {
        const currentState = availabilityStateRef.current
        const hasPotentialChat =
          currentState.gatewayRunning ||
          currentState.connectedModels.length > 0 ||
          Boolean(String(currentState.defaultModel || '').trim()) ||
          hasActiveChatGatewayWarmupHint()

        if (!hasPotentialChat) {
          setGatewayActionMessage('当前还没有可直接对话的模型，请先回到模型页完成配置。')
          return false
        }

        setGatewayActionPending(true)
        setGatewayActionMessage(
          options.source === 'auto'
            ? '正在等待本机服务准备完成，稍后即可直接对话...'
            : '正在确认本机服务状态，请稍候...'
        )

        try {
          const ensureResult = await window.api.ensureGatewayRunning()
          markChatGatewayWarmupHint()
          gatewayStartRecoveryUntilRef.current = Date.now() + GATEWAY_START_RECOVERY_GRACE_MS

          const gatewayLikelyRunning = Boolean(ensureResult?.running) || Boolean(ensureResult?.ok)
          if (!gatewayLikelyRunning && !currentState.gatewayRunning) {
            setGatewayActionMessage(
              String(
                ensureResult?.summary ||
                  ensureResult?.stderr ||
                  ensureResult?.stdout ||
                  '本机服务启动失败，请稍后重试。'
              ).trim()
            )
          }

          const readyResult = await waitForDashboardGatewayRunning({
            gatewayHealth: () => window.api.gatewayHealth(),
            getOpenClawRuntimeReconcileState: () => window.api.getOpenClawRuntimeReconcileState(),
          })
          if (readyResult.ok) {
            gatewayStartRecoveryUntilRef.current = Date.now() + GATEWAY_START_RECOVERY_GRACE_MS
          }

          const recoveredState = await waitForChatSendReady()
          if (recoveredState.canSend) {
            if (recoveredState.availabilityState === 'ready') {
              clearChatGatewayWarmupHint()
              setGatewayActionMessage('')
            } else {
              setGatewayActionMessage('本机服务已接通，当前正在走兼容恢复链路，可以直接开始对话。')
            }
            return true
          }

          setGatewayActionMessage(
            String(
              recoveredState.availabilityMessage ||
                (readyResult.ok ? '本机服务已启动，但聊天状态仍未恢复，请稍候再试。' : readyResult.message) ||
                '本机服务已启动，但聊天状态仍未恢复，请稍候再试。'
            ).trim()
          )
          return false
        } catch (error) {
          console.error('Failed to ensure gateway ready', error)
          setGatewayActionMessage(error instanceof Error ? error.message : '启动本机服务失败，请稍后重试。')
          return false
        } finally {
          setGatewayActionPending(false)
          gatewayWarmupPromiseRef.current = null
        }
      })()

      gatewayWarmupPromiseRef.current = task
      return task
    },
    [waitForChatSendReady]
  )

  const {
    availabilityState,
    canSend,
    gatewayRunning,
    connectedModels,
    defaultModel,
    availabilityMessage,
  } = chatAvailability
  const selectableModels = resolveChatSelectableModels({
    connectedModels,
    defaultModel,
  })

  useEffect(() => {
    void loadAvailability()
    const intervalId = window.setInterval(() => {
      if (availabilityInFlightRef.current) return
      void loadAvailability()
    }, 10000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadAvailability])

  useEffect(() => {
    const hasPotentialChat =
      gatewayRunning ||
      connectedModels.length > 0 ||
      Boolean(String(defaultModel || '').trim()) ||
      hasActiveChatGatewayWarmupHint()
    const shouldAutoWarmup =
      hasPotentialChat &&
      availabilityState !== 'loading' &&
      !canSend &&
      !gatewayActionPending

    if (!shouldAutoWarmup) return
    if (Date.now() < autoGatewayRetryCooldownUntilRef.current) return

    autoGatewayRetryCooldownUntilRef.current = Date.now() + CHAT_PAGE_AUTO_GATEWAY_RETRY_COOLDOWN_MS
    void ensureGatewayReady({ source: 'auto' })
  }, [
    availabilityState,
    canSend,
    connectedModels.length,
    defaultModel,
    ensureGatewayReady,
    gatewayActionPending,
    gatewayRunning,
  ])

  const handleEnsureGateway = useCallback(async (): Promise<boolean> => {
    return ensureGatewayReady({ source: 'manual' })
  }, [ensureGatewayReady])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <DashboardChatPanel
        availabilityState={availabilityState}
        canSend={canSend}
        gatewayRunning={gatewayRunning}
        connectedModels={selectableModels}
        defaultModel={defaultModel}
        availabilityMessage={availabilityMessage}
        gatewayActionPending={gatewayActionPending}
        gatewayActionMessage={gatewayActionMessage}
        onOpenSettings={() => navigate('/models')}
        onEnsureGatewayRunning={handleEnsureGateway}
      />
    </div>
  )
}
