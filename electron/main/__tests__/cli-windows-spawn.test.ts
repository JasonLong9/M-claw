import { describe, expect, it } from 'vitest'

const { readFile } = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

describe('windows cli spawn visibility', () => {
  it('hides qclaw-managed wrapper consoles for spawned commands', async () => {
    const cliSource = await readFile(path.join(process.cwd(), 'electron/main/cli.ts'), 'utf8')

    expect(cliSource).toContain("shell: resolvedCommand.shell,\n      windowsHide: true,")
    expect(cliSource).toContain("shell: forceOpenShell ? true : useShell,\n        timeout,\n        windowsHide: true,")
    expect(cliSource).toContain("cwd: resolveManagedSpawnCwd(),\n      timeout,\n      windowsHide: true,")
    expect(cliSource).toMatch(/resolveOpenClawCommand\(args, \{[\s\S]*commandPath: explicitBinaryPath \|\| undefined,[\s\S]*env: mergedEnv,[\s\S]*\}\)/)
    expect(cliSource).toMatch(/resolveOpenClawCommand\(args, \{[\s\S]*commandPath: binaryPath \|\| undefined,[\s\S]*env: mergedEnv,[\s\S]*\}\)/)
  })
})
