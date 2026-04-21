import { describe, expect, it } from 'vitest'

import { resolveFeishuRegistrationBaseUrl } from '../feishu-managed-create-flow'

describe('resolveFeishuRegistrationBaseUrl', () => {
  it('uses the Feishu accounts host for the managed create registration handshake', () => {
    expect(resolveFeishuRegistrationBaseUrl('feishu')).toBe('https://accounts.feishu.cn')
  })

  it('uses the Lark accounts host once the managed flow switches to the Lark tenant brand', () => {
    expect(resolveFeishuRegistrationBaseUrl('lark')).toBe('https://accounts.larksuite.com')
  })
})
