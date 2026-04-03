import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const bundleRoot = path.join(repoRoot, 'resources', 'openclaw-bundle')
const manifestPath = path.join(bundleRoot, 'manifest.json')

function fail(message) {
  console.error(`[openclaw-runtime-probe] ERROR: ${message}`)
  process.exit(1)
}

function info(message) {
  console.log(`[openclaw-runtime-probe] ${message}`)
}

function warn(message) {
  console.warn(`[openclaw-runtime-probe] WARN: ${message}`)
}

function exists(candidatePath) {
  try {
    return fs.existsSync(candidatePath)
  } catch {
    return false
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function takeArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] || null
}

function hasFlag(flag) {
  return process.argv.includes(flag)
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

function normalizeArch(input) {
  const value = String(input || '').trim()
  if (!value) return value
  if (value === 'x86_64') return 'x64'
  if (value === 'amd64') return 'x64'
  if (value === 'aarch64') return 'arm64'
  return value
}

function resolveManifestArtifact(platform, arch) {
  if (!exists(manifestPath)) {
    fail(`Missing manifest: ${path.relative(repoRoot, manifestPath)}`)
  }

  const manifest = readJson(manifestPath)
  const runtimeArtifacts = Array.isArray(manifest?.artifacts?.runtime) ? manifest.artifacts.runtime : []
  return (
    runtimeArtifacts.find(
      (item) => item?.platform === platform && normalizeArch(item?.arch) === normalizeArch(arch)
    ) || null
  )
}

function canExecuteOnCurrentHost(targetPlatform, targetArch) {
  return process.platform === targetPlatform && normalizeArch(process.arch) === normalizeArch(targetArch)
}

function resolveProbeTarget() {
  const runtimeDirArg = takeArg('--runtime-dir')
  const platformArg = takeArg('--platform')
  const archArg = takeArg('--arch')
  const binaryArg = takeArg('--binary')

  if (runtimeDirArg) {
    const runtimeDir = path.resolve(repoRoot, runtimeDirArg)
    const platform = platformArg || process.platform
    const arch = normalizeArch(archArg || process.arch)
    return {
      source: 'runtime-dir',
      runtimeDir,
      platform,
      arch,
      binary: binaryArg ? path.resolve(repoRoot, binaryArg) : null,
    }
  }

  const platform = platformArg || process.platform
  const arch = normalizeArch(archArg || process.arch)
  const artifact = resolveManifestArtifact(platform, arch)
  if (!artifact) {
    fail(
      `No runtime artifact declared in manifest for ${platform}-${arch}. Provide --runtime-dir <path> --platform ${platform} --arch ${arch} to probe a candidate runtime before manifest write-in.`
    )
  }

  return {
    source: 'manifest',
    runtimeDir: path.join(bundleRoot, 'runtime', artifact.directoryName),
    platform,
    arch,
    binary: null,
    artifact,
  }
}

function validateStructure({ runtimeDir, platform }) {
  if (!exists(runtimeDir)) {
    fail(`Runtime directory not found: ${path.relative(repoRoot, runtimeDir)}`)
  }

  const packageManifestPath = path.join(runtimeDir, 'node_modules', 'openclaw', 'package.json')
  if (!exists(packageManifestPath)) {
    fail(`Missing runtime package manifest: ${path.relative(repoRoot, packageManifestPath)}`)
  }

  const binary =
    resolveRuntimeBinaryCandidates(platform, runtimeDir).find((candidate) => exists(candidate)) || null
  if (!binary) {
    fail(`No runtime binary found under ${path.relative(repoRoot, runtimeDir)} for platform ${platform}`)
  }

  return { packageManifestPath, binary }
}

function probeBinary(binaryPath, runtimeDir) {
  const result = spawnSync(binaryPath, ['--version'], {
    cwd: runtimeDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 30000,
  })

  if (result.error) {
    fail(`Failed to execute ${path.relative(repoRoot, binaryPath)} --version: ${result.error.message}`)
  }

  const stdout = String(result.stdout || '').trim()
  const stderr = String(result.stderr || '').trim()

  if (result.status !== 0) {
    const detail = stderr || stdout || `exit status ${result.status}`
    fail(`Runtime probe failed for ${path.relative(repoRoot, binaryPath)}: ${detail}`)
  }

  info(`--version probe passed: ${path.relative(repoRoot, binaryPath)}`)
  if (stdout) {
    info(`stdout=${stdout}`)
  }
  if (stderr) {
    warn(`stderr=${stderr}`)
  }
}

const allowCrossPlatformStructureOnly = hasFlag('--allow-cross-platform-structure-only')
const target = resolveProbeTarget()
const { packageManifestPath, binary } = validateStructure(target)

info(`source=${target.source}`)
info(`runtimeDir=${path.relative(repoRoot, target.runtimeDir)}`)
info(`platform=${target.platform}`)
info(`arch=${target.arch}`)
info(`packageManifest=${path.relative(repoRoot, packageManifestPath)}`)
info(`binary=${path.relative(repoRoot, binary)}`)

if (!canExecuteOnCurrentHost(target.platform, target.arch)) {
  if (!allowCrossPlatformStructureOnly) {
    fail(
      `Current host ${process.platform}-${normalizeArch(process.arch)} cannot directly execute target ${target.platform}-${target.arch}. Use --allow-cross-platform-structure-only to skip --version probing.`
    )
  }

  warn(
    `Skipping --version probe because current host ${process.platform}-${normalizeArch(process.arch)} does not match target ${target.platform}-${target.arch}.`
  )
  process.exit(0)
}

probeBinary(binary, target.runtimeDir)
