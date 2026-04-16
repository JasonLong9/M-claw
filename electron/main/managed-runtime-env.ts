import { listKnownProviderMetadata } from '../../src/lib/openclaw-provider-registry'

const MANAGED_RUNTIME_PROVIDER_ENV_KEYS = (() => {
  const keys = new Set<string>([
    // Local provider compatibility keys are not part of provider metadata,
    // but they still come from host env and should not leak into managed runs.
    'OPENAI_BASE_URL',
    'OPENAI_API_KEY',
    'OLLAMA_HOST',
    'OLLAMA_API_KEY',
    'VLLM_BASE_URL',
    'VLLM_API_KEY',
  ])

  for (const provider of listKnownProviderMetadata()) {
    const primaryEnvKey = String(provider.primaryEnvKey || '').trim().toUpperCase()
    if (primaryEnvKey) {
      keys.add(primaryEnvKey)
    }

    for (const method of provider.methods || []) {
      const methodEnvKey = String(method.envKey || '').trim().toUpperCase()
      if (methodEnvKey) {
        keys.add(methodEnvKey)
      }
    }
  }

  return keys
})()

export function shouldDropManagedRuntimeProviderEnvKey(key: string): boolean {
  const normalizedKey = String(key || '').trim().toUpperCase()
  if (!normalizedKey) return false
  return MANAGED_RUNTIME_PROVIDER_ENV_KEYS.has(normalizedKey)
}

export function sanitizeManagedRuntimeProviderEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cloned: NodeJS.ProcessEnv = { ...env }
  for (const key of Object.keys(cloned)) {
    if (shouldDropManagedRuntimeProviderEnvKey(key)) {
      delete cloned[key]
    }
  }
  return cloned
}

