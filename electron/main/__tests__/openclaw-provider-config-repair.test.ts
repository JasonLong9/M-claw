import { describe, expect, it, vi } from 'vitest'

import {
  repairKnownProviderConfigGaps,
  repairKnownProviderConfigGapsOnDisk,
} from '../openclaw-provider-config-repair'

describe('openclaw provider config repair', () => {
  it('fills the missing minimax-portal api metadata with the upstream anthropic runtime', () => {
    const result = repairKnownProviderConfigGaps({
      models: {
        providers: {
          'minimax-portal': {
            baseUrl: 'https://api.minimax.io/anthropic',
            models: [],
          },
        },
      },
    })

    expect(result.changed).toBe(true)
    expect(result.repairedJsonPaths).toEqual(['$.models.providers.minimax-portal.api'])
    expect(result.config).toEqual({
      models: {
        providers: {
          'minimax-portal': {
            baseUrl: 'https://api.minimax.io/anthropic',
            models: [],
            api: 'anthropic-messages',
          },
        },
      },
    })
  })

  it('leaves minimax-portal unchanged when the api metadata is already present', () => {
    const config = {
      models: {
        providers: {
          'minimax-portal': {
            baseUrl: 'https://api.minimax.io/anthropic',
            models: [],
            api: 'anthropic-messages',
          },
        },
      },
    }

    const result = repairKnownProviderConfigGaps(config)

    expect(result.changed).toBe(false)
    expect(result.config).toBe(config)
  })

  it('strips the legacy custom-openai enabled flag that breaks OpenClaw 2026.3.24 health and gateway commands', () => {
    const result = repairKnownProviderConfigGaps({
      models: {
        providers: {
          'custom-openai': {
            enabled: true,
            baseUrl: 'http://127.0.0.1:1234/v1',
            models: [{ id: 'qwen3', name: 'qwen3' }],
          },
        },
      },
    })

    expect(result.changed).toBe(true)
    expect(result.repairedJsonPaths).toEqual(['$.models.providers.custom-openai.enabled'])
    expect(result.config).toEqual({
      models: {
        providers: {
          'custom-openai': {
            baseUrl: 'http://127.0.0.1:1234/v1',
            models: [{ id: 'qwen3', name: 'qwen3' }],
          },
        },
      },
    })
  })

  it('migrates DeepSeek official custom-openai configs onto the bundled deepseek provider', () => {
    const result = repairKnownProviderConfigGaps({
      models: {
        providers: {
          'custom-openai': {
            enabled: true,
            baseUrl: 'https://api.deepseek.com/v1',
            models: [{ id: 'deepseek-chat', name: 'deepseek-chat' }],
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: 'custom-openai/deepseek-chat',
          },
          models: {
            'custom-openai/deepseek-chat': {
              alias: 'DeepSeek',
            },
          },
        },
      },
    })

    expect(result.changed).toBe(true)
    expect(result.repairedJsonPaths).toEqual(['$.models.providers.custom-openai->deepseek'])
    expect(result.providerMigrations).toEqual([{ fromProvider: 'custom-openai', toProvider: 'deepseek' }])
    expect(result.config).toEqual({
      models: {
        providers: {
          deepseek: {
            api: 'openai-completions',
            baseUrl: 'https://api.deepseek.com',
            models: [{ id: 'deepseek-chat', name: 'deepseek-chat' }],
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: 'deepseek/deepseek-chat',
          },
          models: {
            'deepseek/deepseek-chat': {
              alias: 'DeepSeek',
            },
          },
        },
      },
    })
  })

  it('applies both provider repairs in a single on-disk write when needed', async () => {
    const writeConfig = vi.fn(async () => undefined)

    const result = await repairKnownProviderConfigGapsOnDisk({
      readConfig: async () => ({
        models: {
          providers: {
            'minimax-portal': {
              baseUrl: 'https://api.minimax.io/anthropic',
              models: [],
            },
            'custom-openai': {
              enabled: true,
              baseUrl: 'http://127.0.0.1:1234/v1',
              models: [{ id: 'qwen3', name: 'qwen3' }],
            },
          },
        },
      }),
      writeConfig,
    })

    expect(result.changed).toBe(true)
    expect(result.repairedJsonPaths).toEqual([
      '$.models.providers.minimax-portal.api',
      '$.models.providers.custom-openai.enabled',
    ])
    expect(writeConfig).toHaveBeenCalledWith({
      models: {
        providers: {
          'minimax-portal': {
            baseUrl: 'https://api.minimax.io/anthropic',
            models: [],
            api: 'anthropic-messages',
          },
          'custom-openai': {
            baseUrl: 'http://127.0.0.1:1234/v1',
            models: [{ id: 'qwen3', name: 'qwen3' }],
          },
        },
      },
    })
  })

  it('repairs the on-disk config only when the provider gap exists', async () => {
    const writeConfig = vi.fn(async () => undefined)

    const changedResult = await repairKnownProviderConfigGapsOnDisk({
      readConfig: async () => ({
        models: {
          providers: {
            'minimax-portal': {
              baseUrl: 'https://api.minimax.io/anthropic',
              models: [],
            },
          },
        },
      }),
      writeConfig,
    })

    expect(changedResult.changed).toBe(true)
    expect(writeConfig).toHaveBeenCalledWith({
      models: {
        providers: {
          'minimax-portal': {
            baseUrl: 'https://api.minimax.io/anthropic',
            models: [],
            api: 'anthropic-messages',
          },
        },
      },
    })

    writeConfig.mockClear()

    const unchangedResult = await repairKnownProviderConfigGapsOnDisk({
      readConfig: async () => ({
        models: {
          providers: {
            'minimax-portal': {
              baseUrl: 'https://api.minimax.io/anthropic',
              models: [],
              api: 'anthropic-messages',
            },
          },
        },
      }),
      writeConfig,
    })

    expect(unchangedResult.changed).toBe(false)
    expect(writeConfig).not.toHaveBeenCalled()
  })
})
