import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  runCliMock,
  runCliStreamingMock,
  gatewayHealthMock,
  ensureGatewayRunningMock,
  getModelCatalogMock,
  getModelStatusMock,
  getOpenClawUpstreamModelStateMock,
  discoverOpenClawMock,
  readConfigMock,
  readEnvFileMock,
  readConfiguredGatewayPortMock,
  probeGatewayPortReachableMock,
  probeGatewaySocketReadyMock,
  callGatewayRpcViaControlUiBrowserMock,
  runGatewayChatViaControlUiBrowserMock,
  inspectBundledOpenClawDeliveryStatusMock,
} = vi.hoisted(() => ({
  runCliMock: vi.fn(),
  runCliStreamingMock: vi.fn(),
  gatewayHealthMock: vi.fn(),
  ensureGatewayRunningMock: vi.fn(),
  getModelCatalogMock: vi.fn(),
  getModelStatusMock: vi.fn(),
  getOpenClawUpstreamModelStateMock: vi.fn(),
  discoverOpenClawMock: vi.fn(),
  readConfigMock: vi.fn(),
  readEnvFileMock: vi.fn(),
  readConfiguredGatewayPortMock: vi.fn(),
  probeGatewayPortReachableMock: vi.fn(),
  probeGatewaySocketReadyMock: vi.fn(),
  callGatewayRpcViaControlUiBrowserMock: vi.fn(),
  runGatewayChatViaControlUiBrowserMock: vi.fn(),
  inspectBundledOpenClawDeliveryStatusMock: vi.fn(),
}))

vi.mock('../cli', () => ({
  gatewayHealth: gatewayHealthMock,
  runCli: runCliMock,
  runCliStreaming: runCliStreamingMock,
  readConfig: readConfigMock,
  readEnvFile: readEnvFileMock,
}))

vi.mock('../openclaw-model-config', () => ({
  getModelStatus: getModelStatusMock,
}))

vi.mock('../openclaw-model-catalog', () => ({
  getModelCatalog: getModelCatalogMock,
}))

vi.mock('../openclaw-upstream-model-state', () => ({
  getOpenClawUpstreamModelState: getOpenClawUpstreamModelStateMock,
}))

vi.mock('../openclaw-install-discovery', () => ({
  discoverOpenClawInstallations: discoverOpenClawMock,
}))

vi.mock('../openclaw-gateway-service', () => ({
  ensureGatewayRunning: ensureGatewayRunningMock,
}))

vi.mock('../openclaw-gateway-probes', () => ({
  readConfiguredGatewayPort: readConfiguredGatewayPortMock,
  probeGatewayPortReachable: probeGatewayPortReachableMock,
  probeGatewaySocketReady: probeGatewaySocketReadyMock,
}))

vi.mock('../openclaw-control-ui-rpc', () => ({
  callGatewayRpcViaControlUiBrowser: callGatewayRpcViaControlUiBrowserMock,
  runGatewayChatViaControlUiBrowser: runGatewayChatViaControlUiBrowserMock,
}))

vi.mock('../openclaw-bundled-manifest', () => ({
  inspectBundledOpenClawDeliveryStatus: inspectBundledOpenClawDeliveryStatusMock,
}))

import {
  sendChatMessage,
  getChatTranscript,
  listChatTraceEntries,
  resetDashboardChatAvailabilityTrackerForTests,
} from '../openclaw-chat-service'
import { appendLocalChatMessages } from '../qclaw-chat-store'
import { createDefaultOpenClawRuntimeReconcileStore } from '../../../src/shared/gateway-runtime-reconcile-state'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const os = process.getBuiltinModule('node:os') as typeof import('node:os')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')
const { mkdtemp, readFile, rm } = fs.promises

function createDiscovery(fingerprint: string) {
  return async () =>
    ({
      status: 'installed',
      candidates: [
        {
          candidateId: 'candidate-1',
          binaryPath: '/usr/local/bin/openclaw',
          resolvedBinaryPath: '/usr/local/bin/openclaw',
          packageRoot: '/usr/local/lib/node_modules/openclaw',
          version: '2026.3.12',
          installSource: 'npm-global',
          isPathActive: true,
          configPath: '/Users/test/.openclaw/openclaw.json',
          stateRoot: '/Users/test/.openclaw',
          displayConfigPath: '~/.openclaw/openclaw.json',
          displayStateRoot: '~/.openclaw',
          ownershipState: 'external-preexisting',
          installFingerprint: fingerprint,
          baselineBackup: null,
          baselineBackupBypass: null,
        },
      ],
      activeCandidateId: 'candidate-1',
      hasMultipleCandidates: false,
      historyDataCandidates: [],
      errors: [],
      warnings: [],
      defaultBackupDirectory: '/tmp',
    }) as any
}

function createModelStatus(defaultModel: string) {
  return {
    ok: true,
    action: 'status',
    command: ['models', 'status', '--json'],
    stdout: '',
    stderr: '',
    code: 0,
    data: { defaultModel },
  } as any
}

