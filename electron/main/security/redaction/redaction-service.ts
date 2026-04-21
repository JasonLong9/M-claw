/**
 * Redaction Service
 * 脱敏服务核心实现
 *
 * 基于 Mclaw 代码库的真实审计结果，实现核心的脱敏功能
 * 特别针对 CLI 输出、错误消息、配置读取等场景
 */

import {
  RedactionRule,
  RedactionOptions,
  RedactionResult,
  SensitiveContentReport,
  SensitiveFieldInfo,
  AuditEntry,
  RedactionStatistics,
  RiskLevel
} from '../types'

import { REDACTION_RULES, getRulesByContext } from './redaction-rules'
import { SENSITIVE_FIELDS, RISK_LEVELS } from './sensitive-fields'

/**
 * 脱敏服务类
 */
export class RedactionService {
  private rules: Map<string, RedactionRule>
  private auditLog: AuditEntry[]
  private statistics: RedactionStatistics
  private maxAuditLogSize: number

  constructor() {
    this.rules = new Map()
    this.auditLog = []
    this.statistics = {
      totalMatches: 0,
      totalRedactions: 0,
      rulesUsed: {},
      fieldsDetected: {},
      lastReset: new Date()
    }
    this.maxAuditLogSize = 1000

    // 初始化默认规则
    this.initializeDefaultRules()
  }

  /**
   * 核心脱敏方法
   *
   * @param input 输入内容（字符串或对象）
   * @param options 脱敏选项
   * @returns 脱敏结果
   */
  redact(input: string | object, options: RedactionOptions = {}): RedactionResult {
    const startTime = Date.now()
    const original = typeof input === 'string' ? input : JSON.stringify(input, null, 2)
    let redacted = original
    const matchedRules: string[] = []
    const sensitiveFields: string[] = []

    // 获取适用的规则
    const applicableRules = this.getApplicableRules(options.context)

    // 应用每个规则
    for (const rule of applicableRules) {
      let pattern: RegExp
      if (typeof rule.pattern === 'string') {
        // 检查字符串中是否已包含内联标志（如 (?i)）
        const hasInlineFlags = /^\(\?[a-z]+\)/.test(rule.pattern)
        if (hasInlineFlags) {
          // 移除内联标志，改为构造函数标志
          const cleanPattern = rule.pattern.replace(/^\(\?[a-z]+\)/, '')
          pattern = new RegExp(cleanPattern, 'gi')
        } else {
          pattern = new RegExp(rule.pattern, 'g')
        }
      } else {
        pattern = rule.pattern
      }

      let matchCount = 0
      redacted = redacted.replace(pattern, (match, ...groups) => {
        matchCount++
        if (!matchedRules.includes(rule.id)) {
          matchedRules.push(rule.id)
        }

        // 提取敏感字段值
        if (groups.length > 0) {
          const sensitiveValue = groups[groups.length - 1]
          if (!sensitiveFields.includes(sensitiveValue)) {
            sensitiveFields.push(sensitiveValue)
          }
        }

        return this.applyReplacement(match, rule, options)
      })

      // 更新统计
      if (matchCount > 0) {
        this.statistics.totalMatches += matchCount
        this.statistics.totalRedactions += matchCount
        this.statistics.rulesUsed[rule.id] =
          (this.statistics.rulesUsed[rule.id] || 0) + matchCount
      }
    }

    // 如果是对象输入，尝试解析回去
    let result: any = redacted
    if (typeof input === 'object') {
      try {
        result = JSON.parse(redacted)
      } catch (e) {
        // 如果解析失败，返回字符串
        result = redacted
      }
    }

    // 记录审计日志
    this.recordAudit({
      timestamp: new Date(),
      originalLength: original.length,
      redactedLength: redacted.length,
      matchedRules,
      sensitiveFields,
      context: options.context || [],
      duration: Date.now() - startTime
    })

    return {
      original,
      redacted: result,
      matchedRules,
      sensitiveFields,
      stats: { ...this.statistics }
    }
  }

