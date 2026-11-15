import { afterEach, expect, it, vi } from 'vitest'
import { validateChatFile } from '../../../src/shared/chat-files'
import { runLocalAgent } from '../local-agent'
import { connectMcpTools } from '../mcp-tools'

const model = { baseUrl: 'http://127.0.0.1:8080/v1', model: 'test-model' }
const reply = (message: object) => Response.json({ choices: [{ message }] })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('validates supported UTF-8 text attachments and forwards their contents to the model', async () => {
  const attachment = validateChatFile({ name: '数据.CSV', text: '名称,数量\n蓝莓,3' })
  expect(() => validateChatFile({ name: '数据.pdf', text: 'x' })).toThrow()
  expect(() => validateChatFile({ name: '../数据.csv', text: 'x' })).toThrow()
  expect(() => validateChatFile({ name: '数据.csv', text: '莓'.repeat(12000) })).toThrow()
  const request = vi.fn<typeof fetch>().mockResolvedValue(reply({ content: '蓝莓 3 个' }))
  const call = vi.fn<() => Promise<string>>()
  const result = await runLocalAgent('表里有什么？', '', { ...model, attachment, tools: [
    { name: 'mcp_remote', description: '', parameters: {}, call },
  ] }, request)
  const payload = JSON.parse(String(request.mock.calls[0][1]?.body))
  expect(JSON.parse(payload.messages.at(-1).content)).toEqual({ question: '表里有什么？', attachment })
  expect(payload.tools.map(({ function: fn }: any) => fn.name)).not.toContain('mcp_remote')
  expect(call).not.toHaveBeenCalled()
  expect(result.answer).toBe('蓝莓 3 个')
})

it('negotiates MCP, lists only configured tools and returns actual protocol results to the model', async () => {
  vi.stubEnv('MCLAW_MCP_URL', 'http://127.0.0.1:9001/mcp')
  vi.stubEnv('MCLAW_MCP_TOOLS', 'convert_units')
  const protocolCalls: Array<{ method: string; params?: unknown }> = []
  const server = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
    if (init?.method === 'GET') return new Response(null, { status: 405 })
    const message = JSON.parse(String(init?.body))
    protocolCalls.push(message)
    if (message.method === 'notifications/initialized') return new Response(null, { status: 202 })
    const tool = (name: string) => ({ name, description: 'Unit conversion', inputSchema: { type: 'object' } })
    const results: Record<string, object> = {
      initialize: { protocolVersion: message.params?.protocolVersion, capabilities: { tools: {} },
        serverInfo: { name: 'test-server', version: '1' } },
      'tools/list': { tools: [tool('convert_units'), tool('other')] },
      'tools/call': { content: [{ type: 'text', text: '200 cm' }] },
    }
    return Response.json({ jsonrpc: '2.0', id: message.id, result: results[message.method] })
  })
  vi.stubGlobal('fetch', server)
  const mcp = await connectMcpTools(AbortSignal.timeout(5000))
  try {
    expect(mcp.tools.map(({ name }) => name)).toEqual(['mcp_convert_units'])
    const provider = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(reply({ content: null, tool_calls: [{
        id: 'conversion', type: 'function', function: {
          name: 'mcp_convert_units', arguments: '{"meters":2}',
        },
      }] }))
      .mockResolvedValueOnce(reply({ content: '2 米是 200 厘米。' }))
    const result = await runLocalAgent('把 2 米换成厘米', '', { ...model, tools: mcp.tools }, provider)
    expect(result.answer).toBe('2 米是 200 厘米。')
    expect(result.trace.transitions).toContainEqual({ step: 1, state: 'tool', tool: 'mcp_convert_units', ok: true })
    expect(protocolCalls.map(({ method }) => method)).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'tools/call'])
    expect(protocolCalls.at(-1)?.params).toMatchObject({ name: 'convert_units', arguments: { meters: 2 } })
    expect(JSON.parse(String(provider.mock.calls[1][1]?.body)).messages.at(-1))
      .toEqual({ role: 'tool', tool_call_id: 'conversion', content: '200 cm' })
  } finally {
    await mcp.close()
  }
})
