export const MAX_VOICE_DURATION_MS = 60_000
export const MAX_VOICE_BYTES = 3 * 1024 * 1024

export interface VoiceRecording {
  audio: ArrayBuffer
  mimeType: string
}
