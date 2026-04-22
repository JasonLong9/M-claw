import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../shared/chat-panel'
import { collectAssistantLocalPaths, describeLocalPathLabel } from '../../shared/chat-visible-text'
import {
  buildRenderedChatMessages,
  resolveChatMessageDisplayText,
  shouldShowFullscreenChatLoader,
} from './chat-panel-messages'

function createMessage(overrides: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role' | 'text'>): ChatMessage {
  return {
    id: overrides.id,
    role: overrides.role,
    text: overrides.text,
    createdAt: overrides.createdAt ?? 1,
    status: overrides.status ?? 'sent',
    model: overrides.model,
    requestedModel: overrides.requestedModel,
    transportSessionId: overrides.transportSessionId,
    usage: overrides.usage,
  }
}

describe('chat panel message helpers', () => {
  it('keeps optimistic user and assistant bubbles visible while a reply is streaming', () => {
    const messages = buildRenderedChatMessages({
      baseMessages: [
        createMessage({
          id: 'assistant-1',
          role: 'assistant',
          text: '上一条回复',
        }),
      ],
      pendingUserText: '深圳天气怎么样',
      pendingAssistant: {
        sending: true,
        started: true,
        stopping: false,
        text: '深圳今天天气晴转多云',
        model: 'openai/gpt-5.1-codex',
      },
      now: () => 100,
    })

    expect(messages.map((message) => message.id)).toEqual([
      'assistant-1',
      '__pending-user__',
      '__pending-assistant__',
    ])
    expect(messages.at(-1)).toMatchObject({
      role: 'assistant',
      text: '深圳今天天气晴转多云',
      status: 'pending',
      model: 'openai/gpt-5.1-codex',
    })
  })

  it('shows an assistant preview bubble as soon as streaming starts even before any delta arrives', () => {
    const messages = buildRenderedChatMessages({
      baseMessages: [],
      pendingUserText: '你好',
      pendingAssistant: {
        sending: true,
        started: true,
        stopping: false,
        text: '',
      },
      now: () => 200,
    })

    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({
      id: '__pending-assistant__',
      text: 'AI 正在思考...',
      status: 'pending',
    })
  })

  it('strips embedded timestamp prefixes from user message bodies for display', () => {
    expect(resolveChatMessageDisplayText('[Sat 2026-03-28 01:05 GMT+8] 你好', 'user')).toEqual({
      body: '你好',
      embeddedTimestamp: 'Sat 2026-03-28 01:05 GMT+8',
      reasoning: '',
    })
  })

  it('moves assistant execution chatter into a separate reasoning section', () => {
    expect(
      resolveChatMessageDisplayText(
        [
          '我来帮你在桌面创建一个天气文件。',
          '让我先获取广州天气：',
          '{"command":"curl -s \\"wttr.in/Guangzhou?format=%C\\"","workdir":"C:\\\\Users\\\\James\\\\Desktop","yieldMs":10000,"timeout":20}',
          '完成！我已经在桌面创建了 `广州天气.txt`。',
        ].join('\n'),
        'assistant'
      )
    ).toEqual({
      body: '完成！我已经在桌面创建了 `广州天气.txt`。',
      embeddedTimestamp: '',
      reasoning: '我来帮你在桌面创建一个天气文件。\n让我先获取广州天气：',
    })
  })

  it('keeps the full final answer block together after stripping tool chatter', () => {
    expect(
      resolveChatMessageDisplayText(
        [
          '我来帮你整理结果。',
          '让我先检查一下输出：',
          '{"command":"cmd.exe /c dir","workdir":"C:\\\\Users\\\\James\\\\Desktop","yieldMs":10000,"timeout":20}',
          '完成！我已经把结果写入桌面文件。',
          '- 文件名：广州今天天气.txt',
          '- 路径：C:\\Users\\James\\Desktop\\广州今天天气.txt',
        ].join('\n'),
        'assistant'
      )
    ).toEqual({
      body: [
        '完成！我已经把结果写入桌面文件。',
        '- 文件名：广州今天天气.txt',
        '- 路径：C:\\Users\\James\\Desktop\\广州今天天气.txt',
      ].join('\n'),
      embeddedTimestamp: '',
      reasoning: '我来帮你整理结果。\n让我先检查一下输出：',
    })
  })

  it('extracts full Windows file paths from raw assistant text without truncating Chinese filenames', () => {
    const paths = collectAssistantLocalPaths(
      [
        '我先保存文件。',
        '{"path":"C:\\\\Users\\\\James\\\\Desktop\\\\广州今天天气.txt","workdir":"C:\\\\Users\\\\James\\\\Desktop"}',
      ].join('\n')
    )

    expect(paths).toEqual(['C:\\Users\\James\\Desktop\\广州今天天气.txt'])
    expect(describeLocalPathLabel(paths[0])).toBe('广州今天天气.txt')
  })

  it('suppresses internal runtime-managed assistant files from user-facing file buttons', () => {
    expect(
      collectAssistantLocalPaths(
        [
          '已生成文件。',
          'C:\\Users\\James\\Desktop\\广州今天天气.txt',
          'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw\\workspace-feishu-bot-78dbc0\\HEARTBEAT.md',
        ].join('\n')
      )
    ).toEqual(['C:\\Users\\James\\Desktop\\广州今天天气.txt'])
  })

  it('hides internal HEARTBEAT runtime lines from visible assistant text', () => {
    expect(
      resolveChatMessageDisplayText(
        [
          '你好！我是 OpenClaw 的助手，很高兴见到你。',
          '已保存到 C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw\\workspace-feishu-bot-78dbc0\\HEARTBEAT.md',
        ].join('\n'),
        'assistant'
      )
    ).toMatchObject({
      body: '你好！我是 OpenClaw 的助手，很高兴见到你。',
      reasoning: '',
    })
  })

  it('strips internal bootstrap templates and keeps only the user-facing reply', () => {
    expect(
      resolveChatMessageDisplayText(
        [
          'Successfully wrote 74 bytes to memory/2026-04-23.md',
          '# IDENTITY.md - Who Am I?',
          '_Fill this in during your first conversation. Make it yours._',
          '- **Name:**',
          '_(pick something you like)_',
          '- **Avatar:**',
          '_(workspace-relative path, http(s) URL, or data URI)_',
          'Notes:',
          '- Save this file at the workspace root as `IDENTITY.md`.',
          '- For avatars, use a workspace-relative path like `avatars/openclaw.png`.',
          '',
          '你好。我是你的助手，刚刚启动。也请告诉我你的名字和偏好，这样我就能更好地为你服务。',
        ].join('\n'),
        'assistant'
      )
    ).toEqual({
      body: '你好。我是你的助手，刚刚启动。也请告诉我你的名字和偏好，这样我就能更好地为你服务。',
      embeddedTimestamp: '',
      reasoning: '',
    })
  })

  it('drops bootstrap-style reasoning blocks before the final assistant answer', () => {
    expect(
      resolveChatMessageDisplayText(
        [
          '# BOOTSTRAP.md - Hello, World',
          'You just woke up. Time to figure out who you are.',
          '## The Conversation',
          "Don't interrogate. Don't be robotic. Just... talk.",
          'Good luck out there. Make it count.',
          '',
          '明白了，我会在本会话后续回复末尾加上【会话A】。',
        ].join('\n'),
        'assistant'
      )
    ).toEqual({
      body: '明白了，我会在本会话后续回复末尾加上【会话A】。',
      embeddedTimestamp: '',
      reasoning: '',
    })
  })

  it('groups consecutive assistant process bubbles into one rendered assistant turn', () => {
    const messages = buildRenderedChatMessages({
      baseMessages: [
        createMessage({
          id: 'user-1',
          role: 'user',
          text: '帮我查询广州天气并保存到桌面',
        }),
        createMessage({
          id: 'assistant-1',
          role: 'assistant',
          text: 'reasoning_content',
        }),
        createMessage({
          id: 'assistant-2',
          role: 'assistant',
          text: '我先查询一下广州天气。',
        }),
        createMessage({
          id: 'assistant-3',
          role: 'assistant',
          text: 'C:\\Users\\James\\Desktop\\广州今天天气.txt',
        }),
        createMessage({
          id: 'assistant-4',
          role: 'assistant',
          text: '已完成，我已经把广州今天天气保存到桌面文件 `广州今天天气.txt`。',
          model: 'openai/gpt-5.2',
        }),
      ],
      pendingAssistant: {
        sending: false,
        started: false,
        stopping: false,
      },
      now: () => 100,
    })

    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({
      id: 'assistant-1::assistant-4',
      role: 'assistant',
      text: '已完成，我已经把广州今天天气保存到桌面文件 `广州今天天气.txt`。',
      model: 'openai/gpt-5.2',
      localPaths: ['C:\\Users\\James\\Desktop\\广州今天天气.txt'],
    })
    expect(messages[1].reasoning).toContain('我先查询一下广州天气。')
    expect(messages[1].reasoning).not.toContain('reasoning_content')
    expect(messages[1].reasoning).toContain('C:\\Users\\James\\Desktop\\广州今天天气.txt')
  })

  it('prefers final-answer file paths over noisy intermediate assistant artifacts', () => {
    const messages = buildRenderedChatMessages({
      baseMessages: [
        createMessage({
          id: 'assistant-1',
          role: 'assistant',
          text: '我先整理搜索结果。\nC:\\Users\\James\\Desktop\\guangzhou.html',
        }),
        createMessage({
          id: 'assistant-2',
          role: 'assistant',
          text: [
            '已完成，我已经把结果写入桌面文件。',
            '- 文件：广州今天天气.txt',
            '- 路径：C:\\Users\\James\\Desktop\\广州今天天气.txt',
          ].join('\n'),
        }),
      ],
      pendingAssistant: {
        sending: false,
        started: false,
        stopping: false,
      },
      now: () => 200,
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.localPaths).toEqual(['C:\\Users\\James\\Desktop\\广州今天天气.txt'])
  })

  it('keeps the original body when an embedded timestamp prefix has no message text after it', () => {
    expect(resolveChatMessageDisplayText('[Sat 2026-03-28 01:05 GMT+8]', 'user')).toEqual({
      body: '[Sat 2026-03-28 01:05 GMT+8]',
      embeddedTimestamp: '',
      reasoning: '',
    })
  })

  it('never shows the fullscreen chat loader once there are messages to render', () => {
    expect(
      shouldShowFullscreenChatLoader({
        loadingSessions: true,
        loadingTranscript: true,
        renderedMessageCount: 2,
      })
    ).toBe(false)
    expect(
      shouldShowFullscreenChatLoader({
        loadingSessions: true,
        loadingTranscript: false,
        renderedMessageCount: 0,
      })
    ).toBe(true)
  })
})
