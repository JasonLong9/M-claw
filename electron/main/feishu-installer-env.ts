import type { OpenClawPaths } from './openclaw-paths'
import path from 'node:path'

type FeishuInstallerOpenClawPathsLike =
  Partial<Pick<OpenClawPaths, 'homeDir' | 'configFile'>>
  | null
  | undefined

function trimPath(value: string): string {
  return String(value || '').trim()
}

function isWindowsDriveRoot(value: string): boolean {
  return /^[A-Za-z]:[\\/]?$/.test(value)
}

function stripTrailingSeparators(value: string): string {
  const normalized = trimPath(value)
  if (!normalized || normalized === '/' || isWindowsDriveRoot(normalized)) {
    return normalized
  }
  return normalized.replace(/[\\/]+$/g, '')
}

function getLastSeparatorIndex(value: string): number {
  return Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'))
}

function getPathBasename(value: string): string {
  const normalized = stripTrailingSeparators(value)
  if (!normalized || normalized === '/' || isWindowsDriveRoot(normalized)) {
    return normalized
  }

  const lastSeparatorIndex = getLastSeparatorIndex(normalized)
  return lastSeparatorIndex < 0 ? normalized : normalized.slice(lastSeparatorIndex + 1)
}

function getPathDirname(value: string): string {
  const normalized = stripTrailingSeparators(value)
  if (!normalized || normalized === '/' || isWindowsDriveRoot(normalized)) {
    return normalized
  }

  const lastSeparatorIndex = getLastSeparatorIndex(normalized)
  if (lastSeparatorIndex < 0) return ''
  if (lastSeparatorIndex === 0) return normalized[0]

  const dirname = normalized.slice(0, lastSeparatorIndex)
  return /^[A-Za-z]:$/.test(dirname) ? `${dirname}\\` : stripTrailingSeparators(dirname)
}

export function resolveFeishuInstallerManagedOpenClawHomeEnvRoot(
  openClawPaths: FeishuInstallerOpenClawPathsLike
): string {
  const configFile = trimPath(openClawPaths?.configFile || '')
  if (configFile) {
    const configDir = trimPath(getPathDirname(configFile))
    if (configDir && getPathBasename(configDir).toLowerCase() === '.openclaw') {
      const parentDir = trimPath(getPathDirname(configDir))
      if (parentDir) return parentDir
    }
    if (configDir) return configDir
  }

  const homeDir = trimPath(openClawPaths?.homeDir || '')
  if (homeDir && getPathBasename(homeDir).toLowerCase() === '.openclaw') {
    const parentDir = trimPath(getPathDirname(homeDir))
    if (parentDir) return parentDir
  }

  return homeDir
}

export function buildFeishuInstallerManagedOpenClawEnv(params: {
  baseEnv?: NodeJS.ProcessEnv
  openClawPaths?: FeishuInstallerOpenClawPathsLike
}): NodeJS.ProcessEnv {
  const baseEnv = params.baseEnv || process.env
  const homeDir = trimPath(params.openClawPaths?.homeDir || '')
  const configFile = trimPath(params.openClawPaths?.configFile || '')
  const homeEnvRoot = resolveFeishuInstallerManagedOpenClawHomeEnvRoot(params.openClawPaths)

  return {
    ...baseEnv,
    OPENCLAW_HOME: trimPath(baseEnv.OPENCLAW_HOME || homeEnvRoot) || undefined,
    OPENCLAW_STATE_DIR: (() => {
      const raw = trimPath(baseEnv.OPENCLAW_STATE_DIR || homeDir) || undefined
      if (!raw) return undefined
      // Ensure the state directory points to the actual .openclaw config
      // directory.  The homeDir may be the managed root (e.g.
      // .../openclaw-state) which needs .openclaw appended, or it may
      // already be the .openclaw directory itself.
      return getPathBasename(raw).toLowerCase() === '.openclaw'
        ? raw
        : path.join(raw, '.openclaw')
    })(),
    OPENCLAW_CONFIG_PATH: trimPath(baseEnv.OPENCLAW_CONFIG_PATH || configFile) || undefined,
  }
}
