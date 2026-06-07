import { normalizeSkillSlug } from './skills-install-security'
import { getSkillRuntimeRiskSummary, isSkillRuntimeDisabled } from './skills-runtime-guard'
import type { SkillContinuousAuditSnapshot } from './skills-continuous-audit'

export type SkillRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type SkillRemediationAction = 'notify' | 'restrict' | 'quarantine'

export interface SkillRemediationRecord {
  timestamp: string
  skillSlug: string
  level: SkillRiskLevel
  action: SkillRemediationAction
  reason?: string
  operator: 'system' | 'manual'
}

export interface SkillFalsePositiveExemption {
  skillSlug: string
  reason: string
  reviewer: string
  createdAt: string
  expiresAt: string
}

const MAX_RECORDS = 500
const remediationRecords: SkillRemediationRecord[] = []
const restrictedSkills = new Set<string>()
const quarantinedSkills = new Set<string>()
const exemptions = new Map<string, SkillFalsePositiveExemption>()

function actionByLevel(level: SkillRiskLevel): SkillRemediationAction {
  if (level === 'low') return 'notify'
  if (level === 'medium') return 'restrict'
  return 'quarantine'
}

function pushRecord(record: SkillRemediationRecord): void {
  remediationRecords.push(record)
  if (remediationRecords.length > MAX_RECORDS) {
    remediationRecords.splice(0, remediationRecords.length - MAX_RECORDS)
  }
}

export function applySkillRemediation(input: {
  skillSlug: string
  level: SkillRiskLevel
  reason?: string
  operator?: 'system' | 'manual'
}): {
  ok: boolean
  action: SkillRemediationAction
  skillSlug: string
  skipped?: boolean
} {
  const skillSlug = normalizeSkillSlug(input.skillSlug)
  if (!skillSlug) return { ok: false, action: 'notify', skillSlug: '' }
  if (isSkillExempted(skillSlug)) {
    pushRecord({
      timestamp: new Date().toISOString(),
      skillSlug,
      level: input.level,
      action: 'notify',
      reason: `exempted: ${input.reason || ''}`.trim(),
      operator: input.operator || 'system',
    })
    return { ok: true, action: 'notify', skillSlug, skipped: true }
  }
  const action = actionByLevel(input.level)
  if (action === 'restrict') {
    restrictedSkills.add(skillSlug)
  } else if (action === 'quarantine') {
    quarantinedSkills.add(skillSlug)
    restrictedSkills.delete(skillSlug)
  }
  pushRecord({
    timestamp: new Date().toISOString(),
    skillSlug,
    level: input.level,
    action,
    reason: input.reason,
    operator: input.operator || 'system',
  })
  return { ok: true, action, skillSlug }
}

export function restoreSkillFromRemediation(input: {
  skillSlug: string
  operator?: 'system' | 'manual'
  reason?: string
}): { ok: boolean; skillSlug: string } {
  const skillSlug = normalizeSkillSlug(input.skillSlug)
  if (!skillSlug) return { ok: false, skillSlug: '' }
  quarantinedSkills.delete(skillSlug)
  restrictedSkills.delete(skillSlug)
  pushRecord({
    timestamp: new Date().toISOString(),
    skillSlug,
    level: 'low',
    action: 'notify',
    reason: input.reason || 'restored',
    operator: input.operator || 'manual',
  })
  return { ok: true, skillSlug }
}

export function getSkillRemediationState(): {
  restrictedSkills: string[]
  quarantinedSkills: string[]
  runtimeDisabledSkills: string[]
  exemptions: SkillFalsePositiveExemption[]
  records: SkillRemediationRecord[]
} {
  return {
    restrictedSkills: Array.from(restrictedSkills),
    quarantinedSkills: Array.from(quarantinedSkills),
    runtimeDisabledSkills: getSkillRuntimeRiskSummary().disabledSkills.filter((slug) => isSkillRuntimeDisabled(slug)),
    exemptions: listSkillExemptions(),
    records: remediationRecords.slice(-200),
  }
}

export function applyRemediationFromAuditSnapshot(snapshot: SkillContinuousAuditSnapshot): {
  total: number
  quarantined: number
  restricted: number
  notified: number
  skippedByExemption: number
} {
  let quarantined = 0
  let restricted = 0
  let notified = 0
  let skippedByExemption = 0

  for (const item of snapshot.items) {
    const staticBlocked = item.staticScan.blocked
    const dynamicVerdict = item.dynamicProbe?.verdict || 'allow'
    if (staticBlocked || dynamicVerdict === 'block') {
      const result = applySkillRemediation({
        skillSlug: item.skillSlug,
        level: 'high',
        reason: 'auto remediation by audit snapshot',
        operator: 'system',
      })
      if (result.skipped) {
        skippedByExemption += 1
        continue
      }
      quarantined += 1
      continue
    }
    if (dynamicVerdict === 'warn') {
      const result = applySkillRemediation({
        skillSlug: item.skillSlug,
        level: 'medium',
        reason: 'auto remediation by audit snapshot',
        operator: 'system',
      })
      if (result.skipped) {
        skippedByExemption += 1
        continue
      }
      restricted += 1
      continue
    }
    applySkillRemediation({
      skillSlug: item.skillSlug,
      level: 'low',
      reason: 'auto remediation by audit snapshot',
      operator: 'system',
    })
    notified += 1
  }

  return {
    total: snapshot.items.length,
    quarantined,
    restricted,
    notified,
    skippedByExemption,
  }
}

function isSkillExempted(rawSlug: string): boolean {
  const slug = normalizeSkillSlug(rawSlug)
  const record = exemptions.get(slug)
  if (!record) return false
  const expired = Date.now() >= new Date(record.expiresAt).getTime()
  if (expired) {
    exemptions.delete(slug)
    return false
  }
  return true
}

export function upsertSkillExemption(input: {
  skillSlug: string
  reason: string
  reviewer: string
  expiresInHours: number
}): { ok: boolean; record?: SkillFalsePositiveExemption; error?: string } {
  const skillSlug = normalizeSkillSlug(input.skillSlug)
  const reason = String(input.reason || '').trim()
  const reviewer = String(input.reviewer || '').trim()
  const expiresInHours = Number(input.expiresInHours || 0)
  if (!skillSlug) return { ok: false, error: 'INVALID_SKILL_SLUG' }
  if (!reason) return { ok: false, error: 'MISSING_REASON' }
  if (!reviewer) return { ok: false, error: 'MISSING_REVIEWER' }
  if (!Number.isFinite(expiresInHours) || expiresInHours <= 0) return { ok: false, error: 'INVALID_EXPIRES' }

  const record: SkillFalsePositiveExemption = {
    skillSlug,
    reason,
    reviewer,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
  }
  exemptions.set(skillSlug, record)
  return { ok: true, record }
}

export function removeSkillExemption(skillSlugInput: string): { ok: boolean } {
  const skillSlug = normalizeSkillSlug(skillSlugInput)
  if (!skillSlug) return { ok: false }
  exemptions.delete(skillSlug)
  return { ok: true }
}

export function listSkillExemptions(): SkillFalsePositiveExemption[] {
  const now = Date.now()
  const items: SkillFalsePositiveExemption[] = []
  for (const [slug, record] of exemptions.entries()) {
    if (now >= new Date(record.expiresAt).getTime()) {
      exemptions.delete(slug)
      continue
    }
    items.push(record)
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
