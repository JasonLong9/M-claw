import { describe, expect, it } from 'vitest'
import { resolveGatewayBootstrapFailureView } from '../gateway-bootstrap-diagnostics'
import { createInMemoryTrace } from '../gateway-diagnostics-trace'

describe('resolveGatewayBootstrapFailureView', () => {
  it('explains auth-like failures in user-friendly language', () => {
    const view = resolveGatewayBootstrapFailureView({
      stderr: 'Gateway 启动命令已执行，但系统仍未确认网关已经准备完成',
      diagnostics: {
        lastHealth: {
          running: false,
          stderr: 'missing api key',
        },
        doctor: {
          ok: false,
          stdout: 'doctor: provider auth missing',
          stderr: '',
          code: 1,
        },
      },
    })

    expect(view.title).toContain('模型认证')
    expect(view.detail).toContain('API Key')
  })

  it('detects network-like failures', () => {
    const view = resolveGatewayBootstrapFailureView({
      diagnostics: {
        lastHealth: {
          running: false,
          stderr: 'connect ETIMEDOUT api.openai.com',
        },
        doctor: {
          ok: false,
          stdout: 'dns timeout',
          stderr: '',
          code: 1,
        },
      },
    })

    expect(view.title).toContain('网络')
    expect(view.hints[0]).toContain('网络')
  })

  it('falls back to a generic summary when no strong signal is available', () => {
    const view = resolveGatewayBootstrapFailureView({
      stderr: 'Gateway 启动命令已执行，但系统仍未确认网关已经准备完成',
    })

    expect(view.title).toContain('还没有完成就绪确认')
    expect(view.hints.length).toBeGreaterThan(0)
  })

  it('prefers structured port-conflict state when available', () => {
    const view = resolveGatewayBootstrapFailureView({
      stateCode: 'port_conflict_foreign_process',
      evidence: [
        {
          source: 'port-owner',
          message: '检测到 Gateway 端口占用进程',
          owner: {
            kind: 'foreign',
            port: 18789,
            processName: 'python3',
            pid: 2451,
            command: 'python3 -m http.server',
            source: 'lsof',
          },
        },
      ],
    })

    expect(view.title).toContain('端口占用')
    expect(view.detail).toContain('python3')
  })

  it('prefers service-missing guidance over websocket auth wording when doctor reports service not installed', () => {
    const view = resolveGatewayBootstrapFailureView({
      stateCode: 'websocket_1006',
      diagnostics: {
        lastHealth: {
          running: false,
          stderr: 'gateway closed (1006 abnormal closure (no close frame)): no close reason',
        },
        doctor: {
          ok: false,
          stdout: 'Gateway not running.\nGateway service not installed.',
          stderr: '',
          code: 1,
        },
      },
    })

    expect(view.title).toContain('后台服务')
    expect(view.detail).toContain('后台服务')
  })

  it('prefers upstream control-ui device token guidance when the control ui returns a structured mismatch reason', () => {
    const view = resolveGatewayBootstrapFailureView({
      stateCode: 'websocket_1006',
      diagnostics: {
        controlUiApp: {
          source: 'control-ui-app',
          connected: false,
          hasClient: true,
          lastError: 'device_token_mismatch',
          appKeys: ['client', 'connected', 'lastError'],
        },
      },
    })

    expect(view.title).toContain('设备令牌')
    expect(view.detail).toContain('device token')
  })

  it('prefers generic upstream control-ui guidance over the old auth fallback for other structured upstream reasons', () => {
    const view = resolveGatewayBootstrapFailureView({
      stateCode: 'websocket_1006',
      diagnostics: {
        controlUiApp: {
          source: 'control-ui-app',
          connected: false,
          hasClient: true,
          lastError: 'control_ui_connection_timeout',
          appKeys: ['client', 'connected', 'lastError'],
        },
      },
    })

    expect(view.title).toContain('更具体的连接原因')
    expect(view.detail).toContain('超时')
    expect(view.detail).not.toContain('Gateway')
  })

  it('shows a soft warning style explanation for plugin allowlist warnings', () => {
    const view = resolveGatewayBootstrapFailureView({
      stderr:
        'plugins.allow is empty; discovered non-bundled plugins may auto-load: openclaw-lark (/Users/test/.openclaw/extensions/openclaw-lark/index.js). Set plugins.allow to explicit trusted ids.',
    })

    expect(view.title).toContain('allowlist')
    expect(view.detail).toContain('不等于插件本身加载失败')
  })

  it('populates trace with the resolve view path when trace is provided', () => {
    const { trace, entries } = createInMemoryTrace()
    resolveGatewayBootstrapFailureView({ stderr: 'missing api key' }, trace)

    const all = entries()
    expect(all.length).toBeGreaterThanOrEqual(1)
    // Should contain classify, resolve_view, and corpus phases
    const phases = all.map(e => e.phase)
    expect(phases).toContain('classify')
    expect(phases).toContain('resolve_view')
    expect(phases).toContain('corpus')
  })

  it('records structured stateCode branch in trace', () => {
    const { trace, entries } = createInMemoryTrace()
    resolveGatewayBootstrapFailureView({
      stateCode: 'token_mismatch',
      evidence: [],
    }, trace)

    const all = entries()
    const resolveEntries = all.filter(e => e.phase === 'resolve_view')
    expect(resolveEntries.length).toBeGreaterThanOrEqual(1)
    expect(resolveEntries.some(e => e.result === '这台机器上的模型认证还没准备好')).toBe(true)
  })

  it('records service signal override in trace', () => {
    const { trace, entries } = createInMemoryTrace()
    resolveGatewayBootstrapFailureView({
      stateCode: 'token_mismatch',
      diagnostics: {
        doctor: {
          ok: false,
          stdout: 'Gateway service not installed',
          stderr: '',
          code: 1,
        },
      },
    }, trace)

    const all = entries()
    expect(all.some(e => e.step === 'service_signal_override')).toBe(true)
  })

  it('does not throw when trace is omitted (backward compatible)', () => {
    const view = resolveGatewayBootstrapFailureView({ stderr: 'some error' })
    expect(view.title).toContain('还没有完成就绪确认')
  })

  it('records search corpus in resolve view trace with sanitized content', () => {
    const { trace, entries } = createInMemoryTrace()
    resolveGatewayBootstrapFailureView({ stderr: 'missing api key' }, trace)

    const corpusEntries = entries().filter(e => e.phase === 'corpus' && e.step === 'resolve_view_corpus')
    expect(corpusEntries.length).toBe(1)
    expect(corpusEntries[0].corpus_snippet).toContain('missing api key')
  })
})
