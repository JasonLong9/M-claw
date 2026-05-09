import type { ChatSendErrorCode } from '../../src/shared/chat-panel'

export type { ChatSendErrorCode }

const HTTP_STATUS_PATTERN = /(\d{3})\s*(?:status|http)?\s*(?:code|error|status code)?/i

export function detectHttpStatus(message: string): number | null {
  const normalized = String(message || '').trim()
  const match = normalized.match(HTTP_STATUS_PATTERN)
  if (!match) return null
  const code = Number(match[1])
  return Number.isFinite(code) && code >= 100 && code < 600 ? code : null
}

export function classifySendErrorCode(message: string): ChatSendErrorCode {
  const normalized = String(message || '').trim().toLowerCase()
  if (!normalized) return 'command-failed'
  if (/timeout|timed out/.test(normalized)) return 'timeout'
  if (
    /gateway/.test(normalized)
    && (
      /offline|unreachable|not running|not loaded/.test(normalized)
      || /connection refused|econnrefused|did not become reachable/.test(normalized)
      || /service not loaded|service not installed/.test(normalized)
    )
  ) {
    return 'gateway-offline'
  }
  const httpStatus = detectHttpStatus(message)
  if (httpStatus !== null) {
    if (httpStatus >= 400 && httpStatus < 500) return 'http-4xx'
    if (httpStatus >= 500) return 'http-5xx'
  }
  return 'command-failed'
}

export function humanizeSendError(message: string): string {
  const normalized = String(message || '').trim()
  if (!normalized) return '聊天消息发送失败'

  const httpStatus = detectHttpStatus(normalized)
  if (httpStatus !== null) {
    if (httpStatus === 405) {
      return `模型服务返回 ${httpStatus}，通常是 Base URL 或接口路径不匹配。请检查模型配置。`
    }
    if (httpStatus >= 400 && httpStatus < 500) {
      if (httpStatus === 401 || httpStatus === 403) {
        return `模型服务返回 ${httpStatus}，请检查 API Key 或鉴权配置是否正确。`
      }
      if (httpStatus === 404) {
        return `模型服务返回 ${httpStatus}，接口路径不存在。请检查 Base URL 和接口配置。`
      }
      if (httpStatus === 429) {
        return `模型服务返回 ${httpStatus}，请求频率超限，请稍后重试。`
      }
      return `模型服务返回 ${httpStatus}，请求被服务端拒绝。请检查模型配置和 API 参数。`
    }
    if (httpStatus >= 500) {
      return `模型服务返回 ${httpStatus}，服务端内部错误。请稍后重试或联系服务提供商。`
    }
  }

  if (/incompatible|not compatible|version mismatch/i.test(normalized)) {
    return '本机运行组件与当前聊天协议不兼容，请升级后重试。'
  }
  if (/gateway.*offline|gateway.*not running|gateway.*unreachable/i.test(normalized)) {
    return '网关离线，请等待网关启动后重试。'
  }
  if (/connection refused|econnrefused/i.test(normalized)) {
    return '连接被拒绝，请检查网关是否正常运行。'
  }

  return normalized
}
