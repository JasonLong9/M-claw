import { MAX_VOICE_BYTES } from '../../src/shared/chat-voice'

export function getVoiceTranscriptionConfig(env: Record<string, string | undefined> = process.env) {
  const baseUrl = env.MCLAW_VOICE_BASE_URL?.trim()
  if (!baseUrl) throw new Error('请先设置 MCLAW_VOICE_BASE_URL，重启 M-claw 后再录音')
  const endpoint = new URL(baseUrl.replace(/\/+$/, '') + '/audio/transcriptions')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
  if ((endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:')) ||
    endpoint.username || endpoint.password || endpoint.hash || endpoint.search) {
    throw new Error('语音转写服务需使用 HTTPS 或本机 HTTP，且 URL 中不能包含凭据')
  }
  return {
    endpoint,
    model: env.MCLAW_VOICE_MODEL?.trim() || 'whisper-1',
    apiKey: env.MCLAW_VOICE_API_KEY?.trim(),
  }
}

export async function transcribeChatVoice(
  recording: unknown,
  config: ReturnType<typeof getVoiceTranscriptionConfig>,
  request: typeof fetch = fetch
): Promise<string> {
  const { audio, mimeType } = (recording || {}) as { audio?: unknown; mimeType?: unknown }
  if (!(audio instanceof ArrayBuffer) || audio.byteLength === 0 || audio.byteLength > MAX_VOICE_BYTES ||
    (mimeType !== 'audio/webm' && mimeType !== 'audio/webm;codecs=opus' && mimeType !== 'audio/mp4')) {
    throw new Error('录音为空、格式不支持或大于 3 MB')
  }
  const form = new FormData()
  form.set('file', new Blob([audio], { type: mimeType }), mimeType === 'audio/mp4' ? 'voice.mp4' : 'voice.webm')
  form.set('model', config.model)
  form.set('response_format', 'json')
  let response: Response
  try {
    response = await request(config.endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
      body: form,
      signal: AbortSignal.timeout(120_000),
    })
  } catch {
    throw new Error('连接语音转写服务失败或请求超时，可以重试')
  }
  if (!response.ok) throw new Error(`语音转写失败（HTTP ${response.status}）`)
  const result: unknown = await response.json().catch(() => undefined)
  const text = (result as { text?: unknown } | undefined)?.text
  if (typeof text !== 'string' || !text.trim()) throw new Error('没有识别到可用的文字')
  if (text.length > 12_000) throw new Error('转写结果过长，请缩短录音后重试')
  return text.trim()
}
