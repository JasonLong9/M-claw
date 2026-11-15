import { expect, it, vi } from 'vitest'
import { getVoiceTranscriptionConfig, transcribeChatVoice } from '../chat-voice-transcription'
import { MAX_VOICE_BYTES } from '../../../src/shared/chat-voice'

const configuration = () => getVoiceTranscriptionConfig({
  MCLAW_VOICE_BASE_URL: 'http://127.0.0.1:9000/v1/',
  MCLAW_VOICE_MODEL: 'whisper-compatible',
  MCLAW_VOICE_API_KEY: 'test-token',
})
const recording = { audio: new Uint8Array([1, 2, 3]).buffer, mimeType: 'audio/webm;codecs=opus' }

it('sends a multipart audio recording and returns the transcript', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ text: '  我想问一个问题。 ' }))
  await expect(transcribeChatVoice(recording, configuration(), request)).resolves.toBe('我想问一个问题。')
  const [url, init] = request.mock.calls[0]
  const form = init?.body as FormData
  expect(String(url)).toBe('http://127.0.0.1:9000/v1/audio/transcriptions')
  expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer test-token' } })
  expect(form.get('model')).toBe('whisper-compatible')
  expect(form.get('file')).toMatchObject({ name: 'voice.webm', size: 3 })
})

it('rejects unsafe endpoints and unsupported recordings before uploading', async () => {
  const request = vi.fn<typeof fetch>()
  expect(() => getVoiceTranscriptionConfig({})).toThrow('MCLAW_VOICE_BASE_URL')
  expect(() => getVoiceTranscriptionConfig({ MCLAW_VOICE_BASE_URL: 'http://example.com/v1' })).toThrow('HTTPS')
  await expect(transcribeChatVoice({ ...recording, mimeType: 'video/webm' }, configuration(), request)).rejects.toThrow('格式')
  await expect(transcribeChatVoice({ ...recording, audio: new ArrayBuffer(MAX_VOICE_BYTES + 1) }, configuration(), request)).rejects.toThrow('3 MB')
  expect(request).not.toHaveBeenCalled()
})

it('returns errors that allow retry and handles a blank transcript', async () => {
  const request = vi.fn<typeof fetch>()
    .mockRejectedValueOnce(new Error('network failure'))
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(Response.json({ text: '  ' }))
  await expect(transcribeChatVoice(recording, configuration(), request)).rejects.toThrow('重试')
  await expect(transcribeChatVoice(recording, configuration(), request)).rejects.toThrow('HTTP 503')
  await expect(transcribeChatVoice(recording, configuration(), request)).rejects.toThrow('没有识别到')
})
