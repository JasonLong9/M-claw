import { describe, expect, it } from 'vitest'
import {
  exportSkillSecurityAuditLog,
  getBlockedSkillInstalls,
  getSkillSecurityAuditLog,
  getSkillSecuritySummary,
  recordSkillInstallAudit,
} from '../skills-security-auditor'

describe('skills-security-auditor', () => {
  it('records blocked install with error code and exposes summary', () => {
    recordSkillInstallAudit({
      action: 'install_blocked',
      slug: 'evil-skill',
      source: 'clawhub',
      result: {
        allowed: false,
        reason: 'blocked',
        errorCode: 'SKILL_NOT_WHITELISTED',
      },
    })

    const last = getSkillSecurityAuditLog(1)[0]
    expect(last.slug).toBe('evil-skill')
    expect(last.errorCode).toBe('SKILL_NOT_WHITELISTED')

    const summary = getSkillSecuritySummary()
    expect(summary.total).toBeGreaterThan(0)
    expect(summary.blocked).toBeGreaterThan(0)
    expect(summary.byErrorCode.SKILL_NOT_WHITELISTED).toBeGreaterThan(0)
  })

  it('returns blocked installs and exports audit json', () => {
    recordSkillInstallAudit({
      action: 'install_allowed',
      slug: 'github',
      source: 'clawhub',
      result: {
        allowed: true,
      },
    })

    const blocked = getBlockedSkillInstalls(50)
    expect(blocked.every((item) => !item.allowed)).toBe(true)

    const exported = exportSkillSecurityAuditLog()
    const parsed = JSON.parse(exported) as { total: number; entries: Array<{ slug: string }> }
    expect(parsed.total).toBeGreaterThan(0)
    expect(parsed.entries.length).toBeGreaterThan(0)
  })
})
