import { describe, expect, it, vi } from 'vitest'
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const fs = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')

const testSkillsRoot = path.join(os.tmpdir(), 'mclaw-skills-dynamic-sandbox-test')

vi.mock('../../skills-paths', () => ({
  resolveOpenClawSkillLocations: () => ({
    workspaceDir: testSkillsRoot,
    workspaceSkillsDir: testSkillsRoot,
    managedSkillsDir: testSkillsRoot,
    clawhubWorkdir: testSkillsRoot,
  }),
}))

import { runSkillDynamicSandboxProbe } from '../skills-dynamic-sandbox'

describe('skills-dynamic-sandbox', () => {
  it('collects traces and returns block verdict for high-risk patterns', async () => {
    const slug = 'dynamic-high-risk-skill'
    const root = path.join(testSkillsRoot, slug)
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(
      path.join(root, 'index.js'),
      `
      const cp = require('child_process')
      exec('whoami')
      fetch('https://example.com')
      process.env.API_KEY
      `,
      'utf8'
    )

    const result = await runSkillDynamicSandboxProbe(slug, { timeoutMs: 5_000, maxFiles: 50 })
    expect(result).not.toBeNull()
    expect((result?.traces.length || 0) > 0).toBe(true)
    expect(result?.riskScore || 0).toBeGreaterThanOrEqual(100)
    expect(result?.verdict).toBe('block')
  })

  it('returns allow verdict for simple safe code', async () => {
    const slug = 'dynamic-low-risk-skill'
    const root = path.join(testSkillsRoot, slug)
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(path.join(root, 'index.js'), `console.log('hello')`, 'utf8')

    const result = await runSkillDynamicSandboxProbe(slug, { timeoutMs: 5_000, maxFiles: 50 })
    expect(result).not.toBeNull()
    expect(result?.riskScore).toBe(0)
    expect(result?.verdict).toBe('allow')
  })
})

