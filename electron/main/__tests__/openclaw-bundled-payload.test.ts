import { describe, expect, it } from 'vitest'
import {
  OPENCLAW_BUNDLED_PAYLOAD_ENV,
  listBundledOpenClawPayloadCandidates,
  resolveBundledOpenClawPayloadPath,
} from '../openclaw-bundled-payload'
import { buildTestEnv } from './test-env'

describe('listBundledOpenClawPayloadCandidates', () => {
  it('prefers an explicit env override before bundled resource candidates', () => {
    const candidates = listBundledOpenClawPayloadCandidates({
      version: '2026.3.24',
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      env: buildTestEnv({
        [OPENCLAW_BUNDLED_PAYLOAD_ENV]: 'D:\\payloads\\openclaw-custom.tgz',
      }),
    })

    expect(candidates[0]).toBe('D:\\payloads\\openclaw-custom.tgz')
    expect(candidates).toContain(
      'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\openclaw-2026.3.24.tgz'
    )
    expect(candidates).toContain('C:\\repo\\resources\\openclaw-bundle\\openclaw.tgz')
  })

  it('includes repo-local fallback candidates for development builds', () => {
    const candidates = listBundledOpenClawPayloadCandidates({
      version: '2026.3.24',
      cwd: '/workspace/mclaw',
      resourcesPath: '/workspace/mclaw/dist/resources',
      env: buildTestEnv(),
    })

    expect(candidates).toEqual([
      '/workspace/mclaw/dist/resources/openclaw-bundle/openclaw-2026.3.24.tgz',
      '/workspace/mclaw/dist/resources/openclaw-bundle/openclaw.tgz',
      '/workspace/mclaw/resources/openclaw-bundle/openclaw-2026.3.24.tgz',
      '/workspace/mclaw/resources/openclaw-bundle/openclaw.tgz',
      '/workspace/mclaw/openclaw-bundle/openclaw-2026.3.24.tgz',
      '/workspace/mclaw/openclaw-bundle/openclaw.tgz',
    ])
  })
})

describe('resolveBundledOpenClawPayloadPath', () => {
  it('returns the first existing candidate', () => {
    const resolved = resolveBundledOpenClawPayloadPath({
      version: '2026.3.24',
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      env: buildTestEnv(),
      exists: (candidatePath) =>
        candidatePath ===
        'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\openclaw-2026.3.24.tgz',
    })

    expect(resolved).toBe(
      'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\openclaw-2026.3.24.tgz'
    )
  })

  it('returns null when no bundled payload exists', () => {
    const resolved = resolveBundledOpenClawPayloadPath({
      version: '2026.3.24',
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      env: buildTestEnv(),
      exists: () => false,
    })

    expect(resolved).toBeNull()
  })
})
