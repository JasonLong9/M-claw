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

const INITIAL_AVAILABILITY_STATE: ChatPageAvailabilityState = {
  availabilityState: 'loading',
  canSend: false,
  gatewayRunning: false,
  connectedModels: [],
  defaultModel: '',
  availabilityMessage: '正在读取聊天状态...',
}

const GATEWAY_START_RECOVERY_GRACE_MS = 60_000

export default function ChatPage() {
  const navigate = useNavigate()
  const [chatAvailability, setChatAvailability] = useState<ChatPageAvailabilityState>(
    INITIAL_AVAILABILITY_STATE
  )
  const [gatewayActionPending, setGatewayActionPending] = useState(false)
  const [gatewayActionMessage, setGatewayActionMessage] = useState('')
  const availabilityStateRef = useRef<ChatPageAvailabilityState>(INITIAL_AVAILABILITY_STATE)
  const latestAvailabilityRequestIdRef = useRef(0)
  const availabilityInFlightRef = useRef(false)
  const gatewayStartRecoveryUntilRef = useRef(0)

  const loadAvailability = useCallback(async (): Promise<ChatPageAvailabilityState> => {
    const requestId = createNextRequestId(latestAvailabilityRequestIdRef.current)
    latestAvailabilityRequestIdRef.current = requestId
    availabilityInFlightRef.current = true

    try {
      const nextState = await resolveChatPageAvailabilityState({
        getChatAvailability: () => window.api.getChatAvailability(),
        gatewayHealth: () => window.api.gatewayHealth(),
        readConfig: () => window.api.readConfig(),
      })
      const recoveredState = recoverChatAvailabilityAfterGatewayStart({
        state: nextState,
        gatewayConfirmedRunning: Date.now() < gatewayStartRecoveryUntilRef.current,
      })

      // Auto-extend the grace window while recovery keeps succeeding.
      // On legacy runtimes where gatewayHealth() always returns false,
      // this prevents the UI from flickering to 'offline' every 60 seconds.
      if (recoveredState.canSend && recoveredState !== nextState) {
        gatewayStartRecoveryUntilRef.current = Date.now() + GATEWAY_START_RECOVERY_GRACE_MS
      }

      if (shouldApplyRequestResult(requestId, latestAvailabilityRequestIdRef.current)) {
        availabilityStateRef.current = recoveredState
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

  const handleEnsureGateway = async (): Promise<boolean> => {
    setGatewayActionPending(true)
    setGatewayActionMessage('')
    try {
      if (!gatewayRunning) {
        const ensureResult = await window.api.ensureGatewayRunning()

        // Always set recovery grace window after an explicit user "启动网关" action.
        // On legacy Windows runtimes (e.g. OpenClaw 2026.3.24), the health probe may
        // give false negatives (running=false) even though the gateway process is alive.
        // The recovery function has its own guards (hasSavedModel, message matching)
        // so setting the grace window here is safe — it only relaxes the time-bound
        // within which the next availability poll may apply the recovery path.
        gatewayStartRecoveryUntilRef.current = Date.now() + GATEWAY_START_RECOVERY_GRACE_MS

        const gatewayLikelyRunning = Boolean(ensureResult?.running) || Boolean(ensureResult?.ok)

        if (!gatewayLikelyRunning) {
          // Gateway definitely failed to start — show the error but still allow
          // recovery from the grace window in case a subsequent health probe succeeds.
          setGatewayActionMessage(
            String(
              ensureResult?.summary ||
              ensureResult?.stderr ||
              ensureResult?.stdout ||
              '启动网关失败，请稍后重试。'
            ).trim()
          )
        } else {
          setGatewayActionMessage('网关已启动，正在刷新对话状态...')
        }

        const nextState = await loadAvailability()
        const recoveredState = recoverChatAvailabilityAfterGatewayStart({
          state: nextState,
          gatewayConfirmedRunning: gatewayLikelyRunning || Date.now() < gatewayStartRecoveryUntilRef.current,
        })
        if (recoveredState !== nextState) {
          availabilityStateRef.current = recoveredState
          setChatAvailability(recoveredState)
        }
        if (!recoveredState.canSend) {
          setGatewayActionMessage(
            String(recoveredState.availabilityMessage || '网关已启动，但聊天状态仍未恢复，请稍候再试。').trim()
          )
          return false
        }
        setGatewayActionMessage('')
        return true
      }
      const nextState = await loadAvailability()
      if (!nextState.canSend) {
        setGatewayActionMessage(
          String(nextState.availabilityMessage || '网关状态已刷新，但当前仍不可发送消息。').trim()
        )
      } else {
        setGatewayActionMessage('')
      }
      return nextState.canSend
    } catch (e) {
      console.error('Failed to ensure gateway ready', e)
      setGatewayActionMessage(e instanceof Error ? e.message : '启动网关失败，请稍后重试。')
      return false
    } finally {
      setGatewayActionPending(false)
    }
  }

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
