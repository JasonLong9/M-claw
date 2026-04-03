import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const manifestPath = path.join(repoRoot, 'resources', 'openclaw-bundle', 'manifest.json')

function fail(message) {
  console.error(`[openclaw-manifest-preview] ERROR: ${message}`)
  process.exit(1)
}

function info(message) {
  console.log(`[openclaw-manifest-preview] ${message}`)
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function stableArtifactKey(item) {
  return `${item.platform}:${normalizeArch(item.arch)}`
}

const runtimeArgs = []
for (let index = 0; index < process.argv.length; index += 1) {
  if (process.argv[index] === '--runtime') {
    const raw = process.argv[index + 1]
    if (!raw) fail('Missing value after --runtime')
    runtimeArgs.push(raw)
  }
}

if (runtimeArgs.length === 0) {
  fail('Usage: node scripts/preview-openclaw-manifest-runtime.mjs --runtime <platform>:<arch>:<directoryName>:<version> [--runtime ...] [--enable-bundled-runtime]')
}

if (!fs.existsSync(manifestPath)) {
  fail(`Manifest not found: ${path.relative(repoRoot, manifestPath)}`)
}

const manifest = readJson(manifestPath)
const enableBundledRuntime = process.argv.includes('--enable-bundled-runtime')
const currentArtifacts = Array.isArray(manifest?.artifacts?.runtime) ? manifest.artifacts.runtime : []
const artifactMap = new Map(currentArtifacts.map((item) => [stableArtifactKey(item), { ...item }]))

for (const raw of runtimeArgs) {
  const parts = String(raw).split(':')
  if (parts.length !== 4) {
    fail(`Invalid --runtime value "${raw}". Expected <platform>:<arch>:<directoryName>:<version>.`)
  }

  const [platform, rawArch, directoryName, version] = parts.map((item) => String(item || '').trim())
  const arch = normalizeArch(rawArch)
  if (!platform || !arch || !directoryName || !version) {
    fail(`Incomplete --runtime value "${raw}".`)
  }

  artifactMap.set(stableArtifactKey({ platform, arch }), {
    platform,
    arch,
    directoryName,
    version,
  })
}

const preview = {
  ...manifest,
  defaultDeliveryMode: enableBundledRuntime ? 'bundled-runtime' : manifest.defaultDeliveryMode,
  targetDeliveryMode: 'bundled-runtime',
  artifacts: {
    ...(manifest.artifacts || {}),
    runtime: Array.from(artifactMap.values()).sort((left, right) =>
      stableArtifactKey(left).localeCompare(stableArtifactKey(right))
    ),
  },
}

info(`manifest=${path.relative(repoRoot, manifestPath)}`)
info(`currentDefaultDeliveryMode=${manifest.defaultDeliveryMode ?? 'unknown'}`)
info(`previewDefaultDeliveryMode=${preview.defaultDeliveryMode ?? 'unknown'}`)
info(`runtimeArtifactCount=${preview.artifacts.runtime.length}`)
console.log(JSON.stringify(preview, null, 2))
