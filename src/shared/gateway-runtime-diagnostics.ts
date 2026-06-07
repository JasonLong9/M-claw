import {
  type GatewayControlUiAppDiagnostics,
  type GatewayPortOwner,
  type GatewayRuntimeClassification,
  type GatewayRuntimeEvidence,
  type GatewayRuntimeReasonDetail,
  type GatewayRuntimeStateCode,
} from './gateway-runtime-state'
import {
  buildGatewayRuntimeReasonDetailFromControlUi,
  sanitizeGatewayRuntimeReasonDetail,
} from './gateway-runtime-reason-detail'
import type { DiagnosticsTrace } from './gateway-diagnostics-trace'
import { sanitizeDiagnosticsText } from './gateway-diagnostics-trace'

interface GatewayRuntimeLike {
  ok?: boolean
  running?: boolean
  stdout?: string
  stderr?: string
  summary?: string
  stateCode?: GatewayRuntimeStateCode
  reasonDetail?: GatewayRuntimeReasonDetail | null
  evidence?: GatewayRuntimeEvidence[]
  diagnostics?: {
    lastHealth?: {
      raw?: string
      stderr?: string
      stateCode?: GatewayRuntimeStateCode
      summary?: string
    } | null
    doctor?: {
      stdout?: string
      stderr?: string
    } | null
    controlUiApp?: GatewayControlUiAppDiagnostics | null
  }
  portOwner?: GatewayPortOwner | null
}

function joinNonEmpty(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n')
}

function resolveExplicitSummary(input: GatewayRuntimeLike): string {
  const reasonDetail =
    sanitizeGatewayRuntimeReasonDetail(input.reasonDetail) ||
    buildGatewayRuntimeReasonDetailFromControlUi(input.diagnostics?.controlUiApp)
  return (
    String(input.summary || '').trim() ||
    String(reasonDetail?.message || '').trim() ||
    String(input.diagnostics?.lastHealth?.summary || '').trim() ||
    'Gateway 运行状态已结构化识别'
  )
}

function buildCorpus(input: GatewayRuntimeLike): string {
  return joinNonEmpty([
    input.stderr,
    input.stdout,
    input.diagnostics?.lastHealth?.stderr,
    input.diagnostics?.lastHealth?.raw,
    input.diagnostics?.doctor?.stderr,
    input.diagnostics?.doctor?.stdout,
    input.diagnostics?.controlUiApp?.lastError,
  ]).toLowerCase()
}

function isPluginAllowlistWarning(corpus: string): boolean {
  return (
    /plugins?\.allow is empty/i.test(corpus) &&
    /discovered non-bundled plugins may auto-load/i.test(corpus)
  )
}

function hasHighConfidenceConfigInvalidSignal(corpus: string): boolean {
  return (
    /\bconfig invalid\b/i.test(corpus) ||
    /unknown channel id/i.test(corpus) ||
    /gateway aborted: config is invalid/i.test(corpus)
  )
}

function hasFilesystemPermissionSignal(corpus: string): boolean {
  return /\beacces\b|\beperm\b|permission denied|operation not permitted/i.test(corpus)
}

function hasRuntimeDeploymentFailureSignal(corpus: string): boolean {
  return /openclaw cli 安装失败|已按镜像顺序自动重试|本地安装失败，已回退在线安装流程|检测到内置 openclaw 载荷，但本地安装失败|gateway 配置不兼容/i.test(corpus) ||
    /(?:err_)?module_not_found|cannot find (?:module|package).*openclaw/i.test(corpus)
}

