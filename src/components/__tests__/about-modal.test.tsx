import { describe, expect, it } from 'vitest'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

import { resolveAboutModalSocialPlaceholder, resolveAboutModalVersion } from '../AboutModal'

function readAboutModalSource(): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'AboutModal.tsx'), 'utf8')
}

describe('AboutModal', () => {
  it('prefers the packaged app version from the main-process status payload', () => {
    expect(
      resolveAboutModalVersion({
        currentVersion: ' 2.2.7 ',
      })
    ).toBe('2.2.7')
  })

  it('does not fall back to a potentially mismatched renderer package version when status is empty', () => {
    expect(resolveAboutModalVersion(null)).toBe('')
    expect(resolveAboutModalVersion({ currentVersion: '' })).toBe('')
  })

  it('renders disabled social placeholders for MetaCode studio channels', () => {
    const source = readAboutModalSource()

    expect(resolveAboutModalSocialPlaceholder('YouTube')).toContain('MetaCode \u5de5\u4f5c\u5ba4')
    expect(source).toContain('MetaCode \\u5de5\\u4f5c\\u5ba4\\u5185\\u90e8\\u6d4b\\u8bd5\\u7248')
    expect(source).toContain('aria-disabled="true"')
    expect(source).toContain('SOCIAL_CARD_PLACEHOLDER')
    expect(source).not.toContain('qrcode-wechat')
    expect(source).not.toContain('qiuzhi2046')
  })
})
