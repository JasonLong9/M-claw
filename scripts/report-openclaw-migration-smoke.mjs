import path from 'node:path'
import {
  assessRuntimeIntakeDecision,
  normalizeVersion,
  readJson,
  exists,
} from './openclaw-runtime-intake-decision.mjs'

const repoRoot = process.cwd()
const manifestPath = path.join(repoRoot, 'resources', 'openclaw-bundle', 'manifest.json')

function fail(message) {
  console.error(`[openclaw-migration-smoke] ERROR: ${message}`)
  process.exit(1)
}

function info(message) {
  console.log(`[openclaw-migration-smoke] ${message}`)
}

function takeArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] || null
}

function compareVersions(left, right) {
  const leftParts = String(left || '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
  const rightParts = String(right || '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0
    if (leftValue !== rightValue) return leftValue - rightValue
  }
  return 0
}

function isPinnedWindow(version, pinnedVersion) {
  return compareVersions(version, '2026.3.22') >= 0 && compareVersions(version, pinnedVersion) <= 0
}

function isFutureCandidate(version) {
  return String(version || '').startsWith('2026.4.')
}

function classifyMigrationPath(fromVersion, toVersion, pinnedVersion) {
  if (fromVersion === toVersion) {
    return fromVersion === pinnedVersion ? 'steady-pinned' : 'steady-non-pinned'
  }
  if (toVersion === pinnedVersion && compareVersions(fromVersion, pinnedVersion) > 0) {
    return 'rollback-to-pinned'
  }
  if (isFutureCandidate(toVersion)) {
    return 'candidate-upgrade'
  }
  if (compareVersions(fromVersion, toVersion) < 0 && isPinnedWindow(toVersion, pinnedVersion)) {
    return 'in-range-upgrade'
  }
  if (compareVersions(fromVersion, toVersion) > 0 && isPinnedWindow(fromVersion, pinnedVersion)) {
    return 'in-range-downgrade'
  }
  return 'unsupported-path'
}

function buildChecks({
  migrationPath,
  fromVersion,
  toVersion,
  pinnedVersion,
  runtimeDecision,
}) {
  const checks = []
  const needsMovement = fromVersion !== toVersion
  if (needsMovement) {
    checks.push('创建 baseline backup，并确认 config-only / full-state 的选择依据。')
    checks.push('执行一次官方 doctor 自检，确认升级后是否需要 doctor --fix 迁移路径。')
  }

  if (
    migrationPath === 'candidate-upgrade' ||
    isFutureCandidate(fromVersion) ||
    isFutureCandidate(toVersion)
  ) {
    checks.push('显式审计记忆目录、备份/恢复、回退后的数据可读性。')
    checks.push('补做 Agent 协同与 Claude Code / memos 集成前置验证。')
    checks.push('补做升级成功后的回退演练，确认回退后仍可重新启动 gateway。')
  }

  if (runtimeDecision) {
    checks.push(`候选 runtime intakeDecision=${runtimeDecision.intakeDecision}，需与迁移目标版本一起留档。`)
  }

  if (toVersion === pinnedVersion) {
    checks.push('确认升级/回退后最终版本重新落回 pinned baseline，并复跑 phase2-exit / bundle report。')
  }

  if (migrationPath === 'unsupported-path') {
    checks.push('当前路径不建议直接执行产品内升级，应先拆成受支持的中间迁移步骤。')
  }

  return checks
}

const fromArg = takeArg('--from')
const toArg = takeArg('--to')
const runtimeDirArg = takeArg('--runtime-dir')
const runtimeVersionArg = takeArg('--runtime-version') || toArg

const fromVersion = normalizeVersion(fromArg)
const explicitTargetVersion = normalizeVersion(toArg)

if (!fromVersion) {
  fail('Usage: node scripts/report-openclaw-migration-smoke.mjs --from <version> [--to <version>] [--runtime-dir <path>] [--runtime-version <version>]')
}

if (!exists(manifestPath)) {
  fail(`Missing manifest: ${path.relative(repoRoot, manifestPath)}`)
}

const manifest = readJson(manifestPath)
const pinnedVersion = normalizeVersion(manifest?.openclawVersion)
const toVersion = explicitTargetVersion || pinnedVersion

if (!toVersion || !pinnedVersion) {
  fail('Unable to resolve pinned version from bundled manifest.')
}

let runtimeDecision = null
if (runtimeDirArg) {
  const runtimeDir = path.resolve(repoRoot, runtimeDirArg)
  if (!exists(runtimeDir)) {
    fail(`Runtime directory not found: ${path.relative(repoRoot, runtimeDir)}`)
  }
  if (!normalizeVersion(runtimeVersionArg)) {
    fail('When using --runtime-dir, --runtime-version or --to must contain a parseable version.')
  }
  runtimeDecision = assessRuntimeIntakeDecision({
    runtimeDir,
    expectedVersion: runtimeVersionArg,
  })
  runtimeDecision.runtimeDir = runtimeDir
}

const migrationPath = classifyMigrationPath(fromVersion, toVersion, pinnedVersion)
const needsBaselineBackup = fromVersion !== toVersion
const requiresConservativeMode = isFutureCandidate(toVersion) || compareVersions(toVersion, pinnedVersion) > 0
const requiresRuntimeCandidateProof = Boolean(runtimeDecision) || isFutureCandidate(toVersion)
const checks = buildChecks({
  migrationPath,
  fromVersion,
  toVersion,
  pinnedVersion,
  runtimeDecision,
})

info(`fromVersion=${fromVersion}`)
info(`toVersion=${toVersion}`)
info(`pinnedVersion=${pinnedVersion}`)
info(`migrationPath=${migrationPath}`)
info(`needsBaselineBackup=${needsBaselineBackup ? 'yes' : 'no'}`)
info(`requiresConservativeMode=${requiresConservativeMode ? 'yes' : 'no'}`)
info(`requiresRuntimeCandidateProof=${requiresRuntimeCandidateProof ? 'yes' : 'no'}`)
info(`doctorFixPriority=${needsBaselineBackup ? 'yes' : 'no'}`)
info(
  `memoryAuditRequired=${migrationPath === 'candidate-upgrade' || isFutureCandidate(fromVersion) || isFutureCandidate(toVersion) ? 'yes' : 'no'}`
)
info(
  `agentAuditRequired=${migrationPath === 'candidate-upgrade' || isFutureCandidate(fromVersion) || isFutureCandidate(toVersion) ? 'yes' : 'no'}`
)

if (runtimeDecision) {
  info(`runtimeCheck.runtimeDir=${path.relative(repoRoot, runtimeDecision.runtimeDir)}`)
  info(`runtimeCheck.intakeDecision=${runtimeDecision.intakeDecision}`)
  info(`runtimeCheck.packageVersion=${runtimeDecision.packageVersion || 'unknown'}`)
  info(`runtimeCheck.pinnedVersion=${runtimeDecision.pinnedVersion || 'unknown'}`)
  if (runtimeDecision.notes) {
    info(`runtimeCheck.notes=${path.relative(repoRoot, runtimeDecision.notes.path)}`)
    info(`runtimeCheck.notes.sourceVersion=${runtimeDecision.sourceVersion || 'unknown'}`)
    info(`runtimeCheck.notes.copiedVersion=${runtimeDecision.copiedVersion || 'unknown'}`)
  } else {
    info('runtimeCheck.notes=missing')
  }
  for (const reason of runtimeDecision.decisionReasons) {
    info(`runtimeCheck.decisionReason=${reason}`)
  }
}

info('recommendedChecks=')
for (const check of checks) {
  info(`- ${check}`)
}
