export function mapSkillSecurityErrorToMessage(input: {
  securityErrorCode?: string
  stderr?: string
}): string {
  const code = String(input.securityErrorCode || '').trim()
  if (!code) return String(input.stderr || '').trim()
  switch (code) {
    case 'SKILL_RUNTIME_DISABLED':
      return '该 Skill 因运行时风险过高已被自动禁用，请先在安全状态中查看风险后再操作。'
    case 'WHITELIST_INTEGRITY_INVALID':
      return '技能白名单完整性校验失败，请刷新安全策略或恢复策略文件后重试。'
    case 'SKILL_NOT_WHITELISTED':
      return '该 Skill 不在官方白名单中，已被安全策略拦截。'
    case 'SOURCE_NOT_ALLOWED':
      return '该 Skill 来源不在允许列表中，已被安全策略拦截。'
    case 'SKILL_SLUG_INVALID':
      return 'Skill 标识格式无效，请检查后重试。'
    default:
      return String(input.stderr || '').trim()
  }
}