function buildEvidence(
  input: GatewayRuntimeLike,
  stateCode: GatewayRuntimeStateCode,
  summary: string,
  reasonDetail: GatewayRuntimeReasonDetail | null
): GatewayRuntimeEvidence[] {
  const evidence: GatewayRuntimeEvidence[] = []

  if (input.stderr || input.stdout) {
    evidence.push({
      source: input.running ? 'health' : 'start',
      message: summary,
      detail: joinNonEmpty([input.stderr, input.stdout]).slice(0, 2000),
    })
  }

  if (input.diagnostics?.doctor?.stderr || input.diagnostics?.doctor?.stdout) {
    evidence.push({
      source: 'doctor',
      message: `doctor 命中了 ${stateCode}`,
      detail: joinNonEmpty([
        input.diagnostics?.doctor?.stderr,
        input.diagnostics?.doctor?.stdout,
      ]).slice(0, 2000),
    })
  }

  if (input.diagnostics?.controlUiApp?.lastError || reasonDetail) {
    evidence.push({
      source: 'control-ui-app',
      message: reasonDetail?.message || 'OpenClaw Control UI 返回了结构化连接错误',
      detail: joinNonEmpty([
        input.diagnostics?.controlUiApp?.lastError,
        Array.isArray(input.diagnostics?.controlUiApp?.appKeys) &&
        input.diagnostics?.controlUiApp?.appKeys.length > 0
          ? `appKeys=${input.diagnostics?.controlUiApp?.appKeys.join(',')}`
          : '',
        typeof input.diagnostics?.controlUiApp?.connected === 'boolean'
          ? `connected=${String(input.diagnostics?.controlUiApp?.connected)}`
          : '',
        typeof input.diagnostics?.controlUiApp?.hasClient === 'boolean'
          ? `hasClient=${String(input.diagnostics?.controlUiApp?.hasClient)}`
          : '',
      ]).slice(0, 2000),
    })
  }

  if (input.portOwner) {
    evidence.push({
      source: 'port-owner',
      message: '检测到 Gateway 端口占用进程',
      detail: joinNonEmpty([
        input.portOwner.processName,
        input.portOwner.command,
        input.portOwner.pid ? `pid=${input.portOwner.pid}` : '',
      ]),
      port: input.portOwner.port,
      owner: input.portOwner,
    })
  }

  if (Array.isArray(input.evidence) && input.evidence.length > 0) {
    evidence.push(...input.evidence)
  }

  return evidence
}

function buildClassification(
  input: GatewayRuntimeLike,
  stateCode: GatewayRuntimeStateCode,
  summary: string,
  safeToRetry: boolean,
  reasonDetail: GatewayRuntimeReasonDetail | null = null
): GatewayRuntimeClassification {
  return {
    stateCode,
    summary,
    safeToRetry,
    evidence: buildEvidence(input, stateCode, summary, reasonDetail),
    reasonDetail,
  }
}

