import { shouldAutoOpenBrowserForArgs } from './oauth-browser'
import { listExecutablePathCandidates } from './runtime-path-discovery'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

export interface ResolvedCliCommand {
  command: string
  args: string[]
  shell: boolean
  capabilityWarning?: string
}

interface ResolveOpenClawRuntime {
  platform?: NodeJS.Platform
  expectAvailable?: boolean
  expectWarning?: string
  scriptAvailable?: boolean
  scriptWarning?: string
  commandPath?: string
  env?: NodeJS.ProcessEnv
}

const DEPRECATED_AUTH_CHOICE_ALIASES: Record<string, string> = {
  'codex-cli': 'openai-codex',
}

export function normalizeAuthChoice(choice: string): string {
  const normalized = choice.trim().toLowerCase()
  return DEPRECATED_AUTH_CHOICE_ALIASES[normalized] || normalized
}

function quotePosixArg(arg: string): string {
  if (arg === '') return "''"
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

function escapeTclDoubleQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\[/g, '\\[')
}

function isGeminiCliOAuthLoginArgs(args: string[]): boolean {
  if (!Array.isArray(args) || args.length < 5) return false
  if (args[0] !== 'models' || args[1] !== 'auth' || args[2] !== 'login') return false

  const providerIndex = args.findIndex((item) => item === '--provider')
  if (providerIndex < 0 || providerIndex + 1 >= args.length) return false
  return normalizeAuthChoice(String(args[providerIndex + 1] || '').trim()) === 'google-gemini-cli'
}

