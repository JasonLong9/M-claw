import { describe, expect, it } from 'vitest'

import {
  buildOpenClawCompatibilityBlockingReasonLabel,
  buildOpenClawConservativeCompatibilityGuidance,
  buildOpenClawFutureCandidateGuidance,
  FUTURE_CANDIDATE_OPENCLAW_RELEASE_LINE,
  MAX_SUPPORTED_OPENCLAW_VERSION,
  MIN_SUPPORTED_OPENCLAW_VERSION,
  PINNED_OPENCLAW_VERSION,
  classifyOpenClawVersionLockState,
  isFutureCandidateOpenClawVersion,
  resolveOpenClawTargetVersionLabel,
  resolveOpenClawVersionEnforcement,
  supportsPinnedOpenClawCorrection,
} from '../openclaw-version-policy'

describe('openclaw version policy', () => {
  it('classifies versions against the fixed supported window', () => {
    expect(MIN_SUPPORTED_OPENCLAW_VERSION).toBe('2026.3.22')
    expect(MAX_SUPPORTED_OPENCLAW_VERSION).toBe('2026.3.24')
    expect(PINNED_OPENCLAW_VERSION).toBe('2026.3.24')
    expect(classifyOpenClawVersionLockState('2026.3.21')).toBe('below_min')
    expect(classifyOpenClawVersionLockState('2026.3.22')).toBe('supported_not_target')
    expect(classifyOpenClawVersionLockState('2026.3.23')).toBe('supported_not_target')
    expect(classifyOpenClawVersionLockState('2026.3.24')).toBe('supported_target')
    expect(classifyOpenClawVersionLockState('2026.3.25')).toBe('above_max')
  })

  it('normalizes loose release tags before classifying', () => {
    expect(classifyOpenClawVersionLockState('v2026.3.24-2')).toBe('supported_target')
  })

  it('exposes the current future-candidate release line explicitly', () => {
    expect(FUTURE_CANDIDATE_OPENCLAW_RELEASE_LINE).toBe('2026.4.x')
    expect(isFutureCandidateOpenClawVersion('2026.4.6')).toBe(true)
    expect(isFutureCandidateOpenClawVersion('v2026.4.7-1')).toBe(true)
    expect(isFutureCandidateOpenClawVersion('2026.3.24')).toBe(false)
  })

  it('falls back to the pinned target label when no explicit target version is present', () => {
    expect(resolveOpenClawTargetVersionLabel('2026.4.6')).toBe('2026.4.6')
    expect(resolveOpenClawTargetVersionLabel(null)).toBe('2026.3.24')
    expect(resolveOpenClawTargetVersionLabel('')).toBe('2026.3.24')
  })

  it('builds consistent candidate-line and conservative-mode guidance', () => {
    expect(buildOpenClawFutureCandidateGuidance('2026.4.6')).toContain('2026.4.x 候选线')
    expect(buildOpenClawFutureCandidateGuidance('2026.4.6')).toContain('记忆目录、Agent 协同与升级回退迁移验证')
    expect(buildOpenClawConservativeCompatibilityGuidance('2026.4.6')).toContain('当前仍按保守兼容模式处理')
    expect(buildOpenClawCompatibilityBlockingReasonLabel('2026.4.6')).toContain('已进入 2026.4.x 候选线')
    expect(buildOpenClawCompatibilityBlockingReasonLabel('2026.4.6')).toContain('当前仍按保守兼容模式处理')
    expect(buildOpenClawConservativeCompatibilityGuidance('2026.3.28')).toBe(
      '2026.3.28 超出当前审计范围，当前仍按保守兼容模式处理。'
    )
    expect(buildOpenClawCompatibilityBlockingReasonLabel('2026.3.28')).toBe('当前本机运行组件版本超出已审计范围')
  })

  it('only auto-corrects sources that can be safely pinned in place', () => {
    expect(supportsPinnedOpenClawCorrection('npm-global')).toBe(true)
    expect(supportsPinnedOpenClawCorrection('nvm')).toBe(true)
    expect(supportsPinnedOpenClawCorrection('custom')).toBe(false)
    expect(supportsPinnedOpenClawCorrection('unknown')).toBe(false)
    expect(
      supportsPinnedOpenClawCorrection('homebrew', {
        packageRoot: '/tmp/homebrew/lib/node_modules/openclaw',
      })
    ).toBe(true)
    expect(
      supportsPinnedOpenClawCorrection('homebrew', {
        packageRoot: '/opt/homebrew/Cellar/openclaw/2026.3.25/libexec/lib/node_modules/openclaw',
      })
    ).toBe(false)
  })

  it('treats malformed versions as manual-blocked instead of auto-correctable', () => {
    expect(
      resolveOpenClawVersionEnforcement({
        version: 'openclaw 2026.3.25 (custom build)',
        installSource: 'npm-global',
      })
    ).toMatchObject({
      enforcement: 'manual_block',
      targetAction: 'none',
      targetVersion: '2026.3.24',
      blocksContinue: true,
      canSelfHeal: false,
    })
  })

  it('resolves explicit enforcement for the supported range and out-of-range installs', () => {
    expect(
      resolveOpenClawVersionEnforcement({
        version: '2026.3.21',
        installSource: 'npm-global',
      })
    ).toMatchObject({
      policyState: 'below_min',
      enforcement: 'auto_correct',
      targetAction: 'upgrade',
      targetVersion: '2026.3.24',
      blocksContinue: true,
      canSelfHeal: true,
    })

    expect(
      resolveOpenClawVersionEnforcement({
        version: '2026.3.23',
        installSource: 'npm-global',
      })
    ).toMatchObject({
      policyState: 'supported_not_target',
      enforcement: 'optional_upgrade',
      targetAction: 'upgrade',
      targetVersion: '2026.3.24',
      blocksContinue: false,
      canSelfHeal: true,
    })

    expect(
      resolveOpenClawVersionEnforcement({
        version: '2026.3.23',
        installSource: 'custom',
      })
    ).toMatchObject({
      policyState: 'supported_not_target',
      enforcement: 'manual_block',
      targetAction: 'upgrade',
      targetVersion: '2026.3.24',
      blocksContinue: false,
      canSelfHeal: false,
    })

    expect(
      resolveOpenClawVersionEnforcement({
        version: '2026.3.24',
        installSource: 'npm-global',
      })
    ).toMatchObject({
      policyState: 'supported_target',
      enforcement: 'none',
      targetAction: 'none',
      targetVersion: null,
      blocksContinue: false,
      canSelfHeal: false,
    })

    expect(
      resolveOpenClawVersionEnforcement({
        version: '2026.3.25',
        installSource: 'npm-global',
      })
    ).toMatchObject({
      policyState: 'above_max',
      enforcement: 'auto_correct',
      targetAction: 'downgrade',
      targetVersion: '2026.3.24',
      blocksContinue: true,
      canSelfHeal: true,
    })

    expect(
      resolveOpenClawVersionEnforcement({
        version: '2026.3.25',
        installSource: 'custom',
      })
    ).toMatchObject({
      policyState: 'above_max',
      enforcement: 'manual_block',
      targetAction: 'downgrade',
      targetVersion: '2026.3.24',
      blocksContinue: true,
      canSelfHeal: false,
    })
  })
})
