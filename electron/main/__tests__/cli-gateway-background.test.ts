import { describe, expect, it } from 'vitest'

const { readFile } = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

describe('gateway foreground compatibility spawn wiring', () => {
  it('uses the direct Node entrypoint fallback on Windows and avoids pipe stdio', async () => {
    const cliSource = await readFile(path.join(process.cwd(), 'electron/main/cli.ts'), 'utf8')

    expect(cliSource).toContain('export async function resolveGatewayForegroundSpawnTarget')
    expect(cliSource).toContain("args: [openClawEntryPath, ...options.args]")
    expect(cliSource).toContain("commandDir ? join(commandDir, 'node.exe') : ''")
    expect(cliSource).toContain("stdioMode: 'fd'")
    expect(cliSource).toContain("const stdoutFd = spawnTarget.stdioMode === 'fd' ? openSync(stdoutLogPath, 'a') : null")
    expect(cliSource).toContain("stdio: spawnTarget.stdioMode === 'fd'")
    expect(cliSource).not.toContain("shell: resolvedCommand.shell,\n        stdio: ['ignore', 'pipe', 'pipe'],\n        detached: true,")
  })
})
