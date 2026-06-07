import type { SkillInstallSource } from './skills-install-security'

export type SkillSecurityAuditAction = 'install_allowed' | 'install_blocked'

export interface SkillSecurityAuditEntry {
  timestamp: string
  action: SkillSecurityAuditAction
  slug: string
  source: SkillInstallSource
  allowed: boolean
  reason?: string
  errorCode?: string
}

const MAX_AUDIT_ENTRIES = 500
const auditEntries: SkillSecurityAuditEntry[] = []

export function recordSkillInstallAudit(input: {
  action: SkillSecurityAuditAction
  slug: string
  source: SkillInstallSource
  result: {
    allowed: boolean
    reason?: string
    errorCode?: string
  }
}): void {
  auditEntries.push({
    timestamp: new Date().toISOString(),
    action: input.action,
    slug: input.slug,
    source: input.source,
    allowed: input.result.allowed,
    reason: input.result.reason,
    errorCode: input.result.errorCode,
  })
  if (auditEntries.length > MAX_AUDIT_ENTRIES) {
    auditEntries.splice(0, auditEntries.length - MAX_AUDIT_ENTRIES)
  }
}

export function getSkillSecurityAuditLog(limit?: number): SkillSecurityAuditEntry[] {
  const normalizedLimit = Number.isFinite(limit as number) ? Math.max(1, Number(limit)) : 100
  return auditEntries.slice(-normalizedLimit)
}

export function getSkillSecuritySummary(): {
  total: number
  allowed: number
  blocked: number
  byErrorCode: Record<string, number>
} {
  const summary = {
    total: auditEntries.length,
    allowed: 0,
    blocked: 0,
    byErrorCode: {} as Record<string, number>,
  }
  for (const entry of auditEntries) {
    if (entry.allowed) summary.allowed += 1
    else summary.blocked += 1
    if (entry.errorCode) {
      summary.byErrorCode[entry.errorCode] = (summary.byErrorCode[entry.errorCode] || 0) + 1
    }
  }
  return summary
}

export function getBlockedSkillInstalls(limit?: number): SkillSecurityAuditEntry[] {
  const normalizedLimit = Number.isFinite(limit as number) ? Math.max(1, Number(limit)) : 100
  return auditEntries.filter((entry) => !entry.allowed).slice(-normalizedLimit)
}

export function exportSkillSecurityAuditLog(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      total: auditEntries.length,
      entries: auditEntries,
    },
    null,
    2
  )
}
