import { describe, expect, it } from 'vitest'
import {
  buildClaudeCodeArgs,
  normalizeClaudeCodeStderr,
  parseClaudeStreamEvent,
} from '../coding/claude-code-cli-executor'

describe('claude code cli executor helpers', () => {
  it('builds print-mode args that are compatible with stream-json on Claude Code 2.1.x', () => {
    const args = buildClaudeCodeArgs({
      prompt: '请创建一个新的 React 页面',
      systemPrompt: '你是 Mclaw 的开发执行器。',
      model: 'claude-sonnet-4-6',
      cwd: 'D:/workspace/Mclaw',
      maxTurns: 16,
    })

    expect(args).toContain('-p')
    expect(args).toContain('--verbose')
    expect(args).toContain('--model')
    expect(args).toContain('claude-sonnet-4-6')
    expect(args).toContain('--output-format')
    expect(args).toContain('stream-json')
    expect(args).toContain('--append-system-prompt')
    expect(args).toContain('你是 Mclaw 的开发执行器。')
    expect(args.slice(-2)).toEqual(['--', '请创建一个新的 React 页面'])
  })

  it('extracts assistant text from assistant payloads', () => {
    const parsed = parseClaudeStreamEvent(JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: '已完成开发。' }],
      },
    }))

    expect(parsed).toEqual({
      text: '已完成开发。',
      model: 'claude-sonnet-4-6',
    })
  })

  it('ignores verbose stream events that are not assistant replies', () => {
    expect(parseClaudeStreamEvent(JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'temporary' },
    }))).toBeNull()

    expect(parseClaudeStreamEvent(JSON.stringify({
      type: 'tool_use',
      tool_name: 'Bash',
      message: 'running',
    }))).toBeNull()

    expect(parseClaudeStreamEvent(JSON.stringify({
      type: 'system',
      message: 'initializing',
    }))).toBeNull()
  })

  it('still supports assistant messages nested inside verbose payloads', () => {
    const parsed = parseClaudeStreamEvent(JSON.stringify({
      event: 'message',
      message: {
        role: 'assistant',
        modelName: 'claude-opus-4-1',
        content: [{ type: 'text', text: '这里是最终答复。' }],
      },
    }))

    expect(parsed).toEqual({
      text: '这里是最终答复。',
      model: 'claude-opus-4-1',
    })
  })

  it('strips Claude Code stdin warnings from stderr noise', () => {
    expect(
      normalizeClaudeCodeStderr([
        'Warning: no stdin data received in 3s, proceeding without it.',
        'If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.',
        'Failed to authenticate. API Error: 403 unsupported model type.',
      ].join('\n'))
    ).toBe('Failed to authenticate. API Error: 403 unsupported model type.')
  })
})
