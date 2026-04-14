import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callGatewayRpcViaSocketMock } = vi.hoisted(() => ({
  callGatewayRpcViaSocketMock: vi.fn(),
}))

vi.mock('../cli', () => ({
  readConfig: vi.fn().mockResolvedValue(null),
  readEnvFile: vi.fn().mockResolvedValue({}),
  runCli: vi.fn(),
  runShell: vi.fn(),
}))

vi.mock('../chat-transport/gateway-streaming-chat-transport', () => ({
  callGatewayRpcViaSocket: callGatewayRpcViaSocketMock,
  OPENCLAW_WEBCHAT_CLIENT_ID: 'openclaw-control-ui',
  OPENCLAW_WEBCHAT_CLIENT_MODE: 'webchat',
  OPENCLAW_WEBCHAT_CLIENT_VERSION: 'v2026.3.24',
}))

import { parseLsofPortOwnerOutput, probeGatewaySocketReady } from '../openclaw-gateway-probes'
import { DEFAULT_GATEWAY_PORT, isManagedGatewayPort, resolveGatewayConfiguredPort } from '../../../src/shared/gateway-runtime-state'

describe('openclaw gateway probes', () => {
  beforeEach(() => {
    callGatewayRpcViaSocketMock.mockReset()
  })

  it('confirms socket readiness when the gateway answers a lightweight RPC', async () => {
    callGatewayRpcViaSocketMock.mockResolvedValueOnce({
      sessions: [],
    })

    await expect(probeGatewaySocketReady(1234)).resolves.toBe(true)
    expect(callGatewayRpcViaSocketMock).toHaveBeenCalledWith(
      expect.objectContaining({
        readConfig: expect.any(Function),
        readEnvFile: expect.any(Function),
      }),
      'sessions.list',
      {
        limit: 1,
        includeDerivedTitles: false,
      },
      expect.objectContaining({
        clientId: 'openclaw-control-ui',
        clientMode: 'webchat',
        timeoutMs: 1234,
      })
    )
  })

  it('returns false when the socket RPC probe fails', async () => {
    callGatewayRpcViaSocketMock.mockRejectedValueOnce(new Error('gateway closed'))

    await expect(probeGatewaySocketReady()).resolves.toBe(false)
  })

  it('parses OpenClaw owners from lsof output', () => {
    const owner = parseLsofPortOwnerOutput(
      [
        'COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME',
        'openclaw 1024 test   21u  IPv4 0x12345678      0t0  TCP 127.0.0.1:18789 (LISTEN)',
      ].join('\n'),
      18789
    )

    expect(owner.kind).toBe('openclaw')
    expect(owner.pid).toBe(1024)
  })

  it('parses foreign owners from lsof output', () => {
    const owner = parseLsofPortOwnerOutput(
      [
        'COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME',
        'python3  2451 test   23u  IPv4 0x12345678      0t0  TCP 127.0.0.1:18789 (LISTEN)',
      ].join('\n'),
      18789
    )

    expect(owner.kind).toBe('foreign')
    expect(owner.processName).toBe('python3')
  })

  it('returns none when lsof finds no listener', () => {
    const owner = parseLsofPortOwnerOutput(
      'COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME',
      18789
    )

    expect(owner.kind).toBe('none')
  })

  it('resolves the configured gateway port and managed-port policy', () => {
    expect(resolveGatewayConfiguredPort(null)).toBe(DEFAULT_GATEWAY_PORT)
    expect(
      resolveGatewayConfiguredPort({
        gateway: {
          port: '19123',
        },
      })
    ).toBe(19123)
    expect(isManagedGatewayPort(null)).toBe(true)
    expect(
      isManagedGatewayPort({
        gateway: {
          port: 19123,
        },
      })
    ).toBe(false)
  })
})