export function classifyGatewayRuntimeState(
  input: unknown,
  trace?: DiagnosticsTrace,
): GatewayRuntimeClassification {
  const typed = (input && typeof input === 'object' ? input : {}) as GatewayRuntimeLike
  const reasonDetail =
    sanitizeGatewayRuntimeReasonDetail(typed.reasonDetail) ||
    buildGatewayRuntimeReasonDetailFromControlUi(typed.diagnostics?.controlUiApp)
  const explicitStateCode = typed.stateCode || typed.diagnostics?.lastHealth?.stateCode

  const corpus = buildCorpus(typed)
  trace?.add({
    phase: 'corpus',
    step: 'input',
    decision: corpus ? `corpus length=${corpus.length}` : 'corpus empty',
    result: 'corpus_recorded',
    corpus_snippet: sanitizeDiagnosticsText(corpus, 2000),
  })

  if (explicitStateCode && explicitStateCode !== 'unknown_runtime_failure') {
    if (explicitStateCode === 'plugin_load_failure' && isPluginAllowlistWarning(corpus)) {
      const hasHardPluginFailureSignal =
        /failed to load plugin|plugin not found|unknown channel id|manifest.*(invalid|mismatch)|export id/i.test(corpus)
      if (!hasHardPluginFailureSignal) {
        const explicitSummary = resolveExplicitSummary(typed)
        trace?.add({
          phase: 'classify',
          step: 'explicit_state_code_downgrade_allowlist',
          decision: 'explicit plugin_load_failure downgraded to plugin_allowlist_warning (no hard plugin failure signal)',
          result: 'plugin_allowlist_warning',
        })
        return buildClassification(
          typed,
          'plugin_allowlist_warning',
          explicitSummary || 'Gateway 检测到外部插件 allowlist 提示',
          true,
          reasonDetail
        )
      }
    }

    const explicitSummary = resolveExplicitSummary(typed)
    trace?.add({
      phase: 'classify',
      step: 'explicit_state_code',
      decision: `explicit stateCode=${explicitStateCode}`,
      result: explicitStateCode,
    })
    return buildClassification(
      typed,
      explicitStateCode,
      explicitSummary,
      explicitStateCode !== 'config_invalid',
      reasonDetail
    )
  }

  if (typed.ok && (typed.running ?? true)) {
    trace?.add({
      phase: 'classify',
      step: 'healthy',
      decision: 'ok=true, running=true',
      result: 'healthy',
    })
    return buildClassification(typed, 'healthy', 'Gateway 已确认可用', true, reasonDetail)
  }

  const portOwner = typed.portOwner
  const hasPortConflictSignal =
    /\beaddrinuse\b|address already in use|port\b.*in use|listen\b.*in use|bind\b.*failed|already running locally/i.test(
      corpus
    ) || Boolean(portOwner && portOwner.kind !== 'none' && portOwner.kind !== 'unknown')

  if (hasPortConflictSignal) {
    if (portOwner?.kind === 'gateway' || portOwner?.kind === 'openclaw') {
      trace?.add({
        phase: 'classify',
        step: 'corpus_port_conflict',
        decision: `portOwner.kind=${portOwner?.kind}`,
        result: 'port_conflict_same_gateway',
      })
      return buildClassification(
        typed,
        'port_conflict_same_gateway',
        'Gateway 端口被现有 OpenClaw/Gateway 进程占用',
        true
      )
    }

    trace?.add({
      phase: 'classify',
      step: 'corpus_port_conflict',
      decision: `portOwner.kind=${portOwner?.kind}`,
      result: 'port_conflict_foreign_process',
    })
    return buildClassification(
      typed,
      'port_conflict_foreign_process',
      'Gateway 端口被其他进程占用',
      true
    )
  }

  if (/gateway service not loaded/i.test(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_service_missing', decision: 'matched: gateway service not loaded', result: 'service_missing' })
    return buildClassification(typed, 'service_missing', 'Gateway 后台服务未安装或未加载', true)
  }

  if (/service install failed|failed to install gateway service/i.test(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_service_install_failed', decision: 'matched: service install failed', result: 'service_install_failed' })
    return buildClassification(typed, 'service_install_failed', 'Gateway 后台服务补装失败', true)
  }

  if (/service appears loaded|service failed|launchctl|daemon/i.test(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_service_stale', decision: 'matched: service stale/failed/launchctl', result: 'service_loaded_but_stale' })
    return buildClassification(typed, 'service_loaded_but_stale', 'Gateway 后台服务存在但状态异常', true, reasonDetail)
  }

  if (reasonDetail?.source === 'control-ui-app') {
    if (reasonDetail.code === 'gateway_auth_token_mismatch' || reasonDetail.code === 'token_mismatch') {
      trace?.add({ phase: 'classify', step: 'control_ui_reason', decision: `control-ui-app code=${reasonDetail.code}`, result: 'token_mismatch' })
      return buildClassification(typed, 'token_mismatch', reasonDetail.message, true, reasonDetail)
    }

    trace?.add({ phase: 'classify', step: 'control_ui_reason', decision: `control-ui-app code=${reasonDetail.code}`, result: 'websocket_1006' })
    return buildClassification(typed, 'websocket_1006', reasonDetail.message, true, reasonDetail)
  }

  if (/gateway token mismatch|token mismatch/i.test(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_token_mismatch', decision: 'matched: token mismatch in corpus', result: 'token_mismatch' })
    return buildClassification(typed, 'token_mismatch', 'Gateway 正在使用的 token 与当前配置不一致', true, reasonDetail)
  }

  if (hasFilesystemPermissionSignal(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_permission', decision: 'matched: EACCES/EPERM in corpus', result: 'unknown_runtime_failure' })
    return buildClassification(typed, 'unknown_runtime_failure', '当前机器没有足够权限访问 OpenClaw 配置或运行目录', false, reasonDetail)
  }

  if (hasHighConfidenceConfigInvalidSignal(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_config_invalid_signal', decision: 'matched: high confidence config invalid', result: 'config_invalid' })
    return buildClassification(typed, 'config_invalid', 'Gateway 配置不完整或格式无效', false, reasonDetail)
  }

  if (hasRuntimeDeploymentFailureSignal(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_runtime_deploy_failure', decision: 'matched: openclaw CLI / bundled runtime install failed', result: 'config_invalid' })
    return buildClassification(typed, 'config_invalid', '内置 OpenClaw 运行时部署失败，CLI 安装未完成', false, reasonDetail)
  }

  if (/\b1006\b|abnormal closure|gateway closed|websocket/i.test(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_websocket_1006', decision: 'matched: 1006/websocket/abnormal closure in corpus', result: 'websocket_1006' })
    return buildClassification(typed, 'websocket_1006', 'Gateway 与上游的握手连接被异常关闭', true, reasonDetail)
  }

  if (
    /\bapi[_ -]?key\b|oauth|unauthorized|forbidden|not logged in|credential|auth(?:entication)?|login|expired/i.test(
      corpus
    )
  ) {
    trace?.add({ phase: 'classify', step: 'corpus_auth_missing', decision: 'matched: auth-related keywords in corpus', result: 'auth_missing' })
    return buildClassification(typed, 'auth_missing', '当前机器缺少可用的模型认证信息', false, reasonDetail)
  }

  if (isPluginAllowlistWarning(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_plugin_allowlist', decision: 'matched: plugin allowlist warning', result: 'plugin_allowlist_warning' })
    return buildClassification(
      typed,
      'plugin_allowlist_warning',
      'Gateway 检测到未显式放行的外部插件，已记录 allowlist 警告',
      true,
      reasonDetail
    )
  }

  if (/plugins?\.allow|plugin not found|failed to load plugin|manifest|export id/i.test(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_plugin_load', decision: 'matched: plugin load/failure keywords', result: 'plugin_load_failure' })
    return buildClassification(typed, 'plugin_load_failure', 'Gateway 依赖的插件没有正常加载', false, reasonDetail)
  }

  if (/does not have an adjacent or parent.*package\.json|node_modules[\\/]openclaw[\\/]package\.json/i.test(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_package_json', decision: 'matched: openclaw package.json not found', result: 'config_invalid' })
    return buildClassification(
      typed,
      'config_invalid',
      '内置 OpenClaw 运行时缺少配套的 openclaw 软件包',
      false,
      reasonDetail
    )
  }

  if (/config|openclaw\.json|provider|model|missing required|invalid|parse|json/i.test(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_config_generic', decision: 'matched: config/provider/model keywords', result: 'config_invalid' })
    return buildClassification(typed, 'config_invalid', 'Gateway 配置不完整或格式无效', false, reasonDetail)
  }

  if (
    /\benotfound\b|\beconnrefused\b|\beconnreset\b|timed out|timeout|network|dns|proxy|certificate|tls|ssl|socket hang up|fetch failed|service unavailable/i.test(
      corpus
    )
  ) {
    trace?.add({ phase: 'classify', step: 'corpus_network', decision: 'matched: network/proxy/timeout keywords', result: 'network_blocked' })
    return buildClassification(typed, 'network_blocked', 'Gateway 当前被网络或代理环境阻断', true, reasonDetail)
  }

  if (/not running|gateway not running|connection refused/i.test(corpus)) {
    trace?.add({ phase: 'classify', step: 'corpus_not_running', decision: 'matched: not running/connection refused', result: 'gateway_not_running' })
    return buildClassification(typed, 'gateway_not_running', 'Gateway 当前没有在本机运行', true, reasonDetail)
  }

  trace?.add({ phase: 'classify', step: 'fallback', decision: 'no specific signal matched', result: 'unknown_runtime_failure' })
  return buildClassification(typed, 'unknown_runtime_failure', 'Gateway 尚未完成就绪确认', true, reasonDetail)
}
