import { getOpenClawPaths, readConfig } from './cli'
import { resolveOpenClawEnvValue } from './openclaw-legacy-env-migration'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

export interface WeixinAccountState {
  accountId: string
  configured: boolean
  baseUrl?: string
  userId?: string
  enabled: boolean
  name?: string
}

export interface WeixinStatePathDiagnostic {
  activeStateDir: string
  defaultStateDir: string
  usingNonDefaultStateDir: boolean
  activeAccountsDirExists: boolean
  defaultAccountsDirExists: boolean
  activeConfiguredAccounts: number
  defaultConfiguredAccounts: number
  activeCredentialFiles: number
  defaultCredentialFiles: number
  possiblePathMismatch: boolean
}

interface WeixinStoredAccountData {
  token?: string
  baseUrl?: string
  userId?: string
}

function cloneConfig(config: Record<string, any> | null | undefined): Record<string, any> {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {}
  return JSON.parse(JSON.stringify(config)) as Record<string, any>
}

function hasOwnRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function resolveOpenClawStateDir(): Promise<string> {
  const envStateDir = resolveOpenClawEnvValue(process.env, 'OPENCLAW_STATE_DIR').value
  if (envStateDir) return envStateDir

  const openClawPaths = await getOpenClawPaths().catch(() => null)
  const homeDir = String(openClawPaths?.homeDir || '').trim()
  if (homeDir) return homeDir

  return path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw')
}

function resolveDefaultOpenClawStateDir(): string {
  return path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw')
}

async function resolveWeixinStatePaths(): Promise<{
  stateDir: string
  weixinStateDir: string
  accountsDir: string
  accountIndexPath: string
  credentialsDir: string
}> {
  const stateDir = await resolveOpenClawStateDir()
  return resolveWeixinStatePathsForStateDir(stateDir)
}

function resolveWeixinStatePathsForStateDir(stateDir: string): {
  stateDir: string
  weixinStateDir: string
  accountsDir: string
  accountIndexPath: string
  credentialsDir: string
} {
  const weixinStateDir = path.join(stateDir, 'openclaw-weixin')
  return {
    stateDir,
    weixinStateDir,
    accountsDir: path.join(weixinStateDir, 'accounts'),
    accountIndexPath: path.join(weixinStateDir, 'accounts.json'),
    credentialsDir: path.join(stateDir, 'credentials'),
  }
}

function sanitizeAccountId(raw: unknown): string {
  return String(raw || '').trim()
}

function deriveRawAccountId(normalizedId: string): string | undefined {
  if (normalizedId.endsWith('-im-bot')) {
    return `${normalizedId.slice(0, -7)}@im.bot`
  }
  if (normalizedId.endsWith('-im-wechat')) {
    return `${normalizedId.slice(0, -10)}@im.wechat`
  }
  return undefined
}

function resolveWeixinAccountConfigMap(config: Record<string, any> | null | undefined): Record<string, any> {
  const section = config?.channels?.['openclaw-weixin']
  if (!hasOwnRecord(section)) return {}
  return hasOwnRecord(section.accounts) ? section.accounts : {}
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

function listIndexedAccountIds(accountIndexPath: string): string[] {
  const parsed = readJsonFile<unknown>(accountIndexPath)
  if (!Array.isArray(parsed)) return []
  return Array.from(
    new Set(
      parsed
        .map((item) => sanitizeAccountId(item))
        .filter(Boolean)
    )
  )
}

function readStoredWeixinAccount(accountsDir: string, accountId: string): WeixinStoredAccountData | null {
  const primary = readJsonFile<WeixinStoredAccountData>(path.join(accountsDir, `${accountId}.json`))
  if (primary) return primary

  const rawAccountId = deriveRawAccountId(accountId)
  if (!rawAccountId) return null
  return readJsonFile<WeixinStoredAccountData>(path.join(accountsDir, `${rawAccountId}.json`))
}

function countConfiguredAccounts(paths: { accountsDir: string; accountIndexPath: string }): number {
  const indexedAccountIds = listIndexedAccountIds(paths.accountIndexPath)
  let count = 0
  for (const accountId of indexedAccountIds) {
    const stored = readStoredWeixinAccount(paths.accountsDir, accountId)
    if (stored?.token && String(stored.token).trim()) {
      count += 1
    }
  }
  return count
}

function ensureJsonParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function appendIndexedAccountId(accountIndexPath: string, accountId: string): void {
  const normalized = sanitizeAccountId(accountId)
  if (!normalized) return
  const nextIndex = Array.from(new Set([...listIndexedAccountIds(accountIndexPath), normalized]))
  ensureJsonParentDir(accountIndexPath)
  fs.writeFileSync(accountIndexPath, JSON.stringify(nextIndex, null, 2), 'utf-8')
}

function resolveAccountJsonCandidates(accountsDir: string, accountId: string): string[] {
  const rawAccountId = deriveRawAccountId(accountId)
  return Array.from(
    new Set(
      [path.join(accountsDir, `${accountId}.json`), rawAccountId ? path.join(accountsDir, `${rawAccountId}.json`) : ''].filter(Boolean)
    )
  )
}

function mirrorFallbackWeixinAccountIntoActiveState(params: {
  accountId: string
  activeAccountsDir: string
  activeAccountIndexPath: string
  fallbackAccountsDir: string
}): boolean {
  const normalizedAccountId = sanitizeAccountId(params.accountId)
  if (!normalizedAccountId) return false

  const activeCandidates = resolveAccountJsonCandidates(params.activeAccountsDir, normalizedAccountId)
  if (activeCandidates.some((candidatePath) => fs.existsSync(candidatePath))) {
    appendIndexedAccountId(params.activeAccountIndexPath, normalizedAccountId)
    return false
  }

  const fallbackCandidates = resolveAccountJsonCandidates(params.fallbackAccountsDir, normalizedAccountId)
  const fallbackSource = fallbackCandidates.find((candidatePath) => fs.existsSync(candidatePath))
  if (!fallbackSource) return false

  const activeTarget = path.join(params.activeAccountsDir, path.basename(fallbackSource))
  ensureJsonParentDir(activeTarget)
  fs.copyFileSync(fallbackSource, activeTarget)
  appendIndexedAccountId(params.activeAccountIndexPath, normalizedAccountId)
  return true
}

function countCredentialFiles(credentialsDir: string): number {
  try {
    if (!fs.existsSync(credentialsDir)) return 0
    const entries = fs.readdirSync(credentialsDir, { withFileTypes: true })
    return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().includes('openclaw-weixin')).length
  } catch {
    return 0
  }
}

