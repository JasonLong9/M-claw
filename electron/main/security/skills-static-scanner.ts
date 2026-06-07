const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const fs = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')

import { resolveOpenClawSkillLocations } from '../skills-paths'
import { normalizeSkillSlug } from './skills-install-security'

export type SkillStaticSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface SkillStaticFinding {
  ruleId: string
  severity: SkillStaticSeverity
  message: string
  filePath: string
  sample: string
}

export interface SkillStaticScanResult {
  skillSlug: string
  scannedAt: string
  scannedFiles: number
  findings: SkillStaticFinding[]
  highestSeverity: SkillStaticSeverity | 'none'
  riskScore: number
  blocked: boolean
}

interface StaticRule {
  id: string
  severity: SkillStaticSeverity
  message: string
  regex: RegExp
}

const STATIC_RULES: StaticRule[] = [
  {
    id: 'exec-child-process',
    severity: 'critical',
    message: '检测到命令执行相关模式',
    regex: /\b(child_process|exec\s*\(|spawn\s*\(|execSync\s*\(|spawnSync\s*\()/i,
  },
  {
    id: 'dynamic-eval',
    severity: 'critical',
    message: '检测到动态代码执行模式',
    regex: /\b(eval\s*\(|new Function\s*\()/i,
  },
  {
    id: 'external-network',
    severity: 'high',
    message: '检测到外部网络请求模式',
    regex: /\b(fetch\s*\(|axios\.|http\.request\s*\(|https\.request\s*\()/i,
  },
  {
    id: 'sensitive-env-access',
    severity: 'high',
    message: '检测到敏感环境变量访问模式',
    regex: /\bprocess\.env\.(API_KEY|TOKEN|SECRET|PASSWORD|ACCESS_KEY)/i,
  },
  {
    id: 'file-write',
    severity: 'medium',
    message: '检测到文件写入模式',
    regex: /\b(writeFile\s*\(|appendFile\s*\(|createWriteStream\s*\()/i,
  },
  {
    id: 'file-read-sensitive',
    severity: 'low',
    message: '检测到文件读取模式',
    regex: /\b(readFile\s*\(|readFileSync\s*\()/i,
  },
]

const SEVERITY_SCORE: Record<SkillStaticSeverity, number> = {
  low: 10,
  medium: 25,
  high: 50,
  critical: 80,
}

const reportStore = new Map<string, SkillStaticScanResult>()
let lastScanSummary: { scannedAt: string; total: number; blocked: number } | null = null

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

function higherSeverity(a: SkillStaticSeverity | 'none', b: SkillStaticSeverity): SkillStaticSeverity {
  if (a === 'none') return b
  const order: SkillStaticSeverity[] = ['low', 'medium', 'high', 'critical']
  return order.indexOf(b) > order.indexOf(a) ? b : a
}

function shouldBlock(findings: SkillStaticFinding[]): boolean {
  return findings.some((item) => item.severity === 'critical')
}

async function scanDirectory(skillSlug: string, rootDir: string): Promise<SkillStaticScanResult> {
  const files = await listFilesRecursively(rootDir)
  const codeFiles = files.filter(isCodeLikeFile)
  const findings: SkillStaticFinding[] = []
  let highest: SkillStaticSeverity | 'none' = 'none'
  let riskScore = 0

  for (const filePath of codeFiles) {
    let content = ''
    try {
      content = await fs.readFile(filePath, 'utf8')
    } catch {
      continue
    }
    for (const rule of STATIC_RULES) {
      const match = content.match(rule.regex)
      if (!match) continue
      highest = higherSeverity(highest, rule.severity)
      riskScore += SEVERITY_SCORE[rule.severity]
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.message,
        filePath,
        sample: String(match[0] || '').slice(0, 120),
      })
    }
  }

  const result: SkillStaticScanResult = {
    skillSlug,
    scannedAt: new Date().toISOString(),
    scannedFiles: codeFiles.length,
    findings,
    highestSeverity: highest,
    riskScore,
    blocked: shouldBlock(findings),
  }
  reportStore.set(skillSlug, result)
  return result
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

export async function scanInstalledSkillBySlug(rawSlug: string): Promise<SkillStaticScanResult | null> {
  const skillSlug = normalizeSkillSlug(rawSlug)
  if (!skillSlug) return null
  const rootDir = await resolveFirstExistingDirectory(buildSkillRootCandidates(skillSlug))
  if (!rootDir) return null
  return scanDirectory(skillSlug, rootDir)
}

export async function scanAllInstalledSkillsByPayload(payload?: Record<string, unknown> | null): Promise<SkillStaticScanResult[]> {
  const skills = Array.isArray(payload?.skills) ? payload?.skills : []
  const slugs = new Set<string>()
  for (const item of skills) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const key = normalizeSkillSlug(String(record.skillKey || record.name || ''))
    if (key) slugs.add(key)
  }

  const results: SkillStaticScanResult[] = []
  for (const slug of slugs) {
    const one = await scanInstalledSkillBySlug(slug)
    if (one) results.push(one)
  }

  lastScanSummary = {
    scannedAt: new Date().toISOString(),
    total: results.length,
    blocked: results.filter((item) => item.blocked).length,
  }
  return results
}

export function getStaticScanReport(): {
  summary: { scannedAt: string; total: number; blocked: number } | null
  results: SkillStaticScanResult[]
} {
  return {
    summary: lastScanSummary,
    results: Array.from(reportStore.values()).sort((a, b) => b.scannedAt.localeCompare(a.scannedAt)),
  }
}

