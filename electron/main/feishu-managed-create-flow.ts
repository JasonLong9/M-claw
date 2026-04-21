import { FEISHU_LIVE_QR_URL_MARKER } from '../../src/lib/feishu-installer'
import { addFeishuBotConfig, listFeishuBots } from '../../src/pages/feishu-bots'
import { readConfig } from './cli'
import { applyConfigPatchGuarded } from './openclaw-config-coordinator'
import { MAIN_RUNTIME_POLICY } from './runtime-policy'

const FEISHU_REGISTRATION_ENDPOINTS = {
  feishu: 'https://accounts.feishu.cn',
  lark: 'https://accounts.larksuite.com',
} as const

const FEISHU_REGISTRATION_PATH = '/oauth/v1/app/registration'

interface FeishuRegistrationInitResponse {
  supported_auth_methods?: string[]
}

interface FeishuRegistrationBeginResponse {
  device_code?: string
  verification_uri_complete?: string
  interval?: number
  expire_in?: number
}

interface FeishuRegistrationPollResponse {
  client_id?: string
  client_secret?: string
  error?: string
  error_description?: string
  user_info?: {
    open_id?: string
    tenant_brand?: string
  }
}

interface JsonResponse<T> {
  ok: boolean
  status: number
  data: T
}

export function resolveFeishuRegistrationBaseUrl(domain: 'feishu' | 'lark'): string {
  return FEISHU_REGISTRATION_ENDPOINTS[domain]
}

export interface FeishuManagedCreateFlowResult {
  accountId: string
  accountName: string
  appId: string
  domain: 'feishu' | 'lark'
  reusedExisting: boolean
}

interface FeishuManagedCreateFlowOptions {
  onOutput: (chunk: string) => void
  isCanceled: () => boolean
}

class FeishuManagedCreateCanceledError extends Error {
  constructor() {
    super('cancelled')
    this.name = 'FeishuManagedCreateCanceledError'
  }
}

function appendLine(onOutput: (chunk: string) => void, line: string): void {
  onOutput(`${line.trimEnd()}\n`)
}

