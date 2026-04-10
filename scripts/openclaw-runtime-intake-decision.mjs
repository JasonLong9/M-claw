import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const bundleManifestPath = path.join(repoRoot, 'resources', 'openclaw-bundle', 'manifest.json')

export function exists(candidatePath) {
  try {
    return fs.existsSync(candidatePath)
  } catch {
    return false
  }
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function normalizeVersion(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const match = raw.match(/(\d{4}\.\d+\.\d+)/)
  return match ? match[1] : null
}

export function isFutureCandidateVersion(version) {
  return String(version || '').startsWith('2026.4.')
}

export function readRuntimeNotes(runtimeDir) {
  const notesCandidates = fs
    .readdirSync(runtimeDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /runtime-notes\.txt$/i.test(entry.name))
    .map((entry) => path.join(runtimeDir, entry.name))

  if (notesCandidates.length === 0) return null

  const content = fs.readFileSync(notesCandidates[0], 'utf8')
  const fields = Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf('=')
        return index === -1 ? [line, ''] : [line.slice(0, index), line.slice(index + 1)]
      })
  )

  return {
    path: notesCandidates[0],
    fields,
  }
}

export function assessRuntimeIntakeDecision(params) {
  const runtimeDir = params.runtimeDir
  const packageManifestPath = params.packageManifestPath || path.join(runtimeDir, 'node_modules', 'openclaw', 'package.json')
  const packageManifest = exists(packageManifestPath) ? readJson(packageManifestPath) : null
  const packageVersion = normalizeVersion(packageManifest?.version)
  const expectedVersion = normalizeVersion(params.expectedVersion)
  const bundleManifest = exists(bundleManifestPath) ? readJson(bundleManifestPath) : null
  const pinnedVersion = normalizeVersion(bundleManifest?.openclawVersion)
  const notes = readRuntimeNotes(runtimeDir)
  const sourceVersion = normalizeVersion(notes?.fields?.source_version_output)
  const copiedVersion = normalizeVersion(notes?.fields?.copied_version_output)

  const decisionReasons = []
  let intakeDecision = 'reject'

  if (!packageVersion) {
    decisionReasons.push('package.json version 无法解析')
  } else if (!expectedVersion) {
    decisionReasons.push('命令参数 --version 无法解析')
  } else if (packageVersion !== expectedVersion) {
    decisionReasons.push(`package.json version=${packageVersion} 与 --version=${expectedVersion} 不一致`)
  }

  if (notes) {
    if (!sourceVersion) decisionReasons.push('notes 缺少可解析的 source_version_output')
    if (!copiedVersion) decisionReasons.push('notes 缺少可解析的 copied_version_output')
    if (sourceVersion && copiedVersion && sourceVersion !== copiedVersion) {
      decisionReasons.push(`notes 来源版本 ${sourceVersion} 与复制后版本 ${copiedVersion} 不一致`)
    }
    if (packageVersion && copiedVersion && packageVersion !== copiedVersion) {
      decisionReasons.push(`package.json version=${packageVersion} 与 copied_version_output=${copiedVersion} 不一致`)
    }
  } else {
    decisionReasons.push('未找到 runtime-notes.txt')
  }

  const actualVersion = packageVersion || copiedVersion || sourceVersion || expectedVersion
  if (decisionReasons.length === 0) {
    if (pinnedVersion && actualVersion === pinnedVersion) {
      intakeDecision = 'mainline-ready'
    } else if (isFutureCandidateVersion(actualVersion)) {
      intakeDecision = 'candidate-only'
      decisionReasons.push(`实际版本 ${actualVersion} 属于 2026.4.x 候选线，只允许做 candidate 验证`)
    } else {
      decisionReasons.push(`实际版本 ${actualVersion || 'unknown'} 不属于当前主线 ${pinnedVersion || 'unknown'}，应拒绝直接入主线`)
    }
  }

  return {
    intakeDecision,
    decisionReasons,
    packageVersion,
    expectedVersion,
    pinnedVersion,
    actualVersion,
    notes,
    sourceVersion,
    copiedVersion,
  }
}
