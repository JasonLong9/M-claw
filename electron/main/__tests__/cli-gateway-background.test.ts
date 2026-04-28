import { describe, expect, it } from 'vitest'

const { readFile } = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

describe('gateway background spawn wiring', () => {
  it('starts the foreground-compatible gateway through a hidden Mclaw-managed child process', async () => {
    const cliSource = await readFile(path.join(process.cwd(), 'electron/main/cli.ts'), 'utf8')
    const spawnSource = await readFile(path.join(process.cwd(), 'electron/main/openclaw-spawn.ts'), 'utf8')

    expect(cliSource).toContain('export async function gatewayRunInBackground')
    expect(cliSource).toMatch(/const args = \[\s*'gateway',\s*'run',/)
    expect(cliSource).toMatch(/resolveOpenClawCommand\(args, \{[\s\S]*commandPath: binaryPath \|\| undefined,[\s\S]*env: mergedEnv,[\s\S]*\}\)/)
    expect(cliSource).toContain('resolveHiddenWindowsShellInvocation(resolvedCommand.command, resolvedCommand.args)')
    expect(cliSource).toContain("shell: windowsShellInvocation ? false : resolvedCommand.shell,\n        stdio: ['ignore', 'pipe', 'pipe'],\n        detached: true,\n        windowsHide: true,")
    expect(spawnSource).toContain('resolveBundledWindowsDirectInvocation')
    expect(spawnSource).toContain('resolveShimWindowsDirectInvocation')
    expect(spawnSource).toContain('args: [entryPointPath, ...args]')
  })
})
