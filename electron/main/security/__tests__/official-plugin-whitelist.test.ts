import { describe, expect, it } from 'vitest'

import { ensureOfficialPluginWhitelistEntries } from '../official-plugin-whitelist'
import { verifyPlugin } from '../whitelist'

describe('official plugin whitelist bootstrap', () => {
  it('allows managed official plugins from trusted sources after bootstrap', () => {
    ensureOfficialPluginWhitelistEntries()

    const result = verifyPlugin(
      'wecom-openclaw-plugin',
      '@wecom/wecom-openclaw-cli install',
      '/trusted/extensions/wecom-openclaw-plugin'
    )

    expect(result.allowed).toBe(true)
  })
})
