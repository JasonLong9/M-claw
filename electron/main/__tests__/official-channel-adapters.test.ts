import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ensureFeishuOfficialPluginReadyMock,
  getFeishuBotRuntimeStatusesMock,
  getFeishuOfficialPluginStateMock,
  isPluginInstalledOnDiskMock,
  repairStalePluginConfigFromCommandResultMock,
  repairDingtalkOfficialChannelMock,
  runCliMock,
} = vi.hoisted(() => ({
  ensureFeishuOfficialPluginReadyMock: vi.fn(),
  getFeishuBotRuntimeStatusesMock: vi.fn(),
  getFeishuOfficialPluginStateMock: vi.fn(),
  isPluginInstalledOnDiskMock: vi.fn(),
  repairStalePluginConfigFromCommandResultMock: vi.fn(),
  repairDingtalkOfficialChannelMock: vi.fn(),
  runCliMock: vi.fn(),
}))

vi.mock('../cli', () => ({
  getFeishuBotRuntimeStatuses: getFeishuBotRuntimeStatusesMock,
  isPluginInstalledOnDisk: isPluginInstalledOnDiskMock,
  runCli: runCliMock,
}))

vi.mock('../feishu-official-plugin-state', () => ({
  ensureFeishuOfficialPluginReady: ensureFeishuOfficialPluginReadyMock,
  getFeishuOfficialPluginState: getFeishuOfficialPluginStateMock,
}))

vi.mock('../openclaw-config-warnings', () => ({
  repairStalePluginConfigFromCommandResult: repairStalePluginConfigFromCommandResultMock,
}))

vi.mock('../dingtalk-official-channel', () => ({
  repairDingtalkOfficialChannel: repairDingtalkOfficialChannelMock,
}))

