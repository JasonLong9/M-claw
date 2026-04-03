import { describe, expect, it } from 'vitest'
import { resolveBundledOpenClawInstallPlan } from '../openclaw-bundled-plan'
import { buildTestEnv } from './test-env'

function buildManifest(defaultDeliveryMode: 'bundled-runtime' | 'bundled-fallback' | 'online-fallback') {
  return JSON.stringify({
    schemaVersion: 1,
    product: 'Mclaw',
    openclawVersion: '2026.3.24',
    defaultDeliveryMode,
    targetDeliveryMode: 'bundled-runtime',
    artifacts: {
      tgz: {
        fileName: 'openclaw-2026.3.24.tgz',
        version: '2026.3.24',
      },
      runtime: [
        {
          platform: 'win32',
          arch: 'x64',
          directoryName: 'windows-x64',
          version: '2026.3.24',
        },
        {
          platform: 'darwin',
          arch: 'arm64',
          directoryName: 'darwin-arm64',
          version: '2026.3.24',
        },
      ],
    },
  })
}

describe('resolveBundledOpenClawInstallPlan', () => {
  it('prefers bundled-runtime when runtime binary is present', () => {
    const plan = resolveBundledOpenClawInstallPlan({
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      platform: 'win32',
      arch: 'x64',
      env: buildTestEnv(),
      readFile: () => buildManifest('bundled-runtime'),
      exists: (candidatePath) =>
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json' ||
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64' ||
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd',
    })

    expect(plan.preferredSource).toBe('bundled-runtime')
    expect(plan.runtimeBinaryPath).toBe(
      'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd'
    )
    expect(plan.payloadPath).toBeNull()
  })

  it('falls back to bundled-fallback when only tgz payload is present', () => {
    const plan = resolveBundledOpenClawInstallPlan({
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      platform: 'win32',
      arch: 'x64',
      env: buildTestEnv(),
      readFile: () => buildManifest('bundled-fallback'),
      exists: (candidatePath) =>
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json' ||
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\openclaw-2026.3.24.tgz',
    })

    expect(plan.preferredSource).toBe('bundled-fallback')
    expect(plan.payloadPath).toBe('C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\openclaw-2026.3.24.tgz')
    expect(plan.runtimeBinaryPath).toBeNull()
  })

  it('falls back to online-fallback when no bundled artifacts are present', () => {
    const plan = resolveBundledOpenClawInstallPlan({
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      platform: 'darwin',
      arch: 'arm64',
      env: buildTestEnv(),
      readFile: () => buildManifest('bundled-fallback'),
      exists: (candidatePath) =>
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json',
    })

    expect(plan.preferredSource).toBe('online-fallback')
    expect(plan.warnings).toContain('No bundled runtime binary or tgz payload found for darwin-arm64.')
  })
})