function createFakePngWithDimensions(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(1024, 0)
  buffer.writeUInt32BE(0x89504E47, 0)
  buffer.writeUInt32BE(0x0D0A1A0A, 4)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

function createFakeJpegWithDimensions(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(64, 0)
  let offset = 0

  buffer[offset++] = 0xff
  buffer[offset++] = 0xd8

  buffer[offset++] = 0xff
  buffer[offset++] = 0xe0
  buffer.writeUInt16BE(16, offset)
  offset += 2
  buffer.write('JFIF\u0000', offset, 'ascii')
  offset += 5
  buffer[offset++] = 0x01
  buffer[offset++] = 0x01
  buffer[offset++] = 0x00
  buffer.writeUInt16BE(1, offset)
  offset += 2
  buffer.writeUInt16BE(1, offset)
  offset += 2
  buffer[offset++] = 0x00
  buffer[offset++] = 0x00

  buffer[offset++] = 0xff
  buffer[offset++] = 0xc0
  buffer.writeUInt16BE(17, offset)
  offset += 2
  buffer[offset++] = 0x08
  buffer.writeUInt16BE(height, offset)
  offset += 2
  buffer.writeUInt16BE(width, offset)
  offset += 2
  buffer[offset++] = 0x03
  buffer[offset++] = 0x01
  buffer[offset++] = 0x11
  buffer[offset++] = 0x00
  buffer[offset++] = 0x02
  buffer[offset++] = 0x11
  buffer[offset++] = 0x00
  buffer[offset++] = 0x03
  buffer[offset++] = 0x11
  buffer[offset++] = 0x00

  buffer[offset++] = 0xff
  buffer[offset++] = 0xd9

  return buffer.subarray(0, offset)
}

describe('openclaw chat screenshot flow', () => {
  let userDataDir = ''

  beforeEach(async () => {
    resetDashboardChatAvailabilityTrackerForTests()
    process.env.MCLAW_ENABLE_SCREENSHOT_SPECIAL_HANDLING = '1'
    runCliMock.mockReset()
    runCliStreamingMock.mockReset()
    gatewayHealthMock.mockReset()
    ensureGatewayRunningMock.mockReset()
    getModelCatalogMock.mockReset()
    getModelStatusMock.mockReset()
    getOpenClawUpstreamModelStateMock.mockReset()
    discoverOpenClawMock.mockReset()
    readConfigMock.mockReset()
    readEnvFileMock.mockReset()
    readConfiguredGatewayPortMock.mockReset()
    probeGatewayPortReachableMock.mockReset()
    probeGatewaySocketReadyMock.mockReset()
    callGatewayRpcViaControlUiBrowserMock.mockReset()
    runGatewayChatViaControlUiBrowserMock.mockReset()
    inspectBundledOpenClawDeliveryStatusMock.mockReset()

    if (userDataDir) {
      await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined)
    }
    userDataDir = await mkdtemp(path.join(os.tmpdir(), 'qclaw-chat-screenshot-'))
    process.env.QCLAW_USER_DATA_DIR = userDataDir

    readConfigMock.mockResolvedValue(null)
    readEnvFileMock.mockResolvedValue({})
    readConfiguredGatewayPortMock.mockResolvedValue(18789)
    probeGatewayPortReachableMock.mockResolvedValue(true)
    probeGatewaySocketReadyMock.mockResolvedValue(true)
    inspectBundledOpenClawDeliveryStatusMock.mockReturnValue({
      manifestPath: null,
      manifest: null,
      platform: process.platform,
      arch: process.arch,
      defaultDeliveryMode: null,
      targetDeliveryMode: null,
      runtimeArtifact: null,
      runtimePath: null,
      runtimeBinaryPath: null,
    })
    getModelCatalogMock.mockResolvedValue({
      total: 0,
      items: [],
      providers: [],
      updatedAt: '2026-03-26T00:00:00.000Z',
      source: 'cache',
      stale: false,
    })
    getOpenClawUpstreamModelStateMock.mockResolvedValue({
      ok: false,
      source: 'control-ui-app',
      fallbackUsed: true,
      fallbackReason: 'control-ui-app-unavailable',
      diagnostics: {
        upstreamAvailable: false,
        connected: false,
        hasClient: false,
        hasHelloSnapshot: false,
        hasHealthResult: false,
        hasSessionsState: false,
        hasModelCatalogState: false,
        appKeys: [],
        lastError: 'control-ui-app-unavailable',
      },
    })
  })

  it('injects viewport screenshot guidance and saves the returned image bytes to Desktop', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-screenshot-flow')
    const desktopDir = await mkdtemp(path.join(os.tmpdir(), 'mclaw-desktop-save-'))
    const imageBuffer = Buffer.from('fake-browser-screenshot')
    const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '截图已返回',
        },
        model: 'openai/gpt-5.4-mini',
        images: [
          {
            url: imageDataUrl,
            mimeType: 'image/png',
          },
        ],
      }),
      stderr: '',
      code: 0,
      streamedText: '截图已返回',
      streamedModel: 'openai/gpt-5.4-mini',
      streamedImages: [
        {
          url: imageDataUrl,
          mimeType: 'image/png',
        },
      ],
    }))

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-chat-screenshot-flow',
      sessionId: 'screenshot-save-session',
      agentId: 'main',
      model: 'openai/gpt-5.4-mini',
      transportSessionId: 'transport-screenshot-save',
      messages: [
        {
          id: 'local-msg-1',
          role: 'user',
          text: '上一条消息',
          createdAt: 5_000,
          status: 'sent',
        },
      ],
      updatedAt: 5_000,
    })

    const result = await sendChatMessage(
      {
        sessionId: 'screenshot-save-session',
        text: '请打开 GitHub 并转到 openclaw 仓库页面，截图保存到桌面',
      },
      {
        discoverOpenClaw,
        resolveDesktopDir: () => desktopDir,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    const transportCall = (transportRun.mock.calls as Array<unknown[]>)[0]?.[0] as
      | { extraSystemPrompt?: string }
      | undefined
    expect(String(transportCall?.extraSystemPrompt || '')).toContain('visible browser viewport')
    expect(String(transportCall?.extraSystemPrompt || '')).toContain('normal desktop size')
    expect(String(transportCall?.extraSystemPrompt || '')).toContain('desktop app will persist')

    const desktopEntries = await fs.promises.readdir(desktopDir)
    expect(desktopEntries).toHaveLength(1)
    const savedPath = path.join(desktopDir, desktopEntries[0] || '')
    await expect(readFile(savedPath)).resolves.toEqual(imageBuffer)

    const transcript = await getChatTranscript(result.sessionId, {
      discoverOpenClaw,
    })
    const assistantMessage = transcript.messages.at(-1)
    expect(assistantMessage?.images).toEqual([
      {
        url: imageDataUrl,
        mimeType: 'image/png',
      },
    ])
    expect(String(assistantMessage?.text || '')).toContain(savedPath)
  }, 15_000)

  it('inlines screenshot guidance into the transport message for legacy OpenClaw 2026.3.24', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-screenshot-legacy-inline')
    const runtimeStore = createDefaultOpenClawRuntimeReconcileStore()
    runtimeStore.lastSeenVersionBand = 'openclaw_2026_3_23_to_2026_3_24'
    runtimeStore.runtime.stateCode = 'degraded'
    runtimeStore.runtime.safeToRetry = true
    runtimeStore.runtime.blockingReason = 'control_ui_handshake_failed'
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: 'viewport screenshot ready',
        },
        model: 'openai/gpt-5.4-mini',
      }),
      stderr: '',
      code: 0,
      streamedText: 'viewport screenshot ready',
      streamedModel: 'openai/gpt-5.4-mini',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'legacy-inline-session',
        text: '请打开 GitHub 并转到 openclaw 仓库页面，截图发给我',
      },
      {
        discoverOpenClaw,
        readRuntimeReconcileState: async () => runtimeStore,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    const transportCall = (transportRun.mock.calls as Array<unknown[]>)[0]?.[0] as
      | { messageText?: string; extraSystemPrompt?: string }
      | undefined
    expect(transportCall?.extraSystemPrompt).toBeUndefined()
    expect(String(transportCall?.messageText || '')).toContain('Do not use OS screenshot tools')
    expect(String(transportCall?.messageText || '')).toContain('normal desktop size')
    expect(String(transportCall?.messageText || '')).toContain('User request:')
    expect(String(transportCall?.messageText || '')).toContain('请打开 GitHub 并转到 openclaw 仓库页面，截图发给我')
  }, 10_000)

  it('rewrites screenshot replies as a deterministic failure when no image is returned', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-screenshot-missing-image')
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: 'Completed! I opened GitHub and captured the screenshot.',
        },
        path: '.',
        toolMessages: [
          {
            role: 'toolresult',
            path: 'BOOTSTRAP.md',
          },
        ],
        model: 'openai/gpt-5.4-mini',
      }),
      stderr: '',
      code: 0,
      streamedText: 'Completed! I opened GitHub and captured the screenshot.',
      streamedModel: 'openai/gpt-5.4-mini',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'missing-image-session',
        text: 'Please open GitHub, go to the openclaw repo page, and send me a screenshot.',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(String(result.message?.text || '')).toContain('\u622a\u56fe\u5931\u8d25')
    expect(String(result.message?.text || '')).not.toContain('BOOTSTRAP.md')
    expect(result.message?.images).toBeUndefined()
    const recentStages = listChatTraceEntries(10).map((entry) => entry.stage)
    expect(recentStages).toContain('screenshot-transport-returned-no-image')
    expect(recentStages).toContain('screenshot-transcript-returned-no-image')
    expect(recentStages).toContain('screenshot-missing-image')
  }, 10_000)

  it('saves the most recent assistant screenshot to Desktop on a save-only follow-up without invoking tools again', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-screenshot-save-followup')
    const desktopDir = await mkdtemp(path.join(os.tmpdir(), 'mclaw-desktop-followup-save-'))
    const imageBuffer = Buffer.from('recent-browser-screenshot')
    const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`
    const transportRun = vi.fn()

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-chat-screenshot-save-followup',
      sessionId: 'save-followup-session',
      agentId: 'main',
      model: 'openai/gpt-5.4-mini',
      transportSessionId: 'transport-save-followup',
      messages: [
        {
          id: 'save-followup-user-1',
          role: 'user',
          text: '请打开 GitHub 并截图发给我',
          createdAt: 6_000,
          status: 'sent',
        },
        {
          id: 'save-followup-assistant-1',
          role: 'assistant',
          text: '截图已返回。',
          createdAt: 6_001,
          status: 'sent',
          model: 'openai/gpt-5.4-mini',
          images: [
            {
              url: imageDataUrl,
              mimeType: 'image/png',
            },
          ],
        },
      ],
      updatedAt: 6_001,
    })

    const result = await sendChatMessage(
      {
        sessionId: 'save-followup-session',
        text: '保存到桌面。',
      },
      {
        discoverOpenClaw,
        resolveDesktopDir: () => desktopDir,
        ensureGateway: async () => ({ ok: true, stdout: '', stderr: '', code: 0, running: true }),
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(transportRun).not.toHaveBeenCalled()

    const desktopEntries = await fs.promises.readdir(desktopDir)
    expect(desktopEntries).toHaveLength(1)
    const savedPath = path.join(desktopDir, desktopEntries[0] || '')
    await expect(readFile(savedPath)).resolves.toEqual(imageBuffer)

    const transcript = await getChatTranscript(result.sessionId, {
      discoverOpenClaw,
    })
    const assistantMessage = transcript.messages.at(-1)
    expect(String(assistantMessage?.text || '')).toContain(savedPath)
  })

  it('does not hijack a new non-screenshot desktop-save task just because the session previously had a screenshot', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-screenshot-save-followup-guard')
    const desktopDir = await mkdtemp(path.join(os.tmpdir(), 'mclaw-desktop-followup-guard-'))
    const imageBuffer = Buffer.from('recent-browser-screenshot')
    const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '已列出当前系统 CPU 占用率最高的 3 个进程，并保存到桌面上的 process_top.txt。',
        },
        model: 'openai/gpt-5.4-mini',
      }),
      stderr: '',
      code: 0,
      streamedText: '已列出当前系统 CPU 占用率最高的 3 个进程，并保存到桌面上的 process_top.txt。',
      streamedModel: 'openai/gpt-5.4-mini',
    }))

    await appendLocalChatMessages({
      scopeKey: 'fingerprint-chat-screenshot-save-followup-guard',
      sessionId: 'save-followup-guard-session',
      agentId: 'main',
      model: 'openai/gpt-5.4-mini',
      transportSessionId: 'transport-save-followup-guard',
      messages: [
        {
          id: 'save-followup-guard-user-1',
          role: 'user',
          text: '请打开 GitHub 并截图发给我',
          createdAt: 7_000,
          status: 'sent',
        },
        {
          id: 'save-followup-guard-assistant-1',
          role: 'assistant',
          text: '截图已返回。',
          createdAt: 7_001,
          status: 'sent',
          model: 'openai/gpt-5.4-mini',
          images: [
            {
              url: imageDataUrl,
              mimeType: 'image/png',
            },
          ],
        },
      ],
      updatedAt: 7_001,
    })

    delete process.env.MCLAW_ENABLE_SCREENSHOT_SPECIAL_HANDLING

    try {
      const result = await sendChatMessage(
        {
          sessionId: 'save-followup-guard-session',
          text: '列出当前系统 CPU 占用率最高的 3 个进程，按占用从高到低排序，保存到桌面process_top.txt',
        },
        {
          discoverOpenClaw,
          resolveDesktopDir: () => desktopDir,
          ensureGateway: async () => ({ ok: true, stdout: '', stderr: '', code: 0, running: true }),
          readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
          runCommand: async () => ({
            ok: true,
            stdout: JSON.stringify({ sessions: [] }),
            stderr: '',
            code: 0,
          }),
          chatTransport: {
            run: transportRun as any,
          },
        }
      )

      expect(result.ok).toBe(true)
      expect(transportRun).toHaveBeenCalledTimes(1)
      expect(String(result.message?.text || '')).toContain('process_top.txt')
      expect(String(result.message?.text || '')).not.toContain('上一条截图')
      expect(String(result.message?.text || '')).not.toContain('没有保存到桌面')

      const desktopEntries = await fs.promises.readdir(desktopDir)
      expect(desktopEntries).toHaveLength(0)
    } finally {
      process.env.MCLAW_ENABLE_SCREENSHOT_SPECIAL_HANDLING = '1'
    }
  })

  it('rewrites screenshot replies as a deterministic failure when the returned image is visually useless (e.g. extremely narrow)', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-screenshot-invalid-image')
    
    const fakeBadImageBuffer = Buffer.alloc(1024, 0)
    fakeBadImageBuffer.writeUInt32BE(0x89504E47, 0)
    fakeBadImageBuffer.writeUInt32BE(0x0D0A1A0A, 4)
    fakeBadImageBuffer.writeUInt32BE(13, 8)
    fakeBadImageBuffer.write('IHDR', 12, 'ascii')
    fakeBadImageBuffer.writeUInt32BE(2, 16)
    fakeBadImageBuffer.writeUInt32BE(800, 20)
    const badImageDataUrl = `data:image/png;base64,${fakeBadImageBuffer.toString('base64')}`

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '我已经截图成功并返回了！',
        },
        model: 'openai/gpt-5.4-mini',
        images: [
          {
            url: badImageDataUrl,
            mimeType: 'image/png',
          },
        ],
      }),
      stderr: '',
      code: 0,
      streamedText: '我已经截图成功并返回了！',
      streamedModel: 'openai/gpt-5.4-mini',
      streamedImages: [
        {
          url: badImageDataUrl,
          mimeType: 'image/png',
        },
      ],
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'invalid-image-session',
        text: 'Please take a screenshot of the page.',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(String(result.message?.text || '')).toContain('\u622a\u56fe\u5931\u8d25')
    expect(String(result.message?.text || '')).not.toContain('我已经截图成功并返回了！')

    expect(result.message?.images).toBeUndefined()
    const invalidImageStages = listChatTraceEntries(10).map((entry) => entry.stage)
    expect(invalidImageStages).toContain('screenshot-transport-image-extracted-but-invalid')
  }, 10_000)

  it('rewrites screenshot replies as a deterministic failure when the returned image is a visually useless WEBP screenshot', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-screenshot-invalid-webp-image')

    const fakeBadWebpBuffer = Buffer.alloc(30, 0)
    fakeBadWebpBuffer.write('RIFF', 0, 'ascii')
    fakeBadWebpBuffer.writeUInt32LE(fakeBadWebpBuffer.length - 8, 4)
    fakeBadWebpBuffer.write('WEBP', 8, 'ascii')
    fakeBadWebpBuffer.write('VP8X', 12, 'ascii')
    fakeBadWebpBuffer.writeUInt32LE(10, 16)
    fakeBadWebpBuffer[24] = 1
    fakeBadWebpBuffer[27] = 0x1f
    fakeBadWebpBuffer[28] = 0x03
    const badImageDataUrl = `data:image/webp;base64,${fakeBadWebpBuffer.toString('base64')}`

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: '鎴戝凡缁忔埅鍥炬垚鍔熷苟杩斿洖浜嗭紒',
        },
        model: 'openai/gpt-5.4-mini',
        images: [
          {
            url: badImageDataUrl,
            mimeType: 'image/webp',
          },
        ],
      }),
      stderr: '',
      code: 0,
      streamedText: '鎴戝凡缁忔埅鍥炬垚鍔熷苟杩斿洖浜嗭紒',
      streamedModel: 'openai/gpt-5.4-mini',
      streamedImages: [
        {
          url: badImageDataUrl,
          mimeType: 'image/webp',
        },
      ],
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'invalid-webp-image-session',
        text: 'Please take a screenshot of the page.',
      },
      {
        discoverOpenClaw,
        readModelStatus: async () => createModelStatus('openai/gpt-5.4-mini'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async () => ({
          ok: true,
          stdout: JSON.stringify({ sessions: [] }),
          stderr: '',
          code: 0,
        }),
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(String(result.message?.text || '')).toContain('\u622a\u56fe\u5931\u8d25')
    expect(String(result.message?.text || '')).not.toContain('鎴戝凡缁忔埅鍥炬垚鍔熷苟杩斿洖浜嗭紒')

    expect(result.message?.images).toBeUndefined()
    const invalidWebpStages = listChatTraceEntries(10).map((entry) => entry.stage)
    expect(invalidWebpStages).toContain('screenshot-transport-image-extracted-but-invalid')
  }, 10_000)

  it('recovers screenshot bytes from raw session-log transcript records when the transport only returns final text', async () => {
    const discoverOpenClaw = createDiscovery('fingerprint-chat-screenshot-raw-session-log')
    const imageBuffer = Buffer.from('raw-session-log-screenshot-image')
    const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
    const fixedNow = () => Date.parse('2026-04-16T00:47:20+08:00')
    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: 'I captured the screenshot and sent it back.',
        },
        model: 'deepseek-chat',
      }),
      stderr: '',
      code: 0,
      streamedText: 'I captured the screenshot and sent it back.',
      streamedModel: 'deepseek-chat',
    }))

    const result = await sendChatMessage(
      {
        sessionId: 'raw-session-log-screenshot-session',
        text: 'Please open GitHub and send me a screenshot of the page.',
      },
      {
        discoverOpenClaw,
        now: fixedNow,
        readModelStatus: async () => createModelStatus('deepseek-chat'),
        ensureGateway: async () => ({
          ok: true,
          stdout: '',
          stderr: '',
          code: 0,
          running: true,
        }),
        runCommand: async (args) => {
          if (args[0] === 'sessions') {
            return {
              ok: true,
              stdout: JSON.stringify({
                sessions: [
                  {
                    sessionId: 'raw-session-log-screenshot-session',
                    key: 'agent:main:dashboard:raw-session-log',
                    agentId: 'main',
                    model: 'deepseek-chat',
                    updatedAt: 9_000,
                    kind: 'direct',
                  },
                ],
              }),
              stderr: '',
              code: 0,
            }
          }

          if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
            return {
              ok: true,
              stdout: JSON.stringify({
                records: [
                  {
                    type: 'message',
                    id: 'user-1',
                    timestamp: '2026-04-15T16:46:29.001Z',
                    message: {
                      role: 'user',
                      content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }],
                    },
                  },
                  {
                    type: 'message',
                    id: 'assistant-1',
                    timestamp: '2026-04-15T16:47:01.162Z',
                    message: {
                      role: 'assistant',
                      content: [{ type: 'text', text: 'Taking the screenshot now.' }],
                      model: 'deepseek-chat',
                    },
                  },
                  {
                    type: 'message',
                    id: 'tool-1',
                    timestamp: '2026-04-15T16:47:06.802Z',
                    message: {
                      role: 'toolResult',
                      toolName: 'browser',
                      content: [
                        {
                          type: 'image',
                          data: imageBuffer.toString('base64'),
                          mimeType: 'image/jpeg',
                        },
                      ],
                    },
                    details: {
                      path: 'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\.openclaw\\media\\browser\\raw-session-log.jpg',
                    },
                    isError: false,
                  },
                  {
                    type: 'message',
                    id: 'assistant-2',
                    timestamp: '2026-04-15T16:47:14.024Z',
                    message: {
                      role: 'assistant',
                      content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }],
                      model: 'deepseek-chat',
                    },
                  },
                ],
              }),
              stderr: '',
              code: 0,
            }
          }

          return {
            ok: true,
            stdout: JSON.stringify({ sessions: [] }),
            stderr: '',
            code: 0,
          }
        },
        chatTransport: {
          run: transportRun as any,
        },
      }
    )

    expect(result.ok).toBe(true)
    expect(String(result.message?.text || '')).toContain('I captured the screenshot and sent it back.')
    expect(String(result.message?.text || '')).not.toContain('\u622a\u56fe\u5931\u8d25')
    expect(result.message?.images).toEqual([
      {
        url: imageDataUrl,
        mimeType: 'image/jpeg',
      },
    ])
    const traceStages = listChatTraceEntries(20).map((entry) => entry.stage)
    expect(traceStages).toContain('screenshot-recovered-from-transcript')
  })

  it('recovers screenshot bytes from the upstream session log when the dashboard transcript omits the browser toolResult image', async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'mclaw-screenshot-session-log-'))
    const sessionId = 'session-log-fallback-session'
    const sessionLogDir = path.join(stateRoot, '.openclaw', 'agents', 'main', 'sessions')
    const sessionLogPath = path.join(sessionLogDir, `${sessionId}.jsonl`)
    const imageBuffer = Buffer.from('session-log-fallback-image')
    const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
    const fixedNow = () => Date.parse('2026-04-16T01:27:20+08:00')

    const discoverOpenClaw = async () =>
      ({
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/usr/local/bin/openclaw',
            resolvedBinaryPath: '/usr/local/bin/openclaw',
            packageRoot: '/usr/local/lib/node_modules/openclaw',
            version: '2026.3.24',
            installSource: 'npm-global',
            isPathActive: true,
            configPath: path.join(stateRoot, 'openclaw.json'),
            stateRoot,
            displayConfigPath: path.join(stateRoot, 'openclaw.json'),
            displayStateRoot: stateRoot,
            ownershipState: 'external-preexisting',
            installFingerprint: 'fingerprint-chat-screenshot-session-log-fallback',
            baselineBackup: null,
            baselineBackupBypass: null,
          },
        ],
        activeCandidateId: 'candidate-1',
        hasMultipleCandidates: false,
        historyDataCandidates: [],
        errors: [],
        warnings: [],
        defaultBackupDirectory: '/tmp',
      }) as any

    await fs.promises.mkdir(sessionLogDir, { recursive: true })
    await fs.promises.writeFile(
      sessionLogPath,
      [
        JSON.stringify({
          type: 'session',
          id: sessionId,
          timestamp: '2026-04-15T17:25:37.229Z',
        }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          timestamp: '2026-04-15T17:25:58.217Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-1',
          timestamp: '2026-04-15T17:26:15.552Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Taking the screenshot now.' }],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-1',
          timestamp: '2026-04-15T17:26:43.417Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [
              {
                type: 'image',
                data: imageBuffer.toString('base64'),
                mimeType: 'image/jpeg',
              },
            ],
          },
          details: {
            path: path.join(stateRoot, '.openclaw', 'media', 'browser', 'session-log-fallback.jpg'),
          },
          isError: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-2',
          timestamp: '2026-04-15T17:26:48.871Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }],
            model: 'deepseek-chat',
          },
        }),
      ].join('\n'),
      'utf8'
    )

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: 'I captured the screenshot and sent it back.',
        },
        model: 'deepseek-chat',
      }),
      stderr: '',
      code: 0,
      streamedText: 'I captured the screenshot and sent it back.',
      streamedModel: 'deepseek-chat',
    }))

    try {
      const result = await sendChatMessage(
        {
          sessionId,
          text: 'Please open GitHub and send me a screenshot of the page.',
        },
        {
          discoverOpenClaw,
          now: fixedNow,
          readModelStatus: async () => createModelStatus('deepseek-chat'),
          ensureGateway: async () => ({
            ok: true,
            stdout: '',
            stderr: '',
            code: 0,
            running: true,
          }),
          runCommand: async (args) => {
            if (args[0] === 'sessions') {
              return {
                ok: true,
                stdout: JSON.stringify({
                  sessions: [
                    {
                      sessionId,
                      key: 'agent:main:dashboard:session-log-fallback',
                      agentId: 'main',
                      model: 'deepseek-chat',
                      updatedAt: 9_200,
                      kind: 'direct',
                    },
                  ],
                }),
                stderr: '',
                code: 0,
              }
            }

            if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
              return {
                ok: true,
                stdout: JSON.stringify({
                  records: [
                    {
                      type: 'message',
                      id: 'user-dashboard-1',
                      timestamp: '2026-04-15T17:25:58.217Z',
                      message: {
                        role: 'user',
                        content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }],
                      },
                    },
                    {
                      type: 'message',
                      id: 'assistant-dashboard-1',
                      timestamp: '2026-04-15T17:26:48.871Z',
                      message: {
                        role: 'assistant',
                        content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }],
                        model: 'deepseek-chat',
                      },
                    },
                  ],
                }),
                stderr: '',
                code: 0,
              }
            }

            return {
              ok: true,
              stdout: JSON.stringify({ sessions: [] }),
              stderr: '',
              code: 0,
            }
          },
          chatTransport: {
            run: transportRun as any,
          },
        }
      )

      expect(result.ok).toBe(true)
      expect(String(result.message?.text || '')).toContain('I captured the screenshot and sent it back.')
      expect(String(result.message?.text || '')).not.toContain('\u622a\u56fe\u5931\u8d25')
      expect(result.message?.images).toEqual([
        {
          url: imageDataUrl,
          mimeType: 'image/jpeg',
        },
      ])
      const traceStages = listChatTraceEntries(20).map((entry) => entry.stage)
      expect(traceStages).toContain('screenshot-session-log-image-audit')
      expect(traceStages).toContain('screenshot-recovered-from-session-log')
    } finally {
      await rm(stateRoot, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('recaptures a valid PNG through the browser CLI when session-log recovery only finds a collapsed invalid screenshot', async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'mclaw-screenshot-recapture-'))
    const sessionId = 'session-log-browser-recapture-session'
    const targetId = '465A8C727DA392842A89AE50DB690FF8'
    const sessionLogDir = path.join(stateRoot, '.openclaw', 'agents', 'main', 'sessions')
    const sessionLogPath = path.join(sessionLogDir, `${sessionId}.jsonl`)
    const invalidImageBuffer = createFakePngWithDimensions(2, 800)
    const validImageBuffer = createFakePngWithDimensions(1365, 900)
    const validImagePath = path.join(stateRoot, '.openclaw', 'media', 'browser', 'recaptured-browser-cli.png')
    const fixedNow = () => Date.parse('2026-04-16T02:18:00+08:00')

    const discoverOpenClaw = async () =>
      ({
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/usr/local/bin/openclaw',
            resolvedBinaryPath: '/usr/local/bin/openclaw',
            packageRoot: '/usr/local/lib/node_modules/openclaw',
            version: '2026.3.24',
            installSource: 'npm-global',
            isPathActive: true,
            configPath: path.join(stateRoot, 'openclaw.json'),
            stateRoot,
            displayConfigPath: path.join(stateRoot, 'openclaw.json'),
            displayStateRoot: stateRoot,
            ownershipState: 'external-preexisting',
            installFingerprint: 'fingerprint-chat-screenshot-browser-recapture',
            baselineBackup: null,
            baselineBackupBypass: null,
          },
        ],
        activeCandidateId: 'candidate-1',
        hasMultipleCandidates: false,
        historyDataCandidates: [],
        errors: [],
        warnings: [],
        defaultBackupDirectory: '/tmp',
      }) as any

    await fs.promises.mkdir(sessionLogDir, { recursive: true })
    await fs.promises.mkdir(path.dirname(validImagePath), { recursive: true })
    await fs.promises.writeFile(validImagePath, validImageBuffer)
    await fs.promises.writeFile(
      sessionLogPath,
      [
        JSON.stringify({
          type: 'session',
          id: sessionId,
          timestamp: '2026-04-15T18:17:37.229Z',
        }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          timestamp: '2026-04-15T18:17:58.217Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-1',
          timestamp: '2026-04-15T18:17:59.552Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Taking the screenshot now.' },
              {
                type: 'toolCall',
                name: 'browser',
                arguments: {
                  action: 'screenshot',
                  targetId,
                  type: 'png',
                },
              },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-1',
          timestamp: '2026-04-15T18:18:01.417Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [
              {
                type: 'image',
                data: invalidImageBuffer.toString('base64'),
                mimeType: 'image/png',
              },
            ],
          },
          details: {
            path: path.join(stateRoot, '.openclaw', 'media', 'browser', 'collapsed-invalid.png'),
            ok: true,
            targetId,
            url: 'https://github.com/openclaw/openclaw',
          },
          isError: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-2',
          timestamp: '2026-04-15T18:18:03.871Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }],
            model: 'deepseek-chat',
          },
        }),
      ].join('\n'),
      'utf8'
    )

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({
        response: {
          text: 'I captured the screenshot and sent it back.',
        },
        model: 'deepseek-chat',
      }),
      stderr: '',
      code: 0,
      streamedText: 'I captured the screenshot and sent it back.',
      streamedModel: 'deepseek-chat',
    }))

    const runCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({
            sessions: [
              {
                sessionId,
                key: 'agent:main:dashboard:browser-recapture',
                agentId: 'main',
                model: 'deepseek-chat',
                updatedAt: 9_300,
                kind: 'direct',
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }

      if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
        return {
          ok: true,
          stdout: JSON.stringify({
            records: [
              {
                type: 'message',
                id: 'user-dashboard-1',
                timestamp: '2026-04-15T18:17:58.217Z',
                message: {
                  role: 'user',
                  content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }],
                },
              },
              {
                type: 'message',
                id: 'assistant-dashboard-1',
                timestamp: '2026-04-15T18:18:03.871Z',
                message: {
                  role: 'assistant',
                  content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }],
                  model: 'deepseek-chat',
                },
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }

      if (args[0] === 'browser' && args[1] === 'focus') {
        return {
          ok: true,
          stdout: 'focused',
          stderr: '',
          code: 0,
        }
      }

      if (args[0] === 'browser' && args[1] === 'resize') {
        return {
          ok: true,
          stdout: 'resized',
          stderr: '',
          code: 0,
        }
      }

      if (args[0] === 'browser' && args[1] === 'screenshot') {
        return {
          ok: true,
          stdout: `MEDIA:${validImagePath}`,
          stderr: '',
          code: 0,
        }
      }

      return {
        ok: true,
        stdout: JSON.stringify({ sessions: [] }),
        stderr: '',
        code: 0,
      }
    })

    try {
      const result = await sendChatMessage(
        {
          sessionId,
          text: 'Please open GitHub and send me a screenshot of the page.',
        },
        {
          discoverOpenClaw,
          now: fixedNow,
          readModelStatus: async () => createModelStatus('deepseek-chat'),
          ensureGateway: async () => ({
            ok: true,
            stdout: '',
            stderr: '',
            code: 0,
            running: true,
          }),
          runCommand,
          chatTransport: {
            run: transportRun as any,
          },
        }
      )

      expect(result.ok).toBe(true)
      expect(String(result.message?.text || '')).toContain('I captured the screenshot and sent it back.')
      expect(String(result.message?.text || '')).not.toContain('\u622a\u56fe\u5931\u8d25')
      expect(result.message?.images).toEqual([
        {
          url: `data:image/png;base64,${validImageBuffer.toString('base64')}`,
          mimeType: 'image/png',
        },
      ])
      expect(runCommand).toHaveBeenCalledWith(['browser', 'focus', targetId], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'resize', '1365', '900', '--target-id', targetId], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'screenshot', targetId, '--type', 'png'], 20_000)
      const traceStages = listChatTraceEntries(60).map((entry) => entry.stage)
      expect(traceStages).toContain('screenshot-session-log-image-extracted-but-invalid')
      expect(traceStages).toContain('screenshot-browser-recapture-image-audit')
      expect(traceStages).toContain('screenshot-recaptured-from-browser-cli')
      expect(traceStages).not.toContain('screenshot-missing-image')
    } finally {
      await rm(stateRoot, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('reopens the page in a fresh tab when the recovered target still produces an invalid collapsed screenshot', async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'mclaw-screenshot-reopen-'))
    const sessionId = 'session-log-browser-reopen-session'
    const targetId = '328EB6297D7A639269116860F26B0DF4'
    const reopenedTargetId = '8A0F0C88779966554433221100FFEEDD'
    const sessionLogDir = path.join(stateRoot, '.openclaw', 'agents', 'main', 'sessions')
    const sessionLogPath = path.join(sessionLogDir, `${sessionId}.jsonl`)
    const mediaDir = path.join(stateRoot, '.openclaw', 'media', 'browser')
    const invalidImagePath = path.join(mediaDir, 'collapsed-recapture.jpg')
    const validImagePath = path.join(mediaDir, 'reopened-recapture.png')
    const invalidImageBuffer = createFakeJpegWithDimensions(189, 2000)
    const validImageBuffer = createFakePngWithDimensions(1365, 900)
    const fixedNow = () => Date.parse('2026-04-16T11:06:30+08:00')

    const discoverOpenClaw = async () =>
      ({
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/usr/local/bin/openclaw',
            resolvedBinaryPath: '/usr/local/bin/openclaw',
            packageRoot: '/usr/local/lib/node_modules/openclaw',
            version: '2026.3.24',
            installSource: 'npm-global',
            isPathActive: true,
            configPath: path.join(stateRoot, 'openclaw.json'),
            stateRoot,
            displayConfigPath: path.join(stateRoot, 'openclaw.json'),
            displayStateRoot: stateRoot,
            ownershipState: 'external-preexisting',
            installFingerprint: 'fingerprint-chat-screenshot-browser-reopen',
            baselineBackup: null,
            baselineBackupBypass: null,
          },
        ],
        activeCandidateId: 'candidate-1',
        hasMultipleCandidates: false,
        historyDataCandidates: [],
        errors: [],
        warnings: [],
        defaultBackupDirectory: '/tmp',
      }) as any

    await fs.promises.mkdir(sessionLogDir, { recursive: true })
    await fs.promises.mkdir(mediaDir, { recursive: true })
    await fs.promises.writeFile(invalidImagePath, invalidImageBuffer)
    await fs.promises.writeFile(validImagePath, validImageBuffer)
    await fs.promises.writeFile(
      sessionLogPath,
      [
        JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-04-16T03:05:22.226Z' }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          timestamp: '2026-04-16T03:05:39.902Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-open',
          timestamp: '2026-04-16T03:05:56.175Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Opening GitHub now.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'open', url: 'https://github.com/openclaw/openclaw' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-open',
          timestamp: '2026-04-16T03:06:08.097Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'text', text: JSON.stringify({ targetId, url: 'https://github.com/openclaw/openclaw', type: 'page' }) }],
          },
          details: { targetId, url: 'https://github.com/openclaw/openclaw', type: 'page' },
          isError: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-screenshot',
          timestamp: '2026-04-16T03:06:12.611Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Taking the screenshot now.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'screenshot', targetId, type: 'png' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-screenshot',
          timestamp: '2026-04-16T03:06:23.071Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'image', data: invalidImageBuffer.toString('base64'), mimeType: 'image/jpeg' }],
          },
          details: {
            path: invalidImagePath,
            ok: true,
            targetId,
            type: 'page',
            media: { mediaUrl: invalidImagePath },
          },
          isError: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-final',
          timestamp: '2026-04-16T03:06:26.229Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }],
            model: 'deepseek-chat',
          },
        }),
      ].join('\n'),
      'utf8'
    )

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({ response: { text: 'I captured the screenshot and sent it back.' }, model: 'deepseek-chat' }),
      stderr: '',
      code: 0,
      streamedText: 'I captured the screenshot and sent it back.',
      streamedModel: 'deepseek-chat',
    }))

    const runCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({
            sessions: [{ sessionId, key: 'agent:main:dashboard:browser-reopen', agentId: 'main', model: 'deepseek-chat', updatedAt: 9_900, kind: 'direct' }],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
        return {
          ok: true,
          stdout: JSON.stringify({
            records: [
              {
                type: 'message',
                id: 'user-dashboard-1',
                timestamp: '2026-04-16T03:05:39.902Z',
                message: { role: 'user', content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }] },
              },
              {
                type: 'message',
                id: 'assistant-dashboard-1',
                timestamp: '2026-04-16T03:06:26.229Z',
                message: { role: 'assistant', content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }], model: 'deepseek-chat' },
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && args[1] === 'focus') {
        return { ok: true, stdout: `focused ${args[2]}`, stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'resize') {
        return { ok: true, stdout: `resized ${args[5] || args[4] || ''}`.trim(), stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'wait') {
        return { ok: true, stdout: 'waited', stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'screenshot' && args[2] === targetId) {
        return { ok: true, stdout: `MEDIA:${invalidImagePath}`, stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'open') {
        return {
          ok: true,
          stdout: `opened: https://github.com/openclaw/openclaw\n  id: ${reopenedTargetId}\n`,
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && args[1] === 'screenshot' && args[2] === reopenedTargetId) {
        return { ok: true, stdout: `MEDIA:${validImagePath}`, stderr: '', code: 0 }
      }
      return { ok: true, stdout: JSON.stringify({ sessions: [] }), stderr: '', code: 0 }
    })

    try {
      const result = await sendChatMessage(
        { sessionId, text: 'Please open GitHub and send me a screenshot of the page.' },
        {
          discoverOpenClaw,
          now: fixedNow,
          readModelStatus: async () => createModelStatus('deepseek-chat'),
          ensureGateway: async () => ({ ok: true, stdout: '', stderr: '', code: 0, running: true }),
          runCommand,
          chatTransport: { run: transportRun as any },
        }
      )

      expect(result.ok).toBe(true)
      expect(String(result.message?.text || '')).not.toContain('\u622a\u56fe\u5931\u8d25')
      expect(result.message?.images).toEqual([
        { url: `data:image/png;base64,${validImageBuffer.toString('base64')}`, mimeType: 'image/png' },
      ])
      expect(runCommand).toHaveBeenCalledWith(['browser', 'open', 'https://github.com/openclaw/openclaw'], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'screenshot', reopenedTargetId, '--type', 'png'], 20_000)
      const traceStages = listChatTraceEntries(60).map((entry) => entry.stage)
      expect(traceStages).toContain('screenshot-recaptured-from-browser-cli')
      expect(traceStages).not.toContain('screenshot-missing-image')
    } finally {
      await rm(stateRoot, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('falls back to an isolated browser profile when both the existing and reopened targets still produce collapsed screenshots', async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'mclaw-screenshot-isolated-profile-'))
    const sessionId = 'session-log-browser-isolated-profile-session'
    const targetId = '45B9FB3BD7326CE4C2045FC598DF9AB0'
    const reopenedTargetId = '8B1C73F866DE296BB41B7ED610674773'
    const isolatedTargetId = 'A1B2C3D4E5F60718293A4B5C6D7E8F90'
    const sessionLogDir = path.join(stateRoot, '.openclaw', 'agents', 'main', 'sessions')
    const sessionLogPath = path.join(sessionLogDir, `${sessionId}.jsonl`)
    const mediaDir = path.join(stateRoot, '.openclaw', 'media', 'browser')
    const invalidImagePath = path.join(mediaDir, 'collapsed-recapture.jpg')
    const validImagePath = path.join(mediaDir, 'isolated-profile-recapture.png')
    const invalidImageBuffer = createFakeJpegWithDimensions(189, 2000)
    const validImageBuffer = createFakePngWithDimensions(1365, 900)
    const fixedNow = () => Date.parse('2026-04-16T12:05:48+08:00')

    const discoverOpenClaw = async () =>
      ({
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/usr/local/bin/openclaw',
            resolvedBinaryPath: '/usr/local/bin/openclaw',
            packageRoot: '/usr/local/lib/node_modules/openclaw',
            version: '2026.3.24',
            installSource: 'npm-global',
            isPathActive: true,
            configPath: path.join(stateRoot, 'openclaw.json'),
            stateRoot,
            displayConfigPath: path.join(stateRoot, 'openclaw.json'),
            displayStateRoot: stateRoot,
            ownershipState: 'external-preexisting',
            installFingerprint: 'fingerprint-chat-screenshot-browser-isolated-profile',
            baselineBackup: null,
            baselineBackupBypass: null,
          },
        ],
        activeCandidateId: 'candidate-1',
        hasMultipleCandidates: false,
        historyDataCandidates: [],
        errors: [],
        warnings: [],
        defaultBackupDirectory: '/tmp',
      }) as any

    await fs.promises.mkdir(sessionLogDir, { recursive: true })
    await fs.promises.mkdir(mediaDir, { recursive: true })
    await fs.promises.writeFile(invalidImagePath, invalidImageBuffer)
    await fs.promises.writeFile(validImagePath, validImageBuffer)
    await fs.promises.writeFile(
      sessionLogPath,
      [
        JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-04-16T04:05:22.226Z' }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          timestamp: '2026-04-16T04:05:39.902Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-open',
          timestamp: '2026-04-16T04:05:56.175Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Opening GitHub now.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'open', url: 'https://github.com/openclaw/openclaw' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-open',
          timestamp: '2026-04-16T04:06:08.097Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'text', text: JSON.stringify({ targetId, url: 'https://github.com/openclaw/openclaw', type: 'page' }) }],
          },
          details: { targetId, url: 'https://github.com/openclaw/openclaw', type: 'page' },
          isError: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-screenshot',
          timestamp: '2026-04-16T04:06:12.611Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Taking the screenshot now.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'screenshot', targetId, type: 'png' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-screenshot',
          timestamp: '2026-04-16T04:06:23.071Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'image', data: invalidImageBuffer.toString('base64'), mimeType: 'image/jpeg' }],
          },
          details: {
            path: invalidImagePath,
            ok: true,
            targetId,
            type: 'page',
            media: { mediaUrl: invalidImagePath },
          },
          isError: false,
        }),
      ].join('\n'),
      'utf8'
    )

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({ response: { text: 'I captured the screenshot and sent it back.' }, model: 'deepseek-chat' }),
      stderr: '',
      code: 0,
      streamedText: 'I captured the screenshot and sent it back.',
      streamedModel: 'deepseek-chat',
    }))

    const runCommand = vi.fn(async (args: string[]) => {
      const hasProfile = args[1] === '--browser-profile'
      const profileName = hasProfile ? args[2] : undefined
      const commandIndex = hasProfile ? 3 : 1
      const command = args[commandIndex]
      const positional = args.slice(commandIndex + 1)

      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({
            sessions: [{ sessionId, key: 'agent:main:dashboard:browser-isolated-profile', agentId: 'main', model: 'deepseek-chat', updatedAt: 9_900, kind: 'direct' }],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
        return {
          ok: true,
          stdout: JSON.stringify({
            records: [
              {
                type: 'message',
                id: 'user-dashboard-1',
                timestamp: '2026-04-16T04:05:39.902Z',
                message: { role: 'user', content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }] },
              },
              {
                type: 'message',
                id: 'assistant-dashboard-1',
                timestamp: '2026-04-16T04:06:26.229Z',
                message: { role: 'assistant', content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }], model: 'deepseek-chat' },
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (!hasProfile && command === 'focus') {
        return { ok: true, stdout: `focused ${positional[0]}`, stderr: '', code: 0 }
      }
      if (!hasProfile && command === 'resize') {
        return { ok: true, stdout: `resized ${positional[4] || positional[3] || ''}`.trim(), stderr: '', code: 0 }
      }
      if (!hasProfile && command === 'wait') {
        return { ok: true, stdout: 'wait complete', stderr: '', code: 0 }
      }
      if (!hasProfile && command === 'screenshot' && positional[0] === targetId) {
        return { ok: true, stdout: `MEDIA:${invalidImagePath}`, stderr: '', code: 0 }
      }
      if (!hasProfile && command === 'open') {
        return {
          ok: true,
          stdout: `opened: https://github.com/openclaw/openclaw\n  id: ${reopenedTargetId}\n`,
          stderr: '',
          code: 0,
        }
      }
      if (!hasProfile && command === 'screenshot' && positional[0] === reopenedTargetId) {
        return { ok: true, stdout: `MEDIA:${invalidImagePath}`, stderr: '', code: 0 }
      }
      if (!hasProfile && command === 'create-profile') {
        return { ok: true, stdout: `created: ${positional[1] || ''}`.trim(), stderr: '', code: 0 }
      }
      if (!hasProfile && command === 'delete-profile') {
        return { ok: true, stdout: `deleted: ${positional[1] || ''}`.trim(), stderr: '', code: 0 }
      }
      if (profileName && command === 'open') {
        return {
          ok: true,
          stdout: `opened: https://github.com/openclaw/openclaw\n  id: ${isolatedTargetId}\n`,
          stderr: '',
          code: 0,
        }
      }
      if (profileName && command === 'focus') {
        return { ok: true, stdout: `focused ${positional[0]}`, stderr: '', code: 0 }
      }
      if (profileName && command === 'resize') {
        return { ok: true, stdout: `resized ${positional[4] || positional[3] || ''}`.trim(), stderr: '', code: 0 }
      }
      if (profileName && command === 'wait') {
        return { ok: true, stdout: 'wait complete', stderr: '', code: 0 }
      }
      if (profileName && command === 'screenshot' && positional[0] === isolatedTargetId) {
        return { ok: true, stdout: `MEDIA:${validImagePath}`, stderr: '', code: 0 }
      }
      return { ok: true, stdout: JSON.stringify({ sessions: [] }), stderr: '', code: 0 }
    })

    try {
      const result = await sendChatMessage(
        { sessionId, text: 'Please open GitHub and send me a screenshot of the page.' },
        {
          discoverOpenClaw,
          now: fixedNow,
          readModelStatus: async () => createModelStatus('deepseek-chat'),
          ensureGateway: async () => ({ ok: true, stdout: '', stderr: '', code: 0, running: true }),
          runCommand,
          chatTransport: { run: transportRun as any },
        }
      )

      expect(result.ok).toBe(true)
      expect(String(result.message?.text || '')).not.toContain('\u622a\u56fe\u5931\u8d25')
      expect(result.message?.images).toEqual([
        { url: `data:image/png;base64,${validImageBuffer.toString('base64')}`, mimeType: 'image/png' },
      ])

      const createProfileCall = runCommand.mock.calls.find(
        ([commandArgs]) => commandArgs[0] === 'browser' && commandArgs[1] === 'create-profile'
      )
      const isolatedProfileName = String(createProfileCall?.[0]?.[3] || '')
      expect(isolatedProfileName).toMatch(/^mclaw-screenshot-recovery-/)
      expect(runCommand).toHaveBeenCalledWith(['browser', '--browser-profile', isolatedProfileName, 'open', 'https://github.com/openclaw/openclaw'], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', '--browser-profile', isolatedProfileName, 'screenshot', isolatedTargetId, '--type', 'png'], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'delete-profile', '--name', isolatedProfileName], 20_000)

      const traceStages = listChatTraceEntries(80).map((entry) => entry.stage)
      expect(traceStages).toContain('screenshot-browser-recapture-image-audit')
      expect(traceStages).toContain('screenshot-recaptured-from-browser-cli')
      expect(traceStages).not.toContain('screenshot-missing-image')
    } finally {
      await rm(stateRoot, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('renavigates after Desktop Chrome resets when both the reopened tab and restarted browser still return collapsed screenshots', async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'mclaw-screenshot-restarted-browser-'))
    const sessionId = 'session-log-browser-restarted-browser-session'
    const targetId = '854191081DA544360B43A0488C5EE090'
    const reopenedTargetId = 'C903189F6E93EDE7646DDBE6A852F5CB'
    const restartedTargetId = '7AD7A5B3B0784746850E44E9A06EA3A1'
    const sessionLogDir = path.join(stateRoot, '.openclaw', 'agents', 'main', 'sessions')
    const sessionLogPath = path.join(sessionLogDir, `${sessionId}.jsonl`)
    const mediaDir = path.join(stateRoot, '.openclaw', 'media', 'browser')
    const invalidImagePath = path.join(mediaDir, 'collapsed-recapture.jpg')
    const validImagePath = path.join(mediaDir, 'restarted-browser-device-recapture.png')
    const invalidImageBuffer = createFakeJpegWithDimensions(189, 2000)
    const validImageBuffer = createFakePngWithDimensions(1365, 900)
    const fixedNow = () => Date.parse('2026-04-16T14:34:40+08:00')

    const discoverOpenClaw = async () =>
      ({
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/usr/local/bin/openclaw',
            resolvedBinaryPath: '/usr/local/bin/openclaw',
            packageRoot: '/usr/local/lib/node_modules/openclaw',
            version: '2026.3.24',
            installSource: 'npm-global',
            isPathActive: true,
            configPath: path.join(stateRoot, 'openclaw.json'),
            stateRoot,
            displayConfigPath: path.join(stateRoot, 'openclaw.json'),
            displayStateRoot: stateRoot,
            ownershipState: 'external-preexisting',
            installFingerprint: 'fingerprint-chat-screenshot-browser-restarted-browser',
            baselineBackup: null,
            baselineBackupBypass: null,
          },
        ],
        activeCandidateId: 'candidate-1',
        hasMultipleCandidates: false,
        historyDataCandidates: [],
        errors: [],
        warnings: [],
        defaultBackupDirectory: '/tmp',
      }) as any

    await fs.promises.mkdir(sessionLogDir, { recursive: true })
    await fs.promises.mkdir(mediaDir, { recursive: true })
    await fs.promises.writeFile(invalidImagePath, invalidImageBuffer)
    await fs.promises.writeFile(validImagePath, validImageBuffer)
    await fs.promises.writeFile(
      sessionLogPath,
      [
        JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-04-16T06:34:03.482Z' }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          timestamp: '2026-04-16T06:34:11.902Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-open',
          timestamp: '2026-04-16T06:34:19.175Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Opening GitHub now.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'open', url: 'https://github.com/openclaw/openclaw' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-open',
          timestamp: '2026-04-16T06:34:32.097Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'text', text: JSON.stringify({ targetId, url: 'https://github.com/openclaw/openclaw', type: 'page' }) }],
          },
          details: { targetId, url: 'https://github.com/openclaw/openclaw', type: 'page' },
          isError: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-screenshot',
          timestamp: '2026-04-16T06:34:44.611Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Taking the screenshot now.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'screenshot', targetId, type: 'png' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-screenshot',
          timestamp: '2026-04-16T06:35:21.071Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'image', data: invalidImageBuffer.toString('base64'), mimeType: 'image/jpeg' }],
          },
          details: {
            path: invalidImagePath,
            ok: true,
            targetId,
            type: 'page',
            media: { mediaUrl: invalidImagePath },
          },
          isError: false,
        }),
      ].join('\n'),
      'utf8'
    )

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({ response: { text: 'I captured the screenshot and sent it back.' }, model: 'deepseek-chat' }),
      stderr: '',
      code: 0,
      streamedText: 'I captured the screenshot and sent it back.',
      streamedModel: 'deepseek-chat',
    }))

    let openCallCount = 0
    let reopenedScreenshotCount = 0
    let restartedScreenshotCount = 0
    let reopenedNavigateCount = 0
    let restartedNavigateCount = 0
    const runCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({
            sessions: [{ sessionId, key: 'agent:main:dashboard:browser-restarted-browser', agentId: 'main', model: 'deepseek-chat', updatedAt: 9_900, kind: 'direct' }],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
        return {
          ok: true,
          stdout: JSON.stringify({
            records: [
              {
                type: 'message',
                id: 'user-dashboard-1',
                timestamp: '2026-04-16T06:34:11.902Z',
                message: { role: 'user', content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }] },
              },
              {
                type: 'message',
                id: 'assistant-dashboard-1',
                timestamp: '2026-04-16T06:36:22.229Z',
                message: { role: 'assistant', content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }], model: 'deepseek-chat' },
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && args[1] === 'focus') {
        return { ok: true, stdout: `focused ${args[2]}`, stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'resize') {
        return { ok: true, stdout: `resized ${args[5] || ''}`.trim(), stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'wait') {
        return { ok: true, stdout: 'wait complete', stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'screenshot' && args[2] === targetId) {
        return { ok: true, stdout: `MEDIA:${invalidImagePath}`, stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'screenshot' && args[2] === reopenedTargetId) {
        reopenedScreenshotCount += 1
        return { ok: true, stdout: `MEDIA:${invalidImagePath}`, stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'screenshot' && args[2] === restartedTargetId) {
        restartedScreenshotCount += 1
        return {
          ok: true,
          stdout: restartedNavigateCount > 0 ? `MEDIA:${validImagePath}` : `MEDIA:${invalidImagePath}`,
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && args[1] === 'navigate' && args[2] === 'https://github.com/openclaw/openclaw') {
        if (args[4] === reopenedTargetId) {
          reopenedNavigateCount += 1
        } else if (args[4] === restartedTargetId) {
          restartedNavigateCount += 1
        }
        return { ok: true, stdout: 'navigated to https://github.com/openclaw/openclaw', stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'open') {
        openCallCount += 1
        return {
          ok: true,
          stdout:
            openCallCount === 1
              ? `opened: https://github.com/openclaw/openclaw\n  id: ${reopenedTargetId}\n`
              : `opened: https://github.com/openclaw/openclaw\n  id: ${restartedTargetId}\n`,
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && args[1] === 'create-profile') {
        return {
          ok: false,
          stdout: '',
          stderr: 'GatewayClientRequestError: browser.request cannot create or delete persistent browser profiles',
          code: 1,
        }
      }
      if (args[0] === 'browser' && args[1] === 'stop') {
        return { ok: true, stdout: 'browser [openclaw] running: false', stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'start') {
        return { ok: true, stdout: 'browser [openclaw] running: true', stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'set' && args[2] === 'device') {
        return { ok: true, stdout: 'device: Desktop Chrome', stderr: '', code: 0 }
      }
      return { ok: true, stdout: JSON.stringify({ sessions: [] }), stderr: '', code: 0 }
    })

    try {
      const result = await sendChatMessage(
        { sessionId, text: 'Please open GitHub and send me a screenshot of the page.' },
        {
          discoverOpenClaw,
          now: fixedNow,
          readModelStatus: async () => createModelStatus('deepseek-chat'),
          ensureGateway: async () => ({ ok: true, stdout: '', stderr: '', code: 0, running: true }),
          runCommand,
          chatTransport: { run: transportRun as any },
        }
      )

      expect(result.ok).toBe(true)
      expect(String(result.message?.text || '')).not.toContain('\u622a\u56fe\u5931\u8d25')
      expect(result.message?.images).toEqual([
        { url: `data:image/png;base64,${validImageBuffer.toString('base64')}`, mimeType: 'image/png' },
      ])
      expect(runCommand).toHaveBeenCalledWith(['browser', 'create-profile', '--name', expect.stringMatching(/^mclaw-screenshot-recovery-/)], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'stop'], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'start'], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'set', 'device', 'Desktop Chrome', '--target-id', reopenedTargetId], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'set', 'device', 'Desktop Chrome', '--target-id', restartedTargetId], 20_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'navigate', 'https://github.com/openclaw/openclaw', '--target-id', reopenedTargetId], 45_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'navigate', 'https://github.com/openclaw/openclaw', '--target-id', restartedTargetId], 45_000)
      expect(runCommand).toHaveBeenCalledWith(['browser', 'screenshot', restartedTargetId, '--type', 'png'], 20_000)

      const deleteProfileCall = runCommand.mock.calls.find(
        ([commandArgs]) => commandArgs[0] === 'browser' && commandArgs[1] === 'delete-profile'
      )
      expect(deleteProfileCall).toBeUndefined()
      expect(openCallCount).toBe(2)
      expect(reopenedScreenshotCount).toBe(3)
      expect(restartedScreenshotCount).toBe(3)
      expect(reopenedNavigateCount).toBe(1)
      expect(restartedNavigateCount).toBe(1)

      const traceEntries = listChatTraceEntries(100)
      const recoveryAudit = traceEntries.find((entry) => entry.stage === 'screenshot-browser-recapture-image-audit')
      const recoveryMessage = String(recoveryAudit?.message || '')
      expect(recoveryMessage).toContain('strategy=restarted-browser-device-reset-renavigate')
      expect(recoveryMessage).toContain('create-profile=failed')
      expect(recoveryMessage).toContain('device=ok(device: Desktop Chrome)')
      expect(recoveryMessage).toContain('navigate=ok(navigated to https://github.com/openclaw/openclaw)')
      expect(recoveryMessage).toContain('stop=ok')
      expect(recoveryMessage).toContain('start=ok')
      expect(traceEntries.map((entry) => entry.stage)).toContain('screenshot-recaptured-from-browser-cli')
      expect(traceEntries.map((entry) => entry.stage)).not.toContain('screenshot-missing-image')
    } finally {
      await rm(stateRoot, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('resets the reopened tab to Desktop Chrome before escalating to heavier browser recovery steps', async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'mclaw-screenshot-desktop-device-'))
    const sessionId = 'session-log-browser-desktop-device-session'
    const targetId = '45B9FB3BD7326CE4C2045FC598DF9AB0'
    const reopenedTargetId = 'C24E053AA9CCA0EE9D359767EBAE0C19'
    const sessionLogDir = path.join(stateRoot, '.openclaw', 'agents', 'main', 'sessions')
    const sessionLogPath = path.join(sessionLogDir, `${sessionId}.jsonl`)
    const mediaDir = path.join(stateRoot, '.openclaw', 'media', 'browser')
    const invalidImagePath = path.join(mediaDir, 'collapsed-recapture.jpg')
    const validImagePath = path.join(mediaDir, 'desktop-device-recapture.png')
    const invalidImageBuffer = createFakeJpegWithDimensions(189, 2000)
    const validImageBuffer = createFakePngWithDimensions(1365, 900)
    const fixedNow = () => Date.parse('2026-04-16T15:20:30+08:00')

    const discoverOpenClaw = async () =>
      ({
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/usr/local/bin/openclaw',
            resolvedBinaryPath: '/usr/local/bin/openclaw',
            packageRoot: '/usr/local/lib/node_modules/openclaw',
            version: '2026.3.24',
            installSource: 'npm-global',
            isPathActive: true,
            configPath: path.join(stateRoot, 'openclaw.json'),
            stateRoot,
            displayConfigPath: path.join(stateRoot, 'openclaw.json'),
            displayStateRoot: stateRoot,
            ownershipState: 'external-preexisting',
            installFingerprint: 'fingerprint-chat-screenshot-browser-desktop-device',
            baselineBackup: null,
            baselineBackupBypass: null,
          },
        ],
        activeCandidateId: 'candidate-1',
        hasMultipleCandidates: false,
        historyDataCandidates: [],
        errors: [],
        warnings: [],
        defaultBackupDirectory: '/tmp',
      }) as any

    await fs.promises.mkdir(sessionLogDir, { recursive: true })
    await fs.promises.mkdir(mediaDir, { recursive: true })
    await fs.promises.writeFile(invalidImagePath, invalidImageBuffer)
    await fs.promises.writeFile(validImagePath, validImageBuffer)
    await fs.promises.writeFile(
      sessionLogPath,
      [
        JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-04-16T07:19:25.525Z' }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          timestamp: '2026-04-16T07:19:30.902Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-open',
          timestamp: '2026-04-16T07:19:35.175Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Opening GitHub now.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'open', url: 'https://github.com/openclaw/openclaw' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-open',
          timestamp: '2026-04-16T07:19:44.097Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'text', text: JSON.stringify({ targetId, url: 'https://github.com/openclaw/openclaw', type: 'page' }) }],
          },
          details: { targetId, url: 'https://github.com/openclaw/openclaw', type: 'page' },
          isError: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-screenshot',
          timestamp: '2026-04-16T07:19:55.611Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Taking the screenshot now.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'screenshot', targetId, type: 'png' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-screenshot',
          timestamp: '2026-04-16T07:20:18.071Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'image', data: invalidImageBuffer.toString('base64'), mimeType: 'image/jpeg' }],
          },
          details: {
            path: invalidImagePath,
            ok: true,
            targetId,
            type: 'page',
            media: { mediaUrl: invalidImagePath },
          },
          isError: false,
        }),
      ].join('\n'),
      'utf8'
    )

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({ response: { text: 'I captured the screenshot and sent it back.' }, model: 'deepseek-chat' }),
      stderr: '',
      code: 0,
      streamedText: 'I captured the screenshot and sent it back.',
      streamedModel: 'deepseek-chat',
    }))

    let reopenedScreenshotCount = 0
    const runCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({
            sessions: [{ sessionId, key: 'agent:main:dashboard:browser-desktop-device', agentId: 'main', model: 'deepseek-chat', updatedAt: 9_900, kind: 'direct' }],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
        return {
          ok: true,
          stdout: JSON.stringify({
            records: [
              {
                type: 'message',
                id: 'user-dashboard-1',
                timestamp: '2026-04-16T07:19:30.902Z',
                message: { role: 'user', content: [{ type: 'text', text: 'Please open GitHub and send me a screenshot of the page.' }] },
              },
              {
                type: 'message',
                id: 'assistant-dashboard-1',
                timestamp: '2026-04-16T07:22:07.229Z',
                message: { role: 'assistant', content: [{ type: 'text', text: 'I captured the screenshot and sent it back.' }], model: 'deepseek-chat' },
              },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && args[1] === 'focus') {
        return { ok: true, stdout: `focused tab ${args[2]}`, stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'resize') {
        return { ok: true, stdout: `resized to ${args[2]}x${args[3]}`, stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'wait') {
        return { ok: true, stdout: 'wait complete', stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'screenshot' && args[2] === targetId) {
        return { ok: true, stdout: `MEDIA:${invalidImagePath}`, stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'open') {
        return {
          ok: true,
          stdout: `opened: https://github.com/openclaw/openclaw\n  id: ${reopenedTargetId}\n`,
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && args[1] === 'set' && args[2] === 'device') {
        return { ok: true, stdout: 'device: Desktop Chrome', stderr: '', code: 0 }
      }
      if (args[0] === 'browser' && args[1] === 'screenshot' && args[2] === reopenedTargetId) {
        reopenedScreenshotCount += 1
        return {
          ok: true,
          stdout: reopenedScreenshotCount === 1 ? `MEDIA:${invalidImagePath}` : `MEDIA:${validImagePath}`,
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && (args[1] === 'create-profile' || args[1] === 'stop' || args[1] === 'start')) {
        return { ok: false, stdout: '', stderr: `${args[1]} should not run`, code: 1 }
      }
      return { ok: true, stdout: JSON.stringify({ sessions: [] }), stderr: '', code: 0 }
    })

    try {
      const result = await sendChatMessage(
        { sessionId, text: 'Please open GitHub and send me a screenshot of the page.' },
        {
          discoverOpenClaw,
          now: fixedNow,
          readModelStatus: async () => createModelStatus('deepseek-chat'),
          ensureGateway: async () => ({ ok: true, stdout: '', stderr: '', code: 0, running: true }),
          runCommand,
          chatTransport: { run: transportRun as any },
        }
      )

      expect(result.ok).toBe(true)
      expect(String(result.message?.text || '')).not.toContain('\u622a\u56fe\u5931\u8d25')
      expect(result.message?.images).toEqual([
        { url: `data:image/png;base64,${validImageBuffer.toString('base64')}`, mimeType: 'image/png' },
      ])
      expect(runCommand).toHaveBeenCalledWith(['browser', 'set', 'device', 'Desktop Chrome', '--target-id', reopenedTargetId], 20_000)
      expect(runCommand).not.toHaveBeenCalledWith(['browser', 'create-profile', '--name', expect.any(String)], 20_000)
      expect(runCommand).not.toHaveBeenCalledWith(['browser', 'stop'], 20_000)
      expect(runCommand).not.toHaveBeenCalledWith(['browser', 'start'], 20_000)
      expect(reopenedScreenshotCount).toBe(2)

      const traceEntries = listChatTraceEntries(100)
      const recoveryAudit = traceEntries.find((entry) => entry.stage === 'screenshot-browser-recapture-image-audit')
      const recoveryMessage = String(recoveryAudit?.message || '')
      expect(recoveryMessage).toContain('strategy=desktop-device-reset')
      expect(recoveryMessage).toContain('device=ok(device: Desktop Chrome)')
      expect(traceEntries.map((entry) => entry.stage)).toContain('screenshot-recaptured-from-browser-cli')
      expect(traceEntries.map((entry) => entry.stage)).not.toContain('screenshot-missing-image')
    } finally {
      await rm(stateRoot, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('recovers screenshot from browser recapture when CLI returns a bare file path without MEDIA: prefix', async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'mclaw-screenshot-bare-path-'))
    const sessionId = 'bare-path-recapture-session'
    const targetId = 'bare-path-target-id-001'
    const sessionLogDir = path.join(stateRoot, '.openclaw', 'agents', 'main', 'sessions')
    const sessionLogPath = path.join(sessionLogDir, `${sessionId}.jsonl`)
    const mediaDir = path.join(stateRoot, '.openclaw', 'media', 'browser')
    const validImagePath = path.join(mediaDir, 'bare-path-recapture.png')
    const validImageBuffer = createFakePngWithDimensions(1365, 900)
    const invalidImageBuffer = createFakePngWithDimensions(2, 800)
    const fixedNow = () => Date.parse('2026-04-16T03:00:00+08:00')

    const discoverOpenClaw = async () =>
      ({
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/usr/local/bin/openclaw',
            resolvedBinaryPath: '/usr/local/bin/openclaw',
            packageRoot: '/usr/local/lib/node_modules/openclaw',
            version: '2026.3.24',
            installSource: 'npm-global',
            isPathActive: true,
            configPath: path.join(stateRoot, 'openclaw.json'),
            stateRoot,
            displayConfigPath: path.join(stateRoot, 'openclaw.json'),
            displayStateRoot: stateRoot,
            ownershipState: 'external-preexisting',
            installFingerprint: 'fingerprint-chat-screenshot-bare-path',
            baselineBackup: null,
            baselineBackupBypass: null,
          },
        ],
        activeCandidateId: 'candidate-1',
        hasMultipleCandidates: false,
        historyDataCandidates: [],
        errors: [],
        warnings: [],
        defaultBackupDirectory: '/tmp',
      }) as any

    await fs.promises.mkdir(sessionLogDir, { recursive: true })
    await fs.promises.mkdir(mediaDir, { recursive: true })
    await fs.promises.writeFile(validImagePath, validImageBuffer)
    await fs.promises.writeFile(
      sessionLogPath,
      [
        JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-04-15T19:00:00.000Z' }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          timestamp: '2026-04-15T19:00:01.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Please take a screenshot.' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-1',
          timestamp: '2026-04-15T19:00:02.000Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Taking screenshot.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'screenshot', targetId, type: 'png' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-1',
          timestamp: '2026-04-15T19:00:03.000Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'image', data: invalidImageBuffer.toString('base64'), mimeType: 'image/png' }],
          },
          details: { path: path.join(stateRoot, '.openclaw', 'media', 'browser', 'nonexistent-invalid.png'), ok: true, targetId, url: 'https://github.com/openclaw/openclaw' },
          isError: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-2',
          timestamp: '2026-04-15T19:00:04.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }], model: 'deepseek-chat' },
        }),
      ].join('\n'),
      'utf8'
    )

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({ response: { text: 'Done.' }, model: 'deepseek-chat' }),
      stderr: '',
      code: 0,
      streamedText: 'Done.',
      streamedModel: 'deepseek-chat',
    }))

    const runCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({
            sessions: [{ sessionId, key: 'agent:main:dashboard:bare-path', agentId: 'main', model: 'deepseek-chat', updatedAt: 9_400, kind: 'direct' }],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
        return {
          ok: true,
          stdout: JSON.stringify({
            records: [
              { type: 'message', id: 'user-d-1', timestamp: '2026-04-15T19:00:01.000Z', message: { role: 'user', content: [{ type: 'text', text: 'Please take a screenshot.' }] } },
              { type: 'message', id: 'assistant-d-1', timestamp: '2026-04-15T19:00:04.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }], model: 'deepseek-chat' } },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && args[1] === 'focus') return { ok: true, stdout: 'focused', stderr: '', code: 0 }
      if (args[0] === 'browser' && args[1] === 'resize') return { ok: true, stdout: 'resized', stderr: '', code: 0 }
      if (args[0] === 'browser' && args[1] === 'screenshot') {
        // Return bare file path without MEDIA: prefix — the fallback extractor should handle this
        return { ok: true, stdout: validImagePath, stderr: '', code: 0 }
      }
      return { ok: true, stdout: JSON.stringify({ sessions: [] }), stderr: '', code: 0 }
    })

    try {
      const result = await sendChatMessage(
        { sessionId, text: 'Please take a screenshot.' },
        {
          discoverOpenClaw,
          now: fixedNow,
          readModelStatus: async () => createModelStatus('deepseek-chat'),
          ensureGateway: async () => ({ ok: true, stdout: '', stderr: '', code: 0, running: true }),
          runCommand,
          chatTransport: { run: transportRun as any },
        }
      )

      expect(result.ok).toBe(true)
      expect(String(result.message?.text || '')).not.toContain('\u622a\u56fe\u5931\u8d25')
      expect(result.message?.images).toEqual([
        { url: `data:image/png;base64,${validImageBuffer.toString('base64')}`, mimeType: 'image/png' },
      ])
      const traceStages = listChatTraceEntries(30).map((entry) => entry.stage)
      expect(traceStages).toContain('screenshot-recaptured-from-browser-cli')
      expect(traceStages).not.toContain('screenshot-missing-image')
    } finally {
      await rm(stateRoot, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('recovers screenshot from browser recapture when CLI returns a MEDIA path rooted at OPENCLAW_HOME', async () => {
    const openClawHomeRoot = await mkdtemp(path.join(os.tmpdir(), 'mclaw-screenshot-openclaw-home-'))
    const stateRoot = path.join(openClawHomeRoot, '.openclaw')
    const sessionId = 'openclaw-home-media-session'
    const targetId = 'openclaw-home-target-id-001'
    const sessionLogDir = path.join(stateRoot, 'agents', 'main', 'sessions')
    const sessionLogPath = path.join(sessionLogDir, `${sessionId}.jsonl`)
    const mediaDir = path.join(stateRoot, 'media', 'browser')
    const validImagePath = path.join(mediaDir, 'recaptured-from-openclaw-home.jpg')
    const validImageBuffer = createFakeJpegWithDimensions(1365, 900)
    const invalidImageBuffer = createFakePngWithDimensions(2, 800)
    const fixedNow = () => Date.parse('2026-04-16T03:00:00+08:00')
    const previousOpenClawHome = process.env.OPENCLAW_HOME

    delete process.env.OPENCLAW_HOME

    const discoverOpenClaw = async () =>
      ({
        status: 'installed',
        candidates: [
          {
            candidateId: 'candidate-1',
            binaryPath: '/usr/local/bin/openclaw',
            resolvedBinaryPath: '/usr/local/bin/openclaw',
            packageRoot: '/usr/local/lib/node_modules/openclaw',
            version: '2026.3.24',
            installSource: 'npm-global',
            isPathActive: true,
            configPath: path.join(openClawHomeRoot, 'openclaw.json'),
            stateRoot,
            displayConfigPath: path.join(openClawHomeRoot, 'openclaw.json'),
            displayStateRoot: stateRoot,
            ownershipState: 'external-preexisting',
            installFingerprint: 'fingerprint-chat-screenshot-openclaw-home',
            baselineBackup: null,
            baselineBackupBypass: null,
          },
        ],
        activeCandidateId: 'candidate-1',
        hasMultipleCandidates: false,
        historyDataCandidates: [],
        errors: [],
        warnings: [],
        defaultBackupDirectory: '/tmp',
      }) as any

    await fs.promises.mkdir(sessionLogDir, { recursive: true })
    await fs.promises.mkdir(mediaDir, { recursive: true })
    await fs.promises.writeFile(validImagePath, validImageBuffer)
    await fs.promises.writeFile(
      sessionLogPath,
      [
        JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-04-15T19:00:00.000Z' }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          timestamp: '2026-04-15T19:00:01.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Please take a screenshot.' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-1',
          timestamp: '2026-04-15T19:00:02.000Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Taking screenshot.' },
              { type: 'toolCall', name: 'browser', arguments: { action: 'screenshot', targetId, type: 'png' } },
            ],
            model: 'deepseek-chat',
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-1',
          timestamp: '2026-04-15T19:00:03.000Z',
          message: {
            role: 'toolResult',
            toolName: 'browser',
            content: [{ type: 'image', data: invalidImageBuffer.toString('base64'), mimeType: 'image/png' }],
          },
          details: { path: path.join(stateRoot, 'media', 'browser', 'nonexistent-invalid.png'), ok: true, targetId, url: 'https://github.com/openclaw/openclaw' },
          isError: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-2',
          timestamp: '2026-04-15T19:00:04.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }], model: 'deepseek-chat' },
        }),
      ].join('\n'),
      'utf8'
    )

    const transportRun = vi.fn(async () => ({
      ok: true,
      stdout: JSON.stringify({ response: { text: 'Done.' }, model: 'deepseek-chat' }),
      stderr: '',
      code: 0,
      streamedText: 'Done.',
      streamedModel: 'deepseek-chat',
    }))

    const runCommand = vi.fn(async (args: string[]) => {
      if (args[0] === 'sessions') {
        return {
          ok: true,
          stdout: JSON.stringify({
            sessions: [{ sessionId, key: 'agent:main:dashboard:openclaw-home', agentId: 'main', model: 'deepseek-chat', updatedAt: 9_600, kind: 'direct' }],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'gateway' && args[1] === 'call' && args[2] === 'sessions.get') {
        return {
          ok: true,
          stdout: JSON.stringify({
            records: [
              { type: 'message', id: 'user-d-1', timestamp: '2026-04-15T19:00:01.000Z', message: { role: 'user', content: [{ type: 'text', text: 'Please take a screenshot.' }] } },
              { type: 'message', id: 'assistant-d-1', timestamp: '2026-04-15T19:00:04.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }], model: 'deepseek-chat' } },
            ],
          }),
          stderr: '',
          code: 0,
        }
      }
      if (args[0] === 'browser' && args[1] === 'focus') return { ok: true, stdout: 'focused', stderr: '', code: 0 }
      if (args[0] === 'browser' && args[1] === 'resize') return { ok: true, stdout: 'resized', stderr: '', code: 0 }
      if (args[0] === 'browser' && args[1] === 'screenshot') {
        return {
          ok: true,
          stdout: 'MEDIA:$OPENCLAW_HOME\\.openclaw\\media\\browser\\recaptured-from-openclaw-home.jpg',
          stderr: '',
          code: 0,
        }
      }
      return { ok: true, stdout: JSON.stringify({ sessions: [] }), stderr: '', code: 0 }
    })

    try {
      const result = await sendChatMessage(
        { sessionId, text: 'Please take a screenshot.' },
        {
          discoverOpenClaw,
          now: fixedNow,
          readModelStatus: async () => createModelStatus('deepseek-chat'),
          ensureGateway: async () => ({ ok: true, stdout: '', stderr: '', code: 0, running: true }),
          runCommand,
          chatTransport: { run: transportRun as any },
        }
      )

      expect(result.ok).toBe(true)
      expect(String(result.message?.text || '')).not.toContain('\u622a\u56fe\u5931\u8d25')
      expect(result.message?.images).toEqual([
        { url: `data:image/jpeg;base64,${validImageBuffer.toString('base64')}`, mimeType: 'image/jpeg' },
      ])
      const traceStages = listChatTraceEntries(30).map((entry) => entry.stage)
      expect(traceStages).toContain('screenshot-recaptured-from-browser-cli')
      expect(traceStages).not.toContain('screenshot-missing-image')
    } finally {
      if (previousOpenClawHome == null) {
        delete process.env.OPENCLAW_HOME
      } else {
        process.env.OPENCLAW_HOME = previousOpenClawHome
      }
      await rm(openClawHomeRoot, { recursive: true, force: true }).catch(() => undefined)
    }
  })
})
