import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ensureFeishuManagedAgentAuthBootstrapMock,
  ensureFeishuManagedWorkspaceBootstrapMock,
  getOpenClawPathsMock,
  readConfigMock,
  runCliMock,
  restartGatewayLifecycleMock,
  guardedWriteConfigMock,
} = vi.hoisted(() => ({
  ensureFeishuManagedAgentAuthBootstrapMock: vi.fn(),
  ensureFeishuManagedWorkspaceBootstrapMock: vi.fn(),
  getOpenClawPathsMock: vi.fn(),
  readConfigMock: vi.fn(),
  runCliMock: vi.fn(),
  restartGatewayLifecycleMock: vi.fn(),
  guardedWriteConfigMock: vi.fn(),
}))

vi.mock('../cli', () => ({
  getOpenClawPaths: getOpenClawPathsMock,
  readConfig: readConfigMock,
  runCli: runCliMock,
}))

vi.mock('../gateway-lifecycle-controller', () => ({
  restartGatewayLifecycle: restartGatewayLifecycleMock,
}))

vi.mock('../openclaw-config-guard', () => ({
  guardedWriteConfig: guardedWriteConfigMock,
}))

vi.mock('../feishu-managed-workspace-bootstrap', () => ({
  ensureFeishuManagedWorkspaceBootstrap: ensureFeishuManagedWorkspaceBootstrapMock,
}))

vi.mock('../feishu-managed-auth-bootstrap', () => ({
  ensureFeishuManagedAgentAuthBootstrap: ensureFeishuManagedAgentAuthBootstrapMock,
}))

import { applyConfigPatchGuarded } from '../openclaw-config-coordinator'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function waitForGuardedWriteCalls(expectedCalls: number, timeoutMs = 200): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (guardedWriteConfigMock.mock.calls.length >= expectedCalls) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`Timed out waiting for ${expectedCalls} guarded write calls`)
}

