const { createHash } = process.getBuiltinModule('node:crypto') as typeof import('node:crypto')
const { createPublicKey, verify } = process.getBuiltinModule('node:crypto') as typeof import('node:crypto')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const { readFileSync } = process.getBuiltinModule('node:fs') as typeof import('node:fs')

export type SkillInstallSource = 'openclaw-bundled' | 'clawhub'
export type SkillInstallSecurityErrorCode =
  | 'SKILL_SLUG_INVALID'
  | 'SKILL_NOT_WHITELISTED'
  | 'SOURCE_NOT_ALLOWED'
  | 'WHITELIST_INTEGRITY_INVALID'
  | 'SKILL_RUNTIME_DISABLED'

export interface SkillInstallVerificationResult {
  allowed: boolean
  reason?: string
  errorCode?: SkillInstallSecurityErrorCode
}

interface SkillsWhitelistManifest {
  version: string
  updatedAt: string
  skills: string[]
  sources: SkillInstallSource[]
}

interface SkillsWhitelistTrust {
  version: string
  trustedManifestHashes: string[]
}

interface SkillsWhitelistTrustSignature {
  version: string
  signedFile: string
  signedHash: string
  signatures: Array<{
    keyId: string
    algorithm: 'ed25519'
    signatureBase64: string
  }>
}

interface SkillsWhitelistKeyRing {
  version: string
  keys: Array<{
    keyId: string
    algorithm: 'ed25519'
    publicKeyPem: string
    status: 'active' | 'retired'
  }>
}

const MANIFEST_RELATIVE_PATH = path.join('resources', 'security', 'skills-whitelist.manifest.json')
const TRUST_RELATIVE_PATH = path.join('resources', 'security', 'skills-whitelist.trust.json')
const TRUST_SIGNATURE_RELATIVE_PATH = path.join('resources', 'security', 'skills-whitelist.trust.sig.json')
const TRUST_KEYS_RELATIVE_PATH = path.join('resources', 'security', 'skills-whitelist.keys.json')
const MIN_REQUIRED_VALID_SIGNATURES = 1

function resolveManifestPath(): string {
  return path.resolve(process.cwd(), MANIFEST_RELATIVE_PATH)
}

function resolveTrustPath(): string {
  return path.resolve(process.cwd(), TRUST_RELATIVE_PATH)
}

function resolveTrustSignaturePath(): string {
  return path.resolve(process.cwd(), TRUST_SIGNATURE_RELATIVE_PATH)
}

