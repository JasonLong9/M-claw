import { describe, expect, it } from 'vitest'
import { classifyGatewayRuntimeState } from '../gateway-runtime-diagnostics'
import { createInMemoryTrace } from '../gateway-diagnostics-trace'

describe('classifyGatewayRuntimeState', () => {
  it('classifies service-missing failures', () => {
    const result = classifyGatewayRuntimeState({
      stderr: 'Gateway service not loaded.',
    })

    expect(result.stateCode).toBe('service_missing')
    expect(result.safeToRetry).toBe(true)
  })

  it('classifies token mismatch failures', () => {
    const result = classifyGatewayRuntimeState({
      diagnostics: {
        lastHealth: {
          stderr: 'gateway token mismatch',
        },
      },
    })

    expect(result.stateCode).toBe('token_mismatch')
  })

  it('classifies websocket 1006 failures', () => {
    const result = classifyGatewayRuntimeState({
      stderr: 'WebSocket 1006 abnormal closure',
    })

    expect(result.stateCode).toBe('websocket_1006')
  })

  it('prioritizes config_invalid when the same failure also includes a follow-up websocket 1006 closure', () => {
    const result = classifyGatewayRuntimeState({
      stderr: [
        'Config invalid',
        'File: ~/.openclaw/openclaw.json',
        'Problem:',
        '  - channels.openclaw-weixin: unknown channel id: openclaw-weixin',
        'Run: openclaw doctor --fix',
        '[openclaw] Failed to start CLI: Error: gateway closed (1006 abnormal closure (no close frame)): no close reason',
      ].join('\n'),
    })

    expect(result.stateCode).toBe('config_invalid')
    expect(result.safeToRetry).toBe(false)
  })

  it('does not treat permission failures mentioning openclaw.json as config_invalid', () => {
    const result = classifyGatewayRuntimeState({
      stderr:
        "Failed to read config at /Users/tester/.openclaw/openclaw.json Error: EACCES: permission denied, open '/Users/tester/.openclaw/openclaw.json'",
    })

    expect(result.stateCode).toBe('unknown_runtime_failure')
    expect(result.summary).toContain('权限')
    expect(result.safeToRetry).toBe(false)
  })

  it('preserves upstream control-ui reason details before collapsing to websocket wording', () => {
    const result = classifyGatewayRuntimeState({
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

    expect(result.stateCode).toBe('websocket_1006')
    expect(result.summary).toBe('控制界面与本机服务的 device token 不一致')
    expect(result.reasonDetail).toMatchObject({
      source: 'control-ui-app',
      code: 'device_token_mismatch',
    })
    expect(result.evidence.some((item) => item.source === 'control-ui-app')).toBe(true)
  })

  it('downgrades known plugin allowlist warnings to a non-blocking state', () => {
    const result = classifyGatewayRuntimeState({
      stderr:
        'plugins.allow is empty; discovered non-bundled plugins may auto-load: openclaw-lark (/Users/test/.openclaw/extensions/openclaw-lark/index.js). Set plugins.allow to explicit trusted ids.',
    })

    expect(result.stateCode).toBe('plugin_allowlist_warning')
    expect(result.safeToRetry).toBe(true)
  })

  it('reuses nested health summaries for structured state codes', () => {
    const result = classifyGatewayRuntimeState({
      diagnostics: {
        lastHealth: {
          stateCode: 'websocket_1006',
          summary: '本机服务与上游的连接被异常关闭',
        },
      },
    })

    expect(result.stateCode).toBe('websocket_1006')
    expect(result.summary).toBe('本机服务与上游的连接被异常关闭')
  })

  it('classifies foreign port owners as port_conflict_foreign_process', () => {
    const result = classifyGatewayRuntimeState({
      stderr: 'Port 18789 is already in use',
      portOwner: {
        kind: 'foreign',
        port: 18789,
        processName: 'python3',
        pid: 2451,
        command: 'python3 -m http.server',
        source: 'lsof',
      },
    })

    expect(result.stateCode).toBe('port_conflict_foreign_process')
    expect(result.evidence.some((item) => item.source === 'port-owner')).toBe(true)
  })

  it('populates trace with the matched branch when trace is provided', () => {
    const { trace, entries } = createInMemoryTrace()
    classifyGatewayRuntimeState({ stderr: 'Gateway service not loaded.' }, trace)

    const all = entries()
    expect(all.length).toBeGreaterThanOrEqual(1)
    const last = all[all.length - 1]
    expect(last.phase).toBe('classify')
    expect(last.step).toBe('corpus_service_missing')
    expect(last.result).toBe('service_missing')
  })

  it('records fallback branch in trace when no signal matches', () => {
    const { trace, entries } = createInMemoryTrace()
    classifyGatewayRuntimeState({ stderr: 'some random unrelated output' }, trace)

    const all = entries()
    const last = all[all.length - 1]
    expect(last.phase).toBe('classify')
    expect(last.step).toBe('fallback')
    expect(last.result).toBe('unknown_runtime_failure')
  })

  it('records explicit stateCode path in trace with corpus', () => {
    const { trace, entries } = createInMemoryTrace()
    classifyGatewayRuntimeState({
      stateCode: 'token_mismatch',
      summary: 'Token mismatch detected',
    }, trace)

    const all = entries()
    // Should have corpus entry followed by explicit_state_code entry
    expect(all.some(e => e.phase === 'corpus')).toBe(true)
    const last = all[all.length - 1]
    expect(last.step).toBe('explicit_state_code')
    expect(last.result).toBe('token_mismatch')
  })

  it('does not throw when trace is omitted (backward compatible)', () => {
    const result = classifyGatewayRuntimeState({ ok: true, running: true })
    expect(result.stateCode).toBe('healthy')
  })

  it('records sanitized corpus in trace', () => {
    const { trace, entries } = createInMemoryTrace()
    classifyGatewayRuntimeState({ stderr: 'Gateway service not loaded.' }, trace)

    const corpusEntries = entries().filter(e => e.phase === 'corpus')
    expect(corpusEntries.length).toBe(1)
    expect(corpusEntries[0].corpus_snippet).toContain('gateway service not loaded')
  })

  it('classifies bundled runtime deployment failures as config_invalid, not plugin_load_failure', () => {
    const result = classifyGatewayRuntimeState({
      stderr: [
        '检测到内置 openclaw runtime 本体，但当前源布局不完整，无法执行 windows runtime 接管。',
        'source package manifest: (missing)',
        'bundled manifest path: g:\\m-claw\\resources\\openclaw-bundle\\manifest.json',
        '检测到内置 openclaw 载荷，但本地安装失败，已回退在线安装流程。',
        'openclaw cli 安装失败，已按镜像顺序自动重试。',
      ].join('\n'),
    })

    expect(result.stateCode).toBe('config_invalid')
    expect(result.summary).toContain('部署失败')
    expect(result.safeToRetry).toBe(false)
  })

  it('classifies MODULE_NOT_FOUND for openclaw.mjs as runtime deployment failure', () => {
    const result = classifyGatewayRuntimeState({
      stderr: [
        "Error: Cannot find module 'g:\\m-claw\\resources\\openclaw-bundle\\runtime\\windows-x64\\node_modules\\openclaw\\openclaw.mjs'",
        "  code: 'MODULE_NOT_FOUND'",
      ].join('\n'),
    })

    expect(result.stateCode).toBe('config_invalid')
    expect(result.summary).toContain('部署失败')
  })

  it('classifies ERR_MODULE_NOT_FOUND for missing openclaw dependency as deployment failure', () => {
    const result = classifyGatewayRuntimeState({
      stderr: [
        "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'zod' imported from g:\\m-claw\\resources\\openclaw-bundle\\runtime\\windows-x64\\node_modules\\openclaw\\dist\\zod-schema.js",
        "  code: 'ERR_MODULE_NOT_FOUND'",
      ].join('\n'),
    })

    expect(result.stateCode).toBe('config_invalid')
    expect(result.summary).toContain('部署失败')
  })

  it('sanitizes sensitive data from corpus in trace', () => {
    const { trace, entries } = createInMemoryTrace()
    classifyGatewayRuntimeState({
      stderr: 'unauthorized: Bearer sk-abc123xyz789 secret',
    }, trace)

    const corpusEntries = entries().filter(e => e.phase === 'corpus')
    expect(corpusEntries[0].corpus_snippet).not.toContain('sk-abc123xyz789')
    expect(corpusEntries[0].corpus_snippet).toContain('<redacted>')
  })
})
