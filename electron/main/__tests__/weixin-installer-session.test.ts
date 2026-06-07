import { describe, expect, it } from 'vitest'

const { readFile } = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

describe('weixin-installer-session source guards', () => {
  it('passes OPENCLAW_STATE_DIR through to the installer subprocess environment', async () => {
    const source = await readFile(path.join(process.cwd(), 'electron/main/weixin-installer-session.ts'), 'utf8')

    expect(source).toContain('const openClawStateDir = process.env.OPENCLAW_STATE_DIR')
    expect(source).toContain("...(openClawStateDir ? { OPENCLAW_STATE_DIR: openClawStateDir } : {}),")
    expect(source).toContain("OPENCLAW_WEIXIN_SKIP_CONFIG_RELOAD: '1',")
    expect(source).toContain("[bundledOpenClawCli, 'channels', 'login', '--channel', 'openclaw-weixin']")
  })

  it('persists the scanned wechat user into allowFrom during successful login', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'resources/openclaw-bundle/managed-plugins/openclaw-weixin/src/channel.ts'),
      'utf8',
    )

    expect(source).toContain('import { registerUserInFrameworkStore } from "./auth/pairing.js";')
    expect(source).toContain('await registerUserInFrameworkStore({')
    expect(source).toContain('accountId: normalizedId,')
    expect(source).toContain('userId: waitResult.userId,')
    expect(source).toContain('userId: result.userId,')
  })
})
