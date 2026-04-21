import { describe, expect, it } from 'vitest'

import {
  clearFeishuBotManagerInstallerSelectedBotAccountId,
  clearFeishuBotManagerInstallerSessionMode,
  getFeishuBotManagerActionFailureMessage,
  getFeishuBotManagerInstallerInputFailureMessage,
  getFeishuBotManagerInstallerModeStorageKey,
  getFeishuBotManagerInstallerSelectedBotStorageKey,
  loadFeishuBotManagerRefreshResources,
  readFeishuBotManagerInstallerSelectedBotAccountId,
  readFeishuBotManagerInstallerSessionMode,
  resolveFeishuBotManagerInstallerActionState,
  resolveFeishuBotManagerInstallerConsoleHint,
  resolveFeishuBotManagerConfigMutationLockNotice,
  resolveFeishuBotManagerInstallerExitNotice,
  resolveFeishuBotManagerInstallerLiveNotice,
  resolveFeishuBotManagerMaintenanceLockNotice,
  resolveFeishuBotManagerInstallerOutputState,
  resolveFeishuBotManagerInstallerReuseNotice,
  resolveFeishuBotManagerInstallerSnapshotNotice,
  resolveFeishuBotManagerInstallerStartPlan,
  resolveFeishuBotManagerInstallerStartState,
  resolveFeishuBotManagerInstallerStopFeedback,
  resolveFeishuBotManagerLinkedBotSelectionLockNotice,
  resolveFeishuBotManagerSetupModeLockNotice,
  shouldLockFeishuBotManagerConfigMutations,
  shouldLockFeishuBotManagerLinkedBotSelection,
  shouldLockFeishuBotManagerSetupMode,
  shouldResetFeishuBotManagerInstallerEphemeralState,
  writeFeishuBotManagerInstallerSelectedBotAccountId,
  writeFeishuBotManagerInstallerSessionMode,
} from '../FeishuBotManagerModal'

describe('resolveFeishuBotManagerInstallerStartState', () => {
  it('clears stale installer output, input, and notice when a fresh dashboard installer run starts', () => {
    expect(resolveFeishuBotManagerInstallerStartState()).toEqual({
      sessionId: '',
      running: true,
      output: '',
      exitCode: null,
      canceled: false,
      input: '',
      notice: '\u98de\u4e66\u5b98\u65b9\u5b89\u88c5\u5668\u4ecd\u5728\u8fd0\u884c\uff0c\u6b63\u5728\u7b49\u5f85\u672c\u6b21\u4e8c\u7ef4\u7801\u751f\u6210\u3002',
    })
  })
})

describe('resolveFeishuBotManagerInstallerStartPlan', () => {
  it('preserves the current setup mode when the dashboard is only reattaching to an active installer session', () => {
    expect(
      resolveFeishuBotManagerInstallerStartPlan({
        requestedMode: 'link',
        currentMode: 'create',
        hasActiveSession: true,
      })
    ).toEqual({
      mode: 'create',
      shouldPrimeFreshStartState: false,
    })
  })

  it('uses the requested setup mode and primes a clean local start state for a genuinely new installer run', () => {
    expect(
      resolveFeishuBotManagerInstallerStartPlan({
        requestedMode: 'link',
        currentMode: 'create',
        hasActiveSession: false,
      })
    ).toEqual({
      mode: 'link',
      shouldPrimeFreshStartState: true,
    })
  })
})

describe('resolveFeishuBotManagerInstallerReuseNotice', () => {
  it('tells the user when the dashboard modal reattaches to an already running installer session', () => {
    expect(resolveFeishuBotManagerInstallerReuseNotice()).toBe(
      '飞书官方安装器已在运行中，Mclaw 已重新连接到当前安装会话，不会重复启动第二个安装器。'
    )
  })
})

