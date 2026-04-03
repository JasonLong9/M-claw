import { beforeEach, describe, expect, it, vi } from 'vitest'

const { runShellMock } = vi.hoisted(() => ({
  runShellMock: vi.fn(),
}))

vi.mock('../cli', () => ({
  runShell: runShellMock,
}))

describe('getFeishuOfficialCliStatus', () => {
  beforeEach(() => {
    runShellMock.mockReset()
  })

  it('reports missing official CLI without blocking the existing plugin flow', async () => {
    runShellMock.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: "'lark-cli' 不是内部或外部命令，也不是可运行的程序或批处理文件。",
      code: 1,
    })

    const { getFeishuOfficialCliStatus } = await import('../feishu-official-cli-state')
    const result = await getFeishuOfficialCliStatus()

    expect(result.available).toBe(false)
    expect(result.authState).toBe('unknown')
    expect(result.summary).toContain('未检测到飞书官方 CLI')
    expect(result.recommendedAction).toContain('安装 lark-cli')
    expect(runShellMock).toHaveBeenCalledTimes(1)
  })

  it('marks the CLI as unauthenticated when auth status asks the user to login', async () => {
    runShellMock
      .mockResolvedValueOnce({
        ok: true,
        stdout: 'lark-cli 1.2.3',
        stderr: '',
        code: 0,
      })
      .mockResolvedValueOnce({
        ok: false,
        stdout: '',
        stderr: 'Please login first.',
        code: 1,
      })

    const { getFeishuOfficialCliStatus } = await import('../feishu-official-cli-state')
    const result = await getFeishuOfficialCliStatus()

    expect(result.available).toBe(true)
    expect(result.version).toBe('1.2.3')
    expect(result.authState).toBe('unauthenticated')
    expect(result.recommendedAction).toContain('lark-cli auth login')
    expect(runShellMock).toHaveBeenNthCalledWith(
      1,
      'lark-cli',
      ['--version'],
      expect.any(Number),
      expect.objectContaining({
        controlDomain: 'env-setup',
      })
    )
    expect(runShellMock).toHaveBeenNthCalledWith(
      2,
      'lark-cli',
      ['auth', 'status'],
      expect.any(Number),
      expect.objectContaining({
        controlDomain: 'env-setup',
      })
    )
  })

  it('marks the CLI as authenticated when auth status reports a logged-in session', async () => {
    runShellMock
      .mockResolvedValueOnce({
        ok: true,
        stdout: 'version 2.0.0',
        stderr: '',
        code: 0,
      })
      .mockResolvedValueOnce({
        ok: true,
        stdout: 'Logged in as dev@example.com',
        stderr: '',
        code: 0,
      })

    const { getFeishuOfficialCliStatus } = await import('../feishu-official-cli-state')
    const result = await getFeishuOfficialCliStatus()

    expect(result.available).toBe(true)
    expect(result.version).toBe('2.0.0')
    expect(result.authState).toBe('authenticated')
    expect(result.summary).toContain('授权状态看起来已就绪')
    expect(result.recommendedAction).toContain('官方插件安装器')
  })
})
