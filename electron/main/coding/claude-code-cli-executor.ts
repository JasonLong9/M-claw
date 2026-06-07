import type { ChildProcess } from 'node:child_process'
import type {
  CodingExecutor,
  CodingExecutorParams,
  CodingExecutorResult,
  CodingProgressEvent,
} from './coding-executor-types'
import {
  clearActiveProcessIfMatch,
  consumeCanceledProcess,
  setActiveAbortController,
  setActiveProcess,
} from '../command-control'
import {
  buildClaudeCodeCommandEnv,
  resolveClaudeCodeCommand,
  resolveClaudeCodeSpawnCommand,
} from './claude-code-runtime'

const childProcess = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')

const CLAUDE_CODE_IGNORED_STDERR_PATTERNS = [
  /^warning:\s*no stdin data received in \d+s, proceeding without it\./i,
  /^if piping from a slow command, redirect stdin explicitly:/i,
]

interface StringLeaf {
  path: string
  value: string
}

function collectStringLeaves(value: unknown, path: string, depth = 0): StringLeaf[] {
  if (depth > 4 || value == null) return []
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? [{ path, value: normalized }] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStringLeaves(item, `${path}[${index}]`, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      collectStringLeaves(nested, path ? `${path}.${key}` : key, depth + 1)
    )
  }
  return []
}

function findFirstStringField(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  for (const key of keys) {
    const nested = (value as Record<string, unknown>)[key]
    if (typeof nested === 'string' && nested.trim()) return nested.trim()
  }
  return undefined
}

function selectPreferredLeaf(leaves: StringLeaf[], matcher: RegExp): string | undefined {
  for (const leaf of leaves) {
    if (matcher.test(leaf.path)) return leaf.value
  }
  return undefined
}

function selectBestClaudeReplyLeaf(leaves: StringLeaf[]): string | undefined {
  return (
    selectPreferredLeaf(leaves, /\b(result|final|response|message|content|text|assistant)\b/i) ||
    leaves.find((leaf) => /\b(text|content)\b/i.test(leaf.path))?.value ||
    leaves[0]?.value
  )
}

function extractClaudeTextBlocks(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''

  return content
    .flatMap((block) => {
      if (!block || typeof block !== 'object') return []
      const typedBlock = block as Record<string, unknown>
      if (typedBlock.type === 'text' && typeof typedBlock.text === 'string') {
        return [typedBlock.text.trim()]
      }
      return []
    })
    .filter(Boolean)
    .join('\n')
    .trim()
}

function applyStreamTextUpdate(currentText: string, incomingText: string): { text: string; delta: string } {
  const normalizedCurrent = String(currentText || '')
  const normalizedIncoming = String(incomingText || '').trim()
  if (!normalizedIncoming) {
    return {
      text: normalizedCurrent,
      delta: '',
    }
  }

  if (normalizedIncoming === normalizedCurrent) {
    return {
      text: normalizedCurrent,
      delta: '',
    }
  }

  if (normalizedIncoming.startsWith(normalizedCurrent)) {
    return {
      text: normalizedIncoming,
      delta: normalizedIncoming.slice(normalizedCurrent.length),
    }
  }

  if (!normalizedCurrent) {
    return {
      text: normalizedIncoming,
      delta: normalizedIncoming,
    }
  }

  if (normalizedCurrent.endsWith(normalizedIncoming)) {
    return {
      text: normalizedCurrent,
      delta: '',
    }
  }

  return {
    text: `${normalizedCurrent}${normalizedCurrent ? '\n' : ''}${normalizedIncoming}`.trim(),
    delta: `${normalizedCurrent ? '\n' : ''}${normalizedIncoming}`,
  }
}

