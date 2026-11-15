import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import type { AgentTool } from './local-agent'

export async function connectMcpTools(signal: AbortSignal): Promise<{ tools: AgentTool[]; close: () => Promise<void> }> {
  const address = process.env.MCLAW_MCP_URL?.trim()
  if (!address) return { tools: [], close: async () => {} }
  const allowed = new Set(process.env.MCLAW_MCP_TOOLS?.split(',').map((name) => name.trim()).filter(Boolean))
  if (!allowed.size || allowed.size > 16 || [...allowed].some((name) => !/^[A-Za-z0-9_-]{1,60}$/.test(name))) {
    throw new Error('请用 MCLAW_MCP_TOOLS 指定 1–16 个 MCP 工具名称')
  }
  const endpoint = new URL(address)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
  if ((endpoint.protocol !== 'https:' && !(loopback && endpoint.protocol === 'http:')) ||
    endpoint.username || endpoint.password || endpoint.hash || endpoint.search) {
    throw new Error('MCP 服务需要 HTTPS 或本机 HTTP，URL 中不能包含凭据')
  }
  const headers = new Headers()
  const token = process.env.MCLAW_MCP_TOKEN?.trim()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers },
    fetch: (input, init) => {
      const timeout = AbortSignal.timeout(init?.method === 'DELETE' ? 2_000 : 12_000)
      return fetch(input, {
        ...init, redirect: 'error',
        signal: init?.signal ? AbortSignal.any([timeout, init.signal]) : timeout,
      })
    },
  })
  const client = new Client({ name: 'mclaw-local-agent', version: '1.0.0' })
  const options = { timeout: 8_000, signal }
  try {
    await client.connect(transport, options)
    const tools: AgentTool[] = []
    let cursor: string | undefined
    const seen = new Set<string>()
    const cursors = new Set<string>()
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined, options)
      for (const tool of page.tools) {
        if (!allowed.has(tool.name) || seen.has(tool.name)) continue
        seen.add(tool.name)
        tools.push({
          name: `mcp_${tool.name}`,
          description: tool.description?.slice(0, 600) || tool.name,
          parameters: tool.inputSchema,
          call: async (argumentsText, callSignal) => {
            const args: unknown = JSON.parse(argumentsText)
            if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('MCP 参数需为 JSON 对象')
            const raw = await client.callTool({ name: tool.name, arguments: args as Record<string, unknown> },
              CallToolResultSchema, { timeout: 10_000, signal: callSignal })
            const result = CallToolResultSchema.parse(raw)
            if (result.isError) throw new Error('MCP 工具执行失败')
            const text = result.content?.flatMap((item) => item.type === 'text' ? [item.text] : []).join('\n')
            return (text || (result.structuredContent ? JSON.stringify(result.structuredContent) : '工具没有返回文本')).slice(0, 6000)
          },
        })
      }
      cursor = page.nextCursor
      if (seen.size === allowed.size) break
      if (cursor) {
        if (cursors.has(cursor) || cursors.size >= 8) throw new Error('MCP 工具列表分页无效或超限')
        cursors.add(cursor)
      }
    } while (cursor && !signal.aborted)
    if (seen.size !== allowed.size) throw new Error('MCP 服务未提供配置的全部工具')
    return { tools, close: async () => {
      if (transport.sessionId) await transport.terminateSession().catch(() => {})
      await client.close()
    } }
  } catch (error) {
    await client.close().catch(() => {})
    throw error
  }
}