describe('resolveFeishuBotManagerInstallerActionState', () => {
  it('keeps create mode immediately available with a create-specific primary action label', () => {
    expect(
      resolveFeishuBotManagerInstallerActionState({
        mode: 'create',
        availableLinkedBotCount: 0,
      })
    ).toEqual({
      label: '新建机器人',
      disabled: false,
      description: '启动飞书官方安装器，并创建一个新的飞书机器人。',
    })
  })

  it('keeps link mode unavailable until at least one reusable linked bot exists', () => {
    expect(
      resolveFeishuBotManagerInstallerActionState({
        mode: 'link',
        availableLinkedBotCount: 0,
      })
    ).toEqual({
      label: '复用已有机器人',
      disabled: true,
      description: '当前还没有可复用的飞书机器人，请先创建一个。',
    })
  })

  it('unlocks link mode once reusable linked bots are present', () => {
    expect(
      resolveFeishuBotManagerInstallerActionState({
        mode: 'link',
        availableLinkedBotCount: 2,
      })
    ).toEqual({
      label: '复用已有机器人',
      disabled: false,
      description: '当官方安装器出现复用入口时，Mclaw 会继续走复用已有机器人的路径。',
    })
  })

  it('surfaces the selected reusable bot name once link mode already has a concrete target', () => {
    expect(
      resolveFeishuBotManagerInstallerActionState({
        mode: 'link',
        availableLinkedBotCount: 2,
        selectedLinkedBotName: 'Support Bot',
      })
    ).toEqual({
      label: '复用已有机器人',
      disabled: false,
      description: '准备复用「Support Bot」。当官方安装器出现复用提示时，Mclaw 会自动确认；如果后续仍要求选择目标，请在下方控制台里继续确认。',
    })
  })
})

describe('resolveFeishuBotManagerInstallerConsoleHint', () => {
  it('keeps create mode pointed at scan/name/confirm follow-up work instead of link-specific guidance', () => {
    expect(
      resolveFeishuBotManagerInstallerConsoleHint({
        mode: 'create',
      })
    ).toBe(
      '如果安装器停在等待输入，请优先看上方提示卡和日志末尾；完成扫码、机器人命名或选项确认后，再继续刷新当前状态。'
    )
  })

  it('keeps link mode honest about the automatic Y reply and the need to confirm the selected bot in the console', () => {
    expect(
      resolveFeishuBotManagerInstallerConsoleHint({
        mode: 'link',
        selectedLinkedBotName: 'Support Bot',
      })
    ).toBe(
      '复用流程开始后，Mclaw 会在复用提示上自动回答“Y”；如果官方安装器继续要求选择目标，请在下方控制台里确认与「Support Bot」对应的选项。'
    )
  })
})

describe('feishu bot manager installer session mode storage helpers', () => {
  it('builds a stable storage key for each installer session id', () => {
    expect(getFeishuBotManagerInstallerModeStorageKey('session-1')).toBe(
      'mclaw:feishu-bot-manager:installer-mode:session-1'
    )
  })

  it('writes, reads, and clears the stored setup mode for a running installer session', () => {
    const storage = new Map<string, string>()
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    }

    writeFeishuBotManagerInstallerSessionMode({
      sessionId: 'session-1',
      mode: 'link',
      storage: fakeStorage,
    })
    expect(
      readFeishuBotManagerInstallerSessionMode({
        sessionId: 'session-1',
        storage: fakeStorage,
      })
    ).toBe('link')

    clearFeishuBotManagerInstallerSessionMode({
      sessionId: 'session-1',
      storage: fakeStorage,
    })
    expect(
      readFeishuBotManagerInstallerSessionMode({
        sessionId: 'session-1',
        storage: fakeStorage,
      })
    ).toBeNull()
  })

  it('ignores invalid stored values instead of trusting corrupted mode state', () => {
    const fakeStorage = {
      getItem: () => 'unexpected-mode',
      setItem: () => {},
      removeItem: () => {},
    }

    expect(
      readFeishuBotManagerInstallerSessionMode({
        sessionId: 'session-1',
        storage: fakeStorage,
      })
    ).toBeNull()
  })
})

