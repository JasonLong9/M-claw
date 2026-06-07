import { describe, expect, it, vi } from 'vitest'

vi.mock('../skills-install-security', () => ({
  verifySkillInstallRequest: vi.fn(),
}))

vi.mock('../skills-static-scanner', () => ({
  scanInstalledSkillBySlug: vi.fn(),
}))

vi.mock('../skills-dynamic-sandbox', () => ({
  runSkillDynamicSandboxProbe: vi.fn(),
}))

import { verifySkillInstallRequest } from '../skills-install-security'
import { scanInstalledSkillBySlug } from '../skills-static-scanner'
import { runSkillDynamicSandboxProbe } from '../skills-dynamic-sandbox'
import { evaluateSkillPreinstallRisk } from '../skills-preinstall-gate'

describe('skills-preinstall-gate', () => {
  it('blocks when policy check fails', async () => {
    vi.mocked(verifySkillInstallRequest).mockReturnValue({
      allowed: false,
      errorCode: 'SKILL_NOT_WHITELISTED',
      reason: 'blocked',
    })
    vi.mocked(scanInstalledSkillBySlug).mockResolvedValue(null)
    vi.mocked(runSkillDynamicSandboxProbe).mockResolvedValue(null)

    const result = await evaluateSkillPreinstallRisk({
      slug: 'x',
      source: 'clawhub',
    })
    expect(result.verdict).toBe('block')
    expect(result.errorCode).toBe('SKILL_NOT_WHITELISTED')
  })

  it('warns when dynamic probe is warn', async () => {
    vi.mocked(verifySkillInstallRequest).mockReturnValue({ allowed: true })
    vi.mocked(scanInstalledSkillBySlug).mockResolvedValue({
      skillSlug: 'x',
      scannedAt: new Date().toISOString(),
      scannedFiles: 1,
      findings: [],
      highestSeverity: 'none',
      riskScore: 0,
      blocked: false,
    })
    vi.mocked(runSkillDynamicSandboxProbe).mockResolvedValue({
      skillSlug: 'x',
      scannedAt: new Date().toISOString(),
      timeoutMs: 1000,
      scannedFiles: 1,
      traces: [],
      riskScore: 45,
      verdict: 'warn',
    })

    const result = await evaluateSkillPreinstallRisk({
      slug: 'x',
      source: 'clawhub',
    })
    expect(result.verdict).toBe('warn')
  })

  it('allows when checks are clean', async () => {
    vi.mocked(verifySkillInstallRequest).mockReturnValue({ allowed: true })
    vi.mocked(scanInstalledSkillBySlug).mockResolvedValue({
      skillSlug: 'x',
      scannedAt: new Date().toISOString(),
      scannedFiles: 1,
      findings: [],
      highestSeverity: 'none',
      riskScore: 0,
      blocked: false,
    })
    vi.mocked(runSkillDynamicSandboxProbe).mockResolvedValue({
      skillSlug: 'x',
      scannedAt: new Date().toISOString(),
      timeoutMs: 1000,
      scannedFiles: 1,
      traces: [],
      riskScore: 0,
      verdict: 'allow',
    })

    const result = await evaluateSkillPreinstallRisk({
      slug: 'x',
      source: 'openclaw-bundled',
    })
    expect(result.verdict).toBe('allow')
  })
})

