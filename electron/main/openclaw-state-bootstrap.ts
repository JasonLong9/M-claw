import { join } from 'path'
import { access, mkdir, writeFile } from 'fs/promises'

export interface OpenClawStateBootstrapResult {
  ensuredDirs: string[]
  ensuredFiles: string[]
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
