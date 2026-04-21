import { describe, expect, it } from 'vitest'

import {
  FEISHU_INSTALL_TUTORIAL_STEPS,
  getFeishuInstallTutorialPrimaryActionLabel,
} from '../feishu-install-tutorial'

describe('FEISHU_INSTALL_TUTORIAL_STEPS', () => {
  it('keeps the tutorial steps on readable Chinese copy for the first and last milestones', () => {
    expect(FEISHU_INSTALL_TUTORIAL_STEPS[0]?.title).toBe('第 1 步：进入渠道配置')
    expect(FEISHU_INSTALL_TUTORIAL_STEPS[6]?.title).toBe('第 7 步：发送消息验证')
  })

  it('keeps the scan-step note focused on the current installer qr instead of a fallback qr', () => {
    expect(FEISHU_INSTALL_TUTORIAL_STEPS[2]?.note).toBe(
      '如果当前还没有出现“本次安装器二维码”，请先等待安装器继续输出；只有看到当前会话生成的二维码后再扫码。教程截图里的二维码只是示意图，不要直接扫描。'
    )
  })
})

describe('getFeishuInstallTutorialPrimaryActionLabel', () => {
  it('uses 下一步 before the last step and 完成 on the last step', () => {
    expect(getFeishuInstallTutorialPrimaryActionLabel(0)).toBe('下一步')
    expect(getFeishuInstallTutorialPrimaryActionLabel(FEISHU_INSTALL_TUTORIAL_STEPS.length - 1)).toBe('完成')
  })
})