describe('feishu bot manager selected bot storage helpers', () => {
  it('builds a stable storage key for each installer selected-bot mapping', () => {
    expect(getFeishuBotManagerInstallerSelectedBotStorageKey('session-1')).toBe(
      'mclaw:feishu-bot-manager:installer-selected-bot:session-1'
    )
  })

  it('writes, reads, and clears the stored selected bot account id for a running installer session', () => {
    const storage = new Map<string, string>()
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    }

    writeFeishuBotManagerInstallerSelectedBotAccountId({
      sessionId: 'session-1',
      accountId: 'bot-123',
      storage: fakeStorage,
    })
    expect(
      readFeishuBotManagerInstallerSelectedBotAccountId({
        sessionId: 'session-1',
        storage: fakeStorage,
      })
    ).toBe('bot-123')

    clearFeishuBotManagerInstallerSelectedBotAccountId({
      sessionId: 'session-1',
      storage: fakeStorage,
    })
    expect(
      readFeishuBotManagerInstallerSelectedBotAccountId({
        sessionId: 'session-1',
        storage: fakeStorage,
      })
    ).toBe('')
  })

  it('ignores empty selected-bot writes instead of persisting a blank target', () => {
    const storage = new Map<string, string>()
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    }

    writeFeishuBotManagerInstallerSelectedBotAccountId({
      sessionId: 'session-1',
      accountId: '',
      storage: fakeStorage,
    })
    expect(
      readFeishuBotManagerInstallerSelectedBotAccountId({
        sessionId: 'session-1',
        storage: fakeStorage,
      })
    ).toBe('')
  })
})

describe('shouldLockFeishuBotManagerSetupMode', () => {
  it('locks the setup-mode switch whenever the installer is running or the UI is busy starting/stopping it', () => {
    expect(
      shouldLockFeishuBotManagerSetupMode({
        running: true,
        busy: false,
      })
    ).toBe(true)
    expect(
      shouldLockFeishuBotManagerSetupMode({
        running: false,
        busy: true,
      })
    ).toBe(true)
    expect(
      shouldLockFeishuBotManagerSetupMode({
        running: false,
        busy: false,
      })
    ).toBe(false)
  })
})

describe('resolveFeishuBotManagerSetupModeLockNotice', () => {
  it('explains why create mode is frozen while the installer session is actively running', () => {
    expect(
      resolveFeishuBotManagerSetupModeLockNotice({
        mode: 'create',
        running: true,
        busy: false,
      })
    ).toBe('飞书官方安装器正在运行，当前会话已锁定为「新建机器人」，避免中途切换路径。'
    )
  })

  it('explains that link mode will continue on the current path while start/stop work is still busy', () => {
    expect(
      resolveFeishuBotManagerSetupModeLockNotice({
        mode: 'link',
        running: false,
        busy: true,
      })
    ).toBe('飞书官方安装器正在启动或停止中，请稍候；当前会话会继续按「复用已有机器人」路径执行。'
    )
  })

  it('stays empty when the setup-mode switch is not locked', () => {
    expect(
      resolveFeishuBotManagerSetupModeLockNotice({
        mode: 'create',
        running: false,
        busy: false,
      })
    ).toBe('')
  })
})

describe('shouldLockFeishuBotManagerLinkedBotSelection', () => {
  it('locks reusable-bot selection only for live/busy link sessions, not for create mode or idle link mode', () => {
    expect(
      shouldLockFeishuBotManagerLinkedBotSelection({
        mode: 'link',
        running: true,
        busy: false,
      })
    ).toBe(true)
    expect(
      shouldLockFeishuBotManagerLinkedBotSelection({
        mode: 'link',
        running: false,
        busy: true,
      })
    ).toBe(true)
    expect(
      shouldLockFeishuBotManagerLinkedBotSelection({
        mode: 'link',
        running: false,
        busy: false,
      })
    ).toBe(false)
    expect(
      shouldLockFeishuBotManagerLinkedBotSelection({
        mode: 'create',
        running: true,
        busy: true,
      })
    ).toBe(false)
  })
})

