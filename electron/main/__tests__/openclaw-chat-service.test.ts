import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

import {
  buildDashboardChatAvailabilityFromStatus,
  clearChatTranscript,
  createChatSession,
  createLocalChatSession,
  getChatCapabilitySnapshot,
  getChatSessionDebugSnapshot,
  getDashboardChatAvailability,
  getChatTranscript,
  listChatSessions,
  listChatTraceEntries,
  patchChatSessionModel,
  parseAgentReplyOutput,
  resetDashboardChatAvailabilityTrackerForTests,
  sendChatMessage,
} from '../openclaw-chat-service'
import type { OpenClawCapabilities } from '../openclaw-capabilities'
import { executeAuthRoute } from '../openclaw-auth-executor'
import type { OpenClawAuthMethodDescriptor } from '../openclaw-auth-registry'
import { createOpenClawAuthRegistry } from '../openclaw-auth-registry'
import { appendLocalChatMessages } from '../qclaw-chat-store'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const { mkdtemp, mkdir, readFile, rm, writeFile } = fs.promises

vi.setConfig({
  testTimeout: 15_000,
  hookTimeout: 15_000,
})

const RETRYABLE_RM_CODES = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM'])

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
      const code = error && typeof error === 'object' && 'code' in error ? String((error.code || '')) : ''
      if (!RETRYABLE_RM_CODES.has(code) || attempt === 9) throw error
      await sleep(100 * (attempt + 1))
    }
  }
}

