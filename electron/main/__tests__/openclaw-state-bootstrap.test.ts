import { afterEach, describe, expect, it } from 'vitest'
const fs = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

import {
  ensureRequiredOpenClawStateDirs,
  listRequiredOpenClawStateDirs,
  listRequiredOpenClawStateFiles,
  repairManagedOpenClawStateLayout,
} from '../openclaw-state-bootstrap'
import { resolveOpenClawPaths } from '../openclaw-paths'
import { migrateAuthProfile } from '../local-model-probe'

describe('openclaw state bootstrap', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true }))
    )
  })

  it('lists the legacy 2026.3.24 state directories that gateway health expects', () => {
    expect(listRequiredOpenClawStateDirs('C:\\Users\\James\\.openclaw')).toEqual([
      'C:\\Users\\James\\.openclaw\\identity',
      'C:\\Users\\James\\.openclaw\\credentials',
      'C:\\Users\\James\\.openclaw\\agents\\main\\sessions',
    ])
  })

  it('lists the legacy device identity file required by old gateway health checks', () => {
    expect(listRequiredOpenClawStateFiles('C:\\Users\\James\\.openclaw')).toEqual([
      'C:\\Users\\James\\.openclaw\\identity\\device.json',
    ])
  })

  it('creates the required directories and the placeholder device identity file', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qclaw-openclaw-state-'))
    tempDirs.push(homeDir)

    const result = await ensureRequiredOpenClawStateDirs(homeDir)

    expect(result.ensuredDirs).toHaveLength(3)
    expect(result.ensuredFiles).toEqual([path.join(homeDir, 'identity', 'device.json')])
    await expect(fs.readFile(path.join(homeDir, 'identity', 'device.json'), 'utf8')).resolves.toBe('{}\n')
  })

  it('works with the Mclaw-managed userData state root layout', async () => {
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qclaw-user-data-'))
    tempDirs.push(userDataDir)
    const paths = resolveOpenClawPaths({
      userDataDir,
      userHomeDir: '/Users/tester',
      platform: 'darwin',
    })

    const result = await ensureRequiredOpenClawStateDirs(paths.homeDir)

    expect(result.ensuredDirs).toContain(path.join(userDataDir, 'openclaw-state', 'identity'))
    await expect(fs.readFile(path.join(userDataDir, 'openclaw-state', 'identity', 'device.json'), 'utf8')).resolves.toBe('{}\n')
  })

  it('lifts a mistakenly nested managed layout back into the expected Mclaw-owned paths', async () => {
    const managedHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qclaw-managed-openclaw-home-'))
    tempDirs.push(managedHomeDir)

    const managedStateRoot = path.join(managedHomeDir, '.openclaw')
    const nestedStateRoot = path.join(managedStateRoot, '.openclaw')
    await fs.mkdir(path.join(nestedStateRoot, 'agents', 'main', 'agent'), { recursive: true })
    await fs.writeFile(path.join(managedStateRoot, 'openclaw.json'), '{"agents":{"defaults":{"model":{"primary":"deepseek/deepseek-chat"}}}}', 'utf8')
    await fs.writeFile(path.join(nestedStateRoot, 'agents', 'main', 'agent', 'auth-profiles.json'), '{"version":1,"profiles":{}}', 'utf8')

    const result = await repairManagedOpenClawStateLayout(managedHomeDir)

    expect(result.repairedPaths).toContain(path.join(managedHomeDir, 'openclaw.json'))
    expect(result.repairedPaths).toContain(path.join(managedStateRoot, 'agents'))
    expect(result.quarantinedPaths).toContain(path.join(managedStateRoot, '__redundant_nested_openclaw__'))
    await expect(fs.readFile(path.join(managedHomeDir, 'openclaw.json'), 'utf8')).resolves.toContain('deepseek/deepseek-chat')
    await expect(
      fs.readFile(path.join(managedStateRoot, 'agents', 'main', 'agent', 'auth-profiles.json'), 'utf8')
    ).resolves.toContain('"profiles"')
    await expect(fs.access(path.join(managedStateRoot, '.openclaw'))).rejects.toBeDefined()
  })

  it('merges missing auth files even when the canonical managed agents tree already exists', async () => {
    const managedHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qclaw-managed-openclaw-home-'))
    tempDirs.push(managedHomeDir)

    const managedStateRoot = path.join(managedHomeDir, '.openclaw')
    const nestedStateRoot = path.join(managedStateRoot, '.openclaw')
    await fs.mkdir(path.join(managedStateRoot, 'agents', 'main', 'sessions'), { recursive: true })
    await fs.mkdir(path.join(nestedStateRoot, 'agents', 'main', 'agent'), { recursive: true })
    await fs.writeFile(path.join(nestedStateRoot, 'agents', 'main', 'agent', 'auth-profiles.json'), '{"version":1,"profiles":{"custom-openai:local":{"provider":"custom-openai","key":"sk-test"}}}', 'utf8')

    const result = await repairManagedOpenClawStateLayout(managedHomeDir)

    expect(result.repairedPaths).toContain(
      path.join(managedStateRoot, 'agents', 'main', 'agent', 'auth-profiles.json')
    )
    expect(result.quarantinedPaths).toContain(path.join(managedStateRoot, '__redundant_nested_openclaw__'))
    await expect(
      fs.readFile(path.join(managedStateRoot, 'agents', 'main', 'agent', 'auth-profiles.json'), 'utf8')
    ).resolves.toContain('"custom-openai:local"')
  })

  it('keeps deepseek migration path valid after lifting nested managed auth profiles', async () => {
    const managedHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qclaw-managed-openclaw-home-'))
    tempDirs.push(managedHomeDir)

    const managedStateRoot = path.join(managedHomeDir, '.openclaw')
    const nestedStateRoot = path.join(managedStateRoot, '.openclaw')
    const canonicalAuthPath = path.join(managedStateRoot, 'agents', 'main', 'agent', 'auth-profiles.json')

    await fs.mkdir(path.join(managedStateRoot, 'agents', 'main', 'sessions'), { recursive: true })
    await fs.mkdir(path.join(nestedStateRoot, 'agents', 'main', 'agent'), { recursive: true })
    await fs.writeFile(
      path.join(nestedStateRoot, 'agents', 'main', 'agent', 'auth-profiles.json'),
      '{"version":1,"profiles":{"custom-openai:local":{"type":"api_key","provider":"custom-openai","key":"sk-deepseek-live"}},"lastGood":{"custom-openai":"custom-openai:local"},"usageStats":{}}',
      'utf8'
    )

    await repairManagedOpenClawStateLayout(managedHomeDir)

    const migrateResult = await migrateAuthProfile({
      fromProvider: 'custom-openai',
      toProvider: 'deepseek',
      fromProfileId: 'custom-openai:local',
      toProfileId: 'deepseek:default',
      deleteSourceProfile: true,
      authStorePath: canonicalAuthPath,
    })

    expect(migrateResult.ok).toBe(true)
    expect(migrateResult.migrated).toBe(true)

    const canonicalData = JSON.parse(await fs.readFile(canonicalAuthPath, 'utf8'))
    expect(canonicalData.profiles['deepseek:default']).toMatchObject({
      provider: 'deepseek',
      key: 'sk-deepseek-live',
    })
    expect(canonicalData.profiles['custom-openai:local']).toBeUndefined()
    await expect(fs.access(path.join(managedStateRoot, '.openclaw'))).rejects.toBeDefined()
  })

  it('returns an empty list when the home dir is unavailable', () => {
    expect(listRequiredOpenClawStateDirs('')).toEqual([])
    expect(listRequiredOpenClawStateFiles('')).toEqual([])
  })
})
