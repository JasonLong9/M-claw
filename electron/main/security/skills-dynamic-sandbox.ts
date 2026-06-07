const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const fs = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')

import { resolveOpenClawSkillLocations } from '../skills-paths'
import { normalizeSkillSlug } from './skills-install-security'
import type { SkillRuntimeEventType } from './skills-runtime-guard'

export type SkillDynamicVerdict = 'allow' | 'warn' | 'block'
export type SkillDynamicTraceType = 'file' | 'network' | 'subprocess'

export interface SkillDynamicTrace {
  type: SkillDynamicTraceType
  eventType: SkillRuntimeEventType
  filePath: string
  sample: string
  risk: number
}

export interface SkillDynamicSandboxResult {
  skillSlug: string
  scannedAt: string
  timeoutMs: number
  scannedFiles: number
  traces: SkillDynamicTrace[]
  riskScore: number
  verdict: SkillDynamicVerdict
}

const DYNAMIC_PATTERNS: Array<{
  type: SkillDynamicTraceType
  eventType: SkillRuntimeEventType
  risk: number
  regex: RegExp
}> = [
  { type: 'subprocess', eventType: 'exec', risk: 60, regex: /\b(child_process|exec\s*\(|spawn\s*\(|execSync\s*\(|spawnSync\s*\()/i },
  { type: 'network', eventType: 'network_external', risk: 40, regex: /\b(fetch\s*\(|axios\.|http\.request\s*\(|https\.request\s*\()/i },
  { type: 'file', eventType: 'file_write', risk: 35, regex: /\b(writeFile\s*\(|appendFile\s*\(|createWriteStream\s*\()/i },
  { type: 'file', eventType: 'file_read_sensitive', risk: 30, regex: /\b(readFileSync?\s*\(|\.ssh|id_rsa|known_hosts|\.env)/i },
  { type: 'file', eventType: 'env_sensitive_access', risk: 45, regex: /\bprocess\.env\.(API_KEY|TOKEN|SECRET|PASSWORD|ACCESS_KEY)/i },
]

function toVerdict(riskScore: number): SkillDynamicVerdict {
  if (riskScore >= 100) return 'block'
  if (riskScore >= 40) return 'warn'
  return 'allow'
}

function isCodeLikeFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.json'].includes(ext)
}

async function listFilesRecursively(rootDir: string): Promise<string[]> {
  const files: string[] = []
  const queue: string[] = [rootDir]
  while (queue.length > 0) {
    const current = queue.pop() as string
    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>
    try {
      entries = await fs.readdir(current, { withFileTypes: true }) as any
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const nextPath = path.join(current, entry.name)
      if (entry.isDirectory()) queue.push(nextPath)
      else if (entry.isFile()) files.push(nextPath)
    }
  }
  return files
}

function buildSkillRootCandidates(skillSlug: string): string[] {
  const locations = resolveOpenClawSkillLocations()
  return [
    path.join(locations.workspaceSkillsDir, skillSlug),
    path.join(locations.managedSkillsDir, skillSlug),
  ]
}

async function resolveFirstExistingDirectory(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate)
      if (stat.isDirectory()) return candidate
    } catch {
      continue
    }
  }
  return null
}

export async function runSkillDynamicSandboxProbe(
  rawSlug: string,
  options?: { timeoutMs?: number; maxFiles?: number }
): Promise<SkillDynamicSandboxResult | null> {
  const skillSlug = normalizeSkillSlug(rawSlug)
  if (!skillSlug) return null
  const timeoutMs = Math.max(500, Math.min(30_000, Number(options?.timeoutMs || 8_000)))
  const maxFiles = Math.max(10, Math.min(2000, Number(options?.maxFiles || 400)))
  const rootDir = await resolveFirstExistingDirectory(buildSkillRootCandidates(skillSlug))
  if (!rootDir) return null

  const startedAt = Date.now()
  const allFiles = await listFilesRecursively(rootDir)
  const codeFiles = allFiles.filter(isCodeLikeFile).slice(0, maxFiles)
  const traces: SkillDynamicTrace[] = []
  let riskScore = 0

  for (const filePath of codeFiles) {
    if (Date.now() - startedAt > timeoutMs) break
    let content = ''
    try {
      content = await fs.readFile(filePath, 'utf8')
    } catch {
      continue
    }
    for (const rule of DYNAMIC_PATTERNS) {
      const match = content.match(rule.regex)
      if (!match) continue
      traces.push({
        type: rule.type,
        eventType: rule.eventType,
        filePath,
        sample: String(match[0] || '').slice(0, 120),
        risk: rule.risk,
      })
      riskScore += rule.risk
    }
  }

  return {
    skillSlug,
    scannedAt: new Date().toISOString(),
    timeoutMs,
    scannedFiles: codeFiles.length,
    traces,
    riskScore,
    verdict: toVerdict(riskScore),
  }
}

