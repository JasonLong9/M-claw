import type { OpenClawInstallSource } from './openclaw-phase1'
import { compareLooseVersions } from './openclaw-phase1'

export const MIN_SUPPORTED_OPENCLAW_VERSION = '2026.3.22'
export const MAX_SUPPORTED_OPENCLAW_VERSION = '2026.3.24'
export const PINNED_OPENCLAW_VERSION = '2026.3.24'
export const FUTURE_CANDIDATE_OPENCLAW_RELEASE_LINE = '2026.4.x'

export type OpenClawMigrationSmokePath =
  | 'steady-pinned'
  | 'steady-non-pinned'
  | 'in-range-upgrade'
  | 'in-range-downgrade'
  | 'candidate-upgrade'
  | 'rollback-to-pinned'
  | 'unsupported-path'

export type OpenClawVersionPolicyState =
  | 'below_min'
  | 'supported_not_target'
  | 'supported_target'
  | 'above_max'

export type OpenClawVersionEnforcement =
  | 'none'
  | 'optional_upgrade'
  | 'auto_correct'
  | 'manual_block'

export type OpenClawVersionTargetAction = 'none' | 'upgrade' | 'downgrade' | 'install'

export interface OpenClawInstallCandidatePaths {
  binaryPath?: string | null
  resolvedBinaryPath?: string | null
  packageRoot?: string | null
}

export interface OpenClawVersionEnforcementResult {
  normalizedVersion: string | null
  policyState: OpenClawVersionPolicyState
  enforcement: OpenClawVersionEnforcement
  targetAction: OpenClawVersionTargetAction
  targetVersion: string | null
  blocksContinue: boolean
  canSelfHeal: boolean
}

export interface OpenClawMigrationSmokeSummary {
  fromVersion: string | null
  toVersion: string | null
  migrationPath: OpenClawMigrationSmokePath
  needsBaselineBackup: boolean
  requiresConservativeMode: boolean
  doctorFixPriority: boolean
  memoryAuditRequired: boolean
  agentAuditRequired: boolean
  recommendedChecks: string[]
}

