import { describe, expect, it, vi } from 'vitest'
import {
  recoverChatAvailabilityAfterGatewayStart,
  resolveChatPageAvailabilityState,
} from '../chat-availability-state'
import type { DashboardChatAvailability } from '../../shared/chat-panel'

function buildAvailability(overrides: Partial<DashboardChatAvailability> = {}): DashboardChatAvailability {
  return {
    state: 'no-model',
    ready: false,
    canSend: false,
    reason: 'no-configured-model',
    gatewayRunning: false,
    connectedModels: [],
    defaultModel: undefined,
    agentId: 'main',
    message: '当前还没有可直接对话的模型',
    ...overrides,
  }
}

describe('resolveChatPageAvailabilityState', () => {
  it('does not infer connected models from default model when availability reports none', async () => {
    const getChatAvailability = vi.fn(async () =>
      buildAvailability({
        ready: false,
        reason: 'no-configured-model',
        gatewayRunning: true,
        connectedModels: [],
        defaultModel: 'openai/gpt-5.1-codex',
        message: '当前还没有可直接对话的模型',
      })
    )
    const gatewayHealth = vi.fn(async () => ({ running: true }))
    const readConfig = vi.fn(async () => null)

    const result = await resolveChatPageAvailabilityState({
      getChatAvailability,
      gatewayHealth,
      readConfig,
    })

    expect(result.gatewayRunning).toBe(true)
    expect(result.availabilityState).toBe('no-model')
    expect(result.canSend).toBe(false)
    expect(result.connectedModels).toEqual([])
    expect(result.defaultModel).toBe('openai/gpt-5.1-codex')
    expect(result.availabilityMessage).toBe('当前还没有可直接对话的模型')
  })

  it('prefers unified chat availability and skips legacy fallback probes', async () => {
    const getChatAvailability = vi.fn(async () =>
      buildAvailability({
        ready: true,
        state: 'ready',
        canSend: true,
        reason: 'ready',
        gatewayRunning: true,
        connectedModels: ['openai/gpt-5.1-codex'],
        defaultModel: 'openai/gpt-5.1-codex',
      })
    )
    const gatewayHealth = vi.fn(async () => ({ running: false }))
    const readConfig = vi.fn(async () => null)

    const result = await resolveChatPageAvailabilityState({
      getChatAvailability,
      gatewayHealth,
      readConfig,
    })

    expect(result.gatewayRunning).toBe(true)
    expect(result.availabilityState).toBe('ready')
    expect(result.canSend).toBe(true)
    expect(result.connectedModels).toEqual(['openai/gpt-5.1-codex'])
    expect(result.defaultModel).toBe('openai/gpt-5.1-codex')
    expect(result.availabilityMessage).toBe('')
    expect(gatewayHealth).not.toHaveBeenCalled()
    expect(readConfig).not.toHaveBeenCalled()
  })

  it('falls back to gateway/config snapshot when chat availability API fails', async () => {
    const getChatAvailability = vi.fn(async () => {
      throw new Error('chat availability unavailable')
    })
    const gatewayHealth = vi.fn(async () => ({ running: true }))
    const readConfig = vi.fn(async () => ({
      agents: {
        defaults: {
          model: {
            primary: 'openai/gpt-5.1-codex',
          },
        },
      },
    }))

    const result = await resolveChatPageAvailabilityState({
      getChatAvailability,
      gatewayHealth,
      readConfig,
    })

    expect(result.availabilityState).toBe('error')
    expect(result.canSend).toBe(false)
    expect(result.gatewayRunning).toBe(true)
    expect(result.connectedModels).toEqual([])
    expect(result.defaultModel).toBe('openai/gpt-5.1-codex')
    expect(result.availabilityMessage).toBe('聊天状态读取失败，请稍后重试')
  })

  it('supports top-level defaultModel in config fallback snapshots', async () => {
    const getChatAvailability = vi.fn(async () => {
      throw new Error('chat availability unavailable')
    })
    const gatewayHealth = vi.fn(async () => ({ running: true }))
    const readConfig = vi.fn(async () => ({
      defaultModel: 'openai/gpt-5',
    }))

    const result = await resolveChatPageAvailabilityState({
      getChatAvailability,
      gatewayHealth,
      readConfig,
    })

    expect(result.availabilityState).toBe('error')
    expect(result.canSend).toBe(false)
    expect(result.gatewayRunning).toBe(true)
    expect(result.connectedModels).toEqual([])
    expect(result.defaultModel).toBe('openai/gpt-5')
  })

  it('recovers send availability after gateway start when legacy models status probing stays unsupported', () => {
    const result = recoverChatAvailabilityAfterGatewayStart({
      gatewayConfirmedRunning: true,
      state: {
        availabilityState: 'offline',
        canSend: false,
        gatewayRunning: false,
        connectedModels: ['custom-openai/deepseek-chat'],
        defaultModel: 'custom-openai/deepseek-chat',
        availabilityMessage:
          '当前 OpenClaw 版本不支持 models status --json，但已检测到已保存模型；启动网关后可继续尝试对话。',
      },
    })

    expect(result.availabilityState).toBe('degraded')
    expect(result.canSend).toBe(true)
    expect(result.gatewayRunning).toBe(true)
    expect(result.availabilityMessage).toContain('可直接发送消息验证运行时可用性')
  })

  it('recovers send availability after gateway start when health probing still reports gateway offline', () => {
    const result = recoverChatAvailabilityAfterGatewayStart({
      gatewayConfirmedRunning: true,
      state: {
        availabilityState: 'offline',
        canSend: false,
        gatewayRunning: false,
        connectedModels: ['custom-openai/deepseek-chat'],
        defaultModel: 'custom-openai/deepseek-chat',
        availabilityMessage: '模型已配置，但网关当前未运行',
      },
    })

    expect(result.availabilityState).toBe('degraded')
    expect(result.canSend).toBe(true)
    expect(result.gatewayRunning).toBe(true)
    expect(result.availabilityMessage).toContain('已先放行直接发送消息验证实际对话链路')
  })

  it('does not recover a no-model snapshot even if a default model string still exists', () => {
    const originalState = {
      availabilityState: 'no-model' as const,
      canSend: false,
      gatewayRunning: false,
      connectedModels: [],
      defaultModel: 'custom-openai/deepseek-chat',
      availabilityMessage: '当前还没有可直接对话的模型',
    }

    const result = recoverChatAvailabilityAfterGatewayStart({
      gatewayConfirmedRunning: true,
      state: originalState,
    })

    expect(result).toEqual(originalState)
  })

  it('does not recover send availability without a saved model snapshot', () => {
    const originalState = {
      availabilityState: 'offline' as const,
      canSend: false,
      gatewayRunning: false,
      connectedModels: [],
      defaultModel: '',
      availabilityMessage:
        '当前 OpenClaw 版本不支持 models status --json，但尚未检测到已保存模型。',
    }

    const result = recoverChatAvailabilityAfterGatewayStart({
      gatewayConfirmedRunning: true,
      state: originalState,
    })

    expect(result).toEqual(originalState)
  })

  it('recovers send availability when backend returns error state with model status failure', () => {
    const result = recoverChatAvailabilityAfterGatewayStart({
      gatewayConfirmedRunning: true,
      state: {
        availabilityState: 'error',
        canSend: false,
        gatewayRunning: false,
        connectedModels: ['custom-openai/deepseek-chat'],
        defaultModel: 'custom-openai/deepseek-chat',
        availabilityMessage: '读取模型状态失败',
      },
    })

    expect(result.availabilityState).toBe('degraded')
    expect(result.canSend).toBe(true)
    expect(result.gatewayRunning).toBe(true)
    expect(result.availabilityMessage).toContain('已先放行直接发送消息验证实际对话链路')
  })

  it('recovers send availability when backend returns error state with generic chat read failure', () => {
    const result = recoverChatAvailabilityAfterGatewayStart({
      gatewayConfirmedRunning: true,
      state: {
        availabilityState: 'error',
        canSend: false,
        gatewayRunning: false,
        connectedModels: [],
        defaultModel: 'openai/gpt-5.1-codex',
        availabilityMessage: '聊天状态读取失败，请稍后重试',
      },
    })

    expect(result.availabilityState).toBe('degraded')
    expect(result.canSend).toBe(true)
    expect(result.gatewayRunning).toBe(true)
  })

  it('does not recover when gateway was not confirmed running even with error state', () => {
    const originalState = {
      availabilityState: 'error' as const,
      canSend: false,
      gatewayRunning: false,
      connectedModels: ['custom-openai/deepseek-chat'],
      defaultModel: 'custom-openai/deepseek-chat',
      availabilityMessage: '读取模型状态失败',
    }

    const result = recoverChatAvailabilityAfterGatewayStart({
      gatewayConfirmedRunning: false,
      state: originalState,
    })

    expect(result).toEqual(originalState)
  })
})

