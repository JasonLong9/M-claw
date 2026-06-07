import { beforeEach, describe, expect, it, vi } from 'vitest'

const { repairAgentAuthProfilesFromOtherAgentStoresMock } = vi.hoisted(() => ({
  repairAgentAuthProfilesFromOtherAgentStoresMock: vi.fn(),
}))

vi.mock('../local-model-probe', () => ({
  repairAgentAuthProfilesFromOtherAgentStores: repairAgentAuthProfilesFromOtherAgentStoresMock,
}))

import { ensureFeishuManagedAgentAuthBootstrap } from '../feishu-managed-auth-bootstrap'

describe('ensureFeishuManagedAgentAuthBootstrap', () => {
  beforeEach(() => {
    repairAgentAuthProfilesFromOtherAgentStoresMock.mockReset()
  })

  it('repairs configured provider auth into each managed Feishu agent store', async () => {
    repairAgentAuthProfilesFromOtherAgentStoresMock.mockResolvedValue({
      ok: true,
      repaired: true,
      updatedAuthStorePaths: [
        '/tmp/openclaw/agents/feishu-default/agent/auth-profiles.json',
        '/tmp/openclaw/agents/feishu-work/agent/auth-profiles.json',
      ],
      importedProfileIds: ['deepseek:default'],
      importedProviders: ['deepseek'],
      sourceAuthStorePaths: ['/tmp/openclaw/agents/main/agent/auth-profiles.json'],
    })

    const result = await ensureFeishuManagedAgentAuthBootstrap({
      homeDir: '/tmp/openclaw',
      config: {
        agents: {
          defaults: {
            model: {
              primary: 'deepseek/deepseek-chat',
            },
          },
        },
        channels: {
          feishu: {
            appId: 'cli_default',
            appSecret: 'secret',
            accounts: {
              work: {
                appId: 'cli_work',
                appSecret: 'secret',
              },
            },
          },
        },
      },
    })

    expect(repairAgentAuthProfilesFromOtherAgentStoresMock).toHaveBeenCalledWith(
      {
        providerIds: ['deepseek'],
        targetAgentIds: ['feishu-default', 'feishu-work'],
      },
      {
        resolveRuntimePaths: expect.any(Function),
      }
    )
    expect(result).toEqual({
      ok: true,
      changed: true,
      providerIds: ['deepseek'],
      targetAgentIds: ['feishu-default', 'feishu-work'],
      updatedAgentIds: ['feishu-default', 'feishu-work'],
      importedProfileIds: ['deepseek:default'],
      importedProviders: ['deepseek'],
      sourceAuthStorePaths: ['/tmp/openclaw/agents/main/agent/auth-profiles.json'],
    })
  })

  it('returns a no-op result when no Feishu bot is configured', async () => {
    const result = await ensureFeishuManagedAgentAuthBootstrap({
      homeDir: '/tmp/openclaw',
      config: {
        agents: {
          defaults: {
            model: {
              primary: 'deepseek/deepseek-chat',
            },
          },
        },
      },
    })

    expect(repairAgentAuthProfilesFromOtherAgentStoresMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      changed: false,
      providerIds: [],
      targetAgentIds: [],
      updatedAgentIds: [],
      importedProfileIds: [],
      importedProviders: [],
      sourceAuthStorePaths: [],
    })
  })
})
