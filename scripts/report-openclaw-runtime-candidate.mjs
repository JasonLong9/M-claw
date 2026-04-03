import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

function fail(message) {
  console.error(`[openclaw-runtime-candidate] ERROR: ${message}`)
  process.exit(1)
}

function info(message) {
  console.log(`[openclaw-runtime-candidate] ${message}`)
}

function takeArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] || null
}

function normalizeArch(input) {
  const value = String(input || '').trim()
  if (!value) return value
  if (value === 'x86_64' || value === 'amd64') return 'x64'
  if (value === 'aarch64') return 'arm64'
  return value
}

function exists(candidatePath) {
  try {
    return fs.existsSync(candidatePath)
  } catch {
    return false
  }
}

function resolveRuntimeBinaryCandidates(platform, runtimeDir) {
  if (platform === 'win32') {
    return [
      path.join(runtimeDir, 'openclaw.cmd'),
      path.join(runtimeDir, 'openclaw.ps1'),
      path.join(runtimeDir, 'openclaw.exe'),
      path.join(runtimeDir, 'openclaw'),
      path.join(runtimeDir, 'bin', 'openclaw.cmd'),
      path.join(runtimeDir, 'bin', 'openclaw.ps1'),
      path.join(runtimeDir, 'bin', 'openclaw.exe'),
      path.join(runtimeDir, 'bin', 'openclaw'),
    ]
  }

  return [path.join(runtimeDir, 'openclaw'), path.join(runtimeDir, 'bin', 'openclaw')]
}

function resolveDirectoryName(platform, arch) {
  const normalizedArch = normalizeArch(arch)
  if (platform === 'win32' && normalizedArch === 'x64') return 'windows-x64'
  if (platform === 'darwin' && normalizedArch === 'arm64') return 'darwin-arm64'
  if (platform === 'darwin' && normalizedArch === 'x64') return 'darwin-x64'
  return `${platform}-${normalizedArch}`
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function collectDirectoryStats(rootDir) {
  let fileCount = 0
  let dirCount = 0
  let totalBytes = 0

  function walk(currentDir) {
    dirCount += 1
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(entryPath)
        continue
      }

      if (entry.isFile()) {
        fileCount += 1
        totalBytes += fs.statSync(entryPath).size
      }
    }
  }

  walk(rootDir)

  return {
    fileCount,
    dirCount,
    totalBytes,
  }
}

const runtimeDirArg = takeArg('--runtime-dir')
const platformArg = takeArg('--platform')
const archArg = normalizeArch(takeArg('--arch'))
const versionArg = takeArg('--version')

if (!runtimeDirArg || !platformArg || !archArg || !versionArg) {
  fail('Usage: node scripts/report-openclaw-runtime-candidate.mjs --runtime-dir <path> --platform <platform> --arch <arch> --version <version>')
}

const runtimeDir = path.resolve(repoRoot, runtimeDirArg)
if (!exists(runtimeDir)) {
  fail(`Runtime directory not found: ${path.relative(repoRoot, runtimeDir)}`)
}

const packageManifestPath = path.join(runtimeDir, 'node_modules', 'openclaw', 'package.json')
if (!exists(packageManifestPath)) {
  fail(`Missing runtime package manifest: ${path.relative(repoRoot, packageManifestPath)}`)
}

const binaryPath =
  resolveRuntimeBinaryCandidates(platformArg, runtimeDir).find((candidate) => exists(candidate)) || null
if (!binaryPath) {
  fail(`No runtime binary found for ${platformArg}-${archArg} under ${path.relative(repoRoot, runtimeDir)}`)
}

const stats = collectDirectoryStats(runtimeDir)
const directoryName = resolveDirectoryName(platformArg, archArg)
const artifact = {
  platform: platformArg,
  arch: archArg,
  directoryName,
  version: versionArg,
}

info(`runtimeDir=${path.relative(repoRoot, runtimeDir)}`)
info(`platform=${platformArg}`)
info(`arch=${archArg}`)
info(`directoryName=${directoryName}`)
info(`binary=${path.relative(repoRoot, binaryPath)}`)
info(`packageManifest=${path.relative(repoRoot, packageManifestPath)}`)
info(`files=${stats.fileCount}`)
info(`directories=${stats.dirCount}`)
info(`totalBytes=${stats.totalBytes}`)
info(`totalSize=${formatBytes(stats.totalBytes)}`)
info('suggestedManifestArtifact=')
console.log(JSON.stringify(artifact, null, 2))