  /**
   * 批量脱敏
   *
   * @param inputs 输入内容数组
   * @param options 脱敏选项
   * @returns 脱敏结果数组
   */
  redactBatch(inputs: Array<string | object>, options?: RedactionOptions): RedactionResult[] {
    return inputs.map(input => this.redact(input, options))
  }

  /**
   * 扫描敏感内容（用于日志导出前检测）
   *
   * @param content 要扫描的内容
   * @returns 敏感内容报告
   */
  scanForSensitiveContent(content: string): SensitiveContentReport {
    const detectedFields: SensitiveFieldInfo[] = []
    let hasSensitiveData = false

    // 扫描每个敏感字段类型
    for (const [fieldId, fieldDef] of Object.entries(SENSITIVE_FIELDS)) {
      const matches: string[] = []

      for (const pattern of fieldDef.patterns) {
        let regex: RegExp
        // 检查字符串中是否已包含内联标志（如 (?i)）
        const hasInlineFlags = /^\(\?[a-z]+\)/.test(pattern)
        if (hasInlineFlags) {
          // 移除内联标志，改为构造函数标志
          const cleanPattern = pattern.replace(/^\(\?[a-z]+\)/, '')
          regex = new RegExp(cleanPattern, 'gi')
        } else {
          regex = new RegExp(pattern, 'gi')
        }
        
        let match
        while ((match = regex.exec(content)) !== null) {
          matches.push(match[0])
          if (matches.length >= 3) break  // 最多收集3个样本
        }
        if (matches.length >= 3) break
      }

      if (matches.length > 0) {
        hasSensitiveData = true
        detectedFields.push({
          fieldName: fieldDef.name,
          matchCount: matches.length,
          sampleMatches: matches,
          riskLevel: fieldDef.riskLevel
        })
      }
    }

    // 评估整体风险等级
    const maxRisk = detectedFields.reduce((maxIndex, field) => {
      const riskOrder = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]
      const currentIndex = riskOrder.indexOf(field.riskLevel)
      return Math.max(maxIndex, currentIndex)
    }, 0)

