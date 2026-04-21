import { describe, expect, it } from 'vitest'

import {
  buildFeishuInstallerManagedOpenClawEnv,
  resolveFeishuInstallerManagedOpenClawHomeEnvRoot,
} from '../feishu-installer-env'

describe('resolveFeishuInstallerManagedOpenClawHomeEnvRoot', () => {
  it('derives the managed OPENCLAW_HOME root from a config file stored under .openclaw', () => {
    expect(
      resolveFeishuInstallerManagedOpenClawHomeEnvRoot({
        homeDir: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw',
        configFile: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw\\openclaw.json',
      })
    ).toBe('C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state')
  })

  it('falls back to the parent directory when only the .openclaw home dir is known', () => {
    expect(
      resolveFeishuInstallerManagedOpenClawHomeEnvRoot({
        homeDir: '/tmp/mclaw-openclaw/.openclaw',
      })
    ).toBe('/tmp/mclaw-openclaw')
  })
})

describe('buildFeishuInstallerManagedOpenClawEnv', () => {
  it('injects the managed OpenClaw env keys required by the official installer', () => {
    expect(
      buildFeishuInstallerManagedOpenClawEnv({
        baseEnv: {} as unknown as NodeJS.ProcessEnv,
        openClawPaths: {
          homeDir: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw',
          configFile: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw\\openclaw.json',
        },
      })
    ).toMatchObject({
      OPENCLAW_HOME: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state',
      OPENCLAW_STATE_DIR: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw',
      OPENCLAW_CONFIG_PATH: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw\\openclaw.json',
    })
  })

  it('preserves explicit env overrides when they are already present', () => {
    expect(
      buildFeishuInstallerManagedOpenClawEnv({
        baseEnv: {
          OPENCLAW_HOME: 'D:\\custom-home-root',
          OPENCLAW_STATE_DIR: 'D:\\custom-home-root\\.openclaw',
          OPENCLAW_CONFIG_PATH: 'D:\\custom-home-root\\.openclaw\\openclaw.json',
        } as unknown as NodeJS.ProcessEnv,
        openClawPaths: {
          homeDir: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw',
          configFile: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw\\openclaw.json',
        },
      })
    ).toMatchObject({
      OPENCLAW_HOME: 'D:\\custom-home-root',
      OPENCLAW_STATE_DIR: 'D:\\custom-home-root\\.openclaw',
      OPENCLAW_CONFIG_PATH: 'D:\\custom-home-root\\.openclaw\\openclaw.json',
    })
  })
})
