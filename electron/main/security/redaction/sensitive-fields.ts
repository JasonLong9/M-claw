/**
 * Sensitive Fields Definition
 * 敏感字段清单定义
 *
 * 基于 Mclaw 代码库的真实审计结果，定义所有需要脱敏的敏感字段类型和识别规则
 */

import { SensitiveField, FieldCategory, RiskLevel } from '../types'

/**
 * 敏感字段清单
 *
 * 每个字段包含：
 * - id: 唯一标识符
 * - name: 字段名称
 * - category: 字段分类
 * - riskLevel: 风险等级
 * - patterns: 正则表达式模式数组
 * - contexts: 应用上下文（如 'config', 'log', 'ui', 'api-response'）
 * - description: 字段描述
 * - examples: 示例数据
 */
export const SENSITIVE_FIELDS: Record<string, SensitiveField> = {
  // ==================== 凭证类（高风险）====================

  /**
   * API Key
   * 应用程序编程接口密钥
   * 审计来源：local-model-probe.ts, openclaw-auth-executor.ts, openclaw-model-config.ts
   */
  'api-key': {
    id: 'api-key',
    name: 'API Key',
    category: FieldCategory.CREDENTIALS,
    riskLevel: RiskLevel.HIGH,
    patterns: [
      // 通用 API Key 格式
      '(api[_-]?key|apikey)["\'\\s:=]+([a-zA-Z0-9_\\-]{20,64})',
      // OpenAI-like keys
      'sk-[a-zA-Z0-9_-]{5,64}',
      // Anthropic-like keys
      'sk-ant-[a-zA-Z0-9]{32,64}',
      // Google-like keys
      'AIza[a-zA-Z0-9_-]{32}',
      // AWS-like keys
      '(?i)(aws[_-]?(access[_-]?key[_-]?id|secret[_-]?access[_-]?key))["\'\\s:=]+([a-zA-Z0-9/+]{20,40})',
      // 环境变量中的 API Key
      '(?i)(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY)["\'\\s:=]+([a-zA-Z0-9_\\-]{20,64})',
    ],
    contexts: ['config', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    description: '应用程序编程接口密钥，包括 OpenAI、Anthropic、Gemini 等提供商',
    examples: [
      'sk-proj-abc123def456',
      'sk-ant-api03-xyz789',
      'AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe',
      'OPENAI_API_KEY=sk-proj-1234567890',
      'apiKey: sk-ant-api03-secret'
    ]
  },

  /**
   * Password
   * 密码
   * 审计来源：用户配置、认证模块
   */
  'password': {
    id: 'password',
    name: 'Password',
    category: FieldCategory.CREDENTIALS,
    riskLevel: RiskLevel.HIGH,
    patterns: [
      // 通用密码格式
      '(password|pwd|passwd)["\'\\s:=]+([a-zA-Z0-9_\\-!@#$%^&*()_+\\-=\\[\\]{};:\'",.<>/?]{6,64})',
      // JSON 中的密码
      '"password"\\s*:\\s*"([^"]{6,64})"',
    ],
    contexts: ['config', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    description: '用户密码，包括明文密码和 JSON 格式密码',
    examples: [
      'password: mypassword123',
      'pwd: secret123!',
      '"password": "userpassword"',
    ]
  },

  /**
   * App Secret
   * 应用密钥（特别是飞书 App Secret）
   * 审计来源：cli.ts, feishu-diagnostics-core.ts, feishu-diagnostics.ts
   */
  'app-secret': {
    id: 'app-secret',
    name: 'App Secret',
    category: FieldCategory.CREDENTIALS,
    riskLevel: RiskLevel.HIGH,
    patterns: [
      // 飞书 App Secret
      '(?i)(app[_-]?secret)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,64})',
      // 通用 App Secret
      '(?i)(client[_-]?secret)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,64})',
      // 环境变量中的 App Secret
      '(?i)(FEISHU_APP_SECRET|DINGTALK_APP_SECRET|WECOM_SECRET)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,64})',
    ],
    contexts: ['config', 'log', 'ui', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    description: '应用密钥，特别是飞书、钉钉、企业微信的 App Secret',
    examples: [
      'app_secret: abc123xyz456',
      'FEISHU_APP_SECRET=cli_secret123',
      'clientSecret=def456ghi789'
    ]
  },

  /**
   * Client Secret
   * 客户端密钥
   * 审计来源：各种 OAuth 流程
   */
  'client-secret': {
    id: 'client-secret',
    name: 'Client Secret',
    category: FieldCategory.CREDENTIALS,
    riskLevel: RiskLevel.HIGH,
    patterns: [
      '(?i)(client[_-]?secret)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,64})',
      // OAuth 相关
      '(?i)(oauth[_-]?client[_-]?secret)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,64})',
    ],
    contexts: ['config', 'log', 'api-response', 'api-request', 'cli-output'],
    description: 'OAuth 客户端密钥',
    examples: [
      'clientSecret: GOCSPX-abc123',
      'oauth_client_secret: xyz789'
    ]
  },

  // ==================== 令牌类（高风险）====================

  /**
   * Gateway Token
   * Gateway 认证令牌
   * 审计来源：gateway-streaming-chat-transport.ts, openclaw-control-ui-rpc.ts, openclaw-gateway-probes.ts
   */
  'gateway-token': {
    id: 'gateway-token',
    name: 'Gateway Token',
    category: FieldCategory.TOKEN,
    riskLevel: RiskLevel.HIGH,
    patterns: [
      // Gateway Token 配置
      '(?i)(gateway[_-]?auth[_-]?token)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,128})',
      // 环境变量中的 Gateway Token
      '(?i)(OPENCLAW_GATEWAY_TOKEN|CLAWDBOT_GATEWAY_TOKEN)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,128})',
      // Gateway 连接中的 Token
      '(?i)(token)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,128})',
    ],
    contexts: ['config', 'log', 'api-response', 'api-request', 'cli-output', 'cli-error'],
    description: 'Gateway 认证令牌',
    examples: [
      'gateway.auth.token: secret-token-123',
      'OPENCLAW_GATEWAY_TOKEN=abc123xyz456',
      'token: gateway-secret-key'
    ]
  },

  /**
   * JWT Token
   * JSON Web Token
   * 审计来源：各种认证流程
   */
  'jwt': {
    id: 'jwt',
    name: 'JWT Token',
    category: FieldCategory.TOKEN,
    riskLevel: RiskLevel.HIGH,
    patterns: [
      // JWT 格式：header.payload.signature
      '[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+',
    ],
    contexts: ['authorization', 'api-request', 'api-response', 'cookie', 'log', 'cli-output'],
    description: 'JSON Web Token',
    examples: [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
    ]
  },

  /**
   * OAuth Token
   * OAuth 访问令牌
   * 审计来源：model-oauth.ts, feishu-diagnostics-core.ts
   */
  'oauth-token': {
    id: 'oauth-token',
    name: 'OAuth Token',
    category: FieldCategory.TOKEN,
    riskLevel: RiskLevel.HIGH,
    patterns: [
      // OAuth access token
      '(?i)(access[_-]?token)["\'\\s:=]+([a-zA-Z0-9_\\-\\.]{20,256})',
      // Bearer token
      'Bearer\\s+([a-zA-Z0-9_\\-\\.]{20,256})',
    ],
    contexts: ['authorization', 'api-request', 'api-response', 'log', 'cli-output'],
    description: 'OAuth 访问令牌',
    examples: [
      'access_token: ya29.a0AfH6SMBB...',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    ]
  },

  /**
   * Session Token
   * 会话令牌
   * 审计来源：聊天服务、会话管理
   */
  'session-token': {
    id: 'session-token',
    name: 'Session Token',
    category: FieldCategory.TOKEN,
    riskLevel: RiskLevel.HIGH,
    patterns: [
      '(?i)(session[_-]?token|sessionid|session[_-]?key)["\'\\s:=]+([a-zA-Z0-9_\\-]{20,128})',
    ],
    contexts: ['cookie', 'api-request', 'api-response', 'log', 'cli-output'],
    description: '用户会话标识符',
    examples: [
      'session_token=abc123xyz456',
      'sessionid=5f8d2c9b1e4a6f3d',
      'session_key=7a8b9c0d1e2f3g4h'
    ]
  },

  // ==================== 业务敏感信息（中风险）====================

  /**
   * App ID
   * 应用标识符（特别是飞书 App ID）
   * 审计来源：cli.ts, feishu-diagnostics-core.ts
   */
  'app-id': {
    id: 'app-id',
    name: 'App ID',
    category: FieldCategory.BUSINESS,
    riskLevel: RiskLevel.MEDIUM,
    patterns: [
      '(?i)(app[_-]?id)["\'\\s:=]+([a-zA-Z0-9_\\-]{8,32})',
      // 飞书 App ID
      'cli_[a-zA-Z0-9]{32}',
      // 钉钉 App Key
      '(?i)(app[_-]?key)["\'\\s:=]+([a-zA-Z0-9_\\-]{8,32})',
    ],
    contexts: ['config', 'log', 'ui', 'api-response', 'api-request'],
    description: '应用标识符，特别是飞书、钉钉的 App ID',
    examples: [
      'app_id: cli_a1b2c3d4e5f6g7h8i9j0k',
      'cli_abc123xyz456',
      'appKey: ding123xyz456'
    ]
  },

  /**
   * Installation ID
   * 安装标识符
   * 审计来源：系统配置和安装检测
   */
  'installation-id': {
    id: 'installation-id',
    name: 'Installation ID',
    category: FieldCategory.BUSINESS,
    riskLevel: RiskLevel.MEDIUM,
    patterns: [
      '(?i)(installation[_-]?id|install[_-]?id)["\'\\s:=]+([a-zA-Z0-9_\\-]{16,64})',
    ],
    contexts: ['config', 'log', 'api-response'],
    description: '应用安装唯一标识符',
    examples: [
      'installation_id=inst_1234567890abcdef',
      'install-id=INST-ABC-123-DEF-456'
    ]
  },

  /**
   * Provider ID
   * 模型提供商标识符
   * 审计来源：openclaw-model-config.ts, openclaw-chat-service.ts
   */
  'provider-id': {
    id: 'provider-id',
    name: 'Provider ID',
    category: FieldCategory.BUSINESS,
    riskLevel: RiskLevel.LOW,
    patterns: [
      '(?i)(provider[_-]?id|provider)["\'\\s:=]+([a-zA-Z0-9_\\-]{4,32})',
    ],
    contexts: ['config', 'log', 'api-response', 'api-request'],
    description: '模型提供商标识符',
    examples: [
      'providerId: openai',
      'provider: anthropic',
      'provider_id: gemini'
    ]
  },

  // ==================== 个人信息类（低风险）====================

  /**
   * Email Address
   * 邮箱地址
   * 审计来源：用户配置、飞书账户
   */
  'email': {
    id: 'email',
    name: 'Email Address',
    category: FieldCategory.PERSONAL_INFO,
    riskLevel: RiskLevel.LOW,
    patterns: [
      '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    ],
    contexts: ['log', 'ui', 'chat-response', 'api-response', 'cli-output'],
    description: '电子邮件地址',
    examples: [
      'user@example.com',
      'name@domain.com.cn',
      'test.user+tag@company.co.uk'
    ]
  },

  /**
   * Phone Number
   * 手机号码
   * 审计来源：用户配置、企业微信账户
   */
  'phone': {
    id: 'phone',
    name: 'Phone Number',
    category: FieldCategory.PERSONAL_INFO,
    riskLevel: RiskLevel.LOW,
    patterns: [
      // 中国手机号：1开头，第二位3-9，共11位
      '\\b1[3-9]\\d{9}\\b',
      // 国际手机号（通用）
      '\\b\\+?[1-9]\\d{1,14}\\b',
    ],
    contexts: ['log', 'ui', 'chat-response', 'api-response'],
    description: '电话号码',
    examples: [
      '13812345678',
      '+8613812345678',
      '+8615011122233',
      '+12125551234'
    ]
  },

  // ==================== 系统信息类（低风险）====================

  /**
   * File Path
   * 文件路径
   * 审计来源：系统日志、配置文件路径
   */
  'file-path': {
    id: 'file-path',
    name: 'File Path',
    category: FieldCategory.SYSTEM,
    riskLevel: RiskLevel.LOW,
    patterns: [
      // Windows 路径
      '[a-zA-Z]:\\\\[^\\s:*?"<>|]+',
      // UNC 路径
      '\\\\\\\\\\\\[^\\s:*?"<>|]+',
      // Unix/Linux/Mac 路径
      '/[^\\s:*?"<>|]+',
    ],
    contexts: ['log', 'api-request', 'config', 'cli-output'],
    description: '文件系统路径',
    examples: [
      'C:\\Users\\user\\config.json',
      'D:\\Project\\src\\index.ts',
      '\\\\server\\share\\file.txt',
      '/home/user/data/file.txt',
      '/usr/local/bin/node'
    ]
  },

  /**
   * IP Address
   * IP地址
   * 审计来源：网络日志、连接信息
   */
  'ip-address': {
    id: 'ip-address',
    name: 'IP Address',
    category: FieldCategory.SYSTEM,
    riskLevel: RiskLevel.LOW,
    patterns: [
      // IPv4
      '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
      // IPv6
      '\\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\\b',
    ],
    contexts: ['log', 'api-request', 'api-response', 'cli-output'],
    description: 'IP地址',
    examples: [
      '192.168.1.1',
      '10.0.0.1',
      '172.16.254.1',
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
    ]
  },

  /**
   * Port Number
   * 端口号
   * 审计来源：网络配置、连接信息
   */
  'port': {
    id: 'port',
    name: 'Port Number',
    category: FieldCategory.SYSTEM,
    riskLevel: RiskLevel.LOW,
    patterns: [
      // 常见端口范围
      ':[0-9]{1,5}\\b',
    ],
    contexts: ['log', 'api-request', 'config', 'cli-output'],
    description: '网络端口号',
    examples: [
      ':3000',
      ':8080',
      ':443',
      'localhost:5000'
    ]
  }
}

/**
 * 字段分类
 */
export const FIELD_CATEGORIES = FieldCategory

/**
 * 风险等级
 */
export const RISK_LEVELS = RiskLevel

/**
 * 根据字段 ID 获取敏感字段定义
 */
export function getSensitiveField(fieldId: string): SensitiveField | undefined {
  return SENSITIVE_FIELDS[fieldId]
}

/**
 * 根据分类获取敏感字段列表
 */
export function getFieldsByCategory(category: FieldCategory): SensitiveField[] {
  return Object.values(SENSITIVE_FIELDS).filter(
    field => field.category === category
  )
}

/**
 * 根据风险等级获取敏感字段列表
 */
export function getFieldsByRiskLevel(riskLevel: RiskLevel): SensitiveField[] {
  return Object.values(SENSITIVE_FIELDS).filter(
    field => field.riskLevel === riskLevel
  )
}

/**
 * 获取所有敏感字段 ID
 */
export function getAllFieldIds(): string[] {
  return Object.keys(SENSITIVE_FIELDS)
}

/**
 * 搜索敏感字段
 */
export function searchSensitiveFields(query: string): SensitiveField[] {
  const lowerQuery = query.toLowerCase()
  return Object.values(SENSITIVE_FIELDS).filter(
    field =>
      field.name.toLowerCase().includes(lowerQuery) ||
      field.id.toLowerCase().includes(lowerQuery) ||
      field.description.toLowerCase().includes(lowerQuery)
  )
}
