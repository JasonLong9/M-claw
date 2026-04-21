/**
 * Redaction Rules Definition
 * 脱敏规则定义
 *
 * 基于 Mclaw 代码库的真实审计结果，定义所有脱敏规则
 */

import { RedactionRule } from '../types'

/**
 * 默认脱敏规则
 *
 * 每个规则包含：
 * - id: 唯一标识符
 * - name: 规则名称
 * - pattern: 正则表达式或字符串模式
 * - replacement: 替换字符串（空字符串表示使用默认掩码）
 * - context: 应用上下文（如 'log', 'ui', 'api-response'）
 * - priority: 优先级（数字越大优先级越高）
 * - enabled: 是否启用
 */
export const REDACTION_RULES: RedactionRule[] = [
  // ==================== 高优先级规则（凭证类）====================

  {
    id: 'redact-openai-key',
    name: 'OpenAI API Key 脱敏',
    pattern: 'sk-[a-zA-Z0-9_\\-]{5,64}',
    replacement: '[OPENAI_API_KEY]',
    context: ['config', 'config-read', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    priority: 100,
    enabled: true
  },

  {
    id: 'redact-api-key',
    name: 'API Key 脱敏',
    pattern: '(api[_\\s-]?key|apikey)["\'\\s:=]+\\s*([a-zA-Z0-9_\\-]{16,64})',
    replacement: '[API_KEY]',
    context: ['config', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    priority: 90,
    enabled: true
  },

  {
    id: 'redact-anthropic-key',
    name: 'Anthropic API Key 脱敏',
    pattern: 'sk-ant-[a-zA-Z0-9]{32,64}',
    replacement: '[ANTHROPIC_API_KEY]',
    context: ['config', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    priority: 98,
    enabled: true
  },

  {
    id: 'redact-google-key',
    name: 'Google API Key 脱敏',
    pattern: 'AIza[a-zA-Z0-9_-]{32}',
    replacement: '[GOOGLE_API_KEY]',
    context: ['config', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    priority: 97,
    enabled: true
  },

  {
    id: 'redact-app-secret',
    name: 'App Secret 脱敏',
    pattern: '(?i)(?:app[_\\s-]?secret)["\'\\s:=]+\\s*([a-zA-Z0-9_\\-]{12,64})',
    replacement: '[APP_SECRET]',
    context: ['config', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    priority: 96,
    enabled: true
  },

  {
    id: 'redact-client-secret',
    name: 'Client Secret 脱敏',
    pattern: '(?i)(?:client[_\\s-]?secret)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,64})',
    replacement: '[CLIENT_SECRET]',
    context: ['config', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    priority: 95,
    enabled: true
  },

  {
    id: 'redact-password',
    name: '密码脱敏',
    pattern: '(?i)(password|pwd|passwd|密码)["\':\\s:=]+\\s*([^\\s]{6,64})',
    replacement: '[PASSWORD]',
    context: ['config', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    priority: 98,
    enabled: true
  },

  {
    id: 'redact-password-json',
    name: '密码 JSON 脱敏',
    pattern: '"password"\\s*:\\s*"([^"]{6,64})"',
    replacement: '"password": "[PASSWORD]"',
    context: ['config', 'config-read'],
    priority: 99,
    enabled: true
  },

  // ==================== 令牌类规则 ====================

  {
    id: 'redact-gateway-token',
    name: 'Gateway Token 脱敏',
    pattern: '(?i)(?:gateway[_\\s-]?auth[_\\s-]?token)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,128})',
    replacement: '[GATEWAY_TOKEN]',
    context: ['config', 'log', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    priority: 94,
    enabled: true
  },

  {
    id: 'redact-bearer-token',
    name: 'Bearer Token 脱敏',
    pattern: 'Bearer\\s+([a-zA-Z0-9_\\-\\.]{20,256})',
    replacement: '[BEARER_TOKEN]',
    context: ['authorization', 'api-request', 'api-response', 'log', 'cli-output'],
    priority: 93,
    enabled: true
  },

  {
    id: 'redact-access-token',
    name: 'Access Token 脱敏',
    pattern: '(?i)(access[_-]?token)["\'\\s:=]+([a-zA-Z0-9_\\-\\.]{20,256})',
    replacement: '[ACCESS_TOKEN]',
    context: ['config', 'log', 'api-request', 'api-response', 'cli-output'],
    priority: 92,
    enabled: true
  },

  {
    id: 'redact-jwt',
    name: 'JWT Token 脱敏',
    pattern: '[a-zA-Z0-9_\\-]{20,64}',
    replacement: '[JWT_TOKEN]',
    context: ['authorization', 'api-request', 'api-response', 'cookie', 'log', 'cli-output'],
    priority: 91,
    enabled: true
  },

  {
    id: 'redact-session-token',
    name: 'Session Token 脱敏',
    pattern: '(?i)(session[_-]?token|sessionid)["\'\\s:=]+([a-zA-Z0-9_\\-]{20,128})',
    replacement: '[SESSION_TOKEN]',
    context: ['cookie', 'api-request', 'api-response', 'log', 'cli-output'],
    priority: 90,
    enabled: true
  },

  // ==================== 业务敏感信息规则 ====================

  {
    id: 'redact-app-id',
    name: 'App ID 脱敏',
    pattern: '(?i)(app[_-]?id)["\'\\s:=]+([a-zA-Z0-9_\\-]{8,32})',
    replacement: '[APP_ID]',
    context: ['config', 'log', 'ui', 'api-response', 'api-request'],
    priority: 80,
    enabled: true
  },

  {
    id: 'redact-feishu-app-id',
    name: '飞书 App ID 脱敏',
    pattern: 'cli_[a-zA-Z0-9]{32}',
    replacement: '[FEISHU_APP_ID]',
    context: ['config', 'log', 'ui', 'api-response', 'api-request'],
    priority: 79,
    enabled: true
  },

  {
    id: 'redact-installation-id',
    name: 'Installation ID 脱敏',
    pattern: '(?i)(installation[_-]?id)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,64})',
    replacement: '[INSTALLATION_ID]',
    context: ['config', 'log', 'api-response'],
    priority: 78,
    enabled: true
  },

  // ==================== 个人信息类规则（中优先级）====================

  {
    id: 'redact-email',
    name: '邮箱地址脱敏',
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    replacement: '[EMAIL]',
    context: ['log', 'ui', 'chat-response', 'api-response', 'cli-output'],
    priority: 70,
    enabled: true
  },

  {
    id: 'redact-phone',
    name: '手机号码脱敏',
    pattern: '1[3-9]\\d{9}',
    replacement: '[PHONE]',
    context: ['log', 'ui', 'chat-response', 'api-response'],
    priority: 69,
    enabled: true
  },

  // ==================== 系统信息类规则（低优先级）====================

  {
    id: 'redact-file-path',
    name: '文件路径脱敏',
    pattern: '[a-zA-Z]:\\\\[^\\s:*?"<>|]+|\\\\\\\\[^\\s:*?"<>|]+|/[^\\s:*?"<>|]+',
    replacement: '[FILE_PATH]',
    context: ['log', 'api-request', 'config', 'cli-output'],
    priority: 60,
    enabled: true
  },

  {
    id: 'redact-ip-address',
    name: 'IP地址脱敏',
    pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    replacement: '[IP_ADDRESS]',
    context: ['log', 'api-request', 'api-response', 'cli-output'],
    priority: 59,
    enabled: true
  },

  {
    id: 'redact-port',
    name: '端口号脱敏',
    pattern: ':[0-9]{1,5}\\b',
    replacement: '[PORT]',
    context: ['log', 'api-request', 'config', 'cli-output'],
    priority: 58,
    enabled: true
  }
]

/**
 * 根据规则 ID 获取规则
 */
export function getRule(ruleId: string): RedactionRule | undefined {
  return REDACTION_RULES.find(rule => rule.id === ruleId)
}

/**
 * 获取启用的规则
 */
export function getEnabledRules(): RedactionRule[] {
  return REDACTION_RULES.filter(rule => rule.enabled)
}

/**
 * 根据上下文获取规则
 */
export function getRulesByContext(context: string): RedactionRule[] {
  return REDACTION_RULES.filter(
    rule =>
      rule.enabled &&
      (!rule.context || rule.context.length === 0 || rule.context.includes(context))
  )
}

/**
 * 根据优先级范围获取规则
 */
export function getRulesByPriority(minPriority: number, maxPriority?: number): RedactionRule[] {
  return REDACTION_RULES.filter(rule => {
    if (!rule.enabled) return false
    if (maxPriority !== undefined) {
      return rule.priority >= minPriority && rule.priority <= maxPriority
    }
    return rule.priority >= minPriority
  })
}

/**
 * 启用规则
 */
export function enableRule(ruleId: string): boolean {
  const rule = getRule(ruleId)
  if (rule) {
    rule.enabled = true
    return true
  }
  return false
}

/**
 * 禁用规则
 */
export function disableRule(ruleId: string): boolean {
  const rule = getRule(ruleId)
  if (rule) {
    rule.enabled = false
    return true
  }
  return false
}

/**
 * 更新规则
 */
export function updateRule(ruleId: string, updates: Partial<RedactionRule>): boolean {
  const rule = getRule(ruleId)
  if (rule) {
    Object.assign(rule, updates)
    return true
  }
  return false
}

/**
 * 添加自定义规则
 */
export function addCustomRule(rule: RedactionRule): void {
  const existingIndex = REDACTION_RULES.findIndex(r => r.id === rule.id)
  if (existingIndex >= 0) {
    REDACTION_RULES[existingIndex] = rule
  } else {
    REDACTION_RULES.push(rule)
  }
}

/**
 * 移除规则
 */
export function removeRule(ruleId: string): boolean {
  const index = REDACTION_RULES.findIndex(rule => rule.id === ruleId)
  if (index >= 0) {
    REDACTION_RULES.splice(index, 1)
    return true
  }
  return false
}