describe('resolveFeishuBotManagerLinkedBotSelectionLockNotice', () => {
  it('surfaces the locked reusable-bot target while link mode is actively running', () => {
    expect(
      resolveFeishuBotManagerLinkedBotSelectionLockNotice({
        selectedLinkedBotName: 'Support Bot',
        running: true,
        busy: false,
      })
    ).toBe('飞书官方安装器正在运行，已锁定复用目标「Support Bot」，避免会话中途漂移。'
    )
  })

  it('falls back to a generic selection notice while link mode is still starting or stopping', () => {
    expect(
      resolveFeishuBotManagerLinkedBotSelectionLockNotice({
        selectedLinkedBotName: '',
        running: false,
        busy: true,
      })
    ).toBe('飞书官方安装器正在启动或停止中，请稍候；复用目标当前选中的机器人暂时不可更改。'
    )
  })

  it('stays empty when the reusable-bot selection is not locked', () => {
    expect(
      resolveFeishuBotManagerLinkedBotSelectionLockNotice({
        selectedLinkedBotName: 'Support Bot',
        running: false,
        busy: false,
      })
    ).toBe('')
  })
})

describe('shouldLockFeishuBotManagerConfigMutations', () => {
  it('locks delete/repair style config mutations whenever the installer is running or busy', () => {
    expect(
      shouldLockFeishuBotManagerConfigMutations({
        running: true,
        busy: false,
      })
    ).toBe(true)
    expect(
      shouldLockFeishuBotManagerConfigMutations({
        running: false,
        busy: true,
      })
    ).toBe(true)
    expect(
      shouldLockFeishuBotManagerConfigMutations({
        running: false,
        busy: false,
      })
    ).toBe(false)
  })
})

describe('resolveFeishuBotManagerConfigMutationLockNotice', () => {
  it('explains why delete and repair actions are frozen while the installer is actively running', () => {
    expect(
      resolveFeishuBotManagerConfigMutationLockNotice({
        running: true,
        busy: false,
      })
    ).toBe('飞书官方安装器正在运行，暂时不能删除机器人或修改多 Bot 隔离配置。'
    )
  })

  it('explains that config mutations remain blocked while installer start or stop work is still busy', () => {
    expect(
      resolveFeishuBotManagerConfigMutationLockNotice({
        running: false,
        busy: true,
      })
    ).toBe('飞书官方安装器正在启动或停止中，请稍候；暂时不能删除机器人或修改多 Bot 隔离配置。'
    )
  })

  it('stays empty when config mutations are not locked', () => {
    expect(
      resolveFeishuBotManagerConfigMutationLockNotice({
        running: false,
        busy: false,
      })
    ).toBe('')
  })
})

describe('resolveFeishuBotManagerMaintenanceLockNotice', () => {
  it('explains why refresh and installer start stay blocked while isolation repair is still writing', () => {
    expect(
      resolveFeishuBotManagerMaintenanceLockNotice({
        repairingIsolation: true,
      })
    ).toBe('正在修复多 Bot 隔离配置，请等待写入完成后再刷新列表或启动飞书官方安装器。'
    )
  })

  it('surfaces the concrete bot name while a delete action is still in progress', () => {
    expect(
      resolveFeishuBotManagerMaintenanceLockNotice({
        deletingBotName: 'Support Bot',
        deletingBotAccountId: 'bot-123',
        repairingIsolation: false,
      })
    ).toBe('正在删除「Support Bot」，请等待操作完成后再刷新列表或启动飞书官方安装器。'
    )
  })

  it('falls back to the account id when a delete action has no friendly bot name', () => {
    expect(
      resolveFeishuBotManagerMaintenanceLockNotice({
        deletingBotName: '',
        deletingBotAccountId: 'bot-123',
        repairingIsolation: false,
      })
    ).toBe('正在删除 Bot（bot-123），请等待操作完成后再刷新列表或启动飞书官方安装器。'
    )
  })

  it('stays empty when no local maintenance action is running', () => {
    expect(
      resolveFeishuBotManagerMaintenanceLockNotice({
        deletingBotName: '',
        deletingBotAccountId: '',
        repairingIsolation: false,
      })
    ).toBe('')
  })
})

