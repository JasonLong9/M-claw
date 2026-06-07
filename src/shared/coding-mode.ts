export type CodingModelProfileId =
  | 'claude-code-current'
  | 'platform-glm'
  | 'platform-kimi'
  | 'platform-qwen'
  | 'platform-deepseek'
  | 'platform-minimax'

export type CodingModelAvailability = 'available' | 'coming-soon'

export interface CodingModelProfileOption {
  id: CodingModelProfileId
  label: string
  description: string
  availability: CodingModelAvailability
}

export type ClaudeCodeAuthState = 'authenticated' | 'unauthenticated' | 'unknown'

export type ClaudeCodeSetupState =
  | 'ready'
  | 'install-required'
  | 'prerequisite-required'
  | 'login-required'
  | 'check-failed'

export type ClaudeCodeInstallStrategy = 'bundled-runtime' | 'bundled-offline' | 'managed-npm'

export interface ClaudeCodeInstallGuideLink {
  label: string
  url: string
}

export interface ClaudeCodeInstallGuide {
  primaryInstallCommand: string
  alternativeInstallCommands: string[]
  loginCommand: string
  verifyCommands: string[]
  docsUrl: string
  links: ClaudeCodeInstallGuideLink[]
  notes: string[]
  supportsOneClickInstall: boolean
  installModeLabel: string
  networkRequired: boolean
  offlineBundleAvailable: boolean
  bundledRuntimeAvailable: boolean
}

export interface ClaudeCodeStatusDiagnostics {
  versionStdout?: string
  versionStderr?: string
  authStdout?: string
  authStderr?: string
  gitStdout?: string
  gitStderr?: string
  authMethod?: string
  apiProvider?: string
  apiKeySource?: string
  checkError?: string
  managedInstallPath?: string
  managedBinDir?: string
  offlineBundlePath?: string
  bundledClaudePath?: string
  bundledGitPath?: string
  bundledGitBashPath?: string
  commandSource?: 'bundled-runtime' | 'managed-install' | 'system-path'
  gitSource?: 'bundled-runtime' | 'system-path' | 'missing'
}

export type CodingWorkspaceSetupState =
  | 'missing'
  | 'not-found'
  | 'not-directory'
  | 'not-project'
  | 'new-project'
  | 'ready'

export interface CodingWorkspaceStatusSnapshot {
  requestedPath: string
  normalizedPath: string
  exists: boolean
  isDirectory: boolean
  ready: boolean
  setupState: CodingWorkspaceSetupState
  summary: string
  detectedMarkers: string[]
}

export interface ClaudeCodeStatusSnapshot {
  platform: string
  command: string
  installed: boolean
  version?: string
  gitAvailable?: boolean
  authState: ClaudeCodeAuthState
  ready: boolean
  setupState: ClaudeCodeSetupState
  summary: string
  installGuide: ClaudeCodeInstallGuide
  modelProfiles: CodingModelProfileOption[]
  diagnostics: ClaudeCodeStatusDiagnostics
}

export interface ClaudeCodeInstallAttempt {
  label: string
  registryUrl?: string | null
  ok: boolean
  detail?: string
}

export interface ClaudeCodeInstallResult {
  ok: boolean
  installed: boolean
  ready: boolean
  strategy: ClaudeCodeInstallStrategy
  usedOfflineBundle: boolean
  requiresNetwork: boolean
  summary: string
  stdout: string
  stderr: string
  attempts: ClaudeCodeInstallAttempt[]
  status?: ClaudeCodeStatusSnapshot
}

export const CODING_MODEL_PROFILE_OPTIONS: CodingModelProfileOption[] = [
  {
    id: 'claude-code-current',
    label: '开发模式当前执行链路（可用）',
    description: '当前先使用 Mclaw 内置开发执行链路；模型服务后续由 Mclaw 中台统一打通，Mclaw 负责检测、引导和调度。',
    availability: 'available',
  },
  {
    id: 'platform-glm',
    label: 'GLM（中台接入，待开放）',
    description: '预留给 Mclaw 开发模式的中台开发模型，后续通过 Mclaw 开发链路接入。',
    availability: 'coming-soon',
  },
  {
    id: 'platform-kimi',
    label: 'Kimi（中台接入，待开放）',
    description: '预留给 Mclaw 开发模式的中台开发模型，后续通过 Mclaw 开发链路接入。',
    availability: 'coming-soon',
  },
  {
    id: 'platform-qwen',
    label: 'Qwen（中台接入，待开放）',
    description: '预留给 Mclaw 开发模式的中台开发模型，后续通过 Mclaw 开发链路接入。',
    availability: 'coming-soon',
  },
  {
    id: 'platform-deepseek',
    label: 'DeepSeek（中台接入，待开放）',
    description: '预留给 Mclaw 开发模式的中台开发模型，后续通过 Mclaw 开发链路接入。',
    availability: 'coming-soon',
  },
  {
    id: 'platform-minimax',
    label: 'MiniMax（中台接入，待开放）',
    description: '预留给 Mclaw 开发模式的中台开发模型，后续通过 Mclaw 开发链路接入。',
    availability: 'coming-soon',
  },
]

export const DEFAULT_CODING_MODEL_PROFILE_ID: CodingModelProfileId = 'claude-code-current'

function trimMatchingOuterQuotes(value: string): string {
  let nextValue = String(value || '').trim()

  while (
    nextValue.length >= 2
    && (
      (nextValue.startsWith('"') && nextValue.endsWith('"'))
      || (nextValue.startsWith("'") && nextValue.endsWith("'"))
    )
  ) {
    nextValue = nextValue.slice(1, -1).trim()
  }

  return nextValue
}

export function normalizeCodingWorkspacePathInput(value?: string | null): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  return trimMatchingOuterQuotes(trimmed)
}

export function isCodingModelProfileId(value: string): value is CodingModelProfileId {
  return CODING_MODEL_PROFILE_OPTIONS.some((option) => option.id === value)
}

export function getCodingModelProfileOption(
  profileId?: string | null
): CodingModelProfileOption | null {
  const normalized = String(profileId || '').trim()
  return CODING_MODEL_PROFILE_OPTIONS.find((option) => option.id === normalized) || null
}

export function isAvailableCodingModelProfileId(profileId?: string | null): boolean {
  return getCodingModelProfileOption(profileId)?.availability === 'available'
}
