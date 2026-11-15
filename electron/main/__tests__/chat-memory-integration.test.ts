import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  runCliMock,
  runCliStreamingMock,
  gatewayHealthMock,
  ensureGatewayRunningMock,
  getModelCatalogMock,
  getModelStatusMock,
  getOpenClawUpstreamModelStateMock,
  discoverOpenClawMock,
  readConfigMock,
  readEnvFileMock,
  readConfiguredGatewayPortMock,
  probeGatewayPortReachableMock,
  probeGatewaySocketReadyMock,
  callGatewayRpcViaControlUiBrowserMock,
  runGatewayChatViaControlUiBrowserMock,
  inspectBundledOpenClawDeliveryStatusMock,
} = vi.hoisted(() => ({
  runCliMock: vi.fn(),
  runCliStreamingMock: vi.fn(),
  gatewayHealthMock: vi.fn(),
  ensureGatewayRunningMock: vi.fn(),
  getModelCatalogMock: vi.fn(),
  getModelStatusMock: vi.fn(),
  getOpenClawUpstreamModelStateMock: vi.fn(),
  discoverOpenClawMock: vi.fn(),
  readConfigMock: vi.fn(),
  readEnvFileMock: vi.fn(),
  readConfiguredGatewayPortMock: vi.fn(),
  probeGatewayPortReachableMock: vi.fn(),
  probeGatewaySocketReadyMock: vi.fn(),
  callGatewayRpcViaControlUiBrowserMock: vi.fn(),
  runGatewayChatViaControlUiBrowserMock: vi.fn(),
  inspectBundledOpenClawDeliveryStatusMock: vi.fn(),
}))

vi.mock('../cli', () => ({
  gatewayHealth: gatewayHealthMock,
  runCli: runCliMock,
  runCliStreaming: runCliStreamingMock,
  readConfig: readConfigMock,
  readEnvFile: readEnvFileMock,
}))

vi.mock('../openclaw-model-config', () => ({
  getModelStatus: getModelStatusMock,
}))

vi.mock('../openclaw-model-catalog', () => ({
  getModelCatalog: getModelCatalogMock,
}))

vi.mock('../openclaw-upstream-model-state', () => ({
  getOpenClawUpstreamModelState: getOpenClawUpstreamModelStateMock,
}))

vi.mock('../openclaw-install-discovery', () => ({
  discoverOpenClawInstallations: discoverOpenClawMock,
}))

vi.mock('../openclaw-gateway-service', () => ({
  ensureGatewayRunning: ensureGatewayRunningMock,
}))

vi.mock('../openclaw-gateway-probes', () => ({
  readConfiguredGatewayPort: readConfiguredGatewayPortMock,
  probeGatewayPortReachable: probeGatewayPortReachableMock,
  probeGatewaySocketReady: probeGatewaySocketReadyMock,
}))

vi.mock('../openclaw-control-ui-rpc', () => ({
  callGatewayRpcViaControlUiBrowser: callGatewayRpcViaControlUiBrowserMock,
  runGatewayChatViaControlUiBrowser: runGatewayChatViaControlUiBrowserMock,
}))

vi.mock('../openclaw-bundled-manifest', () => ({
  inspectBundledOpenClawDeliveryStatus: inspectBundledOpenClawDeliveryStatusMock,
}))

import { resetDashboardChatAvailabilityTrackerForTests, sendChatMessage } from '../openclaw-chat-service'
import { buildChatMemoryContext, listChatMemories, saveChatMemory } from '../memory'
import { appendLocalChatMessages } from '../qclaw-chat-store'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const { mkdtemp, rm } = fs.promises

const RETRYABLE_RM_CODES = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM'])

vi.setConfig({
  testTimeout: 15_000,
  hookTimeout: 15_000,
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function removeWithRetry(targetPath: string): Promise<void> {
  const normalized = String(targetPath || '').trim()
  if (!normalized) return

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(normalized, { recursive: true, force: true })
      return
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code || '') : ''
      if (!RETRYABLE_RM_CODES.has(code) || attempt === 9) throw error
      await sleep(100 * (attempt + 1))
    }
  }
}