describe('resolveFeishuBotManagerInstallerLiveNotice', () => {
  it('restores a scan-now notice when the dashboard modal resumes an installer session with a live qr', () => {
    expect(
      resolveFeishuBotManagerInstallerLiveNotice({
        running: true,
        hasLiveQr: true,
        hasOutput: true,
      })
    ).toBe(
      '\u98de\u4e66\u5b98\u65b9\u5b89\u88c5\u5668\u4ecd\u5728\u8fd0\u884c\uff0c\u8bf7\u626b\u63cf\u4e0b\u65b9\u672c\u6b21\u751f\u6210\u7684\u4e8c\u7ef4\u7801\uff1b\u673a\u5668\u4eba\u521b\u5efa\u5b8c\u6210\u540e\u518d\u7ee7\u7eed\u540e\u7eed\u6b65\u9aa4\u3002'
    )
  })

  it('keeps a wait-for-refresh notice while the dashboard modal is waiting for the current qr to appear', () => {
    expect(
      resolveFeishuBotManagerInstallerLiveNotice({
        running: true,
        hasLiveQr: false,
        hasOutput: false,
      })
    ).toBe(
      '\u98de\u4e66\u5b98\u65b9\u5b89\u88c5\u5668\u4ecd\u5728\u8fd0\u884c\uff0c\u6b63\u5728\u7b49\u5f85\u672c\u6b21\u4e8c\u7ef4\u7801\u751f\u6210\u3002'
    )
  })
})

describe('resolveFeishuBotManagerInstallerOutputState', () => {
  it('detects a live installer qr once dashboard output includes the current verification url', () => {
    expect(
      resolveFeishuBotManagerInstallerOutputState('MCLAW_FEISHU_QR_URL: https://open.feishu.cn/mock-qr')
    ).toEqual({
      hasLiveQr: true,
      hasOutput: true,
    })
  })

  it('stays empty before the dashboard installer emits any current-session output', () => {
    expect(resolveFeishuBotManagerInstallerOutputState('')).toEqual({
      hasLiveQr: false,
      hasOutput: false,
    })
  })

  it('does not mistake the official guide url for the current installer qr', () => {
    expect(
      resolveFeishuBotManagerInstallerOutputState('Guide: https://www.feishu.cn/content/article/7613711414611463386')
    ).toEqual({
      hasLiveQr: false,
      hasOutput: true,
    })
  })
})

describe('resolveFeishuBotManagerInstallerExitNotice', () => {
  it('restores a deterministic completion notice after the dashboard installer exits successfully', () => {
    expect(
      resolveFeishuBotManagerInstallerExitNotice({
        canceled: false,
        exitCode: 0,
      })
    ).toBe(
      '飞书官方安装器已完成，请查看下方刷新后的本地状态，并在机器人出现后继续。'
    )
  })

  it('restores a canceled notice instead of leaving the last running hint behind', () => {
    expect(
      resolveFeishuBotManagerInstallerExitNotice({
        canceled: true,
        exitCode: null,
      })
    ).toBe(
      '飞书官方安装器已取消；如果还需要新的二维码，可随时重新启动。'
    )
  })
})

describe('resolveFeishuBotManagerInstallerSnapshotNotice', () => {
  it('rebuilds the live qr notice when dashboard refresh reattaches to the same running installer session', () => {
    expect(
      resolveFeishuBotManagerInstallerSnapshotNotice({
        active: true,
        output: 'MCLAW_FEISHU_QR_URL: https://open.feishu.cn/mock-qr',
        canceled: false,
        exitCode: null,
      })
    ).toBe(
      '飞书官方安装器仍在运行，请扫描下方本次生成的二维码；机器人创建完成后再继续后续步骤。'
    )
  })

  it('rebuilds the finished notice when dashboard refresh lands after installer exit', () => {
    expect(
      resolveFeishuBotManagerInstallerSnapshotNotice({
        active: false,
        output: '',
        canceled: false,
        exitCode: 0,
      })
    ).toBe(
      '飞书官方安装器已完成，请查看下方刷新后的本地状态，并在机器人出现后继续。'
    )
  })
})