describe('official channel adapters', () => {
  beforeEach(() => {
    vi.resetModules()
    ensureFeishuOfficialPluginReadyMock.mockReset()
    getFeishuBotRuntimeStatusesMock.mockReset()
    getFeishuOfficialPluginStateMock.mockReset()
    isPluginInstalledOnDiskMock.mockReset()
    repairStalePluginConfigFromCommandResultMock.mockReset()
    repairDingtalkOfficialChannelMock.mockReset()
    runCliMock.mockReset()

    getFeishuBotRuntimeStatusesMock.mockResolvedValue({})
    repairStalePluginConfigFromCommandResultMock.mockResolvedValue({
      stalePluginIds: [],
      changed: false,
      removedPluginIds: [],
    })
  })

  it('maps DingTalk status into evidence-backed installed / registered / loaded / ready stages', async () => {
    isPluginInstalledOnDiskMock.mockResolvedValue(true)
    runCliMock.mockResolvedValue({
      ok: true,
      stdout: JSON.stringify({
        plugins: [{ id: 'dingtalk-connector' }],
      }),
      stderr: '',
      code: 0,
    })

    const { getOfficialChannelStatus } = await import('../official-channel-adapters')
    const result = await getOfficialChannelStatus('dingtalk')

    expect(result.summary).toContain('已安装并已注册')
    expect(result.stages).toEqual([
      {
        id: 'installed',
        state: 'verified',
        source: 'disk',
        message: '已确认本机存在钉钉官方插件安装。',
      },
      {
        id: 'registered',
        state: 'verified',
        source: 'plugins-list',
        message: '已在上游 plugins list 中确认插件已注册。',
      },
      {
        id: 'loaded',
        state: 'unknown',
        source: 'upstream-status-missing',
        message: '当前缺少上游 loaded 证明。',
      },
      {
        id: 'ready',
        state: 'unknown',
        source: 'upstream-probe-missing',
        message: '当前缺少上游 ready 证明。',
      },
    ])
  })

  it('surfaces Feishu config drift without promoting runtime readiness', async () => {
    getFeishuOfficialPluginStateMock.mockResolvedValue({
      pluginId: 'openclaw-lark',
      installedOnDisk: true,
      installPath: '/tmp/home/extensions/openclaw-lark',
      officialPluginConfigured: false,
      legacyPluginIdsPresent: [],
      configChanged: true,
      normalizedConfig: {},
    })
    runCliMock.mockResolvedValue({
      ok: true,
      stdout: JSON.stringify({
        plugins: [{ id: 'openclaw-lark' }],
      }),
      stderr: '',
      code: 0,
    })

    const { getOfficialChannelStatus } = await import('../official-channel-adapters')
    const result = await getOfficialChannelStatus('feishu')

    expect(result.summary).toContain('配置仍待同步')
    expect(result.stages.find((stage) => stage.id === 'registered')?.state).toBe('verified')
    expect(result.stages.find((stage) => stage.id === 'loaded')?.state).toBe('unknown')
    expect(result.stages.find((stage) => stage.id === 'ready')?.state).toBe('unknown')
  })

  it('promotes Feishu loaded / ready once runtime status proves an online bot', async () => {
    getFeishuOfficialPluginStateMock.mockResolvedValue({
      pluginId: 'openclaw-lark',
      installedOnDisk: true,
      installPath: '/tmp/home/extensions/openclaw-lark',
      officialPluginConfigured: true,
      legacyPluginIdsPresent: [],
      configChanged: false,
      normalizedConfig: {},
    })
    getFeishuBotRuntimeStatusesMock.mockResolvedValue({
      default: {
        runtimeState: 'online',
        summary: 'running',
        issues: [],
        gatewayRunning: true,
      },
    })
    runCliMock.mockResolvedValue({
      ok: true,
      stdout: JSON.stringify({
        plugins: [{ id: 'openclaw-lark' }],
      }),
      stderr: '',
      code: 0,
    })

    const { getOfficialChannelStatus } = await import('../official-channel-adapters')
    const result = await getOfficialChannelStatus('feishu')

    expect(result.summary).toContain('运行中')
    expect(result.stages.find((stage) => stage.id === 'loaded')).toEqual({
      id: 'loaded',
      state: 'verified',
      source: 'gateway-runtime',
      message: '已通过飞书运行态确认当前 Gateway 已暴露飞书 Bot 运行快照。',
    })
    expect(result.stages.find((stage) => stage.id === 'ready')).toEqual({
      id: 'ready',
      state: 'verified',
      source: 'gateway-runtime',
      message: '已通过飞书运行态确认 1 个飞书 Bot 处于在线状态。',
    })
  })

  it('retries plugins list once after stale plugin repair so registration evidence can recover', async () => {
    getFeishuOfficialPluginStateMock.mockResolvedValue({
      pluginId: 'openclaw-lark',
      installedOnDisk: true,
      installPath: '/tmp/home/extensions/openclaw-lark',
      officialPluginConfigured: true,
      legacyPluginIdsPresent: [],
      configChanged: false,
      normalizedConfig: {},
    })
    runCliMock
      .mockResolvedValueOnce({
        ok: true,
        stdout:
          'Config warnings:\n- plugins.allow: plugin not found: fake-stale-plugin (stale config entry ignored; remove it from plugins config)',
        stderr: '',
        code: 0,
      })
      .mockResolvedValueOnce({
        ok: true,
        stdout: JSON.stringify({
          plugins: [{ id: 'openclaw-lark' }],
        }),
        stderr: '',
        code: 0,
      })
    repairStalePluginConfigFromCommandResultMock.mockResolvedValue({
      stalePluginIds: ['fake-stale-plugin'],
      changed: true,
      removedPluginIds: ['fake-stale-plugin'],
    })

    const { getOfficialChannelStatus } = await import('../official-channel-adapters')
    const result = await getOfficialChannelStatus('feishu')

    expect(runCliMock).toHaveBeenCalledTimes(2)
    expect(repairStalePluginConfigFromCommandResultMock).toHaveBeenCalledTimes(1)
    expect(result.stages.find((stage) => stage.id === 'registered')?.state).toBe('verified')
  })

  it('maps Feishu repair to the shared official adapter result shape', async () => {
    ensureFeishuOfficialPluginReadyMock.mockResolvedValue({
      ok: true,
      installedThisRun: false,
      state: {
        pluginId: 'openclaw-lark',
        installedOnDisk: true,
        officialPluginConfigured: true,
        configChanged: false,
      },
      stdout: '',
      stderr: '',
      code: 0,
      message: '已确认飞书官方插件可用。',
    })

    const { repairOfficialChannel } = await import('../official-channel-adapters')
    const result = await repairOfficialChannel('feishu')

    expect(result).toEqual({
      ok: true,
      channelId: 'feishu',
      pluginId: 'openclaw-lark',
      summary: '飞书官方插件已归一化；loaded / ready 仍待运行态证据。',
      installedThisRun: false,
      gatewayResult: null,
      evidence: [
        {
          source: 'status',
          channelId: 'feishu',
          pluginId: 'openclaw-lark',
          message: '已确认飞书官方插件安装存在，且配置已处于归一化状态。',
        },
      ],
      stdout: '',
      stderr: '',
      code: 0,
      message: '已确认飞书官方插件可用。',
    })
  })

  it('delegates DingTalk repair to the dedicated official adapter pipeline', async () => {
    repairDingtalkOfficialChannelMock.mockResolvedValue({
      ok: true,
      channelId: 'dingtalk',
      pluginId: 'dingtalk-connector',
      summary: '钉钉官方插件已修复；loaded / ready 仍待上游证据。',
      installedThisRun: false,
      gatewayResult: null,
      evidence: [],
      stdout: '',
      stderr: '',
      code: 0,
      message: '钉钉官方插件已完成修复。',
    })

    const { repairOfficialChannel } = await import('../official-channel-adapters')
    const result = await repairOfficialChannel('dingtalk')

    expect(repairDingtalkOfficialChannelMock).toHaveBeenCalledTimes(1)
    expect(result.summary).toBe('钉钉官方插件已修复；loaded / ready 仍待上游证据。')
  })
})