describe('openclaw chat service', () => {
  let userDataDir = ''

  const writeLegacyChatStore = async (store: Record<string, unknown>) => {
    const chatDir = path.join(userDataDir, 'chat')
    await mkdir(chatDir, { recursive: true })
    await writeFile(path.join(chatDir, 'transcripts.json'), JSON.stringify(store, null, 2), 'utf8')
  }

  const createDiscovery = (fingerprint: string) =>
    (async () =>
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
      }) as any)

  const createModelStatus = (defaultModel: string) =>
    ({
      ok: true,
      action: 'status',
      command: ['models', 'status', '--json'],
      stdout: '',
      stderr: '',
      code: 0,
      data: {
        defaultModel,
      },
    }) as any

  const createCapabilities = (
    overrides: Partial<OpenClawCapabilities['supports']> = {}
  ): OpenClawCapabilities =>
    ({
      version: 'OpenClaw 2026.3.23',
      discoveredAt: '2026-03-23T00:00:00.000Z',
      authRegistry: createOpenClawAuthRegistry({
        source: 'openclaw-internal-registry',
        providers: [],
      }),
      authRegistrySource: 'openclaw-internal-registry',
      authChoices: [],
      rootCommands: ['agent', 'models', 'plugins', 'onboard'],
      onboardFlags: [],
      modelsCommands: ['status'],
      modelsAuthCommands: [],
      pluginsCommands: [],
      commandFlags: {
        agent: ['--model'],
        'models status': ['--json'],
      },
      supports: {
        onboard: true,
        plugins: true,
        pluginsInstall: true,
        pluginsEnable: true,
        chatAgentModelFlag: true,
        chatGatewaySendModel: false,
        chatInThreadModelSwitch: true,
        modelsListAllJson: false,
        modelsStatusJson: true,
        modelsAuthLogin: false,
        modelsAuthAdd: false,
        modelsAuthPasteToken: false,
        modelsAuthSetupToken: false,
        modelsAuthOrder: false,
        modelsAuthLoginGitHubCopilot: false,
        aliases: false,
        fallbacks: false,
        imageFallbacks: false,
        modelsScan: false,
        ...overrides,
      },
    }) as OpenClawCapabilities

  const createLegacyCompatRuntimeReconcileStore = () =>
    ({
      version: 1,
      lastSeenOpenClawVersion: '2026.3.24',
      lastSeenVersionBand: 'openclaw_2026_3_23_to_2026_3_24',
      lastSeenAt: '2026-04-10T00:00:00.000Z',
      lastCompatibility: {
        status: 'steady_state',
        currentVersion: '2026.3.24',
        currentBand: 'openclaw_2026_3_23_to_2026_3_24',
        previousVersion: '2026.3.24',
        previousBand: 'openclaw_2026_3_23_to_2026_3_24',
        conservativeMode: true,
        warningCodes: [],
        summary: 'legacy pinned runtime',
        assessedAt: '2026-04-10T00:00:00.000Z',
      },
      runtime: {
        stateCode: 'degraded',
        desiredRevision: 2,
        appliedRevision: 1,
        pendingReasons: ['gateway_start_required'],
        lastMutationSource: 'gateway-bootstrap',
        blockingReason: 'control_ui_handshake_failed',
        blockingDetail: null,
        safeToRetry: true,
        lastReconcileAt: '2026-04-10T00:00:00.000Z',
        lastReconcileSummary: 'compat handshake degraded but port should still be reachable',
        lastActions: [],
      },
    }) as any

  const minimaxOauthMethod: OpenClawAuthMethodDescriptor = {
    authChoice: 'minimax-portal',
    label: 'OAuth 路 minimax-portal',
    kind: 'oauth',
    route: {
      kind: 'models-auth-login',
      providerId: 'minimax-portal',
      pluginId: 'minimax-portal-auth',
      requiresBrowser: true,
      extraOptions: [
        { id: 'oauth', label: 'Global' },
        { id: 'oauth-cn', label: 'CN' },
      ],
    },
  }

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
    if (userDataDir) {
      await removeWithRetry(userDataDir)
    }
    userDataDir = await mkdtemp(path.join(os.tmpdir(), 'qclaw-chat-service-'))
    process.env.QCLAW_USER_DATA_DIR = userDataDir
  })

  afterAll(() => {
    vi.resetConfig()
  })

  it('marks chat unavailable when no configured model is connected', () => {
    const availability = buildDashboardChatAvailabilityFromStatus({
      gatewayRunning: true,
      modelStatus: {
        ok: true,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: '',
        code: 0,
        data: {
          allowed: [],
        },
      },
    })

    expect(availability.ready).toBe(false)
    expect(availability.state).toBe('no-model')
    expect(availability.canSend).toBe(false)
    expect(availability.reason).toBe('no-configured-model')
  })

  it('keeps chat sendable when legacy OpenClaw lacks models status --json but saved models are known', () => {
    const availability = buildDashboardChatAvailabilityFromStatus({
      gatewayRunning: true,
      modelStatus: {
        ok: false,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: 'This OpenClaw build does not support models status --json.',
        code: 1,
        message: 'This OpenClaw build does not support models status --json.',
      } as any,
      connectedModelsOverride: ['custom-openai/deepseek-chat'],
      defaultModelOverride: 'custom-openai/deepseek-chat',
    })

    expect(availability.state).toBe('degraded')
    expect(availability.canSend).toBe(true)
    expect(availability.connectedModels).toEqual(['custom-openai/deepseek-chat'])
    expect(availability.defaultModel).toBe('custom-openai/deepseek-chat')
    expect(availability.message).toContain('已按已保存模型配置继续')
  })

  it('still reports offline when legacy OpenClaw lacks models status --json and the gateway is not running', () => {
    const availability = buildDashboardChatAvailabilityFromStatus({
      gatewayRunning: false,
      modelStatus: {
        ok: false,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: 'This OpenClaw build does not support models status --json.',
        code: 1,
        message: 'This OpenClaw build does not support models status --json.',
      } as any,
      connectedModelsOverride: ['custom-openai/deepseek-chat'],
      defaultModelOverride: 'custom-openai/deepseek-chat',
    })

    expect(availability.state).toBe('offline')
    expect(availability.canSend).toBe(false)
    expect(availability.connectedModels).toEqual(['custom-openai/deepseek-chat'])
  })

  it('treats openai-codex auth provider as compatible with openai/* model keys', () => {
    const availability = buildDashboardChatAvailabilityFromStatus({
      gatewayRunning: true,
      modelStatus: {
        ok: true,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: '',
        code: 0,
        data: {
          defaultModel: 'openai/gpt-5.1-codex',
          allowed: ['openai/gpt-5.1-codex'],
          auth: {
            providers: [
              {
                provider: 'openai-codex',
                status: 'ok',
              },
            ],
          },
        },
      },
    })

    expect(availability.ready).toBe(true)
    expect(availability.state).toBe('ready')
    expect(availability.canSend).toBe(true)
    expect(availability.connectedModels).toEqual(['openai/gpt-5.1-codex'])
  })

  it('treats google auth provider as compatible with gemini/* model keys', () => {
    const availability = buildDashboardChatAvailabilityFromStatus({
      gatewayRunning: true,
      modelStatus: {
        ok: true,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: '',
        code: 0,
        data: {
          defaultModel: 'gemini/gemini-2.5-pro',
          allowed: ['gemini/gemini-2.5-pro'],
          auth: {
            providers: [
              {
                provider: 'google',
                status: 'ok',
              },
            ],
          },
        },
      },
    })

    expect(availability.ready).toBe(true)
    expect(availability.state).toBe('ready')
    expect(availability.canSend).toBe(true)
    expect(availability.connectedModels).toEqual(['gemini/gemini-2.5-pro'])
  })

  it('reuses the models page visible catalog when building chat selectable models', async () => {
    gatewayHealthMock.mockResolvedValue({ running: true, raw: 'running' })
    readEnvFileMock.mockResolvedValue({
      GEMINI_API_KEY: 'google-local',
    })
    getModelStatusMock.mockResolvedValue({
      ok: true,
      action: 'status',
      command: ['models', 'status', '--json'],
      stdout: '',
      stderr: '',
      code: 0,
      data: {
        defaultModel: 'google/gemini-3-pro-preview',
        allowed: ['google/gemini-3-pro-preview'],
        auth: {
          providers: [{ provider: 'google', status: 'ok' }],
        },
      },
    })
    getModelCatalogMock.mockResolvedValue({
      total: 4,
      items: [
        { key: 'google/gemini-3-pro-preview', provider: 'google', available: true, name: 'Gemini 3 Pro Preview' },
        { key: 'google/gemini-2.5-pro', provider: 'google', available: true, name: 'Gemini 2.5 Pro' },
        { key: 'google/gemini-1.5-flash', provider: 'google', available: false, name: 'Gemini 1.5 Flash' },
        { key: 'xai/grok-4-fast-non-reasoning', provider: 'xai', available: true, name: 'Grok 4 Fast' },
      ],
      providers: ['google', 'xai'],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    const availability = await getDashboardChatAvailability()

    expect(availability.ready).toBe(true)
    expect(availability.state).toBe('ready')
    expect(availability.connectedModels).toEqual(['google/gemini-3-pro-preview'])
    expect(availability.defaultModel).toBe('google/gemini-3-pro-preview')
  })

  it('does not fall back to runtime allowed models when the models page catalog is intentionally empty', async () => {
    gatewayHealthMock.mockResolvedValue({ running: true, raw: 'running' })
    getModelStatusMock.mockResolvedValue({
      ok: true,
      action: 'status',
      command: ['models', 'status', '--json'],
      stdout: '',
      stderr: '',
      code: 0,
      data: {
        defaultModel: 'google/gemini-3-pro-preview',
        allowed: ['google/gemini-2.5-pro'],
        auth: {
          providers: [{ provider: 'google', status: 'ok' }],
        },
      },
    })
    getModelCatalogMock.mockResolvedValue({
      total: 0,
      items: [],
      providers: [],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    const availability = await getDashboardChatAvailability()

    expect(availability.state).toBe('no-model')
    expect(availability.connectedModels).toEqual([])
    expect(availability.canSend).toBe(false)
    expect(availability.defaultModel).toBe('google/gemini-3-pro-preview')
  })

  it('reuses saved configured snapshot models for chat availability when legacy models status is unsupported', async () => {
    gatewayHealthMock.mockResolvedValue({ running: true, raw: 'running' })
    readConfigMock.mockResolvedValue({
      agents: {
        defaults: {
          model: {
            primary: 'custom-openai/deepseek-chat',
          },
        },
      },
      models: {
        providers: {
          'custom-openai': {
            enabled: true,
            baseUrl: 'https://api.deepseek.com/v1',
            models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }],
          },
        },
      },
    })
    getModelStatusMock.mockResolvedValue({
      ok: false,
      action: 'status',
      command: ['models', 'status', '--json'],
      stdout: '',
      stderr: 'This OpenClaw build does not support models status --json.',
      code: 1,
      message: 'This OpenClaw build does not support models status --json.',
    })
    getModelCatalogMock.mockResolvedValue({
      total: 0,
      items: [],
      providers: [],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    const availability = await getDashboardChatAvailability()

    expect(availability.state).toBe('degraded')
    expect(availability.canSend).toBe(true)
    expect(availability.connectedModels).toEqual(['custom-openai/deepseek-chat'])
    expect(availability.defaultModel).toBe('custom-openai/deepseek-chat')
  })

  it('uses the saved configured default model when creating a direct chat session and legacy models status is unsupported', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-legacy-default-model')
    const callGatewayRpc = vi.fn(async () => ({
      sessionId: 'remote-legacy-session',
      sessionKey: 'agent:main:remote-legacy-session',
      agentId: 'main',
      model: 'custom-openai/deepseek-chat',
    }))

    readConfigMock.mockResolvedValue({
      agents: {
        defaults: {
          model: {
            primary: 'custom-openai/deepseek-chat',
          },
        },
      },
      models: {
        providers: {
          'custom-openai': {
            enabled: true,
            models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }],
          },
        },
      },
    })

    const session = await createChatSession({
      discoverOpenClaw,
      ensureGateway: async () => ({
        ok: true,
        stdout: '',
        stderr: '',
        code: 0,
        running: true,
      }),
      readModelStatus: async () =>
        ({
          ok: false,
          action: 'status',
          command: ['models', 'status', '--json'],
          stdout: '',
          stderr: 'This OpenClaw build does not support models status --json.',
          code: 1,
          message: 'This OpenClaw build does not support models status --json.',
        }) as any,
      callGatewayRpc,
    })

    expect(callGatewayRpc).toHaveBeenCalledWith(
      'sessions.create',
      {
        agentId: 'main',
        model: 'custom-openai/deepseek-chat',
      },
      20_000
    )
    expect(session.model).toBe('custom-openai/deepseek-chat')
    expect(session.selectedModel).toBe('custom-openai/deepseek-chat')
  })

  it('returns a conservative phase 0 chat capability snapshot', async () => {
    const snapshot = await getChatCapabilitySnapshot({
      loadCapabilities: async () =>
        createCapabilities({
          chatInThreadModelSwitch: true,
        }),
    })

    expect(snapshot.version).toBe('OpenClaw 2026.3.23')
    expect(snapshot.supportsSessionsPatch).toBe(true)
    expect(snapshot.supportsChatHistory).toBe(false)
    expect(snapshot.supportsGatewayChatSend).toBe(true)
    expect(snapshot.supportsGatewayRpc).toBe(true)
    expect(snapshot.notes.join(' ')).toContain('chat.history')
  })

  it('reports chat.history as available only when the history flag and capability gate are both enabled', async () => {
    const snapshot = await getChatCapabilitySnapshot({
      chatHistoryPrimaryEnabled: true,
      loadCapabilities: async () =>
        createCapabilities({
          chatGatewaySendModel: true,
        }),
    })

    expect(snapshot.supportsChatHistory).toBe(true)
  })

  it('builds a debug snapshot for a local cached session without upstream authority', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-debug-local')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-debug-local',
      sessionId: 'debug-local-session',
      agentId: 'main',
      model: 'openai/gpt-5.4-pro',
      selectedModel: 'openai/gpt-5.4-pro',
      transportSessionId: 'transport-debug-local',
      transportModel: 'openai/gpt-5.4-pro',
      kind: 'direct',
      messages: [
        {
          id: 'debug-local-msg-1',
          role: 'user',
          text: '鏈湴缂撳瓨娑堟伅',
          createdAt: 8_000,
          status: 'sent',
        },
      ],
      updatedAt: 8_000,
    })

    const snapshot = await getChatSessionDebugSnapshot('debug-local-session', {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(snapshot.requestedSessionId).toBe('debug-local-session')
    expect(snapshot.historySource).toBe('local-cache')
    expect(snapshot.authorityKind).toBe('local-cache-only')
    expect(snapshot.cachePresence).toBe('local-transcript')
    expect(snapshot.canContinue).toBe(false)
    expect(snapshot.legacySemanticsActive).toBe(true)
    expect(snapshot.notes.join(' ')).toContain('resolves from Qclaw local cache state without upstream authority')
    expect(snapshot.notes.join(' ')).toContain('Legacy transport/session fallback semantics')
  })

  it('migrates a legacy transport-derived sessionKey store entry into a conservative local cache record', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-store-migration-legacy')
    await writeLegacyChatStore({
      version: 2,
      sessions: [
        {
          scopeKey: 'fingerprint-store-migration-legacy',
          sessionId: 'legacy-session',
          sessionKey: 'agent:main:transport-legacy-session',
          agentId: 'main',
          model: 'zai/glm-5',
          selectedModel: 'openai/gpt-5.4-pro',
          transportSessionId: 'transport-legacy-session',
          transportModel: 'openai/gpt-5.4-pro',
          kind: 'direct',
          createdAt: 1_000,
          updatedAt: 1_100,
          messages: [
            {
              id: 'legacy-msg-1',
              role: 'user',
              text: '鏃х紦瀛樻秷鎭?',
              createdAt: 1_050,
              status: 'sent',
            },
          ],
        },
      ],
    })

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionKey).toBeUndefined()
    expect(sessions[0].selectedModel).toBe('zai/glm-5')
    expect(sessions[0].canPatchModel).toBe(false)
    expect(sessions[0].canContinue).toBe(false)
    expect(sessions[0].authorityKind).toBe('local-cache-only')

    const migratedStore = JSON.parse(
      await readFile(path.join(userDataDir, 'chat', 'transcripts.json'), 'utf8')
    ) as Record<string, any>
    expect(migratedStore.version).toBe(3)
    expect(migratedStore.sessions[0].sessionKey).toBeUndefined()
    expect(migratedStore.sessions[0].selectedModel).toBe('zai/glm-5')
    expect(migratedStore.sessions[0].transportModel).toBe('zai/glm-5')
  })

  it('does not invent transportSessionId when migrating an old store entry that never had one', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-store-migration-no-transport')
    await writeLegacyChatStore({
      version: 2,
      sessions: [
        {
          scopeKey: 'fingerprint-store-migration-no-transport',
          sessionId: 'legacy-no-transport',
          agentId: 'main',
          model: 'openai/gpt-5.4-pro',
          selectedModel: 'openai/gpt-5.4-pro',
          kind: 'direct',
          createdAt: 2_000,
          updatedAt: 2_100,
          messages: [
            {
              id: 'legacy-msg-2',
              role: 'assistant',
              text: '娌℃湁 transport 鐨勬棫璁板綍',
              createdAt: 2_050,
              status: 'sent',
            },
          ],
        },
      ],
    })

    const transcript = await getChatTranscript('legacy-no-transport', {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(transcript.sessionKey).toBeUndefined()
    expect(transcript.canPatchModel).toBe(false)
    expect(transcript.canContinue).toBe(false)
    expect(transcript.authorityKind).toBe('local-cache-only')

    const migratedStore = JSON.parse(
      await readFile(path.join(userDataDir, 'chat', 'transcripts.json'), 'utf8')
    ) as Record<string, any>
    expect(migratedStore.version).toBe(3)
    expect(migratedStore.sessions[0].transportSessionId).toBeUndefined()
  })

  it('preserves a trusted sessionKey while upgrading the store version', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-store-migration-trusted')
    await writeLegacyChatStore({
      version: 2,
      sessions: [
        {
          scopeKey: 'fingerprint-store-migration-trusted',
          sessionId: 'trusted-history',
          sessionKey: 'agent:main:history-direct-session',
          agentId: 'main',
          model: 'zai/glm-5',
          selectedModel: 'openai/gpt-5.4-pro',
          transportSessionId: 'transport-trusted-history',
          transportModel: 'zai/glm-5',
          kind: 'direct',
          createdAt: 3_000,
          updatedAt: 3_100,
          messages: [
            {
              id: 'legacy-msg-3',
              role: 'assistant',
              text: '鍙俊 sessionKey 鐨勬棫璁板綍',
              createdAt: 3_050,
              status: 'sent',
            },
          ],
        },
      ],
    })

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionKey).toBe('agent:main:history-direct-session')
    expect(sessions[0].selectedModel).toBe('openai/gpt-5.4-pro')

    const migratedStore = JSON.parse(
      await readFile(path.join(userDataDir, 'chat', 'transcripts.json'), 'utf8')
    ) as Record<string, any>
    expect(migratedStore.version).toBe(3)
    expect(migratedStore.sessions[0].sessionKey).toBe('agent:main:history-direct-session')
  })

  it('preserves the pending first-send model intent when migrating an empty local shell', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-store-migration-empty-shell')
    await writeLegacyChatStore({
      version: 2,
      sessions: [
        {
          scopeKey: 'fingerprint-store-migration-empty-shell',
          sessionId: 'legacy-empty-shell',
          agentId: 'main',
          selectedModel: 'openai/gpt-5.4-pro',
          transportModel: 'openai/gpt-5.4-pro',
          kind: 'direct',
          createdAt: 4_000,
          updatedAt: 4_100,
          messages: [],
        },
      ],
    })

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionKey).toBeUndefined()
    expect(sessions[0].selectedModel).toBe('openai/gpt-5.4-pro')
    expect(sessions[0].authorityKind).toBe('local-cache-only')

    const migratedStore = JSON.parse(
      await readFile(path.join(userDataDir, 'chat', 'transcripts.json'), 'utf8')
    ) as Record<string, any>
    expect(migratedStore.version).toBe(3)
    expect(migratedStore.sessions[0].selectedModel).toBe('openai/gpt-5.4-pro')
    expect(migratedStore.sessions[0].transportModel).toBe('openai/gpt-5.4-pro')
  })

  it('records transcript trace entries when returning local cached history', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-trace-transcript')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-trace-transcript',
      sessionId: 'trace-transcript-session',
      agentId: 'main',
      model: 'zai/glm-5',
      transportSessionId: 'transport-trace-transcript',
      transportModel: 'zai/glm-5',
      kind: 'direct',
      messages: [
        {
          id: 'trace-transcript-msg-1',
          role: 'assistant',
          text: '鏈湴鍘嗗彶',
          createdAt: 9_000,
          status: 'sent',
        },
      ],
      updatedAt: 9_000,
    })

    await getChatTranscript('trace-transcript-session', {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(listChatTraceEntries(1)).toEqual([
      expect.objectContaining({
        operation: 'transcript',
        stage: 'return-local-cache',
        sessionId: 'trace-transcript-session',
        historySource: 'local-cache',
      }),
    ])
  })

  it('records send trace entries for a successful local send flow', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-trace-send')
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '鍙戦€佸畬鎴?',
        },
        model: 'openai/gpt-5.4-pro',
      }),
      stderr: '',
      code: 0,
      streamedText: '鍙戦€佸畬鎴?',
      streamedModel: 'openai/gpt-5.4-pro',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'trace-send-session',
        text: '缁х画瀵硅瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
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
    expect(listChatTraceEntries(4)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'send',
          stage: 'start',
          sessionId: 'trace-send-session',
        }),
        expect.objectContaining({
          operation: 'send',
          stage: 'transport-run-ok',
          sessionId: 'trace-send-session',
        }),
        expect.objectContaining({
          operation: 'send',
          stage: 'succeeded',
          sessionId: 'trace-send-session',
        }),
      ])
    )
  }, 10_000)

  it('rejects concurrent chat sends before spawning a second transport run', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-send-singleflight')
    let resolveEnsureGateway: ((value: any) => void) | undefined
    const ensureGateway = vi.fn(() => new Promise<any>((resolve) => {
      resolveEnsureGateway = resolve
    }))
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: '第一条消息已完成',
      stderr: '',
      code: 0,
      streamedText: '第一条消息已完成',
    }))

    const sharedOptions = {
      discoverOpenClaw,
      readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
      ensureGateway,
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

    const firstPromise = sendChatMessage(
      {
        sessionId: 'singleflight-first',
        text: '第一条消息',
      },
      sharedOptions
    )

    await vi.waitFor(() => {
      expect(ensureGateway).toHaveBeenCalledTimes(1)
    }, { timeout: 10_000 })

    const secondResult = await sendChatMessage(
      {
        sessionId: 'singleflight-second',
        text: '第二条消息',
      },
      sharedOptions
    )

    expect(secondResult).toMatchObject({
      ok: false,
      sessionId: 'singleflight-second',
      errorCode: 'command-failed',
    })
    expect(secondResult.messageText).toContain('当前已有一条消息正在发送')
    expect(transportRun).toHaveBeenCalledTimes(0)

    expect(resolveEnsureGateway).toBeTypeOf('function')
    resolveEnsureGateway?.({
      ok: true,
      stdout: '',
      stderr: '',
      code: 0,
      running: true,
    })

    const firstResult = await firstPromise
    expect(firstResult.ok).toBe(true)
    expect(transportRun).toHaveBeenCalledTimes(1)
    expect(listChatTraceEntries(4)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'send',
          stage: 'transport-run-ok',
          sessionId: 'singleflight-first',
        }),
        expect.objectContaining({
          operation: 'send',
          stage: 'succeeded',
          sessionId: 'singleflight-first',
        }),
        expect.objectContaining({
          operation: 'send',
          stage: 'rejected-concurrent-send',
          sessionId: 'singleflight-second',
        }),
      ])
    )
  })

  it('repairs missing main auth profiles from other agent stores before sending', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-repair-main-auth-before-send')
    const repairMainAuthProfiles = vi.fn(async () => ({
      ok: true,
      repaired: true,
      authStorePath: '/Users/test/.openclaw/agents/main/agent/auth-profiles.json',
      importedProfileIds: ['zai:default'],
      importedProviders: ['zai'],
      sourceAuthStorePaths: ['/Users/test/.openclaw/agents/feishu-default/agent/auth-profiles.json'],
    }))
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '淇鍚庡彲鍙戦€?',
        },
        model: 'zai/glm-5-turbo',
      }),
      stderr: '',
      code: 0,
      streamedText: '淇鍚庡彲鍙戦€?',
      streamedModel: 'zai/glm-5-turbo',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'repair-main-auth-session',
        text: '缁х画鍙戦€?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () =>
          ({
            ok: true,
            action: 'status',
            command: ['models', 'status', '--json'],
            stdout: '',
            stderr: '',
            code: 0,
            data: {
              defaultModel: 'zai/glm-5-turbo',
              auth: {
                missingProvidersInUse: ['zai', 'xai'],
              },
            },
          }) as any,
        repairMainAuthProfiles: repairMainAuthProfiles as any,
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

    expect(repairMainAuthProfiles).toHaveBeenCalledWith(['zai', 'xai'])
    expect(result.ok).toBe(true)
  })

  it('repairs minimax auth into the session owning agent before sending', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-repair-owning-agent-auth-before-send')
    const repairAgentAuthProfiles = vi.fn(async () => ({
      ok: true,
      repaired: true,
      updatedAuthStorePaths: ['/Users/test/.openclaw/agents/channel-bot/agent/auth-profiles.json'],
      importedProfileIds: ['minimax-portal:default'],
      importedProviders: ['minimax-portal'],
      sourceAuthStorePaths: ['/Users/test/.openclaw/agents/channel-default/agent/auth-profiles.json'],
    }))
    const repairMainAuthProfiles = vi.fn(async () => ({
      ok: true,
      repaired: false,
      importedProfileIds: [],
      importedProviders: [],
      sourceAuthStorePaths: [],
    }))
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '淇鍚庡彲缁х画鍙戦€?',
        },
        model: 'minimax-portal/MiniMax-M2.5',
      }),
      stderr: '',
      code: 0,
      streamedText: '淇鍚庡彲缁х画鍙戦€?',
      streamedModel: 'minimax-portal/MiniMax-M2.5',
    }))

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-repair-owning-agent-auth-before-send',
      sessionId: 'channel-owned-session',
      agentId: 'channel-bot',
      model: 'minimax/MiniMax-M2.5',
      transportSessionId: 'transport-channel-owned-session',
      messages: [
        {
          id: 'msg-existing',
          role: 'user',
          text: '鏃ф秷鎭?',
          createdAt: 1_000,
          status: 'sent',
        },
      ],
      updatedAt: 1_000,
    })

    const result = await sendChatMessage(
      {
        sessionId: 'channel-owned-session',
        text: '缁х画褰撳墠浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () =>
          ({
            ok: true,
            action: 'status',
            command: ['models', 'status', '--json'],
            stdout: '',
            stderr: '',
            code: 0,
            data: {
              defaultModel: 'minimax/MiniMax-M2.5',
              allowed: ['minimax-portal/MiniMax-M2.5'],
              auth: {
                missingProvidersInUse: ['minimax'],
                oauth: {
                  providers: [{ provider: 'minimax-portal', status: 'ok' }],
                },
              },
            },
          }) as any,
        repairAgentAuthProfiles: repairAgentAuthProfiles as any,
        repairMainAuthProfiles: repairMainAuthProfiles as any,
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

    expect(repairAgentAuthProfiles).toHaveBeenCalledWith({
      providerIds: ['minimax', 'minimax-portal'],
      agentId: 'channel-bot',
    })
    expect(repairMainAuthProfiles).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it('keeps non-minimax auth repair on the main store and does not switch to agent repair', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-repair-openai-provider-only-before-send')
    const repairAgentAuthProfiles = vi.fn(async () => ({
      ok: true,
      repaired: false,
      updatedAuthStorePaths: [],
      importedProfileIds: [],
      importedProviders: [],
      sourceAuthStorePaths: [],
    }))
    const repairMainAuthProfiles = vi.fn(async () => ({
      ok: true,
      repaired: false,
      importedProfileIds: [],
      importedProviders: [],
      sourceAuthStorePaths: [],
    }))
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '姝ｅ父鍙戦€?',
        },
        model: 'openai/gpt-5.4',
      }),
      stderr: '',
      code: 0,
      streamedText: '姝ｅ父鍙戦€?',
      streamedModel: 'openai/gpt-5.4',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'repair-openai-provider-only-session',
        text: '缁х画褰撳墠浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () =>
          ({
            ok: true,
            action: 'status',
            command: ['models', 'status', '--json'],
            stdout: '',
            stderr: '',
            code: 0,
            data: {
              defaultModel: 'openai/gpt-5.4',
              allowed: ['openai/gpt-5.4'],
              auth: {
                missingProvidersInUse: ['openai'],
                providers: [{ provider: 'openai-codex', status: 'ok' }],
              },
            },
          }) as any,
        repairAgentAuthProfiles: repairAgentAuthProfiles as any,
        repairMainAuthProfiles: repairMainAuthProfiles as any,
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

    expect(repairAgentAuthProfiles).not.toHaveBeenCalled()
    expect(repairMainAuthProfiles).toHaveBeenCalledWith(['openai'])
    expect(result.ok).toBe(true)
  })

  it('returns degraded for a transient gateway health failure after a recent healthy snapshot', async () => {
    readEnvFileMock.mockResolvedValue({
      OPENAI_API_KEY: 'sk-openai',
    })
    getModelCatalogMock.mockResolvedValue({
      total: 1,
      items: [
        { key: 'openai/gpt-5.4-pro', provider: 'openai', available: true, name: 'GPT-5.4 Pro' },
      ],
      providers: ['openai'],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    const healthy = await getDashboardChatAvailability({
      now: () => 10_000,
      getGatewayHealth: async () => ({
        running: true,
        raw: '',
      }),
      readModelStatus: async () =>
        ({
          ok: true,
          action: 'status',
          command: ['models', 'status', '--json'],
          stdout: '',
          stderr: '',
          code: 0,
          data: {
            defaultModel: 'openai/gpt-5.4-pro',
            allowed: ['openai/gpt-5.4-pro'],
            auth: {
              providers: [{ provider: 'openai', status: 'ok' }],
            },
          },
        }) as any,
    })

    expect(healthy.state).toBe('ready')

    const degraded = await getDashboardChatAvailability({
      now: () => 12_000,
      getGatewayHealth: async () => ({
        running: false,
        raw: '',
      }),
      readModelStatus: async () =>
        ({
          ok: true,
          action: 'status',
          command: ['models', 'status', '--json'],
          stdout: '',
          stderr: '',
          code: 0,
          data: {
            defaultModel: 'openai/gpt-5.4-pro',
            allowed: ['openai/gpt-5.4-pro'],
            auth: {
              providers: [{ provider: 'openai', status: 'ok' }],
            },
          },
        }) as any,
    })

    expect(degraded.state).toBe('degraded')
    expect(degraded.canSend).toBe(true)
    expect(degraded.reason).toBe('gateway-offline')
    expect(degraded.connectedModels).toEqual(['openai/gpt-5.4-pro'])
  })

  it('treats legacy runtime reconcile compatibility mode as running only after the socket probe succeeds', async () => {
    readEnvFileMock.mockResolvedValue({
      OPENAI_API_KEY: 'sk-openai',
    })
    getModelCatalogMock.mockResolvedValue({
      total: 1,
      items: [
        { key: 'openai/gpt-5.4-pro', provider: 'openai', available: true, name: 'GPT-5.4 Pro' },
      ],
      providers: ['openai'],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    const availability = await getDashboardChatAvailability({
      now: () => 20_000,
      getGatewayHealth: async () => ({
        running: false,
        raw: '',
      }),
      readRuntimeReconcileState: async () => createLegacyCompatRuntimeReconcileStore(),
      readModelStatus: async () =>
        ({
          ok: true,
          action: 'status',
          command: ['models', 'status', '--json'],
          stdout: '',
          stderr: '',
          code: 0,
          data: {
            defaultModel: 'openai/gpt-5.4-pro',
            allowed: ['openai/gpt-5.4-pro'],
            auth: {
              providers: [{ provider: 'openai', status: 'ok' }],
            },
          },
        }) as any,
    })

    expect(availability.state).toBe('ready')
    expect(availability.canSend).toBe(true)
    expect(availability.gatewayRunning).toBe(true)
    expect(availability.connectedModels).toContain('openai/gpt-5.4-pro')
  })

  it('keeps chat availability degraded when legacy runtime reconcile exists but the socket probe still fails', async () => {
    probeGatewaySocketReadyMock.mockResolvedValueOnce(false)
    readEnvFileMock.mockResolvedValue({
      OPENAI_API_KEY: 'sk-openai',
    })
    getModelCatalogMock.mockResolvedValue({
      total: 1,
      items: [
        { key: 'openai/gpt-5.4-pro', provider: 'openai', available: true, name: 'GPT-5.4 Pro' },
      ],
      providers: ['openai'],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    const availability = await getDashboardChatAvailability({
      now: () => 21_000,
      getGatewayHealth: async () => ({
        running: false,
        raw: '',
      }),
      readRuntimeReconcileState: async () => createLegacyCompatRuntimeReconcileStore(),
      readModelStatus: async () =>
        ({
          ok: true,
          action: 'status',
          command: ['models', 'status', '--json'],
          stdout: '',
          stderr: '',
          code: 0,
          data: {
            defaultModel: 'openai/gpt-5.4-pro',
            allowed: ['openai/gpt-5.4-pro'],
            auth: {
              providers: [{ provider: 'openai', status: 'ok' }],
            },
          },
        }) as any,
    })

    expect(availability.gatewayRunning).toBe(false)
    expect(availability.state).toBe('degraded')
    expect(availability.canSend).toBe(true)
  })

  it('prefers upstream control ui model status over cli model status for chat availability', async () => {
    readEnvFileMock.mockResolvedValue({
      MINIMAX_API_KEY: 'mm-local',
    })
    getModelCatalogMock.mockResolvedValue({
      total: 1,
      items: [
        { key: 'minimax-portal/MiniMax-M2.5', provider: 'minimax-portal', available: true, name: 'MiniMax M2.5' },
      ],
      providers: ['minimax-portal'],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    getModelStatusMock.mockResolvedValue({
      ok: true,
      action: 'status',
      command: ['models', 'status', '--json'],
      stdout: '',
      stderr: '',
      code: 0,
      data: {
        defaultModel: 'minimax/MiniMax-M2.1',
        allowed: ['minimax/MiniMax-M2.1'],
        auth: {
          providers: [{ provider: 'minimax', status: 'ok' }],
        },
      },
    })
    getOpenClawUpstreamModelStateMock.mockResolvedValue({
      ok: true,
      source: 'control-ui-app',
      fallbackUsed: false,
      diagnostics: {
        upstreamAvailable: true,
        connected: true,
        hasClient: true,
        hasHelloSnapshot: true,
        hasHealthResult: false,
        hasSessionsState: false,
        hasModelCatalogState: false,
        appKeys: [],
      },
      data: {
        source: 'control-ui-app',
        connected: true,
        hasClient: true,
        appKeys: [],
        modelStatusLike: {
          defaultModel: 'minimax-portal/MiniMax-M2.5',
          allowed: ['minimax-portal/MiniMax-M2.5'],
          auth: {
            oauth: {
              providers: [{ provider: 'minimax-portal', status: 'ok' }],
            },
          },
        },
      },
    })

    const availability = await getDashboardChatAvailability({
      now: () => 100_000,
      getGatewayHealth: async () => ({
        running: true,
        raw: '',
      }),
    })

    expect(availability.state).toBe('ready')
    expect(availability.connectedModels).toEqual(['minimax-portal/MiniMax-M2.5'])
    expect(availability.defaultModel).toBe('minimax-portal/MiniMax-M2.5')
    expect(getModelStatusMock).not.toHaveBeenCalled()
  })

  it('reuses a short-lived cached upstream status for repeated chat availability polls', async () => {
    readEnvFileMock.mockResolvedValue({
      OPENAI_API_KEY: 'sk-openai',
    })
    getModelCatalogMock.mockResolvedValue({
      total: 1,
      items: [
        { key: 'openai/gpt-5.4-pro', provider: 'openai', available: true, name: 'GPT-5.4 Pro' },
      ],
      providers: ['openai'],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    getOpenClawUpstreamModelStateMock.mockResolvedValue({
      ok: true,
      source: 'control-ui-app',
      fallbackUsed: false,
      diagnostics: {
        upstreamAvailable: true,
        connected: true,
        hasClient: true,
        hasHelloSnapshot: true,
        hasHealthResult: false,
        hasSessionsState: false,
        hasModelCatalogState: false,
        appKeys: [],
      },
      data: {
        source: 'control-ui-app',
        connected: true,
        hasClient: true,
        appKeys: [],
        modelStatusLike: {
          defaultModel: 'openai/gpt-5.4-pro',
          allowed: ['openai/gpt-5.4-pro'],
          auth: {
            providers: [{ provider: 'openai', status: 'ok' }],
          },
        },
      },
    })

    const first = await getDashboardChatAvailability({
      now: () => 5_000,
      getGatewayHealth: async () => ({
        running: true,
        raw: '',
      }),
    })
    const second = await getDashboardChatAvailability({
      now: () => 6_000,
      getGatewayHealth: async () => ({
        running: true,
        raw: '',
      }),
    })

    expect(first.state).toBe('ready')
    expect(second.state).toBe('ready')
    expect(getOpenClawUpstreamModelStateMock).toHaveBeenCalledTimes(1)
  })

  it('reuses a short-lived cached selectable model catalog for repeated chat availability polls', async () => {
    getOpenClawUpstreamModelStateMock.mockResolvedValue({
      ok: true,
      source: 'control-ui-app',
      fallbackUsed: false,
      diagnostics: {
        upstreamAvailable: true,
        connected: true,
        hasClient: true,
        hasHelloSnapshot: true,
        hasHealthResult: false,
        hasSessionsState: false,
        hasModelCatalogState: false,
        appKeys: [],
      },
      data: {
        source: 'control-ui-app',
        connected: true,
        hasClient: true,
        appKeys: [],
        modelStatusLike: {
          defaultModel: 'openai/gpt-5.4-pro',
          allowed: ['openai/gpt-5.4-pro'],
          auth: {
            providers: [{ provider: 'openai', status: 'ok' }],
          },
        },
      },
    })
    readConfigMock.mockResolvedValue({
      defaultModel: 'openai/gpt-5.4-pro',
      models: {
        openai: {
          enabled: true,
        },
      },
    })
    getModelCatalogMock.mockResolvedValue({
      total: 1,
      items: [
        { key: 'openai/gpt-5.4-pro', provider: 'openai', available: true, name: 'GPT-5.4 Pro' },
      ],
      providers: ['openai'],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    const first = await getDashboardChatAvailability({
      now: () => 5_000,
      getGatewayHealth: async () => ({
        running: true,
        raw: '',
      }),
    })
    const second = await getDashboardChatAvailability({
      now: () => 6_000,
      getGatewayHealth: async () => ({
        running: true,
        raw: '',
      }),
    })

    expect(first.state).toBe('ready')
    expect(second.state).toBe('ready')
    expect(getModelCatalogMock).toHaveBeenCalledTimes(1)
    expect(readConfigMock).toHaveBeenCalledTimes(2)
    expect(readEnvFileMock).toHaveBeenCalledTimes(2)
  })

  it('refreshes selectable models immediately when the current model status changes within the cache ttl', async () => {
    const readModelStatus = vi
      .fn<() => Promise<any>>()
      .mockResolvedValueOnce({
        ok: true,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: '',
        code: 0,
        data: {
          defaultModel: 'openai/gpt-5.4-pro',
          allowed: ['openai/gpt-5.4-pro'],
          auth: {
            providers: [{ provider: 'openai', status: 'ok' }],
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: '',
        code: 0,
        data: {
          defaultModel: 'zai/glm-5',
          allowed: ['zai/glm-5'],
          auth: {
            providers: [{ provider: 'zai', status: 'ok' }],
          },
        },
      })

    let catalogCallCount = 0
    getModelCatalogMock.mockImplementation(async () => {
      catalogCallCount += 1
      if (catalogCallCount === 1) {
        return {
          total: 1,
          items: [
            { key: 'openai/gpt-5.4-pro', provider: 'openai', available: true, name: 'GPT-5.4 Pro' },
          ],
          providers: ['openai'],
          updatedAt: '2026-03-26T00:00:00.000Z',
          source: 'cache',
          stale: false,
        }
      }

      return {
        total: 1,
        items: [{ key: 'zai/glm-5', provider: 'zai', available: true, name: 'GLM-5' }],
        providers: ['zai'],
        updatedAt: '2026-03-26T00:00:05.000Z',
        source: 'cache',
        stale: false,
      }
    })
    readConfigMock
      .mockResolvedValueOnce({
        defaultModel: 'openai/gpt-5.4-pro',
        models: {
          openai: {
            enabled: true,
          },
        },
      })
      .mockResolvedValueOnce({
        defaultModel: 'zai/glm-5',
        models: {
          zai: {
            enabled: true,
          },
        },
      })

    const first = await getDashboardChatAvailability({
      now: () => 5_000,
      readModelStatus,
      getGatewayHealth: async () => ({
        running: true,
        raw: '',
      }),
    })
    const second = await getDashboardChatAvailability({
      now: () => 6_000,
      readModelStatus,
      getGatewayHealth: async () => ({
        running: true,
        raw: '',
      }),
    })

    expect(first.connectedModels).toEqual(['openai/gpt-5.4-pro'])
    expect(second.connectedModels).toEqual(['zai/glm-5'])
    expect(getModelCatalogMock).toHaveBeenCalledTimes(2)
    expect(readConfigMock).toHaveBeenCalledTimes(2)
    expect(readEnvFileMock).toHaveBeenCalledTimes(2)
  })

  it('returns offline after repeated gateway health failures exceed the threshold', async () => {
    readEnvFileMock.mockResolvedValue({
      OPENAI_API_KEY: 'sk-openai',
    })
    getModelCatalogMock.mockResolvedValue({
      total: 1,
      items: [
        { key: 'openai/gpt-5.4-pro', provider: 'openai', available: true, name: 'GPT-5.4 Pro' },
      ],
      providers: ['openai'],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })

    const firstFailure = await getDashboardChatAvailability({
      now: () => 40_000,
      getGatewayHealth: async () => ({
        running: false,
        raw: '',
      }),
      readModelStatus: async () =>
        ({
          ok: true,
          action: 'status',
          command: ['models', 'status', '--json'],
          stdout: '',
          stderr: '',
          code: 0,
          data: {
            defaultModel: 'openai/gpt-5.4-pro',
            allowed: ['openai/gpt-5.4-pro'],
            auth: {
              providers: [{ provider: 'openai', status: 'ok' }],
            },
          },
        }) as any,
    })

    expect(firstFailure.state).toBe('degraded')

    const offline = await getDashboardChatAvailability({
      now: () => 60_000,
      getGatewayHealth: async () => ({
        running: false,
        raw: '',
      }),
      readModelStatus: async () =>
        ({
          ok: true,
          action: 'status',
          command: ['models', 'status', '--json'],
          stdout: '',
          stderr: '',
          code: 0,
          data: {
            defaultModel: 'openai/gpt-5.4-pro',
            allowed: ['openai/gpt-5.4-pro'],
            auth: {
              providers: [{ provider: 'openai', status: 'ok' }],
            },
          },
        }) as any,
    })

    expect(offline.state).toBe('offline')
    expect(offline.canSend).toBe(false)
    expect(offline.reason).toBe('gateway-offline')
  })

  it('treats google-gemini-cli auth provider as compatible with google/* model keys', () => {
    const availability = buildDashboardChatAvailabilityFromStatus({
      gatewayRunning: true,
      modelStatus: {
        ok: true,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: '',
        code: 0,
        data: {
          defaultModel: 'google/gemini-2.5-pro',
          allowed: ['google/gemini-2.5-pro'],
          auth: {
            providers: [
              {
                provider: 'google-gemini-cli',
                status: 'ok',
              },
            ],
          },
        },
      },
    })

    expect(availability.ready).toBe(true)
    expect(availability.connectedModels).toEqual(['google/gemini-2.5-pro'])
  })

  it('treats minimax-portal auth provider as compatible with minimax/* model keys', () => {
    const availability = buildDashboardChatAvailabilityFromStatus({
      gatewayRunning: true,
      modelStatus: {
        ok: true,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: '',
        code: 0,
        data: {
          defaultModel: 'minimax/minimax-m2',
          allowed: ['minimax/minimax-m2'],
          auth: {
            providers: [
              {
                provider: 'minimax-portal',
                status: 'ok',
              },
            ],
          },
        },
      },
    })

    expect(availability.ready).toBe(true)
    expect(availability.connectedModels).toEqual(['minimax/minimax-m2'])
  })

  it('reconciles a stale minimax default model onto the connected minimax-portal runtime key', () => {
    const availability = buildDashboardChatAvailabilityFromStatus({
      gatewayRunning: true,
      modelStatus: {
        ok: true,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: '',
        code: 0,
        data: {
          defaultModel: 'minimax/MiniMax-M2.7-highspeed',
          allowed: ['minimax-portal/MiniMax-M2.7-highspeed', 'minimax-portal/MiniMax-M2.5'],
          auth: {
            oauth: {
              providers: [{ provider: 'minimax-portal', status: 'ok' }],
            },
            missingProvidersInUse: ['minimax'],
          },
        },
      },
    })

    expect(availability.ready).toBe(true)
    expect(availability.defaultModel).toBe('minimax-portal/MiniMax-M2.7-highspeed')
    expect(availability.connectedModels).toEqual([
      'minimax-portal/MiniMax-M2.5',
      'minimax-portal/MiniMax-M2.7-highspeed',
    ])
  })

  it('extracts nested assistant text from json output', () => {
    const parsed = parseAgentReplyOutput(
      JSON.stringify({
        result: {
          response: {
            content: '浣犲ソ锛屾垜宸茬粡杩炴帴濂戒簡銆?',
          },
        },
        model: 'openai/gpt-5.1-codex',
      })
    )

    expect(parsed.text).toBe('浣犲ソ锛屾垜宸茬粡杩炴帴濂戒簡銆?' )
    expect(parsed.model).toBe('openai/gpt-5.1-codex')
  })

  it('preserves explicit json response bodies from assistant text fields', () => {
    const parsed = parseAgentReplyOutput(
      JSON.stringify({
        response: {
          text: '{"command":"npm test","workdir":"/repo"}',
        },
        model: 'openai/gpt-5.1-codex',
      })
    )

    expect(parsed.text).toBe('{"command":"npm test","workdir":"/repo"}')
    expect(parsed.model).toBe('openai/gpt-5.1-codex')
  })

  it('ignores structured tool payloads when parsing assistant json output', () => {
    const parsed = parseAgentReplyOutput(
      JSON.stringify({
        command: 'curl -s "wttr.in/Shenzhen?format=%C"',
        workdir: '/Users/test/.openclaw/workspace',
        yieldMs: 10_000,
        timeout: 20,
      })
    )

    expect(parsed.text).toBeNull()
  })

  it('ignores stringified tool payloads when parsing assistant json output', () => {
    const parsed = parseAgentReplyOutput(
      JSON.stringify('{"path":"~/homebrew/lib/node_modules/openclaw/skills/weather/SKILL.md"}')
    )

    expect(parsed.text).toBeNull()
  })

  it('does not append placeholder tool paths like dot or relative markdown files to assistant text', () => {
    const parsed = parseAgentReplyOutput(
      JSON.stringify({
        response: {
          text: 'Screenshot captured.',
        },
        path: '.',
        toolMessages: [
          {
            role: 'toolresult',
            path: 'BOOTSTRAP.md',
          },
        ],
      })
    )

    expect(parsed.text).toBe('Screenshot captured.')
    expect(parsed.images).toBeUndefined()
  })

  it('keeps image-only assistant payloads from structured tool messages', () => {
    const parsed = parseAgentReplyOutput(
      JSON.stringify({
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'image',
                mimeType: 'image/png',
                data: 'ZmFrZS1pbWFnZQ==',
              },
            ],
          },
        ],
      })
    )

    expect(parsed.text).toBeNull()
    expect(parsed.images).toEqual([
      {
        url: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
        mimeType: 'image/png',
      },
    ])
  })

  it('keeps image-only assistant payloads from control-ui image blocks', () => {
    const parsed = parseAgentReplyOutput(
      JSON.stringify({
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'image',
                props: {
                  url: 'data:image/png;base64,Y29udHJvbC11aS1pbWFnZQ==',
                  alt: 'browser screenshot',
                },
              },
            ],
          },
        ],
      })
    )

    expect(parsed.text).toBeNull()
    expect(parsed.images).toEqual([
      {
        url: 'data:image/png;base64,Y29udHJvbC11aS1pbWFnZQ==',
        mimeType: 'image/png',
      },
    ])
  })

  it('ignores non-image urls that are mislabeled as chat image blocks', () => {
    const parsed = parseAgentReplyOutput(
      JSON.stringify({
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'image',
                props: {
                  url: 'https://example.com/search/guangzhou.html',
                  alt: 'search result page',
                },
              },
            ],
          },
        ],
        response: {
          text: '已完成整理。',
        },
      })
    )

    expect(parsed.text).toBe('已完成整理。')
    expect(parsed.images).toBeUndefined()
  })

  it('extracts embedded raw image payloads from assistant text without leaking base64', () => {
    const jpegPayload = `/9j/${'A'.repeat(640)}`
    const parsed = parseAgentReplyOutput(
      JSON.stringify({
        response: {
          text: `已完成截图：${jpegPayload}`,
        },
      })
    )

    expect(parsed.text).toBe('已完成截图')
    expect(parsed.images).toEqual([
      {
        url: `data:image/jpeg;base64,${jpegPayload}`,
        mimeType: 'image/jpeg',
      },
    ])
  })

  it('turns saved image file paths into assistant image attachments', async () => {
    const imagePath = path.join(os.tmpdir(), `mclaw-inline-${Date.now()}.png`)
    const imageBuffer = Buffer.from('fake-inline-image')
    await writeFile(imagePath, imageBuffer)

    try {
      const parsed = parseAgentReplyOutput(
        JSON.stringify({
          messages: [
            {
              role: 'toolresult',
              path: imagePath,
            },
          ],
        })
      )

      expect(parsed.images).toEqual([
        {
          url: `data:image/png;base64,${imageBuffer.toString('base64')}`,
          mimeType: 'image/png',
        },
      ])
      expect(parsed.text).toContain(imagePath)
    } finally {
      await rm(imagePath, { force: true })
    }
  })

  it('appends verified tool path status when a reported saved file is missing', () => {
    const missingPath = path.join(os.tmpdir(), `mclaw-missing-${Date.now()}.txt`)
    const parsed = parseAgentReplyOutput(
      JSON.stringify({
        response: {
          text: 'saved the file',
        },
        messages: [
          {
            role: 'tool',
            path: missingPath,
          },
        ],
      })
    )

    expect(parsed.text).toContain('saved the file')
    expect(parsed.text).toContain(missingPath)
    expect(parsed.text).not.toBe('saved the file')
  })

  it('persists chat transcript after a successful send', async () => {
    const sessionId = 'session-1'
    const emittedEvents: string[] = []
    const discoverOpenClaw = async () =>
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
            installFingerprint: 'fingerprint-1',
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

    const result = await sendChatMessage(
      {
        sessionId,
        text: '浣犲ソ',
      },
      {
        discoverOpenClaw,
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async (_args, streamOptions) => {
          streamOptions?.onStdout?.(
            `${JSON.stringify({ type: 'response.delta', delta: '你好，' })}\n`
          )
          streamOptions?.onStdout?.(
            `${JSON.stringify({ type: 'response.delta', delta: '我在。', model: 'openai/gpt-5.1-codex' })}\n`
          )
          return {
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '浣犲ソ锛屾垜鍦ㄣ€?',
              },
              model: 'openai/gpt-5.1-codex',
              usage: {
                promptTokens: 11,
                completionTokens: 10,
                totalTokens: 21,
              },
            }),
            stderr: '',
            code: 0,
          }
        },
        now: () => 1_000,
        emit: (event) => emittedEvents.push(event.type),
      }
    )

    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.message?.text).toBe('浣犲ソ锛屾垜鍦ㄣ€?' )
    expect(result.message?.usage?.totalTokens).toBe(21)
    expect(emittedEvents).toEqual(['assistant-start', 'assistant-delta', 'assistant-delta', 'assistant-complete'])

    const transcript = await getChatTranscript(sessionId, {
      discoverOpenClaw,
    })

    expect(transcript.hasLocalTranscript).toBe(true)
    expect(transcript.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(transcript.messages[0].text).toBe('浣犲ソ')
    expect(transcript.messages[1].text).toBe('浣犲ソ锛屾垜鍦ㄣ€?' )
    expect(transcript.messages[1].usage?.totalTokens).toBe(21)
  })

  it('does not create a local empty session when gateway ensure fails before send starts', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-gateway-offline-no-session')

    const result = await sendChatMessage(
      {
        sessionId: 'offline-before-send',
        text: '杩欐潯娑堟伅涓嶅簲鍒涘缓绌轰細璇?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.1-codex'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: false,
          stdout: '',
          stderr: 'gateway offline',
          code: 1,
          running: false,
        }),
      }
    )

    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('gateway-offline')

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toEqual([])
  })

  it('continues direct chat send when gateway ensure is stale but a health recheck is already healthy', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-gateway-health-recheck')
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '鍋ュ悍澶嶆鍚庡彂閫佹垚鍔?',
        },
        model: 'custom-openai/deepseek-chat',
      }),
      stderr: '',
      code: 0,
      streamedText: '鍋ュ悍澶嶆鍚庡彂閫佹垚鍔?',
      streamedModel: 'custom-openai/deepseek-chat',
    }))
    const getGatewayHealth = vi.fn(async () => ({
      running: true,
      raw: '{"ok":true}',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'gateway-health-recheck-session',
        text: '璇风户缁?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('custom-openai/deepseek-chat'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: false,
          stdout: '',
          stderr: 'Gateway 鍚姩鍛戒护宸叉墽琛岋紝浣嗙郴缁熶粛鏈‘璁ょ綉鍏冲凡缁忓噯澶囧畬鎴?',
          code: 1,
          running: false,
        }),
        getGatewayHealth,
        callGatewayRpc: async (method) => {
          expect(method).toBe('sessions.create')
          return {
            sessionId: 'upstream-session-gateway-health-recheck',
            sessionKey: 'gateway-health-recheck-key',
            agentId: 'main',
            model: 'custom-openai/deepseek-chat',
          }
        },
        chatTransport: {
          run: transportRun,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(getGatewayHealth).toHaveBeenCalledTimes(1)
    expect(transportRun).toHaveBeenCalledTimes(1)
  })

  it('continues direct chat send when runtime reconcile, port probe, and socket probe confirm legacy compat mode', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-gateway-runtime-compat')
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '鍏煎妯″紡鍙戦€佹垚鍔?',
        },
        model: 'custom-openai/deepseek-chat',
      }),
      stderr: '',
      code: 0,
      streamedText: '鍏煎妯″紡鍙戦€佹垚鍔?',
      streamedModel: 'custom-openai/deepseek-chat',
    }))
    const probeGatewayPortReachable = vi.fn(async (port?: number) => {
      expect(port).toBe(7788)
      return true
    })
    const probeGatewaySocketReady = vi.fn(async () => true)

    const result = await sendChatMessage(
      {
        sessionId: 'gateway-runtime-compat-session',
        text: '璇风户缁?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('custom-openai/deepseek-chat'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: false,
          stdout: '',
          stderr: 'Gateway 鍚姩鍛戒护宸叉墽琛岋紝浣嗙郴缁熶粛鏈‘璁ょ綉鍏冲凡缁忓噯澶囧畬鎴?',
          code: 1,
          running: false,
        }),
        getGatewayHealth: async () => ({
          running: false,
          raw: '{"ok":false}',
        }),
        readRuntimeReconcileState: async () => createLegacyCompatRuntimeReconcileStore(),
        readConfiguredGatewayPort: async () => 7788,
        probeGatewayPortReachable,
        probeGatewaySocketReady,
        callGatewayRpc: async (method) => {
          expect(method).toBe('sessions.create')
          return {
            sessionId: 'upstream-session-runtime-compat',
            sessionKey: 'runtime-compat-key',
            agentId: 'main',
            model: 'custom-openai/deepseek-chat',
          }
        },
        chatTransport: {
          run: transportRun,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(probeGatewayPortReachable).toHaveBeenCalledTimes(1)
    expect(probeGatewaySocketReady).toHaveBeenCalledTimes(1)
    expect(transportRun).toHaveBeenCalledTimes(1)
  })

  it('does not continue direct chat send when legacy compat mode only reaches the port but not the socket RPC', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-gateway-runtime-compat-failed-socket')
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: '',
      stderr: '',
      code: 0,
      streamedText: 'unexpected',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'gateway-runtime-compat-session',
        text: '璇风户缁?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('custom-openai/deepseek-chat'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: false,
          stdout: '',
          stderr: 'Gateway 鍚姩鍛戒护宸叉墽琛岋紝浣嗙郴缁熶粛鏈‘璁ょ綉鍏冲凡缁忓噯澶囧畬鎴?',
          code: 1,
          running: false,
        }),
        getGatewayHealth: async () => ({
          running: false,
          raw: '{"ok":false}',
        }),
        readRuntimeReconcileState: async () => createLegacyCompatRuntimeReconcileStore(),
        readConfiguredGatewayPort: async () => 7788,
        probeGatewayPortReachable: async () => true,
        probeGatewaySocketReady: async () => false,
        chatTransport: {
          run: transportRun,
        },
      }
    )

    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('gateway-offline')
    expect(transportRun).not.toHaveBeenCalled()
  })

  it('falls back to CLI send for a local shell when gateway ensure fails', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-local-shell-cli-fallback')
    const localSession = await createLocalChatSession({
      discoverOpenClaw,
      now: () => 12_345,
    })

    const result = await sendChatMessage(
      {
        sessionId: localSession.sessionId,
        text: '鏈湴澹充篃搴旇鑳藉彂鍑哄幓',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.1-codex'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: false,
          stdout: '',
          stderr: 'gateway offline',
          code: 1,
          running: false,
        }),
        runStreamingCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            response: {
              text: 'CLI fallback 鎴愬姛浜?',
            },
            model: 'openai/gpt-5.1-codex',
          }),
          stderr: '',
          code: 0,
        }),
      }
    )

    expect(result.ok).toBe(true)
    expect(result.sessionId).toBe(localSession.sessionId)

    const transcript = await getChatTranscript(localSession.sessionId, {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(transcript.hasLocalTranscript).toBe(true)
    expect(transcript.messages.map((message) => message.text)).toEqual([
      '鏈湴澹充篃搴旇鑳藉彂鍑哄幓',
      'CLI fallback 鎴愬姛浜?',
    ])
  })


  it('forks a legacy local session even when its model matches the latest default model', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-reuse')
    const capturedCommands: string[][] = []

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-preflight-reuse',
      sessionId: 'matching-local',
      agentId: 'main',
      model: 'openai/gpt-5.1-codex',
      messages: [
        {
          id: 'msg-existing',
          role: 'user',
          text: '之前的本地消息',
          createdAt: 900,
          status: 'sent',
        },
      ],
      updatedAt: 900,
    })

    const result = await sendChatMessage(
      {
        sessionId: 'matching-local',
        text: '继续当前会话',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.1-codex'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async (args) => {
          capturedCommands.push(args)
          return {
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '继续成功',
              },
              model: 'openai/gpt-5.1-codex',
            }),
            stderr: '',
            code: 0,
          }
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(result.sessionId).not.toBe('matching-local')
    expect(capturedCommands[0][0]).toBe('agent')
    expect(capturedCommands[0][1]).toBe('--json')
    expect(capturedCommands[0][2]).toBe('--session-id')
    expect(capturedCommands[0][3]).not.toBe('matching-local')
    expect(capturedCommands[0][4]).toBe('--message')
    expect(capturedCommands[0][5]).toContain('以下是当前对话最近的上下文')
    expect(capturedCommands[0][5]).toContain('之前的本地消息')
    expect(capturedCommands[0][5]).toContain('继续当前会话')
    expect(capturedCommands[0].slice(6)).toEqual([
      '--thinking',
      'off',
    ])
  })

  it('does not patch the current conversation during send when a stale selected model is present', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-patch-before-send')
    const capturedCommands: string[][] = []
    const capturedPatchPayloads: Array<{ key: string; model: string }> = []

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-preflight-patch-before-send',
      sessionId: 'stale-local',
      agentId: 'main',
      model: 'custom-open-bigmodel-cn/glm-5',
      selectedModel: 'custom-open-bigmodel-cn/glm-5',
      transportSessionId: 'transport-stale-local',
      transportModel: 'custom-open-bigmodel-cn/glm-5',
      messages: [
        {
          id: 'msg-existing',
          role: 'user',
          text: '鏃фā鍨嬫秷鎭?',
          createdAt: 1_000,
          status: 'sent',
        },
      ],
      updatedAt: 1_000,
    })

    const result = await sendChatMessage(
      {
        sessionId: 'stale-local',
        text: '鍒囨崲妯″瀷鍚庣殑鏂版秷鎭?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('minimax/MiniMax-M2.5-highspeed'),
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }

          if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.patch') {
            capturedPatchPayloads.push(JSON.parse(String(args[5])))
            return {
              ok: true,
              stdout: JSON.stringify({ ok: true }),
              stderr: '',
              code: 0,
            }
          }

          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        loadCapabilities: async () =>
          createCapabilities({
            chatAgentModelFlag: true,
            chatGatewaySendModel: false,
            chatInThreadModelSwitch: true,
          }),
        callGatewayRpc: async (method, params) => {
          expect(method).toBe('sessions.patch')
          capturedPatchPayloads.push(params as { key: string; model: string })
          return { ok: true }
        },
        runStreamingCommand: async (args) => {
          capturedCommands.push(args)
          return {
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '鏂颁細璇濆凡鍒涘缓',
              },
              model: 'custom-open-bigmodel-cn/glm-5',
            }),
            stderr: '',
            code: 0,
          }
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(result.sessionId).not.toBe('stale-local')
    expect(capturedPatchPayloads).toEqual([])
    expect(capturedCommands[0][0]).toBe('agent')
    expect(capturedCommands[0][3]).not.toBe('transport-stale-local')
    expect(capturedCommands[0][5]).toContain('鏃фā鍨嬫秷鎭?' )
    expect(capturedCommands[0][5]).toContain('鍒囨崲妯″瀷鍚庣殑鏂版秷鎭?' )
  })

  it('reconciles stale selectedModel back to the confirmed session model when send fails', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-send-failure-selection-reconcile')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-send-failure-selection-reconcile',
      sessionId: 'failed-send-session',
      agentId: 'main',
      model: 'zai/glm-5',
      selectedModel: 'openai/gpt-5.4-pro',
      transportSessionId: 'transport-failed-send',
      transportModel: 'zai/glm-5',
      messages: [
        {
          id: 'msg-existing',
          role: 'user',
          text: '鏃т細璇濇秷鎭?',
          createdAt: 1_000,
          status: 'sent',
        },
      ],
      updatedAt: 1_000,
    })

    const result = await sendChatMessage(
      {
        sessionId: 'failed-send-session',
        text: '杩欐鍙戦€佷細澶辫触',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('minimax/MiniMax-M2.5-highspeed'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        chatTransport: {
          run: async () => ({
            ok: false,
            stdout: '',
            stderr: 'transport failed',
            code: 1,
            streamedText: '',
          }),
        },
      }
    )

    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('command-failed')

    const transcript = await getChatTranscript('failed-send-session', {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(transcript.model).toBe('zai/glm-5')
    expect(transcript.selectedModel).toBe('zai/glm-5')

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions.find((session) => session.sessionId === 'failed-send-session')?.selectedModel).toBe('zai/glm-5')
  })

  it('does not turn send-time model intent into a hidden session patch fallback', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-model-supported-via-gateway')
    const capturedPatchPayloads: Array<Record<string, unknown>> = []

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-preflight-model-supported-via-gateway',
      sessionId: 'supported-local',
      agentId: 'main',
      model: 'custom-open-bigmodel-cn/glm-5',
      transportSessionId: 'transport-supported-local',
      messages: [
        {
          id: 'msg-existing',
          role: 'user',
          text: '鏃фā鍨嬫秷鎭?',
          createdAt: 1_000,
          status: 'sent',
        },
      ],
      updatedAt: 1_000,
    })

    const result = await sendChatMessage(
      {
        sessionId: 'supported-local',
        text: '灏濊瘯鍒囧埌鏂版ā鍨?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('minimax/MiniMax-M2.5-highspeed'),
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }
          if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.patch') {
            capturedPatchPayloads.push(JSON.parse(String(args[5] || '{}')))
            return {
              ok: true,
              stdout: JSON.stringify({
                ok: true,
                resolved: {
                  modelProvider: 'openai',
                  model: 'gpt-5.4-pro',
                },
              }),
              stderr: '',
              code: 0,
            }
          }
          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        loadCapabilities: async () =>
          createCapabilities({
            chatAgentModelFlag: false,
            chatGatewaySendModel: true,
            chatInThreadModelSwitch: false,
          }),
        callGatewayRpc: async (method, params) => {
          expect(method).toBe('sessions.patch')
          capturedPatchPayloads.push(params as { key: string; model: string })
          return {
            ok: true,
            resolved: {
              modelProvider: 'openai',
              model: 'gpt-5.4-pro',
            },
          }
        },
        chatTransport: {
          run: async () => ({
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '缃戝叧 patch 鍚庣户缁細璇?',
              },
              model: 'openai/gpt-5.4-pro',
            }),
            stderr: '',
            code: 0,
            streamedText: '缃戝叧 patch 鍚庣户缁細璇?',
          }),
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(capturedPatchPayloads).toEqual([])
  })

  it('rejects runtime send-time model overrides before any session or gateway work starts', async () => {
    const ensureGateway = vi.fn(async () => ({
      ok: true,
      stdout: '',
      stderr: '',
      code: 0,
      running: true,
    }))
    const runCommand = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({ sessions: [] }),
      stderr: '',
      code: 0,
    }))
    const chatTransport = {
      run: vi.fn(),
    }

    const result = await sendChatMessage(
      {
        sessionId: 'runtime-override-session',
        text: '涓嶈鍦ㄥ彂閫佹椂鏀规ā鍨?',
        model: 'openai/gpt-4.1-mini',
      } as any,
      {
        ensureGateway,
        runCommand,
        chatTransport,
      }
    )

    expect(result).toEqual({
      ok: false,
      sessionId: 'runtime-override-session',
      errorCode: 'invalid-input',
      messageText: '聊天发送请求：禁止在发送消息时携带 model；请先通过 patchChatSessionModel()/sessions.patch 切换当前会话模型',
    })
    expect(runCommand).not.toHaveBeenCalled()
    expect(ensureGateway).not.toHaveBeenCalled()
    expect(chatTransport.run).not.toHaveBeenCalled()
  })

  it('sends the first message without a transport-level model override', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-bootstrap-model')
    const capturedCommands: string[][] = []

    const result = await sendChatMessage(
      {
        sessionId: 'bootstrap-session',
        text: '绗竴鏉℃秷鎭氨鎸囧畾妯″瀷',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('minimax/MiniMax-M2.5-highspeed'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        loadCapabilities: async () =>
          createCapabilities({
            chatAgentModelFlag: true,
            chatGatewaySendModel: false,
            chatInThreadModelSwitch: true,
          }),
        runStreamingCommand: async (args) => {
          capturedCommands.push(args)
          return {
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '鍚姩鍏煎鎴愬姛',
              },
              model: 'openai/gpt-5.4-pro',
            }),
            stderr: '',
            code: 0,
          }
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(capturedCommands[0]).not.toContain('--model')
  })

  it('does not pass a model override through gateway chat.send for the first message', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-bootstrap-gateway-model')
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '缃戝叧妯″瀷鍒囨崲鎴愬姛',
        },
        model: 'openai/gpt-5.4-pro',
      }),
      stderr: '',
      code: 0,
      streamedText: '缃戝叧妯″瀷鍒囨崲鎴愬姛',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'bootstrap-gateway-session',
        text: '绗竴鏉℃秷鎭氨鎸囧畾妯″瀷',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('minimax/MiniMax-M2.5-highspeed'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        loadCapabilities: async () =>
          createCapabilities({
            chatAgentModelFlag: false,
            chatGatewaySendModel: true,
            chatInThreadModelSwitch: true,
          }),
        chatTransport: {
          run: transportRun,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(transportRun).toHaveBeenCalledTimes(1)
    const firstRunArgs = (transportRun.mock.calls as any[])[0]?.[0] as Record<string, unknown> | undefined
    expect(firstRunArgs).not.toHaveProperty('model')
  })

  it('materializes a pinned upstream session before the first send when the runtime default model is stale', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-bootstrap-stale-minimax-default')
    const localSession = await createLocalChatSession({
      discoverOpenClaw,
      now: () => 12_345,
    })
    const callGatewayRpc = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe('sessions.create')
      expect(params).toEqual({
        agentId: 'main',
        model: 'minimax-portal/MiniMax-M2.7-highspeed',
      })
      return {
        key: 'agent:main:created-bootstrap-minimax',
        sessionId: 'created-bootstrap-minimax',
        entry: {
          key: 'agent:main:created-bootstrap-minimax',
          sessionId: 'created-bootstrap-minimax',
          agentId: 'main',
          model: 'minimax-portal/MiniMax-M2.7-highspeed',
        },
      }
    })
    const transportRun = vi.fn(async (params: Record<string, unknown>) => {
      expect(params.sessionKey).toBe('agent:main:created-bootstrap-minimax')
      return {
        ok: true,
        stdout: JSON.stringify({
          response: {
            text: 'MiniMax 棣栨潯娑堟伅鎭㈠鎴愬姛',
          },
          model: 'minimax-portal/MiniMax-M2.7-highspeed',
        }),
        stderr: '',
        code: 0,
        streamedText: 'MiniMax 棣栨潯娑堟伅鎭㈠鎴愬姛',
        streamedModel: 'minimax-portal/MiniMax-M2.7-highspeed',
      }
    })

    const result = await sendChatMessage(
      {
        sessionId: localSession.sessionId,
        text: '浣犲ソ',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () =>
          ({
            ok: true,
            action: 'status',
            command: ['models', 'status', '--json'],
            stdout: '',
            stderr: '',
            code: 0,
            data: {
              defaultModel: 'minimax/MiniMax-M2.7-highspeed',
              allowed: ['minimax-portal/MiniMax-M2.7-highspeed', 'minimax-portal/MiniMax-M2.5'],
              auth: {
                oauth: {
                  providers: [{ provider: 'minimax-portal', status: 'ok' }],
                },
                missingProvidersInUse: ['minimax'],
              },
            },
          }) as any,
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        callGatewayRpc,
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(callGatewayRpc).toHaveBeenCalledTimes(1)

    const transcript = await getChatTranscript(localSession.sessionId, {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: false,
        stdout: '',
        stderr: 'history unavailable',
        code: 1,
      }),
    })

    expect(transcript.sessionKey).toBe('agent:main:created-bootstrap-minimax')
    expect(transcript.model).toBe('minimax-portal/MiniMax-M2.7-highspeed')
    expect(transcript.messages.map((message) => message.text)).toEqual(['浣犲ソ', 'MiniMax 棣栨潯娑堟伅鎭㈠鎴愬姛'])

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({
          sessions: [
            {
              sessionId: 'upstream-runtime-row',
              key: 'agent:main:created-bootstrap-minimax',
              agentId: 'main',
              model: 'minimax-portal/MiniMax-M2.7-highspeed',
              updatedAt: 20_000,
              kind: 'direct',
            },
          ],
        }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionId).toBe(localSession.sessionId)
    expect(sessions[0].sessionKey).toBe('agent:main:created-bootstrap-minimax')
    expect(sessions[0].model).toBe('minimax-portal/MiniMax-M2.7-highspeed')
  })

  it('materializes a trusted upstream session before the first send for a local shell even when the default model is already aligned', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-bootstrap-aligned-local-shell')
    const localSession = await createLocalChatSession({
      discoverOpenClaw,
      now: () => 12_345,
      readModelStatus: async () => createModelStatus('minimax-portal/MiniMax-M2.7'),
    })
    const callGatewayRpc = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe('sessions.create')
      expect(params).toEqual({
        agentId: 'main',
        model: 'minimax-portal/MiniMax-M2.7',
      })
      return {
        key: 'agent:main:created-bootstrap-aligned',
        sessionId: 'created-bootstrap-aligned',
        entry: {
          key: 'agent:main:created-bootstrap-aligned',
          sessionId: 'created-bootstrap-aligned',
          agentId: 'main',
          model: 'minimax-portal/MiniMax-M2.7',
        },
      }
    })
    const transportRun = vi.fn(async (params: Record<string, unknown>) => {
      expect(params.sessionKey).toBe('agent:main:created-bootstrap-aligned')
      return {
        ok: true,
        stdout: JSON.stringify({
          response: {
            text: '鏈湴澹充細璇濆凡鍗囨牸涓虹‘璁や細璇?',
          },
          model: 'minimax-portal/MiniMax-M2.7',
        }),
        stderr: '',
        code: 0,
        streamedText: '鏈湴澹充細璇濆凡鍗囨牸涓虹‘璁や細璇?',
        streamedModel: 'minimax-portal/MiniMax-M2.7',
      }
    })

    const result = await sendChatMessage(
      {
        sessionId: localSession.sessionId,
        text: 'nihao',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('minimax-portal/MiniMax-M2.7'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        callGatewayRpc,
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(callGatewayRpc).toHaveBeenCalledTimes(1)

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionId).toBe(localSession.sessionId)
    expect(sessions[0].sessionKey).toBe('agent:main:created-bootstrap-aligned')
    expect(sessions[0].canPatchModel).toBe(true)
    expect(sessions[0].canContinue).toBe(true)
    expect(sessions[0].modelSwitchBlockedReason).toBeUndefined()
  })

  it('patches a trusted legacy minimax session to minimax-portal before send', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-pre-send-repair-legacy-minimax-session')
    const callOrder: string[] = []
    let upstreamSession = {
      sessionId: 'history-minimax-session',
      key: 'agent:channel-default:main',
      agentId: 'channel-default',
      model: 'minimax/MiniMax-M2.5',
      updatedAt: 10_000,
      kind: 'direct',
    }
    const callGatewayRpc = vi.fn(async (method: string, params: unknown, timeoutMs?: number) => {
      callOrder.push(`rpc:${method}`)
      expect(method).toBe('sessions.patch')
      expect(params).toEqual({
        key: 'agent:channel-default:main',
        model: 'minimax-portal/MiniMax-M2.5',
      })
      expect(timeoutMs).toBe(20_000)
      upstreamSession = {
        ...upstreamSession,
        model: 'minimax-portal/MiniMax-M2.5',
        updatedAt: 11_000,
      }
      return { ok: true }
    })
    const transportRun = vi.fn(async (params: Record<string, unknown>) => {
      callOrder.push('transport-run')
      expect(params.sessionKey).toBe('agent:channel-default:main')
      return {
        ok: true,
        stdout: JSON.stringify({
          response: {
            text: '鍘嗗彶浼氳瘽鎭㈠鎴愬姛',
          },
          model: 'minimax-portal/MiniMax-M2.5',
        }),
        stderr: '',
        code: 0,
        streamedText: '鍘嗗彶浼氳瘽鎭㈠鎴愬姛',
        streamedModel: 'minimax-portal/MiniMax-M2.5',
      }
    })

    const result = await sendChatMessage(
      {
        sessionId: 'history-minimax-session',
        text: '缁х画鍘嗗彶浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () =>
          ({
            ok: true,
            action: 'status',
            command: ['models', 'status', '--json'],
            stdout: '',
            stderr: '',
            code: 0,
            data: {
              defaultModel: 'minimax/MiniMax-M2.5',
              allowed: ['minimax-portal/MiniMax-M2.5', 'minimax-portal/MiniMax-M2.7'],
              auth: {
                oauth: {
                  providers: [{ provider: 'minimax-portal', status: 'ok' }],
                },
                missingProvidersInUse: ['minimax'],
              },
            },
          }) as any,
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        callGatewayRpc,
        runCommand: async (args: string[]) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({
                sessions: [upstreamSession],
              }),
              stderr: '',
              code: 0,
            }
          }
          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(callOrder).toEqual(['rpc:sessions.patch', 'transport-run'])

    const transcript = await getChatTranscript('history-minimax-session', {
      discoverOpenClaw,
      runCommand: async (args: string[]) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [upstreamSession],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'history unavailable',
          code: 1,
        }
      },
    })

    expect(transcript.model).toBe('minimax-portal/MiniMax-M2.5')
    expect(transcript.messages.map((message) => message.text)).toEqual(['缁х画鍘嗗彶浼氳瘽', '鍘嗗彶浼氳瘽鎭㈠鎴愬姛'])

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({
          sessions: [upstreamSession],
        }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions[0].model).toBe('minimax-portal/MiniMax-M2.5')
  })

  it('patches a trusted legacy minimax session even when allowed keeps both legacy and portal keys', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-pre-send-repair-legacy-and-portal-allowed')
    const callOrder: string[] = []
    let upstreamSession = {
      sessionId: 'history-minimax-session-both-allowed',
      key: 'agent:channel-default:main',
      agentId: 'channel-default',
      model: 'minimax/MiniMax-M2.5',
      updatedAt: 10_000,
      kind: 'direct',
    }
    const callGatewayRpc = vi.fn(async (method: string, params: unknown) => {
      callOrder.push(`rpc:${method}`)
      expect(method).toBe('sessions.patch')
      expect(params).toEqual({
        key: 'agent:channel-default:main',
        model: 'minimax-portal/MiniMax-M2.5',
      })
      upstreamSession = {
        ...upstreamSession,
        model: 'minimax-portal/MiniMax-M2.5',
        updatedAt: 11_000,
      }
      return { ok: true }
    })
    const transportRun = vi.fn(async () => {
      callOrder.push('transport-run')
      return {
        ok: true,
        stdout: JSON.stringify({
          response: {
            text: '鍙?key 鐘舵€佷笅涔熸仮澶嶆垚鍔?',
          },
          model: 'minimax-portal/MiniMax-M2.5',
        }),
        stderr: '',
        code: 0,
        streamedText: '鍙?key 鐘舵€佷笅涔熸仮澶嶆垚鍔?',
        streamedModel: 'minimax-portal/MiniMax-M2.5',
      }
    })

    const result = await sendChatMessage(
      {
        sessionId: 'history-minimax-session-both-allowed',
        text: '缁х画鍘嗗彶浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () =>
          ({
            ok: true,
            action: 'status',
            command: ['models', 'status', '--json'],
            stdout: '',
            stderr: '',
            code: 0,
            data: {
              defaultModel: 'minimax/MiniMax-M2.5',
              allowed: ['minimax/MiniMax-M2.5', 'minimax-portal/MiniMax-M2.5'],
              auth: {
                oauth: {
                  providers: [{ provider: 'minimax-portal', status: 'ok' }],
                },
                missingProvidersInUse: ['minimax'],
              },
            },
          }) as any,
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        callGatewayRpc,
        runCommand: async (args: string[]) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({
                sessions: [upstreamSession],
              }),
              stderr: '',
              code: 0,
            }
          }
          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(callOrder).toEqual(['rpc:sessions.patch', 'transport-run'])
  })

  it('keeps the pure minimax oauth -> first send -> session unlock -> model switch path green', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-minimax-oauth-first-send-unlock')
    let config: Record<string, any> = {
      models: {
        providers: {
          'minimax-portal': {
            baseUrl: 'https://api.minimax.io/anthropic',
            models: [],
          },
        },
      },
    }
    const writeConfig = vi.fn(async (nextConfig: Record<string, any>) => {
      config = JSON.parse(JSON.stringify(nextConfig))
    })
    const authRunCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'plugins') {
        return {
          ok: true,
          stdout: 'enabled',
          stderr: '',
          code: 0,
        }
      }

      return {
        ok: false,
        stdout: '',
        stderr: 'unexpected command',
        code: 1,
      }
    })
    const authRunStreamingCommand = vi.fn(async (_args: string[], options?: Record<string, any>) => {
      options?.onStdout?.('Open: https://api.minimax.io/oauth/authorize')
      return {
        ok: true,
        stdout: 'done',
        stderr: '',
        code: 0,
      }
    })

    const authResult = await executeAuthRoute(
      {
        method: minimaxOauthMethod,
        providerId: 'minimax',
        methodId: 'minimax-portal',
        selectedExtraOption: 'oauth',
      },
      {
        runCommand: authRunCommand,
        runStreamingCommand: authRunStreamingCommand,
        readConfig: async () => config,
        writeConfig,
      }
    )

    expect(authResult.ok).toBe(true)
    expect(config.models.providers['minimax-portal'].api).toBe('anthropic-messages')
    expect(authRunCommand).toHaveBeenNthCalledWith(
      1,
      ['plugins', 'enable', 'minimax-portal-auth'],
      expect.any(Number)
    )
    expect(authRunStreamingCommand).toHaveBeenNthCalledWith(
      1,
      ['models', 'auth', 'login', '--provider', 'minimax-portal', '--method', 'oauth'],
      expect.objectContaining({ onStdout: expect.any(Function) })
    )

    const readMinimaxStatus = async () =>
      ({
        ok: true,
        action: 'status',
        command: ['models', 'status', '--json'],
        stdout: '',
        stderr: '',
        code: 0,
        data: {
          defaultModel: 'minimax-portal/MiniMax-M2.7',
          allowed: ['minimax-portal/MiniMax-M2.7', 'minimax-portal/MiniMax-M2.5-Lightning'],
          auth: {
            providers: [{ provider: 'minimax-portal', status: 'ok' }],
          },
        },
      }) as any

    const localSession = await createLocalChatSession({
      discoverOpenClaw,
      now: () => 19_000,
      readModelStatus: readMinimaxStatus,
    })

    expect(localSession.canPatchModel).toBe(false)
    expect(localSession.modelSwitchBlockedReason).toContain('请先发送第一条消息')

    let upstreamSession = {
      sessionId: 'upstream-minimax-session',
      key: 'agent:main:minimax-flow',
      agentId: 'main',
      model: 'minimax-portal/MiniMax-M2.7',
      updatedAt: 20_000,
      kind: 'direct',
    }
    const runCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({ sessions: [upstreamSession] }),
          stderr: '',
          code: 0,
        }
      }

      return {
        ok: false,
        stdout: '',
        stderr: 'unexpected command',
        code: 1,
      }
    })
    const callGatewayRpc = vi.fn(async (method: string, params: unknown, timeoutMs?: number) => {
      if (method === 'sessions.create') {
        expect(params).toEqual({
          agentId: 'main',
          model: 'minimax-portal/MiniMax-M2.7',
        })
        expect(timeoutMs).toBe(20_000)
        return {
          key: upstreamSession.key,
          sessionId: upstreamSession.sessionId,
          entry: {
            key: upstreamSession.key,
            sessionId: upstreamSession.sessionId,
            agentId: upstreamSession.agentId,
            model: upstreamSession.model,
          },
        }
      }

      if (method === 'sessions.patch') {
        expect(params).toEqual({
          key: upstreamSession.key,
          model: 'minimax-portal/MiniMax-M2.5-Lightning',
        })
        expect(timeoutMs).toBe(20_000)
        upstreamSession = {
          ...upstreamSession,
          model: 'minimax-portal/MiniMax-M2.5-Lightning',
          updatedAt: 21_000,
        }
        return { ok: true }
      }

      throw new Error(`unexpected gateway rpc: ${method}`)
    })
    const transportRun = vi.fn(async (params: Record<string, unknown>) => {
      expect(params.sessionKey).toBe(upstreamSession.key)
      return {
        ok: true,
        stdout: JSON.stringify({
          response: {
            text: 'MiniMax 棣栨潯娑堟伅鎭㈠鎴愬姛',
          },
          model: upstreamSession.model,
        }),
        stderr: '',
        code: 0,
        streamedText: 'MiniMax 棣栨潯娑堟伅鎭㈠鎴愬姛',
        streamedModel: upstreamSession.model,
      }
    })

    const sendResult = await sendChatMessage(
      {
        sessionId: localSession.sessionId,
        text: 'nihao',
      },
      {
        discoverOpenClaw,
        readModelStatus: readMinimaxStatus,
        runCommand,
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        callGatewayRpc,
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(sendResult.ok, JSON.stringify(sendResult)).toBe(true)
    expect(callGatewayRpc).toHaveBeenNthCalledWith(
      1,
      'sessions.create',
      {
        agentId: 'main',
        model: 'minimax-portal/MiniMax-M2.7',
      },
      20_000
    )

    const sessionsAfterSend = await listChatSessions({
      discoverOpenClaw,
      runCommand,
    })

    expect(sessionsAfterSend).toHaveLength(1)
    expect(sessionsAfterSend[0].sessionId).toBe(localSession.sessionId)
    expect(sessionsAfterSend[0].sessionKey).toBe('agent:main:minimax-flow')
    expect(sessionsAfterSend[0].canPatchModel).toBe(true)
    expect(sessionsAfterSend[0].modelSwitchBlockedReason).toBeUndefined()

    const patchResult = await patchChatSessionModel(
      {
        sessionId: localSession.sessionId,
        model: 'minimax-portal/MiniMax-M2.5-Lightning',
      },
      {
        discoverOpenClaw,
        readModelStatus: readMinimaxStatus,
        runCommand,
        callGatewayRpc,
      }
    )

    expect(patchResult).toMatchObject({
      ok: true,
      sessionId: localSession.sessionId,
      sessionKey: 'agent:main:minimax-flow',
      model: 'minimax-portal/MiniMax-M2.5-Lightning',
    })
    expect(callGatewayRpc).toHaveBeenNthCalledWith(
      2,
      'sessions.patch',
      {
        key: 'agent:main:minimax-flow',
        model: 'minimax-portal/MiniMax-M2.5-Lightning',
      },
      20_000
    )

    const transcript = await getChatTranscript(localSession.sessionId, {
      discoverOpenClaw,
      runCommand,
    })

    expect(transcript.sessionKey).toBe('agent:main:minimax-flow')
    expect(transcript.model).toBe('minimax-portal/MiniMax-M2.5-Lightning')
    expect(transcript.selectedModel).toBe('minimax-portal/MiniMax-M2.5-Lightning')
  })

  it('does not patch or override the model when a fresh empty local session sends its first message', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-bootstrap-created-session')
    const capturedPatchPayloads: Array<{ key: string; model: string }> = []

    const createdSession = await createChatSession({
      discoverOpenClaw,
      now: () => 12_345,
    })
    const transportRun = vi.fn(async (params: Record<string, unknown>) => {
      expect(params.sessionKey).toBe('agent:main:created-bootstrap-created-session')
      expect(params).not.toHaveProperty('model')
      return {
        ok: true,
        stdout: JSON.stringify({
          response: {
            text: '鍚姩鍏煎鎴愬姛',
          },
          model: 'openai/gpt-5.4-pro',
        }),
        stderr: '',
        code: 0,
      }
    })

    const result = await sendChatMessage(
      {
        sessionId: createdSession.sessionId,
        text: '绗竴鏉℃秷鎭氨鎸囧畾妯″瀷',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('minimax/MiniMax-M2.5-highspeed'),
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }

          if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.patch') {
            capturedPatchPayloads.push(JSON.parse(String(args[5])))
            return {
              ok: true,
              stdout: JSON.stringify({ ok: true }),
              stderr: '',
              code: 0,
            }
          }

          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        callGatewayRpc: async () => ({
          key: 'agent:main:created-bootstrap-created-session',
          sessionId: 'created-bootstrap-created-session',
          entry: {
            key: 'agent:main:created-bootstrap-created-session',
            sessionId: 'created-bootstrap-created-session',
            agentId: 'main',
            model: 'minimax/MiniMax-M2.5-highspeed',
          },
        }),
        loadCapabilities: async () =>
          createCapabilities({
            chatAgentModelFlag: true,
            chatGatewaySendModel: false,
            chatInThreadModelSwitch: true,
          }),
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(capturedPatchPayloads).toEqual([])
    expect(transportRun).toHaveBeenCalledTimes(1)
  })

  it('forks an external-only session into a new local session before sending', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-external')
    const capturedCommands: string[][] = []

    const result = await sendChatMessage(
      {
        sessionId: 'external-session',
        text: '浠庡閮ㄥ巻鍙蹭細璇濈户缁?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            sessions: [
              {
                sessionId: 'external-session',
                agentId: 'main',
                model: 'openai/gpt-5.4-pro',
                updatedAt: 5_000,
                kind: 'direct',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async (args) => {
          capturedCommands.push(args)
          return {
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '宸茶浆鍏ユ湰鍦颁細璇?',
              },
              model: 'openai/gpt-5.4-pro',
            }),
            stderr: '',
            code: 0,
          }
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(result.sessionId).not.toBe('external-session')
    expect(capturedCommands[0]?.[3]).not.toBe('external-session')
    expect(capturedCommands[0]?.[3]).not.toBe(result.sessionId)
  })

  it('continues an upstream channel session in place when the upstream row is typed as channel', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-channel-kind')
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '娓犻亾浼氳瘽鍘熷湴缁啓鎴愬姛',
        },
        model: 'openai/gpt-5.4-pro',
      }),
      stderr: '',
      code: 0,
      streamedText: '娓犻亾浼氳瘽鍘熷湴缁啓鎴愬姛',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'channel-session',
        text: '缁х画娓犻亾浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            sessions: [
              {
                sessionId: 'channel-session',
                key: 'channel:feishu:thread-1',
                agentId: 'main',
                model: 'openai/gpt-5.4-pro',
                updatedAt: 5_000,
                kind: 'channel',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        chatTransport: {
          run: transportRun,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(result.sessionId).toBe('channel-session')
    expect(transportRun).toHaveBeenCalledTimes(1)
    expect((transportRun.mock.calls as any[])[0]?.[0]).toMatchObject({
      sessionKey: 'channel:feishu:thread-1',
      transportSessionId: 'channel-session',
    })
  })

  it('continues an external direct history session in place when a continuation key is available', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-external-continue')
    const capturedCommands: string[][] = []
    const runCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({
            sessions: [
              {
                sessionId: 'external-openclaw-history',
                key: 'agent:main:history-direct-session',
                agentId: 'main',
                model: 'minimax/MiniMax-M2.1',
                updatedAt: 8_000,
                kind: 'direct',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }

      if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.patch') {
        return {
          ok: false,
          stdout: '',
          stderr: 'sessions.patch should not be called during plain send',
          code: 1,
        }
      }

      return {
        ok: false,
        stdout: '',
        stderr: 'unexpected command',
        code: 1,
      }
    })

    const result = await sendChatMessage(
      {
        sessionId: 'external-openclaw-history',
        text: '鍒囧埌 OpenAI 鍚庡彂绗竴鏉℃秷鎭?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5'),
        runCommand,
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        loadCapabilities: async () =>
          createCapabilities({
            chatAgentModelFlag: true,
            chatGatewaySendModel: false,
            chatInThreadModelSwitch: false,
          }),
        chatTransport: {
          run: async (params) => {
            capturedCommands.push([
              'transport.run',
              String(params.transportSessionId || ''),
              String(params.sessionKey || ''),
            ])
            return {
              ok: true,
              stdout: JSON.stringify({
                response: {
                  text: '宸茬粡缁х画褰撳墠 OpenClaw 鍘嗗彶浼氳瘽',
                },
                model: 'minimax/MiniMax-M2.1',
              }),
              stderr: '',
              code: 0,
              streamedText: '宸茬粡缁х画褰撳墠 OpenClaw 鍘嗗彶浼氳瘽',
              streamedModel: 'minimax/MiniMax-M2.1',
            }
          },
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(result.sessionId).toBe('external-openclaw-history')
    expect(runCommand.mock.calls.some(([args]) => args[0] === 'gateway' && args[2] === 'sessions.patch')).toBe(false)
    expect(capturedCommands[0]).toEqual([
      'transport.run',
      'external-openclaw-history',
      'agent:main:history-direct-session',
    ])
  })

  it('continues a feishu channel session in-place when sessionKey is available', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-feishu')
    const capturedRunParams: any[] = []

    const result = await sendChatMessage(
      {
        sessionId: 'feishu-session',
        text: '缁х画鍦ㄩ涔︿細璇濋噷鑱?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('zai/glm-5'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            sessions: [
              {
                sessionId: 'feishu-session',
                key: 'agent:feishu-default:feishu:default:direct:ou_11ec143ee4079fad7afe9c5fa042404f',
                agentId: 'main',
                model: 'zai/glm-5',
                updatedAt: 5_000,
                kind: 'direct',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        chatTransport: {
          run: async (params) => {
            capturedRunParams.push(params)
            return {
              ok: true,
              stdout: JSON.stringify({
                response: {
                  text: '鏀跺埌锛岀户缁綋鍓嶉涔︿細璇濄€?',
                },
                model: 'zai/glm-5',
              }),
              stderr: '',
              code: 0,
              streamedText: '鏀跺埌锛岀户缁綋鍓嶉涔︿細璇濄€?',
              streamedModel: 'zai/glm-5',
            }
          },
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(result.sessionId).toBe('feishu-session')
    expect(capturedRunParams[0]?.sessionKey).toBe(
      'agent:feishu-default:feishu:default:direct:ou_11ec143ee4079fad7afe9c5fa042404f'
    )
  })

  it('returns the actual forked session id that receives the new transcript', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-preflight-transcript')

    const result = await sendChatMessage(
      {
        sessionId: 'remote-history',
        text: '纭鐪熷疄钀界洏浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            sessions: [
              {
                sessionId: 'remote-history',
                agentId: 'main',
                model: 'custom-open-bigmodel-cn/glm-5',
                updatedAt: 8_000,
                kind: 'direct',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            response: {
              text: '宸插啓鍏ユ柊 transcript',
            },
            model: 'openai/gpt-5.4-pro',
          }),
          stderr: '',
          code: 0,
        }),
      }
    )

    expect(result.ok).toBe(true)
    expect(result.sessionId).not.toBe('remote-history')

    const transcript = await getChatTranscript(result.sessionId, {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({
          sessions: [],
        }),
        stderr: '',
        code: 0,
      }),
    })

    expect(transcript.sessionId).toBe(result.sessionId)
    expect(transcript.messages.at(-1)?.text).toBe('宸插啓鍏ユ柊 transcript')
  })

  it('uses a safe default thinking level instead of relying on implicit low', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-thinking-safe-default')
    const capturedCommands: string[][] = []

    const result = await sendChatMessage(
      {
        sessionId: 'thinking-safe-default',
        text: '娴嬭瘯瀹夊叏榛樿 thinking',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async (args) => {
          capturedCommands.push(args)
          return {
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '瀹夊叏榛樿鍊煎彂閫佹垚鍔?',
              },
              model: 'openai/gpt-5.4-pro',
            }),
            stderr: '',
            code: 0,
          }
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(capturedCommands[0]).toContain('--thinking')
    expect(capturedCommands[0]?.[capturedCommands[0].indexOf('--thinking') + 1]).toBe('off')
  })

  it('learns a supported fallback thinking level from provider error and retries once', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-thinking-learn')
    const capturedCommands: string[][] = []

    const result = await sendChatMessage(
      {
        sessionId: 'thinking-learn',
        text: '瀛︿範 thinking fallback',
        thinking: 'low',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async (args) => {
          capturedCommands.push(args)
          const thinkingLevel = args[args.indexOf('--thinking') + 1]
          if (thinkingLevel === 'low') {
            return {
              ok: false,
              stdout: '',
              stderr:
                "400 Unsupported value: 'low' is not supported with the 'gpt-5.4-pro' model. Supported values are: 'medium', 'high', and 'xhigh'.",
              code: 1,
            }
          }

          return {
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: 'fallback retry 鎴愬姛',
              },
              model: 'openai/gpt-5.4-pro',
            }),
            stderr: '',
            code: 0,
          }
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(capturedCommands).toHaveLength(2)
    expect(capturedCommands[0]?.[capturedCommands[0].indexOf('--thinking') + 1]).toBe('low')
    expect(capturedCommands[1]?.[capturedCommands[1].indexOf('--thinking') + 1]).toBe('medium')

    const compatStore = JSON.parse(
      await readFile(path.join(userDataDir, 'chat', 'model-thinking-compat.json'), 'utf8')
    ) as Record<string, { fallback?: string; unsupported?: string[]; sourceError?: string }>
    expect(compatStore['openai/gpt-5.4-pro']?.fallback).toBe('medium')
    expect(compatStore['openai/gpt-5.4-pro']?.unsupported).toContain('low')
    expect(compatStore['openai/gpt-5.4-pro']?.sourceError).toContain("Unsupported value: 'low'")
  })

  it('reuses the learned fallback for subsequent sends to the same model', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-thinking-reuse-learned')
    const capturedCommands: string[][] = []
    let requestCount = 0

    const runStreamingCommand = async (args: string[]) => {
      capturedCommands.push(args)
      requestCount += 1
      const thinkingLevel = args[args.indexOf('--thinking') + 1]
      if (requestCount === 1) {
        expect(thinkingLevel).toBe('low')
        return {
          ok: false,
          stdout: '',
          stderr:
            "400 Unsupported value: 'low' is not supported with the 'gpt-5.4-pro' model. Supported values are: 'medium', 'high', and 'xhigh'.",
          code: 1,
        }
      }

      return {
        ok: true,
        stdout: JSON.stringify({
          response: {
            text: 'learned fallback 鎴愬姛',
          },
          model: 'openai/gpt-5.4-pro',
        }),
        stderr: '',
        code: 0,
      }
    }

    const sharedOptions = {
      discoverOpenClaw,
      readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
      ensureGateway: async () => ({
        ok: true,
        stdout: '',
        stderr: '',
        code: 0,
        running: true,
      }),
      runStreamingCommand,
    }

    const firstResult = await sendChatMessage(
      {
        sessionId: 'thinking-reuse-first',
        text: '绗竴娆″涔?',
        thinking: 'low',
      },
      sharedOptions
    )

    expect(firstResult.ok).toBe(true)

    const secondResult = await sendChatMessage(
      {
        sessionId: 'thinking-reuse-second',
        text: '绗簩娆＄洿鎺ヤ娇鐢?learned fallback',
      },
      sharedOptions
    )

    expect(secondResult.ok).toBe(true)
    expect(capturedCommands).toHaveLength(3)
    expect(capturedCommands[2]?.[capturedCommands[2].indexOf('--thinking') + 1]).toBe('medium')
  })

  it('preserves an explicit supported thinking level instead of replacing it with the safe default', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-thinking-explicit')
    const capturedCommands: string[][] = []

    const result = await sendChatMessage(
      {
        sessionId: 'thinking-explicit',
        text: '鏄惧紡 thinking',
        thinking: 'high',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async (args) => {
          capturedCommands.push(args)
          return {
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '鏄惧紡鍊煎彂閫佹垚鍔?',
              },
              model: 'openai/gpt-5.4-pro',
            }),
            stderr: '',
            code: 0,
          }
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(capturedCommands[0]?.[capturedCommands[0].indexOf('--thinking') + 1]).toBe('high')
  })

  it('merges local transcript sessions with external sessions list', async () => {
    const discoverOpenClaw = async () =>
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
            installFingerprint: 'fingerprint-2',
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

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-2',
      sessionId: 'local-session',
      agentId: 'main',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          text: '鏈湴娑堟伅',
          createdAt: 2000,
          status: 'sent',
        },
      ],
      updatedAt: 2_000,
    })

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({
          sessions: [
            {
              sessionId: 'local-session',
              key: 'agent:main:main',
              agentId: 'main',
              model: 'openai/gpt-5.1-codex',
              updatedAt: 3_000,
              kind: 'direct',
              totalTokens: 200,
              contextTokens: 4000,
            },
            {
              sessionId: 'remote-session',
              key: 'agent:feishu-default:feishu:default:direct:ou_123',
              agentId: 'main',
              model: 'google/gemini-2.5-pro',
              updatedAt: 1_000,
              kind: 'direct',
              totalTokens: 20,
              contextTokens: 32000,
            },
          ],
        }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions.map((session) => session.sessionId)).toEqual(['local-session', 'remote-session'])
    expect(sessions[0].hasLocalTranscript).toBe(true)
    expect(sessions[0].model).toBe('openai/gpt-5.1-codex')
    expect(sessions[0].totalTokens).toBe(200)
    expect(sessions[0].contextTokens).toBe(4000)
    expect(sessions[0].sessionKey).toBe('agent:main:main')
    expect(sessions[0].canPatchModel).toBe(true)
    expect(sessions[0].canContinue).toBe(true)
    expect(sessions[0].authorityKind).toBe('mixed')
    expect(sessions[0].cachePresence).toBe('local-shell')
    expect(sessions[1].sessionKey).toBe('agent:feishu-default:feishu:default:direct:ou_123')
    expect(sessions[1].canPatchModel).toBe(false)
    expect(sessions[1].canContinue).toBe(true)
    expect(sessions[1].authorityKind).toBe('upstream-channel')
    expect(sessions[1].cachePresence).toBe('none')
    expect(sessions[1].modelSwitchBlockedReason).toContain('当前渠道会话')
  })

  it('marks a freshly created empty local conversation as not patchable yet', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-create-session')

    const session = await createChatSession({
      discoverOpenClaw,
      now: () => 12_345,
    })

    expect(session.canPatchModel).toBe(false)
    expect(session.canContinue).toBe(false)
    expect(session.authorityKind).toBe('local-cache-only')
    expect(session.cachePresence).toBe('local-shell')
    expect(session.modelSwitchBlockedReason).toContain('请先发送第一条消息')

    const transcript = await getChatTranscript(session.sessionId, {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(transcript.canPatchModel).toBe(false)
    expect(transcript.canContinue).toBe(false)
    expect(transcript.authorityKind).toBe('local-cache-only')
    expect(transcript.cachePresence).toBe('local-shell')
    expect(transcript.modelSwitchBlockedReason).toContain('请先发送第一条消息')
  })

  it('creates a local-only chat shell directly for the explicit new-chat action', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-create-local-shell')
    const ensureGateway = vi.fn(async () => {
      throw new Error('should not be called')
    })
    const callGatewayRpc = vi.fn(async () => {
      throw new Error('should not be called')
    })

    const session = await createLocalChatSession({
      discoverOpenClaw,
      now: () => 12_345,
      ensureGateway,
      callGatewayRpc,
    })

    expect(session.localOnly).toBe(true)
    expect(session.canPatchModel).toBe(false)
    expect(session.canContinue).toBe(false)
    expect(session.authorityKind).toBe('local-cache-only')
    expect(session.cachePresence).toBe('local-shell')
    expect(ensureGateway).not.toHaveBeenCalled()
    expect(callGatewayRpc).not.toHaveBeenCalled()
  })

  it('creates an upstream direct chat session through sessions.create when gateway is ready', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-create-upstream-session')
    const callOrder: string[] = []
    const ensureGateway = vi.fn(async () => {
      callOrder.push('ensure-gateway')
      return {
        ok: true,
        running: true,
        stdout: '',
        stderr: '',
        code: 0,
      }
    })
    const callGatewayRpc = vi.fn(async (method: string, params: unknown) => {
      callOrder.push(`rpc:${method}`)
      expect(method).toBe('sessions.create')
      expect(params).toEqual({
        agentId: 'main',
        model: 'openai/gpt-5.1-codex',
      })
      return {
        key: 'agent:main:created-upstream',
        sessionId: 'created-upstream',
        entry: {
          key: 'agent:main:created-upstream',
          sessionId: 'created-upstream',
          agentId: 'main',
          model: 'openai/gpt-5.1-codex',
        },
      }
    })

    const session = await createChatSession({
      discoverOpenClaw,
      now: () => 12_345,
      ensureGateway,
      callGatewayRpc,
      readModelStatus: async () => createModelStatus('openai/gpt-5.1-codex'),
    })

    expect(callOrder).toEqual(['ensure-gateway', 'rpc:sessions.create'])
    expect(session.sessionId).toBe('created-upstream')
    expect(session.sessionKey).toBe('agent:main:created-upstream')
    expect(session.model).toBe('openai/gpt-5.1-codex')
    expect(session.selectedModel).toBe('openai/gpt-5.1-codex')
    expect(session.localOnly).toBe(false)
    expect(session.canPatchModel).toBe(true)
    expect(session.canContinue).toBe(true)
    expect(session.authorityKind).toBe('upstream-direct')
    expect(session.cachePresence).toBe('local-shell')
    expect(listChatTraceEntries(2)).toEqual([
      expect.objectContaining({
        operation: 'create',
        stage: 'upstream-created',
        sessionId: 'created-upstream',
        sessionKey: 'agent:main:created-upstream',
      }),
      expect.objectContaining({
        operation: 'create',
        stage: 'start',
      }),
    ])
  })

  it('creates an upstream direct session with the reconciled runtime model when defaultModel is stale', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-create-upstream-stale-minimax-default')
    const callGatewayRpc = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe('sessions.create')
      expect(params).toEqual({
        agentId: 'main',
        model: 'minimax-portal/MiniMax-M2.7-highspeed',
      })
      return {
        key: 'agent:main:created-upstream-minimax',
        sessionId: 'created-upstream-minimax',
        entry: {
          key: 'agent:main:created-upstream-minimax',
          sessionId: 'created-upstream-minimax',
          agentId: 'main',
          model: 'minimax-portal/MiniMax-M2.7-highspeed',
        },
      }
    })

    const session = await createChatSession({
      discoverOpenClaw,
      now: () => 12_345,
      ensureGateway: async () => ({
        ok: true,
        running: true,
        stdout: '',
        stderr: '',
        code: 0,
      }),
      callGatewayRpc,
      readModelStatus: async () =>
        ({
          ok: true,
          action: 'status',
          command: ['models', 'status', '--json'],
          stdout: '',
          stderr: '',
          code: 0,
          data: {
            defaultModel: 'minimax/MiniMax-M2.7-highspeed',
            allowed: ['minimax-portal/MiniMax-M2.7-highspeed', 'minimax-portal/MiniMax-M2.5'],
            auth: {
              oauth: {
                providers: [{ provider: 'minimax-portal', status: 'ok' }],
              },
              missingProvidersInUse: ['minimax'],
            },
          },
        }) as any,
    })

    expect(callGatewayRpc).toHaveBeenCalledTimes(1)
    expect(session.model).toBe('minimax-portal/MiniMax-M2.7-highspeed')
    expect(session.selectedModel).toBe('minimax-portal/MiniMax-M2.7-highspeed')
  })

  it('falls back to a local shell when sessions.create is unsupported', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-create-fallback-session')
    const callGatewayRpc = vi.fn(async () => {
      throw new Error('unknown method: sessions.create')
    })

    const session = await createChatSession({
      discoverOpenClaw,
      now: () => 12_345,
      ensureGateway: async () => ({
        ok: true,
        running: true,
        stdout: '',
        stderr: '',
        code: 0,
      }),
      callGatewayRpc,
    })

    expect(callGatewayRpc).toHaveBeenCalledTimes(1)
    expect(session.localOnly).toBe(true)
    expect(session.canPatchModel).toBe(false)
    expect(session.canContinue).toBe(false)
    expect(session.authorityKind).toBe('local-cache-only')
    expect(session.cachePresence).toBe('local-shell')
    expect(listChatTraceEntries(2)).toEqual([
      expect.objectContaining({
        operation: 'create',
        stage: 'local-fallback',
        sessionId: session.sessionId,
      }),
      expect.objectContaining({
        operation: 'create',
        stage: 'start',
      }),
    ])
  })

  it('does not silently fall back when sessions.create returns an ambiguous payload', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-create-ambiguous-session')

    await expect(
      createChatSession({
        discoverOpenClaw,
        now: () => 12_345,
        ensureGateway: async () => ({
          ok: true,
          running: true,
          stdout: '',
          stderr: '',
          code: 0,
        }),
        callGatewayRpc: async () => ({
          key: 'agent:main:created-upstream',
        }),
      })
    ).rejects.toThrow(/unrecognized payload|invalid payload/i)

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toEqual([])
    expect(listChatTraceEntries(2)).toEqual([
      expect.objectContaining({
        operation: 'create',
        stage: 'outcome-unknown',
      }),
      expect.objectContaining({
        operation: 'create',
        stage: 'start',
      }),
    ])
  })

  it('keeps an upstream-confirmed local shadow as upstream-direct in the session list', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-upstream-shadow-list')

    await createChatSession({
      discoverOpenClaw,
      now: () => 12_345,
      ensureGateway: async () => ({
        ok: true,
        running: true,
        stdout: '',
        stderr: '',
        code: 0,
      }),
      callGatewayRpc: async () => ({
        key: 'agent:main:created-shadow',
        sessionId: 'created-shadow',
        entry: {
          key: 'agent:main:created-shadow',
          sessionId: 'created-shadow',
          agentId: 'main',
          model: 'openai/gpt-5.1-codex',
        },
      }),
      readModelStatus: async () => createModelStatus('openai/gpt-5.1-codex'),
    })

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionId).toBe('created-shadow')
    expect(sessions[0].sessionKey).toBe('agent:main:created-shadow')
    expect(sessions[0].localOnly).toBe(false)
    expect(sessions[0].canPatchModel).toBe(true)
    expect(sessions[0].canContinue).toBe(true)
    expect(sessions[0].authorityKind).toBe('upstream-direct')
    expect(sessions[0].cachePresence).toBe('local-shell')
  })

  it('keeps a created upstream-confirmed session trusted after the first send even when upstream session inventory is unavailable', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-created-upstream-post-send')

    const createdSession = await createChatSession({
      discoverOpenClaw,
      now: () => 12_345,
      ensureGateway: async () => ({
        ok: true,
        running: true,
        stdout: '',
        stderr: '',
        code: 0,
      }),
      callGatewayRpc: async () => ({
        key: 'agent:main:created-upstream',
        sessionId: 'created-upstream',
        entry: {
          key: 'agent:main:created-upstream',
          sessionId: 'created-upstream',
          agentId: 'main',
          model: 'openai/gpt-5.1-codex',
        },
      }),
      readModelStatus: async () => createModelStatus('openai/gpt-5.1-codex'),
    })

    const sendResult = await sendChatMessage(
      {
        sessionId: createdSession.sessionId,
        text: '鍒涘缓鍚庨鏉℃秷鎭?',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.1-codex'),
        ensureGateway: async () => ({
          ok: true,
          running: true,
          stdout: '',
          stderr: '',
          code: 0,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: async () => ({
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '鏀跺埌锛岀户缁湪宸茬‘璁や細璇濆唴鍥炵瓟銆?',
              },
              model: 'openai/gpt-5.1-codex',
            }),
            stderr: '',
            code: 0,
            streamedText: '鏀跺埌锛岀户缁湪宸茬‘璁や細璇濆唴鍥炵瓟銆?',
            streamedModel: 'openai/gpt-5.1-codex',
          }),
        },
      }
    )

    expect(sendResult.ok, JSON.stringify(sendResult)).toBe(true)

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionId).toBe('created-upstream')
    expect(sessions[0].sessionKey).toBe('agent:main:created-upstream')
    expect(sessions[0].localOnly).toBe(false)
    expect(sessions[0].canPatchModel).toBe(true)
    expect(sessions[0].canContinue).toBe(true)
    expect(sessions[0].authorityKind).toBe('mixed')
    expect(sessions[0].cachePresence).toBe('local-transcript')
  })

  it('returns an empty upstream-direct transcript for a fresh upstream-confirmed local shadow', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-upstream-shadow-transcript')

    await createChatSession({
      discoverOpenClaw,
      now: () => 12_345,
      ensureGateway: async () => ({
        ok: true,
        running: true,
        stdout: '',
        stderr: '',
        code: 0,
      }),
      callGatewayRpc: async () => ({
        key: 'agent:main:created-shadow',
        sessionId: 'created-shadow',
        entry: {
          key: 'agent:main:created-shadow',
          sessionId: 'created-shadow',
          agentId: 'main',
          model: 'openai/gpt-5.1-codex',
        },
      }),
      readModelStatus: async () => createModelStatus('openai/gpt-5.1-codex'),
    })

    const transcript = await getChatTranscript('created-shadow', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({ sessions: [] }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({ messages: [] }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.sessionId).toBe('created-shadow')
    expect(transcript.sessionKey).toBe('agent:main:created-shadow')
    expect(transcript.messages).toEqual([])
    expect(transcript.canPatchModel).toBe(true)
    expect(transcript.canContinue).toBe(true)
    expect(transcript.authorityKind).toBe('upstream-direct')
    expect(transcript.cachePresence).toBe('local-shell')
  })

  it('keeps a local session in conservative legacy mode after merging with an external row that lacks sessionKey', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-merge-patchable-local')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-merge-patchable-local',
      sessionId: 'shared-session',
      agentId: 'main',
      model: 'openai/gpt-5.1-codex',
      selectedModel: 'openai/gpt-5.1-codex',
      transportSessionId: 'transport-shared-session',
      transportModel: 'openai/gpt-5.1-codex',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          text: '鏈湴娑堟伅',
          createdAt: 2_000,
          status: 'sent',
        },
      ],
      updatedAt: 2_000,
    })

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({
          sessions: [
            {
              sessionId: 'shared-session',
              agentId: 'main',
              model: 'openai/gpt-5.1-codex',
              updatedAt: 3_000,
              kind: 'direct',
            },
          ],
        }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionId).toBe('shared-session')
    expect(sessions[0].canPatchModel).toBe(false)
    expect(sessions[0].canContinue).toBe(false)
    expect(sessions[0].authorityKind).toBe('mixed')
    expect(sessions[0].cachePresence).toBe('local-shell')
    expect(sessions[0].modelSwitchBlockedReason).toContain('旧 transport 兼容态')

    const transcript = await getChatTranscript('shared-session', {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({
          sessions: [
            {
              sessionId: 'shared-session',
              agentId: 'main',
              model: 'openai/gpt-5.1-codex',
              updatedAt: 3_000,
              kind: 'direct',
            },
          ],
        }),
        stderr: '',
        code: 0,
      }),
    })

    expect(transcript.canPatchModel).toBe(false)
    expect(transcript.canContinue).toBe(false)
    expect(transcript.authorityKind).toBe('mixed')
    expect(transcript.cachePresence).toBe('local-transcript')
    expect(transcript.modelSwitchBlockedReason).toContain('旧 transport 兼容态')
  })

  it('keeps an external-only direct OpenClaw history session patchable when it already has a session key', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-direct-patchable')

    const sessions = await listChatSessions({
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({
          sessions: [
            {
              sessionId: 'external-direct-session',
              key: 'agent:main:history-direct-session',
              agentId: 'main',
              model: 'zai/glm-5',
              updatedAt: 9_000,
              kind: 'direct',
            },
          ],
        }),
        stderr: '',
        code: 0,
      }),
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionId).toBe('external-direct-session')
    expect(sessions[0].hasLocalTranscript).toBe(false)
    expect(sessions[0].sessionKey).toBe('agent:main:history-direct-session')
    expect(sessions[0].canPatchModel).toBe(true)
    expect(sessions[0].canContinue).toBe(true)
    expect(sessions[0].authorityKind).toBe('upstream-direct')
    expect(sessions[0].cachePresence).toBe('none')
    expect(sessions[0].modelSwitchBlockedReason).toBeUndefined()

    const transcript = await getChatTranscript('external-direct-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'external-direct-session',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'zai/glm-5',
                  updatedAt: 9_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  text: '澶栭儴鐩存帴鍘嗗彶鍐呭',
                  createdAt: 9_001,
                  model: 'zai/glm-5',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.sessionId).toBe('external-direct-session')
    expect(transcript.sessionKey).toBe('agent:main:history-direct-session')
    expect(transcript.hasLocalTranscript).toBe(false)
    expect(transcript.canPatchModel).toBe(true)
    expect(transcript.canContinue).toBe(true)
    expect(transcript.authorityKind).toBe('upstream-direct')
    expect(transcript.cachePresence).toBe('none')
    expect(transcript.modelSwitchBlockedReason).toBeUndefined()
  })

  it('loads external transcript via sessions.get when local transcript does not exist', async () => {
    const discoverOpenClaw = async () =>
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
            installFingerprint: 'fingerprint-3',
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

    const capturedCommands: string[][] = []
    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        capturedCommands.push(args)
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:feishu-default:feishu:default:direct:ou_456',
                  agentId: 'main',
                  model: 'google/gemini-2.5-pro',
                  updatedAt: 9_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-1',
                  role: 'user',
                  content: [{ type: 'text', text: '在吗？' }],
                  createdAt: 9_001,
                },
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: '在的，我在这里。' }],
                  createdAt: 9_002,
                  model: 'google/gemini-2.5-pro',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.sessionId).toBe('remote-session')
    expect(transcript.sessionKey).toBe('agent:feishu-default:feishu:default:direct:ou_456')
    expect(transcript.model).toBe('google/gemini-2.5-pro')
    expect(transcript.canPatchModel).toBe(false)
    expect(transcript.modelSwitchBlockedReason).toContain('当前渠道会话')
    expect(transcript.updatedAt).toBe(9_000)
    expect(transcript.hasLocalTranscript).toBe(false)
    expect(transcript.historySource).toBe('sessions-get')
    expect(transcript.messages).toHaveLength(2)
    expect(transcript.messages[0].role).toBe('user')
    expect(transcript.messages[0].text).toContain('在吗')
    expect(transcript.messages[1].role).toBe('assistant')
    expect(transcript.messages[1].model).toBe('google/gemini-2.5-pro')
    expect(transcript.externalTranscriptLimit).toBe(200)
    expect(transcript.externalTranscriptTruncated).toBe(false)
    expect(transcript.externalTranscriptErrorCode).toBeUndefined()
    expect(capturedCommands.some((args) => args[0] === 'sessions' && args.includes('--all-agents'))).toBe(true)
    expect(capturedCommands.some((args) => args[0] === 'gateway' && args[2] === 'sessions.get')).toBe(true)
  })

  it('skips external tool-call partialJson records when loading transcript history', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-tool-history')

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4',
                  updatedAt: 9_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-1',
                  role: 'user',
                  content: [{ type: 'text', text: '查一下深圳天气？' }],
                  createdAt: 9_001,
                },
                {
                  id: 'assistant-tool-1',
                  role: 'assistant',
                  content: [
                    {
                      type: 'toolCall',
                      partialJson: '{"path":"~/homebrew/lib/node_modules/openclaw/skills/weather/SKILL.md"}',
                    },
                  ],
                  createdAt: 9_002,
                },
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: '深圳明天有阵雨，23-24C。' }],
                  createdAt: 9_003,
                  model: 'openai/gpt-5.4',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages).toHaveLength(2)
    expect(transcript.messages[0].role).toBe('user')
    expect(transcript.messages[1].role).toBe('assistant')
    expect(transcript.messages[1].text).toBe('深圳明天有阵雨，23-24C。')
  })

  it('merges external toolMessages so browser screenshots survive transcript loading', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-tool-images')

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4',
                  updatedAt: 9_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-1',
                  role: 'user',
                  content: [{ type: 'text', text: '把浏览器页面截下来' }],
                  createdAt: 9_001,
                },
              ],
              toolMessages: [
                {
                  id: 'tool-image-1',
                  role: 'toolresult',
                  content: [
                    {
                      type: 'image',
                      props: {
                        url: 'data:image/png;base64,ZXh0ZXJuYWwtdG9vbC1pbWFnZQ==',
                      },
                    },
                  ],
                  createdAt: 9_002,
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages).toHaveLength(2)
    expect(transcript.messages[0].role).toBe('user')
    expect(transcript.messages[1].role).toBe('assistant')
    expect(transcript.messages[1].images).toEqual([
      {
        url: 'data:image/png;base64,ZXh0ZXJuYWwtdG9vbC1pbWFnZQ==',
        mimeType: 'image/png',
      },
    ])
  })

  it('loads browser screenshots from saved image paths in external toolMessages', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-tool-image-path')
    const imagePath = path.join(os.tmpdir(), `mclaw-transcript-${Date.now()}.png`)
    const imageBuffer = Buffer.from('external-tool-image-path')
    await writeFile(imagePath, imageBuffer)

    try {
      const transcript = await getChatTranscript('remote-session', {
        discoverOpenClaw,
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({
                sessions: [
                  {
                    sessionId: 'remote-session',
                    key: 'agent:main:history-direct-session',
                    agentId: 'main',
                    model: 'openai/gpt-5.4',
                    updatedAt: 9_100,
                    kind: 'direct',
                  },
                ],
              }),
              stderr: '',
              code: 0,
            }
          }

          if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
            return {
              ok: true,
              stdout: JSON.stringify({
                messages: [
                  {
                    id: 'user-1',
                    role: 'user',
                    content: [{ type: 'text', text: '把浏览器页面截下来' }],
                    createdAt: 9_101,
                  },
                ],
                toolMessages: [
                  {
                    id: 'tool-image-2',
                    role: 'toolresult',
                    path: imagePath,
                    createdAt: 9_102,
                  },
                ],
              }),
              stderr: '',
              code: 0,
            }
          }

          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
      })

      expect(transcript.messages).toHaveLength(2)
      expect(transcript.messages[1].role).toBe('assistant')
      expect(transcript.messages[1].images).toEqual([
        {
          url: `data:image/png;base64,${imageBuffer.toString('base64')}`,
          mimeType: 'image/png',
        },
      ])
    } finally {
      await rm(imagePath, { force: true })
    }
  })

  it('maps raw session-log message envelopes from sessions.get and preserves toolResult screenshots', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-raw-session-log')
    const imageBuffer = Buffer.from('external-raw-session-log-image')

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'deepseek-chat',
                  updatedAt: 9_200,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              records: [
                {
                  type: 'session',
                  id: 'session-meta',
                  timestamp: '2026-04-15T16:46:11.449Z',
                },
                {
                  type: 'message',
                  id: 'user-1',
                  timestamp: '2026-04-15T16:46:29.001Z',
                  message: {
                    role: 'user',
                    content: [{ type: 'text', text: '把浏览器页面截下来' }],
                  },
                },
                {
                  type: 'message',
                  id: 'assistant-1',
                  timestamp: '2026-04-15T16:47:01.162Z',
                  message: {
                    role: 'assistant',
                    content: [{ type: 'text', text: '正在截图。' }],
                    model: 'deepseek-chat',
                  },
                },
                {
                  type: 'message',
                  id: 'tool-1',
                  timestamp: '2026-04-15T16:47:06.802Z',
                  message: {
                    role: 'toolResult',
                    toolName: 'browser',
                    content: [
                      {
                        type: 'image',
                        data: imageBuffer.toString('base64'),
                        mimeType: 'image/jpeg',
                      },
                    ],
                  },
                  details: {
                    path: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw\\media\\browser\\tool-1.jpg',
                  },
                  isError: false,
                },
                {
                  type: 'message',
                  id: 'assistant-2',
                  timestamp: '2026-04-15T16:47:14.024Z',
                  message: {
                    role: 'assistant',
                    content: [{ type: 'text', text: '截图已经返回。' }],
                    model: 'deepseek-chat',
                  },
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages).toHaveLength(4)
    expect(transcript.messages[0].role).toBe('user')
    expect(transcript.messages[1].text).toContain('正在截图')
    expect(transcript.messages[2].images).toEqual([
      {
        url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
        mimeType: 'image/jpeg',
      },
    ])
    expect(transcript.messages[3].text).toContain('截图已经返回')
  })

  it('merges newer locally persisted turns when the upstream transcript lags behind', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-transcript-local-tail')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-external-transcript-local-tail',
      sessionId: 'remote-session',
      sessionKey: 'agent:main:history-direct-session',
      upstreamConfirmed: true,
      agentId: 'main',
      model: 'openai/gpt-5.4',
      transportSessionId: 'transport-remote-session',
      messages: [
        {
          id: 'local-user-2',
          role: 'user',
          text: '再来一张当前可见区域截图',
          createdAt: 9_101_000,
          status: 'sent',
        },
        {
          id: 'local-assistant-2',
          role: 'assistant',
          text: '好的，已重新截图。',
          createdAt: 9_102_000,
          status: 'sent',
          model: 'openai/gpt-5.4',
        },
      ],
      updatedAt: 9_102_000,
    })

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4',
                  updatedAt: 9_100,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-1',
                  role: 'user',
                  content: [{ type: 'text', text: '先看一下这个页面' }],
                  createdAt: 9_001,
                },
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: '这是当前页面。' }],
                  createdAt: 9_002,
                  model: 'openai/gpt-5.4',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.hasLocalTranscript).toBe(true)
    expect(transcript.messages).toHaveLength(4)
    expect(transcript.messages.map((message) => message.text)).toEqual([
      '先看一下这个页面',
      '这是当前页面。',
      '再来一张当前可见区域截图',
      '好的，已重新截图。',
    ])
  })

  it('dedupes assistant turns by sanitized visible text when the local cache still contains tool chatter', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-transcript-visible-dedupe')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-external-transcript-visible-dedupe',
      sessionId: 'remote-session',
      sessionKey: 'agent:main:history-direct-session',
      upstreamConfirmed: true,
      agentId: 'main',
      model: 'openai/gpt-5.4',
      transportSessionId: 'transport-remote-session',
      messages: [
        {
          id: 'local-user-1',
          role: 'user',
          text: '帮我把结果写到桌面文件里',
          createdAt: 9_100_000,
          status: 'sent',
        },
        {
          id: 'local-assistant-1',
          role: 'assistant',
          text: [
            '我来帮你处理。',
            '{"command":"cmd.exe /c dir","workdir":"C:\\\\Users\\\\James\\\\Desktop","yieldMs":10000,"timeout":20}',
            '完成！我已经把结果写入桌面文件。',
          ].join('\n'),
          createdAt: 9_101_000,
          status: 'sent',
          model: 'openai/gpt-5.4',
        },
      ],
      updatedAt: 9_101_000,
    })

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4',
                  updatedAt: 9_101,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-1',
                  role: 'user',
                  content: [{ type: 'text', text: '帮我把结果写到桌面文件里' }],
                  createdAt: 9_100,
                },
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: '我来帮你处理。\n完成！我已经把结果写入桌面文件。' }],
                  createdAt: 9_101,
                  model: 'openai/gpt-5.4',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages.map((message) => `${message.role}:${message.text}`)).toEqual([
      'user:帮我把结果写到桌面文件里',
      'assistant:我来帮你处理。\n完成！我已经把结果写入桌面文件。',
    ])
  })

  it('suppresses a locally cached composite assistant reply once upstream history already exposes the split tool turns', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-transcript-composite-replay')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-external-transcript-composite-replay',
      sessionId: 'remote-session',
      sessionKey: 'agent:main:history-direct-session',
      upstreamConfirmed: true,
      agentId: 'main',
      model: 'openai/gpt-5.4',
      transportSessionId: 'transport-remote-session',
      messages: [
        {
          id: 'local-user-1',
          role: 'user',
          text: 'List the top CPU processes',
          createdAt: 9_100_000,
          status: 'sent',
        },
        {
          id: 'local-assistant-1',
          role: 'assistant',
          text: 'I will inspect the top CPU processes. Top CPU processes:\n1. proc-a\n2. proc-b',
          createdAt: 9_104_000,
          status: 'sent',
          model: 'openai/gpt-5.4',
        },
      ],
      updatedAt: 9_104_000,
    })

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4',
                  updatedAt: 9_104,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'List the top CPU processes' }],
                  createdAt: 9_100,
                },
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: 'I will inspect the top CPU processes.' }],
                  createdAt: 9_101,
                  model: 'openai/gpt-5.4',
                },
                {
                  id: 'assistant-2',
                  role: 'assistant',
                  content: [{ type: 'text', text: 'Top CPU processes:\n1. proc-a\n2. proc-b' }],
                  createdAt: 9_102,
                  model: 'openai/gpt-5.4',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages.map((message) => message.text)).toEqual([
      'List the top CPU processes',
      'I will inspect the top CPU processes.',
      'Top CPU processes:\n1. proc-a\n2. proc-b',
    ])
  })

  it('suppresses a delayed locally cached user replay when its paired assistant turn is already split upstream', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-transcript-user-replay')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-external-transcript-user-replay',
      sessionId: 'remote-session',
      sessionKey: 'agent:main:history-direct-session',
      upstreamConfirmed: true,
      agentId: 'main',
      model: 'openai/gpt-5.4',
      transportSessionId: 'transport-remote-session',
      messages: [
        {
          id: 'local-user-1',
          role: 'user',
          text: 'List the top CPU processes',
          createdAt: 1_776_768_085_940,
          status: 'sent',
        },
        {
          id: 'local-assistant-1',
          role: 'assistant',
          text: 'I will inspect the top CPU processes. Top CPU processes:\n1. proc-a\n2. proc-b',
          createdAt: 1_776_768_085_941,
          status: 'sent',
          model: 'openai/gpt-5.4',
        },
      ],
      updatedAt: 1_776_768_085_941,
    })

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4',
                  updatedAt: 9_124,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'List the top CPU processes' }],
                  createdAt: 9_100,
                },
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: 'I will inspect the top CPU processes.' }],
                  createdAt: 9_101,
                  model: 'openai/gpt-5.4',
                },
                {
                  id: 'assistant-2',
                  role: 'assistant',
                  content: [{ type: 'text', text: 'Top CPU processes:\n1. proc-a\n2. proc-b' }],
                  createdAt: 9_102,
                  model: 'openai/gpt-5.4',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages.map((message) => `${message.role}:${message.text}`)).toEqual([
      'user:List the top CPU processes',
      'assistant:I will inspect the top CPU processes.',
      'assistant:Top CPU processes:\n1. proc-a\n2. proc-b',
    ])
  })

  it('prefers chat.history for direct sessions when the history flag and capability gate are enabled', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-history-primary')
    const capturedCommands: string[][] = []

    const transcript = await getChatTranscript('remote-direct-history', {
      discoverOpenClaw,
      chatHistoryPrimaryEnabled: true,
      loadCapabilities: async () =>
        createCapabilities({
          chatGatewaySendModel: true,
        }),
      runCommand: async (args) => {
        capturedCommands.push(args)
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-direct-history',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4-pro',
                  updatedAt: 9_500,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'chat.history') {
          return {
            ok: true,
            stdout: JSON.stringify({
              history: [
                {
                  id: 'user-1',
                  role: 'user',
                  content: [{ type: 'text', text: '缁х画杩欎釜 direct 浼氳瘽' }],
                  createdAt: 9_501,
                },
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: '好的，已通过 chat.history 读取。' }],
                  createdAt: 9_502,
                  model: 'openai/gpt-5.4-pro',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.historySource).toBe('chat-history')
    expect(transcript.messages).toHaveLength(2)
    expect(transcript.messages[1].text).toContain('chat.history')
    expect(capturedCommands.some((args) => args[0] === 'gateway' && args[2] === 'chat.history')).toBe(true)
    expect(capturedCommands.some((args) => args[0] === 'gateway' && args[2] === 'sessions.get')).toBe(false)
  })

  it('falls back to sessions.get when chat.history primary path fails', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-history-fallback')
    const capturedCommands: string[][] = []

    const transcript = await getChatTranscript('remote-direct-history', {
      discoverOpenClaw,
      chatHistoryPrimaryEnabled: true,
      loadCapabilities: async () =>
        createCapabilities({
          chatGatewaySendModel: true,
        }),
      runCommand: async (args) => {
        capturedCommands.push(args)
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-direct-history',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4-pro',
                  updatedAt: 9_600,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'chat.history') {
          return {
            ok: false,
            stdout: '',
            stderr: 'method not found',
            code: 1,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: '已通过 sessions.get 回退成功。' }],
                  createdAt: 9_601,
                  model: 'openai/gpt-5.4-pro',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.historySource).toBe('sessions-get')
    expect(transcript.messages).toHaveLength(1)
    expect(transcript.messages[0].text).toContain('sessions.get')
    expect(capturedCommands.some((args) => args[0] === 'gateway' && args[2] === 'chat.history')).toBe(true)
    expect(capturedCommands.some((args) => args[0] === 'gateway' && args[2] === 'sessions.get')).toBe(true)
  })

  it('falls back to local cache when both upstream history paths fail but local transcript exists', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-history-local-fallback')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-chat-history-local-fallback',
      sessionId: 'remote-direct-history',
      sessionKey: 'agent:main:history-direct-session',
      agentId: 'main',
      model: 'openai/gpt-5.4-pro',
      selectedModel: 'openai/gpt-5.4-pro',
      transportSessionId: 'transport-local-history',
      transportModel: 'openai/gpt-5.4-pro',
      messages: [
        {
          id: 'local-user-1',
          role: 'user',
          text: '鏈湴缂撳瓨姝ｆ枃',
          createdAt: 9_700,
          status: 'sent',
        },
      ],
      updatedAt: 9_700,
    })

    const transcript = await getChatTranscript('remote-direct-history', {
      discoverOpenClaw,
      chatHistoryPrimaryEnabled: true,
      loadCapabilities: async () =>
        createCapabilities({
          chatGatewaySendModel: true,
        }),
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-direct-history',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4-pro',
                  updatedAt: 9_701,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && (args[2] === 'chat.history' || args[2] === 'sessions.get')) {
          return {
            ok: false,
            stdout: '',
            stderr: 'gateway closed',
            code: 1,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.historySource).toBe('local-cache')
    expect(transcript.hasLocalTranscript).toBe(true)
    expect(transcript.messages).toHaveLength(1)
    expect(transcript.externalTranscriptErrorCode).toBe('gateway-offline')
  })

  it('strips untrusted metadata wrappers from external user messages', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-3meta')
    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:feishu-default:feishu:default:direct:ou_meta',
                  agentId: 'main',
                  model: 'zai/glm-5',
                  updatedAt: 9_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-meta-1',
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `System: [2026-03-19 21:34:06 GMT+8] Feishu[default] DM | ou_11ec143ee4079fad7afe9c5fa042404f
[msg:om_x100b548bfa13b4acb2675cd2f7d7aba]

Conversation info (untrusted metadata):
\`\`\`json
{
  "message_id": "om_x100b548bfa13b4acb2675cd2f7d7aba",
  "sender_id": "ou_11ec143ee4079fad7afe9c5fa042404f"
}
\`\`\`

Sender (untrusted metadata):
\`\`\`json
{
  "id": "ou_11ec143ee4079fad7afe9c5fa042404f"
}
\`\`\`

浣犵敤鐨勬槸浠€涔堟ā鍨嬶紵`,
                    },
                  ],
                  createdAt: 9_001,
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages).toHaveLength(1)
    expect(transcript.messages[0].role).toBe('user')
    expect(transcript.messages[0].text).toBe('浣犵敤鐨勬槸浠€涔堟ā鍨嬶紵')
    expect(transcript.messages[0].text).not.toContain('untrusted metadata')
    expect(transcript.messages[0].text).not.toContain('System:')
  })

  it('strips control-ui timestamp prefixes from metadata-wrapped external user messages', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-3meta-control-ui-prefix')
    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:main:dashboard:control-ui-prefix',
                  agentId: 'main',
                  model: 'deepseek-chat',
                  updatedAt: 9_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-meta-1',
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `Sender (untrusted metadata):
\`\`\`json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
\`\`\`

[Tue 2026-04-21 20:12 GMT+8] 列出当前cpu占用率最高的3个进程`,
                    },
                  ],
                  createdAt: 9_001,
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages).toHaveLength(1)
    expect(transcript.messages[0].role).toBe('user')
    expect(transcript.messages[0].text).toBe('列出当前cpu占用率最高的3个进程')
    expect(transcript.messages[0].text).not.toContain('GMT+8')
  })

  it('hides reply markers, message_id headers, and encrypted reasoning payloads', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-3meta-hidden')
    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:feishu-default:feishu:default:direct:ou_hidden',
                  agentId: 'main',
                  model: 'zai/glm-5',
                  updatedAt: 9_100,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'user-hidden-1',
                  role: 'user',
                  content: [{ type: 'text', text: '[[reply_to_current]]\n[message_id: om_x100]\nou_11ec143ee4079fad7afe9c5fa042404f: 1\n浣犵敤鐨勬槸浠€涔堟ā鍨嬶紵' }],
                  createdAt: 9_101,
                },
                {
                  id: 'assistant-reasoning-1',
                  role: 'assistant',
                  content: [
                    {
                      type: 'text',
                      text: '{"id":"rs_07827d08e460d7660069bba83b377c81959d294dca56d1eb03","type":"reasoning","encrypted_content":"gAAAAABpu6g9wtd9oingfVi0EDfC4gsSdGY87PpsBt6Gr_hump4OKCT1-fk0CZUpieqy8YH_STcrUaYVF5TBbpt54wpyqi_SvxatIijsxAZbCGPGDJyEAcrV3nXv5"}',
                    },
                  ],
                  createdAt: 9_102,
                },
                {
                  id: 'assistant-final-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: '我现在用的是 GLM-5。' }],
                  createdAt: 9_103,
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages).toHaveLength(2)
    expect(transcript.messages[0].role).toBe('user')
    expect(transcript.messages[0].text).toBe('浣犵敤鐨勬槸浠€涔堟ā鍨嬶紵')
    expect(transcript.messages[0].text).not.toContain('reply_to_current')
    expect(transcript.messages[0].text).not.toContain('message_id')
    expect(transcript.messages[1].role).toBe('assistant')
    expect(transcript.messages[1].text).toBe('我现在用的是 GLM-5。')
  })

  it('still loads external transcript when a local session shell exists but has no local messages', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-3local-empty')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-3local-empty',
      sessionId: 'remote-session',
      agentId: 'main',
      messages: [
        {
          id: 'local-msg-1',
          role: 'user',
          text: '鏈湴涓存椂娑堟伅',
          createdAt: 8_000,
          status: 'sent',
        },
      ],
      updatedAt: 8_000,
    })
    await clearChatTranscript('remote-session', { discoverOpenClaw })

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:feishu-default:feishu:default:direct:ou_local_empty',
                  agentId: 'main',
                  model: 'zai/glm-5',
                  updatedAt: 9_200,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [
                {
                  id: 'external-user-1',
                  role: 'user',
                  content: [{ type: 'text', text: '浣犵敤鐨勬槸浠€涔堟ā鍨嬶紵' }],
                  createdAt: 9_201,
                },
                {
                  id: 'external-assistant-1',
                  role: 'assistant',
                  content: [{ type: 'text', text: '我现在用的是 GLM-5。' }],
                  createdAt: 9_202,
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.hasLocalTranscript).toBe(false)
    expect(transcript.messages).toHaveLength(2)
    expect(transcript.messages[0].text).toContain('浣犵敤鐨勬槸浠€涔堟ā鍨')
    expect(transcript.messages[1].text).toContain('GLM-5')
  })

  it('falls back to metadata when external transcript loading fails', async () => {
    const discoverOpenClaw = async () =>
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
            installFingerprint: 'fingerprint-3b',
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

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:feishu-default:feishu:default:direct:ou_789',
                  agentId: 'main',
                  model: 'google/gemini-2.5-pro',
                  updatedAt: 9_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'Gateway call failed',
          code: 1,
        }
      },
    })

    expect(transcript.sessionId).toBe('remote-session')
    expect(transcript.sessionKey).toBe('agent:feishu-default:feishu:default:direct:ou_789')
    expect(transcript.hasLocalTranscript).toBe(false)
    expect(transcript.messages).toEqual([])
    expect(transcript.externalTranscriptErrorCode).toBe('sessions-get-failed')
  })

  it('patches the current conversation model through sessions.patch when a patchable session exists', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-patch-model')
    const callGatewayRpc = vi.fn(async (method: string, params: unknown, timeoutMs?: number) => {
      expect(method).toBe('sessions.patch')
      expect(params).toEqual({
        key: 'agent:main:transport-123',
        model: 'openai/gpt-5.4-pro',
      })
      expect(timeoutMs).toBe(20_000)
      return { ok: true }
    })

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-patch-model',
      sessionId: 'local-session',
      agentId: 'main',
      model: 'moonshot/kimi-k2.5',
      selectedModel: 'moonshot/kimi-k2.5',
      transportSessionId: 'transport-123',
      transportModel: 'moonshot/kimi-k2.5',
      messages: [
        {
          id: 'local-msg-1',
          role: 'user',
          text: '鏃ф秷鎭?',
          createdAt: 5_000,
          status: 'sent',
        },
      ],
      updatedAt: 5_000,
    })

    const result = await patchChatSessionModel(
      {
        sessionId: 'local-session',
        model: 'openai/gpt-5.4-pro',
      },
      {
        discoverOpenClaw,
        loadCapabilities: async () =>
          createCapabilities({
            chatInThreadModelSwitch: true,
          }),
        callGatewayRpc,
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }

          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
      }
    )

    expect(result).toMatchObject({
      ok: true,
      sessionId: 'local-session',
      sessionKey: undefined,
      model: 'openai/gpt-5.4-pro',
    })
    expect(callGatewayRpc).toHaveBeenCalledTimes(1)

    const transcript = await getChatTranscript('local-session', {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }),
    })

    expect(transcript.sessionKey).toBeUndefined()
    expect(transcript.model).toBe('openai/gpt-5.4-pro')
    expect(transcript.selectedModel).toBe('openai/gpt-5.4-pro')
  })

  it('prefers the control ui browser rpc path when patching without an injected gateway caller', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-control-ui-default')
    callGatewayRpcViaControlUiBrowserMock.mockResolvedValue({
      ok: true,
    })

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-control-ui-default',
      sessionId: 'control-ui-session',
      agentId: 'main',
      model: 'moonshot/kimi-k2.5',
      transportSessionId: 'transport-control-ui',
      messages: [
        {
          id: 'local-msg-1',
          role: 'user',
          text: '鏃ф秷鎭?',
          createdAt: 5_000,
          status: 'sent',
        },
      ],
      updatedAt: 5_000,
    })

    const result = await patchChatSessionModel(
      {
        sessionId: 'control-ui-session',
        model: 'openai/gpt-5.4-pro',
      },
      {
        discoverOpenClaw,
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }

          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(callGatewayRpcViaControlUiBrowserMock).toHaveBeenCalledTimes(1)
    expect(callGatewayRpcViaControlUiBrowserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        readConfig: readConfigMock,
        readEnvFile: readEnvFileMock,
      }),
      'sessions.patch',
      {
        key: 'agent:main:transport-control-ui',
        model: 'openai/gpt-5.4-pro',
      },
      {
        timeoutMs: 20_000,
      }
    )
  })

  it('patches an external-only direct OpenClaw history session in place when it has a session key', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-external-direct-patch')
    const callGatewayRpc = vi.fn(async () => ({ ok: true }))

    const result = await patchChatSessionModel(
      {
        sessionId: 'external-direct-patch-session',
        model: 'openai/gpt-5.4-pro',
      },
      {
        discoverOpenClaw,
        callGatewayRpc,
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({
                sessions: [
                  {
                    sessionId: 'external-direct-patch-session',
                    key: 'agent:main:history-direct-session',
                    agentId: 'main',
                    model: 'zai/glm-5',
                    updatedAt: 12_000,
                    kind: 'direct',
                  },
                ],
              }),
              stderr: '',
              code: 0,
            }
          }

          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
      }
    )

    expect(result).toMatchObject({
      ok: true,
      sessionId: 'external-direct-patch-session',
      sessionKey: 'agent:main:history-direct-session',
      model: 'openai/gpt-5.4-pro',
    })
    expect(callGatewayRpc).toHaveBeenCalledWith(
      'sessions.patch',
      {
        key: 'agent:main:history-direct-session',
        model: 'openai/gpt-5.4-pro',
      },
      20_000
    )

    const transcript = await getChatTranscript('external-direct-patch-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'external-direct-patch-session',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4-pro',
                  updatedAt: 12_001,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: [],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.sessionKey).toBe('agent:main:history-direct-session')
    expect(transcript.canPatchModel).toBe(true)
    expect(transcript.model).toBe('openai/gpt-5.4-pro')
    expect(transcript.selectedModel).toBe('openai/gpt-5.4-pro')
  })

  it('keeps using a trusted session key even when local legacy transport state also exists', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-trusted-session-key-send')
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '缁х画鎴愬姛',
        },
        model: 'openai/gpt-5.4-pro',
      }),
      stderr: '',
      code: 0,
      streamedText: '缁х画鎴愬姛',
      streamedModel: 'openai/gpt-5.4-pro',
    }))

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-trusted-session-key-send',
      sessionId: 'trusted-session',
      sessionKey: 'agent:main:history-direct-session',
      agentId: 'main',
      model: 'moonshot/kimi-k2.5',
      selectedModel: 'moonshot/kimi-k2.5',
      transportSessionId: 'transport-trusted-local',
      transportModel: 'moonshot/kimi-k2.5',
      messages: [
        {
          id: 'local-msg-1',
          role: 'user',
          text: '鏃ф秷鎭?',
          createdAt: 5_000,
          status: 'sent',
        },
      ],
      updatedAt: 5_000,
    })

    const sendResult = await sendChatMessage(
      {
        sessionId: 'trusted-session',
        text: '缁х画褰撳墠浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('minimax/MiniMax-M2.5-highspeed'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            sessions: [
              {
                sessionId: 'trusted-session',
                key: 'agent:main:history-direct-session',
                agentId: 'main',
                model: 'openai/gpt-5.4-pro',
                updatedAt: 6_000,
                kind: 'direct',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun,
        },
      }
    )

    expect(sendResult.ok, JSON.stringify(sendResult)).toBe(true)
    expect(sendResult.sessionId).toBe('trusted-session')
    expect(transportRun).toHaveBeenCalledWith(
      expect.objectContaining({
        transportSessionId: 'transport-trusted-local',
        sessionKey: 'agent:main:history-direct-session',
      })
    )
  })

  it('uses the platform-default trusted upstream send transport and keeps sends successful', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-control-ui-chat-send')
    runGatewayChatViaControlUiBrowserMock.mockResolvedValue({
      runId: 'run-control-ui-1',
      sessionKey: 'agent:main:history-direct-session',
      payload: {
        state: 'final',
        runId: 'run-control-ui-1',
        sessionKey: 'agent:main:history-direct-session',
        message: {
          text: '閫氳繃缃戦〉閫氶亾鍙戦€佹垚鍔?',
          model: 'openai/gpt-5.4-pro',
          usage: {
            inputTokens: 12,
            outputTokens: 34,
          },
        },
      },
    })

    const sendResult = await sendChatMessage(
      {
        sessionId: 'trusted-default-control-ui',
        text: '缁х画褰撳墠 confirmed 浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            sessions: [
              {
                sessionId: 'trusted-default-control-ui',
                key: 'agent:main:history-direct-session',
                agentId: 'main',
                model: 'openai/gpt-5.4-pro',
                updatedAt: 6_000,
                kind: 'direct',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }),
        runStreamingCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            response: {
              text: 'socket 閫氶亾鍙戦€佹垚鍔?',
            },
            model: 'openai/gpt-5.4-pro',
          }),
          stderr: '',
          code: 0,
          streamedText: 'socket 閫氶亾鍙戦€佹垚鍔?',
          streamedModel: 'openai/gpt-5.4-pro',
        }),
      }
    )

    expect(sendResult.ok).toBe(true)
    expect(sendResult.message?.text).toBe('閫氳繃缃戦〉閫氶亾鍙戦€佹垚鍔?')
    expect(runGatewayChatViaControlUiBrowserMock).toHaveBeenCalledTimes(1)
    expect(runGatewayChatViaControlUiBrowserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        readConfig: readConfigMock,
        readEnvFile: readEnvFileMock,
      }),
      expect.objectContaining({
        sessionKey: 'agent:main:history-direct-session',
        message: '缁х画褰撳墠 confirmed 浼氳瘽',
        thinking: 'off',
      })
    )
    expect(runCliStreamingMock).not.toHaveBeenCalled()
  })

  it('keeps browser screenshots when control ui returns toolMessages separately', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-control-ui-chat-image')
    runGatewayChatViaControlUiBrowserMock.mockResolvedValue({
      runId: 'run-control-ui-image',
      sessionKey: 'agent:main:history-direct-session',
      payload: {
        state: 'final',
        runId: 'run-control-ui-image',
        sessionKey: 'agent:main:history-direct-session',
        message: {
          text: '',
          model: 'openai/gpt-5.4-pro',
        },
      },
      toolMessages: [
        {
          id: 'tool-image-1',
          role: 'toolresult',
          content: [
            {
              type: 'image',
              props: {
                url: 'data:image/png;base64,Y29udHJvbC11aS10b29sLWltYWdl',
              },
            },
          ],
          createdAt: 6_001,
        },
      ],
    })

    const sendResult = await sendChatMessage(
      {
        sessionId: 'trusted-default-control-ui-image',
        text: '截图',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            sessions: [
              {
                sessionId: 'trusted-default-control-ui-image',
                key: 'agent:main:history-direct-session',
                agentId: 'main',
                model: 'openai/gpt-5.4-pro',
                updatedAt: 6_000,
                kind: 'direct',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }),
        runStreamingCommand: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          streamedText: '',
          streamedModel: 'openai/gpt-5.4-pro',
        }),
      }
    )

    expect(sendResult.ok).toBe(true)
    expect(sendResult.message?.images).toEqual([
      {
        url: 'data:image/png;base64,Y29udHJvbC11aS10b29sLWltYWdl',
        mimeType: 'image/png',
      },
    ])
    expect(runCliStreamingMock).not.toHaveBeenCalled()
  })

  it('keeps browser screenshots when control ui only reports a saved image path', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-control-ui-chat-image-path')
    const imagePath = path.join(os.tmpdir(), `mclaw-control-ui-${Date.now()}.png`)
    const imageBuffer = Buffer.from('control-ui-tool-image-path')
    await writeFile(imagePath, imageBuffer)

    try {
      runGatewayChatViaControlUiBrowserMock.mockResolvedValue({
        runId: 'run-control-ui-image-path',
        sessionKey: 'agent:main:history-direct-session',
        payload: {
          state: 'final',
          runId: 'run-control-ui-image-path',
          sessionKey: 'agent:main:history-direct-session',
          message: {
            text: '',
            model: 'openai/gpt-5.4-pro',
          },
        },
        toolMessages: [
          {
            id: 'tool-image-path-1',
            role: 'toolresult',
            path: imagePath,
            createdAt: 6_101,
          },
        ],
      })

      const sendResult = await sendChatMessage(
        {
          sessionId: 'trusted-default-control-ui-image-path',
          text: '截图',
        },
        {
          discoverOpenClaw,
          readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
          ensureGateway: async () => ({
            ok: true,
            stdout: '',
            stderr: '',
            code: 0,
            running: true,
          }),
          runCommand: async () => ({
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'trusted-default-control-ui-image-path',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4-pro',
                  updatedAt: 6_100,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }),
          runStreamingCommand: async () => ({
            ok: true,
            stdout: '',
            stderr: '',
            code: 0,
            streamedText: '',
            streamedModel: 'openai/gpt-5.4-pro',
          }),
        }
      )

      expect(sendResult.ok).toBe(true)
      expect(sendResult.message?.images).toEqual([
        {
          url: `data:image/png;base64,${imageBuffer.toString('base64')}`,
          mimeType: 'image/png',
        },
      ])
      expect(runCliStreamingMock).not.toHaveBeenCalled()
    } finally {
      await rm(imagePath, { force: true })
    }
  })

  it('falls back to socket transport when the control ui trusted send path times out', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-control-ui-chat-send-timeout-fallback')
    class FakeWebSocket {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3

      readyState = FakeWebSocket.OPEN
      private readonly listeners = new Map<string, Set<(event: any) => void>>()

      constructor() {
        queueMicrotask(() => {
          this.emit('message', {
            data: JSON.stringify({
              type: 'event',
              event: 'connect.challenge',
              payload: {
                nonce: 'nonce-1',
              },
            }),
          })
        })
      }

      addEventListener(type: string, listener: (event: any) => void): void {
        if (!this.listeners.has(type)) {
          this.listeners.set(type, new Set())
        }
        this.listeners.get(type)?.add(listener)
      }

      send(raw: string): void {
        const frame = JSON.parse(raw)
        if (frame.method === 'connect') {
          this.emit('message', {
            data: JSON.stringify({
              type: 'res',
              id: frame.id,
              ok: true,
              payload: {
                auth: { role: 'operator' },
              },
            }),
          })
          return
        }

        if (frame.method === 'chat.send') {
          this.emit('message', {
            data: JSON.stringify({
              type: 'res',
              id: frame.id,
              ok: true,
              payload: {
                runId: 'socket-run-1',
              },
            }),
          })
          this.emit('message', {
            data: JSON.stringify({
              type: 'event',
              event: 'chat.stream',
              payload: {
                runId: 'socket-run-1',
                sessionKey: 'agent:main:history-direct-session',
                seq: 1,
                state: 'final',
                message: {
                  text: 'socket fallback 缁х画鎴愬姛',
                  model: 'openai/gpt-5.4-pro',
                },
              },
            }),
          })
        }
      }

      close(): void {
        this.readyState = FakeWebSocket.CLOSED
        this.emit('close', {})
      }

      private emit(type: string, event: any): void {
        for (const listener of this.listeners.get(type) || []) {
          listener(event)
        }
      }
    }

    const originalWebSocket = globalThis.WebSocket
    ;(globalThis as typeof globalThis & { WebSocket?: typeof WebSocket }).WebSocket =
      FakeWebSocket as unknown as typeof WebSocket
    readConfigMock.mockResolvedValue({
      gateway: {
        port: 18789,
        auth: {
          token: 'gateway-token',
        },
      },
    })
    runGatewayChatViaControlUiBrowserMock.mockRejectedValue(new Error('control ui chat.send timeout for agent:main:history-direct-session'))

    try {
      const sendResult = await sendChatMessage(
        {
          sessionId: 'trusted-control-ui-timeout',
          text: '鎺у埗鐣岄潰瓒呮椂鍚庣户缁彂閫?',
        },
        {
          discoverOpenClaw,
          readModelStatus: async () => createModelStatus('openai/gpt-5.4-pro'),
          ensureGateway: async () => ({
            ok: true,
            stdout: '',
            stderr: '',
            code: 0,
            running: true,
          }),
          runCommand: async () => ({
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'trusted-control-ui-timeout',
                  key: 'agent:main:history-direct-session',
                  agentId: 'main',
                  model: 'openai/gpt-5.4-pro',
                  updatedAt: 6_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }),
          runStreamingCommand: async () => ({
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: 'socket fallback 缁х画鎴愬姛',
              },
              model: 'openai/gpt-5.4-pro',
            }),
            stderr: '',
            code: 0,
            streamedText: 'socket fallback 缁х画鎴愬姛',
            streamedModel: 'openai/gpt-5.4-pro',
          }),
        }
      )

      expect(sendResult.ok).toBe(true)
      expect(sendResult.message?.text).toBe('socket fallback 缁х画鎴愬姛')
      expect(runGatewayChatViaControlUiBrowserMock).toHaveBeenCalledTimes(1)
      expect(runCliStreamingMock).not.toHaveBeenCalled()
    } finally {
      ;(globalThis as typeof globalThis & { WebSocket?: typeof WebSocket }).WebSocket = originalWebSocket
    }
  })

  it('does not promote a legacy patch bridge into a trusted session key on the next send', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-patch-send')
    const callGatewayRpc = vi.fn(async () => ({ ok: true }))
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '缁х画鎴愬姛',
        },
        model: 'openai/gpt-5.4-pro',
      }),
      stderr: '',
      code: 0,
      streamedText: '缁х画鎴愬姛',
      streamedModel: 'openai/gpt-5.4-pro',
    }))

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-patch-send',
      sessionId: 'patched-session',
      agentId: 'main',
      model: 'moonshot/kimi-k2.5',
      selectedModel: 'moonshot/kimi-k2.5',
      transportSessionId: 'transport-456',
      transportModel: 'moonshot/kimi-k2.5',
      messages: [
        {
          id: 'local-msg-1',
          role: 'user',
          text: '鏃ф秷鎭?',
          createdAt: 5_000,
          status: 'sent',
        },
      ],
      updatedAt: 5_000,
    })

    const patchResult = await patchChatSessionModel(
      {
        sessionId: 'patched-session',
        model: 'openai/gpt-5.4-pro',
      },
      {
        discoverOpenClaw,
        loadCapabilities: async () =>
          createCapabilities({
            chatInThreadModelSwitch: true,
          }),
        callGatewayRpc,
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }

          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
      }
    )

    expect(patchResult.ok).toBe(true)
    expect(patchResult.sessionKey).toBeUndefined()
    expect(callGatewayRpc).toHaveBeenCalledWith(
      'sessions.patch',
      {
        key: 'agent:main:transport-456',
        model: 'openai/gpt-5.4-pro',
      },
      20_000
    )

    const sendResult = await sendChatMessage(
      {
        sessionId: 'patched-session',
        text: '缁х画褰撳墠浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('minimax/MiniMax-M2.5-highspeed'),
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
          run: transportRun,
        },
      }
    )

    expect(sendResult.ok).toBe(true)
    expect(sendResult.sessionId).not.toBe('patched-session')
    expect(transportRun).toHaveBeenCalledTimes(1)
    expect(transportRun).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: undefined,
      })
    )
    const firstTransportArgs = (transportRun.mock.calls as Array<unknown[]>)[0]
    const firstTransportCall = firstTransportArgs?.[0] as Record<string, unknown> | undefined
    expect(String(firstTransportCall?.transportSessionId || '')).not.toBe('transport-456')
    expect(String(firstTransportCall?.messageText || '')).toContain('以下是当前对话最近的上下文')
  })

  it('ensures the gateway once before sending and does not patch the session model during send', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-send-patch-order')
    const callOrder: string[] = []
    const ensureGateway = vi.fn(async () => {
      callOrder.push('ensure-gateway')
      return {
        ok: true,
        stdout: '',
        stderr: '',
        code: 0,
        running: true,
      }
    })
    const transportRun = vi.fn(async () => {
      callOrder.push('transport-run')
      return {
        ok: true,
        stdout: JSON.stringify({
          response: {
            text: '鍒囨崲鍚庣户缁垚鍔?',
          },
          model: 'openai/gpt-5.4-pro',
        }),
        stderr: '',
        code: 0,
        streamedText: '鍒囨崲鍚庣户缁垚鍔?',
        streamedModel: 'openai/gpt-5.4-pro',
      }
    })

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-send-patch-order',
      sessionId: 'send-patch-session',
      agentId: 'main',
      model: 'moonshot/kimi-k2.5',
      transportSessionId: 'transport-send-patch',
      messages: [
        {
          id: 'local-msg-1',
          role: 'user',
          text: '鏃ф秷鎭?',
          createdAt: 5_000,
          status: 'sent',
        },
      ],
      updatedAt: 5_000,
    })

    const result = await sendChatMessage(
      {
        sessionId: 'send-patch-session',
        text: '缁х画褰撳墠浼氳瘽',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('moonshot/kimi-k2.5'),
        ensureGateway,
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }

          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
        chatTransport: {
          run: transportRun,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(callOrder).toEqual(['ensure-gateway', 'transport-run'])
    expect(ensureGateway).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the current conversation has no patchable session identity', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-patch-missing')

    const result = await patchChatSessionModel(
      {
        sessionId: 'missing-session',
        model: 'openai/gpt-5.4-pro',
      },
      {
        discoverOpenClaw,
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
      }
    )

    expect(result.ok).toBe(false)
    expect(result.messageText).toContain('当前会话还没有可切换的 OpenClaw session')
  })

  it('surfaces gateway patch failures instead of misreporting them as unsupported', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-patch-gateway-error')

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-patch-gateway-error',
      sessionId: 'patch-error-session',
      agentId: 'main',
      model: 'openai/gpt-5.4',
      transportSessionId: 'transport-patch-error',
      messages: [
        {
          id: 'msg-existing',
          role: 'assistant',
          text: '鏃у洖澶?',
          createdAt: 1_000,
          status: 'sent',
        },
      ],
      updatedAt: 1_000,
    })

    const result = await patchChatSessionModel(
      {
        sessionId: 'patch-error-session',
        model: 'openai/gpt-5.4-pro',
      },
      {
        discoverOpenClaw,
        callGatewayRpc: async () => {
          throw new Error('gateway closed (1006 abnormal closure (no close frame)): no close reason')
        },
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }
          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
      }
    )

    expect(result.ok).toBe(false)
    expect(result.messageText).not.toContain('褰撳墠 OpenClaw 鐗堟湰杩樹笉鏀寔')
    expect(result.messageText).toContain('Gateway 尚未就绪')
  })

  it('rejects model switches early when the target model is not allowed by the current OpenClaw config', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-patch-model-not-allowed')
    const callGatewayRpc = vi.fn(async () => ({ ok: true }))

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-patch-model-not-allowed',
      sessionId: 'patch-model-not-allowed',
      agentId: 'main',
      model: 'openai/gpt-5.4',
      transportSessionId: 'transport-model-not-allowed',
      messages: [
        {
          id: 'msg-existing',
          role: 'assistant',
          text: '鏃у洖澶?',
          createdAt: 1_000,
          status: 'sent',
        },
      ],
      updatedAt: 1_000,
    })

    const result = await patchChatSessionModel(
      {
        sessionId: 'patch-model-not-allowed',
        model: 'openai/gpt-4.1-mini',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => ({
          ok: true,
          action: 'status',
          command: ['models', 'status', '--json'],
          stdout: '',
          stderr: '',
          code: 0,
          data: {
            defaultModel: 'openai/gpt-5.4',
            allowed: ['openai/gpt-5.4', 'zai/glm-5'],
          },
        }),
        callGatewayRpc,
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }
          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
      }
    )

    expect(result.ok).toBe(false)
    expect(result.messageText).toContain('当前 OpenClaw 未启用模型 openai/gpt-4.1-mini')
    expect(callGatewayRpc).not.toHaveBeenCalled()
  })

  it('still attempts sessions.patch over gateway rpc when legacy capability probing says switching is unsupported', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-patch-supported-via-gateway')
    const runCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }
      }
      return {
        ok: false,
        stdout: '',
        stderr: 'unexpected command',
        code: 1,
      }
    })
    const callGatewayRpc = vi.fn(async () => ({
      ok: true,
      resolved: {
        modelProvider: 'openai',
        model: 'gpt-5.4-pro',
      },
    }))

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-patch-supported-via-gateway',
      sessionId: 'patchable-session',
      agentId: 'main',
      model: 'minimax/MiniMax-M2.5-highspeed',
      transportSessionId: 'transport-patchable',
      messages: [
        {
          id: 'msg-existing',
          role: 'assistant',
          text: '鏃у洖澶?',
          createdAt: 1_000,
          status: 'sent',
        },
      ],
      updatedAt: 1_000,
    })

    const result = await patchChatSessionModel(
      {
        sessionId: 'patchable-session',
        model: 'openai/gpt-5.4-pro',
      },
      {
        discoverOpenClaw,
        loadCapabilities: async () =>
          createCapabilities({
            chatAgentModelFlag: false,
            chatGatewaySendModel: true,
            chatInThreadModelSwitch: false,
          }),
        callGatewayRpc,
        runCommand,
      }
    )

    expect(result.ok).toBe(true)
    expect(callGatewayRpc).toHaveBeenCalledWith(
      'sessions.patch',
      {
        key: 'agent:main:transport-patchable',
        model: 'openai/gpt-5.4-pro',
      },
      20_000
    )
  })

  it('treats minimax/* requests as allowed when status.allowed only exposes minimax-portal aliases', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-patch-minimax-alias')
    const callGatewayRpc = vi.fn(async () => ({ ok: true }))

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-patch-minimax-alias',
      sessionId: 'minimax-alias-session',
      agentId: 'main',
      model: 'minimax/MiniMax-M2.5',
      transportSessionId: 'transport-minimax-alias',
      messages: [
        {
          id: 'local-msg-1',
          role: 'user',
          text: '鏃ф秷鎭?',
          createdAt: 5_000,
          status: 'sent',
        },
      ],
      updatedAt: 5_000,
    })

    const result = await patchChatSessionModel(
      {
        sessionId: 'minimax-alias-session',
        model: 'minimax/MiniMax-M2.7',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => ({
          ok: true,
          action: 'status',
          command: ['control-ui-app', 'model-status'],
          stdout: '',
          stderr: '',
          code: 0,
          data: {
            defaultModel: 'minimax/MiniMax-M2.5',
            allowed: ['minimax-portal/MiniMax-M2.5', 'minimax-portal/MiniMax-M2.7'],
          },
        }),
        callGatewayRpc,
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          }
          return {
            ok: false,
            stdout: '',
            stderr: 'unexpected command',
            code: 1,
          }
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(callGatewayRpc).toHaveBeenCalledWith(
      'sessions.patch',
      {
        key: 'agent:main:transport-minimax-alias',
        model: 'minimax/MiniMax-M2.7',
      },
      20_000
    )
  })

  it('marks external transcript as truncated when sessions.get hits the limit', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-3c')

    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  key: 'agent:feishu-default:feishu:default:direct:ou_901',
                  agentId: 'main',
                  model: 'google/gemini-2.5-pro',
                  updatedAt: 9_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
          return {
            ok: true,
            stdout: JSON.stringify({
              messages: Array.from({ length: 200 }, (_, index) => ({
                id: `msg-${index}`,
                role: index % 2 === 0 ? 'user' : 'assistant',
                content: [{ type: 'text', text: `娑堟伅 ${index}` }],
                createdAt: 9_000 + index,
              })),
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages).toHaveLength(200)
    expect(transcript.externalTranscriptTruncated).toBe(true)
    expect(transcript.externalTranscriptLimit).toBe(200)
  })

  it('returns session-key-missing when external session lacks key after refresh', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-3d')
    const capturedCommands: string[][] = []
    const transcript = await getChatTranscript('remote-session', {
      discoverOpenClaw,
      runCommand: async (args) => {
        capturedCommands.push(args)
        if (args[0] === 'sessions') {
          return {
            ok: true,
            stdout: JSON.stringify({
              sessions: [
                {
                  sessionId: 'remote-session',
                  agentId: 'main',
                  model: 'google/gemini-2.5-pro',
                  updatedAt: 9_000,
                  kind: 'direct',
                },
              ],
            }),
            stderr: '',
            code: 0,
          }
        }

        return {
          ok: false,
          stdout: '',
          stderr: 'unexpected command',
          code: 1,
        }
      },
    })

    expect(transcript.messages).toEqual([])
    expect(transcript.externalTranscriptErrorCode).toBe('session-key-missing')
    expect(capturedCommands.filter((args) => args[0] === 'sessions')).toHaveLength(2)
  })

  it('clears local transcript without deleting the session identity', async () => {
    const discoverOpenClaw = async () =>
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
            installFingerprint: 'fingerprint-4',
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

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-4',
      sessionId: 'session-to-clear',
      agentId: 'main',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          text: '瑕佹竻绌虹殑娑堟伅',
          createdAt: 5_000,
          status: 'sent',
        },
      ],
      updatedAt: 5_000,
    })

    const cleared = await clearChatTranscript('session-to-clear', {
      discoverOpenClaw,
    })
    expect(cleared.ok).toBe(true)

    const transcript = await getChatTranscript('session-to-clear', {
      discoverOpenClaw,
      runCommand: async () => ({
        ok: true,
        stdout: JSON.stringify({
          sessions: [
            {
              sessionId: 'session-to-clear',
              agentId: 'main',
              model: 'openai/gpt-5.1-codex',
              updatedAt: 6_000,
              kind: 'direct',
            },
          ],
        }),
        stderr: '',
        code: 0,
      }),
    })

    expect(transcript.hasLocalTranscript).toBe(false)
    expect(transcript.messages).toEqual([])
    expect(transcript.model).toBe('openai/gpt-5.1-codex')
  })

  it('surfaces a snapshot delta before completion when the stream only exposes a partial JSON reply body', async () => {
    const discoverOpenClaw = async () =>
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
            installFingerprint: 'fingerprint-5',
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

    const emittedEvents: string[] = []
    const result = await sendChatMessage(
      {
        sessionId: 'fallback-session',
        text: '娴嬭瘯鍥為€€',
      },
      {
        discoverOpenClaw,
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async (_args, streamOptions) => {
          streamOptions?.onStdout?.('{\n')
          streamOptions?.onStdout?.('  "response": {\n')
          streamOptions?.onStdout?.('    "text": "鏈€缁堝洖閫€鎴愬姛"\n')
          streamOptions?.onStdout?.('  },\n')
          streamOptions?.onStdout?.('  "model": "openai/gpt-5.1-codex"\n')
          streamOptions?.onStdout?.('}\n')
          return {
            ok: true,
            stdout: JSON.stringify({
              response: {
                text: '鏈€缁堝洖閫€鎴愬姛',
              },
              model: 'openai/gpt-5.1-codex',
            }),
            stderr: '',
            code: 0,
          }
        },
        emit: (event) => emittedEvents.push(event.type),
      }
    )

    expect(result.ok).toBe(true)
    expect(result.message?.text).toBe('鏈€缁堝洖閫€鎴愬姛')
    expect(emittedEvents).toEqual(['assistant-start', 'assistant-delta', 'assistant-complete'])
  })

  it('keeps bundled Windows sends on the gateway socket path instead of silently falling back to CLI', async () => {
    inspectBundledOpenClawDeliveryStatusMock.mockReturnValue({
      manifestPath: 'D:\\bundle\\manifest.json',
      manifest: {} as any,
      platform: 'win32',
      arch: 'x64',
      defaultDeliveryMode: 'bundled-runtime',
      targetDeliveryMode: 'bundled-runtime',
      runtimeArtifact: {} as any,
      runtimePath: 'D:\\bundle\\runtime\\windows-x64',
      runtimeBinaryPath: 'D:\\bundle\\runtime\\windows-x64\\openclaw.cmd',
    })

    const discoverOpenClaw = createDiscovery('fingerprint-bundled-windows-send')
    const result = await sendChatMessage(
      {
        sessionId: 'bundled-win-session',
        text: '测试 bundled runtime 发送链路',
      },
      {
        discoverOpenClaw,
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({
            response: {
              text: 'CLI fallback should stay unused on bundled Windows',
            },
            model: 'openai/gpt-5.1-codex',
          }),
          stderr: '',
          code: 0,
        }),
      }
    )

    if (process.platform === 'win32') {
      expect(result.ok).toBe(false)
      expect(result.sessionId).toBe('bundled-win-session')
      expect(runCliStreamingMock).not.toHaveBeenCalled()
    } else {
      expect(result.ok).toBe(true)
      expect(runCliStreamingMock).toHaveBeenCalledTimes(1)
    }
  })

  it('returns canceled when the chat stream is stopped', async () => {
    const discoverOpenClaw = async () =>
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
            installFingerprint: 'fingerprint-6',
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

    const result = await sendChatMessage(
      {
        sessionId: 'cancel-session',
        text: '鍋滄娴嬭瘯',
      },
      {
        discoverOpenClaw,
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runStreamingCommand: async () => ({
          ok: false,
          stdout: '',
          stderr: 'Command canceled',
          code: null,
          canceled: true,
        }),
      }
    )

    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('canceled')
    expect(result.messageText).toBe('已停止回答')
  })
})
