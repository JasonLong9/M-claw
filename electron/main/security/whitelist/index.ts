/**
 * Whitelist Module Exports
 * 白名单模块统一导出
 *
 * 这个文件统一导出白名单模块的所有公共 API
 */

// ========== 核心服务 ==========
export { WhitelistService, whitelistService } from './whitelist-service'

// ========== 便捷函数 ==========
export {
  verifyPlugin,
  verifySkill,
  verifyCapability,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelistStats
} from './whitelist-service'

// ========== 类型定义 ==========
export type {
  WhitelistEntry,
  WhitelistVerificationResult,
  WhitelistHistoryEntry,
  ValidationResult
} from '../types'

/**
 * 模块版本
 */
export const MODULE_VERSION = '1.0.0'

/**
 * 模块说明
 */
export const MODULE_DESCRIPTION = 'Mclaw Security - Whitelist Module'

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  maxHistorySize: 100,
  autoVersionIncrement: true
} as const