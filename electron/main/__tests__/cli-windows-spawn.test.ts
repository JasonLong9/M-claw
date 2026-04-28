import { describe, expect, it } from 'vitest'

const { readFile } = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

describe('windows cli spawn visibility', () => {
  it('hides qclaw-managed wrapper consoles for spawned commands', async () => {
    const cliSource = await readFile(path.join(process.cwd(), 'electron/main/cli.ts'), 'utf8')

    expect(cliSource).toContain('resolveHiddenWindowsShellInvocation')
    expect(cliSource).toContain("shell: windowsShellInvocation ? false : resolvedCommand.shell,\n      windowsHide: true,")
    expect(cliSource).toContain("shell: windowsShellInvocation ? false : useShell,\n        timeout,\n        windowsHide: true,")
    expect(cliSource).toContain("cwd: resolveManagedSpawnCwd(),\n      timeout,\n      windowsHide: true,")
    expect(cliSource).toMatch(/resolveOpenClawCommand\(args, \{[\s\S]*commandPath: explicitBinaryPath \|\| undefined,[\s\S]*env: mergedEnv,[\s\S]*\}\)/)
    expect(cliSource).toMatch(/resolveOpenClawCommand\(args, \{[\s\S]*commandPath: binaryPath \|\| undefined,[\s\S]*env: mergedEnv,[\s\S]*\}\)/)
  })

  it('routes Windows gateway lifecycle through Mclaw hidden runtime instead of OpenClaw scheduled tasks', async () => {
    const cliSource = await readFile(path.join(process.cwd(), 'electron/main/cli.ts'), 'utf8')

    expect(cliSource).toContain('disableVisibleWindowsGatewayLaunchers')
    expect(cliSource).toContain('removeWindowsGatewayLauncherArtifacts')
    expect(cliSource).toContain("Get-ScheduledTask -TaskName $taskNamePattern")
    expect(cliSource).toContain("Get-ChildItem -LiteralPath $startupDir -Filter 'OpenClaw Gateway*.cmd'")
    expect(cliSource).toContain("runCli(['gateway', 'uninstall']")
    expect(cliSource).toContain('gatewayStartHiddenOnWindows')
    expect(cliSource).toContain('OPENCLAW_STATE_DIR')
    expect(cliSource).toContain('shouldUseHiddenWindowsGatewayRuntime')
    expect(cliSource).toMatch(/export async function runCli\([\s\S]*shouldUseHiddenWindowsGatewayRuntime\(args\)[\s\S]*gatewayStartHiddenOnWindows/)
    expect(cliSource).toMatch(/export async function runCliStreaming\([\s\S]*shouldUseHiddenWindowsGatewayRuntime\(args\)[\s\S]*gatewayStartHiddenOnWindows/)
    expect(cliSource).toMatch(/export async function gatewayStart\(\): Promise<CliResult> \{[\s\S]*process\.platform === 'win32'[\s\S]*gatewayStartHiddenOnWindows/)
    expect(cliSource).toMatch(/async function gatewayRestartImpl\(\): Promise<CliResult> \{[\s\S]*process\.platform === 'win32'[\s\S]*gatewayStartHiddenOnWindows/)
    expect(cliSource).toMatch(/export async function gatewayForceRestart\(\): Promise<CliResult> \{[\s\S]*process\.platform === 'win32'[\s\S]*gatewayStartHiddenOnWindows/)
  })
})