function createDiscovery(fingerprint: string) {
  return async () =>
    ({
      status: 'installed',
      candidates: [
        {
          candidateId: 'candidate-1',
          binaryPath: '/usr/local/bin/openclaw',
          resolvedBinaryPath: '/usr/local/bin/openclaw',
          packageRoot: '/usr/local/lib/node_modules/openclaw',
          version: '2026.3.12',
          installSource: 'npm-global',
          isPathActive: true,
          configPath: '/Users/test/.openclaw/openclaw.json',
          stateRoot: '/Users/test/.openclaw',
          displayConfigPath: '~/.openclaw/openclaw.json',
          displayStateRoot: '~/.openclaw',
          ownershipState: 'external-preexisting',
          installFingerprint: fingerprint,
          baselineBackup: null,
          baselineBackupBypass: null,
        },
      ],
      activeCandidateId: 'candidate-1',
      hasMultipleCandidates: false,
      historyDataCandidates: [],
      errors: [],
      warnings: [],
      defaultBackupDirectory: '/tmp',
    }) as any
}

function createModelStatus(defaultModel: string) {
  return {
    ok: true,
    action: 'status',
    command: ['models', 'status', '--json'],
    stdout: '',
    stderr: '',
    code: 0,
    data: { defaultModel },
  } as any
}

