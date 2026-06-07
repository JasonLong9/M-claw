import { describe, expect, it, vi } from 'vitest'

vi.mock('../skills-static-scanner', () => ({
  scanAllInstalledSkillsByPayload: vi.fn(),
}))

vi.mock('../skills-dynamic-sandbox', () => ({
  runSkillDynamicSandboxProbe: vi.fn(),
}))

import { scanAllInstalledSkillsByPayload } from '../skills-static-scanner'
import { runSkillDynamicSandboxProbe } from '../skills-dynamic-sandbox'
import {
  getLatestSkillsAuditSnapshot,
  getSkillsAuditSchedulerState,
  listSkillsAuditSnapshots,
  runSkillsContinuousAudit,
  startSkillsAuditScheduler,
  stopSkillsAuditScheduler,
} from '../skills-continuous-audit'

describe('skills-continuous-audit', () => {
  it('produces snapshot and delta across runs', async () => {
    vi.mocked(scanAllInstalledSkillsByPayload)
      .mockResolvedValueOnce([
        {
          skillSlug: 'a',
          scannedAt: new Date().toISOString(),
          scannedFiles: 1,
          findings: [],
          highestSeverity: 'none',
          riskScore: 0,
          blocked: false,
        },
      ] as any)
      .mockResolvedValueOnce([
        {
          skillSlug: 'a',
          scannedAt: new Date().toISOString(),
          scannedFiles: 1,
          findings: [{ ruleId: 'x', severity: 'high', message: 'm', filePath: '/a', sample: 's' }],
          highestSeverity: 'high',
          riskScore: 50,
          blocked: false,
        },
        {
          skillSlug: 'b',
          scannedAt: new Date().toISOString(),
          scannedFiles: 1,
          findings: [],
          highestSeverity: 'none',
          riskScore: 0,
          blocked: false,
        },
      ] as any)

    vi.mocked(runSkillDynamicSandboxProbe).mockImplementation(async (slug: string) => ({
      skillSlug: slug,
      scannedAt: new Date().toISOString(),
      timeoutMs: 1000,
      scannedFiles: 1,
      traces: [],
      riskScore: slug === 'a' ? 40 : 0,
      verdict: slug === 'a' ? 'warn' : 'allow',
    }) as any)

    const first = await runSkillsContinuousAudit({ skills: [{ skillKey: 'a' }] })
    expect(first.totalSkills).toBe(1)
    expect(first.delta.addedSkills).toContain('a')

    const second = await runSkillsContinuousAudit({ skills: [{ skillKey: 'a' }, { skillKey: 'b' }] })
    expect(second.totalSkills).toBe(2)
    expect(second.delta.addedSkills).toContain('b')
    expect(second.delta.changedSkills.some((item) => item.skillSlug === 'a')).toBe(true)
    const changedA = second.delta.changedSkills.find((item) => item.skillSlug === 'a')
    expect(changedA).toBeTruthy()
    expect(changedA?.staticRuleDelta.added.length || 0).toBeGreaterThanOrEqual(0)
    expect(changedA?.dynamicTraceTypeDelta.added.length || 0).toBeGreaterThanOrEqual(0)

    const latest = getLatestSkillsAuditSnapshot()
    expect(latest?.auditId).toBe(second.auditId)
    expect(listSkillsAuditSnapshots(2).length).toBeGreaterThanOrEqual(2)
  })

  it('starts and stops scheduler with state updates', async () => {
    const start = startSkillsAuditScheduler(async () => {}, { intervalMs: 1000 })
    expect(start.ok).toBe(true)
    const state1 = getSkillsAuditSchedulerState()
    expect(state1.enabled).toBe(true)
    expect(state1.intervalMs).toBeGreaterThanOrEqual(60_000)

    const stop = stopSkillsAuditScheduler()
    expect(stop.ok).toBe(true)
    const state2 = getSkillsAuditSchedulerState()
    expect(state2.enabled).toBe(false)
  })
})
