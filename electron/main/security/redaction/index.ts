/**
 * Redaction Module Exports
 * 脱敏模块统一导出
 *
 * 这个文件统一导出脱敏模块的所有公共 API
 */

// ========== 核心服务 ==========
export { RedactionService, redactionService } from './redaction-service'

// ========== 便捷函数 ==========
export {
  redact,
  redactObject,
  scanSensitive,
  getRedactionStats,
  resetRedactionStats,
  getRedactionAuditLog,
  clearRedactionAuditLog
} from './redaction-service'

// ========== 类型定义 ==========
export type {
  RedactionRule,
  RedactionOptions,
  RedactionResult,
  SensitiveContentReport,
  SensitiveFieldInfo,
  AuditEntry,
  RedactionStatistics
} from '../types'

// ========== 敏感字段 ==========
export {
  SENSITIVE_FIELDS,
  FIELD_CATEGORIES,
  RISK_LEVELS,
  getSensitiveField,
  getFieldsByCategory,
  getFieldsByRiskLevel,
  getAllFieldIds,
  searchSensitiveFields
} from './sensitive-fields'

// ========== 脱敏规则 ==========
export {
  REDACTION_RULES,
  getRule,
  getEnabledRules,
  getRulesByContext,
  getRulesByPriority,
  enableRule,
  disableRule,
  updateRule,
  addCustomRule,
  removeRule
} from './redaction-rules'

// ========== 枚举类型 ==========
export { RiskLevel, FieldCategory } from '../types'

/**
 * 模块版本
 */
export const MODULE_VERSION = '1.0.0'

/**
 * 模块说明
 */
export const MODULE_DESCRIPTION = 'Mclaw Security - Redaction Module'

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  preserveLength: false,
  showFirstChar: false,
  showLastChar: false,
  customMask: '*',
  maxAuditLogSize: 1000
} as const