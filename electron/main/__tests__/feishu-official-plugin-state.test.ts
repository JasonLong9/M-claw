import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  applyConfigPatchGuardedMock,
  ensureFeishuManagedWorkspaceBootstrapMock,
  getOpenClawPathsMock,
  installPluginNpxMock,
  materializeBundledManagedPluginMock,
  resolveBundledManagedPluginSourcePathMock,
  readConfigMock,
  repairIncompatibleExtensionPluginsMock,
  reloadGatewayForConfigChangeMock,
} = vi.hoisted(() => ({
  applyConfigPatchGuardedMock: vi.fn(),
  ensureFeishuManagedWorkspaceBootstrapMock: vi.fn(),
  getOpenClawPathsMock: vi.fn(),
  installPluginNpxMock: vi.fn(),
  materializeBundledManagedPluginMock: vi.fn(),
  resolveBundledManagedPluginSourcePathMock: vi.fn(),
  readConfigMock: vi.fn(),
  repairIncompatibleExtensionPluginsMock: vi.fn(),
  reloadGatewayForConfigChangeMock: vi.fn(),
}))

vi.mock('../cli', () => ({
  getOpenClawPaths: getOpenClawPathsMock,
  installPluginNpx: installPluginNpxMock,
  readConfig: readConfigMock,
  repairIncompatibleExtensionPlugins: repairIncompatibleExtensionPluginsMock,
}))

vi.mock('../openclaw-config-coordinator', () => ({
  applyConfigPatchGuarded: applyConfigPatchGuardedMock,
}))

vi.mock('../openclaw-bundled-managed-plugin', () => ({
  materializeBundledManagedPlugin: materializeBundledManagedPluginMock,
  resolveBundledManagedPluginSourcePath: resolveBundledManagedPluginSourcePathMock,
}))

vi.mock('../gateway-lifecycle-controller', () => ({
  reloadGatewayForConfigChange: reloadGatewayForConfigChangeMock,
}))

vi.mock('../feishu-managed-workspace-bootstrap', () => ({
  ensureFeishuManagedWorkspaceBootstrap: ensureFeishuManagedWorkspaceBootstrapMock,
}))

vi.mock('../plugin-install-npx', () => ({
  FEISHU_PLUGIN_NPX_SPECIFIER: '@larksuite/openclaw-lark-tools',
}))

