import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createDefaultOpenClawRuntimeReconcileStore } from '../../shared/gateway-runtime-reconcile-state'
import Dashboard from '../Dashboard'
import {
  runDashboardEntryBootstrapFlow,
  type DashboardEntryBootstrapApi,
} from '../GatewayBootstrapGate'

function createEnsureResult(
  overrides: Partial<Awaited<ReturnType<typeof window.api.ensureGatewayRunning>>> = {}
): Awaited<ReturnType<typeof window.api.ensureGatewayRunning>> {
  return {
    ok: true,
    stdout: '',
    stderr: '',
    code: 0,
    running: true,
    autoInstalledNode: false,
    autoInstalledOpenClaw: false,
    autoInstalledGatewayService: false,
    autoPortMigrated: false,
    effectivePort: 18789,
    stateCode: 'healthy',
    summary: 'Gateway ready',
    attemptedCommands: [],
    evidence: [],
    repairActionsTried: [],
    repairOutcome: 'not-needed',
    safeToRetry: true,
    ...overrides,
  }
}

function createBootstrapApi(
  overrides: Partial<DashboardEntryBootstrapApi> = {}
): DashboardEntryBootstrapApi {
  return {
    ensureGatewayRunning: vi.fn().mockResolvedValue(createEnsureResult()),
    getChatAvailability: vi.fn().mockResolvedValue({
      state: 'ready',
      ready: true,
      canSend: true,
      reason: 'ready',
      gatewayRunning: true,
      connectedModels: ['openai/gpt-5.4-pro'],
      defaultModel: 'openai/gpt-5.4-pro',
      agentId: 'main',
      message: 'Gateway ready',
    }),
    gatewayHealth: vi.fn().mockResolvedValue({
      running: true,
      summary: 'Gateway ready',
      stateCode: 'healthy',
    }),
    getOpenClawRuntimeReconcileState: vi
      .fn()
      .mockResolvedValue(createDefaultOpenClawRuntimeReconcileStore()),
    readConfig: vi.fn().mockResolvedValue({
      channels: {
        feishu: {
          name: 'Feishu Bot',
          appId: 'cli_test_feishu',
          domain: 'feishu',
        },
      },
      models: {
        openai: {
          enabled: true,
        },
      },
    }),
    getModelStatus: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        defaultModel: 'openai/gpt-5.1-codex',
        auth: {
          providers: [{ provider: 'openai-codex', status: 'ok' }],
        },
      },
    }),
    getModelUpstreamState: vi.fn().mockResolvedValue({
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
        hasModelCatalogState: true,
        appKeys: ['helloSnapshot', 'modelCatalogState'],
      },
      data: {
        source: 'control-ui-app',
        connected: true,
        hasClient: true,
        appKeys: ['helloSnapshot', 'modelCatalogState'],
        modelStatusLike: {
          defaultModel: 'openai/gpt-5.4-pro',
          auth: {
            providers: [{ provider: 'openai-codex', status: 'ok' }],
          },
        },
        catalogItemsLike: [
          {
            key: 'openai/gpt-5.4-pro',
            provider: 'openai',
            available: true,
          },
        ],
      },
    }),
    pairingFeishuStatus: vi.fn().mockResolvedValue({
      default: {
        pairedCount: 1,
        pairedUsers: ['ou_123'],
      },
    }),
    getFeishuRuntimeStatus: vi.fn().mockResolvedValue({
      default: {
        runtimeState: 'online',
        summary: 'running',
        issues: [],
      },
    }),
    saveDiagnosticsTrace: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('dashboard entry bootstrap flow', () => {
  it('builds a dashboard entry snapshot and lets Dashboard render from it immediately', async () => {
    const api = createBootstrapApi({
      getChatAvailability: vi.fn().mockResolvedValue({
        state: 'ready',
        ready: true,
        canSend: true,
        reason: 'ready',
        gatewayRunning: true,
        connectedModels: ['openai/gpt-5.4-pro'],
        defaultModel: 'openai/gpt-5.4-pro',
        agentId: 'main',
        message: '',
      }),
      gatewayHealth: vi.fn().mockResolvedValue({
        running: true,
        summary: 'Gateway ready',
      }),
      readConfig: vi.fn().mockResolvedValue({
        channels: {
          feishu: {
            name: 'Feishu Bot',
            appId: 'cli_test_feishu',
            domain: 'feishu',
          },
          telegram: {
            name: 'Telegram Bot',
            domain: 'telegram',
          },
        },
        models: {
          openai: {
            enabled: true,
          },
        },
      }),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.softWarnings).toEqual([])
    expect(result.snapshot).toMatchObject({
      gatewayRunning: true,
      modelStatus: {
        defaultModel: 'openai/gpt-5.4-pro',
      },
      pairingSummary: {
        feishuBotCount: 1,
        pairedBotCount: 1,
        degradedBotCount: 0,
        offlineBotCount: 0,
        otherChannelCount: 1,
      },
    })

    const html = renderToStaticMarkup(
      <MantineProvider>
        <Dashboard entrySnapshot={result.snapshot} />
      </MantineProvider>
    )

    expect(html).toContain('飞书')
    expect(html).toContain('Telegram Bot')
    expect(html).toContain('openai/gpt-5.4-pro')
    expect(api.ensureGatewayRunning).toHaveBeenCalledWith({
      skipRuntimePrecheck: true,
      requestId: 'dashboard-entry-bootstrap',
    })
    expect(api.getModelStatus).not.toHaveBeenCalled()
  })

  it('lets post-start gateway health override stale availability snapshots on dashboard entry', async () => {
    const runtimeStore = createDefaultOpenClawRuntimeReconcileStore()
    runtimeStore.lastSeenVersionBand = 'openclaw_2026_3_23_to_2026_3_24'
    runtimeStore.runtime.stateCode = 'degraded'
    runtimeStore.runtime.safeToRetry = true
    runtimeStore.runtime.blockingReason = 'control_ui_handshake_failed'
    runtimeStore.runtime.lastReconcileSummary = 'compat runtime confirmed'

    const api = createBootstrapApi({
      getChatAvailability: vi.fn().mockResolvedValue({
        state: 'offline',
        ready: false,
        canSend: false,
        reason: 'gateway-offline',
        gatewayRunning: false,
        connectedModels: ['openai/gpt-5.4-pro'],
        defaultModel: 'openai/gpt-5.4-pro',
        agentId: 'main',
        message: 'Gateway availability snapshot stale',
      }),
      gatewayHealth: vi.fn().mockResolvedValue({
        running: true,
        summary: 'Gateway ready after ensure',
        stateCode: 'healthy',
      }),
      getOpenClawRuntimeReconcileState: vi.fn().mockResolvedValue(runtimeStore),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.snapshot.gatewayRunning).toBe(true)
    expect(result.softWarnings).toEqual([])
  })

  it('keeps dashboard entry unblocked when health confirmation cannot be read after ensure succeeds', async () => {
    const api = createBootstrapApi({
      getChatAvailability: vi.fn().mockResolvedValue({
        state: 'offline',
        ready: false,
        canSend: false,
        reason: 'gateway-offline',
        gatewayRunning: false,
        connectedModels: ['openai/gpt-5.4-pro'],
        defaultModel: 'openai/gpt-5.4-pro',
        agentId: 'main',
        message: 'availability snapshot still warming',
      }),
      gatewayHealth: vi.fn().mockRejectedValue(new Error('health down')),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.snapshot.gatewayRunning).toBe(true)
    expect(result.softWarnings.join('\n')).toContain('Gateway 健康')

    const html = renderToStaticMarkup(
      <MantineProvider>
        <Dashboard entrySnapshot={result.snapshot} />
      </MantineProvider>
    )

    expect(html).toContain('运行中')
  })

  it('keeps pairing reads as soft-blocking warnings without blocking dashboard entry', async () => {
    const api = createBootstrapApi({
      readConfig: vi.fn().mockResolvedValue({
        channels: {
          feishu: {
            name: 'Feishu Bot',
            appId: 'cli_test_feishu',
            domain: 'feishu',
          },
        },
      }),
      pairingFeishuStatus: vi.fn().mockRejectedValue(new Error('pairing down')),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.softWarnings).toContain('飞书配对状态读取失败：pairing down')
    expect(result.snapshot.pairingSummary).toBeNull()
    expect(result.snapshot.modelStatus).toMatchObject({
      defaultModel: 'openai/gpt-5.4-pro',
    })
  })

  it('treats feishu runtime reads as soft warnings without blocking dashboard entry', async () => {
    const api = createBootstrapApi({
      getFeishuRuntimeStatus: vi.fn().mockRejectedValue(new Error('runtime down')),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.softWarnings).toContain('飞书运行态读取失败：runtime down')
    expect(result.snapshot.pairingSummary).toBeNull()
  })

  it('adds a soft warning when model status snapshot fails', async () => {
    const api = createBootstrapApi({
      getModelUpstreamState: vi.fn().mockResolvedValue({
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
      }),
      getModelStatus: vi.fn().mockResolvedValue({
        ok: false,
      }),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.softWarnings).toContain(
      '模型上游状态暂不可用，已回退到 CLI 状态快照：control-ui-app-unavailable'
    )
    expect(result.softWarnings).toContain(
      '模型状态读取失败：控制面板将先按配置快照显示模型信息。'
    )
    expect(result.snapshot.modelStatus).toBeNull()
  })

  it('falls back to CLI model status when upstream state is unavailable', async () => {
    const api = createBootstrapApi({
      getModelUpstreamState: vi.fn().mockResolvedValue({
        ok: false,
        source: 'control-ui-app',
        fallbackUsed: true,
        fallbackReason: 'control-ui-app-missing-model-state',
        diagnostics: {
          upstreamAvailable: true,
          connected: true,
          hasClient: true,
          hasHelloSnapshot: false,
          hasHealthResult: false,
          hasSessionsState: false,
          hasModelCatalogState: false,
          appKeys: [],
        },
      }),
      getModelStatus: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          defaultModel: 'anthropic/claude-sonnet-4-6',
        },
      }),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.snapshot.modelStatus).toMatchObject({
      defaultModel: 'anthropic/claude-sonnet-4-6',
    })
    expect(result.softWarnings).toContain(
      '模型上游状态暂不可用，已回退到 CLI 状态快照：control-ui-app-missing-model-state'
    )
    expect(api.getModelStatus).toHaveBeenCalledTimes(1)
  })

  it('treats explicit post-start gateway health failures as degraded-continue when runtime hints are available', async () => {
    const api = createBootstrapApi({
      getChatAvailability: vi.fn().mockResolvedValue({
        state: 'offline',
        ready: false,
        canSend: false,
        reason: 'gateway-offline',
        gatewayRunning: false,
        connectedModels: ['openai/gpt-5.4-pro'],
        defaultModel: 'openai/gpt-5.4-pro',
        agentId: 'main',
        message: 'Gateway not ready',
      }),
      gatewayHealth: vi.fn().mockResolvedValue({
        running: false,
        summary: 'Gateway not ready',
        stateCode: 'gateway_not_running',
      }),
    })

    const result = await runDashboardEntryBootstrapFlow(api)
    expect(result.snapshot.gatewayRunning).toBe(true)
    expect(result.softWarnings.join('\n')).toContain('Gateway 健康探针暂未确认可用')
  })

  it('lets dashboard entry continue when the health probe is stale but the chat entry is already ready', async () => {
    const api = createBootstrapApi({
      getChatAvailability: vi.fn().mockResolvedValue({
        state: 'ready',
        ready: true,
        canSend: true,
        reason: 'ready',
        gatewayRunning: true,
        connectedModels: ['openai/gpt-5.4-pro'],
        defaultModel: 'openai/gpt-5.4-pro',
        agentId: 'main',
        message: 'Gateway ready from availability probe',
      }),
      gatewayHealth: vi.fn().mockResolvedValue({
        running: false,
        summary: 'Gateway auth still aligning',
        stateCode: 'auth_missing',
      }),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.snapshot.gatewayRunning).toBe(true)
    expect(result.softWarnings.join('\n')).toContain('Gateway 健康探针暂未确认可用')
    expect(api.gatewayHealth).toHaveBeenCalledTimes(1)
    expect(api.getChatAvailability).toHaveBeenCalledTimes(1)
  })

  it('waits through the first post-start health mismatch before failing dashboard entry', async () => {
    const api = createBootstrapApi({
      getChatAvailability: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'offline',
          ready: false,
          canSend: false,
          reason: 'gateway-offline',
          gatewayRunning: false,
          connectedModels: ['openai/gpt-5.4-pro'],
          defaultModel: 'openai/gpt-5.4-pro',
          agentId: 'main',
          message: 'Gateway still warming',
        })
        .mockResolvedValueOnce({
          state: 'ready',
          ready: true,
          canSend: true,
          reason: 'ready',
          gatewayRunning: true,
          connectedModels: ['openai/gpt-5.4-pro'],
          defaultModel: 'openai/gpt-5.4-pro',
          agentId: 'main',
          message: 'Gateway ready after warmup',
        }),
      gatewayHealth: vi
        .fn()
        .mockResolvedValueOnce({
          running: false,
          summary: 'Gateway auth still aligning',
          stateCode: 'machine_local_auth_missing',
        })
        .mockResolvedValueOnce({
          running: true,
          summary: 'Gateway ready after warmup',
          stateCode: 'healthy',
        }),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.snapshot.gatewayRunning).toBe(true)
    expect(result.softWarnings.join('\n')).toContain('Gateway 健康探针暂未确认可用')
    expect(api.gatewayHealth).toHaveBeenCalledTimes(1)
    expect(api.getChatAvailability).toHaveBeenCalledTimes(1)
  })

  it('extends the dashboard-entry warmup window when auth alignment is still settling', async () => {
    const api = createBootstrapApi({
      getChatAvailability: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'offline',
          ready: false,
          canSend: false,
          reason: 'gateway-offline',
          gatewayRunning: false,
          connectedModels: ['openai/gpt-5.4-pro'],
          defaultModel: 'openai/gpt-5.4-pro',
          agentId: 'main',
          message: 'Gateway still warming',
        })
        .mockResolvedValueOnce({
          state: 'offline',
          ready: false,
          canSend: false,
          reason: 'gateway-offline',
          gatewayRunning: false,
          connectedModels: ['openai/gpt-5.4-pro'],
          defaultModel: 'openai/gpt-5.4-pro',
          agentId: 'main',
          message: '模型认证仍在对齐',
        })
        .mockResolvedValueOnce({
          state: 'ready',
          ready: true,
          canSend: true,
          reason: 'ready',
          gatewayRunning: true,
          connectedModels: ['openai/gpt-5.4-pro'],
          defaultModel: 'openai/gpt-5.4-pro',
          agentId: 'main',
          message: 'Gateway ready after extended warmup',
        }),
      gatewayHealth: vi
        .fn()
        .mockResolvedValueOnce({
          running: false,
          summary: 'Gateway auth still aligning',
          stateCode: 'auth_missing',
        })
        .mockResolvedValueOnce({
          running: false,
          summary: 'Gateway auth still aligning',
          stateCode: 'auth_missing',
        })
        .mockResolvedValueOnce({
          running: true,
          summary: 'Gateway ready after extended warmup',
          stateCode: 'healthy',
        }),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.snapshot.gatewayRunning).toBe(true)
    expect(result.softWarnings.join('\n')).toContain('Gateway 健康探针暂未确认可用')
    expect(api.gatewayHealth).toHaveBeenCalledTimes(1)
    expect(api.getChatAvailability).toHaveBeenCalledTimes(1)
  })

  it('enters the dashboard with a soft warning when post-start auth alignment is still not stable', async () => {
    const api = createBootstrapApi({
      ensureGatewayRunning: vi.fn().mockResolvedValue(createEnsureResult({
        summary: 'Gateway start issued',
      })),
      getChatAvailability: vi.fn().mockResolvedValue({
        state: 'offline',
        ready: false,
        canSend: false,
        reason: 'gateway-offline',
        gatewayRunning: false,
        connectedModels: ['openai/gpt-5.4-pro'],
        defaultModel: 'openai/gpt-5.4-pro',
        agentId: 'main',
        message: '模型认证仍在对齐',
      }),
      gatewayHealth: vi.fn().mockResolvedValue({
        running: false,
        summary: 'Gateway auth still aligning',
        stateCode: 'auth_missing',
      }),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.snapshot.gatewayRunning).toBe(true)
    expect(result.softWarnings.join('\n')).toContain('Gateway 健康探针暂未确认可用')
    expect(api.ensureGatewayRunning).toHaveBeenCalledTimes(1)
  })

  it('auto-retries the backend gateway ensure once when the first bootstrap run is still auto-recovering', async () => {
    const api = createBootstrapApi({
      ensureGatewayRunning: vi
        .fn()
        .mockResolvedValueOnce(createEnsureResult({
          summary: 'Gateway first start issued',
        }))
        .mockResolvedValueOnce(createEnsureResult({
          summary: 'Gateway recovered on second ensure',
        })),
      getChatAvailability: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'offline',
          ready: false,
          canSend: false,
          reason: 'gateway-offline',
          gatewayRunning: false,
          connectedModels: ['openai/gpt-5.4-pro'],
          defaultModel: 'openai/gpt-5.4-pro',
          agentId: 'main',
          message: '模型认证仍在对齐',
        })
        .mockResolvedValueOnce({
          state: 'offline',
          ready: false,
          canSend: false,
          reason: 'gateway-offline',
          gatewayRunning: false,
          connectedModels: ['openai/gpt-5.4-pro'],
          defaultModel: 'openai/gpt-5.4-pro',
          agentId: 'main',
          message: 'Gateway restart pending',
        })
        .mockResolvedValueOnce({
          state: 'offline',
          ready: false,
          canSend: false,
          reason: 'gateway-offline',
          gatewayRunning: false,
          connectedModels: ['openai/gpt-5.4-pro'],
          defaultModel: 'openai/gpt-5.4-pro',
          agentId: 'main',
          message: 'Gateway still recovering',
        })
        .mockResolvedValueOnce({
          state: 'ready',
          ready: true,
          canSend: true,
          reason: 'ready',
          gatewayRunning: true,
          connectedModels: ['openai/gpt-5.4-pro'],
          defaultModel: 'openai/gpt-5.4-pro',
          agentId: 'main',
          message: 'Gateway recovered',
        }),
      gatewayHealth: vi
        .fn()
        .mockResolvedValueOnce({
          running: false,
          summary: 'Gateway auth still aligning',
          stateCode: 'auth_missing',
        })
        .mockResolvedValueOnce({
          running: false,
          summary: 'Gateway auth still aligning',
          stateCode: 'auth_missing',
        })
        .mockResolvedValueOnce({
          running: false,
          summary: 'Gateway auth still aligning',
          stateCode: 'auth_missing',
        })
        .mockResolvedValueOnce({
          running: true,
          summary: 'Gateway recovered',
          stateCode: 'healthy',
        }),
    })

    const result = await runDashboardEntryBootstrapFlow(api)

    expect(result.snapshot.gatewayRunning).toBe(true)
    expect(result.softWarnings.join('\n')).toContain('Gateway 健康探针暂未确认可用')
    expect(api.ensureGatewayRunning).toHaveBeenCalledTimes(1)
    expect(api.ensureGatewayRunning).toHaveBeenNthCalledWith(1, {
      skipRuntimePrecheck: true,
      requestId: 'dashboard-entry-bootstrap',
    })
  })

  it('treats ensure-gateway failures as a hard block', async () => {
    const api = createBootstrapApi({
      ensureGatewayRunning: vi.fn().mockResolvedValue(
        createEnsureResult({
          ok: false,
          running: false,
          code: 1,
          stateCode: 'gateway_not_running',
          summary: 'Gateway start failed',
          stderr: 'Gateway start failed',
        })
      ),
    })

    await expect(runDashboardEntryBootstrapFlow(api)).rejects.toMatchObject({
      title: expect.any(String),
    })
  })

  it('treats config reads as a hard block', async () => {
    const api = createBootstrapApi({
      readConfig: vi.fn().mockRejectedValue(new Error('disk unavailable')),
    })

    await expect(runDashboardEntryBootstrapFlow(api)).rejects.toMatchObject({
      title: '共享配置暂时不可读取',
    })
  })
})

