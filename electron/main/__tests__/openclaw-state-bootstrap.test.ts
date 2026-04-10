import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  ensureRequiredOpenClawStateDirs,
  listRequiredOpenClawStateDirs,
  listRequiredOpenClawStateFiles,
} from '../openclaw-state-bootstrap'

describe('openclaw state bootstrap', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dirPath) => rm(dirPath, { recursive: true, force: true }))
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
    const homeDir = await mkdtemp(join(tmpdir(), 'qclaw-openclaw-state-'))
    tempDirs.push(homeDir)

    const result = await ensureRequiredOpenClawStateDirs(homeDir)

    expect(result.ensuredDirs).toHaveLength(3)
    expect(result.ensuredFiles).toEqual([join(homeDir, 'identity', 'device.json')])
    await expect(readFile(join(homeDir, 'identity', 'device.json'), 'utf8')).resolves.toBe('{}\n')
  })

  it('returns an empty list when the home dir is unavailable', () => {
    expect(listRequiredOpenClawStateDirs('')).toEqual([])
    expect(listRequiredOpenClawStateFiles('')).toEqual([])
  })
})
