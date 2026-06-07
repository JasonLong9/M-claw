import { describe, expect, it } from 'vitest'
import {
  getSkillRuntimeRiskSummary,
  isSkillRuntimeDisabled,
  recordSkillRuntimeEvent,
} from '../skills-runtime-guard'

describe('skills-runtime-guard', () => {
  it('accumulates risk and auto-disables skill at threshold', () => {
    const slug = 'runtime-risk-demo'
    expect(isSkillRuntimeDisabled(slug)).toBe(false)

    const r1 = recordSkillRuntimeEvent({ skillSlug: slug, type: 'exec' })
    expect(r1.blocked).toBe(false)

    const r2 = recordSkillRuntimeEvent({ skillSlug: slug, type: 'network_external' })
    expect(r2.currentRisk).toBeGreaterThan(r1.currentRisk)

    const r3 = recordSkillRuntimeEvent({ skillSlug: slug, type: 'env_sensitive_access' })
    expect(r3.blocked).toBe(true)
    expect(isSkillRuntimeDisabled(slug)).toBe(true)

    const summary = getSkillRuntimeRiskSummary()
    expect(summary.disabledSkills).toContain(slug)
    expect(summary.riskBySkill[slug]).toBeGreaterThan(0)
  })
})

