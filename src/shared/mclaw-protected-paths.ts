export interface MclawProtectedPathOptions {
  protectedRoots?: string[]
}

function normalizeComparablePath(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/[\\/]+/g, '\\')
    .replace(/[\\/]+$/g, '')
    .toLowerCase()
}

function isPathEqualOrWithin(candidatePath: string, rootPath: string): boolean {
  const normalizedCandidate = normalizeComparablePath(candidatePath)
  const normalizedRoot = normalizeComparablePath(rootPath)
  if (!normalizedCandidate || !normalizedRoot) return false
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}\\`)
  )
}

const MCLAW_INTERNAL_PATH_FRAGMENTS = [
  '\\appdata\\roaming\\mclaw',
  '\\appdata\\local\\mclaw',
  '\\appdata\\local\\programs\\mclaw',
  '\\program files\\mclaw',
  '\\program files (x86)\\mclaw',
  '\\mclaw\\openclaw-state',
  '\\mclaw\\runtime',
  '\\mclaw\\npm-cache',
  '\\mclaw\\tools\\claude-code',
  '\\resources\\openclaw-bundle',
  '\\resources\\dev-tools-bundle',
  '\\.openclaw',
] as const

function containsPathFragment(candidatePath: string, fragment: string): boolean {
  return candidatePath === fragment
    || candidatePath.endsWith(fragment)
    || candidatePath.includes(`${fragment}\\`)
}

export function isLikelyMclawInternalPath(
  targetPath: string,
  options: MclawProtectedPathOptions = {}
): boolean {
  const normalizedTargetPath = normalizeComparablePath(targetPath)
  if (!normalizedTargetPath) return false

  for (const protectedRoot of options.protectedRoots || []) {
    if (isPathEqualOrWithin(normalizedTargetPath, protectedRoot)) {
      return true
    }
  }

  if (normalizedTargetPath.endsWith('\\heartbeat.md') && normalizedTargetPath.includes('\\mclaw\\')) {
    return true
  }

  if (
    normalizedTargetPath.includes('\\mclaw\\') &&
    /(\\mclaw\.exe|\\openclaw\.cmd|\\openclaw\.ps1|\\app\.asar)$/i.test(normalizedTargetPath)
  ) {
    return true
  }

  return MCLAW_INTERNAL_PATH_FRAGMENTS.some((fragment) =>
    containsPathFragment(normalizedTargetPath, fragment)
  )
}