function throwIfCanceled(isCanceled: () => boolean): void {
  if (isCanceled()) {
    throw new FeishuManagedCreateCanceledError()
  }
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildCreatedBotName(appId: string): string {
  const tail = appId.replace(/^cli_/i, '').slice(-6)
  return tail ? `\u98de\u4e66 Bot ${tail}` : '\u98de\u4e66 Bot'
}

async function sleepWithCancel(ms: number, isCanceled: () => boolean): Promise<void> {
  if (ms <= 0) return

  const sliceMs = 250
  let remaining = ms
  while (remaining > 0) {
    throwIfCanceled(isCanceled)
    const waitMs = Math.min(sliceMs, remaining)
    await new Promise((resolve) => setTimeout(resolve, waitMs))
    remaining -= waitMs
  }
}

async function postRegistration<T>(params: Record<string, string>): Promise<JsonResponse<T>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MAIN_RUNTIME_POLICY.cli.feishuApiTimeoutMs)

  try {
    const response = await fetch(`${resolveFeishuRegistrationBaseUrl('feishu')}${FEISHU_REGISTRATION_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
      signal: controller.signal,
    })
    const raw = await response.text()
    let data: T = {} as T
    try {
      data = raw ? JSON.parse(raw) as T : {} as T
    } catch {
      data = {} as T
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    }
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') {
      return {
        ok: false,
        status: 408,
        data: {} as T,
      }
    }
    return {
      ok: false,
      status: 500,
      data: {} as T,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function pollRegistration<T>(domain: 'feishu' | 'lark', params: Record<string, string>): Promise<JsonResponse<T>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MAIN_RUNTIME_POLICY.cli.feishuApiTimeoutMs)

  try {
    const response = await fetch(`${resolveFeishuRegistrationBaseUrl(domain)}${FEISHU_REGISTRATION_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
      signal: controller.signal,
    })
    const raw = await response.text()
    let data: T = {} as T
    try {
      data = raw ? JSON.parse(raw) as T : {} as T
    } catch {
      data = {} as T
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    }
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') {
      return {
        ok: false,
        status: 408,
        data: {} as T,
      }
    }
    return {
      ok: false,
      status: 500,
      data: {} as T,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function persistCreatedBot(auth: {
  appId: string
  appSecret: string
  domain: 'feishu' | 'lark'
}): Promise<FeishuManagedCreateFlowResult> {
  const beforeConfig = await readConfig().catch(() => null)
  const existingBot = listFeishuBots(beforeConfig).find(
    (bot) => bot.appId.trim().toLowerCase() === auth.appId.trim().toLowerCase()
  )

  if (existingBot) {
    return {
      accountId: existingBot.accountId,
      accountName: existingBot.name,
      appId: auth.appId,
      domain: auth.domain,
      reusedExisting: true,
    }
  }

  const added = addFeishuBotConfig(beforeConfig, {
    name: buildCreatedBotName(auth.appId),
    appId: auth.appId,
    appSecret: auth.appSecret,
    provisionSource: 'created',
  })

  const writeResult = await applyConfigPatchGuarded(
    {
      beforeConfig,
      afterConfig: added.nextConfig,
      reason: 'unknown',
    },
    undefined,
    { applyGatewayPolicy: false }
  )

  if (!writeResult.ok) {
    throw new Error(writeResult.message || '\u98de\u4e66\u673a\u5668\u4eba\u51ed\u636e\u5199\u5165\u672c\u5730\u914d\u7f6e\u5931\u8d25\u3002')
  }

  const addedBot = listFeishuBots(added.nextConfig).find((bot) => bot.accountId === added.accountId)
  return {
    accountId: added.accountId,
    accountName: addedBot?.name || buildCreatedBotName(auth.appId),
    appId: auth.appId,
    domain: auth.domain,
    reusedExisting: false,
  }
}

function buildPollErrorMessage(result: JsonResponse<FeishuRegistrationPollResponse>): string {
  const errorCode = normalizeText(result.data?.error)
  const errorDescription = normalizeText(result.data?.error_description)

  if (result.status === 408) {
    return '\u8fde\u63a5\u98de\u4e66\u5b98\u65b9\u670d\u52a1\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002'
  }

  if (errorCode === 'access_denied') {
    return '\u4f60\u5df2\u53d6\u6d88\u98de\u4e66\u6388\u6743\uff0c\u672c\u6b21\u521b\u5efa\u5df2\u505c\u6b62\u3002'
  }

  if (errorCode === 'expired_token') {
    return '\u5f53\u524d\u4e8c\u7ef4\u7801\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u8bd5\u5e76\u91cd\u65b0\u626b\u7801\u3002'
  }

  if (errorCode) {
    return errorDescription
      ? `\u98de\u4e66\u5b98\u65b9\u8fd4\u56de ${errorCode}\uff1a${errorDescription}`
      : `\u98de\u4e66\u5b98\u65b9\u8fd4\u56de ${errorCode}\u3002`
  }

  if (!result.ok && result.status >= 500) {
    return '\u65e0\u6cd5\u8fde\u63a5\u98de\u4e66\u5b98\u65b9\u670d\u52a1\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
  }

  return '\u98de\u4e66\u5b98\u65b9\u672a\u8fd4\u56de\u53ef\u7528\u7684\u673a\u5668\u4eba\u51ed\u636e\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
}

export async function runFeishuManagedCreateFlow(
  options: FeishuManagedCreateFlowOptions
): Promise<FeishuManagedCreateFlowResult> {
  appendLine(options.onOutput, '[Qclaw] \u6b63\u5728\u8bf7\u6c42\u98de\u4e66\u5b98\u65b9\u670d\u52a1\u5e76\u751f\u6210\u672c\u6b21\u4e8c\u7ef4\u7801\u3002')
  throwIfCanceled(options.isCanceled)

  const initResult = await postRegistration<FeishuRegistrationInitResponse>({
    action: 'init',
  })
  throwIfCanceled(options.isCanceled)

  if (!initResult.ok) {
    throw new Error(
      initResult.status === 408
        ? '\u521d\u59cb\u5316\u98de\u4e66\u5efa\u673a\u5668\u4eba\u6d41\u7a0b\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002'
        : `\u521d\u59cb\u5316\u98de\u4e66\u5efa\u673a\u5668\u4eba\u6d41\u7a0b\u5931\u8d25\uff08HTTP ${initResult.status}\uff09\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002`
    )
  }

  const supportedAuthMethods = Array.isArray(initResult.data?.supported_auth_methods)
    ? initResult.data.supported_auth_methods
    : []
  if (supportedAuthMethods.length > 0 && !supportedAuthMethods.includes('client_secret')) {
    throw new Error('\u5f53\u524d\u98de\u4e66\u5b98\u65b9\u670d\u52a1\u4e0d\u652f\u6301 client_secret \u6388\u6743\uff0c\u65e0\u6cd5\u7ee7\u7eed\u521b\u5efa\u65b0\u673a\u5668\u4eba\u3002')
  }

  const beginResult = await postRegistration<FeishuRegistrationBeginResponse>({
    action: 'begin',
    archetype: 'PersonalAgent',
    auth_method: 'client_secret',
    request_user_info: 'open_id',
  })
  throwIfCanceled(options.isCanceled)

  const deviceCode = normalizeText(beginResult.data?.device_code)
  const verificationUriComplete = normalizeText(beginResult.data?.verification_uri_complete)
  if (!beginResult.ok || !deviceCode || !verificationUriComplete) {
    throw new Error(
      beginResult.status === 408
        ? '\u8bf7\u6c42\u98de\u4e66\u5b98\u65b9\u4e8c\u7ef4\u7801\u751f\u6210\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002'
        : `\u98de\u4e66\u5b98\u65b9\u6ca1\u6709\u8fd4\u56de\u53ef\u7528\u4e8c\u7ef4\u7801\uff08HTTP ${beginResult.status}\uff09\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002`
    )
  }

  const qrUrl = new URL(verificationUriComplete)
  qrUrl.searchParams.set('from', 'mclaw')
  const qrUrlText = qrUrl.toString()
  const expireInSeconds = Math.max(60, Number(beginResult.data?.expire_in || 600))
  let pollIntervalSeconds = Math.max(2, Number(beginResult.data?.interval || 5))
  let currentDomain: 'feishu' | 'lark' = 'feishu'
  let hasSwitchedToLark = false

  appendLine(options.onOutput, '[Qclaw] \u672c\u6b21\u5b89\u88c5\u5668\u4e8c\u7ef4\u7801\u5df2\u751f\u6210\uff0c\u8bf7\u76f4\u63a5\u626b\u63cf\u4e0b\u9762\u7684\u4e8c\u7ef4\u7801\u3002')
  appendLine(options.onOutput, `${FEISHU_LIVE_QR_URL_MARKER} ${qrUrlText}`)
  appendLine(options.onOutput, `[Qclaw] \u4e8c\u7ef4\u7801\u6709\u6548\u671f\u7ea6 ${Math.max(1, Math.ceil(expireInSeconds / 60))} \u5206\u949f\u3002\u626b\u7801\u540e\u8bf7\u7b49\u5f85\u7ed3\u679c\u81ea\u52a8\u56de\u4f20\u3002`)

  const deadline = Date.now() + expireInSeconds * 1000
  while (Date.now() < deadline) {
    await sleepWithCancel(pollIntervalSeconds * 1000, options.isCanceled)
    const pollResult = await pollRegistration<FeishuRegistrationPollResponse>(currentDomain, {
      action: 'poll',
      device_code: deviceCode,
    })
    throwIfCanceled(options.isCanceled)

    const tenantBrand = normalizeText(pollResult.data?.user_info?.tenant_brand).toLowerCase()
    if (!hasSwitchedToLark && tenantBrand === 'lark') {
      currentDomain = 'lark'
      hasSwitchedToLark = true
      appendLine(options.onOutput, '[Qclaw] \u5df2\u68c0\u6d4b\u5230 Lark \u79df\u6237\uff0c\u540e\u7eed\u8f6e\u8be2\u5c06\u5207\u6362\u5230 Lark \u57df\u540d\u3002')
      continue
    }

    const appId = normalizeText(pollResult.data?.client_id)
    const appSecret = normalizeText(pollResult.data?.client_secret)
    if (appId && appSecret) {
      const persisted = await persistCreatedBot({
        appId,
        appSecret,
        domain: currentDomain,
      })
      if (persisted.reusedExisting) {
        appendLine(options.onOutput, `[Qclaw] \u5f53\u524d\u673a\u5668\u4eba\u5df2\u5b58\u5728\u4e8e\u672c\u5730\u914d\u7f6e\uff0c\u5df2\u76f4\u63a5\u590d\u7528\uff1a${persisted.accountName} (${persisted.accountId})\u3002`)
      } else {
        appendLine(options.onOutput, `[Qclaw] \u65b0\u673a\u5668\u4eba\u521b\u5efa\u6210\u529f\uff0c\u5df2\u5199\u5165\u672c\u5730\u914d\u7f6e\uff1a${persisted.accountName} (${persisted.accountId})\u3002`)
      }
      appendLine(options.onOutput, '[Qclaw] \u73b0\u5728\u53ef\u4ee5\u56de\u5230\u9875\u9762\u7ee7\u7eed\u540e\u7eed\u7ed1\u5b9a\u914d\u7f6e\u3002')
      return persisted
    }

    const pollError = normalizeText(pollResult.data?.error)
    if (!pollError || pollError === 'authorization_pending') {
      continue
    }

    if (pollError === 'slow_down') {
      pollIntervalSeconds = Math.min(pollIntervalSeconds + 5, 30)
      appendLine(options.onOutput, `[Qclaw] \u98de\u4e66\u5b98\u65b9\u8981\u6c42\u964d\u4f4e\u8f6e\u8be2\u901f\u5ea6\uff0c\u65b0\u7684\u7b49\u5f85\u95f4\u9694\u4e3a ${pollIntervalSeconds} \u79d2\u3002`)
      continue
    }

    throw new Error(buildPollErrorMessage(pollResult))
  }

  throw new Error('\u7b49\u5f85\u98de\u4e66\u5b98\u65b9\u8fd4\u56de\u7ed3\u679c\u8d85\u65f6\uff0c\u5f53\u524d\u4e8c\u7ef4\u7801\u53ef\u80fd\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u8bd5\u3002')
}

export { FeishuManagedCreateCanceledError }

