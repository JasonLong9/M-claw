import { describe, expect, it } from 'vitest'
import {
  applyRemediationFromAuditSnapshot,
  applySkillRemediation,
  getSkillRemediationState,
  listSkillExemptions,
  removeSkillExemption,
  restoreSkillFromRemediation,
  upsertSkillExemption,
} from '../skills-remediation-orchestrator'

describe('skills-remediation-orchestrator', () => {
  it('maps low/medium/high to notify/restrict/quarantine', () => {
    const low = applySkillRemediation({ skillSlug: 's-low', level: 'low', operator: 'system' })
    const medium = applySkillRemediation({ skillSlug: 's-medium', level: 'medium', operator: 'system' })
    const high = applySkillRemediation({ skillSlug: 's-high', level: 'high', operator: 'system' })

    expect(low.action).toBe('notify')
    expect(medium.action).toBe('restrict')
    expect(high.action).toBe('quarantine')

    const state = getSkillRemediationState()
    expect(state.restrictedSkills).toContain('s-medium')
    expect(state.quarantinedSkills).toContain('s-high')
  })

  it('restores restricted/quarantined skill', () => {
    applySkillRemediation({ skillSlug: 's-restore', level: 'critical', operator: 'system' })
    const restored = restoreSkillFromRemediation({ skillSlug: 's-restore', operator: 'manual' })
    expect(restored.ok).toBe(true)

    const state = getSkillRemediationState()
    expect(state.restrictedSkills).not.toContain('s-restore')
    expect(state.quarantinedSkills).not.toContain('s-restore')
  })

  it('auto applies remediation from audit snapshot', () => {
    const summary = applyRemediationFromAuditSnapshot({
      auditId: 'a1',
      auditedAt: new Date().toISOString(),
      totalSkills: 2,
      blockedSkills: ['blocked-skill'],
      delta: { addedSkills: [], removedSkills: [], changedSkills: [] },
      items: [
        {
          skillSlug: 'blocked-skill',
          staticScan: {
            skillSlug: 'blocked-skill',
            scannedAt: new Date().toISOString(),
            scannedFiles: 1,
            findings: [],
            highestSeverity: 'critical',
            riskScore: 80,
            blocked: true,
          },
          dynamicProbe: {
            skillSlug: 'blocked-skill',
            scannedAt: new Date().toISOString(),
            timeoutMs: 1000,
            scannedFiles: 1,
            traces: [],
            riskScore: 120,
            verdict: 'block',
          },
        },
        {
          skillSlug: 'warn-skill',
          staticScan: {
            skillSlug: 'warn-skill',
            scannedAt: new Date().toISOString(),
            scannedFiles: 1,
            findings: [],
            highestSeverity: 'none',
            riskScore: 0,
            blocked: false,
          },
          dynamicProbe: {
            skillSlug: 'warn-skill',
            scannedAt: new Date().toISOString(),
            timeoutMs: 1000,
            scannedFiles: 1,
            traces: [],
            riskScore: 40,
            verdict: 'warn',
          },
        },
      ],
    })
    expect(summary.total).toBe(2)
    expect(summary.quarantined).toBeGreaterThanOrEqual(1)
    expect(summary.restricted).toBeGreaterThanOrEqual(1)
  })

  it('skips remediation when skill is exempted', () => {
    const upsert = upsertSkillExemption({
      skillSlug: 'exempted-skill',
      reason: 'false-positive',
      reviewer: 'qa',
      expiresInHours: 1,
    })
    expect(upsert.ok).toBe(true)
    expect(listSkillExemptions().some((item) => item.skillSlug === 'exempted-skill')).toBe(true)

    const summary = applyRemediationFromAuditSnapshot({
      auditId: 'a2',
      auditedAt: new Date().toISOString(),
      totalSkills: 1,
      blockedSkills: ['exempted-skill'],
      delta: { addedSkills: [], removedSkills: [], changedSkills: [] },
      items: [
        {
          skillSlug: 'exempted-skill',
          staticScan: {
            skillSlug: 'exempted-skill',
            scannedAt: new Date().toISOString(),
            scannedFiles: 1,
            findings: [],
            highestSeverity: 'critical',
            riskScore: 80,
            blocked: true,
          },
          dynamicProbe: {
            skillSlug: 'exempted-skill',
            scannedAt: new Date().toISOString(),
            timeoutMs: 1000,
            scannedFiles: 1,
            traces: [],
            riskScore: 120,
            verdict: 'block',
          },
        },
      ],
    })
    expect(summary.skippedByExemption).toBeGreaterThanOrEqual(1)
    removeSkillExemption('exempted-skill')
  })
})
