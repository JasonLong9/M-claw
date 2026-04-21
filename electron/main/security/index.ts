/**
 * Security Module Main Exports
 * 安全模块主导出
 *
 * 这个文件统一导出安全模块的所有公共 API
 * 包括脱敏、白名单等子模块
 */

// ========== 类型定义 ==========
export type {
  // 脱敏相关
  RedactionRule,
  RedactionOptions,
  RedactionResult,
  SensitiveContentReport,
  SensitiveFieldInfo,
  AuditEntry,
  RedactionStatistics,

  // 白名单相关
  WhitelistEntry,
  WhitelistVerificationResult,
  WhitelistHistoryEntry,
  ValidationResult,

  // 安全策略相关
  SecurityPolicy,
  SecurityRule,
  SecurityEvent,
  PolicyEvaluationResult,
  EventFilter,
  SecurityReport,

  // 安全监控相关
  SecurityMonitorConfig,
  SecurityAlert,
  SecurityMetrics,
  AnomalyReport,

  // 违规相关
  RedactionViolation,
  WhitelistBreach
} from './types'

// ========== 导出枚举 ==========
export { RiskLevel, FieldCategory } from './types'

// ========== 导出工具函数 ==========
export { generateId } from './types'

// ========== 脱敏模块 ==========
export {
  // 核心服务
  RedactionService,
  redactionService,

  // 便捷函数
  redact,
  redactObject,
  scanSensitive,
  getRedactionStats,
  resetRedactionStats,
  getRedactionAuditLog,
  clearRedactionAuditLog,

  // 敏感字段
  SENSITIVE_FIELDS,
  FIELD_CATEGORIES,
  RISK_LEVELS,
  getSensitiveField,
  getFieldsByCategory,
  getFieldsByRiskLevel,
  getAllFieldIds,
  searchSensitiveFields,

  // 脱敏规则
  REDACTION_RULES,
  getRule,
  getEnabledRules,
  getRulesByContext,
  getRulesByPriority,
  enableRule,
  disableRule,
  updateRule,
  addCustomRule,
  removeRule,

  // 模块信息
  MODULE_VERSION as REDACTION_MODULE_VERSION,
  MODULE_DESCRIPTION as REDACTION_MODULE_DESCRIPTION,
  DEFAULT_CONFIG as REDACTION_DEFAULT_CONFIG
} from './redaction'

// ========== 白名单模块 ==========
export {
  // 核心服务
  WhitelistService,
  whitelistService,

  // 便捷函数
  verifyPlugin,
  verifySkill,
  verifyCapability,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelistStats,

  // 模块信息
  MODULE_VERSION as WHITELIST_MODULE_VERSION,
  MODULE_DESCRIPTION as WHITELIST_MODULE_DESCRIPTION,
  DEFAULT_CONFIG as WHITELIST_DEFAULT_CONFIG
} from './whitelist'

/**
 * 安全模块版本
 */
export const SECURITY_MODULE_VERSION = '1.0.0'

/**
 * 安全模块说明
 */
export const SECURITY_MODULE_DESCRIPTION = 'Mclaw Security Module - Comprehensive Security Solution'

/**
 * 安全模块功能列表
 */
export const SECURITY_FEATURES = [
  'Data Redaction',
  'Sensitive Data Detection',
  'Plugin Whitelist',
  'Skill Whitelist',
  'Capability Whitelist',
  'Audit Logging',
  'Security Monitoring',
  'Policy Enforcement'
] as const

/**
 * 获取安全模块信息
 */
export function getSecurityModuleInfo() {
  return {
    version: SECURITY_MODULE_VERSION,
    description: SECURITY_MODULE_DESCRIPTION,
    features: SECURITY_FEATURES,
    modules: {
      redaction: {
        version: '1.0.0',
        enabled: true
      },
      whitelist: {
        version: '1.0.0',
        enabled: true
      },
      policy: {
        version: '0.1.0',
        enabled: false // 待实现
      },
      monitoring: {
        version: '0.1.0',
        enabled: false // 待实现
      }
    },
    lastUpdated: new Date()
  }
}