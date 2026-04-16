import { describe, expect, it } from 'vitest'

import {
  sanitizeManagedRuntimeProviderEnv,
  shouldDropManagedRuntimeProviderEnvKey,
} from '../managed-runtime-env'

describe('managed-runtime-env', () => {
  it('drops known provider auth env keys case-insensitively', () => {
    expect(shouldDropManagedRuntimeProviderEnvKey('DEEPSEEK_API_KEY')).toBe(true)
    expect(shouldDropManagedRuntimeProviderEnvKey('anthropic_api_key')).toBe(true)
    expect(shouldDropManagedRuntimeProviderEnvKey('OPENAI_BASE_URL')).toBe(true)
    expect(shouldDropManagedRuntimeProviderEnvKey('VLLM_BASE_URL')).toBe(true)
    expect(shouldDropManagedRuntimeProviderEnvKey('SOME_RANDOM_KEY')).toBe(false)
  })

  it('removes provider auth keys while keeping unrelated process env values', () => {
    const sanitized = sanitizeManagedRuntimeProviderEnv({
      APP_ROOT: 'D:\\workspace\\Mclaw',
      VITE_PUBLIC: 'D:\\workspace\\Mclaw\\public',
      PATH: 'C:\\tools',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      deepseek_api_key: 'sk-deepseek-test',
      OPENAI_BASE_URL: 'https://example.local',
      HOME: 'C:\\Users\\James',
      HTTPS_PROXY: 'http://127.0.0.1:7890',
    })

    expect(sanitized.ANTHROPIC_API_KEY).toBeUndefined()
    expect(sanitized.deepseek_api_key).toBeUndefined()
    expect(sanitized.OPENAI_BASE_URL).toBeUndefined()
    expect(sanitized.PATH).toBe('C:\\tools')
    expect(sanitized.HOME).toBe('C:\\Users\\James')
    expect(sanitized.HTTPS_PROXY).toBe('http://127.0.0.1:7890')
  })
})
