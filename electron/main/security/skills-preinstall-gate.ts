import {
  verifySkillInstallRequest,
  type SkillInstallSource,
  type SkillInstallVerificationResult,
} from './skills-install-security'
import { scanInstalledSkillBySlug, type SkillStaticScanResult } from './skills-static-scanner'
import { runSkillDynamicSandboxProbe, type SkillDynamicSandboxResult } from './skills-dynamic-sandbox'

export type SkillPreinstallVerdict = 'allow' | 'warn' | 'block'

export interface SkillPreinstallDecision {
  allowed: boolean
  verdict: SkillPreinstallVerdict
  reason: string
  errorCode?: string
  policy: SkillInstallVerificationResult
  staticScan: SkillStaticScanResult | null
  dynamicProbe: SkillDynamicSandboxResult | null
}

function buildDefaultReason(verdict: SkillPreinstallVerdict): string {
  if (verdict === 'block') return '安装前安全检测未通过，已阻止安装。'
  if (verdict === 'warn') return '安装前检测发现中风险行为，建议确认后再安装。'
  return '安装前安全检测通过。'
}

export async function evaluateSkillPreinstallRisk(input: {
  slug: string
  source: SkillInstallSource
  installPath?: string
  enableStaticScan?: boolean
  enableDynamicProbe?: boolean
}): Promise<SkillPreinstallDecision> {
  const policy = verifySkillInstallRequest({
    slug: input.slug,
    source: input.source,
    installPath: input.installPath || 'skills',
  })
  if (!policy.allowed) {
    return {
      allowed: false,
      verdict: 'block',
      reason: policy.reason || '安装前策略校验失败。',
      errorCode: policy.errorCode || 'SKILL_INSTALL_BLOCKED',
      policy,
      staticScan: null,
      dynamicProbe: null,
    }
  }

  const staticScan = input.enableStaticScan === false ? null : await scanInstalledSkillBySlug(input.slug)
  const dynamicProbe = input.enableDynamicProbe === false ? null : await runSkillDynamicSandboxProbe(input.slug)

  if (staticScan?.blocked) {
    return {
      allowed: false,
      verdict: 'block',
      reason: '静态扫描发现高危行为（critical），已阻止安装。',
      errorCode: 'SKILL_STATIC_SCAN_BLOCKED',
      policy,
      staticScan,
      dynamicProbe,
    }
  }

  if (dynamicProbe?.verdict === 'block') {
    return {
      allowed: false,
      verdict: 'block',
      reason: '动态探测风险评分过高，已阻止安装。',
      errorCode: 'SKILL_DYNAMIC_PROBE_BLOCKED',
      policy,
      staticScan,
      dynamicProbe,
    }
  }

  if (dynamicProbe?.verdict === 'warn') {
    return {
      allowed: true,
      verdict: 'warn',
      reason: buildDefaultReason('warn'),
      policy,
      staticScan,
      dynamicProbe,
    }
  }

  return {
    allowed: true,
    verdict: 'allow',
    reason: buildDefaultReason('allow'),
    policy,
    staticScan,
    dynamicProbe,
  }
}
