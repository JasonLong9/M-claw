/**
 * Whitelist Service
 * 白名单服务核心实现
 *
 * 基于 Mclaw 代码库的真实审计结果，实现白名单管理功能
 * 特别针对插件安装流程，添加白名单验证机制
 */

import {
  WhitelistEntry,
  WhitelistVerificationResult,
  WhitelistHistoryEntry,
  ValidationResult
} from '../types'

/**
 * 白名单服务类
 */
export class WhitelistService {
  private pluginWhitelist: Map<string, WhitelistEntry>
  private skillWhitelist: Map<string, WhitelistEntry>
  private capabilityWhitelist: Map<string, WhitelistEntry>
  private version: string
  private history: WhitelistHistoryEntry[]
  private readonly maxHistorySize: number = 100

  constructor() {
    this.pluginWhitelist = new Map()
    this.skillWhitelist = new Map()
    this.capabilityWhitelist = new Map()
    this.version = '1.0.0'
    this.history = []

    // 初始化默认白名单
    this.initializeDefaultWhitelists()
  }

  /**
   * 验证插件
   *
   * @param pluginId 插件 ID
   * @param source 安装来源
   * @param path 安装路径
   * @returns 验证结果
   */
  verifyPlugin(pluginId: string, source: string, path: string): WhitelistVerificationResult {
    const entry = this.pluginWhitelist.get(pluginId)

    if (!entry) {
      return {
        allowed: false,
        reason: '插件不在白名单中',
        violations: ['插件未在白名单中注册'],
        recommendedActions: [
          '联系管理员添加插件到白名单',
          '确认插件 ID 是否正确',
          '检查是否使用官方插件渠道'
        ]
      }
    }

    if (!entry.enabled) {
      return {
        allowed: false,
        reason: `插件 "${pluginId}" 已被禁用`,
        violations: ['插件已被禁用'],
        recommendedActions: ['联系管理员启用该插件']
      }
    }

    // 验证来源
    if (!this.isSourceAllowed(entry, source)) {
      return {
        allowed: false,
        reason: `插件 "${pluginId}" 的来源 "${source}" 不被允许`,
        violations: [`来源 "${source}" 不在允许的来源列表中`],
        recommendedActions: ['使用官方渠道安装插件', '联系管理员更新白名单']
      }
    }

    // 验证路径
    if (!this.isPathAllowed(entry, path)) {
      return {
        allowed: false,
        reason: `插件 "${pluginId}" 的安装路径 "${path}" 不被允许`,
        violations: [`路径 "${path}" 不在允许的路径列表中`],
        recommendedActions: ['使用官方推荐路径安装', '联系管理员更新白名单']
      }
    }

    return {
      allowed: true,
      reason: '插件在白名单中',
      violations: [],
      recommendedActions: []
    }
  }

  /**
   * 验证技能
   *
   * @param skillId 技能 ID
   * @param source 安装来源
   * @param path 安装路径
   * @returns 验证结果
   */
  verifySkill(skillId: string, source: string, path: string): WhitelistVerificationResult {
    const entry = this.skillWhitelist.get(skillId)

    if (!entry) {
      return {
        allowed: false,
        reason: `技能 "${skillId}" 不在白名单中`,
        violations: ['技能未在白名单中注册'],
        recommendedActions: [
          '联系管理员添加技能到白名单',
          '确认技能 ID 是否正确',
          '检查是否使用官方技能仓库'
        ]
      }
    }

    if (!entry.enabled) {
      return {
        allowed: false,
        reason: `技能 "${skillId}" 已被禁用`,
        violations: ['技能已被禁用'],
        recommendedActions: ['联系管理员启用该技能']
      }
    }

    // 验证来源
    if (!this.isSourceAllowed(entry, source)) {
      return {
        allowed: false,
        reason: `技能 "${skillId}" 的来源 "${source}" 不被允许`,
        violations: [`来源 "${source}" 不在允许的来源列表中`],
        recommendedActions: ['使用官方渠道安装技能', '联系管理员更新白名单']
      }
    }

    // 验证路径
    if (!this.isPathAllowed(entry, path)) {
      return {
        allowed: false,
        reason: `技能 "${skillId}" 的安装路径 "${path}" 不被允许`,
        violations: [`路径 "${path}" 不在允许的路径列表中`],
        recommendedActions: ['使用官方推荐路径安装', '联系管理员更新白名单']
      }
    }

    return {
      allowed: true,
      reason: '技能验证通过',
      violations: [],
      recommendedActions: []
    }
  }

