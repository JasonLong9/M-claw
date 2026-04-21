import { addToWhitelist } from './whitelist'
import type { WhitelistEntry } from './types'

type OfficialPluginWhitelistSeed = Omit<WhitelistEntry, 'lastUpdated'>

const OFFICIAL_PLUGIN_WHITELIST_ENTRIES: OfficialPluginWhitelistSeed[] = [
  {
    id: 'openclaw-lark',
    name: 'OpenClaw Lark',
    type: 'plugin',
    allowedSources: [
      'openclaw-lark',
      'https://npm.openclaw.com',
      'https://registry.npmjs.org',
      'registry.npmjs.org',
    ],
    allowedPaths: [],
    version: '1.0.0',
    author: 'OpenClaw Team',
    description: 'Official Lark channel plugin.',
    requiredPermissions: ['message.send', 'message.read'],
    enabled: true,
  },
  {
    id: 'wecom-openclaw-plugin',
    name: 'WeCom OpenClaw Plugin',
    type: 'plugin',
    allowedSources: [
      '@wecom/wecom-openclaw-cli',
      'wecom-openclaw-plugin',
      'https://registry.npmjs.org',
      'registry.npmjs.org',
    ],
    allowedPaths: [],
    version: '1.0.0',
    author: 'OpenClaw Team',
    description: 'Official WeCom channel plugin.',
    requiredPermissions: ['message.send', 'message.read'],
    enabled: true,
  },
  {
    id: 'dingtalk-connector',
    name: 'DingTalk Connector',
    type: 'plugin',
    allowedSources: [
      '@dingtalk-real-ai/dingtalk-connector',
      'dingtalk-connector',
      'https://registry.npmjs.org',
      'registry.npmjs.org',
    ],
    allowedPaths: [],
    version: '1.0.0',
    author: 'OpenClaw Team',
    description: 'Official DingTalk channel plugin.',
    requiredPermissions: ['message.send', 'message.read'],
    enabled: true,
  },
  {
    id: 'openclaw-qqbot',
    name: 'OpenClaw QQ Bot',
    type: 'plugin',
    allowedSources: [
      '@tencent-connect/openclaw-qqbot',
      'openclaw-qqbot',
      'https://registry.npmjs.org',
      'registry.npmjs.org',
    ],
    allowedPaths: [],
    version: '1.0.0',
    author: 'OpenClaw Team',
    description: 'Official QQ Bot channel plugin.',
    requiredPermissions: ['message.send', 'message.read'],
    enabled: true,
  },
  {
    id: 'openclaw-weixin',
    name: 'OpenClaw Weixin',
    type: 'plugin',
    allowedSources: [
      '@tencent-weixin/openclaw-weixin-cli',
      '@tencent-weixin/openclaw-weixin',
      'openclaw-weixin',
      'https://registry.npmjs.org',
      'registry.npmjs.org',
    ],
    allowedPaths: [],
    version: '1.0.0',
    author: 'OpenClaw Team',
    description: 'Official Weixin channel plugin.',
    requiredPermissions: ['message.send', 'message.read'],
    enabled: true,
  },
]

let officialPluginWhitelistInitialized = false

export function ensureOfficialPluginWhitelistEntries(): void {
  if (officialPluginWhitelistInitialized) return
  officialPluginWhitelistInitialized = true

  for (const entry of OFFICIAL_PLUGIN_WHITELIST_ENTRIES) {
    addToWhitelist({
      ...entry,
      lastUpdated: new Date(),
    })
  }
}
