/**
 * Security Module Types
 * 安全模块类型定义
 *
 * 基于 Mclaw 代码库的审计结果，定义所有敏感字段和脱敏相关的类型
 */

/**
 * 风险等级
 */
export enum RiskLevel {
  LOW = 'LOW',           // 低风险：一般个人信息
  MEDIUM = 'MEDIUM',     // 中风险：业务信息、令牌等
  HIGH = 'HIGH',         // 高风险：凭证类信息
  CRITICAL = 'CRITICAL'  // 严重风险：核心凭证、支付信息等
}

/**
 * 字段分类
 */
export enum FieldCategory {
  CREDENTIALS = 'credentials',      // 凭证类（API Key、App Secret等）
  PERSONAL_INFO = 'personal-info',  // 个人信息（邮箱、手机号等）
  TOKEN = 'token',                  // 令牌类（JWT、OAuth Token等）
  PAYMENT = 'payment',              // 支付信息（银行卡、信用卡等）
  SYSTEM = 'system',                // 系统信息（路径、IP、端口等）
  BUSINESS = 'business'             // 业务敏感信息（App ID、Installation ID等）
}

/**
 * 敏感字段定义
 */
export interface SensitiveField {
  id: string
  name: string
  category: FieldCategory
  riskLevel: RiskLevel
  patterns: string[]
  contexts: string[]
  description: string
  examples: string[]
}

/**
 * 脱敏规则
 */
export interface RedactionRule {
  id: string
  name: string
  pattern: RegExp | string
  replacement: string
  context?: string[]  // 应用上下文（如 'log', 'ui', 'api-response'）
  priority: number
  enabled: boolean
}

/**
 * 脱敏选项
 */
export interface RedactionOptions {
  context?: string[]
  preserveLength?: boolean
  showFirstChar?: boolean
  showLastChar?: boolean
  customMask?: string
}

/**
 * 脱敏结果
 */
export interface RedactionResult {
  original: string
  redacted: any
  matchedRules: string[]
  sensitiveFields: string[]
  stats: RedactionStatistics
}

/**
 * 敏感内容报告
 */
export interface SensitiveContentReport {
  hasSensitiveData: boolean
  detectedFields: Array<{
    fieldName: string
    matchCount: number
    sampleMatches: string[]
    riskLevel: RiskLevel
  }>
  recommendation: string
  riskLevel: RiskLevel
}

/**
 * 敏感内容字段信息
 */
export interface SensitiveFieldInfo {
  fieldName: string
  matchCount: number
  sampleMatches: string[]
  riskLevel: RiskLevel
}

/**
 * 审计日志条目
 */
export interface AuditEntry {
  timestamp: Date
  originalLength: number
  redactedLength: number
  matchedRules: string[]
  sensitiveFields: string[]
  context: string[]
  duration: number
}

/**
 * 脱敏统计信息
 */
export interface RedactionStatistics {
  totalMatches: number
  totalRedactions: number
  rulesUsed: Record<string, number>
  fieldsDetected: Record<string, number>
  lastReset: Date
}

/**
 * 白名单条目
 */
export interface WhitelistEntry {
  id: string
  name: string
  type: 'plugin' | 'skill' | 'capability'
  allowedSources: string[]    // 允许的安装来源
  allowedPaths: string[]      // 允许的安装路径
  hash?: string               // 内容哈希验证
  signature?: string          // 签名验证
  version: string
  author?: string
  description?: string
  requiredPermissions: string[]
  enabled: boolean
  lastUpdated: Date
}

/**
 * 白名单验证结果
 */
export interface WhitelistVerificationResult {
  allowed: boolean
  reason?: string
  violations?: string[]
  recommendedActions: string[]
}

/**
 * 白名单历史条目
 */
export interface WhitelistHistoryEntry {
  version: string
  timestamp: Date
  changes: {
    added: string[]
    removed: string[]
    modified: string[]
  }
  author: string
  comment?: string
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean
  errors: Array<{
    entryId: string
    error: string
    severity: 'error' | 'warning'
  }>
}

/**
 * 安全策略
 */
export interface SecurityPolicy {
  id: string
  name: string
  version: string
  rules: SecurityRule[]
  defaultAction: 'allow' | 'deny' | 'audit'
  enabled: boolean
}

/**
 * 安全规则
 */
export interface SecurityRule {
  id: string
  type: 'input-validation' | 'output-redaction' | 'access-control' | 'audit-logging'
  condition: string | ((context: any) => boolean)
  action: 'allow' | 'deny' | 'redact' | 'log' | 'alert'
  priority: number
  enabled: boolean
}

/**
 * 安全事件
 */
export interface SecurityEvent {
  id: string
  timestamp: Date
  type: 'security-violation' | 'policy-breached' | 'sensitive-access' | 'audit'
  severity: 'info' | 'warning' | 'error' | 'critical'
  source: string
  message: string
  details: Record<string, any>
  userId?: string
  sessionId?: string
}

/**
 * 策略评估结果
 */
export interface PolicyEvaluationResult {
  allowed: boolean
  matchedRules: string[]
  actions: Array<{
    type: string
    description: string
  }>
  warnings: string[]
}

/**
 * 事件过滤器
 */
export interface EventFilter {
  type?: string
  severity?: string
  source?: string
  startTime?: Date
  endTime?: Date
  userId?: string
}

/**
 * 安全报告
 */
export interface SecurityReport {
  period: { start: Date; end: Date }
  totalEvents: number
  eventsByType: Record<string, number>
  eventsBySeverity: Record<string, number>
  topSources: Array<{ source: string; count: number }>
  violations: SecurityEvent[]
  recommendations: string[]
}

/**
 * 安全监控配置
 */
export interface SecurityMonitorConfig {
  enabled: boolean
  checkInterval: number
  alertThresholds: {
    sensitiveAccessRate: number
    failedAttempts: number
    unusualActivityThreshold: number
  }
}

/**
 * 安全警报
 */
export interface SecurityAlert {
  id: string
  timestamp: Date
  type: 'sensitive-data-exposure' | 'unauthorized-access' | 'policy-violation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: Record<string, any>
  remediation: string
  acknowledged: boolean
  dismissed: boolean
}

/**
 * 安全指标
 */
export interface SecurityMetrics {
  totalEvents: number
  eventsByType: Record<string, number>
  eventsBySeverity: Record<string, number>
  redactionCount: number
  whitelistViolations: number
  policyBreaches: number
  lastCheck: Date
}

/**
 * 异常报告
 */
export interface AnomalyReport {
  period: { start: Date; end: Date }
  anomalies: Array<{
    type: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    detectedAt: Date
    evidence: any
  }>
  recommendations: string[]
}

/**
 * 脱敏违规
 */
export interface RedactionViolation {
  id: string
  timestamp: Date
  ruleId: string
  sensitiveData: string
  context: string
  severity: RiskLevel
}

/**
 * 白名单违规
 */
export interface WhitelistBreach {
  id: string
  timestamp: Date
  entryType: 'plugin' | 'skill' | 'capability'
  entryId: string
  source: string
  path: string
  reason: string
  severity: RiskLevel
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}