  /**
   * 验证能力
   *
   * @param capability 能力标识
   * @param context 上下文
   * @returns 验证结果
   */
  verifyCapability(capability: string, context: string): WhitelistVerificationResult {
    const entry = this.capabilityWhitelist.get(capability)

    if (!entry) {
      return {
        allowed: false,
        reason: `能力 "${capability}" 不在白名单中`,
        violations: ['能力未在白名单中注册'],
        recommendedActions: [
          '联系管理员添加能力到白名单',
          '确认能力标识是否正确',
          '检查该能力是否需要特殊权限'
        ]
      }
    }

    if (!entry.enabled) {
      return {
        allowed: false,
        reason: `能力 "${capability}" 已被禁用`,
        violations: ['能力已被禁用'],
        recommendedActions: ['联系管理员启用该能力']
      }
    }

    // 验证上下文（如果需要）
    // 这里可以根据业务需求添加额外的上下文验证逻辑

    return {
      allowed: true,
      reason: '能力验证通过',
      violations: [],
      recommendedActions: []
    }
  }

  /**
   * 添加到白名单
   *
   * @param entry 白名单条目
   */
  addToWhitelist(entry: WhitelistEntry): void {
    const whitelist = this.getWhitelistMapByType(entry.type)
    whitelist.set(entry.id, entry)

    // 更新版本
    this.updateVersion()
  }

  /**
   * 从白名单中移除
   *
   * @param entryId 条目 ID
   * @returns 是否成功移除
   */
  removeFromWhitelist(entryId: string): boolean {
    let removed = false

    for (const whitelist of [this.pluginWhitelist, this.skillWhitelist, this.capabilityWhitelist]) {
      if (whitelist.delete(entryId)) {
        removed = true
        break
      }
    }

    if (removed) {
      this.updateVersion()
    }

    return removed
  }

  /**
   * 更新白名单条目
   *
   * @param entryId 条目 ID
   * @param updates 更新内容
   * @returns 是否成功更新
   */
  updateWhitelistEntry(entryId: string, updates: Partial<WhitelistEntry>): boolean {
    for (const whitelist of [this.pluginWhitelist, this.skillWhitelist, this.capabilityWhitelist]) {
      const entry = whitelist.get(entryId)
      if (entry) {
        Object.assign(entry, updates, { lastUpdated: new Date() })
        this.updateVersion()
        return true
      }
    }
    return false
  }

  /**
   * 根据类型获取白名单
   *
   * @param type 白名单类型
   * @returns 白名单条目列表
   */
  getWhitelistByType(type: 'plugin' | 'skill' | 'capability'): WhitelistEntry[] {
    const whitelist = this.getWhitelistMapByType(type)
    return Array.from(whitelist.values())
  }

  /**
   * 根据 ID 获取条目
   *
   * @param entryId 条目 ID
   * @returns 白名单条目
   */
  getEntryById(entryId: string): WhitelistEntry | undefined {
    for (const whitelist of [this.pluginWhitelist, this.skillWhitelist, this.capabilityWhitelist]) {
      const entry = whitelist.get(entryId)
      if (entry) {
        return entry
      }
    }
    return undefined
  }