describe('getFeishuOfficialPluginState', () => {
  beforeEach(() => {
    applyConfigPatchGuardedMock.mockReset()
    ensureFeishuManagedWorkspaceBootstrapMock.mockReset()
    getOpenClawPathsMock.mockReset()
    installPluginNpxMock.mockReset()
    materializeBundledManagedPluginMock.mockReset()
    resolveBundledManagedPluginSourcePathMock.mockReset()
    readConfigMock.mockReset()
    repairIncompatibleExtensionPluginsMock.mockReset()
    reloadGatewayForConfigChangeMock.mockReset()
    applyConfigPatchGuardedMock.mockResolvedValue({ ok: true })
    ensureFeishuManagedWorkspaceBootstrapMock.mockResolvedValue({
      changed: false,
      changedWorkspaces: [],
    })
    materializeBundledManagedPluginMock.mockResolvedValue({
      ok: false,
      copied: false,
      sourcePath: null,
      targetPath: '/Users/alice/.openclaw/extensions/openclaw-lark',
      error: 'Bundled plugin source was not found.',
    })
    resolveBundledManagedPluginSourcePathMock.mockReturnValue(null)
    repairIncompatibleExtensionPluginsMock.mockResolvedValue({
      ok: true,
      repaired: false,
      incompatiblePlugins: [],
      quarantinedPluginIds: [],
      prunedPluginIds: [],
      summary: '',
      stderr: '',
    })
    reloadGatewayForConfigChangeMock.mockResolvedValue({
      ok: true,
      running: true,
      stdout: '',
      stderr: '',
      code: 0,
      summary: 'Gateway 已重载',
    })
  })

  it('strips legacy and official plugin config when the official plugin is not installed on disk', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      plugins: {
        allow: ['feishu', 'openclaw-lark', 'copilot-proxy'],
        entries: {
          feishu: { enabled: false },
          'openclaw-lark': { enabled: true },
        },
        installs: {
          'feishu-openclaw-plugin': { spec: '@legacy/feishu' },
          'openclaw-lark': { spec: '@larksuite/openclaw-lark' },
        },
      },
    })

    const { getFeishuOfficialPluginState } = await import('../feishu-official-plugin-state')
    const result = await getFeishuOfficialPluginState()

    expect(result.installedOnDisk).toBe(false)
    expect(result.installSource).toBe('')
    expect(result.bundledPayloadAvailable).toBe(false)
    expect(result.bundledPayloadPath).toBe('')
    expect(result.legacyPluginIdsPresent).toEqual(['feishu', 'feishu-openclaw-plugin'])
    expect(result.officialPluginConfigured).toBe(false)
    expect(result.configChanged).toBe(true)
    expect(result.normalizedConfig.plugins.allow).toEqual(['copilot-proxy'])
    expect(result.normalizedConfig.plugins.entries).toEqual({
      feishu: { enabled: false },
    })
    expect(result.normalizedConfig.plugins.installs).toEqual({})
  })

  it('keeps official plugin config when the plugin is installed on disk while still removing legacy residue', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      plugins: {
        allow: ['feishu', 'openclaw-lark'],
        entries: {
          feishu: { enabled: false },
          'openclaw-lark': { enabled: true },
        },
      },
    })

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const accessSpy = vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined)

    try {
      const { getFeishuOfficialPluginState } = await import('../feishu-official-plugin-state')
      const result = await getFeishuOfficialPluginState()

      expect(result.installedOnDisk).toBe(true)
      expect(result.bundledPayloadAvailable).toBe(false)
      expect(result.legacyPluginIdsPresent).toEqual(['feishu'])
      expect(result.officialPluginConfigured).toBe(true)
      expect(result.configChanged).toBe(true)
      expect(result.normalizedConfig.plugins.allow).toEqual(['openclaw-lark'])
      expect(result.normalizedConfig.plugins.entries).toEqual({
        feishu: { enabled: false },
        'openclaw-lark': { enabled: true },
      })
      expect(result.normalizedConfig.session.dmScope).toBe('per-account-channel-peer')
    } finally {
      accessSpy.mockRestore()
    }
  })

  it('normalizes feishu routing state even before the official plugin is installed on disk', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      agents: {
        list: [
          { id: 'feishu-bot', model: 'minimax/MiniMax-M2.1' },
        ],
      },
      bindings: [
        { agentId: 'feishu-bot', match: { channel: 'feishu', accountId: 'default' } },
      ],
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_default',
          appSecret: 'secret-default',
        },
      },
      plugins: {
        allow: ['feishu'],
      },
    })

    const { getFeishuOfficialPluginState } = await import('../feishu-official-plugin-state')
    const result = await getFeishuOfficialPluginState()

    expect(result.installedOnDisk).toBe(false)
    expect(result.officialPluginConfigured).toBe(false)
    expect(result.normalizedConfig.plugins.allow).toEqual([])
    expect(result.normalizedConfig.agents.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'feishu-default', model: 'minimax/MiniMax-M2.1' }),
      ])
    )
    expect(result.normalizedConfig.agents.list).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ id: 'feishu-bot' }),
      ])
    )
    expect(result.normalizedConfig.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agentId: 'feishu-default', match: { channel: 'feishu', accountId: 'default' } }),
      ])
    )
  })

  it('rebuilds install metadata, allowlist, and managed feishu isolation when the plugin exists on disk', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      agents: {
        list: [
          { id: 'feishu-bot', model: 'minimax/MiniMax-M2.1' },
        ],
      },
      bindings: [
        { agentId: 'feishu-bot', match: { channel: 'feishu', accountId: 'default' } },
      ],
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_default',
          appSecret: 'secret-default',
          accounts: {
            work: {
              enabled: true,
              name: 'Work Bot',
              appId: 'cli_work',
              appSecret: 'secret-work',
            },
          },
        },
      },
    })

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const path = process.getBuiltinModule('node:path') as typeof import('node:path')
    const accessSpy = vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined)

    try {
      const { getFeishuOfficialPluginState } = await import('../feishu-official-plugin-state')
      const result = await getFeishuOfficialPluginState()

      expect(result.installedOnDisk).toBe(true)
      expect(result.installSource).toBe('npm')
      expect(result.bundledPayloadAvailable).toBe(false)
      expect(result.officialPluginConfigured).toBe(true)
      expect(result.configChanged).toBe(true)
      expect(result.normalizedConfig.plugins.allow).toContain('openclaw-lark')
      expect(result.normalizedConfig.plugins.installs['openclaw-lark']).toEqual(
        expect.objectContaining({
          source: 'npm',
          spec: '@larksuite/openclaw-lark',
          installPath: path.join('/Users/alice/.openclaw', 'extensions', 'openclaw-lark'),
        })
      )
      expect(result.normalizedConfig.session.dmScope).toBe('per-account-channel-peer')
      expect(result.normalizedConfig.agents.list).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'feishu-default' }),
          expect.objectContaining({ id: 'feishu-work' }),
        ])
      )
      const migratedDefaultAgent = result.normalizedConfig.agents.list.find((agent: Record<string, any>) => agent.id === 'feishu-default')
      expect(migratedDefaultAgent).toEqual(
        expect.objectContaining({
          id: 'feishu-default',
          model: 'minimax/MiniMax-M2.1',
        })
      )
      expect(result.normalizedConfig.agents.list).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({ id: 'feishu-bot' }),
        ])
      )
      expect(result.normalizedConfig.bindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ agentId: 'feishu-default', match: { channel: 'feishu', accountId: 'default' } }),
          expect.objectContaining({ agentId: 'feishu-work', match: { channel: 'feishu', accountId: 'work' } }),
        ])
      )
      expect(result.normalizedConfig.bindings).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({ agentId: 'feishu-bot' }),
        ])
      )
    } finally {
      accessSpy.mockRestore()
    }
  })

  it('normalizes legacy bundled install metadata to a path source while preserving the install path', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_default',
          appSecret: 'secret-default',
        },
      },
      plugins: {
        allow: ['openclaw-lark'],
        installs: {
          'openclaw-lark': {
            source: 'bundled',
            spec: '@larksuite/openclaw-lark',
            installPath: '/Users/alice/.openclaw/extensions/openclaw-lark',
          },
        },
      },
    })

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const accessSpy = vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined)
    resolveBundledManagedPluginSourcePathMock.mockReturnValue('D:/bundle/openclaw-lark')

    try {
      const { getFeishuOfficialPluginState } = await import('../feishu-official-plugin-state')
      const result = await getFeishuOfficialPluginState()

      expect(result.installedOnDisk).toBe(true)
      expect(result.installSource).toBe('path')
      expect(result.bundledPayloadAvailable).toBe(true)
      expect(result.bundledPayloadPath).toBe('D:/bundle/openclaw-lark')
      expect(result.normalizedConfig.plugins.installs['openclaw-lark']).toEqual(
        expect.objectContaining({
          source: 'path',
          spec: '@larksuite/openclaw-lark',
          installPath: '/Users/alice/.openclaw/extensions/openclaw-lark',
        })
      )
    } finally {
      accessSpy.mockRestore()
    }
  })

  it('installs the official plugin on demand when it is missing for link preparation', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_default',
          appSecret: 'secret-default',
        },
      },
      plugins: {
        allow: ['feishu'],
      },
    })

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const path = process.getBuiltinModule('node:path') as typeof import('node:path')
    const accessSpy = vi
      .spyOn(fs.promises, 'access')
      .mockRejectedValueOnce(new Error('missing'))
      .mockRejectedValueOnce(new Error('still-missing-before-install'))
      .mockResolvedValue(undefined)
      .mockResolvedValue(undefined)

    installPluginNpxMock.mockResolvedValue({
      ok: true,
      stdout: 'installed',
      stderr: '',
      code: 0,
    })

    try {
      const { ensureFeishuOfficialPluginReady } = await import('../feishu-official-plugin-state')
      const result = await ensureFeishuOfficialPluginReady()

      expect(result.ok).toBe(true)
      expect(result.installedThisRun).toBe(true)
      expect(materializeBundledManagedPluginMock).toHaveBeenCalledWith({
        pluginId: 'openclaw-lark',
        targetPath: path.join('/Users/alice/.openclaw', 'extensions', 'openclaw-lark'),
        resourcesPath: process.resourcesPath,
        cwd: process.cwd(),
      })
      expect(installPluginNpxMock).toHaveBeenCalledWith('@larksuite/openclaw-lark-tools', ['openclaw-lark'])
      expect(result.state.installedOnDisk).toBe(true)
      expect(result.state.installSource).toBe('npm')
      expect(applyConfigPatchGuardedMock).toHaveBeenCalled()
      expect(reloadGatewayForConfigChangeMock).toHaveBeenCalledWith('feishu-official-plugin-install')
    } finally {
      accessSpy.mockRestore()
    }
  })

  it('prefers the bundled official plugin payload before falling back to npm installation', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_default',
          appSecret: 'secret-default',
        },
      },
    })

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const path = process.getBuiltinModule('node:path') as typeof import('node:path')
    const accessSpy = vi
      .spyOn(fs.promises, 'access')
      .mockRejectedValueOnce(new Error('missing'))
      .mockRejectedValueOnce(new Error('still-missing-before-install'))
      .mockResolvedValue(undefined)
      .mockResolvedValue(undefined)

    materializeBundledManagedPluginMock.mockResolvedValue({
      ok: true,
      copied: true,
      sourcePath: 'D:/bundle/openclaw-lark',
      targetPath: '/Users/alice/.openclaw/extensions/openclaw-lark',
    })
    resolveBundledManagedPluginSourcePathMock.mockReturnValue('D:/bundle/openclaw-lark')

    try {
      const { ensureFeishuOfficialPluginReady } = await import('../feishu-official-plugin-state')
      const result = await ensureFeishuOfficialPluginReady()

      expect(result.ok).toBe(true)
      expect(result.installedThisRun).toBe(true)
      expect(installPluginNpxMock).not.toHaveBeenCalled()
      expect(result.stdout).toContain('Installed bundled openclaw-lark')
      expect(result.state.installedOnDisk).toBe(true)
      expect(result.state.installSource).toBe('path')
      expect(result.state.bundledPayloadAvailable).toBe(true)
      expect(result.state.normalizedConfig.plugins.installs['openclaw-lark']).toEqual(
        expect.objectContaining({
          source: 'path',
          installPath: path.join('/Users/alice/.openclaw', 'extensions', 'openclaw-lark'),
        })
      )
      expect(reloadGatewayForConfigChangeMock).toHaveBeenCalledWith('feishu-official-plugin-install')
    } finally {
      accessSpy.mockRestore()
    }
  })

  it('heals config and skips reinstallation when the official plugin already exists on disk', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_default',
          appSecret: 'secret-default',
        },
      },
    })

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const accessSpy = vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined)

    try {
      const { ensureFeishuOfficialPluginReady } = await import('../feishu-official-plugin-state')
      const result = await ensureFeishuOfficialPluginReady()

      expect(result.ok).toBe(true)
      expect(result.installedThisRun).toBe(false)
      expect(installPluginNpxMock).not.toHaveBeenCalled()
      expect(result.state.installedOnDisk).toBe(true)
      expect(result.state.officialPluginConfigured).toBe(true)
      expect(applyConfigPatchGuardedMock).toHaveBeenCalledTimes(1)
      expect(reloadGatewayForConfigChangeMock).toHaveBeenCalledWith('feishu-official-plugin-config-sync')
    } finally {
      accessSpy.mockRestore()
    }
  })

  it('quarantines incompatible official plugin residue before reinstalling the managed plugin', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      session: {
        dmScope: 'per-account-channel-peer',
      },
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_default',
          appSecret: 'secret-default',
        },
      },
      plugins: {
        allow: ['openclaw-lark'],
        entries: {
          feishu: { enabled: false },
          'openclaw-lark': { enabled: true },
        },
        installs: {
          'openclaw-lark': {
            source: 'npm',
            spec: '@larksuite/openclaw-lark',
            installPath: '/Users/alice/.openclaw/extensions/openclaw-lark',
          },
        },
      },
    })

    repairIncompatibleExtensionPluginsMock.mockResolvedValue({
      ok: true,
      repaired: true,
      incompatiblePlugins: [
        {
          pluginId: 'openclaw-lark',
          packageName: '@larksuite/openclaw-lark',
          installPath: '/Users/alice/.openclaw/extensions/openclaw-lark',
          displayInstallPath: '/Users/alice/.openclaw/extensions/openclaw-lark',
          reason: '插件导入 smoke test 失败：TypeError: normalizeAccountId is not a function',
        },
      ],
      quarantinedPluginIds: ['openclaw-lark'],
      prunedPluginIds: ['openclaw-lark'],
      summary: '已自动隔离 1 个坏插件并清理相关配置。',
      stderr: '',
    })

    installPluginNpxMock.mockResolvedValue({
      ok: true,
      stdout: 'installed',
      stderr: '',
      code: 0,
    })

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const accessSpy = vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined)
    accessSpy
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('quarantined'))

    try {
      const { ensureFeishuOfficialPluginReady } = await import('../feishu-official-plugin-state')
      const result = await ensureFeishuOfficialPluginReady()

      expect(repairIncompatibleExtensionPluginsMock).toHaveBeenCalledWith({
        scopePluginIds: ['openclaw-lark', 'feishu', 'feishu-openclaw-plugin'],
        quarantineOfficialManagedPlugins: true,
      })
      expect(installPluginNpxMock).toHaveBeenCalledWith('@larksuite/openclaw-lark-tools', ['openclaw-lark'])
      expect(result.ok).toBe(true)
      expect(result.installedThisRun).toBe(true)
      expect(reloadGatewayForConfigChangeMock).toHaveBeenCalledWith('feishu-official-plugin-install')
    } finally {
      accessSpy.mockRestore()
    }
  })

  it('surfaces bundled payload materialization failure instead of silently falling back to npm', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_default',
          appSecret: 'secret-default',
        },
      },
    })

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const accessSpy = vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('missing'))

    materializeBundledManagedPluginMock.mockResolvedValue({
      ok: false,
      copied: false,
      sourcePath: 'D:/bundle/openclaw-lark',
      targetPath: '/Users/alice/.openclaw/extensions/openclaw-lark',
      error: 'copy failed',
    })

    try {
      const { ensureFeishuOfficialPluginReady } = await import('../feishu-official-plugin-state')
      const result = await ensureFeishuOfficialPluginReady()

      expect(result.ok).toBe(false)
      expect(result.installedThisRun).toBe(false)
      expect(result.stderr).toContain('copy failed')
      expect(installPluginNpxMock).not.toHaveBeenCalled()
      expect(reloadGatewayForConfigChangeMock).not.toHaveBeenCalled()
    } finally {
      accessSpy.mockRestore()
    }
  })

  it('applies config healing before surfacing install failure when the official plugin is missing', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock.mockResolvedValue({
      agents: {
        list: [
          { id: 'feishu-bot', model: 'minimax/MiniMax-M2.1' },
        ],
      },
      bindings: [
        { agentId: 'feishu-bot', match: { channel: 'feishu', accountId: 'default' } },
      ],
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_default',
          appSecret: 'secret-default',
        },
      },
    })

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const accessSpy = vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('missing'))

    installPluginNpxMock.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'network failed',
      code: 1,
    })

    try {
      const { ensureFeishuOfficialPluginReady } = await import('../feishu-official-plugin-state')
      const result = await ensureFeishuOfficialPluginReady()

      expect(result.ok).toBe(false)
      expect(result.installedThisRun).toBe(false)
      expect(applyConfigPatchGuardedMock).toHaveBeenCalledTimes(1)
      expect(reloadGatewayForConfigChangeMock).not.toHaveBeenCalled()
      expect(result.state.normalizedConfig.agents.list).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'feishu-default', model: 'minimax/MiniMax-M2.1' }),
        ])
      )
    } finally {
      accessSpy.mockRestore()
    }
  })

  it('does not claim the plugin was installed when post-install config healing fails after a failed install', async () => {
    getOpenClawPathsMock.mockResolvedValue({
      homeDir: '/Users/alice/.openclaw',
    })
    readConfigMock
      .mockResolvedValueOnce({})
      .mockResolvedValue({
        agents: {
          list: [
            { id: 'feishu-bot', model: 'minimax/MiniMax-M2.1' },
          ],
        },
        bindings: [
          { agentId: 'feishu-bot', match: { channel: 'feishu', accountId: 'default' } },
        ],
        channels: {
          feishu: {
            enabled: true,
            appId: 'cli_default',
            appSecret: 'secret-default',
          },
        },
      })

    applyConfigPatchGuardedMock
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('after-install-patch-failed'))

    const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
    const accessSpy = vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('missing'))

    installPluginNpxMock.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'network failed',
      code: 1,
    })

    try {
      const { ensureFeishuOfficialPluginReady } = await import('../feishu-official-plugin-state')
      const result = await ensureFeishuOfficialPluginReady()

      expect(result.ok).toBe(false)
      expect(result.installedThisRun).toBe(false)
      expect(result.message).toBe('飞书官方插件安装失败，且配置归一化失败。')
      expect(result.stderr).toContain('network failed')
      expect(result.stderr).toContain('after-install-patch-failed')
      expect(reloadGatewayForConfigChangeMock).not.toHaveBeenCalled()
    } finally {
      accessSpy.mockRestore()
    }
  })
})
