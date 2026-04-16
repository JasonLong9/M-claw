const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

export interface OpenClawPaths {
  homeDir: string
  configFile: string
  envFile: string
  credentialsDir: string
  modelCatalogCacheFile: string
  displayHomeDir: string
  displayConfigFile: string
  displayEnvFile: string
  displayCredentialsDir: string
  displayModelCatalogCacheFile: string
}

interface ResolveOpenClawPathsOptions {
  homeDir?: string
  userHomeDir?: string
  userDataDir?: string
  platform?: NodeJS.Platform
}

interface ResolveOpenClawPathsFromStateRootOptions {
  stateRoot: string
  configFile?: string
  homeDir?: string
  platform?: NodeJS.Platform
}

function trimTrailingSeparators(value: string, platform: NodeJS.Platform): string {
  if (!value) return ''
  const pattern = platform === 'win32' ? /[\\/]+$/ : /\/+$/
  return value.replace(pattern, '')
}

function joinForPlatform(platform: NodeJS.Platform, ...parts: string[]): string {
  return (platform === 'win32' ? path.win32 : path.posix).join(...parts)
}

function resolveManagedOpenClawStateRoot(
  platform: NodeJS.Platform,
  options: {
    homeDir?: string
    userDataDir?: string
  } = {}
): string {
  const explicitHomeDir = trimTrailingSeparators(String(options.homeDir || '').trim(), platform)
  if (explicitHomeDir) {
    return joinForPlatform(platform, explicitHomeDir, '.openclaw')
  }

  const userDataDir = trimTrailingSeparators(
    String(options.userDataDir || process.env.QCLAW_USER_DATA_DIR || '').trim(),
    platform
  )
  if (userDataDir) {
    return joinForPlatform(platform, userDataDir, 'openclaw-state')
  }

  const userHomeDir = trimTrailingSeparators(resolveUserHomeDir(platform), platform)
  return joinForPlatform(platform, userHomeDir, '.openclaw')
}

export function resolveUserHomeDir(platform: NodeJS.Platform = process.platform): string {
  return String(
    platform === 'win32'
      ? process.env.USERPROFILE || process.env.HOME || os.homedir()
      : process.env.HOME || process.env.USERPROFILE || os.homedir()
  ).trim()
}

export function expandDisplayPath(
  inputPath: string,
  userHomeDir?: string,
  platform: NodeJS.Platform = process.platform
): string {
  const normalizedPath = String(inputPath || '').trim()
  if (!normalizedPath) return ''

  const normalizedHomeDir = trimTrailingSeparators(
    String(userHomeDir || resolveUserHomeDir(platform)).trim(),
    platform
  )
  if (!normalizedHomeDir) return normalizedPath

  if (normalizedPath === '~') return normalizedHomeDir
  if (normalizedPath.startsWith('~/') || normalizedPath.startsWith('~\\')) {
    return joinForPlatform(platform, normalizedHomeDir, normalizedPath.slice(2))
  }

  return normalizedPath
}

export function formatDisplayPath(
  absolutePath: string,
  userHomeDir?: string,
  platform: NodeJS.Platform = process.platform
): string {
  const normalizedPath = String(absolutePath || '').trim()
  const normalizedHomeDir = trimTrailingSeparators(
    String(userHomeDir || resolveUserHomeDir(platform)).trim(),
    platform
  )
  if (!normalizedPath || !normalizedHomeDir) return normalizedPath

  const isMatch =
    normalizedPath === normalizedHomeDir ||
    normalizedPath.startsWith(`${normalizedHomeDir}${platform === 'win32' ? '\\' : '/'}`)

  if (!isMatch) return normalizedPath
  return `~${normalizedPath.slice(normalizedHomeDir.length)}`
}

export function resolveOpenClawPaths(
  options: ResolveOpenClawPathsOptions = {}
): OpenClawPaths {
  const platform = options.platform || process.platform
  const userHomeDir = trimTrailingSeparators(
    String(options.userHomeDir || options.homeDir || resolveUserHomeDir(platform)).trim(),
    platform
  )
  const openClawHomeDir = resolveManagedOpenClawStateRoot(platform, {
    homeDir: options.homeDir,
    userDataDir: options.userDataDir,
  })
  const configFile = joinForPlatform(platform, openClawHomeDir, 'openclaw.json')
  const envFile = joinForPlatform(platform, openClawHomeDir, '.env')
  const credentialsDir = joinForPlatform(platform, openClawHomeDir, 'credentials')
  const modelCatalogCacheFile = joinForPlatform(platform, openClawHomeDir, 'qclaw-model-catalog-cache.json')

  return {
    homeDir: openClawHomeDir,
    configFile,
    envFile,
    credentialsDir,
    modelCatalogCacheFile,
    displayHomeDir: formatDisplayPath(openClawHomeDir, userHomeDir, platform),
    displayConfigFile: formatDisplayPath(configFile, userHomeDir, platform),
    displayEnvFile: formatDisplayPath(envFile, userHomeDir, platform),
    displayCredentialsDir: formatDisplayPath(credentialsDir, userHomeDir, platform),
    displayModelCatalogCacheFile: formatDisplayPath(modelCatalogCacheFile, userHomeDir, platform),
  }
}

export function resolveOpenClawPathsFromStateRoot(
  options: ResolveOpenClawPathsFromStateRootOptions
): OpenClawPaths {
  const platform = options.platform || process.platform
  const userHomeDir = trimTrailingSeparators(
    String(options.homeDir || resolveUserHomeDir(platform)).trim(),
    platform
  )
  const openClawHomeDir = trimTrailingSeparators(
    expandDisplayPath(String(options.stateRoot || '').trim(), userHomeDir, platform),
    platform
  )
  const configFile = expandDisplayPath(
    String(options.configFile || joinForPlatform(platform, openClawHomeDir, 'openclaw.json')).trim(),
    userHomeDir,
    platform
  )
  const envFile = joinForPlatform(platform, openClawHomeDir, '.env')
  const credentialsDir = joinForPlatform(platform, openClawHomeDir, 'credentials')
  const modelCatalogCacheFile = joinForPlatform(platform, openClawHomeDir, 'qclaw-model-catalog-cache.json')

  return {
    homeDir: openClawHomeDir,
    configFile,
    envFile,
    credentialsDir,
    modelCatalogCacheFile,
    displayHomeDir: formatDisplayPath(openClawHomeDir, userHomeDir, platform),
    displayConfigFile: formatDisplayPath(configFile, userHomeDir, platform),
    displayEnvFile: formatDisplayPath(envFile, userHomeDir, platform),
    displayCredentialsDir: formatDisplayPath(credentialsDir, userHomeDir, platform),
    displayModelCatalogCacheFile: formatDisplayPath(modelCatalogCacheFile, userHomeDir, platform),
  }
}