  /**
   * 搜索白名单
   *
   * @param query 搜索关键词
   * @returns 匹配的白名单条目列表
   */
  searchWhitelist(query: string): WhitelistEntry[] {
    const lowerQuery = query.toLowerCase()
    const results: WhitelistEntry[] = []

    for (const whitelist of [this.pluginWhitelist, this.skillWhitelist, this.capabilityWhitelist]) {
      for (const entry of whitelist.values()) {
        if (
          entry.name.toLowerCase().includes(lowerQuery) ||
          entry.id.toLowerCase().includes(lowerQuery) ||
          (entry.description && entry.description.toLowerCase().includes(lowerQuery)) ||
          (entry.author && entry.author.toLowerCase().includes(lowerQuery))
        ) {
          results.push(entry)
        }
      }
    }

    return results
  }

  /**
   * 获取当前版本
   *
   * @returns 版本号
   */
  getCurrentVersion(): string {
    return this.version
  }

  /**
   * 获取历史记录
   *
   * @param limit 返回记录数量限制
   * @returns 历史记录列表
   */
  getHistory(limit?: number): WhitelistHistoryEntry[] {
    if (limit) {
      return this.history.slice(-limit)
    }
    return [...this.history]
  }

  /**
   * 验证白名单一致性
   *
   * @returns 验证结果
   */
  validateWhitelistConsistency(): ValidationResult {
    const errors: Array<{
      entryId: string
      error: string
      severity: 'error' | 'warning'
    }> = []

    // 检查重复 ID
    const allIds = new Set<string>()
    for (const whitelist of [this.pluginWhitelist, this.skillWhitelist, this.capabilityWhitelist]) {
      for (const entry of whitelist.values()) {
        if (allIds.has(entry.id)) {
          errors.push({
            entryId: entry.id,
            error: `重复的 ID: ${entry.id}`,
            severity: 'error'
          })
        }
        allIds.add(entry.id)
      }
    }

    // 检查必需字段
    for (const whitelist of [this.pluginWhitelist, this.skillWhitelist, this.capabilityWhitelist]) {
      for (const entry of whitelist.values()) {
        if (!entry.name) {
          errors.push({
            entryId: entry.id,
            error: '缺少 name 字段',
            severity: 'error'
          })
        }
        if (!entry.version) {
          errors.push({
            entryId: entry.id,
            error: '缺少 version 字段',
            severity: 'warning'
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 获取白名单统计信息
   *
   * @returns 统计信息
   */
  getStatistics() {
    return {
      version: this.version,
      totalEntries:
        this.pluginWhitelist.size + this.skillWhitelist.size + this.capabilityWhitelist.size,
      pluginCount: this.pluginWhitelist.size,
      skillCount: this.skillWhitelist.size,
      capabilityCount: this.capabilityWhitelist.size,
      enabledEntries: this.getEnabledCount(),
      lastUpdated: this.getLastUpdated()
    }
  }

  // ========== 私有方法 ==========

  /**
   * 检查来源是否允许
   */
  private isSourceAllowed(entry: WhitelistEntry, source: string): boolean {
    if (!entry.allowedSources || entry.allowedSources.length === 0) {
      return true // 如果没有指定允许的来源，则允许所有来源
    }
    return entry.allowedSources.some(allowed => source.includes(allowed))
  }

  /**
   * 检查路径是否允许
   */
  private isPathAllowed(entry: WhitelistEntry, path: string): boolean {
    if (!entry.allowedPaths || entry.allowedPaths.length === 0) {
      return true // 如果没有指定允许的路径，则允许所有路径
    }
    return entry.allowedPaths.some(allowed => path.includes(allowed))
  }

  /**
   * 根据类型获取白名单 Map
   */
  private getWhitelistMapByType(type: 'plugin' | 'skill' | 'capability'): Map<string, WhitelistEntry> {
    switch (type) {
      case 'plugin':
        return this.pluginWhitelist
      case 'skill':
        return this.skillWhitelist
      case 'capability':
        return this.capabilityWhitelist
      default:
        throw new Error(`Unknown whitelist type: ${type}`)
    }
  }

  /**
   * 更新版本号
   */
  private updateVersion(): void {
    const oldVersion = this.version
    this.version = this.incrementVersion(this.version)

    // 记录历史
    this.history.push({
      version: this.version,
      timestamp: new Date(),
      changes: {
        added: [],
        removed: [],
        modified: []
      },
      author: 'system',
      comment: `从版本 ${oldVersion} 升级`
    })

    // 限制历史记录大小
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize)
    }
  }

  /**
   * 递增版本号
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number)
    parts[2] += 1 // 递增补丁版本号
    return parts.join('.')
  }

  /**
   * 获取启用的条目数量
   */
  private getEnabledCount(): number {
    let count = 0
    for (const whitelist of [this.pluginWhitelist, this.skillWhitelist, this.capabilityWhitelist]) {
      for (const entry of whitelist.values()) {
        if (entry.enabled) {
          count++
        }
      }
    }
    return count
  }

  /**
   * 获取最后更新时间
   */
  private getLastUpdated(): Date | null {
    let lastUpdated: Date | null = null
    for (const whitelist of [this.pluginWhitelist, this.skillWhitelist, this.capabilityWhitelist]) {
      for (const entry of whitelist.values()) {
        if (!lastUpdated || entry.lastUpdated > lastUpdated) {
          lastUpdated = entry.lastUpdated
        }
      }
    }
    return lastUpdated
  }

  /**
   * 初始化默认白名单
   */
  private initializeDefaultWhitelists(): void {
    // 初始化飞书官方插件白名单
    this.addToWhitelist({
      id: 'openclaw-lark',
      name: '飞书官方插件',
      type: 'plugin',
      allowedSources: ['https://npm.openclaw.com', 'https://registry.npmjs.org'],
      allowedPaths: [],
      version: '1.0.0',
      author: 'OpenClaw Team',
      description: '飞书官方插件，提供飞书机器人集成能力',
      requiredPermissions: ['message.send', 'message.read'],
      enabled: true,
      lastUpdated: new Date()
    })

    // 初始化基础能力白名单
    this.addToWhitelist({
      id: 'chat.send',
      name: '发送聊天消息',
      type: 'capability',
      allowedSources: [],
      allowedPaths: [],
      version: '1.0.0',
      author: 'OpenClaw Team',
      description: '发送聊天消息到指定频道',
      requiredPermissions: [],
      enabled: true,
      lastUpdated: new Date()
    })

    this.addToWhitelist({
      id: 'chat.read',
      name: '读取聊天消息',
      type: 'capability',
      allowedSources: [],
      allowedPaths: [],
      version: '1.0.0',
      author: 'OpenClaw Team',
      description: '读取聊天频道的历史消息',
      requiredPermissions: [],
      enabled: true,
      lastUpdated: new Date()
    })
  }
}

/**
 * 导出单例实例
 */
export const whitelistService = new WhitelistService()

/**
 * 导出便捷函数
 */

/**
 * 验证插件
 */
export function verifyPlugin(pluginId: string, source: string, path: string): WhitelistVerificationResult {
  return whitelistService.verifyPlugin(pluginId, source, path)
}

/**
 * 验证技能
 */
export function verifySkill(skillId: string, source: string, path: string): WhitelistVerificationResult {
  return whitelistService.verifySkill(skillId, source, path)
}

/**
 * 验证能力
 */
export function verifyCapability(capability: string, context: string): WhitelistVerificationResult {
  return whitelistService.verifyCapability(capability, context)
}

/**
 * 添加到白名单
 */
export function addToWhitelist(entry: WhitelistEntry): void {
  whitelistService.addToWhitelist(entry)
}

/**
 * 从白名单中移除
 */
export function removeFromWhitelist(entryId: string): boolean {
  return whitelistService.removeFromWhitelist(entryId)
}

/**
 * 获取白名单统计信息
 */
export function getWhitelistStats() {
  return whitelistService.getStatistics()
}