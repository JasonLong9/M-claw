import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetOpenClawLegacyEnvWarningsForTests } from '../../openclaw-legacy-env-migration'
import {
  createGatewayStreamingChatTransport,
  OPENCLAW_WEBCHAT_CLIENT_ID,
  OPENCLAW_WEBCHAT_CLIENT_MODE,
  OPENCLAW_WEBCHAT_CLIENT_VERSION,
} from '../gateway-streaming-chat-transport'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const { mkdtemp, rm, writeFile } = fs.promises

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = FakeWebSocket.OPEN
  private readonly listeners = new Map<string, Set<(event: any) => void>>()

  constructor(private readonly handler: (frame: any, socket: FakeWebSocket) => void) {
    queueMicrotask(() => {
      this.emit('message', {
        data: JSON.stringify({
          type: 'event',
          event: 'connect.challenge',
          payload: {
            nonce: 'nonce-1',
          },
        }),
      })
    })
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)?.add(listener)
  }

  send(raw: string): void {
    this.handler(JSON.parse(raw), this)
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', {})
  }

  emit(type: string, event: any): void {
    for (const listener of this.listeners.get(type) || []) {
      listener(event)
    }
  }
}

describe('gateway streaming chat transport', () => {
  beforeEach(() => {
    resetOpenClawLegacyEnvWarningsForTests()
  })

  it('streams assistant deltas from gateway chat events', async () => {
    const deltas: Array<{ text: string; delta: string; model?: string }> = []
    const sentPayloads: Array<Record<string, unknown>> = []
    let connectClient: Record<string, unknown> | undefined
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            connectClient = (frame.params?.client || {}) as Record<string, unknown>
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  auth: { role: 'operator' },
                },
              }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            sentPayloads.push((frame.params || {}) as Record<string, unknown>)
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  runId: 'run-1',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-1',
                  sessionKey: 'agent:main:session-1',
                  seq: 1,
                  state: 'delta',
                  message: {
                    delta: '你好，',
                    model: 'zai/glm-5',
                  },
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-1',
                  sessionKey: 'agent:main:session-1',
                  seq: 2,
                  state: 'final',
                  message: {
                    text: '你好，我在。',
                    model: 'zai/glm-5',
                    usage: {
                      inputTokens: 12,
                      outputTokens: 4,
                    },
                  },
                  usage: {
                    totalTokens: 16,
                  },
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'session-1',
      messageText: '你好',
      thinking: 'off',
      onAssistantDelta: (payload) => deltas.push(payload),
    })

    expect(result.ok).toBe(true)
    expect(connectClient).toEqual(
      expect.objectContaining({
        id: OPENCLAW_WEBCHAT_CLIENT_ID,
        mode: OPENCLAW_WEBCHAT_CLIENT_MODE,
        version: OPENCLAW_WEBCHAT_CLIENT_VERSION,
      })
    )
    expect(result.streamedText).toBe('你好，我在。')
    expect(result.streamedModel).toBe('zai/glm-5')
    expect(sentPayloads[0]?.model).toBeUndefined()
    expect(result.streamedUsage).toEqual({
      totalTokens: 16,
    })
    expect(deltas).toEqual([
      {
        text: '你好，',
        delta: '你好，',
        model: 'zai/glm-5',
        usage: undefined,
      },
      {
        text: '你好，我在。',
        delta: '我在。',
        model: 'zai/glm-5',
        usage: {
          totalTokens: 16,
        },
      },
    ])
  })

  it('reuses an explicit external sessionKey when sending chat', async () => {
    const explicitSessionKey = 'agent:feishu-default:feishu:default:direct:ou_11ec143ee4079fad7afe9c5fa042404f'
    let sentSessionKey = ''
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
              }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            sentSessionKey = String(frame.params?.sessionKey || '')
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  runId: 'run-feishu',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-feishu',
                  sessionKey: explicitSessionKey,
                  seq: 1,
                  state: 'final',
                  message: {
                    text: '已在外部会话里继续',
                    model: 'zai/glm-5',
                  },
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'local-session-id',
      sessionKey: explicitSessionKey,
      messageText: '继续这个会话',
      thinking: 'off',
    })

    expect(result.ok).toBe(true)
    expect(sentSessionKey).toBe(explicitSessionKey)
    expect(JSON.parse(result.stdout).sessionKey).toBe(explicitSessionKey)
  })

  it('forwards extra system prompt guidance through gateway chat.send', async () => {
    let sentExtraSystemPrompt = ''
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
              }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            sentExtraSystemPrompt = String(frame.params?.extraSystemPrompt || '')
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  runId: 'run-extra-system-prompt',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-extra-system-prompt',
                  sessionKey: 'agent:main:session-extra-system-prompt',
                  seq: 1,
                  state: 'final',
                  message: {
                    text: '截图已完成',
                    model: 'zai/glm-5',
                  },
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'session-extra-system-prompt',
      messageText: '请截图',
      extraSystemPrompt: 'Use viewport screenshots only.',
      thinking: 'off',
    })

    expect(result.ok).toBe(true)
    expect(sentExtraSystemPrompt).toBe('Use viewport screenshots only.')
  })

  it('retries chat.send without extra system prompt when legacy gateway rejects the field', async () => {
    const sentPayloads: Array<Record<string, unknown>> = []
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
              }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            sentPayloads.push({ ...((frame.params || {}) as Record<string, unknown>) })

            if (sentPayloads.length === 1) {
              socket.emit('message', {
                data: JSON.stringify({
                  type: 'res',
                  id: frame.id,
                  ok: false,
                  error: {
                    message:
                      "invalid chat.send params: at root: unexpected property 'extraSystemPrompt'",
                  },
                }),
              })
              return
            }

            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  runId: 'run-extra-system-prompt-retry',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-extra-system-prompt-retry',
                  sessionKey: 'agent:main:session-extra-system-prompt-retry',
                  seq: 1,
                  state: 'final',
                  message: {
                    text: 'screenshot captured',
                    model: 'zai/glm-5',
                  },
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'session-extra-system-prompt-retry',
      messageText: 'please capture a screenshot',
      extraSystemPrompt: 'Use viewport screenshots only.',
      thinking: 'off',
    })

    expect(result.ok).toBe(true)
    expect(sentPayloads).toHaveLength(2)
    expect(sentPayloads[0]?.extraSystemPrompt).toBe('Use viewport screenshots only.')
    expect(sentPayloads[1]).not.toHaveProperty('extraSystemPrompt')
  })

  it('ignores structured tool payloads from gateway chat events', async () => {
    const onAssistantDelta = vi.fn()
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
              }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  runId: 'run-tool-envelope',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-tool-envelope',
                  sessionKey: 'agent:main:session-tool-envelope',
                  seq: 1,
                  state: 'final',
                  message: {
                    command: 'curl -s "wttr.in/Shenzhen?format=%C"',
                    workdir: '/Users/test/.openclaw/workspace',
                    yieldMs: 10_000,
                    timeout: 20,
                  },
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'session-tool-envelope',
      messageText: '查天气',
      thinking: 'off',
      onAssistantDelta,
    })

    expect(result.ok).toBe(true)
    expect(result.streamedText).toBe('')
    expect(onAssistantDelta).not.toHaveBeenCalled()
  })

  it('keeps image-only control-ui blocks from gateway chat events', async () => {
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
              }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  runId: 'run-image-block',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-image-block',
                  sessionKey: 'agent:main:session-image-block',
                  seq: 1,
                  state: 'final',
                  message: {
                    content: [
                      {
                        type: 'image',
                        props: {
                          url: 'data:image/png;base64,Y29udHJvbC11aS1pbWFnZQ==',
                        },
                      },
                    ],
                  },
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'session-image-block',
      messageText: '截图',
      thinking: 'off',
    })

    expect(result.ok).toBe(true)
    expect(result.streamedText).toBe('')
    expect(result.streamedImages).toEqual([
      {
        url: 'data:image/png;base64,Y29udHJvbC11aS1pbWFnZQ==',
        mimeType: 'image/png',
      },
    ])
  })

  it('ignores stringified tool payloads from gateway chat events', async () => {
    const onAssistantDelta = vi.fn()
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
              }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  runId: 'run-tool-json-string',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-tool-json-string',
                  sessionKey: 'agent:main:session-tool-json-string',
                  seq: 1,
                  state: 'final',
                  message: '{"path":"~/homebrew/lib/node_modules/openclaw/skills/weather/SKILL.md"}',
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'session-tool-json-string',
      messageText: '查天气',
      thinking: 'off',
      onAssistantDelta,
    })

    expect(result.ok).toBe(true)
    expect(result.streamedText).toBe('')
    expect(onAssistantDelta).not.toHaveBeenCalled()
  })

  it('treats string payloads in delta events as incremental updates', async () => {
    const deltas: Array<{ text: string; delta: string; model?: string }> = []
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
              }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  runId: 'run-string-delta',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-string-delta',
                  sessionKey: 'agent:main:session-string-delta',
                  seq: 1,
                  state: 'delta',
                  message: '你好，',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-string-delta',
                  sessionKey: 'agent:main:session-string-delta',
                  seq: 2,
                  state: 'delta',
                  message: '我在。',
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-string-delta',
                  sessionKey: 'agent:main:session-string-delta',
                  seq: 3,
                  state: 'final',
                  message: {
                    text: '你好，我在。',
                    model: 'zai/glm-5',
                  },
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'session-string-delta',
      messageText: '你好',
      thinking: 'off',
      onAssistantDelta: (payload) => deltas.push(payload),
    })

    expect(result.ok).toBe(true)
    expect(result.streamedText).toBe('你好，我在。')
    expect(deltas).toEqual([
      {
        text: '你好，',
        delta: '你好，',
        model: undefined,
        usage: undefined,
      },
      {
        text: '你好，我在。',
        delta: '我在。',
        model: undefined,
        usage: undefined,
      },
    ])
  })

  it('falls back to the cli transport when gateway credentials are unavailable', async () => {
    const fallbackTransport = {
      run: vi.fn().mockResolvedValue({
        ok: true,
        stdout: '{"response":{"text":"fallback"}}',
        stderr: '',
        code: 0,
        streamedText: 'fallback',
      }),
    }

    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => null,
      readEnvFile: async () => ({}),
      fallbackTransport,
      loadGatewayRuntime: async () => null,
    })

    const result = await transport.run({
      transportSessionId: 'session-2',
      messageText: 'fallback please',
      thinking: 'off',
    })

    expect(fallbackTransport.run).toHaveBeenCalledTimes(1)
    expect(result.streamedText).toBe('fallback')
  })

  it('does not fall back to CLI when the request targets an explicit external session key', async () => {
    const fallbackTransport = {
      run: vi.fn().mockResolvedValue({
        ok: true,
        stdout: '{"response":{"text":"should-not-run"}}',
        stderr: '',
        code: 0,
        streamedText: 'should-not-run',
      }),
    }

    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => null,
      readEnvFile: async () => ({}),
      fallbackTransport,
      loadGatewayRuntime: async () => null,
    })

    const result = await transport.run({
      transportSessionId: 'external-openclaw-history',
      sessionKey: 'agent:main:history-direct-session',
      messageText: '继续这个外部 direct 会话',
      thinking: 'off',
    })

    expect(result.ok).toBe(false)
    expect(result.stderr).toContain('session key')
    expect(fallbackTransport.run).not.toHaveBeenCalled()
  })

  it('rejects runtime send-time model overrides before touching gateway transport state', async () => {
    const readConfig = vi.fn(async () => ({
      gateway: {
        port: 18789,
        auth: {
          token: 'gateway-token',
        },
      },
    }))
    const readEnvFile = vi.fn(async () => ({}))
    const fallbackTransport = {
      run: vi.fn(),
    }
    const transport = createGatewayStreamingChatTransport({
      readConfig,
      readEnvFile,
      fallbackTransport,
      loadGatewayRuntime: async () => null,
      createSocket: () => {
        throw new Error('socket should not be created')
      },
    })

    await expect(
      transport.run({
        transportSessionId: 'session-blocked',
        messageText: '不要偷偷带 model',
        thinking: 'off',
        model: 'openai/gpt-4.1-mini',
      } as any)
    ).rejects.toThrow('禁止在发送消息时携带 model')

    expect(readConfig).not.toHaveBeenCalled()
    expect(readEnvFile).not.toHaveBeenCalled()
    expect(fallbackTransport.run).not.toHaveBeenCalled()
  })

  it('ignores removed CLAWDBOT gateway aliases in steady-state mode and falls back', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fallbackTransport = {
      run: vi.fn().mockResolvedValue({
        ok: true,
        stdout: '{"response":{"text":"fallback"}}',
        stderr: '',
        code: 0,
        streamedText: 'fallback',
      }),
    }

    try {
      const transport = createGatewayStreamingChatTransport({
        readConfig: async () => ({
          gateway: {
            port: 18789,
          },
        }),
        readEnvFile: async () => ({
          CLAWDBOT_GATEWAY_URL: 'ws://127.0.0.1:18789',
          CLAWDBOT_GATEWAY_TOKEN: 'legacy-token',
        }),
        fallbackTransport,
        loadGatewayRuntime: async () => null,
      })

      const result = await transport.run({
        transportSessionId: 'session-legacy-alias',
        messageText: 'fallback please',
        thinking: 'off',
      })

      expect(result.ok).toBe(true)
      expect(result.streamedText).toBe('fallback')
      expect(fallbackTransport.run).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(
        '[openclaw] Ignoring removed legacy env alias CLAWDBOT_GATEWAY_URL; steady-state now reads OPENCLAW_GATEWAY_URL only.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[openclaw] Ignoring removed legacy env alias CLAWDBOT_GATEWAY_TOKEN; steady-state now reads OPENCLAW_GATEWAY_TOKEN only.'
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('uses runtime environment gateway credentials before falling back to cli', async () => {
    const previousToken = process.env.OPENCLAW_GATEWAY_TOKEN
    process.env.OPENCLAW_GATEWAY_TOKEN = 'runtime-token'

    try {
      const transport = createGatewayStreamingChatTransport({
        readConfig: async () => ({
          gateway: {
            port: 18789,
          },
        }),
        readEnvFile: async () => ({}),
        loadGatewayRuntime: async () => null,
        createSocket: () =>
          new FakeWebSocket((frame, socket) => {
            if (frame.method === 'connect') {
              expect(frame.params.auth.token).toBe('runtime-token')
              socket.emit('message', {
                data: JSON.stringify({
                  type: 'res',
                  id: frame.id,
                  ok: true,
                }),
              })
              return
            }

            if (frame.method === 'chat.send') {
              socket.emit('message', {
                data: JSON.stringify({
                  type: 'res',
                  id: frame.id,
                  ok: true,
                  payload: {
                    runId: 'run-env',
                  },
                }),
              })

              socket.emit('message', {
                data: JSON.stringify({
                  type: 'event',
                  event: 'chat.stream',
                  payload: {
                    runId: 'run-env',
                    sessionKey: 'agent:main:session-env',
                    seq: 1,
                    state: 'final',
                    message: {
                      text: 'from env',
                    },
                  },
                }),
              })
            }
          }) as unknown as WebSocket,
      })

      const result = await transport.run({
        transportSessionId: 'session-env',
        messageText: 'hello',
        thinking: 'off',
      })

      expect(result.ok).toBe(true)
      expect(result.streamedText).toBe('from env')
    } finally {
      if (previousToken == null) delete process.env.OPENCLAW_GATEWAY_TOKEN
      else process.env.OPENCLAW_GATEWAY_TOKEN = previousToken
    }
  })

  it('sends chat.abort when the run is canceled', async () => {
    const abortFrames: any[] = []
    let readyToAbort!: () => void
    const readyToAbortPromise = new Promise<void>((resolve) => {
      readyToAbort = resolve
    })
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
              }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  runId: 'run-cancel',
                },
              }),
            })
            readyToAbort()
            return
          }

          if (frame.method === 'chat.abort') {
            abortFrames.push(frame)
            socket.emit('message', {
              data: JSON.stringify({
                type: 'res',
                id: frame.id,
                ok: true,
                payload: {
                  aborted: true,
                },
              }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-cancel',
                  sessionKey: 'agent:main:session-cancel',
                  seq: 1,
                  state: 'aborted',
                  stopReason: 'user stop',
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const controller = new AbortController()
    const runPromise = transport.run({
      transportSessionId: 'session-cancel',
      messageText: 'cancel me',
      thinking: 'off',
      signal: controller.signal,
    })

    await readyToAbortPromise
    controller.abort()
    const result = await runPromise

    expect(result.ok).toBe(false)
    expect(result.canceled).toBe(true)
    expect(abortFrames).toHaveLength(1)
    expect(abortFrames[0].params.sessionKey).toBe('agent:main:session-cancel')
  })

  it('extracts embedded raw WebP base64 from arbitrary nested toolresult fields', async () => {
    const rawWebpBase64 = `UklG${'A'.repeat(260)}`
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({ type: 'res', id: frame.id, ok: true }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            socket.emit('message', {
              data: JSON.stringify({ type: 'res', id: frame.id, ok: true, payload: { runId: 'run-nested-webp' } }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-nested-webp',
                  sessionKey: 'agent:main:session-nested-webp',
                  seq: 1,
                  state: 'final',
                  message: {
                    result: {
                      payload: {
                        screenshot: rawWebpBase64,
                      }
                    }
                  },
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'session-nested-webp',
      messageText: 'Screenshot WebP',
      thinking: 'off',
    })

    expect(result.ok).toBe(true)
    expect(result.streamedImages).toBeDefined()
    expect(result.streamedImages?.length).toBe(1)
    expect(result.streamedImages?.[0]).toEqual({
      url: `data:image/webp;base64,${rawWebpBase64}`,
      mimeType: 'image/webp',
    })
  })

  it('extracts local Windows picture paths embedded inside tool result structures', async () => {
    const transport = createGatewayStreamingChatTransport({
      readConfig: async () => ({
        gateway: {
          port: 18789,
          auth: {
            token: 'gateway-token',
          },
        },
      }),
      readEnvFile: async () => ({}),
      loadGatewayRuntime: async () => null,
      createSocket: () =>
        new FakeWebSocket((frame, socket) => {
          if (frame.method === 'connect') {
            socket.emit('message', {
              data: JSON.stringify({ type: 'res', id: frame.id, ok: true }),
            })
            return
          }

          if (frame.method === 'chat.send') {
            socket.emit('message', {
              data: JSON.stringify({ type: 'res', id: frame.id, ok: true, payload: { runId: 'run-win-path' } }),
            })

            socket.emit('message', {
              data: JSON.stringify({
                type: 'event',
                event: 'chat.stream',
                payload: {
                  runId: 'run-win-path',
                  sessionKey: 'agent:main:session-win-path',
                  seq: 1,
                  state: 'final',
                  message: {
                    tool_calls: [
                      {
                        action: 'browser_screenshot',
                        result: {
                          file_path: 'C:\\Users\\TestUser\\AppData\\Local\\Temp\\screenshot_xyz.webp'
                        }
                      }
                    ]
                  },
                },
              }),
            })
          }
        }) as unknown as WebSocket,
    })

    const result = await transport.run({
      transportSessionId: 'session-win-path',
      messageText: 'Local file screenshot',
      thinking: 'off',
    })

    expect(result.ok).toBe(true)
    expect(result.streamedImages).toBeDefined()
    expect(result.streamedImages?.length).toBe(1)
    expect(result.streamedImages?.[0]).toEqual({
      url: `file:///C:/Users/TestUser/AppData/Local/Temp/screenshot_xyz.webp`,
      mimeType: 'image/webp',
    })
  })

  it('hydrates readable local screenshot paths found inside arbitrary string leaves into data URLs', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gateway-transport-image-path-'))
    const imagePath = path.join(tempDir, 'transport-screenshot.webp')
    const imageBuffer = Buffer.from('fake-readable-webp-image')
    await writeFile(imagePath, imageBuffer)

    try {
      const transport = createGatewayStreamingChatTransport({
        readConfig: async () => ({
          gateway: {
            port: 18789,
            auth: {
              token: 'gateway-token',
            },
          },
        }),
        readEnvFile: async () => ({}),
        loadGatewayRuntime: async () => null,
        createSocket: () =>
          new FakeWebSocket((frame, socket) => {
            if (frame.method === 'connect') {
              socket.emit('message', {
                data: JSON.stringify({ type: 'res', id: frame.id, ok: true }),
              })
              return
            }

            if (frame.method === 'chat.send') {
              socket.emit('message', {
                data: JSON.stringify({ type: 'res', id: frame.id, ok: true, payload: { runId: 'run-string-path' } }),
              })

              socket.emit('message', {
                data: JSON.stringify({
                  type: 'event',
                  event: 'chat.stream',
                  payload: {
                    runId: 'run-string-path',
                    sessionKey: 'agent:main:session-string-path',
                    seq: 1,
                    state: 'final',
                    message: {
                      result: {
                        output: `Screenshot cached at ${imagePath}`,
                      },
                    },
                  },
                }),
              })
            }
          }) as unknown as WebSocket,
      })

      const result = await transport.run({
        transportSessionId: 'session-string-path',
        messageText: 'Read screenshot path from text',
        thinking: 'off',
      })

      expect(result.ok).toBe(true)
      expect(result.streamedImages).toEqual([
        {
          url: `data:image/webp;base64,${imageBuffer.toString('base64')}`,
          mimeType: 'image/webp',
        },
      ])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
