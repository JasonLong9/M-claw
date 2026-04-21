import { describe, expect, it, vi } from 'vitest'

vi.mock('../cli', () => ({
  runShell: vi.fn(),
}))

import {
  buildFeishuOfficialCliGuidedArgs,
  buildFeishuOfficialCliGuidedCommand,
  isMissingFeishuOfficialCliDetail,
  normalizeFeishuOfficialCliVersion,
} from '../feishu-official-cli'

describe('feishu official cli helpers', () => {
  it('builds guided onboarding commands from stable modes', () => {
    expect(buildFeishuOfficialCliGuidedArgs('config-init-new')).toEqual(['config', 'init', '--new'])
    expect(buildFeishuOfficialCliGuidedCommand('auth-login-recommend')).toEqual([
      'lark-cli',
      'auth',
      'login',
      '--recommend',
    ])
    expect(buildFeishuOfficialCliGuidedCommand('auth-login-no-wait')).toEqual([
      'lark-cli',
      'auth',
      'login',
      '--no-wait',
    ])
  })

  it('normalizes the version banner', () => {
    expect(normalizeFeishuOfficialCliVersion('lark-cli 1.2.3')).toBe('1.2.3')
    expect(normalizeFeishuOfficialCliVersion('version 2.0.0')).toBe('2.0.0')
  })

  it('detects missing-command diagnostics', () => {
    expect(isMissingFeishuOfficialCliDetail("'lark-cli' is not recognized as an internal or external command")).toBe(true)
    expect(isMissingFeishuOfficialCliDetail('Please login first.')).toBe(false)
  })
})
