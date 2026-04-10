import { describe, expect, it } from 'vitest'
import { applyLiveOpenClawVersionToRuntimeStore, buildOpenClaw322Notice } from '../../App'

describe('buildOpenClaw322Notice', () => {
  it('prefers the live detected version over stale runtime-store version text', () => {
    const runtimeStore = applyLiveOpenClawVersionToRuntimeStore(
      {
        version: 1,
        lastSeenOpenClawVersion: '2026.3.28',
        lastSeenVersionBand: 'unknown_future',
        lastSeenAt: '2026-03-29T00:00:00.000Z',
        lastCompatibility: {
          status: 'unknown_future_version',
          currentVersion: '2026.3.28',
          currentBand: 'unknown_future',
          previousVersion: '2026.3.24',
          previousBand: 'openclaw_2026_3_23_to_2026_3_24',
          conservativeMode: true,
          warningCodes: ['version_unknown_future'],
          summary: 'OpenClaw 版本 2026.3.28 超出当前审计范围，应进入保守兼容模式。',
          assessedAt: '2026-03-29T00:00:00.000Z',
        },
        runtime: {
          stateCode: 'blocked',
          desiredRevision: 1,
          appliedRevision: 0,
          pendingReasons: ['gateway_runtime_apply'],
          lastMutationSource: 'gateway-bootstrap',
          blockingReason: 'upgrade_incompatible_config',
          blockingDetail: null,
          safeToRetry: false,
          lastReconcileAt: '2026-03-29T00:00:00.000Z',
          lastReconcileSummary: 'Gateway 配置不完整或格式无效',
          lastActions: [],
        },
      },
      '2026.3.24'
    )

    const notice = buildOpenClaw322Notice({
      runtimeStore,
      capabilities: null,
      gatewayRunning: null,
    })

    expect(notice?.title).toBe('OpenClaw 2026.3.24 运行时被阻塞')
    expect(notice?.message).toContain('当前检测到 OpenClaw 2026.3.24。')
    expect(notice?.message).not.toContain('当前检测到 OpenClaw 2026.3.28。')
  })

  it('normalizes raw CLI version banners before notice rendering', () => {
    const runtimeStore = applyLiveOpenClawVersionToRuntimeStore(
      {
        version: 1,
        lastSeenOpenClawVersion: '2026.3.28',
        lastSeenVersionBand: 'unknown_future',
        lastSeenAt: '2026-03-29T00:00:00.000Z',
        lastCompatibility: {
          status: 'unknown_future_version',
          currentVersion: '2026.3.28',
          currentBand: 'unknown_future',
          previousVersion: '2026.3.24',
          previousBand: 'openclaw_2026_3_23_to_2026_3_24',
          conservativeMode: true,
          warningCodes: ['version_unknown_future'],
          summary: 'OpenClaw 版本 2026.3.28 超出当前审计范围，应进入保守兼容模式。',
          assessedAt: '2026-03-29T00:00:00.000Z',
        },
        runtime: {
          stateCode: 'blocked',
          desiredRevision: 1,
          appliedRevision: 0,
          pendingReasons: ['gateway_runtime_apply'],
          lastMutationSource: 'gateway-bootstrap',
          blockingReason: 'upgrade_incompatible_config',
          blockingDetail: null,
          safeToRetry: false,
          lastReconcileAt: '2026-03-29T00:00:00.000Z',
          lastReconcileSummary: 'Gateway 配置不完整或格式无效',
          lastActions: [],
        },
      },
      'OpenClaw 2026.3.24 (cff6dc9)'
    )

    const notice = buildOpenClaw322Notice({
      runtimeStore,
      capabilities: null,
      gatewayRunning: null,
    })

    expect(notice?.title).toBe('OpenClaw 2026.3.24 运行时被阻塞')
    expect(notice?.message).toContain('当前检测到 OpenClaw 2026.3.24。')
    expect(notice?.message).not.toContain('OpenClaw OpenClaw')
    expect(notice?.message).not.toContain('(cff6dc9)')
  })

  it('suppresses stale health-derived blocked notice when gateway health is already running', () => {
    const notice = buildOpenClaw322Notice({
      runtimeStore: {
        version: 1,
        lastSeenOpenClawVersion: '2026.3.24',
        lastSeenVersionBand: 'openclaw_2026_3_23_to_2026_3_24',
        lastSeenAt: '2026-03-29T00:00:00.000Z',
        lastCompatibility: {
          status: 'steady_state',
          currentVersion: '2026.3.24',
          currentBand: 'openclaw_2026_3_23_to_2026_3_24',
          previousVersion: '2026.3.24',
          previousBand: 'openclaw_2026_3_23_to_2026_3_24',
          conservativeMode: false,
          warningCodes: [],
          summary: 'OpenClaw 版本维持在 2026.3.24。',
          assessedAt: '2026-03-29T00:00:00.000Z',
        },
        runtime: {
          stateCode: 'blocked',
          desiredRevision: 1,
          appliedRevision: 0,
          pendingReasons: ['gateway_runtime_apply'],
          lastMutationSource: 'gateway-bootstrap',
          blockingReason: 'upgrade_incompatible_config',
          blockingDetail: null,
          safeToRetry: false,
          lastReconcileAt: '2026-03-29T00:00:00.000Z',
          lastReconcileSummary: 'Gateway 配置不完整或格式无效',
          lastActions: [],
        },
      },
      capabilities: null,
      gatewayRunning: true,
    })

    expect(notice).toBeNull()
  })

  it('uses the detected current version in the title for non-3.22 blocked runtimes', () => {
    const notice = buildOpenClaw322Notice({
      runtimeStore: {
        version: 1,
        lastSeenOpenClawVersion: '2026.3.28',
        lastSeenVersionBand: 'unknown_future',
        lastSeenAt: '2026-03-29T00:00:00.000Z',
        lastCompatibility: {
          status: 'unknown_future_version',
          currentVersion: '2026.3.28',
          currentBand: 'unknown_future',
          previousVersion: '2026.3.24',
          previousBand: 'openclaw_2026_3_23_to_2026_3_24',
          conservativeMode: true,
          warningCodes: ['version_unknown_future'],
          summary: 'OpenClaw 版本 2026.3.28 超出当前审计范围，应进入保守兼容模式。',
          assessedAt: '2026-03-29T00:00:00.000Z',
        },
        runtime: {
          stateCode: 'blocked',
          desiredRevision: 1,
          appliedRevision: 0,
          pendingReasons: ['gateway_runtime_apply'],
          lastMutationSource: 'gateway-bootstrap',
          blockingReason: 'upgrade_incompatible_config',
          blockingDetail: null,
          safeToRetry: false,
          lastReconcileAt: '2026-03-29T00:00:00.000Z',
          lastReconcileSummary: 'Gateway 配置不完整或格式无效',
          lastActions: [],
        },
      },
      capabilities: null,
      gatewayRunning: null,
    })

    expect(notice).toMatchObject({
      title: 'OpenClaw 2026.3.28 运行时被阻塞',
      color: 'red',
    })
    expect(notice?.message).toContain('当前检测到 OpenClaw 2026.3.28。')
    expect(notice?.message).toContain('当前归因：升级后的配置尚未完全兼容。')
  })

  it('shows an explicit candidate-line notice for 2026.4.x even without runtime blocking', () => {
    const notice = buildOpenClaw322Notice({
      runtimeStore: {
        version: 1,
        lastSeenOpenClawVersion: '2026.4.6',
        lastSeenVersionBand: 'openclaw_2026_4_candidate',
        lastSeenAt: '2026-04-08T00:00:00.000Z',
        lastCompatibility: {
          status: 'unknown_future_version',
          currentVersion: '2026.4.6',
          currentBand: 'openclaw_2026_4_candidate',
          previousVersion: '2026.3.24',
          previousBand: 'openclaw_2026_3_23_to_2026_3_24',
          conservativeMode: true,
          warningCodes: ['version_candidate_2026_4', 'version_unknown_future'],
          summary: 'OpenClaw 版本 2026.4.6 超出当前审计范围，应进入保守兼容模式。 当前版本落在 2026.4.x 候选线，应先完成记忆目录、Agent 协同与升级回退迁移验证。',
          assessedAt: '2026-04-08T00:00:00.000Z',
        },
        runtime: {
          stateCode: 'ready',
          desiredRevision: 1,
          appliedRevision: 1,
          pendingReasons: [],
          lastMutationSource: 'gateway-bootstrap',
          blockingReason: 'none',
          blockingDetail: null,
          safeToRetry: true,
          lastReconcileAt: '2026-04-08T00:00:00.000Z',
          lastReconcileSummary: '运行时已就绪',
          lastActions: [],
        },
      },
      capabilities: null,
      gatewayRunning: true,
    })

    expect(notice).toMatchObject({
      title: 'OpenClaw 2026.4.6 候选线兼容提示',
      color: 'yellow',
    })
    expect(notice?.message).toContain('当前检测到 OpenClaw 2026.4.6。')
    expect(notice?.message).toContain('2026.4.x 候选线')
    expect(notice?.message).toContain('记忆目录、Agent 协同与升级回退链路')
  })

  it('adds candidate-line guidance when a 2026.4.x runtime is also blocked', () => {
    const notice = buildOpenClaw322Notice({
      runtimeStore: {
        version: 1,
        lastSeenOpenClawVersion: '2026.4.6',
        lastSeenVersionBand: 'openclaw_2026_4_candidate',
        lastSeenAt: '2026-04-08T00:00:00.000Z',
        lastCompatibility: {
          status: 'unknown_future_version',
          currentVersion: '2026.4.6',
          currentBand: 'openclaw_2026_4_candidate',
          previousVersion: '2026.3.24',
          previousBand: 'openclaw_2026_3_23_to_2026_3_24',
          conservativeMode: true,
          warningCodes: ['version_candidate_2026_4', 'version_unknown_future'],
          summary: 'OpenClaw 版本 2026.4.6 超出当前审计范围，应进入保守兼容模式。 当前版本落在 2026.4.x 候选线，应先完成记忆目录、Agent 协同与升级回退迁移验证。',
          assessedAt: '2026-04-08T00:00:00.000Z',
        },
        runtime: {
          stateCode: 'blocked',
          desiredRevision: 2,
          appliedRevision: 1,
          pendingReasons: ['gateway_runtime_apply'],
          lastMutationSource: 'gateway-bootstrap',
          blockingReason: 'unknown_future_version',
          blockingDetail: null,
          safeToRetry: false,
          lastReconcileAt: '2026-04-08T00:00:00.000Z',
          lastReconcileSummary: '当前版本仍处于保守兼容模式',
          lastActions: [],
        },
      },
      capabilities: null,
      gatewayRunning: null,
    })

    expect(notice?.title).toBe('OpenClaw 2026.4.6 运行时被阻塞')
    expect(notice?.message).toContain('2026.4.x 候选线')
    expect(notice?.message).toContain('当前归因：2026.4.6 已进入 2026.4.x 候选线，当前仍按保守兼容模式处理。')
  })

  it('keeps the legacy 3.22 title for 3.22-band runtimes', () => {
    const notice = buildOpenClaw322Notice({
      runtimeStore: {
        version: 1,
        lastSeenOpenClawVersion: '2026.3.22',
        lastSeenVersionBand: 'openclaw_2026_3_22',
        lastSeenAt: '2026-03-29T00:00:00.000Z',
        lastCompatibility: {
          status: 'steady_state',
          currentVersion: '2026.3.22',
          currentBand: 'openclaw_2026_3_22',
          previousVersion: '2026.3.22',
          previousBand: 'openclaw_2026_3_22',
          conservativeMode: false,
          warningCodes: [],
          summary: 'OpenClaw 版本维持在 2026.3.22，当前版本段为 openclaw_2026_3_22。',
          assessedAt: '2026-03-29T00:00:00.000Z',
        },
        runtime: {
          stateCode: 'blocked',
          desiredRevision: 1,
          appliedRevision: 0,
          pendingReasons: ['gateway_runtime_apply'],
          lastMutationSource: 'gateway-bootstrap',
          blockingReason: 'upgrade_incompatible_config',
          blockingDetail: null,
          safeToRetry: false,
          lastReconcileAt: '2026-03-29T00:00:00.000Z',
          lastReconcileSummary: 'Gateway 配置不完整或格式无效',
          lastActions: [],
        },
      },
      capabilities: null,
      gatewayRunning: null,
    })

    expect(notice?.title).toBe('OpenClaw 3.22 收敛被阻塞')
  })
})
