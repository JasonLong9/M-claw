export type OpenClawBundledDeliveryMode =
  | 'bundled-runtime'
  | 'bundled-fallback'
  | 'online-fallback'
  | 'external'

export interface OpenClawBundledArtifactManifest {
  tgz?: {
    fileName: string
    version: string
  } | null
  runtime?: {
    platform: 'win32' | 'darwin' | 'linux'
    arch: string
    directoryName: string
    version: string
  }[] | null
  managedPlugins?: {
    id: string
    directoryName: string
    version: string
    channels?: string[] | null
  }[] | null
}

export interface OpenClawBundledRuntimeManifest {
  schemaVersion: 1
  product: 'Mclaw'
  openclawVersion: string
  defaultDeliveryMode: OpenClawBundledDeliveryMode
  targetDeliveryMode: OpenClawBundledDeliveryMode
  artifacts: OpenClawBundledArtifactManifest
  notes?: string[] | null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isDeliveryMode(value: unknown): value is OpenClawBundledDeliveryMode {
  return (
    value === 'bundled-runtime' ||
    value === 'bundled-fallback' ||
    value === 'online-fallback' ||
    value === 'external'
  )
}

export function isOpenClawBundledRuntimeManifest(
  value: unknown
): value is OpenClawBundledRuntimeManifest {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.schemaVersion !== 1) return false
  if (record.product !== 'Mclaw') return false
  if (!isNonEmptyString(record.openclawVersion)) return false
  if (!isDeliveryMode(record.defaultDeliveryMode)) return false
  if (!isDeliveryMode(record.targetDeliveryMode)) return false

  const artifacts = record.artifacts
  if (!artifacts || typeof artifacts !== 'object') return false

  const tgz = (artifacts as Record<string, unknown>).tgz
  if (tgz != null) {
    if (typeof tgz !== 'object') return false
    const tgzRecord = tgz as Record<string, unknown>
    if (!isNonEmptyString(tgzRecord.fileName)) return false
    if (!isNonEmptyString(tgzRecord.version)) return false
  }

  const runtime = (artifacts as Record<string, unknown>).runtime
  if (runtime != null) {
    if (!Array.isArray(runtime)) return false
    for (const item of runtime) {
      if (!item || typeof item !== 'object') return false
      const runtimeRecord = item as Record<string, unknown>
      if (
        runtimeRecord.platform !== 'win32' &&
        runtimeRecord.platform !== 'darwin' &&
        runtimeRecord.platform !== 'linux'
      ) {
        return false
      }
      if (!isNonEmptyString(runtimeRecord.arch)) return false
      if (!isNonEmptyString(runtimeRecord.directoryName)) return false
      if (!isNonEmptyString(runtimeRecord.version)) return false
    }
  }

  const managedPlugins = (artifacts as Record<string, unknown>).managedPlugins
  if (managedPlugins != null) {
    if (!Array.isArray(managedPlugins)) return false
    for (const item of managedPlugins) {
      if (!item || typeof item !== 'object') return false
      const pluginRecord = item as Record<string, unknown>
      if (!isNonEmptyString(pluginRecord.id)) return false
      if (!isNonEmptyString(pluginRecord.directoryName)) return false
      if (!isNonEmptyString(pluginRecord.version)) return false

      const channels = pluginRecord.channels
      if (channels != null) {
        if (!Array.isArray(channels)) return false
        if (!channels.every((channel) => isNonEmptyString(channel))) return false
      }
    }
  }

  const notes = record.notes
  if (notes != null) {
    if (!Array.isArray(notes)) return false
    if (!notes.every((item) => isNonEmptyString(item))) return false
  }

  return true
}
