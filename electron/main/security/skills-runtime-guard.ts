const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const { readFileSync } = process.getBuiltinModule('node:fs') as typeof import('node:fs')

export type SkillRuntimeEventType =
  | 'exec'
  | 'file_write'
  | 'file_read_sensitive'
  | 'network_external'
  | 'env_sensitive_access'

export interface SkillRuntimeEvent {
  skillSlug: string
  type: SkillRuntimeEventType
  detail?: string
  timestamp: string
}

interface SkillRuntimePolicy {
  version: string
  riskThreshold: number
  eventWeights: Record<SkillRuntimeEventType, number>
}

const POLICY_PATH = path.resolve(process.cwd(), 'resources', 'security', 'skills-runtime-policy.json')
const riskBySkill = new Map<string, number>()
const disabledSkills = new Set<string>()
const recentEvents: SkillRuntimeEvent[] = []
const MAX_EVENTS = 1000

function normalizeSkillSlug(slug: string): string {
  return String(slug || '').trim().toLowerCase()
}

function loadPolicy(): SkillRuntimePolicy {
  try {
    const raw = readFileSync(POLICY_PATH, 'utf8')
    const parsed = JSON.parse(raw) as SkillRuntimePolicy
    if (!parsed || !parsed.eventWeights || typeof parsed.riskThreshold !== 'number') {
      throw new Error('invalid runtime policy')
    }
    return parsed
  } catch {
    return {
      version: 'fallback',
      riskThreshold: 100,
      eventWeights: {
        exec: 60,
        file_write: 35,
        file_read_sensitive: 30,
        network_external: 40,
        env_sensitive_access: 45,
      },
    }
  }
}

export function recordSkillRuntimeEvent(input: {
  skillSlug: string
  type: SkillRuntimeEventType
  detail?: string
}): { blocked: boolean; currentRisk: number; threshold: number } {
  const policy = loadPolicy()
  const slug = normalizeSkillSlug(input.skillSlug)
  if (!slug) {
    return { blocked: true, currentRisk: Number.MAX_SAFE_INTEGER, threshold: policy.riskThreshold }
  }

  const weight = policy.eventWeights[input.type] || 0
  const currentRisk = (riskBySkill.get(slug) || 0) + weight
  riskBySkill.set(slug, currentRisk)

  recentEvents.push({
    skillSlug: slug,
    type: input.type,
    detail: input.detail,
    timestamp: new Date().toISOString(),
  })
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_EVENTS)
  }

  if (currentRisk >= policy.riskThreshold) {
    disabledSkills.add(slug)
  }

  return {
    blocked: disabledSkills.has(slug),
    currentRisk,
    threshold: policy.riskThreshold,
  }
}

export function isSkillRuntimeDisabled(skillSlug: string): boolean {
  return disabledSkills.has(normalizeSkillSlug(skillSlug))
}

export function getSkillRuntimeRiskSummary(): {
  riskBySkill: Record<string, number>
  disabledSkills: string[]
  recentEvents: SkillRuntimeEvent[]
} {
  const riskObject: Record<string, number> = {}
  for (const [key, value] of riskBySkill.entries()) {
    riskObject[key] = value
  }
  return {
    riskBySkill: riskObject,
    disabledSkills: Array.from(disabledSkills),
    recentEvents: recentEvents.slice(-200),
  }
}

