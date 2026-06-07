import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildOpenClawLegacyEnvPatch,
  resetOpenClawLegacyEnvWarningsForTests,
  resolveOpenClawEnvValue,
} from '../openclaw-legacy-env-migration'

const { getOpenClawPathsMock, readConfigMock } = vi.hoisted(() => ({
  getOpenClawPathsMock: vi.fn(),
  readConfigMock: vi.fn(),
}))

const { existsSync } = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const { mkdtemp, mkdir, readFile, rm, writeFile } =
  process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')

vi.mock('../cli', () => ({
  getOpenClawPaths: getOpenClawPathsMock,
  readConfig: readConfigMock,
}))

import { getWeixinStatePathDiagnostic, listWeixinAccountState, removeWeixinAccountState } from '../weixin-account-state'

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}

describe('weixin-account-state', () => {
  let homeDir = ''
  let previousUserProfile: string | undefined
  let previousHome: string | undefined

  beforeEach(async () => {
    homeDir = await mkdtemp('/tmp/qclaw-weixin-state-')
    previousUserProfile = process.env.USERPROFILE
    previousHome = process.env.HOME
    process.env.USERPROFILE = homeDir
    process.env.HOME = homeDir
    getOpenClawPathsMock.mockReset()
    readConfigMock.mockReset()
    resetOpenClawLegacyEnvWarningsForTests()
    getOpenClawPathsMock.mockResolvedValue({ homeDir })
    readConfigMock.mockResolvedValue(null)
  })

  afterEach(async () => {
    if (previousUserProfile == null) delete process.env.USERPROFILE
    else process.env.USERPROFILE = previousUserProfile
    if (previousHome == null) delete process.env.HOME
    else process.env.HOME = previousHome
    if (homeDir) {
      await rm(homeDir, { recursive: true, force: true })
    }
  })

  it('lists personal WeChat accounts from state index and config metadata', async () => {
    const weixinStateDir = joinPath(homeDir, 'openclaw-weixin')
    const accountsDir = joinPath(weixinStateDir, 'accounts')
    await mkdir(accountsDir, { recursive: true })
    await writeFile(
      joinPath(weixinStateDir, 'accounts.json'),
      JSON.stringify(['wx-account']),
      'utf-8'
    )
    await writeFile(
      joinPath(accountsDir, 'wx-account.json'),
      JSON.stringify({
        token: 'token-123',
        baseUrl: 'https://ilinkai.weixin.qq.com',
        userId: 'user@im.wechat',
      }),
      'utf-8'
    )

    readConfigMock.mockResolvedValue({
      channels: {
        'openclaw-weixin': {
          accounts: {
            'wx-account': {
              enabled: false,
              name: '主账号',
            },
            stale: {
              enabled: true,
              name: '残留账号',
            },
          },
        },
      },
    })

    const accounts = await listWeixinAccountState()

    expect(accounts).toEqual([
      {
        accountId: 'stale',
        configured: false,
        enabled: true,
        name: '残留账号',
      },
      {
        accountId: 'wx-account',
        configured: true,
        baseUrl: 'https://ilinkai.weixin.qq.com',
        userId: 'user@im.wechat',
        enabled: false,
        name: '主账号',
      },
    ])
  })

  it('ignores removed CLAWDBOT_STATE_DIR during steady-state reads and warns once', async () => {
    const previousStateDir = process.env.CLAWDBOT_STATE_DIR
    const legacyHomeDir = await mkdtemp('/tmp/qclaw-weixin-legacy-state-')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.CLAWDBOT_STATE_DIR = legacyHomeDir

    try {
      const legacyWeixinStateDir = joinPath(legacyHomeDir, 'openclaw-weixin')
      const legacyAccountsDir = joinPath(legacyWeixinStateDir, 'accounts')
      await mkdir(legacyAccountsDir, { recursive: true })
      await writeFile(
        joinPath(legacyWeixinStateDir, 'accounts.json'),
        JSON.stringify(['legacy-only']),
        'utf-8'
      )
      await writeFile(
        joinPath(legacyAccountsDir, 'legacy-only.json'),
        JSON.stringify({ token: 'legacy-token' }),
        'utf-8'
      )

      const accounts = await listWeixinAccountState()

      expect(accounts).toEqual([])
      expect(warnSpy).toHaveBeenCalledWith(
        '[openclaw] Ignoring removed legacy env alias CLAWDBOT_STATE_DIR; steady-state now reads OPENCLAW_STATE_DIR only.'
      )
    } finally {
      warnSpy.mockRestore()
      await rm(legacyHomeDir, { recursive: true, force: true })
      if (previousStateDir == null) delete process.env.CLAWDBOT_STATE_DIR
      else process.env.CLAWDBOT_STATE_DIR = previousStateDir
    }
  })

  it('migrates legacy aliases only in explicit migration mode', () => {
    const warn = vi.fn()
    const migrated = resolveOpenClawEnvValue(
      { MOLTBOT_STATE_DIR: '/tmp/moltbot-state' },
      'OPENCLAW_STATE_DIR',
      { mode: 'migration', onWarning: warn }
    )
    const patch = buildOpenClawLegacyEnvPatch(
      { MOLTBOT_STATE_DIR: '/tmp/moltbot-state' },
      { mode: 'migration', onWarning: warn }
    )

    expect(migrated).toEqual({
      canonicalKey: 'OPENCLAW_STATE_DIR',
      value: '/tmp/moltbot-state',
      source: 'legacy',
      legacyKey: 'MOLTBOT_STATE_DIR',
    })
    expect(patch).toMatchObject({
      OPENCLAW_STATE_DIR: '/tmp/moltbot-state',
      MOLTBOT_STATE_DIR: undefined,
      CLAWDBOT_STATE_DIR: undefined,
    })
    expect(warn).toHaveBeenCalledWith(
      '[openclaw] Detected removed legacy env alias MOLTBOT_STATE_DIR; migrating it to OPENCLAW_STATE_DIR for this compatibility path only. Set OPENCLAW_STATE_DIR explicitly.'
    )
  })

  it('removes personal WeChat account files and updates the account index', async () => {
    const weixinStateDir = joinPath(homeDir, 'openclaw-weixin')
    const accountsDir = joinPath(weixinStateDir, 'accounts')
    const credentialsDir = joinPath(homeDir, 'credentials')
    await mkdir(accountsDir, { recursive: true })
    await mkdir(credentialsDir, { recursive: true })

    await writeFile(
      joinPath(weixinStateDir, 'accounts.json'),
      JSON.stringify(['wx-account', 'keep-account'], null, 2),
      'utf-8'
    )
    await writeFile(joinPath(accountsDir, 'wx-account.json'), '{}', 'utf-8')
    await writeFile(joinPath(accountsDir, 'wx-account.sync.json'), '{}', 'utf-8')
    await writeFile(
      joinPath(credentialsDir, 'openclaw-weixin-wx-account-allowFrom.json'),
      '{}',
      'utf-8'
    )

    const result = await removeWeixinAccountState('wx-account')

    expect(result).toEqual({ ok: true })
    expect(existsSync(joinPath(accountsDir, 'wx-account.json'))).toBe(false)
    expect(existsSync(joinPath(accountsDir, 'wx-account.sync.json'))).toBe(false)
    expect(existsSync(joinPath(credentialsDir, 'openclaw-weixin-wx-account-allowFrom.json'))).toBe(false)
    expect(
      JSON.parse(await readFile(joinPath(weixinStateDir, 'accounts.json'), 'utf-8'))
    ).toEqual(['keep-account'])
  })

  it('mirrors fallback personal WeChat account credentials into the active state dir when only the default .openclaw copy exists', async () => {
    const previousUserProfile = process.env.USERPROFILE
    const previousHome = process.env.HOME
    const defaultRoot = await mkdtemp('/tmp/qclaw-weixin-default-state-')
    process.env.USERPROFILE = defaultRoot
    process.env.HOME = defaultRoot

    try {
      const fallbackWeixinStateDir = joinPath(defaultRoot, '.openclaw', 'openclaw-weixin')
      const fallbackAccountsDir = joinPath(fallbackWeixinStateDir, 'accounts')
      await mkdir(fallbackAccountsDir, { recursive: true })
      await writeFile(
        joinPath(fallbackWeixinStateDir, 'accounts.json'),
        JSON.stringify(['fallback-account'], null, 2),
        'utf-8'
      )
      await writeFile(
        joinPath(fallbackAccountsDir, 'fallback-account.json'),
        JSON.stringify({
          token: 'fallback-token',
          baseUrl: 'https://ilinkai.weixin.qq.com',
          userId: 'fallback@im.wechat',
        }),
        'utf-8'
      )

      const accounts = await listWeixinAccountState()

      expect(accounts).toEqual([
        {
          accountId: 'fallback-account',
          configured: true,
          baseUrl: 'https://ilinkai.weixin.qq.com',
          userId: 'fallback@im.wechat',
          enabled: true,
          name: undefined,
        },
      ])
      expect(existsSync(joinPath(homeDir, 'openclaw-weixin', 'accounts', 'fallback-account.json'))).toBe(true)
      expect(
        JSON.parse(await readFile(joinPath(homeDir, 'openclaw-weixin', 'accounts.json'), 'utf-8'))
      ).toEqual(['fallback-account'])
    } finally {
      if (previousUserProfile == null) delete process.env.USERPROFILE
      else process.env.USERPROFILE = previousUserProfile
      if (previousHome == null) delete process.env.HOME
      else process.env.HOME = previousHome
      await rm(defaultRoot, { recursive: true, force: true })
    }
  })

  it('removes personal WeChat account files from both active and fallback state dirs', async () => {
    const previousUserProfile = process.env.USERPROFILE
    const previousHome = process.env.HOME
    const defaultRoot = await mkdtemp('/tmp/qclaw-weixin-default-remove-')
    process.env.USERPROFILE = defaultRoot
    process.env.HOME = defaultRoot

    try {
      const activeWeixinStateDir = joinPath(homeDir, 'openclaw-weixin')
      const activeAccountsDir = joinPath(activeWeixinStateDir, 'accounts')
      const activeCredentialsDir = joinPath(homeDir, 'credentials')
      await mkdir(activeAccountsDir, { recursive: true })
      await mkdir(activeCredentialsDir, { recursive: true })
      await writeFile(joinPath(activeWeixinStateDir, 'accounts.json'), JSON.stringify(['wx-account'], null, 2), 'utf-8')
      await writeFile(joinPath(activeAccountsDir, 'wx-account.json'), '{}', 'utf-8')
      await writeFile(joinPath(activeCredentialsDir, 'openclaw-weixin-wx-account-allowFrom.json'), '{}', 'utf-8')

      const fallbackStateRoot = joinPath(defaultRoot, '.openclaw')
      const fallbackWeixinStateDir = joinPath(fallbackStateRoot, 'openclaw-weixin')
      const fallbackAccountsDir = joinPath(fallbackWeixinStateDir, 'accounts')
      const fallbackCredentialsDir = joinPath(fallbackStateRoot, 'credentials')
      await mkdir(fallbackAccountsDir, { recursive: true })
      await mkdir(fallbackCredentialsDir, { recursive: true })
      await writeFile(joinPath(fallbackWeixinStateDir, 'accounts.json'), JSON.stringify(['wx-account'], null, 2), 'utf-8')
      await writeFile(joinPath(fallbackAccountsDir, 'wx-account.json'), '{}', 'utf-8')
      await writeFile(joinPath(fallbackCredentialsDir, 'openclaw-weixin-wx-account-allowFrom.json'), '{}', 'utf-8')

      const result = await removeWeixinAccountState('wx-account')

      expect(result).toEqual({ ok: true })
      expect(existsSync(joinPath(activeAccountsDir, 'wx-account.json'))).toBe(false)
      expect(existsSync(joinPath(fallbackAccountsDir, 'wx-account.json'))).toBe(false)
      expect(existsSync(joinPath(activeCredentialsDir, 'openclaw-weixin-wx-account-allowFrom.json'))).toBe(false)
      expect(existsSync(joinPath(fallbackCredentialsDir, 'openclaw-weixin-wx-account-allowFrom.json'))).toBe(false)
      expect(
        JSON.parse(await readFile(joinPath(activeWeixinStateDir, 'accounts.json'), 'utf-8'))
      ).toEqual([])
      expect(
        JSON.parse(await readFile(joinPath(fallbackWeixinStateDir, 'accounts.json'), 'utf-8'))
      ).toEqual([])
    } finally {
      if (previousUserProfile == null) delete process.env.USERPROFILE
      else process.env.USERPROFILE = previousUserProfile
      if (previousHome == null) delete process.env.HOME
      else process.env.HOME = previousHome
      await rm(defaultRoot, { recursive: true, force: true })
    }
  })

  it('does not report a path mismatch once fallback credentials have been mirrored into the active state dir', async () => {
    const previousUserProfile = process.env.USERPROFILE
    const previousHome = process.env.HOME
    const defaultRoot = await mkdtemp('/tmp/qclaw-weixin-default-diagnostic-')
    process.env.USERPROFILE = defaultRoot
    process.env.HOME = defaultRoot

    try {
      const fallbackWeixinStateDir = joinPath(defaultRoot, '.openclaw', 'openclaw-weixin')
      const fallbackAccountsDir = joinPath(fallbackWeixinStateDir, 'accounts')
      await mkdir(fallbackAccountsDir, { recursive: true })
      await writeFile(
        joinPath(fallbackWeixinStateDir, 'accounts.json'),
        JSON.stringify(['diagnostic-account'], null, 2),
        'utf-8'
      )
      await writeFile(
        joinPath(fallbackAccountsDir, 'diagnostic-account.json'),
        JSON.stringify({
          token: 'diagnostic-token',
          baseUrl: 'https://ilinkai.weixin.qq.com',
          userId: 'diagnostic@im.wechat',
        }),
        'utf-8'
      )

      await listWeixinAccountState()
      const diagnostic = await getWeixinStatePathDiagnostic()

      expect(diagnostic.activeConfiguredAccounts).toBe(1)
      expect(diagnostic.defaultConfiguredAccounts).toBe(1)
      expect(diagnostic.possiblePathMismatch).toBe(false)
    } finally {
      if (previousUserProfile == null) delete process.env.USERPROFILE
      else process.env.USERPROFILE = previousUserProfile
      if (previousHome == null) delete process.env.HOME
      else process.env.HOME = previousHome
      await rm(defaultRoot, { recursive: true, force: true })
    }
  })
})
