import { describe, it, expect, beforeEach } from 'vitest'
/// <reference types="vitest/globals" />

import {
  WhitelistService,
  verifyPlugin,
  verifySkill,
  verifyCapability,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelistStats
} from '../whitelist'

describe('WhitelistService', () => {
  // 注意：白名单服务是单例，测试可能会相互影响
  // 在实际使用中，可以考虑使用依赖注入来隔离测试
  
  describe('插件白名单验证', () => {
    it('应该允许白名单中的插件', () => {
      // 添加飞书官方插件到白名单
      addToWhitelist({
        id: 'openclaw-lark',
        name: '飞书官方插件',
        type: 'plugin',
        allowedSources: ['https://npm.openclaw.com'],
        allowedPaths: [],
        version: '1.0.0',
        author: 'OpenClaw Team',
        description: '飞书官方插件',
        requiredPermissions: [],
        enabled: true,
        lastUpdated: new Date()
      })

      const result = verifyPlugin('openclaw-lark', 'https://npm.openclaw.com', '/path/to/plugin')
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('插件在白名单中')
    })

    it('应该拒绝不在白名单中的插件', () => {
      const result = verifyPlugin('malicious-plugin', 'https://evil.com', '/path/to/plugin')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('插件不在白名单中')
      expect(result.recommendedActions).toBeDefined()
      expect(result.recommendedActions.length).toBeGreaterThan(0)
    })

    it('应该拒绝来源不在允许列表中的插件', () => {
      // 添加插件到白名单，但只允许 npm.openclaw.com
      addToWhitelist({
        id: 'test-plugin',
        name: '测试插件',
        type: 'plugin',
        allowedSources: ['https://npm.openclaw.com'],
        allowedPaths: [],
        version: '1.0.0',
        author: 'Test',
        description: '测试插件',
        requiredPermissions: [],
        enabled: true,
        lastUpdated: new Date()
      })

      // 尝试从 evil.com 安装
      const result = verifyPlugin('test-plugin', 'https://evil.com', '/path/to/plugin')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('来源')
    })

  })

  describe('技能白名单验证', () => {
    it('应该允许白名单中的技能', () => {
      addToWhitelist({
        id: 'test-skill',
        name: '测试技能',
        type: 'skill',
        allowedSources: ['https://github.com'],
        allowedPaths: [],
        version: '1.0.0',
        author: 'Test',
        description: '测试技能',
        requiredPermissions: [],
        enabled: true,
        lastUpdated: new Date()
      })

      const result = verifySkill('test-skill', 'https://github.com/user/skill', '/path/to/skill')
      expect(result.allowed).toBe(true)
    })

    it('应该拒绝不在白名单中的技能', () => {
      const result = verifySkill('malicious-skill', 'https://evil.com', '/path/to/skill')
      expect(result.allowed).toBe(false)
    })
  })

  describe('能力白名单验证', () => {
    it('应该允许白名单中的能力', () => {
      const result = verifyCapability('chat.send', 'user-context')
      expect(result.allowed).toBe(true)
    })

    it('应该拒绝不在白名单中的能力', () => {
      const result = verifyCapability('malicious.action', 'user-context')
      expect(result.allowed).toBe(false)
    })
  })

  describe('白名单管理', () => {
    it('应该能够添加和移除白名单条目', () => {
      // 添加
      addToWhitelist({
        id: 'test-plugin',
        name: '测试插件',
        type: 'plugin',
        allowedSources: [],
        allowedPaths: [],
        version: '1.0.0',
        author: 'Test',
        description: '测试插件',
        requiredPermissions: [],
        enabled: true,
        lastUpdated: new Date()
      })

      const result1 = verifyPlugin('test-plugin', 'https://test.com', '/path/to/plugin')
      expect(result1.allowed).toBe(true)

      // 移除
      const removed = removeFromWhitelist('test-plugin')
      expect(removed).toBe(true)

      // 验证已移除
      const result2 = verifyPlugin('test-plugin', 'https://test.com', '/path/to/plugin')
      expect(result2.allowed).toBe(false)
    })

    it('应该能够获取白名单统计信息', () => {
      const stats = getWhitelistStats()
      expect(stats).toBeDefined()
      expect(stats.pluginCount).toBeGreaterThanOrEqual(0)
      expect(stats.skillCount).toBeGreaterThanOrEqual(0)
      expect(stats.capabilityCount).toBeGreaterThanOrEqual(0)
    })
  })
})
