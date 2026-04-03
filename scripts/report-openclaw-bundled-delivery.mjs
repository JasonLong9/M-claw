import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const bundleRoot = path.join(repoRoot, 'resources', 'openclaw-bundle')
const manifestPath = path.join(bundleRoot, 'manifest.json')

const targets = [
  { platform: 'win32', arch: 'x64' },
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64' },
]

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

function resolveRuntimeBinaryCandidates(platform, runtimePath) {
  if (!runtimePath) return []
  if (platform === 'win32') {
    return [
      path.join(runtimePath, 'openclaw.cmd'),
      path.join(runtimePath, 'openclaw.ps1'),
      path.join(runtimePath, 'openclaw'),
      path.join(runtimePath, 'bin', 'openclaw.cmd'),
      path.join(runtimePath, 'bin', 'openclaw.ps1'),
      path.join(runtimePath, 'bin', 'openclaw'),
    ]
  }

  return [path.join(runtimePath, 'openclaw'), path.join(runtimePath, 'bin', 'openclaw')]
}

function resolveRuntimeArtifact(manifest, platform, arch) {
  const runtimeArtifacts = Array.isArray(manifest?.artifacts?.runtime) ? manifest.artifacts.runtime : []
  return runtimeArtifacts.find((item) => item?.platform === platform && String(item?.arch || '').trim() === arch) || null
}

function resolveRuntimePath(artifact) {
  if (!artifact?.directoryName) return null
  const runtimePath = path.join(bundleRoot, 'runtime', artifact.directoryName)
  return exists(runtimePath) ? runtimePath : null
}

function resolveRuntimeBinary(platform, runtimePath) {
  return resolveRuntimeBinaryCandidates(platform, runtimePath).find((candidate) => exists(candidate)) || null
}

function resolvePayloadPath(manifest) {
  const fileName = manifest?.artifacts?.tgz?.fileName
  if (!fileName) return null
  const candidate = path.join(bundleRoot, fileName)
  return exists(candidate) ? candidate : null
}

function resolvePreferredSource({ runtimeBinaryPath, payloadPath }) {
  if (runtimeBinaryPath) return 'bundled-runtime'
  if (payloadPath) return 'bundled-fallback'
  return 'online-fallback'
}

if (!exists(manifestPath)) {
  console.error(`[openclaw-bundle] ERROR: Missing manifest: ${path.relative(repoRoot, manifestPath)}`)
  process.exit(1)
}

const manifest = readJson(manifestPath)
const payloadPath = resolvePayloadPath(manifest)

console.log('[openclaw-bundle] Delivery report')
console.log(`[openclaw-bundle] manifest=${path.relative(repoRoot, manifestPath)}`)
console.log(`[openclaw-bundle] defaultDeliveryMode=${manifest?.defaultDeliveryMode ?? 'unknown'}`)
console.log(`[openclaw-bundle] targetDeliveryMode=${manifest?.targetDeliveryMode ?? 'unknown'}`)
console.log(`[openclaw-bundle] tgzPayload=${payloadPath ? path.relative(repoRoot, payloadPath) : 'missing'}`)

for (const target of targets) {
  const artifact = resolveRuntimeArtifact(manifest, target.platform, target.arch)
  const runtimePath = resolveRuntimePath(artifact)
  const runtimeBinaryPath = resolveRuntimeBinary(target.platform, runtimePath)
  const preferredSource = resolvePreferredSource({ runtimeBinaryPath, payloadPath })
  const warnings = []

  if (!artifact) warnings.push('manifest runtime artifact missing')
  if (artifact && !runtimePath) warnings.push('runtime directory missing on disk')
  if (runtimePath && !runtimeBinaryPath) warnings.push('runtime binary missing')
  if (!runtimeBinaryPath && !payloadPath) warnings.push('no bundled runtime or tgz payload available')

  console.log('')
  console.log(`[openclaw-bundle] target=${target.platform}-${target.arch}`)
  console.log(`[openclaw-bundle] artifact=${artifact ? artifact.directoryName : 'missing'}`)
  console.log(`[openclaw-bundle] runtimePath=${runtimePath ? path.relative(repoRoot, runtimePath) : 'missing'}`)
  console.log(
    `[openclaw-bundle] runtimeBinary=${runtimeBinaryPath ? path.relative(repoRoot, runtimeBinaryPath) : 'missing'}`
  )
  console.log(`[openclaw-bundle] preferredSource=${preferredSource}`)
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.log(`[openclaw-bundle] warning=${warning}`)
    }
  }
}
