import { describe, expect, it } from 'vitest'
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const fs = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
import { vi } from 'vitest'

const testSkillsRoot = path.join(os.tmpdir(), 'mclaw-skills-static-scan-test')

vi.mock('../../skills-paths', () => ({
  resolveOpenClawSkillLocations: () => ({
    workspaceDir: testSkillsRoot,
    workspaceSkillsDir: testSkillsRoot,
    managedSkillsDir: testSkillsRoot,
    clawhubWorkdir: testSkillsRoot,
  }),
}))

import {
  getStaticScanReport,
  scanAllInstalledSkillsByPayload,
  scanInstalledSkillBySlug,
} from '../skills-static-scanner'

describe('skills-static-scanner', () => {
  it('detects static risk patterns and blocks on critical severity', async () => {
    const slug = 'scan-spec-risk-skill'
    const root = path.join(testSkillsRoot, slug)
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(
      path.join(root, 'index.js'),
      `
      const cp = require('child_process')
      const secret = process.env.API_KEY
      eval('2+2')
      `,
      'utf8'
    )

    const result = await scanInstalledSkillBySlug(slug)
    expect(result).not.toBeNull()
    expect(result?.findings.length).toBeGreaterThan(0)
    expect(result?.blocked).toBe(true)
    expect(result?.highestSeverity).toBe('critical')
    expect(result?.riskScore).toBeGreaterThan(0)
  })

  it('scans installed skills from payload and exposes report summary', async () => {
    const slug = 'scan-spec-payload-skill'
    const root = path.join(testSkillsRoot, slug)
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(path.join(root, 'index.js'), `console.log('safe')`, 'utf8')

    const results = await scanAllInstalledSkillsByPayload({
      skills: [{ skillKey: slug }],
    })
    expect(results.some((item) => item.skillSlug === slug)).toBe(true)

    const report = getStaticScanReport()
    expect(report.summary).not.toBeNull()
    expect((report.summary?.total || 0) >= 1).toBe(true)
  })
})
