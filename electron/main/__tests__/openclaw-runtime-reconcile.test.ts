import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  readConfiguredGatewayPortMock,
  probeGatewayPortReachableMock,
  probeGatewaySocketReadyMock,
} = vi.hoisted(() => ({
  readConfiguredGatewayPortMock: vi.fn(),
  probeGatewayPortReachableMock: vi.fn(),
  probeGatewaySocketReadyMock: vi.fn(),
}))

vi.mock('../openclaw-gateway-probes', () => ({
  readConfiguredGatewayPort: readConfiguredGatewayPortMock,
  probeGatewayPortReachable: probeGatewayPortReachableMock,
  probeGatewaySocketReady: probeGatewaySocketReadyMock,
}))
import {
  confirmRuntimeReconcile,
  issueDesiredRuntimeRevision,
  markRuntimeRevisionInProgress,
  markRuntimeRevisionApplied,
  readOpenClawRuntimeReconcileStore,
  readOpenClawRuntimeReconcileStoreForUi,
  recordObservedOpenClawVersion,
  resolveGatewayBlockingReasonFromState,
  resolveOpenClawRuntimeReconcileStorePath,
  sanitizeRuntimeReconcileStoreForUi,
} from '../openclaw-runtime-reconcile'

const fs = (process.getBuiltinModule('node:fs') as typeof import('node:fs')).promises
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

