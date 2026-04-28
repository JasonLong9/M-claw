import { describe, expect, it } from 'vitest'

const { readFile } = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

describe('gateway background spawn wiring', () => {
  it('starts the foreground-compatible gateway through a hidden Mclaw-managed child process', async () => {
    const cliSource = await readFile(path.join(process.cwd(), 'electron/main/cli.ts'), 'utf8')
    const spawnSource = await readFile(path.join(process.cwd(), 'electron/main/openclaw-spawn.ts'), 'utf8')

    expect(cliSource).toContain('export async function gatewayRunInBackground')
    expect(cliSource).toMatch(/const args = \[\s*'gateway',\s*'run',/)
    expect(cliSource).toContain('resolveWindowsGatewayDirectRuntimeCommand(args, mergedEnv)')
    expect(cliSource).toContain('throw new Error(\n      \'Windows gateway must use a direct hidden Node runtime.')
    expect(cliSource).toContain("shell: windowsShellInvocation ? false : resolvedCommand.shell,\n        stdio: ['ignore', 'pipe', 'pipe'],\n        detached: process.platform !== 'win32',\n        windowsHide: true,")
    expect(cliSource).toContain('windowsManagedGatewayProcess = proc')
    expect(cliSource).toContain("trackActiveProcess(proc, WINDOWS_GATEWAY_RUNTIME_DOMAIN)")
    expect(spawnSource).toContain('resolveBundledWindowsDirectInvocation')
    expect(spawnSource).toContain('resolveShimWindowsDirectInvocation')
    expect(spawnSource).toContain('args: [entryPointPath, ...args]')
  })
})