function normalizeVersionCore(value: string | null | undefined): string {
  if (value?.startsWith("OpenClaw")) {
    return value.match(/\d{4}\.\d+\.\d+/)?.[0] || value;
  }
  return String(value || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .trim()
}

function normalizePathSignature(value: string | null | undefined): string {
  return String(value || '').replace(/\\/g, '/').toLowerCase()
}

export function isStrictOpenClawPolicyVersion(version: string | null | undefined): boolean {
  const normalized = normalizeVersionCore(version)
  if (!normalized) return false
  return normalized.split('.').every((part) => /^\d+$/.test(part))
}

export function normalizeOpenClawPolicyVersion(version: string | null | undefined): string | null {
  const normalized = normalizeVersionCore(version)
  return normalized || null
}

export function resolveOpenClawTargetVersionLabel(version: string | null | undefined): string {
  return String(version || '').trim() || PINNED_OPENCLAW_VERSION
}

export function buildOpenClawFutureCandidateGuidance(version: string | null | undefined): string {
  const displayVersion = String(version || '').trim() || '当前版本'
  return `${displayVersion} 已落在 ${FUTURE_CANDIDATE_OPENCLAW_RELEASE_LINE} 候选线，应先完成记忆目录、Agent 协同与升级回退迁移验证。`
}

export function buildOpenClawConservativeCompatibilityGuidance(version: string | null | undefined): string {
  const displayVersion = String(version || '').trim() || '当前版本'
  if (isFutureCandidateOpenClawVersion(displayVersion)) {
    return `${buildOpenClawFutureCandidateGuidance(displayVersion)} 当前仍按保守兼容模式处理。`
  }
  return `${displayVersion} 超出当前审计范围，当前仍按保守兼容模式处理。`
}

export function buildOpenClawCompatibilityBlockingReasonLabel(version: string | null | undefined): string {
  const displayVersion = String(version || '').trim() || '当前版本'
  if (isFutureCandidateOpenClawVersion(displayVersion)) {
    return `${displayVersion} 已进入 ${FUTURE_CANDIDATE_OPENCLAW_RELEASE_LINE} 候选线，当前仍按保守兼容模式处理`
  }
  return '当前 OpenClaw 版本超出已审计范围'
}

export function isFutureCandidateOpenClawVersion(version: string | null | undefined): boolean {
  const normalizedVersion = normalizeOpenClawPolicyVersion(version)
  if (!normalizedVersion) return false
  return normalizedVersion.startsWith('2026.4.')
}

export function classifyOpenClawMigrationSmokePath(
  fromVersion: string | null | undefined,
  toVersion: string | null | undefined
): OpenClawMigrationSmokePath {
  const fromNormalized = normalizeOpenClawPolicyVersion(fromVersion)
  const toNormalized = normalizeOpenClawPolicyVersion(toVersion)
  if (!fromNormalized || !toNormalized) return 'unsupported-path'

  if (fromNormalized === toNormalized) {
    return fromNormalized === PINNED_OPENCLAW_VERSION ? 'steady-pinned' : 'steady-non-pinned'
  }

  if (
    toNormalized === PINNED_OPENCLAW_VERSION &&
    compareLooseVersions(fromNormalized, PINNED_OPENCLAW_VERSION) > 0
  ) {
    return 'rollback-to-pinned'
  }

  if (isFutureCandidateOpenClawVersion(toNormalized)) {
    return 'candidate-upgrade'
  }

  if (
    compareLooseVersions(fromNormalized, toNormalized) < 0 &&
    compareLooseVersions(toNormalized, MIN_SUPPORTED_OPENCLAW_VERSION) >= 0 &&
    compareLooseVersions(toNormalized, PINNED_OPENCLAW_VERSION) <= 0
  ) {
    return 'in-range-upgrade'
  }

  if (
    compareLooseVersions(fromNormalized, toNormalized) > 0 &&
    compareLooseVersions(fromNormalized, MIN_SUPPORTED_OPENCLAW_VERSION) >= 0 &&
    compareLooseVersions(fromNormalized, PINNED_OPENCLAW_VERSION) <= 0
  ) {
    return 'in-range-downgrade'
  }

  return 'unsupported-path'
}

export function buildOpenClawMigrationSmokeSummary(params: {
  fromVersion: string | null | undefined
  toVersion: string | null | undefined
}): OpenClawMigrationSmokeSummary {
  const fromVersion = normalizeOpenClawPolicyVersion(params.fromVersion)
  const toVersion = normalizeOpenClawPolicyVersion(params.toVersion) || PINNED_OPENCLAW_VERSION
  const migrationPath = classifyOpenClawMigrationSmokePath(fromVersion, toVersion)
  const needsBaselineBackup = Boolean(fromVersion && toVersion && fromVersion !== toVersion)
  const touchesCandidateLine =
    isFutureCandidateOpenClawVersion(fromVersion) || isFutureCandidateOpenClawVersion(toVersion)
  const requiresConservativeMode =
    Boolean(toVersion) && compareLooseVersions(toVersion, PINNED_OPENCLAW_VERSION) > 0
  const memoryAuditRequired = touchesCandidateLine
  const agentAuditRequired = touchesCandidateLine
  const recommendedChecks: string[] = []

  if (needsBaselineBackup) {
    recommendedChecks.push('先创建 baseline backup，并确认本轮是 config-only 还是 full-state。')
    recommendedChecks.push('先跑一次官方 doctor 自检，确认后续是否需要 doctor --fix。')
  }

  if (touchesCandidateLine) {
    recommendedChecks.push('补做记忆目录、备份恢复与回退后的数据可读性审计。')
    recommendedChecks.push(`补做 Agent 协同与 Claude Code / memos 的前置兼容验证。`)
    recommendedChecks.push('补做回退演练，确认回退后 gateway 仍能重新启动。')
  }

  if (migrationPath === 'rollback-to-pinned') {
    recommendedChecks.push(`确认最终版本回到 ${PINNED_OPENCLAW_VERSION}，并复跑 bundle / phase2-exit 检查。`)
  }

  if (migrationPath === 'unsupported-path') {
    recommendedChecks.push('当前路径不建议直接在产品内一次执行，应先拆成受支持的中间迁移步骤。')
  }

  return {
    fromVersion,
    toVersion,
    migrationPath,
    needsBaselineBackup,
    requiresConservativeMode,
    doctorFixPriority: needsBaselineBackup,
    memoryAuditRequired,
    agentAuditRequired,
    recommendedChecks,
  }
}

export function classifyOpenClawVersionLockState(
  version: string | null | undefined
): OpenClawVersionPolicyState {
  const normalizedVersion = normalizeOpenClawPolicyVersion(version) || '0.0.0'

  if (compareLooseVersions(normalizedVersion, MIN_SUPPORTED_OPENCLAW_VERSION) < 0) {
    return 'below_min'
  }
  if (compareLooseVersions(normalizedVersion, MAX_SUPPORTED_OPENCLAW_VERSION) > 0) {
    return 'above_max'
  }
  if (compareLooseVersions(normalizedVersion, PINNED_OPENCLAW_VERSION) === 0) {
    return 'supported_target'
  }
  return 'supported_not_target'
}

export function supportsPinnedOpenClawCorrection(
  installSource: OpenClawInstallSource | null | undefined,
  candidatePaths?: OpenClawInstallCandidatePaths | null
): boolean {
  if (!installSource) return false
  if (
    installSource === 'npm-global' ||
    installSource === 'nvm' ||
    installSource === 'fnm' ||
    installSource === 'asdf' ||
    installSource === 'mise' ||
    installSource === 'volta'
  ) {
    return true
  }

  if (installSource !== 'homebrew') return false

  const corpus = [
    candidatePaths?.binaryPath,
    candidatePaths?.resolvedBinaryPath,
    candidatePaths?.packageRoot,
  ]
    .map((value) => normalizePathSignature(value))
    .join('\n')
  const hasHomebrewCellarSignature =
    corpus.includes('/cellar/openclaw') || corpus.includes('/caskroom/openclaw')

  if (hasHomebrewCellarSignature) return false

  return (
    corpus.includes('/node_modules/openclaw') ||
    corpus.includes('/.npm-global/') ||
    corpus.includes('/appdata/roaming/npm/')
  )
}

export function resolveOpenClawVersionEnforcement(input: {
  version: string | null | undefined
  installSource: OpenClawInstallSource | null | undefined
  candidatePaths?: OpenClawInstallCandidatePaths | null
}): OpenClawVersionEnforcementResult {
  const normalizedVersion = normalizeOpenClawPolicyVersion(input.version)
  if (!isStrictOpenClawPolicyVersion(normalizedVersion)) {
    return {
      normalizedVersion,
      policyState: 'above_max',
      enforcement: 'manual_block',
      targetAction: 'none',
      targetVersion: PINNED_OPENCLAW_VERSION,
      blocksContinue: true,
      canSelfHeal: false,
    }
  }
  const policyState = classifyOpenClawVersionLockState(normalizedVersion)
  const canCorrect = supportsPinnedOpenClawCorrection(input.installSource, input.candidatePaths)

  switch (policyState) {
    case 'supported_target':
      return {
        normalizedVersion,
        policyState,
        enforcement: 'none',
        targetAction: 'none',
        targetVersion: null,
        blocksContinue: false,
        canSelfHeal: false,
      }
    case 'supported_not_target':
      return {
        normalizedVersion,
        policyState,
        enforcement: canCorrect ? 'optional_upgrade' : 'manual_block',
        targetAction: 'upgrade',
        targetVersion: PINNED_OPENCLAW_VERSION,
        blocksContinue: false,
        canSelfHeal: canCorrect,
      }
    case 'below_min':
      return {
        normalizedVersion,
        policyState,
        enforcement: canCorrect ? 'auto_correct' : 'manual_block',
        targetAction: 'upgrade',
        targetVersion: PINNED_OPENCLAW_VERSION,
        blocksContinue: true,
        canSelfHeal: canCorrect,
      }
    case 'above_max':
    default:
      return {
        normalizedVersion,
        policyState,
        enforcement: canCorrect ? 'auto_correct' : 'manual_block',
        targetAction: 'downgrade',
        targetVersion: PINNED_OPENCLAW_VERSION,
        blocksContinue: true,
        canSelfHeal: canCorrect,
      }
  }
}