function resolveTrustKeysPath(): string {
  return path.resolve(process.cwd(), TRUST_KEYS_RELATIVE_PATH)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function readManifestFromDisk(): { manifest: SkillsWhitelistManifest; hash: string } | null {
  try {
    const raw = readFileSync(resolveManifestPath(), 'utf8')
    const manifest = JSON.parse(raw) as SkillsWhitelistManifest
    if (!manifest || !Array.isArray(manifest.skills) || !Array.isArray(manifest.sources)) {
      return null
    }
    return { manifest, hash: sha256(raw) }
  } catch {
    return null
  }
}

function readTrustFromDisk(): SkillsWhitelistTrust | null {
  try {
    const raw = readFileSync(resolveTrustPath(), 'utf8')
    const trust = JSON.parse(raw) as SkillsWhitelistTrust
    if (!trust || !Array.isArray(trust.trustedManifestHashes)) return null
    return trust
  } catch {
    return null
  }
}

function readTrustSignatureFromDisk(): SkillsWhitelistTrustSignature | null {
  try {
    const raw = readFileSync(resolveTrustSignaturePath(), 'utf8')
    const signature = JSON.parse(raw) as SkillsWhitelistTrustSignature
    if (!signature || !Array.isArray(signature.signatures) || !signature.signedHash) return null
    return signature
  } catch {
    return null
  }
}

function readKeyRingFromDisk(): SkillsWhitelistKeyRing | null {
  try {
    const raw = readFileSync(resolveTrustKeysPath(), 'utf8')
    const keyRing = JSON.parse(raw) as SkillsWhitelistKeyRing
    if (!keyRing || !Array.isArray(keyRing.keys)) return null
    return keyRing
  } catch {
    return null
  }
}

function verifyTrustSignature(trustRaw: string): boolean {
  try {
    const signature = readTrustSignatureFromDisk()
    const keyRing = readKeyRingFromDisk()
    if (!signature) return false
    if (!keyRing) return false
    const hash = sha256(trustRaw)
    if (hash !== signature.signedHash) return false
    const keysById = new Map(
      keyRing.keys
        .filter((item) => item.status === 'active' && item.algorithm === 'ed25519')
        .map((item) => [item.keyId, item.publicKeyPem])
    )
    let validCount = 0
    for (const entry of signature.signatures) {
      if (!entry || entry.algorithm !== 'ed25519') continue
      const publicKeyPem = keysById.get(entry.keyId)
      if (!publicKeyPem) continue
      const publicKey = createPublicKey(publicKeyPem)
      const valid = verify(
        null,
        Buffer.from(signature.signedHash, 'utf8'),
        publicKey,
        Buffer.from(entry.signatureBase64, 'base64')
      )
      if (valid) validCount += 1
      if (validCount >= MIN_REQUIRED_VALID_SIGNATURES) return true
    }
    return false
  } catch {
    return false
  }
}

function getTrustedManifestHashes(): Set<string> {
  const trustPath = resolveTrustPath()
  const trustRaw = readFileSync(trustPath, 'utf8')
  if (!verifyTrustSignature(trustRaw)) {
    return new Set()
  }
  const trust = JSON.parse(trustRaw) as SkillsWhitelistTrust
  if (!trust) return new Set()
  return new Set(
    trust.trustedManifestHashes
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)
  )
}

export function verifyOfficialSkillsIntegrity(): boolean {
  const loaded = readManifestFromDisk()
  if (!loaded) return false
  return getTrustedManifestHashes().has(loaded.hash)
}

function loadSecurityPolicy(): { skills: Set<string>; sources: Set<SkillInstallSource> } | null {
  const loaded = readManifestFromDisk()
  if (!loaded) return null
  if (!getTrustedManifestHashes().has(loaded.hash)) return null
  const skills = new Set(loaded.manifest.skills.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))
  const sources = new Set(
    loaded.manifest.sources
      .map((item) => String(item || '').trim())
      .filter((item): item is SkillInstallSource => item === 'openclaw-bundled' || item === 'clawhub')
  )
  return { skills, sources }
}

export function normalizeSkillSlug(slug: string): string {
  return String(slug || '').trim().toLowerCase()
}

export function verifySkillInstallRequest(input: {
  slug: string
  source: SkillInstallSource
  installPath: string
}): SkillInstallVerificationResult {
  const policy = loadSecurityPolicy()
  if (!policy) {
    return {
      allowed: false,
      reason: 'Security validation failed: official whitelist integrity check failed.',
      errorCode: 'WHITELIST_INTEGRITY_INVALID',
    }
  }

  const normalized = normalizeSkillSlug(input.slug)
  if (!normalized) {
    return { allowed: false, reason: 'Invalid skill slug.', errorCode: 'SKILL_SLUG_INVALID' }
  }

  if (!policy.skills.has(normalized)) {
    return {
      allowed: false,
      reason: `Security validation failed: skill "${normalized}" is not in official whitelist.`,
      errorCode: 'SKILL_NOT_WHITELISTED',
    }
  }

  if (!policy.sources.has(input.source)) {
    return {
      allowed: false,
      reason: `Security validation failed: source "${input.source}" is not allowed.`,
      errorCode: 'SOURCE_NOT_ALLOWED',
    }
  }

  return { allowed: true }
}
