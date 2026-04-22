import { describe, expect, it } from 'vitest'
import * as EnvCheckModule from '../EnvCheck'
import {
  buildOpenClawAutoCorrectionConsentMessage,
  buildOpenClawGateState,
  canContinueWithOpenClawGate,
  canContinueHistoryOnlyRecovery,
  canShowOpenClawUpgradeAction,
  classifyNodeInstallerFailureForPlatform,
  clearTakeoverFailure,
  createEnvCheckReadyPayload,
  createEnvCheckRestartState,
  formatTakeoverFailureManualBackupWarning,
  isMacPlatform,
  resolveEnvCheckNodeCheckState,
  resolveEnvCheckNodeInstallPrepState,
  resolveEnvCheckNodePostInstallRecheckState,
  resolveEnvCheckNodeStepState,
  resolveGatewayBehavior,
  resolveGatewayDeferredStepState,
  resolveEnvCheckFinalizeState,
  resolveNodeInstallPlatformBehavior,
  resolveEnvCheckPlatformState,
  resolveOpenClawInstallBehavior,
  resolveOpenClawDeliveryNoticeState,
  resolveOpenClawSourceBadgeState,
  resolveActiveTakeoverFailure,
  resolveEnvInstallProgressStep,
  resolveTakeoverBackupRootDirectory,
  retryOpenClawLatestVersionCheck,
  shouldInspectNodeInstallerForPlatform,
  shouldOfferManualNodeUpgrade,
  shouldPrepareMacDeveloperTools,
  shouldRenderStartupIssueInline,
} from '../EnvCheck'