export function parseClaudeStreamEvent(line: string): {
  text?: string
  model?: string
} | null {
  const normalized = String(line || '').trim()
  if (!normalized) return null

  try {
    const parsed = JSON.parse(normalized) as unknown
    if (typeof parsed === 'string') {
      return parsed.trim() ? { text: parsed.trim() } : null
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      const type = String(record.type || '').trim().toLowerCase()
      const message =
        record.message && typeof record.message === 'object'
          ? (record.message as Record<string, unknown>)
          : undefined
      const role =
        findFirstStringField(record, ['role']) ||
        findFirstStringField(message, ['role']) ||
        ''

      if (type === 'assistant') {
        const model =
          findFirstStringField(message, ['model', 'modelName']) ||
          findFirstStringField(record, ['model', 'modelName'])
        const text = extractClaudeTextBlocks(message?.content)
        return text ? { text, model } : model ? { model } : null
      }

      if (type === 'result') {
        const model =
          findFirstStringField(record, ['model', 'modelName']) ||
          findFirstStringField(record.result, ['model', 'modelName'])
        const text = findFirstStringField(record, ['result'])
        return text ? { text, model } : model ? { model } : null
      }

      if (String(role || '').trim().toLowerCase() === 'assistant') {
        const model =
          findFirstStringField(message, ['model', 'modelName']) ||
          findFirstStringField(record, ['model', 'modelName'])
        const text = extractClaudeTextBlocks(message?.content)
        return text ? { text, model } : model ? { model } : null
      }

      if (
        type === 'user' ||
        type === 'system' ||
        type === 'init' ||
        type === 'tool_use' ||
        type === 'tool_result' ||
        type === 'content_block_start' ||
        type === 'content_block_delta' ||
        type === 'content_block_stop' ||
        type === 'message_start' ||
        type === 'message_delta' ||
        type === 'message_stop'
      ) {
        return null
      }

      if (type) return null
    }

    const leaves = collectStringLeaves(parsed, '')
    const text =
      selectPreferredLeaf(leaves, /\b(result|final|message\.content|message\.text|response|text|content)\b/i) ||
      selectBestClaudeReplyLeaf(leaves)
    const model =
      findFirstStringField(parsed, ['model', 'modelName']) ||
      (parsed && typeof parsed === 'object'
        ? findFirstStringField((parsed as Record<string, unknown>).message, ['model', 'modelName'])
        : undefined)

    return text ? { text, model } : model ? { model } : null
  } catch {
    return null
  }
}

export function buildClaudeCodeArgs(params: CodingExecutorParams): string[] {
  const args = [
    '-p',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--output-format',
    'stream-json',
    '--max-turns',
    String(params.maxTurns || 12),
  ]
  const model = String(params.model || '').trim()
  if (model) {
    args.push('--model', model)
  }
  const systemPrompt = String(params.systemPrompt || '').trim()
  if (systemPrompt) {
    args.push('--append-system-prompt', systemPrompt)
  }
  args.push('--', params.prompt)
  return args
}

export function normalizeClaudeCodeStderr(stderr: string): string {
  return String(stderr || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !CLAUDE_CODE_IGNORED_STDERR_PATTERNS.some((pattern) => pattern.test(line)))
    .join('\n')
    .trim()
}

function toCliUnavailableMessage(stderr: string): string {
  const normalized = normalizeClaudeCodeStderr(stderr)
  if (/not recognized|cannot find|enoent|not found|no such file/i.test(normalized)) {
    return '未检测到可用的 Claude Code 开发运行时，请先完成开发环境准备。'
  }
  return normalized || 'Claude Code 执行失败。'
}