describe('resolveFeishuBotManagerInstallerStopFeedback', () => {
  it('keeps the stop request honest when the backend confirms the installer stop request was accepted', () => {
    expect(
      resolveFeishuBotManagerInstallerStopFeedback({
        ok: true,
      })
    ).toEqual({
      notice: '正在请求停止飞书官方安装器……',
      error: '',
    })
  })

  it('surfaces a retryable error instead of pretending the installer stop request succeeded', () => {
    expect(
      resolveFeishuBotManagerInstallerStopFeedback({
        ok: false,
      })
    ).toEqual({
      notice: '',
      error: '终止飞书官方安装器失败，请稍后重试。',
    })
  })
})

describe('loadFeishuBotManagerRefreshResources', () => {
  it('keeps the dashboard refresh path usable when installer snapshot probing fails but bot state still loads', async () => {
    const state = { refreshed: true }
    const resources = await loadFeishuBotManagerRefreshResources({
      api: {
        getFeishuInstallerState: async () => {
          throw new Error('installer probe unavailable')
        },
      },
      loadState: async () => state,
    })

    expect(resources).toEqual({
      state,
      installerSnapshot: null,
    })
  })

  it('returns both refreshed bot state and installer snapshot when both probes succeed', async () => {
    const state = { refreshed: true }
    const installerSnapshot = {
      sessionId: 'session-1',
      active: true,
      phase: 'running' as const,
      output: 'MCLAW_FEISHU_QR_URL: https://open.feishu.cn/mock-qr',
      code: null,
      ok: true,
      canceled: false,
      command: ['openclaw', 'feishu-installer'],
    }
    const resources = await loadFeishuBotManagerRefreshResources({
      api: {
        getFeishuInstallerState: async () => installerSnapshot,
      },
      loadState: async () => state,
    })

    expect(resources).toEqual({
      state,
      installerSnapshot,
    })
  })
})

describe('getFeishuBotManagerInstallerInputFailureMessage', () => {
  it('keeps normal installer write failures actionable when the backend returns a regular error detail', () => {
    expect(
      getFeishuBotManagerInstallerInputFailureMessage({
        detail: 'The installer session is no longer writable.',
      })
    ).toBe('写入飞书官方安装器失败'
    )
  })

  it('keeps thrown installer write failures actionable when the ipc call rejects', () => {
    expect(
      getFeishuBotManagerInstallerInputFailureMessage({
        error: new Error('IPC channel closed'),
      })
    ).toBe('写入飞书官方安装器失败'
    )
  })
})

describe('getFeishuBotManagerActionFailureMessage', () => {
  it('keeps thrown dashboard action failures actionable when the error is a normal Error instance', () => {
    expect(
      getFeishuBotManagerActionFailureMessage({
        error: new Error('bridge disconnected'),
        fallback: '刷新飞书 Bot 列表失败',
      })
    ).toBe('刷新飞书 Bot 列表失败')
  })

  it('falls back cleanly when the thrown dashboard action failure is not a normal Error object', () => {
    expect(
      getFeishuBotManagerActionFailureMessage({
        error: { unexpected: true },
        fallback: '删除飞书 Bot 失败',
      })
    ).toBe('删除飞书 Bot 失败')
  })
})

describe('shouldResetFeishuBotManagerInstallerEphemeralState', () => {
  it('clears stale input and prompt state when the restored installer snapshot belongs to a different session', () => {
    expect(
      shouldResetFeishuBotManagerInstallerEphemeralState({
        currentSessionId: 'old-session',
        nextSessionId: 'new-session',
        active: true,
      })
    ).toBe(true)
  })

  it('keeps the current ephemeral state when refresh reattaches to the same running installer session', () => {
    expect(
      shouldResetFeishuBotManagerInstallerEphemeralState({
        currentSessionId: 'same-session',
        nextSessionId: 'same-session',
        active: true,
      })
    ).toBe(false)
  })

  it('clears stale state when the restored installer snapshot is inactive or missing its session id', () => {
    expect(
      shouldResetFeishuBotManagerInstallerEphemeralState({
        currentSessionId: 'finished-session',
        nextSessionId: 'finished-session',
        active: false,
      })
    ).toBe(true)
    expect(
      shouldResetFeishuBotManagerInstallerEphemeralState({
        currentSessionId: 'stale-session',
        nextSessionId: '',
        active: true,
      })
    ).toBe(true)
  })
})