export async function getWeixinStatePathDiagnostic(): Promise<WeixinStatePathDiagnostic> {
  const activeStateDir = await resolveOpenClawStateDir()
  const defaultStateDir = resolveDefaultOpenClawStateDir()
  const activePaths = resolveWeixinStatePathsForStateDir(activeStateDir)
  const defaultPaths = resolveWeixinStatePathsForStateDir(defaultStateDir)
  const activeCredentialFiles = countCredentialFiles(path.join(activeStateDir, 'credentials'))
  const defaultCredentialFiles = countCredentialFiles(path.join(defaultStateDir, 'credentials'))
  const activeConfiguredAccounts = countConfiguredAccounts(activePaths)
  const defaultConfiguredAccounts = countConfiguredAccounts(defaultPaths)
  const usingNonDefaultStateDir = activeStateDir !== defaultStateDir
  return {
    activeStateDir,
    defaultStateDir,
    usingNonDefaultStateDir,
    activeAccountsDirExists: fs.existsSync(activePaths.accountsDir),
    defaultAccountsDirExists: fs.existsSync(defaultPaths.accountsDir),
    activeConfiguredAccounts,
    defaultConfiguredAccounts,
    activeCredentialFiles,
    defaultCredentialFiles,
    possiblePathMismatch:
      usingNonDefaultStateDir
      && (defaultConfiguredAccounts > 0 || defaultCredentialFiles > 0 || fs.existsSync(defaultPaths.accountsDir))
      && activeConfiguredAccounts === 0
      && activeCredentialFiles === 0,
  }
}

export async function listWeixinAccountState(): Promise<WeixinAccountState[]> {
  const [paths, config] = await Promise.all([resolveWeixinStatePaths(), readConfig().catch(() => null)])
  const configAccounts = resolveWeixinAccountConfigMap(config)
  const indexedAccountIds = listIndexedAccountIds(paths.accountIndexPath)
  const fallbackStateDir = resolveDefaultOpenClawStateDir()
  const fallbackAccountsDir = path.join(fallbackStateDir, 'openclaw-weixin', 'accounts')
  const fallbackAccountIndexPath = path.join(fallbackStateDir, 'openclaw-weixin', 'accounts.json')
  const fallbackIndexedAccountIds =
    fallbackStateDir !== paths.stateDir
      ? listIndexedAccountIds(fallbackAccountIndexPath)
      : []
  const mergedAccountIds = new Set<string>(indexedAccountIds)
  for (const accountId of fallbackIndexedAccountIds) {
    const normalized = sanitizeAccountId(accountId)
    if (normalized) mergedAccountIds.add(normalized)
  }

  for (const accountId of Object.keys(configAccounts)) {
    const normalized = sanitizeAccountId(accountId)
    if (normalized) mergedAccountIds.add(normalized)
  }

  const accounts: WeixinAccountState[] = []
  for (const accountId of mergedAccountIds) {
    let stored = readStoredWeixinAccount(paths.accountsDir, accountId)
    if (!stored && fallbackStateDir !== paths.stateDir) {
      stored = readStoredWeixinAccount(fallbackAccountsDir, accountId)
      if (stored) {
        mirrorFallbackWeixinAccountIntoActiveState({
          accountId,
          activeAccountsDir: paths.accountsDir,
          activeAccountIndexPath: paths.accountIndexPath,
          fallbackAccountsDir,
        })
      }
    }
    const configEntry = hasOwnRecord(configAccounts[accountId]) ? configAccounts[accountId] : {}
    accounts.push({
      accountId,
      configured: Boolean(String(stored?.token || '').trim()),
      baseUrl: String(stored?.baseUrl || '').trim() || undefined,
      userId: String(stored?.userId || '').trim() || undefined,
      enabled:
        typeof configEntry.enabled === 'boolean'
          ? configEntry.enabled
          : true,
      name: String(configEntry.name || '').trim() || undefined,
    })
  }

  accounts.sort((left, right) => left.accountId.localeCompare(right.accountId, 'zh-CN'))
  return accounts
}