    const riskLevels = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]
    const overallRisk = riskLevels[maxRisk]

    // 生成建议
    let recommendation = '内容安全，可以导出'
    if (hasSensitiveData) {
      if (overallRisk === RiskLevel.CRITICAL) {
        recommendation = '发现高风险敏感信息，强烈建议应用脱敏后再导出'
      } else if (overallRisk === RiskLevel.HIGH) {
        recommendation = '发现敏感信息，建议应用脱敏后再导出'
      } else {
        recommendation = '发现少量敏感信息，建议应用脱敏后导出'
      }
    }

    return {
      hasSensitiveData,
      detectedFields,
      recommendation,
      riskLevel: overallRisk
    }
  }

  /**
   * 添加规则
   *
   * @param rule 要添加的规则
   */
  addRule(rule: RedactionRule): void {
    this.rules.set(rule.id, rule)
  }

  /**
   * 移除规则
   *
   * @param ruleId 规则 ID
   * @returns 是否成功移除
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId)
  }

  /**
   * 更新规则
   *
   * @param ruleId 规则 ID
   * @param updates 更新内容
   * @returns 是否成功更新
   */
  updateRule(ruleId: string, updates: Partial<RedactionRule>): boolean {
    const rule = this.rules.get(ruleId)
    if (rule) {
      Object.assign(rule, updates)
      return true
    }
    return false
  }

  /**
   * 获取所有规则
   *
   * @returns 规则列表
   */
  getRules(): RedactionRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * 获取启用的规则
   *
   * @returns 启用的规则列表
   */
  getEnabledRules(): RedactionRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.enabled)
  }

  /**
   * 启用规则
   *
   * @param ruleId 规则 ID
   * @returns 是否成功启用
   */
  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId)
    if (rule) {
      rule.enabled = true
      return true
    }
    return false
  }

  /**
   * 禁用规则
   *
   * @param ruleId 规则 ID
   * @returns 是否成功禁用
   */
  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId)
    if (rule) {
      rule.enabled = false
      return true
    }
    return false
  }

  /**
   * 获取审计日志
   *
   * @param timeRange 时间范围
   * @returns 审计日志条目
   */
  getAuditLog(timeRange?: { start: Date; end: Date }): AuditEntry[] {
    if (!timeRange) {
      return [...this.auditLog]
    }

    return this.auditLog.filter(entry =>
      entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
    )
  }

  /**
   * 获取统计信息
   *
   * @returns 统计信息
   */
  getStatistics(): RedactionStatistics {
    return { ...this.statistics }
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.statistics = {
      totalMatches: 0,
      totalRedactions: 0,
      rulesUsed: {},
      fieldsDetected: {},
      lastReset: new Date()
    }
  }

  /**
   * 清空审计日志
   */
  clearAuditLog(): void {
    this.auditLog = []
  }

  /**
   * 应用替换策略
   *
   * @param match 匹配的文本
   * @param rule 脱敏规则
   * @param options 脱敏选项
   * @returns 替换后的文本
   */
  private applyReplacement(
    match: string,
    rule: RedactionRule,
    options: RedactionOptions
  ): string {
    const {
      preserveLength = false,
      showFirstChar = false,
      showLastChar = false,
      customMask = '*'
    } = options

    // 如果规则定义了替换字符串，使用它
    if (rule.replacement) {
      return rule.replacement
    }

    // 默认脱敏策略
    if (preserveLength) {
      let masked = customMask.repeat(match.length)

      if (showFirstChar) {
        masked = match[0] + masked.slice(1)
      }
      if (showLastChar) {
        masked = masked.slice(0, -1) + match[match.length - 1]
      }

      return masked
    } else {
      // 不保留长度，使用固定掩码
      return customMask.repeat(3)  // 默认显示 ***
    }
  }

  /**
   * 获取适用的规则
   *
   * @param contexts 上下文列表
   * @returns 适用的规则列表（按优先级排序）
   */
  private getApplicableRules(contexts?: string[]): RedactionRule[] {
    const rules = Array.from(this.rules.values()).filter(rule => rule.enabled)

    if (!contexts || contexts.length === 0) {
      return rules.sort((a, b) => b.priority - a.priority)
    }

    // 筛选符合上下文的规则
    return rules
      .filter(rule => {
        if (!rule.context || rule.context.length === 0) {
          return true
        }
        return rule.context.some(ctx => contexts.includes(ctx))
      })
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * 初始化默认规则
   */
  private initializeDefaultRules(): void {
    for (const rule of REDACTION_RULES) {
      this.rules.set(rule.id, { ...rule })
    }
  }

  /**
   * 记录审计日志
   *
   * @param entry 审计日志条目
   */
  private recordAudit(entry: AuditEntry): void {
    this.auditLog.push(entry)

    // 限制审计日志大小
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditLogSize)
    }
  }
}

/**
 * 导出单例实例
 */
export const redactionService = new RedactionService()

/**
 * 导出便捷函数
 */

/**
 * 快速脱敏字符串
 */
export function redact(input: string, options?: RedactionOptions): RedactionResult {
  return redactionService.redact(input, options)
}

/**
 * 快速脱敏对象
 */
export function redactObject(input: object, options?: RedactionOptions): RedactionResult {
  return redactionService.redact(input, options)
}

/**
 * 快速扫描敏感内容
 */
export function scanSensitive(content: string): SensitiveContentReport {
  return redactionService.scanForSensitiveContent(content)
}

/**
 * 获取统计信息
 */
export function getRedactionStats(): RedactionStatistics {
  return redactionService.getStatistics()
}

/**
 * 重置统计信息
 */
export function resetRedactionStats(): void {
  redactionService.resetStatistics()
}

/**
 * 获取审计日志
 */
export function getRedactionAuditLog(timeRange?: { start: Date; end: Date }): AuditEntry[] {
  return redactionService.getAuditLog(timeRange)
}

/**
 * 清空审计日志
 */
export function clearRedactionAuditLog(): void {
  redactionService.clearAuditLog()
}