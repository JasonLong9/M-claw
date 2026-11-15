import { useEffect, useRef, useState } from 'react'
import { Button, Group, Text } from '@mantine/core'
import { MAX_VOICE_BYTES, MAX_VOICE_DURATION_MS, type VoiceRecording } from '../../shared/chat-voice'

type Phase = 'idle' | 'requesting' | 'recording' | 'transcribing'
const formats = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

export function VoiceInputButton({ disabled, onText }: { disabled: boolean; onText: (text: string) => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState<VoiceRecording>()
  const active = useRef<AbortController>()
  const recorder = useRef<MediaRecorder>()
  const shutdown = useRef<() => void>()

  useEffect(() => () => {
    active.current?.abort()
    shutdown.current?.()
  }, [])

  const transcribe = async (recording: VoiceRecording, operation: AbortController) => {
    setPhase('transcribing')
    setError('')
    try {
      const text = await window.api.transcribeChatVoice(recording)
      if (operation.signal.aborted) return
      setRetry(undefined)
      onText(text)
    } catch (reason) {
      if (operation.signal.aborted) return
      setRetry(recording)
      setError(reason instanceof Error ? reason.message : '转写失败')
    } finally {
      if (active.current === operation && !operation.signal.aborted) {
        active.current = undefined
        setPhase('idle')
      }
    }
  }

  const start = async () => {
    if (active.current) return
    const operation = new AbortController()
    active.current = operation
    setRetry(undefined)
    setError('')
    setPhase('requesting')
    let stopTracks: (() => void) | undefined
    try {
      await window.api.checkChatVoiceConfiguration()
      if (operation.signal.aborted) return
      const format = formats.find((candidate) => window.MediaRecorder?.isTypeSupported(candidate))
      if (!format || !navigator.mediaDevices?.getUserMedia) throw new Error('当前环境不支持麦克风录音')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      stopTracks = () => stream.getTracks().forEach((track) => track.stop())
      if (operation.signal.aborted) {
        stopTracks()
        return
      }
      const recording = new MediaRecorder(stream, { mimeType: format, audioBitsPerSecond: 64000 })
      recorder.current = recording
      const chunks: Blob[] = []
      let bytes = 0
      let timer: number | undefined
      let released = false
      const release = () => {
        if (released) return
        released = true
        window.clearTimeout(timer)
        stopTracks?.()
        recorder.current = undefined
        shutdown.current = undefined
      }
      shutdown.current = () => {
        if (recording.state !== 'inactive') recording.stop()
        release()
      }
      recording.ondataavailable = ({ data }) => {
        bytes += data.size
        if (bytes <= MAX_VOICE_BYTES && data.size) chunks.push(data)
        if (bytes > MAX_VOICE_BYTES && recording.state !== 'inactive') recording.stop()
      }
      recording.onerror = () => {
        if (operation.signal.aborted) return
        operation.abort()
        release()
        active.current = undefined
        setPhase('idle')
        setError('麦克风录音失败，请重试')
      }
      recording.onstop = async () => {
        release()
        if (operation.signal.aborted) return
        if (!bytes || bytes > MAX_VOICE_BYTES) {
          active.current = undefined
          setPhase('idle')
          setError(bytes ? '录音大于 3 MB，请缩短后重录' : '没有录到声音，请重录')
          return
        }
        setPhase('transcribing')
        try {
          const audio = await new Blob(chunks).arrayBuffer()
          if (!operation.signal.aborted) await transcribe({ audio, mimeType: format }, operation)
        } catch {
          if (operation.signal.aborted) return
          active.current = undefined
          setPhase('idle')
          setError('无法读取录音，请重录')
        }
      }
      recording.start(250)
      timer = window.setTimeout(() => {
        if (recording.state === 'recording') recording.stop()
      }, MAX_VOICE_DURATION_MS)
      setPhase('recording')
    } catch (reason) {
      shutdown.current?.()
      stopTracks?.()
      if (operation.signal.aborted) return
      operation.abort()
      active.current = undefined
      setPhase('idle')
      setError(reason instanceof Error && reason.name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在系统设置中允许访问'
        : reason instanceof Error ? reason.message : '无法启动麦克风')
    }
  }

  return (
    <>
      <Group gap="xs">
        <Button
          size="compact-xs"
          variant={phase === 'recording' ? 'light' : 'subtle'}
          color={phase === 'recording' ? 'red' : undefined}
          loading={phase === 'requesting' || phase === 'transcribing'}
          disabled={disabled && phase === 'idle'}
        onClick={() => {
          if (phase === 'recording' && recorder.current?.state === 'recording') {
            setPhase('transcribing')
            recorder.current.stop()
          } else if (phase === 'idle') {
            void start()
          }
        }}
        >
          {phase === 'recording' ? '停止录音' : phase === 'transcribing' ? '正在转写' : '麦克风'}
        </Button>
        {retry && phase === 'idle' && (
          <>
            <Button size="compact-xs" variant="subtle" disabled={disabled} onClick={() => {
              const operation = new AbortController()
              if (active.current) return
              active.current = operation
              void transcribe(retry, operation)
            }}>重试转写</Button>
            <Button size="compact-xs" variant="subtle" color="gray" onClick={() => { setRetry(undefined); setError('') }}>丢弃录音</Button>
          </>
        )}
        {phase === 'recording' && (
          <Button size="compact-xs" variant="subtle" onClick={() => {
            active.current?.abort()
            shutdown.current?.()
            active.current = undefined
            setPhase('idle')
          }}>取消</Button>
        )}
      </Group>
      {error && <Text size="xs" c="red" role="alert">{error}</Text>}
    </>
  )
}
