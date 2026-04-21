import { describe, expect, it } from 'vitest'
import {
  deriveFeishuTargetState,
  deriveChannelStatusBadges,
  getFeishuChannelDisplayName,
  getFeishuSharedStatusAlert,
  getFeishuDiagnosticsModalTitle,
  getFeishuPairingModalSummary,
  getChannelCardSummary,
  getChannelEnabledLabel,
  getFeishuProvisionSourceDescription,
  getFeishuRuntimeSummaryAlertColor,
  getManagedPluginStageState,
  resolveConfigTargetChannelSnapshot,
  resolveLatestChannelSnapshot,
  shouldReuseModelOptionsCache,
  shouldShowFeishuPluginRepairAction,
  shouldShowPluginStatus,
} from '../ChannelsPage'
import type { ManagedChannelPluginStatusView } from '../../shared/managed-channel-plugin-lifecycle'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

const channelsPageSource = fs.readFileSync(
  path.join(process.cwd(), 'src', 'pages', 'ChannelsPage.tsx'),
  'utf8'
)

describe('channels page state helpers', () => {
  it('uses enabled/disabled wording instead of treating config presence as readiness', () => {
    expect(getChannelEnabledLabel(true)).toBe('已启用')
    expect(getChannelEnabledLabel(false)).toBe('已停用')
  })

  it('derives shared channel status badges so the card and pairing modal reuse the same badge contract', () => {
    expect(
      deriveChannelStatusBadges(
        {
          enabled: true,
          channelId: 'feishu',
          pairingRequired: true,
          pairingState: 'paired',
          provisionSource: 'created',
          runtimeState: 'online',
        } as any,
        {
          includePairingState: true,
          includeProvisionSource: true,
        }
      )
    ).toEqual([
      { key: 'enabled', color: 'teal', label: '已启用' },
      { key: 'pairing-state', color: 'teal', label: '已连接并已配对' },
      { key: 'provision-source', color: 'blue', label: '来源：在 Mclaw 中创建' },
      { key: 'runtime-state', color: 'teal', label: '在线' },
    ])

    expect(
      deriveChannelStatusBadges(
        {
          enabled: false,
          channelId: 'wecom',
          pairingRequired: false,
          pairingState: 'not_required',
        } as any
      )
    ).toEqual([{ key: 'enabled', color: 'gray', label: '已停用' }])
  })

  it('keeps plugin status visible for any row that already carries shared managed evidence', () => {
    expect(
      shouldShowPluginStatus({
        pluginStatus: {
          channelId: 'feishu',
          pluginId: 'openclaw-lark',
          summary: 'managed plugin present',
          stages: [],
          evidence: [],
        },
      })
    ).toBe(true)

    expect(
      shouldShowPluginStatus({
        pluginStatus: null,
      })
    ).toBe(false)
  })

  it('re-exports the shared helper layer from one dedicated module while keeping the page focused on view wiring', () => {
    expect(channelsPageSource).toContain("} from './channels-page-state-helpers'")
    expect(channelsPageSource).toContain('export {')
    expect(channelsPageSource).toContain('deriveFeishuTargetState,')
    expect(channelsPageSource).toContain('deriveChannelStatusBadges,')
    expect(channelsPageSource).toContain('getFeishuChannelDisplayName,')
    expect(channelsPageSource).toContain('getFeishuDiagnosticsModalTitle,')
    expect(channelsPageSource).toContain('getFeishuPairingModalSummary,')
    expect(channelsPageSource).toContain('getChannelCardSummary,')
    expect(channelsPageSource).toContain('getFeishuProvisionSourceDescription,')
    expect(channelsPageSource).toContain('getFeishuRuntimeSummaryAlertColor,')
    expect(channelsPageSource).toContain('getManagedPluginStageState,')
    expect(channelsPageSource).toContain('resolveConfigTargetChannelSnapshot,')
    expect(channelsPageSource).toContain('resolveLatestChannelSnapshot,')
    expect(channelsPageSource).not.toContain('interface FeishuTargetStateOptions {')
    expect(channelsPageSource).not.toContain('interface FeishuTargetState {')
    expect(channelsPageSource).not.toContain('export function deriveFeishuTargetState(')
  })

  it('delegates page-level view composition to useChannelsPageViewState with the shared helper layer', () => {
    expect(channelsPageSource).toContain("import { useChannelsPageViewState } from './channels-page-view-state'")
    expect(channelsPageSource).toContain("import { channelsPageViewStateHelpers } from './channels-page-view-state-helpers'")
    expect(channelsPageSource).toContain('const {')
    expect(channelsPageSource).toContain('loading,')
    expect(channelsPageSource).toContain('topPanelProps,')
    expect(channelsPageSource).toContain('channelListPanelProps,')
    expect(channelsPageSource).toContain('channelCardsProps,')
    expect(channelsPageSource).toContain('configModalProps,')
    expect(channelsPageSource).toContain('pairingModalProps,')
    expect(channelsPageSource).toContain('modelConfigModalProps,')
    expect(channelsPageSource).toContain('diagnosticsModalProps,')
    expect(channelsPageSource).toContain('} = useChannelsPageViewState(channelsPageViewStateHelpers)')
    expect(channelsPageSource).not.toContain('} = useChannelsPageViewState({')
  })

  it('renders the shared shell from one page-level contract', () => {
    expect(channelsPageSource).toContain("import ChannelsPageShell from '../components/ChannelsPageShell'")
    expect(channelsPageSource).toContain('<ChannelsPageShell')
    expect(channelsPageSource).toContain('loading={loading}')
    expect(channelsPageSource).toContain('topPanelProps={topPanelProps}')
    expect(channelsPageSource).toContain('channelListPanelProps={channelListPanelProps}')
    expect(channelsPageSource).toContain('channelCardsProps={channelCardsProps}')
    expect(channelsPageSource).toContain('configModalProps={configModalProps}')
    expect(channelsPageSource).toContain('pairingModalProps={pairingModalProps}')
    expect(channelsPageSource).toContain('modelConfigModalProps={modelConfigModalProps}')
    expect(channelsPageSource).toContain('diagnosticsModalProps={diagnosticsModalProps}')
  })

  it('no longer directly composes core, interaction, or surface hooks inside the page component', () => {
    expect(channelsPageSource).not.toContain("import { useChannelsPageCoreControllers } from './channels-page-core-controllers'")
    expect(channelsPageSource).not.toContain("import { useChannelsPageInteractionControllers } from './channels-page-interaction-controllers'")
    expect(channelsPageSource).not.toContain("import { useChannelsPageSurfaceComposition } from './channels-page-surface-composition'")
    expect(channelsPageSource).not.toContain('} = useChannelsPageCoreControllers({')
    expect(channelsPageSource).not.toContain('} = useChannelsPageInteractionControllers({')
    expect(channelsPageSource).not.toContain('} = useChannelsPageSurfaceComposition({')
  })

  it('shows the shared Feishu plugin repair action only for Feishu bot rows', () => {
    expect(
      shouldShowFeishuPluginRepairAction({
        channelId: 'feishu',
        pairingAccountId: 'default',
        pluginStatus: null,
      })
    ).toBe(true)

    expect(
      shouldShowFeishuPluginRepairAction({
        channelId: 'wecom',
        pairingAccountId: 'default',
        pluginStatus: null,
      })
    ).toBe(false)

    expect(
      shouldShowFeishuPluginRepairAction({
        channelId: 'feishu',
        pairingAccountId: undefined,
        pluginStatus: null,
      })
    ).toBe(false)
  })

  it('hides the shared Feishu repair action once installed, registered, and ready are all verified', () => {
    expect(
      shouldShowFeishuPluginRepairAction({
        channelId: 'feishu',
        pairingAccountId: 'default',
        pluginStatus: {
          channelId: 'feishu',
          pluginId: 'openclaw-lark',
          summary: 'all managed stages verified',
          stages: [
            { id: 'installed', state: 'verified', source: 'disk', message: 'installed' },
            { id: 'registered', state: 'verified', source: 'plugins-list', message: 'registered' },
            { id: 'loaded', state: 'verified', source: 'gateway-runtime', message: 'loaded' },
            { id: 'ready', state: 'verified', source: 'gateway-runtime', message: 'ready' },
          ],
          evidence: [],
        },
      })
    ).toBe(false)
  })

  it('reads managed plugin stages by id and derives a Feishu blocking alert from shared status', () => {
    const pluginStatus: ManagedChannelPluginStatusView = {
      channelId: 'feishu',
      pluginId: 'openclaw-lark',
      summary: 'ready stage missing',
      stages: [
        { id: 'installed', state: 'verified', source: 'disk', message: 'installed' },
        { id: 'registered', state: 'verified', source: 'plugins-list', message: 'registered' },
        { id: 'loaded', state: 'verified', source: 'gateway-runtime', message: 'loaded' },
        { id: 'ready', state: 'missing', source: 'gateway-runtime', message: 'ready missing' },
      ],
      evidence: [],
    }

    expect(getManagedPluginStageState(pluginStatus, 'registered')).toBe('verified')
    expect(getManagedPluginStageState(pluginStatus, 'ready')).toBe('missing')
    expect(
      getFeishuSharedStatusAlert({
        channelId: 'feishu',
        pluginStatus,
      })
    ).toEqual({
      color: 'yellow',
      title: '飞书运行时需要修复',
      message: 'ready stage missing',
    })
  })

  it('resolves the latest selected channel snapshot after a background refresh', () => {
    const latestChannel = {
      id: 'feishu:default',
      channelId: 'feishu',
      configChannelId: 'feishu',
      name: 'Feishu Bot',
      platform: 'feishu',
      enabled: true,
      credentials: {},
      pairingRequired: true,
      pairingState: 'pending',
      pairedCount: 0,
      pairingUsers: [],
      pairingAccountId: 'default',
      pluginStatus: null,
    } as const

    expect(resolveLatestChannelSnapshot([latestChannel] as any, { id: 'feishu:default' })).toEqual(latestChannel)
    expect(resolveLatestChannelSnapshot([latestChannel] as any, { id: 'feishu:missing' })).toBeNull()
  })

  it('matches a config-target snapshot by channel id and Feishu account id', () => {
    const feishuDefault = {
      id: 'feishu:default',
      channelId: 'feishu',
      configChannelId: 'feishu',
      name: 'Default Bot',
      platform: 'feishu',
      enabled: true,
      credentials: {},
      pairingRequired: true,
      pairingState: 'pending',
      pairedCount: 0,
      pairingUsers: [],
      pairingAccountId: 'default',
      pluginStatus: null,
    } as const
    const feishuSupport = {
      ...feishuDefault,
      id: 'feishu:support',
      name: 'Support Bot',
      pairingAccountId: 'support',
    } as const

    expect(
      resolveConfigTargetChannelSnapshot([feishuDefault, feishuSupport] as any, {
        channelId: 'feishu',
        accountId: 'support',
      })
    ).toEqual(feishuSupport)

    expect(
      resolveConfigTargetChannelSnapshot([feishuDefault, feishuSupport] as any, {
        channelId: 'wecom',
        accountId: 'ignored',
      })
    ).toBeNull()
  })

  it('derives shared Feishu target state once and reuses it across modal surfaces', () => {
    const staleFallback = {
      id: 'feishu:default',
      channelId: 'feishu',
      configChannelId: 'feishu',
      name: 'Default Bot',
      platform: 'feishu',
      enabled: true,
      credentials: {},
      pairingRequired: true,
      pairingState: 'pending',
      pairedCount: 0,
      pairingUsers: [],
      pairingAccountId: 'default',
      pluginStatus: null,
    } as const

    expect(
      deriveFeishuTargetState(
        [staleFallback] as any,
        {
          channelId: 'feishu',
          accountId: 'default',
        },
        {
          refreshing: true,
          checkedKey: '',
          repairingPluginChannelId: 'feishu',
        }
      )
    ).toMatchObject({
      pairingKey: 'feishu:default',
      targetChannel: staleFallback,
      channelForSurface: staleFallback,
      repairing: true,
      statusPending: true,
      missingAfterRefresh: false,
      blockedBySharedStatus: false,
    })

    expect(
      deriveFeishuTargetState(
        [],
        {
          channelId: 'feishu',
          accountId: 'default',
        },
        {
          fallbackChannel: staleFallback as any,
          refreshing: false,
          checkedKey: 'feishu:default',
        }
      )
    ).toMatchObject({
      pairingKey: 'feishu:default',
      targetChannel: null,
      channelForSurface: staleFallback,
      canRepair: true,
      statusPending: false,
      missingAfterRefresh: true,
      blockedBySharedStatus: false,
    })
  })

  it('derives shared Feishu labels and copy for pairing and diagnostics from one helper layer', () => {
    expect(getFeishuChannelDisplayName({ accountName: 'Support Bot', name: 'ignored' } as any)).toBe('Support Bot')
    expect(getFeishuChannelDisplayName({ name: 'Fallback Bot' } as any)).toBe('Fallback Bot')
    expect(getFeishuChannelDisplayName(null, { accountName: 'Recovered Bot', name: 'ignored' } as any)).toBe('Recovered Bot')
    expect(getFeishuChannelDisplayName(null)).toBe('飞书机器人')

    expect(getFeishuDiagnosticsModalTitle({ accountName: 'Support Bot', name: 'ignored' } as any)).toBe('Support Bot 诊断')
    expect(getFeishuDiagnosticsModalTitle(null, { name: 'Recovered Bot' } as any)).toBe('Recovered Bot 诊断')

    expect(getFeishuPairingModalSummary({ pairedCount: 2, name: 'Support Bot' } as any)).toBe(
      '该机器人已有 2 个已配对账号，你可以继续输入新的配对码授权更多用户。'
    )
    expect(getFeishuPairingModalSummary({ pairedCount: 0, name: 'Support Bot' } as any)).toBe(
      '该机器人已接入 OpenClaw，但还没有用户完成配对。请先给 Support Bot 发送一条消息，然后把返回的配对码粘贴到这里。'
    )
  })

  it('derives shared channel-card copy and runtime summary styling from one helper layer', () => {
    expect(
      getChannelCardSummary(
        {
          pairingRequired: true,
          channelId: 'feishu',
          pairingState: 'paired',
        } as any,
        'Feishu'
      )
    ).toBe('该飞书机器人已连接，且已有配对用户。点击卡片可继续管理更多配对。')

    expect(
      getChannelCardSummary(
        {
          pairingRequired: false,
          channelId: 'openclaw-weixin',
          pairingState: 'not_required',
        } as any,
        'Weixin'
      )
    ).toBe('该个人微信账号当前仅支持登录中的账号自身使用，暂不支持授权给其他微信用户。')

    expect(
      getChannelCardSummary(
        {
          pairingRequired: false,
          channelId: 'discord',
          pairingState: 'not_required',
        } as any,
        'Discord'
      )
    ).toBe('Discord 渠道无需额外配对。')

    expect(getFeishuProvisionSourceDescription('created')).toBe('该机器人通过 Mclaw 应用内的“创建机器人”流程接入。')
    expect(getFeishuProvisionSourceDescription('linked')).toBe('该机器人通过“关联已有机器人”流程接入。')
    expect(getFeishuProvisionSourceDescription('unknown')).toBe('该机器人最初的接入来源暂未记录。')

    expect(getFeishuRuntimeSummaryAlertColor('online')).toBe('green')
    expect(getFeishuRuntimeSummaryAlertColor('degraded')).toBe('yellow')
    expect(getFeishuRuntimeSummaryAlertColor('offline')).toBe('red')
  })

  it('does not reuse cached model options when the Feishu modal requests the full models-page scope', () => {
    expect(shouldReuseModelOptionsCache()).toBe(true)
    expect(shouldReuseModelOptionsCache({ mode: 'available' })).toBe(true)
    expect(shouldReuseModelOptionsCache({ mode: 'all' })).toBe(false)
    expect(shouldReuseModelOptionsCache({ forceRefresh: true })).toBe(false)
  })

  it('reuses the shared model catalog path for Feishu model config instead of forcing a refresh', () => {
    const modelConfigSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'pages', 'channels-page-model-config.ts'),
      'utf8'
    )

    expect(modelConfigSource).toMatch(/loadModelOptions\(\{[\s\S]*statusData,[\s\S]*preferredModelKey:\s*nextRuntimeModel/s)
    expect(modelConfigSource).not.toMatch(/loadModelOptions\(\{\s*forceRefresh:\s*true/s)
  })

  it('loads env and config snapshots so the Feishu model modal can reuse the models page full catalog scope', () => {
    const modelConfigSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'pages', 'channels-page-model-config.ts'),
      'utf8'
    )

    expect(modelConfigSource).toContain('window.api.readEnvFile()')
    expect(modelConfigSource).toContain("mode: 'all'")
    expect(modelConfigSource).toContain('envVars')
    expect(modelConfigSource).toContain('configData')
  })
})
