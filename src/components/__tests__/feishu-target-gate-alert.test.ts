import { describe, expect, it } from 'vitest'

import gateAlertSource from '../FeishuTargetGateAlert.tsx?raw'
import { getFeishuTargetGateAlertCopy } from '../FeishuTargetGateAlert'

describe('FeishuTargetGateAlert', () => {
  it('keeps the shared pending, missing, and blocked copy aligned across Feishu surfaces', () => {
    expect(getFeishuTargetGateAlertCopy('pending', 'config-pairing')).toEqual({
      color: 'blue',
      title: '正在检查飞书运行时状态',
      message: 'Mclaw 正在刷新飞书共享运行时状态，完成后再打开配对表单。',
    })

    expect(getFeishuTargetGateAlertCopy('missing', 'config-pairing')).toEqual({
      color: 'yellow',
      title: '暂未找到刚接入的机器人',
      message: 'Mclaw 已刷新渠道列表，但在最新共享状态里仍然没有找到这个飞书机器人。',
      detail: '你可以在这里重试刷新共享状态，或先回到接入步骤再继续配对。',
      secondaryLabel: '返回接入步骤',
    })

    expect(getFeishuTargetGateAlertCopy('missing', 'pairing-modal')).toEqual({
      color: 'yellow',
      title: '已选机器人不存在了',
      message: 'Mclaw 已刷新渠道列表，但这个飞书机器人已不再出现在最新共享状态中。',
      detail: '你可以在这里重试刷新共享状态，或关闭这个配对窗口后返回渠道列表。',
      secondaryLabel: '关闭配对',
    })

    expect(getFeishuTargetGateAlertCopy('missing', 'diagnostics')).toEqual({
      color: 'yellow',
      title: '已选机器人不存在了',
      message: 'Mclaw 已刷新渠道列表，但这个飞书机器人已不再出现在最新共享状态中。',
      detail: '你可以在这里重试刷新共享状态，或关闭诊断后返回渠道列表。',
      secondaryLabel: '关闭诊断',
    })

    expect(getFeishuTargetGateAlertCopy('blocked', 'pairing-modal')).toEqual({
      color: 'yellow',
      title: '配对已阻塞',
      message: '请先修复共享飞书运行时。共享状态刷新完成且阻塞解除后，配对表单会自动在这里恢复。',
    })
  })

  it('renders a shared alert shell for loader, recovery actions, and blocked pairing states', () => {
    expect(gateAlertSource).toContain("export type FeishuTargetGateSurface = 'config-pairing' | 'pairing-modal' | 'diagnostics'")
    expect(gateAlertSource).toContain("export type FeishuTargetGateState = 'pending' | 'missing' | 'blocked'")
    expect(gateAlertSource).toContain("if (state === 'pending')")
    expect(gateAlertSource).toContain("if (state === 'blocked')")
    expect(gateAlertSource).toContain('<Loader size="sm" />')
    expect(gateAlertSource).toContain('刷新机器人状态')
    expect(gateAlertSource).toContain('onClick={onRefresh}')
    expect(gateAlertSource).toContain('onClick={onSecondaryAction}')
    expect(gateAlertSource).toContain('{copy.secondaryLabel}')
  })
})