describe('openclaw runtime reconcile store', () => {
  const originalUserDataDir = process.env.QCLAW_USER_DATA_DIR
  let userDataDir = ''

  beforeEach(async () => {
    userDataDir = path.join(
      '/tmp',
      `qclaw-runtime-reconcile-${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
    process.env.QCLAW_USER_DATA_DIR = userDataDir
    await fs.rm(userDataDir, { recursive: true, force: true })
    readConfiguredGatewayPortMock.mockReset()
    probeGatewayPortReachableMock.mockReset()
    probeGatewaySocketReadyMock.mockReset()
    readConfiguredGatewayPortMock.mockResolvedValue(18789)
    probeGatewayPortReachableMock.mockResolvedValue(true)
    probeGatewaySocketReadyMock.mockResolvedValue(true)
  })

  afterEach(async () => {
    await fs.rm(userDataDir, { recursive: true, force: true })
    if (originalUserDataDir === undefined) {
      delete process.env.QCLAW_USER_DATA_DIR
      return
    }
    process.env.QCLAW_USER_DATA_DIR = originalUserDataDir
  })

  it('returns a default store when no persisted state exists', async () => {
    const store = await readOpenClawRuntimeReconcileStore()

    expect(store.version).toBe(1)
    expect(store.runtime.desiredRevision).toBe(0)
    expect(store.runtime.blockingDetail).toBeNull()
    expect(store.lastCompatibility.status).toBe('not_evaluated')
  })

  it('persists observed versions and upgrade assessments', async () => {
    await recordObservedOpenClawVersion('2026.3.11', {
      seenAt: '2026-03-23T10:00:00.000Z',
    })
    const store = await recordObservedOpenClawVersion('v2026.3.22', {
      seenAt: '2026-03-23T10:05:00.000Z',
    })

    expect(store.lastSeenOpenClawVersion).toBe('2026.3.22')
    expect(store.lastSeenVersionBand).toBe('openclaw_2026_3_22')
    expect(store.lastCompatibility.status).toBe('upgrade_detected')
    expect(store.lastCompatibility.previousVersion).toBe('2026.3.11')
  })

  it('tracks desired and applied runtime revisions', async () => {
    const pending = await issueDesiredRuntimeRevision('config', 'config_changed', {
      requestedAt: '2026-03-23T12:00:00.000Z',
      actions: [
        {
          kind: 'migration',
          action: 'issue-revision',
          outcome: 'scheduled',
        },
      ],
    })

    expect(pending.runtime.stateCode).toBe('pending')
    expect(pending.runtime.desiredRevision).toBe(1)
    expect(pending.runtime.appliedRevision).toBe(0)
    expect(pending.runtime.pendingReasons).toEqual(['config_changed'])

    const inProgress = await markRuntimeRevisionInProgress(1, {
      startedAt: '2026-03-23T12:00:30.000Z',
      summary: '正在重载 Gateway 以消费最新配置。',
    })

    expect(inProgress.runtime.stateCode).toBe('in_progress')
    expect(inProgress.runtime.desiredRevision).toBe(1)

    const applied = await markRuntimeRevisionApplied(1, {
      appliedAt: '2026-03-23T12:01:00.000Z',
      summary: 'Gateway 已确认消费最新配置。',
      actions: [
        {
          kind: 'probe',
          action: 'gateway-health',
          outcome: 'succeeded',
        },
      ],
    })

    expect(applied.runtime.stateCode).toBe('ready')
    expect(applied.runtime.appliedRevision).toBe(1)
    expect(applied.runtime.pendingReasons).toEqual([])
    expect(applied.runtime.blockingReason).toBe('none')
  })

  it('keeps pending revisions blocked until the runtime can confirm machine-local auth', async () => {
    const pending = await issueDesiredRuntimeRevision('auth', 'gateway_token_rotated', {
      requestedAt: '2026-03-23T13:00:00.000Z',
    })

    const blocked = await confirmRuntimeReconcile({
      confirmed: false,
      revision: pending.runtime.desiredRevision,
      confirmedAt: '2026-03-23T13:01:00.000Z',
      blockingReason: 'machine_local_auth_missing',
      blockingDetail: {
        source: 'control-ui-app',
        code: 'device_token_mismatch',
        message: '控制界面与本地 Gateway 的 device token 不一致',
        rawMessage: 'device_token_mismatch',
      },
      safeToRetry: false,
      summary: 'Gateway 尚未确认本机认证可用。',
    })

    expect(blocked.runtime.stateCode).toBe('blocked')
    expect(blocked.runtime.desiredRevision).toBe(1)
    expect(blocked.runtime.appliedRevision).toBe(0)
    expect(blocked.runtime.pendingReasons).toEqual(['gateway_token_rotated'])
    expect(blocked.runtime.blockingReason).toBe('machine_local_auth_missing')
    expect(blocked.runtime.blockingDetail).toMatchObject({
      source: 'control-ui-app',
      code: 'device_token_mismatch',
    })
    expect(blocked.runtime.safeToRetry).toBe(false)
  })

  it('maps gateway runtime states into structured blocking reasons', () => {
    expect(resolveGatewayBlockingReasonFromState({ gatewayStateCode: 'auth_missing' })).toBe(
      'machine_local_auth_missing'
    )
    expect(resolveGatewayBlockingReasonFromState({ gatewayStateCode: 'token_mismatch' })).toBe(
      'runtime_token_stale'
    )
    expect(resolveGatewayBlockingReasonFromState({ gatewayStateCode: 'service_loaded_but_stale' })).toBe(
      'service_generation_stale'
    )
    expect(resolveGatewayBlockingReasonFromState({ gatewayStateCode: 'plugin_load_failure' })).toBe(
      'provider_plugin_not_ready'
    )
  })

  it('lets conservative compatibility assessment override otherwise healthy gateway state', () => {
    expect(
      resolveGatewayBlockingReasonFromState({
        gatewayStateCode: 'healthy',
        compatibility: {
          status: 'unknown_future_version',
          currentVersion: '2026.4.6',
          currentBand: 'openclaw_2026_4_candidate',
          previousVersion: '2026.3.24',
          previousBand: 'openclaw_2026_3_23_to_2026_3_24',
          conservativeMode: true,
          warningCodes: ['version_candidate_2026_4', 'version_unknown_future'],
          summary: 'OpenClaw 版本 2026.4.6 已进入候选版本线。2026.4.6 已落在 2026.4.x 候选线，应先完成记忆目录、Agent 协同与升级回退迁移验证。 当前仍按保守兼容模式处理。',
          assessedAt: '2026-04-08T00:00:00.000Z',
        },
      })
    ).toBe('unknown_future_version')
  })

  it('recovers cleanly when the persisted json is invalid', async () => {
    const storePath = resolveOpenClawRuntimeReconcileStorePath()
    await fs.mkdir(path.dirname(storePath), { recursive: true })
    await fs.writeFile(storePath, '{not-valid-json', 'utf8')

    const store = await readOpenClawRuntimeReconcileStore()
    expect(store.version).toBe(1)
    expect(store.runtime.desiredRevision).toBe(0)
  })

  it('downgrades stale ready runtime state for UI readers when no local gateway listener remains', async () => {
    const staleStore = {
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
        conservativeMode: false,
        warningCodes: [],
        summary: 'steady',
        assessedAt: '2026-04-10T00:00:00.000Z',
      },
      runtime: {
        stateCode: 'ready',
        desiredRevision: 3,
        appliedRevision: 3,
        pendingReasons: [],
        lastMutationSource: 'gateway-bootstrap',
        blockingReason: 'none',
        blockingDetail: null,
        safeToRetry: true,
        lastReconcileAt: '2026-04-10T00:00:00.000Z',
        lastReconcileSummary: 'legacy ready',
        lastActions: [],
      },
    } as any

    const sanitized = await sanitizeRuntimeReconcileStoreForUi(staleStore, {
      readConfiguredGatewayPort: async () => 18789,
      probeGatewayPortReachable: async () => false,
      probeGatewaySocketReady: async () => false,
    })

    expect(sanitized.runtime.stateCode).toBe('degraded')
    expect(sanitized.runtime.blockingReason).toBe('service_generation_stale')
    expect(sanitized.runtime.lastReconcileSummary).toContain('已忽略陈旧的 Gateway 运行态')
  })

  it('keeps UI runtime state intact when the gateway socket probe still succeeds', async () => {
    const storePath = resolveOpenClawRuntimeReconcileStorePath()
    await fs.mkdir(path.dirname(storePath), { recursive: true })
    await fs.writeFile(
      storePath,
      JSON.stringify({
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
          conservativeMode: false,
          warningCodes: [],
          summary: 'steady',
          assessedAt: '2026-04-10T00:00:00.000Z',
        },
        runtime: {
          stateCode: 'degraded',
          desiredRevision: 5,
          appliedRevision: 5,
          pendingReasons: [],
          lastMutationSource: 'gateway-bootstrap',
          blockingReason: 'control_ui_handshake_failed',
          blockingDetail: null,
          safeToRetry: true,
          lastReconcileAt: '2026-04-10T00:00:00.000Z',
          lastReconcileSummary: 'compat running',
          lastActions: [],
        },
      }),
      'utf8'
    )

    const store = await readOpenClawRuntimeReconcileStoreForUi({
      readConfiguredGatewayPort: async () => 18789,
      probeGatewayPortReachable: async () => true,
      probeGatewaySocketReady: async () => true,
    })

    expect(store.runtime.stateCode).toBe('degraded')
    expect(store.runtime.blockingReason).toBe('control_ui_handshake_failed')
    expect(store.runtime.lastReconcileSummary).toBe('compat running')
  })
})
