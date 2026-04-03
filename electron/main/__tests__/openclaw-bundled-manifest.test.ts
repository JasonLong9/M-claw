import { describe, expect, it } from 'vitest'
import {
  OPENCLAW_BUNDLED_MANIFEST_ENV,
  inspectBundledOpenClawDeliveryStatus,
  listBundledOpenClawRuntimeBinaryCandidates,
  listBundledOpenClawManifestCandidates,
  readBundledOpenClawManifest,
  resolveBundledOpenClawRuntimeBinaryPath,
  resolveBundledOpenClawManifestPath,
} from '../openclaw-bundled-manifest'
import { buildTestEnv } from './test-env'

describe('listBundledOpenClawManifestCandidates', () => {
  it('prefers an explicit manifest env override before bundled resource candidates', () => {
    const candidates = listBundledOpenClawManifestCandidates({
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      env: buildTestEnv({
        [OPENCLAW_BUNDLED_MANIFEST_ENV]: 'D:\\payloads\\manifest.json',
      }),
    })

    expect(candidates[0]).toBe('D:\\payloads\\manifest.json')
    expect(candidates).toContain('C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json')
    expect(candidates).toContain('C:\\repo\\resources\\openclaw-bundle\\manifest.json')
  })
})

describe('resolveBundledOpenClawManifestPath', () => {
  it('returns the first existing manifest candidate', () => {
    const resolved = resolveBundledOpenClawManifestPath({
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      env: buildTestEnv(),
      exists: (candidatePath) =>
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json',
    })

    expect(resolved).toBe('C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json')
  })
})

describe('readBundledOpenClawManifest', () => {
  it('parses a valid manifest', () => {
    const result = readBundledOpenClawManifest({
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      env: buildTestEnv(),
      exists: () => true,
      readFile: () =>
        JSON.stringify({
          schemaVersion: 1,
          product: 'Mclaw',
          openclawVersion: '2026.3.24',
          defaultDeliveryMode: 'bundled-fallback',
          targetDeliveryMode: 'bundled-runtime',
          artifacts: {
            tgz: {
              fileName: 'openclaw-2026.3.24.tgz',
              version: '2026.3.24',
            },
          },
          notes: ['runtime bundle planned'],
        }),
    })

    expect(result.error).toBeUndefined()
    expect(result.manifest?.targetDeliveryMode).toBe('bundled-runtime')
    expect(result.manifest?.artifacts.tgz?.fileName).toBe('openclaw-2026.3.24.tgz')
  })

  it('returns an error for an invalid manifest payload', () => {
    const result = readBundledOpenClawManifest({
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      env: buildTestEnv(),
      exists: () => true,
      readFile: () => JSON.stringify({ schemaVersion: 1 }),
    })

    expect(result.manifest).toBeNull()
    expect(result.error).toContain('invalid')
  })
})

describe('bundled runtime binary resolution', () => {
  it('lists Windows runtime binary candidates in a stable order', () => {
    const candidates = listBundledOpenClawRuntimeBinaryCandidates({
      runtimePath: 'C:\\payloads\\runtime\\windows-x64',
      platform: 'win32',
    })

    expect(candidates).toEqual([
      'C:\\payloads\\runtime\\windows-x64\\openclaw.cmd',
      'C:\\payloads\\runtime\\windows-x64\\openclaw.ps1',
      'C:\\payloads\\runtime\\windows-x64\\openclaw',
      'C:\\payloads\\runtime\\windows-x64\\bin\\openclaw.cmd',
      'C:\\payloads\\runtime\\windows-x64\\bin\\openclaw.ps1',
      'C:\\payloads\\runtime\\windows-x64\\bin\\openclaw',
    ])
  })

  it('resolves macOS runtime binary candidates from root or bin layout', () => {
    const result = resolveBundledOpenClawRuntimeBinaryPath({
      runtimePath: '/Applications/Mclaw/resources/openclaw-bundle/runtime/darwin-arm64',
      platform: 'darwin',
      exists: (candidatePath) => candidatePath.endsWith('/bin/openclaw'),
    })

    expect(result).toBe('/Applications/Mclaw/resources/openclaw-bundle/runtime/darwin-arm64/bin/openclaw')
  })

  it('inspects delivery status including runtime binary path', () => {
    const status = inspectBundledOpenClawDeliveryStatus({
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      platform: 'win32',
      arch: 'x64',
      env: buildTestEnv(),
      exists: (candidatePath) =>
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json' ||
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64' ||
        candidatePath === 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd',
      readFile: () =>
        JSON.stringify({
          schemaVersion: 1,
          product: 'Mclaw',
          openclawVersion: '2026.3.24',
          defaultDeliveryMode: 'bundled-runtime',
          targetDeliveryMode: 'bundled-runtime',
          artifacts: {
            tgz: null,
            runtime: [
              {
                platform: 'win32',
                arch: 'x64',
                directoryName: 'windows-x64',
                version: '2026.3.24',
              },
            ],
          },
        }),
    })

    expect(status.runtimeArtifact?.directoryName).toBe('windows-x64')
    expect(status.runtimePath).toBe('C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64')
    expect(status.runtimeBinaryPath).toBe(
      'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd'
    )
  })
})
