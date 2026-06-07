import { describe, expect, it } from 'vitest'
import { verifyOfficialSkillsIntegrity, verifySkillInstallRequest } from '../skills-install-security'

describe('skills-install-security', () => {
  it('allows official skill from clawhub', () => {
    const result = verifySkillInstallRequest({
      slug: 'github',
      source: 'clawhub',
      installPath: 'skills',
    })
    expect(result.allowed).toBe(true)
  })

  it('blocks non-whitelisted skill', () => {
    const result = verifySkillInstallRequest({
      slug: 'evil-skill',
      source: 'clawhub',
      installPath: 'skills',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not in official whitelist')
    expect(result.errorCode).toBe('SKILL_NOT_WHITELISTED')
  })

  it('passes whitelist integrity check', () => {
    expect(verifyOfficialSkillsIntegrity()).toBe(true)
  })

  it('allows trusted source from manifest policy', () => {
    const result = verifySkillInstallRequest({
      slug: 'github',
      source: 'clawhub' as const,
      installPath: 'skills',
    })
    expect(result.allowed).toBe(true)
  })
})