function buildWhitespaceTolerantExpectRegex(phrase: string): string {
  return phrase
    .replace(/\s+/g, '')
    .split('')
    .map((char) => char.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'))
    .join('\\s*')
}

function buildGeminiExpectWrapperScript(commandPath: string, args: string[]): string {
  const spawnArgs = [commandPath, ...args]
    .map((item) => `"${escapeTclDoubleQuoted(item)}"`)
    .join(' ')
  const continuePromptPattern = buildWhitespaceTolerantExpectRegex('Continue with Google Gemini CLI OAuth?')

  return [
    'set timeout -1',
    'match_max 100000',
    `spawn -noecho ${spawnArgs}`,
    'expect {',
    `  -re {${continuePromptPattern}} {`,
    '    send "\\033\\[D\\r"',
    '    exp_continue',
    '  }',
    '  eof',
    '}',
    'set exit_code 0',
    'if {[catch wait wait_status] == 0 && [llength $wait_status] >= 4} {',
    '  set exit_code [lindex $wait_status 3]',
    '}',
    'exit $exit_code',
  ].join('\n')
}

function resolveBundledWindowsDirectInvocation(
  commandPath: string,
  args: string[]
): ResolvedCliCommand | null {
  const normalizedCommandPath = String(commandPath || '').trim()
  if (!/\.cmd$/i.test(normalizedCommandPath)) return null

  const commandDir = path.dirname(normalizedCommandPath)
  const runtimeRoots = [commandDir]
  if (path.basename(commandDir).toLowerCase() === 'bin') {
    runtimeRoots.push(path.dirname(commandDir))
  }

  for (const runtimeRoot of runtimeRoots) {
    const nodePath = path.join(runtimeRoot, 'node.exe')
    const entryPointPath = path.join(runtimeRoot, 'node_modules', 'openclaw', 'openclaw.mjs')
    if (!fs.existsSync(nodePath) || !fs.existsSync(entryPointPath)) continue

    return {
      command: nodePath,
      args: [entryPointPath, ...args],
      shell: false,
    }
  }

  return null
}

function listWindowsOpenClawPackageRootCandidates(commandPath: string): string[] {
  const normalizedCommandPath = String(commandPath || '').trim()
  if (!normalizedCommandPath) return []

  const commandDir = path.dirname(normalizedCommandPath)
  const commandName = path.basename(normalizedCommandPath).toLowerCase()
  const parentDir = path.dirname(commandDir)
  const grandParentDir = path.dirname(parentDir)
  const candidates = [
    path.join(commandDir, 'node_modules', 'openclaw'),
    path.join(parentDir, 'node_modules', 'openclaw'),
  ]

  if (
    commandName === 'openclaw' ||
    commandName === 'openclaw.cmd' ||
    commandName === 'openclaw.exe'
  ) {
    candidates.push(path.join(parentDir, 'lib', 'node_modules', 'openclaw'))
    candidates.push(path.join(grandParentDir, 'lib', 'node_modules', 'openclaw'))
  }

  const deduped: string[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const normalized = path.normalize(candidate)
    const comparable = normalized.toLowerCase()
    if (seen.has(comparable)) continue
    seen.add(comparable)
    deduped.push(normalized)
  }
  return deduped
}

function resolveOpenClawEntryPointFromPackageRoot(packageRoot: string): string {
  const packageJsonPath = path.join(packageRoot, 'package.json')
  const raw = fs.readFileSync(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(raw) as Record<string, unknown>
  if (packageJson.name !== 'openclaw') {
    throw new Error(`Unsupported package name at ${packageJsonPath}`)
  }

  const declaredBin =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin && typeof packageJson.bin === 'object'
        ? String((packageJson.bin as Record<string, unknown>).openclaw || '').trim()
        : ''
  const entryPointPath = path.join(packageRoot, declaredBin || 'openclaw.mjs')
  if (!fs.existsSync(entryPointPath)) {
    throw new Error(`OpenClaw entrypoint not found: ${entryPointPath}`)
  }
  return entryPointPath
}

function resolveShimWindowsDirectInvocation(
  commandPath: string,
  args: string[],
  env: NodeJS.ProcessEnv
): ResolvedCliCommand | null {
  const normalizedCommandPath = String(commandPath || '').trim()
  if (!/\.cmd$/i.test(normalizedCommandPath)) return null

  let entryPointPath = ''
  for (const candidateRoot of listWindowsOpenClawPackageRootCandidates(normalizedCommandPath)) {
    const packageJsonPath = path.join(candidateRoot, 'package.json')
    if (!fs.existsSync(packageJsonPath)) continue
    try {
      entryPointPath = resolveOpenClawEntryPointFromPackageRoot(candidateRoot)
      break
    } catch {
      // Keep falling back until a usable package root is found.
    }
  }
  if (!entryPointPath) return null

  const commandDir = path.dirname(normalizedCommandPath)
  const runtimeRoots = [commandDir]
  if (path.basename(commandDir).toLowerCase() === 'bin') {
    runtimeRoots.push(path.dirname(commandDir))
  }
  const nodeCandidates = [
    ...runtimeRoots.map((runtimeRoot) => path.join(runtimeRoot, 'node.exe')),
    ...listExecutablePathCandidates('node', {
      platform: 'win32',
      env,
      currentPath: env.PATH || process.env.PATH || '',
    }),
  ]
  const nodePath = nodeCandidates.find((candidate) => fs.existsSync(candidate))
  if (!nodePath) return null

  return {
    command: nodePath,
    args: [entryPointPath, ...args],
    shell: false,
  }
}

export function resolveOpenClawCommand(
  args: string[],
  platformOrRuntime: NodeJS.Platform | ResolveOpenClawRuntime = process.platform
): ResolvedCliCommand {
  const runtime =
    typeof platformOrRuntime === 'string'
      ? { platform: platformOrRuntime }
      : (platformOrRuntime || {})
  const platform = runtime.platform || process.platform
  const isWin = platform === 'win32'
  const commandPath = String(runtime.commandPath || '').trim() || 'openclaw'
  const shouldUsePty = shouldAutoOpenBrowserForArgs(args)
  const shouldUseGeminiExpectWrapper = isGeminiCliOAuthLoginArgs(args) && !isWin
  const geminiExpectWarning =
    shouldUseGeminiExpectWrapper && runtime.expectAvailable === false ? runtime.expectWarning : undefined
  const directWindowsRuntime = isWin
    ? resolveBundledWindowsDirectInvocation(commandPath, args)
      || resolveShimWindowsDirectInvocation(commandPath, args, runtime.env || process.env)
    : null
  if (!shouldUsePty || isWin) {
    return directWindowsRuntime || { command: commandPath, args, shell: isWin }
  }

  if (shouldUseGeminiExpectWrapper && runtime.expectAvailable !== false) {
    return {
      command: 'expect',
      args: ['-c', buildGeminiExpectWrapperScript(commandPath, args)],
      shell: false,
    }
  }

  if (runtime.scriptAvailable === false) {
    return {
      command: commandPath,
      args,
      shell: false,
      capabilityWarning:
        runtime.expectWarning ||
        runtime.scriptWarning ||
        'Interactive OAuth requires the script command on this platform. Falling back to direct OpenClaw execution without PTY.',
    }
  }

  if (platform === 'darwin') {
    // BSD script: script -q /dev/null <command> [args...]
    return {
      command: 'script',
      args: ['-q', '/dev/null', commandPath, ...args],
      shell: false,
      ...(geminiExpectWarning ? { capabilityWarning: geminiExpectWarning } : {}),
    }
  }

  // util-linux script: script -q -e -c "<command>" /dev/null
  const commandLine = [commandPath, ...args].map((item) => quotePosixArg(item)).join(' ')
  return {
    command: 'script',
    args: ['-q', '-e', '-c', commandLine, '/dev/null'],
    shell: false,
    ...(geminiExpectWarning ? { capabilityWarning: geminiExpectWarning } : {}),
  }
}
