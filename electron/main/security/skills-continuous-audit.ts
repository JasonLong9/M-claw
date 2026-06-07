import type { SkillStaticScanResult } from './skills-static-scanner'
import { runSkillDynamicSandboxProbe, type SkillDynamicSandboxResult } from './skills-dynamic-sandbox'
import { scanAllInstalledSkillsByPayload } from './skills-static-scanner'
import { normalizeSkillSlug } from './skills-install-security'

export interface SkillAuditItem {
  skillSlug: string
  staticScan: SkillStaticScanResult
  dynamicProbe: SkillDynamicSandboxResult | null
}

export interface SkillAuditDelta {
  addedSkills: string[]
  removedSkills: string[]
  changedSkills: Array<{
    skillSlug: string
    staticRiskDelta: number
    dynamicRiskDelta: number
    findingsDelta: number
    staticRuleDelta: {
      added: string[]
      removed: string[]
    }
    dynamicTraceTypeDelta: {
      added: string[]
      removed: string[]
    }
  }>
}

export interface SkillContinuousAuditSnapshot {
  auditId: string
  auditedAt: string
  totalSkills: number
  blockedSkills: string[]
  items: SkillAuditItem[]
  delta: SkillAuditDelta
}

const MAX_HISTORY = 30
const history: SkillContinuousAuditSnapshot[] = []
let timerRef: ReturnType<typeof setInterval> | null = null
let schedulerState: {
  enabled: boolean
  intervalMs: number
  lastRunAt: string | null
  lastError: string | null
} = {
  enabled: false,
  intervalMs: 24 * 60 * 60 * 1000,
  lastRunAt: null,
  lastError: null,
}

function buildAuditId(): string {
  return `skills-audit-${Date.now()}`
}

function asMapBySlug(items: SkillAuditItem[]): Map<string, SkillAuditItem> {
  return new Map(items.map((item) => [normalizeSkillSlug(item.skillSlug), item]))
}

function buildDelta(
  previous: SkillContinuousAuditSnapshot | null,
  currentItems: SkillAuditItem[]
): SkillAuditDelta {
  if (!previous) {
    return { addedSkills: currentItems.map((item) => item.skillSlug), removedSkills: [], changedSkills: [] }
  }
  const prevMap = asMapBySlug(previous.items)
  const curMap = asMapBySlug(currentItems)

  const addedSkills: string[] = []
  const removedSkills: string[] = []
  const changedSkills: SkillAuditDelta['changedSkills'] = []

  for (const [slug, cur] of curMap.entries()) {
    const prev = prevMap.get(slug)
    if (!prev) {
      addedSkills.push(cur.skillSlug)
      continue
    }
    const staticRiskDelta = cur.staticScan.riskScore - prev.staticScan.riskScore
    const dynamicRiskDelta = (cur.dynamicProbe?.riskScore || 0) - (prev.dynamicProbe?.riskScore || 0)
    const findingsDelta = cur.staticScan.findings.length - prev.staticScan.findings.length
    const prevRules = new Set(prev.staticScan.findings.map((f) => f.ruleId))
    const curRules = new Set(cur.staticScan.findings.map((f) => f.ruleId))
    const prevTraceTypes = new Set((prev.dynamicProbe?.traces || []).map((t) => t.type))
    const curTraceTypes = new Set((cur.dynamicProbe?.traces || []).map((t) => t.type))
    const staticRuleAdded = Array.from(curRules).filter((id) => !prevRules.has(id))
    const staticRuleRemoved = Array.from(prevRules).filter((id) => !curRules.has(id))
    const dynamicTypeAdded = Array.from(curTraceTypes).filter((id) => !prevTraceTypes.has(id))
    const dynamicTypeRemoved = Array.from(prevTraceTypes).filter((id) => !curTraceTypes.has(id))
    if (staticRiskDelta !== 0 || dynamicRiskDelta !== 0 || findingsDelta !== 0) {
      changedSkills.push({
        skillSlug: cur.skillSlug,
        staticRiskDelta,
        dynamicRiskDelta,
        findingsDelta,
        staticRuleDelta: {
          added: staticRuleAdded,
          removed: staticRuleRemoved,
        },
        dynamicTraceTypeDelta: {
          added: dynamicTypeAdded,
          removed: dynamicTypeRemoved,
        },
      })
    }
  }

  for (const [slug, prev] of prevMap.entries()) {
    if (!curMap.has(slug)) removedSkills.push(prev.skillSlug)
  }

  return { addedSkills, removedSkills, changedSkills }
}

export async function runSkillsContinuousAudit(
  payload?: Record<string, unknown> | null
): Promise<SkillContinuousAuditSnapshot> {
  const staticResults = await scanAllInstalledSkillsByPayload(payload)
  const items: SkillAuditItem[] = []

  for (const staticScan of staticResults) {
    const dynamicProbe = await runSkillDynamicSandboxProbe(staticScan.skillSlug, {
      timeoutMs: 8_000,
      maxFiles: 400,
    })
    items.push({ skillSlug: staticScan.skillSlug, staticScan, dynamicProbe })
  }

  const previous = history.length > 0 ? history[history.length - 1] : null
  const delta = buildDelta(previous, items)
  const blockedSkills = items
    .filter((item) => item.staticScan.blocked || item.dynamicProbe?.verdict === 'block')
    .map((item) => item.skillSlug)

  const snapshot: SkillContinuousAuditSnapshot = {
    auditId: buildAuditId(),
    auditedAt: new Date().toISOString(),
    totalSkills: items.length,
    blockedSkills,
    items,
    delta,
  }

  history.push(snapshot)
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY)
  }
  return snapshot
}

export function getLatestSkillsAuditSnapshot(): SkillContinuousAuditSnapshot | null {
  return history.length > 0 ? history[history.length - 1] : null
}

export function listSkillsAuditSnapshots(limit = 10): SkillContinuousAuditSnapshot[] {
  const normalized = Math.max(1, Math.min(100, Number(limit) || 10))
  return history.slice(-normalized)
}

export function getSkillsAuditSchedulerState(): {
  enabled: boolean
  intervalMs: number
  lastRunAt: string | null
  lastError: string | null
} {
  return { ...schedulerState }
}

export function stopSkillsAuditScheduler(): { ok: boolean } {
  if (timerRef) {
    clearInterval(timerRef)
    timerRef = null
  }
  schedulerState = {
    ...schedulerState,
    enabled: false,
  }
  return { ok: true }
}

export function startSkillsAuditScheduler(
  runner: () => Promise<void>,
  options?: { intervalMs?: number }
): {
  ok: boolean
  enabled: boolean
  intervalMs: number
} {
  const intervalMs = Math.max(60_000, Math.min(7 * 24 * 60 * 60 * 1000, Number(options?.intervalMs || schedulerState.intervalMs)))
  if (timerRef) {
    clearInterval(timerRef)
    timerRef = null
  }
  schedulerState = {
    ...schedulerState,
    enabled: true,
    intervalMs,
  }
  timerRef = setInterval(() => {
    void runner()
      .then(() => {
        schedulerState = {
          ...schedulerState,
          lastRunAt: new Date().toISOString(),
          lastError: null,
        }
      })
      .catch((error: any) => {
        schedulerState = {
          ...schedulerState,
          lastError: String(error?.message || error || 'unknown scheduler error'),
        }
      })
  }, intervalMs)

  return { ok: true, enabled: true, intervalMs }
}
