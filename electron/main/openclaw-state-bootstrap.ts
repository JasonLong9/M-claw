const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const fs = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')

const { join } = path
const { access, cp, mkdir, readdir, rename, stat, writeFile } = fs

export interface OpenClawStateBootstrapResult {
  ensuredDirs: string[]
  ensuredFiles: string[]
}

export interface ManagedOpenClawStateRepairResult {
  repairedPaths: string[]
  quarantinedPaths: string[]
}

export function listRequiredOpenClawStateDirs(homeDir: string): string[] {
  const normalizedHomeDir = String(homeDir || '').trim()
  if (!normalizedHomeDir) return []

  return [
    join(normalizedHomeDir, 'identity'),
    join(normalizedHomeDir, 'credentials'),
    join(normalizedHomeDir, 'agents', 'main', 'sessions'),
  ]
}

export function listRequiredOpenClawStateFiles(homeDir: string): string[] {
  const normalizedHomeDir = String(homeDir || '').trim()
  if (!normalizedHomeDir) return []

  return [join(normalizedHomeDir, 'identity', 'device.json')]
}

export async function ensureRequiredOpenClawStateDirs(
  homeDir: string
): Promise<OpenClawStateBootstrapResult> {
  const requiredDirs = listRequiredOpenClawStateDirs(homeDir)
  for (const dirPath of requiredDirs) {
    try {
      await mkdir(dirPath, { recursive: true })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`OpenClaw state directory is not writable, failed to create ${dirPath}: ${detail}`)
    }
  }

  const requiredFiles = listRequiredOpenClawStateFiles(homeDir)
  for (const filePath of requiredFiles) {
    try {
      await access(filePath)
    } catch {
      try {
        await writeFile(filePath, '{}\n', 'utf8')
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`OpenClaw state file is not writable, failed to create ${filePath}: ${detail}`)
      }
    }
  }

  return {
    ensuredDirs: requiredDirs,
    ensuredFiles: requiredFiles,
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function copyPathIfMissing(sourcePath: string, targetPath: string): Promise<boolean> {
  if (!(await pathExists(sourcePath))) return false
  if (await pathExists(targetPath)) return false

  await mkdir(path.dirname(targetPath), { recursive: true })
  await cp(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: false })
  return true
}

async function mergePathIfMissing(sourcePath: string, targetPath: string): Promise<string[]> {
  let sourceStat: Awaited<ReturnType<typeof stat>> | null = null
  try {
    sourceStat = await stat(sourcePath)
  } catch {
    sourceStat = null
  }
  if (!sourceStat) return []

  if (sourceStat.isDirectory()) {
    const repairedPaths: string[] = []
    let targetStat: Awaited<ReturnType<typeof stat>> | null = null
    try {
      targetStat = await stat(targetPath)
    } catch {
      targetStat = null
    }

    if (!targetStat) {
      await mkdir(targetPath, { recursive: true })
      repairedPaths.push(targetPath)
    } else if (!targetStat.isDirectory()) {
      return repairedPaths
    }

    const entries = await readdir(sourcePath, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const nestedSource = join(sourcePath, entry.name)
      const nestedTarget = join(targetPath, entry.name)
      const nestedRepairedPaths = await mergePathIfMissing(nestedSource, nestedTarget)
      if (nestedRepairedPaths.length > 0) {
        repairedPaths.push(...nestedRepairedPaths)
      }
    }

    return repairedPaths
  }

  if (await pathExists(targetPath)) return []

  await mkdir(path.dirname(targetPath), { recursive: true })
  await cp(sourcePath, targetPath, { recursive: false, force: false, errorOnExist: false })
  return [targetPath]
}

export async function repairManagedOpenClawStateLayout(
  managedHomeDir: string
): Promise<ManagedOpenClawStateRepairResult> {
  const normalizedManagedHomeDir = String(managedHomeDir || '').trim()
  if (!normalizedManagedHomeDir) {
    return { repairedPaths: [], quarantinedPaths: [] }
  }

  const managedStateRoot = join(normalizedManagedHomeDir, '.openclaw')
  const nestedStateRoot = join(managedStateRoot, '.openclaw')
  const quarantinedStateRoot = join(managedStateRoot, '__redundant_nested_openclaw__')
  const repairedPaths: string[] = []
  const quarantinedPaths: string[] = []

  if (
    await copyPathIfMissing(
      join(managedStateRoot, 'openclaw.json'),
      join(normalizedManagedHomeDir, 'openclaw.json')
    )
  ) {
    repairedPaths.push(join(normalizedManagedHomeDir, 'openclaw.json'))
  }

  if (!(await pathExists(nestedStateRoot))) {
    return { repairedPaths, quarantinedPaths }
  }

  const nestedEntries = await readdir(nestedStateRoot, { withFileTypes: true }).catch(() => [])
  for (const entry of nestedEntries) {
    if (entry.name === '.openclaw') continue

    const sourcePath = join(nestedStateRoot, entry.name)
    const targetPath = join(managedStateRoot, entry.name)
    const mergedPaths = await mergePathIfMissing(sourcePath, targetPath)
    if (mergedPaths.length > 0) {
      repairedPaths.push(...mergedPaths)
    }
  }

  const safeToQuarantine = !(await pathExists(quarantinedStateRoot))
    && await Promise.all(
      nestedEntries
        .filter((entry) => entry.name !== '.openclaw')
        .map((entry) => pathExists(join(managedStateRoot, entry.name)))
    ).then((results) => results.every(Boolean))

  if (safeToQuarantine) {
    await rename(nestedStateRoot, quarantinedStateRoot).catch(() => undefined)
    if (await pathExists(quarantinedStateRoot)) {
      quarantinedPaths.push(quarantinedStateRoot)
    }
  }

  return {
    repairedPaths: Array.from(new Set(repairedPaths)),
    quarantinedPaths,
  }
}