export function syncWeixinAccountsIntoConfig(
  config: Record<string, any> | null | undefined,
  accounts: Array<Pick<WeixinAccountState, 'accountId' | 'name' | 'enabled'>>
): Record<string, any> {
  const nextConfig = cloneConfig(config)
  nextConfig.channels = hasOwnRecord(nextConfig.channels) ? nextConfig.channels : {}

  const existingSection = hasOwnRecord(nextConfig.channels['openclaw-weixin'])
    ? nextConfig.channels['openclaw-weixin']
    : {}
  const existingAccounts = hasOwnRecord(existingSection.accounts) ? existingSection.accounts : {}
  const nextAccounts: Record<string, any> = { ...existingAccounts }

  for (const account of accounts) {
    const accountId = sanitizeAccountId(account.accountId)
    if (!accountId) continue
    const existingEntry = hasOwnRecord(existingAccounts[accountId]) ? existingAccounts[accountId] : {}
    nextAccounts[accountId] = {
      ...existingEntry,
      enabled:
        typeof existingEntry.enabled === 'boolean'
          ? existingEntry.enabled
          : account.enabled !== false,
      name:
        String(existingEntry.name || '').trim()
        || String(account.name || '').trim()
        || accountId,
    }
  }

  nextConfig.channels['openclaw-weixin'] = {
    ...existingSection,
    enabled: true,
    accounts: nextAccounts,
  }

  return nextConfig
}

function removeFromAccountIndex(accountIndexPath: string, accountId: string): void {
  const nextIndex = listIndexedAccountIds(accountIndexPath).filter((item) => item !== accountId)
  const directory = path.dirname(accountIndexPath)
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(accountIndexPath, JSON.stringify(nextIndex, null, 2), 'utf-8')
}

function safeFrameworkKey(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.replace(/[\\/:*?"<>|]/g, '_').replace(/\.\./g, '_')
}

async function removeIfExists(filePath: string): Promise<void> {
  try {
    await fs.promises.rm(filePath, { force: true })
  } catch {
    // Best effort only.
  }
}

export async function removeWeixinAccountState(accountIdInput: string): Promise<{ ok: boolean }> {
  const accountId = sanitizeAccountId(accountIdInput)
  if (!accountId) {
    return { ok: false }
  }

  const activePaths = await resolveWeixinStatePaths()
  const defaultStateDir = resolveDefaultOpenClawStateDir()
  const pathSets = [
    activePaths,
    ...(defaultStateDir !== activePaths.stateDir ? [resolveWeixinStatePathsForStateDir(defaultStateDir)] : []),
  ]
  const rawAccountId = deriveRawAccountId(accountId)
  const candidateIds = Array.from(new Set([accountId, rawAccountId].filter(Boolean) as string[]))

  await Promise.all(
    pathSets.flatMap((paths) =>
      candidateIds.flatMap((candidateId) => [
        removeIfExists(path.join(paths.accountsDir, `${candidateId}.json`)),
        removeIfExists(path.join(paths.accountsDir, `${candidateId}.sync.json`)),
        removeIfExists(path.join(paths.accountsDir, `${candidateId}.context-tokens.json`)),
        removeIfExists(
          path.join(paths.credentialsDir, `${safeFrameworkKey('openclaw-weixin')}-${safeFrameworkKey(candidateId)}-allowFrom.json`)
        ),
      ])
    )
  )

  for (const paths of pathSets) {
    removeFromAccountIndex(paths.accountIndexPath, accountId)
  }
  return { ok: true }
}
