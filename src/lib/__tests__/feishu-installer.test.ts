import { describe, expect, it } from 'vitest'
import {
  extractFeishuLiveQrUrl,
  FEISHU_LIVE_QR_URL_MARKER,
  FEISHU_OFFICIAL_GUIDE_URL,
} from '../feishu-installer'

describe('extractFeishuLiveQrUrl', () => {
  it('accepts the machine-readable current-session qr marker emitted by Mclaw', () => {
    expect(
      extractFeishuLiveQrUrl(
        `[Qclaw] 本次安装器二维码已生成\n${FEISHU_LIVE_QR_URL_MARKER} https://open.feishu.cn/mock-qr`
      )
    ).toBe('https://open.feishu.cn/mock-qr')
  })

  it('rejects the official guide url so docs links are not mistaken for the current qr', () => {
    expect(extractFeishuLiveQrUrl(`Guide: ${FEISHU_OFFICIAL_GUIDE_URL}`)).toBe('')
  })

  it('rejects unrelated github or npm changelog urls', () => {
    expect(
      extractFeishuLiveQrUrl(
        'npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.12.1'
      )
    ).toBe('')
  })

  it('still accepts likely official oauth qr urls even without the explicit marker', () => {
    expect(
      extractFeishuLiveQrUrl(
        'Scan here: https://accounts.larksuite.com/oauth/authorize?device_code=abc123'
      )
    ).toBe('https://accounts.larksuite.com/oauth/authorize?device_code=abc123')
  })
})