describe('openclaw config coordinator', () => {
  beforeEach(() => {
    ensureFeishuManagedAgentAuthBootstrapMock.mockReset()
    ensureFeishuManagedWorkspaceBootstrapMock.mockReset()
    getOpenClawPathsMock.mockReset()
    readConfigMock.mockReset()
    runCliMock.mockReset()
    restartGatewayLifecycleMock.mockReset()
    guardedWriteConfigMock.mockReset()

    ensureFeishuManagedAgentAuthBootstrapMock.mockResolvedValue({
      ok: true,
      changed: false,
      providerIds: [],
      targetAgentIds: [],
      updatedAgentIds: [],
      importedProfileIds: [],
      importedProviders: [],
      sourceAuthStorePaths: [],
    })
    ensureFeishuManagedWorkspaceBootstrapMock.mockResolvedValue({
      changed: false,
      changedWorkspaces: [],
    })
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    runCliMock.mockResolvedValue({
      ok: true,
      stdout: '',
      stderr: '',
      code: 0,
    })
    restartGatewayLifecycleMock.mockResolvedValue({
      ok: true,
      stdout: '',
      stderr: '',
      code: 0,
    })
  })

  it('rebases patch edits on top of latest config to preserve unrelated concurrent changes', async () => {
    readConfigMock.mockResolvedValue({
      channels: {
        telegram: {
          enabled: true,
        },
      },
      models: {
        openai: {
          enabled: false,
        },
      },
      ui: {
        compact: true,
      },
    })
    guardedWriteConfigMock.mockResolvedValue({
      ok: true,
      blocked: false,
      wrote: true,
      target: 'config',
      snapshotCreated: false,
      snapshot: null,
      changedJsonPaths: ['$.channels.telegram'],
      ownershipSummary: null,
      message: 'ok',
    })

    await applyConfigPatchGuarded({
      beforeConfig: {
        channels: {
          telegram: {
            enabled: true,
          },
        },
        models: {
          openai: {
            enabled: true,
          },
        },
      },
      afterConfig: {
        channels: {},
        models: {
          openai: {
            enabled: true,
          },
        },
      },
      reason: 'channels-remove-channel',
    })

    expect(guardedWriteConfigMock).toHaveBeenCalledTimes(1)
    expect(guardedWriteConfigMock).toHaveBeenCalledWith(
      {
        config: {
          channels: {},
          models: {
            openai: {
              enabled: false,
            },
          },
          ui: {
            compact: true,
          },
        },
        reason: 'channels-remove-channel',
      },
      undefined
    )
    expect(restartGatewayLifecycleMock).toHaveBeenCalledTimes(1)
    expect(runCliMock).not.toHaveBeenCalled()
  })

  it('syncs the Feishu managed workspace bootstrap after a successful config write', async () => {
    const beforeConfig = {
      channels: {
        feishu: {},
      },
    }
    const afterConfig = {
      channels: {
        feishu: {
          enabled: true,
          accounts: {
            'bot-123456': {
              enabled: true,
              name: '飞书 Bot 123456',
              appId: 'cli_123456',
              appSecret: 'secret',
            },
          },
        },
      },
    }

    readConfigMock.mockResolvedValue(beforeConfig)
    guardedWriteConfigMock.mockResolvedValue({
      ok: true,
      blocked: false,
      wrote: true,
      target: 'config',
      snapshotCreated: false,
      snapshot: null,
      changedJsonPaths: ['$.channels.feishu.accounts.bot-123456'],
      ownershipSummary: null,
      message: 'ok',
    })

    await applyConfigPatchGuarded(
      {
        beforeConfig,
        afterConfig,
        reason: 'unknown',
      },
      undefined,
      {
        applyGatewayPolicy: false,
      }
    )

    expect(getOpenClawPathsMock).toHaveBeenCalledTimes(1)
    expect(ensureFeishuManagedWorkspaceBootstrapMock).toHaveBeenCalledWith({
      homeDir: '/Users/alice/.openclaw',
      config: afterConfig,
    })
    expect(ensureFeishuManagedAgentAuthBootstrapMock).toHaveBeenCalledWith({
      homeDir: '/Users/alice/.openclaw',
      config: afterConfig,
    })
  })

  it('serializes concurrent config patch requests through one write queue', async () => {
    const firstWrite = createDeferred<any>()

    readConfigMock.mockResolvedValue({})
    guardedWriteConfigMock
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValueOnce({
        ok: true,
        blocked: false,
        wrote: true,
        target: 'config',
        snapshotCreated: false,
        snapshot: null,
        changedJsonPaths: ['$.b'],
        ownershipSummary: null,
      })

    const firstCall = applyConfigPatchGuarded({
      beforeConfig: { a: 1 },
      afterConfig: { a: 2 },
      reason: 'unknown',
    })
    const secondCall = applyConfigPatchGuarded({
      beforeConfig: { b: 1 },
      afterConfig: { b: 2 },
      reason: 'unknown',
    })

    await waitForGuardedWriteCalls(1)
    expect(guardedWriteConfigMock).toHaveBeenCalledTimes(1)

    firstWrite.resolve({
      ok: true,
      blocked: false,
      wrote: true,
      target: 'config',
      snapshotCreated: false,
      snapshot: null,
      changedJsonPaths: ['$.a'],
      ownershipSummary: null,
    })

    await Promise.all([firstCall, secondCall])
    expect(guardedWriteConfigMock).toHaveBeenCalledTimes(2)
    expect(runCliMock).not.toHaveBeenCalled()
    expect(restartGatewayLifecycleMock).not.toHaveBeenCalled()
  })

  it('reads latest config from preferred candidate when rebasing a guarded patch', async () => {
    const preferredCandidate = {
      candidateId: 'candidate-1',
      binaryPath: 'C:/openclaw/openclaw.cmd',
      resolvedBinaryPath: 'C:/openclaw/openclaw.cmd',
      packageRoot: 'C:/openclaw',
      version: '2026.3.24',
      installSource: 'custom' as const,
      isPathActive: true,
      stateRoot: 'C:/Users/James/AppData/Roaming/Mclaw/openclaw-state/.openclaw',
      configPath: 'C:/Users/James/AppData/Roaming/Mclaw/openclaw-state/.openclaw/openclaw.json',
      displayConfigPath: 'C:/Users/James/AppData/Roaming/Mclaw/openclaw-state/.openclaw/openclaw.json',
      displayStateRoot: 'C:/Users/James/AppData/Roaming/Mclaw/openclaw-state/.openclaw',
      ownershipState: 'qclaw-installed' as const,
      installFingerprint: 'fingerprint-1',
      baselineBackup: null,
      baselineBackupBypass: null,
    }

    readConfigMock.mockResolvedValue({
      channels: {
        feishu: {
          enabled: true,
        },
      },
    })
    guardedWriteConfigMock.mockResolvedValue({
      ok: true,
      blocked: false,
      wrote: true,
      target: 'config',
      snapshotCreated: false,
      snapshot: null,
      changedJsonPaths: ['$.channels.openclaw-weixin'],
      ownershipSummary: null,
      message: 'ok',
    })

    await applyConfigPatchGuarded(
      {
        beforeConfig: {},
        afterConfig: {
          channels: {
            'openclaw-weixin': {
              enabled: true,
            },
          },
        },
        reason: 'channel-connect-configure',
      },
      preferredCandidate,
      {
        applyGatewayPolicy: false,
      }
    )

    expect(readConfigMock).toHaveBeenCalledWith({
      candidate: preferredCandidate,
    })
    expect(guardedWriteConfigMock).toHaveBeenCalledWith(
      {
        config: {
          channels: {
            'openclaw-weixin': {
              enabled: true,
            },
          },
        },
        reason: 'channel-connect-configure',
      },
      preferredCandidate
    )
  })

  it('skips gateway apply actions when applyGatewayPolicy is disabled', async () => {
    readConfigMock.mockResolvedValue({
      channels: {
        feishu: {
          enabled: true,
        },
      },
    })
    guardedWriteConfigMock.mockResolvedValue({
      ok: true,
      blocked: false,
      wrote: true,
      target: 'config',
      snapshotCreated: false,
      snapshot: null,
      changedJsonPaths: ['$.channels.feishu.enabled'],
      ownershipSummary: null,
      message: 'ok',
    })

    await applyConfigPatchGuarded(
      {
        beforeConfig: {
          channels: {
            feishu: {
              enabled: true,
            },
          },
        },
        afterConfig: {
          channels: {},
        },
        reason: 'channels-remove-channel',
      },
      undefined,
      {
        applyGatewayPolicy: false,
      }
    )

    expect(runCliMock).not.toHaveBeenCalled()
    expect(restartGatewayLifecycleMock).not.toHaveBeenCalled()
  })

  it('falls back to gateway restart when hot-reload fails', async () => {
    readConfigMock.mockResolvedValue({
      gateway: {
        auth: {
          token: 'old-token',
        },
      },
    })
    guardedWriteConfigMock.mockResolvedValue({
      ok: true,
      blocked: false,
      wrote: true,
      target: 'config',
      snapshotCreated: false,
      snapshot: null,
      changedJsonPaths: ['$.gateway.auth.token'],
      ownershipSummary: null,
      message: 'ok',
    })
    runCliMock.mockResolvedValueOnce({
      ok: false,
      stdout: '',
      stderr: 'reload failed',
      code: 1,
    })

    const result = await applyConfigPatchGuarded({
      beforeConfig: {
        gateway: {
          auth: {
            token: 'old-token',
          },
        },
      },
      afterConfig: {
        gateway: {
          auth: {
            token: 'new-token',
          },
        },
      },
      reason: 'unknown',
    })

    expect(result.gatewayApply).toEqual({
      ok: true,
      requestedAction: 'hot-reload',
      appliedAction: 'restart',
      note: 'hot-reload failed, fallback to restart',
    })
    expect(runCliMock).toHaveBeenCalledTimes(1)
    expect(runCliMock).toHaveBeenCalledWith(['secrets', 'reload'], undefined, 'config-write')
    expect(restartGatewayLifecycleMock).toHaveBeenCalledTimes(1)
  })

  it('keeps write success when config write succeeds but gateway apply action fails', async () => {
    readConfigMock.mockResolvedValue({
      gateway: {
        auth: {
          token: 'old-token',
        },
      },
    })
    guardedWriteConfigMock.mockResolvedValue({
      ok: true,
      blocked: false,
      wrote: true,
      target: 'config',
      snapshotCreated: false,
      snapshot: null,
      changedJsonPaths: ['$.gateway.auth.token'],
      ownershipSummary: null,
      message: 'ok',
    })
    runCliMock.mockResolvedValueOnce({
      ok: false,
      stdout: '',
      stderr: 'reload failed',
      code: 1,
    })
    restartGatewayLifecycleMock.mockResolvedValueOnce({
      ok: false,
      stdout: '',
      stderr: 'restart failed',
      code: 1,
    })

    const result = await applyConfigPatchGuarded({
      beforeConfig: {
        gateway: {
          auth: {
            token: 'old-token',
          },
        },
      },
      afterConfig: {
        gateway: {
          auth: {
            token: 'new-token',
          },
        },
      },
      reason: 'unknown',
    })

    expect(result.ok).toBe(true)
    expect(result.wrote).toBe(true)
    expect(result.message).toContain('配置写入成功，但网关生效动作失败')
    expect(result.message).toContain('请稍后手动重载 Gateway')
    expect(result.gatewayApply).toEqual({
      ok: false,
      requestedAction: 'hot-reload',
      appliedAction: 'restart',
      note: 'restart failed',
    })
    expect(runCliMock).toHaveBeenCalledTimes(1)
    expect(restartGatewayLifecycleMock).toHaveBeenCalledTimes(1)
  })
})