describe('createEnvCheckRestartState', () => {
  it('resets env-check UI state and advances the run token for a real retry', () => {
    const state = createEnvCheckRestartState(2)

    expect(state.runAttempt).toBe(3)
    expect(state.currentStep).toBe(0)
    expect(state.progress).toBe(0)
    expect(state.tipIndex).toBe(0)
    expect(state.fatalIssue).toBeNull()
    expect(state.startupIssuePrompt).toBeNull()
    expect(state.steps.map((step) => ({ id: step.id, status: step.status }))).toEqual([
      { id: 'node', status: 'pending' },
      { id: 'openclaw', status: 'pending' },
      { id: 'gateway', status: 'pending' },
    ])
  })

  it('builds a stable ready payload for the post-env-check handoff state', () => {
    expect(
      createEnvCheckReadyPayload({
        hadOpenClawInstalled: true,
        installedOpenClawDuringCheck: false,
        sharedConfigInitialized: true,
        discoveryResult: null,
      })
    ).toEqual({
      hadOpenClawInstalled: true,
      installedOpenClawDuringCheck: false,
      gatewayRunning: false,
      sharedConfigInitialized: true,
      discoveryResult: null,
    })
  })

  it('builds a stable finalize state for the deferred gateway handoff', () => {
    expect(
      resolveEnvCheckFinalizeState({
        gatewayBehavior: resolveGatewayBehavior(),
        hadOpenClawInstalled: false,
        installedOpenClawDuringCheck: true,
        sharedConfigInitialized: false,
        discoveryResult: null,
      })
    ).toEqual({
      gatewayStep: {
        status: 'ok',
        version: '自动启动',
        description: '进入控制面板时会自动启动 Gateway 并确认本地对话可用，无需手动打开终端。',
        progress: 100,
      },
      progress: 100,
      isRunning: false,
      readyPayload: {
        hadOpenClawInstalled: false,
        installedOpenClawDuringCheck: true,
        gatewayRunning: false,
        sharedConfigInitialized: false,
        discoveryResult: null,
      },
    })
  })

  it('normalizes node check results into a stable env-check state snapshot', () => {
    expect(
      resolveEnvCheckNodeCheckState({
        installed: false,
        version: '',
        needsUpgrade: false,
        meetsRequirement: false,
        requiredVersion: '',
        targetVersion: '22.18.0',
        installStrategy: 'installer',
      })
    ).toEqual({
      requiredVersion: '22.16.0',
      targetVersion: '22.18.0',
      needNode: true,
      nodeNeedsUpgrade: false,
    })

    expect(
      resolveEnvCheckNodeCheckState({
        installed: true,
        version: 'v22.15.0',
        needsUpgrade: true,
        meetsRequirement: false,
        requiredVersion: '22.16.0',
        targetVersion: '22.18.0',
        installStrategy: 'installer',
      })
    ).toEqual({
      requiredVersion: '22.16.0',
      targetVersion: '22.18.0',
      needNode: false,
      nodeNeedsUpgrade: true,
    })
  })

  it('maps normalized node check state into the correct node step display state', () => {
    expect(
      resolveEnvCheckNodeStepState({
        nodeResult: {
          installed: false,
          version: '',
        },
        nodeCheckState: {
          requiredVersion: '22.16.0',
          targetVersion: '22.18.0',
          needNode: true,
          nodeNeedsUpgrade: false,
        },
        nodeInstallBehavior: resolveNodeInstallPlatformBehavior('win32'),
      })
    ).toEqual({
      status: 'pending-install',
      description: '未检测到 Node.js，系统将自动安装官方最新稳定版',
      progress: 20,
      latestNodeVersion: '22.18.0',
      blocksContinue: false,
    })

    expect(
      resolveEnvCheckNodeStepState({
        nodeResult: {
          installed: true,
          version: 'v22.15.0',
        },
        nodeCheckState: {
          requiredVersion: '22.16.0',
          targetVersion: '22.18.0',
          needNode: false,
          nodeNeedsUpgrade: true,
        },
        nodeInstallBehavior: resolveNodeInstallPlatformBehavior('win32'),
      })
    ).toEqual({
      status: 'pending-install',
      version: 'v22.15.0',
      description: 'OpenClaw 需要 Node.js 22.16.0 或更高版本。当前版本过低，请先手动升级 Node.js 后再继续。',
      progress: 20,
      latestNodeVersion: '22.18.0',
      blocksContinue: true,
    })

    expect(
      resolveEnvCheckNodeStepState({
        nodeResult: {
          installed: true,
          version: 'v22.18.0',
        },
        nodeCheckState: {
          requiredVersion: '22.16.0',
          targetVersion: '22.18.0',
          needNode: false,
          nodeNeedsUpgrade: false,
        },
        nodeInstallBehavior: resolveNodeInstallPlatformBehavior('win32'),
      })
    ).toEqual({
      status: 'ok',
      version: 'v22.18.0',
      description: '已安装',
      progress: 100,
      latestNodeVersion: '',
      blocksContinue: false,
    })
  })

  it('maps node install preparation into the correct pre-install step state', () => {
    expect(
      resolveEnvCheckNodeInstallPrepState({
        needNode: false,
        installStrategy: 'installer',
        targetNodeVersion: '22.18.0',
      })
    ).toBeNull()

    expect(
      resolveEnvCheckNodeInstallPrepState({
        needNode: true,
        installStrategy: 'installer',
        targetNodeVersion: '22.18.0',
      })
    ).toEqual({
      status: 'installing',
      description: '正在下载 Node.js 22.18.0...',
      progress: 35,
      shouldDownloadInstaller: true,
    })

    expect(
      resolveEnvCheckNodeInstallPrepState({
        needNode: true,
        installStrategy: 'nvm',
        targetNodeVersion: '22.18.0',
      })
    ).toEqual({
      status: 'installing',
      description: '正在通过 nvm 准备 Node.js 22.18.0...',
      progress: 45,
      shouldDownloadInstaller: false,
    })
  })

  it('maps node post-install refresh and recheck into a stable state bundle', () => {
    expect(
      resolveEnvCheckNodePostInstallRecheckState({
        nodeInstallBehavior: resolveNodeInstallPlatformBehavior('win32'),
        newNodeResultVersion: 'v22.18.0',
      })
    ).toEqual({
      refreshStep: {
        status: 'checking',
        description: '刷新环境变量...',
        progress: 80,
      },
      recheckStep: {
        status: 'checking',
        description: '重新检测 Node.js...',
        progress: 85,
      },
      successStep: {
        status: 'ok',
        version: 'v22.18.0',
        description: '已安装',
        progress: 90,
      },
      failureStep: {
        status: 'error',
        error: '安装后仍无法检测到',
      },
      failureIssueKind: 'installer-failed',
      failureMessage:
        'Node.js 安装后仍无法检测到。请先关闭并重新打开 Mclaw；如果仍然失败，请改为手动安装 Windows 版 Node.js。',
    })
  })

  it('retries latest OpenClaw version checks up to the configured cap', async () => {
    let callCount = 0

    const result = await retryOpenClawLatestVersionCheck(async () => {
      callCount += 1
      if (callCount < 3) {
        return {
          ok: false,
          latestVersion: '',
          checkedAt: `attempt-${callCount}`,
          source: 'npm-registry',
          error: 'network down',
        }
      }

      return {
        ok: true,
        latestVersion: '2026.3.13',
        checkedAt: 'attempt-3',
        source: 'npm-registry',
      }
    })

    expect(callCount).toBe(3)
    expect(result.attempts).toBe(3)
    expect(result.result.ok).toBe(true)
    expect(result.result.latestVersion).toBe('2026.3.13')
  })

  it('keeps shared install progress on OpenClaw when Node is already installed', () => {
    expect(
      resolveEnvInstallProgressStep({
        needNode: false,
        shouldInstallOpenClawRuntime: true,
      })
    ).toBe('openclaw')

    expect(
      resolveEnvInstallProgressStep({
        needNode: true,
        shouldInstallOpenClawRuntime: true,
      })
    ).toBe('node')
  })

  it('renders Xcode pending issues inline so users can retry recognition from the page', () => {
    expect(shouldRenderStartupIssueInline({ kind: 'xcode-clt-pending' }, 'darwin')).toBe(true)
    expect(shouldRenderStartupIssueInline({ kind: 'git-unavailable' }, 'darwin')).toBe(false)
    expect(shouldRenderStartupIssueInline({ kind: 'xcode-clt-pending' }, 'win32')).toBe(false)
    expect(shouldRenderStartupIssueInline(null, 'darwin')).toBe(false)
  })

  it('centralizes mac-only preflight gates behind explicit platform helpers', () => {
    expect(isMacPlatform('darwin')).toBe(true)
    expect(isMacPlatform('win32')).toBe(false)
    expect(resolveEnvCheckPlatformState('darwin')).toMatchObject({
      platform: 'darwin',
      isMac: true,
      shouldPrepareMacDeveloperTools: true,
      shouldInspectNodeInstaller: true,
    })
    expect(resolveEnvCheckPlatformState('win32')).toMatchObject({
      platform: 'win32',
      isMac: false,
      shouldPrepareMacDeveloperTools: false,
      shouldInspectNodeInstaller: false,
    })
    expect(resolveNodeInstallPlatformBehavior('darwin')).toMatchObject({
      platform: 'darwin',
      shouldPrepareMacDeveloperTools: true,
      shouldInspectNodeInstaller: true,
      installCompletedDescription: '安装完成',
      installedDescription: '已安装',
      refreshDescription: '刷新环境变量...',
      recheckDescription: '重新检测 Node.js...',
      missingAfterInstallError: '安装后仍无法检测到',
      missingAfterInstallMessage: 'Node.js 安装后仍无法检测到。请重启应用或手动安装。',
    })
    expect(resolveNodeInstallPlatformBehavior('win32')).toMatchObject({
      platform: 'win32',
      shouldPrepareMacDeveloperTools: false,
      shouldInspectNodeInstaller: false,
      installCompletedDescription: '安装完成',
      installedDescription: '已安装',
      refreshDescription: '刷新环境变量...',
      recheckDescription: '重新检测 Node.js...',
      missingAfterInstallError: '安装后仍无法检测到',
      missingAfterInstallMessage:
        'Node.js 安装后仍无法检测到。请先关闭并重新打开 Mclaw；如果仍然失败，请改为手动安装 Windows 版 Node.js。',
    })
    expect(shouldPrepareMacDeveloperTools('darwin')).toBe(true)
    expect(shouldPrepareMacDeveloperTools('win32')).toBe(false)
    expect(shouldInspectNodeInstallerForPlatform('darwin')).toBe(true)
    expect(shouldInspectNodeInstallerForPlatform('win32')).toBe(false)
    expect(resolveOpenClawInstallBehavior()).toMatchObject({
      installedDescription: '已安装',
      refreshDescription: '刷新环境变量...',
      missingAfterInstallError: '安装后仍无法检测到',
    })
    expect(resolveOpenClawInstallBehavior().resolveRecheckDescription(true)).toBe(
      '正在验证 OpenClaw 运行环境...'
    )
    expect(resolveOpenClawInstallBehavior().resolveRecheckDescription(false)).toBe(
      '重新检测 OpenClaw 运行环境...'
    )
    expect(resolveOpenClawInstallBehavior().missingAfterInstallMessage).toEqual(
      expect.arrayContaining([
        'OpenClaw 运行环境准备流程已执行，但当前仍无法检测到可用命令。',
        '这通常表示内置本体释放和 PATH 生效之间仍存在异常。',
        '请先重启 Mclaw 再试一次。',
      ])
    )
    expect(resolveGatewayBehavior()).toMatchObject({
      deferredCheckingDescription: '当前先完成模型配置；点击进入控制面板后，Mclaw 会先自动启动并确认 Gateway，再进入主界面。',
      deferredStepVersion: '自动启动',
      deferredReadyDescription: '进入控制面板时会自动启动 Gateway 并确认本地对话可用，无需手动打开终端。',
    })
    expect(resolveGatewayDeferredStepState(resolveGatewayBehavior())).toEqual({
      status: 'ok',
      version: '自动启动',
      description: '进入控制面板时会自动启动 Gateway 并确认本地对话可用，无需手动打开终端。',
      progress: 100,
    })
    expect(resolveGatewayBehavior().resolveContinueLabel(true)).toBe('进入控制面板')
    expect(resolveGatewayBehavior().resolveContinueLabel(false)).toBe('开始配置')
  })

  it('classifies node installer failures by platform without leaking mac-only branches into Windows', () => {
    expect(
      classifyNodeInstallerFailureForPlatform('darwin', 'Error: User canceled. (-128)')
    ).toMatchObject({
      kind: 'user-cancelled',
    })

    expect(
      classifyNodeInstallerFailureForPlatform('win32', 'msiexec: Access is denied (5)')
    ).toMatchObject({
      kind: 'permission-denied',
    })
    expect(
      classifyNodeInstallerFailureForPlatform('win32', 'msiexec: Access is denied (5)').message
    ).toContain('UAC')

    expect(
      classifyNodeInstallerFailureForPlatform('win32', 'This installation package could not be opened.')
    ).toMatchObject({
      kind: 'missing-installer',
    })
    expect(
      classifyNodeInstallerFailureForPlatform('win32', 'This installation package could not be opened.').message
    ).toContain('Node 官网')

    expect(
      classifyNodeInstallerFailureForPlatform('win32', 'Windows protected your PC')
    ).toMatchObject({
      kind: 'blocked-by-policy',
    })
    expect(
      classifyNodeInstallerFailureForPlatform('win32', 'Windows protected your PC').message
    ).toContain('SmartScreen')

    expect(
      classifyNodeInstallerFailureForPlatform('win32', 'msiexec failed with exit code 1603')
    ).toMatchObject({
      kind: 'installer-failed',
    })
    expect(
      resolveNodeInstallPlatformBehavior('win32').classifyInstallerFailure('Windows protected your PC')
    ).toMatchObject({
      kind: 'blocked-by-policy',
    })
  })

  it('only offers the manual Node upgrade action when the installed version is below the minimum requirement', () => {
    expect(shouldOfferManualNodeUpgrade('v22.15.0')).toBe(true)
    expect(shouldOfferManualNodeUpgrade('v22.16.0')).toBe(false)
    expect(shouldOfferManualNodeUpgrade('v24.14.0')).toBe(false)
  })

  it('tracks the active takeover failure and clears it once manual backup is acknowledged', () => {
    const summary = {
      detected: true,
      backupRootDirectory: '~/Documents/Qclaw Lite Backups',
      failures: [
        {
          candidateId: 'candidate-1',
          displaySourcePath: '~/.openclaw',
          displaySuggestedArchivePath: '~/Documents/Qclaw Lite Backups/baseline-manual',
          message: 'backup failed',
        },
      ],
    }

    expect(resolveActiveTakeoverFailure(summary, 'candidate-1')).toMatchObject({
      candidateId: 'candidate-1',
    })

    expect(formatTakeoverFailureManualBackupWarning(summary.failures[0])).toContain(
      '请将 ~/.openclaw 复制到 ~/Documents/Qclaw Lite Backups/baseline-manual'
    )

    expect(clearTakeoverFailure(summary, 'candidate-1')).toMatchObject({
      failures: [],
    })
  })

  it('allows history-only recovery to continue after manual backup bypass is recorded', () => {
    expect(
      canContinueHistoryOnlyRecovery(
        {
          ownershipState: 'external-preexisting',
          baselineBackup: null,
          baselineBackupBypass: {
            installFingerprint: 'fingerprint-1',
            skippedAt: '2026-03-22T10:00:00.000Z',
            reason: 'manual-backup-required',
            sourcePath: '/Users/test/.openclaw',
            displaySourcePath: '~/.openclaw',
            suggestedArchivePath: '/Users/test/Documents/Qclaw Lite Backups/manual-baseline',
            displaySuggestedArchivePath: '~/Documents/Qclaw Lite Backups/manual-baseline',
          },
        },
        {
          ok: true,
          backup: null,
        }
      )
    ).toBe(true)

    expect(
      canContinueHistoryOnlyRecovery(
        {
          ownershipState: 'external-preexisting',
          baselineBackup: null,
          baselineBackupBypass: null,
        },
        {
          ok: true,
          backup: null,
        }
      )
    ).toBe(false)
  })

  it('uses the effective backup root for takeover prompts when backup lookup resolves a fallback root', async () => {
    await expect(
      resolveTakeoverBackupRootDirectory(
        { defaultBackupDirectory: '~/Documents/Qclaw Lite Backups' },
        async () => ({ displayRootDirectory: '~/Library/Application Support/Qclaw Lite/Backups' })
      )
    ).resolves.toBe('~/Library/Application Support/Qclaw Lite/Backups')
  })

  it('falls back to the discovery backup directory when backup lookup fails', async () => {
    await expect(
      resolveTakeoverBackupRootDirectory(
        { defaultBackupDirectory: '~/Documents/Qclaw Lite Backups' },
        async () => {
          throw new Error('backup root unavailable')
        }
      )
    ).resolves.toBe('~/Documents/Qclaw Lite Backups')
  })

  it('starts startup plugin repair without blocking env checks', async () => {
    const kickoffStartupPluginRepair = (
      EnvCheckModule as typeof EnvCheckModule & {
        kickoffStartupPluginRepair?: (startRepair?: () => Promise<unknown>) => void
      }
    ).kickoffStartupPluginRepair

    expect(kickoffStartupPluginRepair).toBeTypeOf('function')

    const events: string[] = []
    let resolveRepair: () => void = () => {
      throw new Error('repair resolver not initialized')
    }
    const repairPromise = new Promise<void>((resolve) => {
      resolveRepair = () => {
        events.push('repair-settled')
        resolve()
      }
    })

    kickoffStartupPluginRepair?.(() => {
      events.push('repair-started')
      return repairPromise
    })
    events.push('after-kickoff')

    expect(events).toEqual(['repair-started', 'after-kickoff'])

    resolveRepair()
    await repairPromise
    expect(events).toEqual(['repair-started', 'after-kickoff', 'repair-settled'])
  })

  it('treats 2026.3.22 as the minimum supported openclaw version after stripping suffixes', () => {
    const isSupportedOpenClawVersion = (
      EnvCheckModule as typeof EnvCheckModule & {
        isSupportedOpenClawVersion?: (version: string) => boolean
      }
    ).isSupportedOpenClawVersion

    expect(isSupportedOpenClawVersion).toBeTypeOf('function')
    expect(isSupportedOpenClawVersion?.('2026.3.22')).toBe(true)
    expect(isSupportedOpenClawVersion?.('2026.3.22-2')).toBe(true)
    expect(isSupportedOpenClawVersion?.('2026.3.23-7')).toBe(true)
    expect(isSupportedOpenClawVersion?.('2026.3.24')).toBe(true)
    expect(isSupportedOpenClawVersion?.('2026.3.21')).toBe(false)
    expect(isSupportedOpenClawVersion?.('2026.3.25')).toBe(false)
  })

  it('maps supported-but-not-pinned installs into an optional upgrade gate', () => {
    const gateState = buildOpenClawGateState(
      {
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/usr/local/bin/openclaw',
            resolvedBinaryPath: '/usr/local/lib/node_modules/openclaw/openclaw.mjs',
            packageRoot: '/usr/local/lib/node_modules/openclaw',
            version: '2026.3.23',
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
        defaultBackupDirectory: '~/Documents/Qclaw Lite Backups',
      },
      {
        ok: true,
        activeCandidate: {
          candidateId: 'candidate-1',
          binaryPath: '/usr/local/bin/openclaw',
          resolvedBinaryPath: '/usr/local/lib/node_modules/openclaw/openclaw.mjs',
          packageRoot: '/usr/local/lib/node_modules/openclaw',
          version: '2026.3.23',
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
        currentVersion: '2026.3.23',
        targetVersion: '2026.3.24',
        latestCheck: null,
        policyState: 'supported_not_target',
        enforcement: 'optional_upgrade',
        targetAction: 'upgrade',
        blocksContinue: false,
        canSelfHeal: true,
        canAutoUpgrade: true,
        upToDate: false,
        gatewayRunning: false,
        warnings: [],
      }
    )

    expect(gateState.canUpgrade).toBe(true)
    expect(gateState.canAutoCorrect).toBe(false)
    expect(gateState.blocksContinue).toBe(false)
    expect(gateState.statusLabel).toContain('2026.3.24')
    expect(gateState.migrationSmoke).toMatchObject({
      migrationPath: 'in-range-upgrade',
      needsBaselineBackup: true,
      requiresConservativeMode: false,
    })
  })

  it('maps unsupported high versions into a manual blocker when the source cannot self-heal', () => {
    const gateState = buildOpenClawGateState(
      {
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/opt/tools/openclaw/bin/openclaw',
            resolvedBinaryPath: '/opt/tools/openclaw/bin/openclaw',
            packageRoot: '/opt/tools/openclaw',
            version: '2026.3.25',
            installSource: 'custom',
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
        defaultBackupDirectory: '~/Documents/Qclaw Lite Backups',
      },
      {
        ok: false,
        activeCandidate: {
          candidateId: 'candidate-1',
          binaryPath: '/opt/tools/openclaw/bin/openclaw',
          resolvedBinaryPath: '/opt/tools/openclaw/bin/openclaw',
          packageRoot: '/opt/tools/openclaw',
          version: '2026.3.25',
          installSource: 'custom',
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
        currentVersion: '2026.3.25',
        targetVersion: '2026.3.24',
        latestCheck: null,
        policyState: 'above_max',
        enforcement: 'manual_block',
        targetAction: 'downgrade',
        blocksContinue: true,
        canSelfHeal: false,
        canAutoUpgrade: false,
        upToDate: false,
        gatewayRunning: false,
        warnings: [],
        manualHint: '请在原安装位置手动切换到 2026.3.24',
        errorCode: 'manual_only',
      }
    )

    expect(gateState.canUpgrade).toBe(false)
    expect(gateState.canAutoCorrect).toBe(false)
    expect(gateState.blocksContinue).toBe(true)
    expect(gateState.manualHint).toContain('2026.3.24')
    expect(gateState.migrationSmoke).toMatchObject({
      migrationPath: 'rollback-to-pinned',
      needsBaselineBackup: true,
      requiresConservativeMode: false,
    })
  })

  it('builds a clear consent message before automatic openclaw correction runs', () => {
    const message = buildOpenClawAutoCorrectionConsentMessage({
      activeCandidate: {
        candidateId: 'candidate-1',
        binaryPath: '/usr/local/bin/openclaw',
        resolvedBinaryPath: '/usr/local/lib/node_modules/openclaw/openclaw.mjs',
        packageRoot: '/usr/local/lib/node_modules/openclaw',
        version: '2026.3.28',
        installSource: 'npm-global',
        isPathActive: true,
        configPath: '/Users/test/.openclaw/openclaw.json',
        stateRoot: '/Users/test/.openclaw',
        displayConfigPath: '~/.openclaw/openclaw.json',
        displayStateRoot: '~/.openclaw',
        ownershipState: 'qclaw-installed',
        installFingerprint: 'fingerprint-1',
        baselineBackup: null,
        baselineBackupBypass: null,
      },
      upgradeCheck: {
        ok: false,
        activeCandidate: null,
        currentVersion: '2026.3.28',
        targetVersion: '2026.3.24',
        latestCheck: null,
        policyState: 'above_max',
        enforcement: 'auto_correct',
        targetAction: 'downgrade',
        blocksContinue: true,
        canSelfHeal: true,
        canAutoUpgrade: true,
        upToDate: false,
        gatewayRunning: false,
        warnings: [],
      },
    })

    expect(message).toContain('当前版本：2026.3.28')
    expect(message).toContain('目标版本：2026.3.24')
    expect(message).toContain('自动回退 OpenClaw')
    expect(message).toContain('Mclaw 将立即退出')
  })

  it('prefers an explicit correction target version in the consent message', () => {
    const message = buildOpenClawAutoCorrectionConsentMessage({
      activeCandidate: {
        candidateId: 'candidate-1',
        binaryPath: '/usr/local/bin/openclaw',
        resolvedBinaryPath: '/usr/local/lib/node_modules/openclaw/openclaw.mjs',
        packageRoot: '/usr/local/lib/node_modules/openclaw',
        version: '2026.4.7',
        installSource: 'npm-global',
        isPathActive: true,
        configPath: '/Users/test/.openclaw/openclaw.json',
        stateRoot: '/Users/test/.openclaw',
        displayConfigPath: '~/.openclaw/openclaw.json',
        displayStateRoot: '~/.openclaw',
        ownershipState: 'qclaw-installed',
        installFingerprint: 'fingerprint-1',
        baselineBackup: null,
        baselineBackupBypass: null,
      },
      upgradeCheck: {
        ok: false,
        activeCandidate: null,
        currentVersion: '2026.4.7',
        targetVersion: '2026.4.6',
        latestCheck: null,
        policyState: 'above_max',
        enforcement: 'auto_correct',
        targetAction: 'downgrade',
        blocksContinue: true,
        canSelfHeal: true,
        canAutoUpgrade: true,
        upToDate: false,
        gatewayRunning: false,
        warnings: [],
      },
    })

    expect(message).toContain('当前版本：2026.4.7')
    expect(message).toContain('目标版本：2026.4.6')
  })

  it('keeps supported custom installs non-blocking while requiring manual upgrade outside the app', () => {
    const gateState = buildOpenClawGateState(
      {
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/opt/tools/openclaw/bin/openclaw',
            resolvedBinaryPath: '/opt/tools/openclaw/bin/openclaw',
            packageRoot: '/opt/tools/openclaw',
            version: '2026.3.23',
            installSource: 'custom',
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
        defaultBackupDirectory: '~/Documents/Qclaw Lite Backups',
      },
      {
        ok: true,
        activeCandidate: {
          candidateId: 'candidate-1',
          binaryPath: '/opt/tools/openclaw/bin/openclaw',
          resolvedBinaryPath: '/opt/tools/openclaw/bin/openclaw',
          packageRoot: '/opt/tools/openclaw',
          version: '2026.3.23',
          installSource: 'custom',
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
        currentVersion: '2026.3.23',
        targetVersion: '2026.3.24',
        latestCheck: null,
        policyState: 'supported_not_target',
        enforcement: 'manual_block',
        targetAction: 'upgrade',
        blocksContinue: false,
        canSelfHeal: false,
        canAutoUpgrade: false,
        upToDate: false,
        gatewayRunning: false,
        warnings: [],
        manualHint: '请在原安装位置手动切换到 2026.3.24',
      }
    )

    expect(gateState.canUpgrade).toBe(false)
    expect(gateState.canAutoCorrect).toBe(false)
    expect(gateState.blocksContinue).toBe(false)
    expect(gateState.manualHint).toContain('2026.3.24')
    expect(gateState.migrationSmoke).toMatchObject({
      migrationPath: 'in-range-upgrade',
      needsBaselineBackup: true,
      requiresConservativeMode: false,
    })
  })

  it('hides the openclaw action button when takeover backup is still blocking auto-correction', () => {
    expect(
      canShowOpenClawUpgradeAction(
        {
          canUpgrade: false,
          canAutoCorrect: true,
        },
        true
      )
    ).toBe(false)

    expect(
      canShowOpenClawUpgradeAction(
        {
          canUpgrade: true,
          canAutoCorrect: false,
        },
        false
      )
    ).toBe(true)
  })

  it('keeps the continue button disabled for openclaw blockers and for takeover backup blockers', () => {
    expect(
      canContinueWithOpenClawGate(
        {
          blocksContinue: true,
        },
        false
      )
    ).toBe(false)

    expect(
      canContinueWithOpenClawGate(
        {
          blocksContinue: false,
        },
        false
      )
    ).toBe(true)

    expect(
      canContinueWithOpenClawGate(
        {
          blocksContinue: true,
        },
        true
      )
    ).toBe(false)
  })

  it('prefers delivery mode when rendering the openclaw source badge', () => {
    expect(
      resolveOpenClawSourceBadgeState({
        installSource: 'npm-global',
        deliveryMode: 'bundled-runtime',
      })
    ).toEqual({
      label: '内置本体',
      title: '当前使用安装包内置的 OpenClaw 运行本体。',
    })

    expect(
      resolveOpenClawSourceBadgeState({
        installSource: 'npm-global',
        deliveryMode: 'online-fallback',
      })
    ).toEqual({
      label: '在线兜底',
      title: '当前未命中本地载荷，已进入在线补装兜底路径。',
    })
  })

  it('maps bundled fallback into a runtime payload warning badge state', () => {
    expect(
      resolveOpenClawSourceBadgeState({
        installSource: 'npm-global',
        deliveryMode: 'bundled-fallback',
      })
    ).toEqual({
      label: '内置补位',
      title: '当前未命中目标内置 runtime，正在使用安装包内置补位载荷；请检查该平台 runtime 是否缺失、损坏或打包不完整。',
    })
  })

  it('falls back to install source when no bundled delivery mode is available', () => {
    expect(
      resolveOpenClawSourceBadgeState({
        installSource: 'custom',
        deliveryMode: null,
      })
    ).toEqual({
      label: '自定义安装',
      title: '当前使用的是用户自定义路径中的 OpenClaw 运行环境。',
    })

    expect(
      resolveOpenClawSourceBadgeState({
        installSource: 'nvm',
        deliveryMode: null,
      })
    ).toEqual({
      label: 'nvm',
      title: '当前使用的是 nvm 环境中的 OpenClaw。',
    })
  })

  it('shows a delivery-mode notice when the current bundled mode has not reached the target mode', () => {
    expect(
      resolveOpenClawDeliveryNoticeState({
        bundledDeliveryMode: 'bundled-fallback',
        bundledTargetDeliveryMode: 'bundled-runtime',
      })
    ).toEqual({
      color: 'yellow',
      title: '运行来源',
      message:
        '当前 OpenClaw 交付模式为 bundled-fallback，目标模式为 bundled-runtime。这通常表示当前平台没有命中目标本体路径，或当前安装包中的该平台内置 runtime 载荷缺失、损坏或打包不完整。',
    })
  })

  it('hides the delivery-mode notice when current and target bundled modes already match', () => {
    expect(
      resolveOpenClawDeliveryNoticeState({
        bundledDeliveryMode: 'bundled-runtime',
        bundledTargetDeliveryMode: 'bundled-runtime',
      })
    ).toBeNull()
  })
})