export class ClaudeCodeCliExecutor implements CodingExecutor {
  async execute(params: CodingExecutorParams): Promise<CodingExecutorResult> {
    const abortController = new AbortController()
    if (params.signal) {
      if (params.signal.aborted) {
        abortController.abort()
      } else {
        params.signal.addEventListener('abort', () => abortController.abort(), { once: true })
      }
    }

    const commandResolution = resolveClaudeCodeCommand()
    const env: NodeJS.ProcessEnv = {
      ...buildClaudeCodeCommandEnv(),
    }

    const args = [...commandResolution.argsPrefix, ...buildClaudeCodeArgs(params)]
    const command = commandResolution.command

    return new Promise((resolve) => {
      let proc: ChildProcess | null = null
      let stdout = ''
      let stderr = ''
      let streamBuffer = ''
      let streamedText = ''
      let streamedModel: string | undefined
      let completed = false

      const emitProgress = (event: CodingProgressEvent) => {
        try {
          params.onProgress?.(event)
        } catch {
          // Never let progress listeners break the executor.
        }
      }

      const finish = (result: CodingExecutorResult) => {
        if (completed) return
        completed = true
        setActiveAbortController(null, 'chat')
        resolve(result)
      }

      const flushBuffer = (flushRemainder = false) => {
        const normalized = flushRemainder ? `${streamBuffer}\n` : streamBuffer
        const lines = normalized.split('\n')
        if (!flushRemainder) {
          streamBuffer = lines.pop() || ''
        } else {
          streamBuffer = ''
        }

        for (const line of lines) {
          const parsed = parseClaudeStreamEvent(line)
          if (!parsed) continue
          streamedModel = parsed.model || streamedModel
          if (!parsed.text) continue
          const next = applyStreamTextUpdate(streamedText, parsed.text)
          streamedText = next.text
          if (!next.delta) continue
          emitProgress({
            type: 'text-delta',
            delta: next.delta,
            text: streamedText,
            model: streamedModel,
          })
        }
      }

      setActiveAbortController(abortController, 'chat')

      try {
        const spawnCommand = resolveClaudeCodeSpawnCommand(command, args, {
          platform: process.platform,
          env,
        })
        proc = childProcess.spawn(spawnCommand.command, spawnCommand.args, {
          cwd: params.cwd,
          env,
          shell: spawnCommand.shell,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })
      } catch (error) {
        finish({
          ok: false,
          result: '',
          stdout,
          stderr: toCliUnavailableMessage(error instanceof Error ? error.message : String(error)),
          code: -1,
          errorMessage: toCliUnavailableMessage(error instanceof Error ? error.message : String(error)),
        })
        return
      }

      setActiveProcess(proc, 'chat')

      abortController.signal.addEventListener('abort', () => {
        if (!proc?.pid) return
        try {
          proc.kill('SIGTERM')
        } catch {
          // ignore termination failures
        }
      }, { once: true })

      proc.stdout?.on('data', (chunk) => {
        const text = chunk.toString()
        stdout = `${stdout}${text}`
        streamBuffer = `${streamBuffer}${text}`
        flushBuffer(false)
      })

      proc.stderr?.on('data', (chunk) => {
        stderr = `${stderr}${chunk.toString()}`
      })

      proc.on('error', (error) => {
        clearActiveProcessIfMatch(proc, 'chat')
        const canceled = consumeCanceledProcess(proc, 'chat')
        const normalizedStderr = normalizeClaudeCodeStderr(stderr)
        finish({
          ok: false,
          result: streamedText,
          model: streamedModel,
          stdout,
          stderr: canceled ? normalizedStderr || 'Claude Code 已取消。' : toCliUnavailableMessage(error.message),
          code: canceled ? null : -1,
          canceled,
          errorMessage: canceled ? 'Claude Code 已取消。' : toCliUnavailableMessage(error.message),
        })
      })

      proc.on('close', (code) => {
        clearActiveProcessIfMatch(proc, 'chat')
        const canceled = consumeCanceledProcess(proc, 'chat')
        flushBuffer(true)
        const normalizedStderr = normalizeClaudeCodeStderr(stderr)
        const finalResult = streamedText.trim()
        if (finalResult) {
          emitProgress({
            type: 'complete',
            result: finalResult,
            model: streamedModel,
          })
        }

        finish({
          ok: code === 0 && !canceled,
          result: finalResult,
          model: streamedModel,
          stdout,
          stderr: canceled ? normalizedStderr || 'Claude Code 已取消。' : normalizedStderr,
          code: canceled ? null : code,
          canceled,
          errorMessage:
            code === 0 && !canceled
              ? undefined
              : canceled
                ? 'Claude Code 已取消。'
                : toCliUnavailableMessage(normalizedStderr),
        })
      })
    })
  }
}

export function createClaudeCodeCliExecutor(): CodingExecutor {
  return new ClaudeCodeCliExecutor()
}
