import { atomicWriteJson } from './atomic-write'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

const FOREGROUND_PREFERENCE_STORE_PATH = path.join('data-guard', 'gateway-foreground-preference.json')

interface ForegroundPreferenceStore {
  preferForeground: boolean
}

function resolveStorePath(): string {
  return path.join(
    String(process.env.QCLAW_USER_DATA_DIR || path.join(os.homedir(), '.qclaw-lite')).trim(),
    FOREGROUND_PREFERENCE_STORE_PATH,
  )
}

async function loadStore(): Promise<ForegroundPreferenceStore> {
  try {
    const raw = await fs.promises.readFile(resolveStorePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<ForegroundPreferenceStore>
    return {
      preferForeground: Boolean(parsed.preferForeground),
    }
  } catch {
    return { preferForeground: false }
  }
}

export async function markForegroundGatewayUsed(): Promise<void> {
  const storePath = resolveStorePath()
  await atomicWriteJson(storePath, { preferForeground: true }, {
    description: 'Gateway 前台模式偏好',
  })
}

export async function shouldPreferForegroundGateway(): Promise<boolean> {
  const store = await loadStore()
  return store.preferForeground
}