describe('chat memory integration', () => {
  let userDataDir = ''
  const originalUserDataDir = process.env.QCLAW_USER_DATA_DIR

  beforeEach(async () => {
    resetDashboardChatAvailabilityTrackerForTests()
    runCliMock.mockReset()
    runCliStreamingMock.mockReset()
    gatewayHealthMock.mockReset()
    ensureGatewayRunningMock.mockReset()
    getModelCatalogMock.mockReset()
    getModelStatusMock.mockReset()
    getOpenClawUpstreamModelStateMock.mockReset()
    discoverOpenClawMock.mockReset()
    readConfigMock.mockReset()
    readEnvFileMock.mockReset()
    readConfiguredGatewayPortMock.mockReset()
    probeGatewayPortReachableMock.mockReset()
    probeGatewaySocketReadyMock.mockReset()
    callGatewayRpcViaControlUiBrowserMock.mockReset()
    runGatewayChatViaControlUiBrowserMock.mockReset()
    inspectBundledOpenClawDeliveryStatusMock.mockReset()

    readConfigMock.mockResolvedValue(null)
    readEnvFileMock.mockResolvedValue({})
    readConfiguredGatewayPortMock.mockResolvedValue(18789)
    probeGatewayPortReachableMock.mockResolvedValue(true)
    probeGatewaySocketReadyMock.mockResolvedValue(true)
    getModelCatalogMock.mockResolvedValue({
      total: 0,
      items: [],
      providers: [],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })
    getOpenClawUpstreamModelStateMock.mockResolvedValue({
      ok: false,
      source: 'control-ui-app',
      fallbackUsed: true,
      fallbackReason: 'control-ui-app-unavailable',
      diagnostics: {
        upstreamAvailable: false,
        connected: false,
        hasClient: false,
        hasHelloSnapshot: false,
        hasHealthResult: false,
        hasSessionsState: false,
        hasModelCatalogState: false,
        appKeys: [],
        lastError: 'control-ui-app-unavailable',
      },
    })
    inspectBundledOpenClawDeliveryStatusMock.mockReturnValue({
      manifestPath: null,
      manifest: null,
      platform: process.platform,
      arch: process.arch,
      defaultDeliveryMode: null,
      targetDeliveryMode: null,
      runtimeArtifact: null,
      runtimePath: null,
      runtimeBinaryPath: null,
    })

    if (userDataDir) {
      await removeWithRetry(userDataDir)
    }
    userDataDir = await mkdtemp(path.join(os.tmpdir(), 'qclaw-chat-memory-'))
    process.env.QCLAW_USER_DATA_DIR = userDataDir
  })

  afterEach(async () => {
    if (userDataDir) {
      await removeWithRetry(userDataDir)
      userDataDir = ''
    }
    process.env.QCLAW_USER_DATA_DIR = originalUserDataDir
  })

  it('injects stored memories into extraSystemPrompt before sending', async () => {
    await saveChatMemory({
      scope: 'user',
      content: '默认使用中文回复。',
    })
    await saveChatMemory({
      scope: 'session',
      sessionId: 'memory-context-session',
      content: '本次只做基础版本，不提前进入 Claude Code 模式。',
    })

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '好的，我会按当前要求继续。',
        },
        model: 'openai/gpt-5.4-mini',
      }),
      stderr: '',
      code: 0,
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'memory-context-session',
        text: '继续推进当前任务',
      },
      {
        discoverOpenClaw: createDiscovery('fingerprint-memory-context'),
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    const transportCall = (transportRun.mock.calls as Array<unknown[]>)[0]?.[0] as
      | { extraSystemPrompt?: string }
      | undefined
    const extraSystemPrompt = String(transportCall?.extraSystemPrompt || '')

    expect(extraSystemPrompt).toContain('以下是 Mclaw 本地记忆中的高优先级用户偏好与上下文')
    expect(extraSystemPrompt).toContain('请直接执行，不要只在回答里复述“我记住了”')
    expect(extraSystemPrompt).toContain('全局偏好')
    expect(extraSystemPrompt).toContain('默认使用中文回复。')
    expect(extraSystemPrompt).toContain('当前会话记忆')
    expect(extraSystemPrompt).toContain('本次只做基础版本，不提前进入 Claude Code 模式。')
  })

  it('captures explicit remember instructions and emits a memory-saved event', async () => {
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '我会记住这个偏好。',
        },
        model: 'openai/gpt-5.4-mini',
      }),
      stderr: '',
      code: 0,
    }))
    const emittedEvents: Array<Record<string, any>> = []

    const result = await sendChatMessage(
      {
        sessionId: 'memory-save-session',
        text: '请记住：以后默认用中文回复',
      },
      {
        discoverOpenClaw: createDiscovery('fingerprint-memory-save'),
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun as any,
        },
        emit: (event) => emittedEvents.push(event as Record<string, any>),
      }
    )

    expect(result.ok).toBe(true)

    const memorySavedEvent = emittedEvents.find((event) => event.type === 'memory-saved')
    expect(memorySavedEvent).toBeTruthy()
    expect(memorySavedEvent?.messageText).toContain('已记住')
    expect(memorySavedEvent?.entries).toHaveLength(1)
    expect(memorySavedEvent?.entries?.[0]?.scope).toBe('user')
    expect(memorySavedEvent?.entries?.[0]?.source).toBe('manual')

    const storedMemories = await listChatMemories()
    expect(storedMemories).toHaveLength(1)
    expect(storedMemories[0]?.content).toBe('以后默认用中文回复')
    expect(storedMemories[0]?.source).toBe('manual')
  })

  it('does not reseed explicit memory-instruction turns into forked local sends', async () => {
    await appendLocalChatMessages({
      scopeKey: 'fingerprint-seeded-memory-turn',
      sessionId: 'seeded-memory-turn-session',
      agentId: 'main',
      model: 'openai/gpt-5.4-mini',
      transportSessionId: 'transport-seeded-memory-turn',
      messages: [
        {
          id: 'seeded-memory-user-1',
          role: 'user',
          text: '我们现在先做记忆功能基础版。',
          createdAt: 10_000,
          status: 'sent',
        },
        {
          id: 'seeded-memory-assistant-1',
          role: 'assistant',
          text: '收到，我会先聚焦记忆功能基础版。',
          createdAt: 10_001,
          status: 'sent',
          model: 'openai/gpt-5.4-mini',
        },
        {
          id: 'seeded-memory-user-2',
          role: 'user',
          text: '在这个会话里记住：本会话每次回复末尾加【会话A】',
          createdAt: 10_002,
          status: 'sent',
        },
        {
          id: 'seeded-memory-assistant-2',
          role: 'assistant',
          text: '明白了，我会在本会话后续回复末尾加上【会话A】。',
          createdAt: 10_003,
          status: 'sent',
          model: 'openai/gpt-5.4-mini',
        },
      ],
      updatedAt: 10_003,
    })

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '继续推进即可。',
        },
        model: 'openai/gpt-5.4-mini',
      }),
      stderr: '',
      code: 0,
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'seeded-memory-turn-session',
        text: '继续推进',
      },
      {
        discoverOpenClaw: createDiscovery('fingerprint-seeded-memory-turn'),
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    const transportCall = (transportRun.mock.calls as Array<unknown[]>)[0]?.[0] as
      | { messageText?: string }
      | undefined
    const messageText = String(transportCall?.messageText || '')

    expect(messageText).toContain('以下是当前对话最近的上下文')
    expect(messageText).toContain('我们现在先做记忆功能基础版。')
    expect(messageText).not.toContain('在这个会话里记住：本会话每次回复末尾加【会话A】')
    expect(messageText).not.toContain('明白了，我会在本会话后续回复末尾加上【会话A】。')
  })

  it('does not reseed assistant bootstrap garbage into forked local sends', async () => {
    await appendLocalChatMessages({
      scopeKey: 'fingerprint-seeded-bootstrap-noise',
      sessionId: 'seeded-bootstrap-noise-session',
      agentId: 'main',
      model: 'openai/gpt-5.4-mini',
      transportSessionId: 'transport-seeded-bootstrap-noise',
      messages: [
        {
          id: 'seeded-bootstrap-user-1',
          role: 'user',
          text: '你好',
          createdAt: 20_000,
          status: 'sent',
        },
        {
          id: 'seeded-bootstrap-assistant-1',
          role: 'assistant',
          text: [
            'Successfully wrote 74 bytes to memory/2026-04-23.md',
            '# BOOTSTRAP.md - Hello, World',
            'You just woke up. Time to figure out who you are.',
            'Good luck out there. Make it count.',
            '',
            '你好！我是你的 AI 助手。',
          ].join('\n'),
          createdAt: 20_001,
          status: 'sent',
          model: 'openai/gpt-5.4-mini',
        },
      ],
      updatedAt: 20_001,
    })

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '继续聊吧。',
        },
        model: 'openai/gpt-5.4-mini',
      }),
      stderr: '',
      code: 0,
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'seeded-bootstrap-noise-session',
        text: '继续',
      },
      {
        discoverOpenClaw: createDiscovery('fingerprint-seeded-bootstrap-noise'),
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    const transportCall = (transportRun.mock.calls as Array<unknown[]>)[0]?.[0] as
      | { messageText?: string }
      | undefined
    const messageText = String(transportCall?.messageText || '')

    expect(messageText).toContain('你好！我是你的 AI 助手。')
    expect(messageText).not.toContain('Successfully wrote 74 bytes to memory/2026-04-23.md')
    expect(messageText).not.toContain('BOOTSTRAP.md - Hello, World')
  })
})
  it('routes the /react command through local tools and saves the turn summary', async () => {
    vi.stubEnv('MCLAW_REACT_BASE_URL', 'http://127.0.0.1:8080/v1')
    vi.stubEnv('MCLAW_REACT_MODEL', 'test-model')
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: null, tool_calls: [{
        id: 'call-1', type: 'function', function: { name: 'count_characters', arguments: '{"text":"abc"}' },
      }] } }] }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '三个字符' } }] }))
    vi.stubGlobal('fetch', request)
    try {
      const result = await sendChatMessage({ sessionId: 'local-react', text: '/react 数一数 abc' }, {
        discoverOpenClaw: createDiscovery('fingerprint-react'),
      })
      expect(result.ok).toBe(true)
      expect(result.message?.text).toMatch(/三个字符\s+轨迹 [0-9a-f-]{36}/)
      expect(await buildChatMemoryContext({ sessionId: 'local-react', messageText: '继续' }))
        .toMatchObject({ prompt: expect.stringContaining('三个字符') })
      expect(request).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  })
