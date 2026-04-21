import { describe, it, expect, beforeEach } from 'vitest'
/// <reference types="vitest/globals" />

import {
  RedactionService,
  redact,
  redactObject,
  scanSensitive,
  getRedactionStats,
  resetRedactionStats,
  clearRedactionAuditLog
} from '../redaction'

describe('RedactionService', () => {
  beforeEach(() => {
    // 每个测试前重置统计和日志
    resetRedactionStats()
    clearRedactionAuditLog()
  })

  describe('字符串脱敏', () => {
    it('应该脱敏 API Key', () => {
      const input = 'API Key: sk-proj-abc123def456'
      const result = redact(input, { context: ['cli-output'] })
      
      expect(result.original).toBe(input)
      expect(result.redacted).not.toContain('sk-proj-abc123def456')
      expect(result.redacted).toContain('[OPENAI_API_KEY]')
      expect(result.matchedRules).toContain('redact-openai-key')
    })

    it('应该脱敏密码', () => {
      const input = 'Password: mypassword123'
      const result = redact(input, { context: ['cli-output'] })
      
      expect(result.redacted).not.toContain('mypassword123')
      expect(result.redacted).toContain('[PASSWORD]')
    })

    it('应该脱敏 App Secret', () => {
      const input = 'App Secret: cli_secret123abc456'
      const result = redact(input, { context: ['cli-output'] })
      
      expect(result.redacted).not.toContain('cli_secret123abc456')
      expect(result.redacted).toContain('[APP_SECRET]')
    })

    it('应该脱敏邮箱地址', () => {
      const input = 'Email: user@example.com'
      const result = redact(input, { context: ['cli-output'] })
      
      expect(result.redacted).not.toContain('user@example.com')
      expect(result.redacted).toContain('[EMAIL]')
    })

    it('应该脱敏 Token', () => {
      const input = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      const result = redact(input, { context: ['cli-output'] })
      
      expect(result.redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
      expect(result.redacted).toContain('[JWT_TOKEN]')
    })

    it('应该脱敏多种敏感信息', () => {
      const input = 'API Key: sk-abc123, Password: secret456, Email: user@test.com'
      const result = redact(input, { context: ['cli-output'] })
      
      expect(result.redacted).not.toContain('sk-abc123')
      expect(result.redacted).not.toContain('secret456')
      expect(result.redacted).not.toContain('user@test.com')
      expect(result.redacted).toContain('[OPENAI_API_KEY]')
      expect(result.redacted).toContain('[PASSWORD]')
      expect(result.redacted).toContain('[EMAIL]')
    })

    it('应该返回统计信息', () => {
      const input = 'API Key: sk-abc123'
      const result = redact(input, { context: ['cli-output'] })
      
      expect(result.stats).toBeDefined()
      expect(result.stats.totalMatches).toBeGreaterThan(0)
      expect(result.stats.rulesUsed).toBeDefined()
    })

    it('应该记录审计日志', () => {
      const input = 'API Key: sk-abc123'
      redact(input, { context: ['cli-output'] })
      
      const stats = getRedactionStats()
      expect(stats.totalRedactions).toBeGreaterThan(0)
    })
  })

  describe('对象脱敏', () => {
    it('应该脱敏对象中的敏感字段', () => {
      const input = {
        username: 'user',
        password: 'secret123',
        apiKey: 'sk-proj-abc123'
      }
      
      const result = redactObject(input, { context: ['config-read'] })
      
      expect(result.redacted.password).not.toBe('secret123')
      expect(result.redacted.apiKey).not.toBe('sk-proj-abc123')
      expect(result.redacted.username).toBe('user') // 非敏感字段保持不变
    })

    it('应该正确处理嵌套对象', () => {
      const input = {
        level1: {
          level2: {
            apiKey: 'sk-abc123',
            password: 'secret'
          }
        }
      }
      
      const result = redactObject(input, { context: ['config-read'] })
      
      expect(result.redacted.level1.level2.apiKey).not.toBe('sk-abc123')
      expect(result.redacted.level1.level2.password).not.toBe('secret')
    })

    it('应该正确处理数组', () => {
      const input = {
        users: [
          { username: 'user1', apiKey: 'sk-abc123' },
          { username: 'user2', apiKey: 'sk-def456' }
        ]
      }
      
      const result = redactObject(input, { context: ['config-read'] })
      
      expect(result.redacted.users[0].apiKey).not.toBe('sk-abc123')
      expect(result.redacted.users[1].apiKey).not.toBe('sk-def456')
    })
  })

  describe('敏感内容扫描', () => {
    it('应该检测到 API Key', () => {
      const content = 'API Key: sk-proj-abc123def456'
      const report = scanSensitive(content)
      
      expect(report.hasSensitiveData).toBe(true)
      expect(report.detectedFields.length).toBeGreaterThan(0)
      expect(report.detectedFields[0].fieldName).toContain('API Key')
    })

    it('应该检测到多种敏感信息', () => {
      const content = `
用户配置：
API Key: sk-proj-abc123
Password: mypassword123
Email: user@example.com
      `.trim()
      
      const report = scanSensitive(content)
      
      expect(report.hasSensitiveData).toBe(true)
      expect(report.detectedFields.length).toBeGreaterThanOrEqual(3)
    })

    it('应该评估风险等级', () => {
      const content = 'API Key: sk-proj-abc123, Password: secret'
      const report = scanSensitive(content)
      
      expect(report.riskLevel).toBeDefined()
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(report.riskLevel)
    })

    it('应该提供建议', () => {
      const content = 'API Key: sk-proj-abc123'
      const report = scanSensitive(content)
      
      expect(report.recommendation).toBeDefined()
      expect(report.recommendation.length).toBeGreaterThan(0)
    })

    it('应该正确处理空内容', () => {
      const content = ''
      const report = scanSensitive(content)
      
      expect(report.hasSensitiveData).toBe(false)
      expect(report.detectedFields.length).toBe(0)
    })

    it('应该正确处理无敏感信息的内容', () => {
      const content = '这是一条普通的日志消息，没有敏感信息'
      const report = scanSensitive(content)
      
      expect(report.hasSensitiveData).toBe(false)
      expect(report.detectedFields.length).toBe(0)
    })
  })

  describe('统计和审计', () => {
    it('应该记录脱敏统计', () => {
      redact('API Key: sk-abc123', { context: ['cli-output'] })
      redact('Password: secret', { context: ['cli-output'] })
      
      const stats = getRedactionStats()
      expect(stats.totalRedactions).toBe(2)
    })

    it('应该能够重置统计', () => {
      redact('API Key: sk-abc123', { context: ['cli-output'] })
      resetRedactionStats()
      
      const stats = getRedactionStats()
      expect(stats.totalRedactions).toBe(0)
    })

    it('应该记录每个规则的使用次数', () => {
      redact('API Key: sk-abc123', { context: ['cli-output'] })
      redact('Password: secret', { context: ['cli-output'] })
      
      const stats = getRedactionStats()
      expect(stats.rulesUsed).toBeDefined()
    })
  })

  describe('容错处理', () => {
    it('应该正确处理空字符串', () => {
      const result = redact('', { context: ['cli-output'] })
      
      expect(result.original).toBe('')
      expect(result.redacted).toBe('')
    })

    it('应该正确处理空对象', () => {
      const result = redactObject({}, { context: ['config-read'] })
      
      expect(result.redacted).toEqual({})
    })

    it('应该正确处理无敏感信息的内容', () => {
      const result = redact('这是一条普通消息', { context: ['cli-output'] })
      
      expect(result.original).toBe('这是一条普通消息')
      expect(result.redacted).toBe('这是一条普通消息')
    })

    it('应该正确处理特殊字符', () => {
      const result = redact('密码: p@ssw0rd!#$%', { context: ['cli-output'] })
      
      expect(result.redacted).not.toContain('p@ssw0rd!#$%')
    })
  })

  describe('性能测试', () => {
    it('应该能够处理大量数据', () => {
      const largeContent = 'API Key: sk-abc123'.repeat(1000)
      const start = Date.now()
      const result = redact(largeContent, { context: ['cli-output'] })
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(1000) // 应该在1秒内完成
    })

    it('应该能够处理复杂对象', () => {
      const complexObject = {
        users: Array(100).fill(0).map((_, i) => ({
          id: i,
          username: `user${i}`,
          password: `password${i}`,
          apiKey: `sk-key${i}`
        }))
      }
      
      const start = Date.now()
      const result = redactObject(complexObject, { context: ['config-read'] })
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(1000) // 应该在1秒内完成
    })
  })
})
