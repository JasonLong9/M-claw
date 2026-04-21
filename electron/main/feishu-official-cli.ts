import type { CliResult } from './cli'
import { runShell } from './cli'
import { MAIN_RUNTIME_POLICY } from './runtime-policy'

export const FEISHU_OFFICIAL_CLI_COMMAND = 'lark-cli'
export const FEISHU_OFFICIAL_CLI_VERSION_ARGS = ['--version'] as const
export const FEISHU_OFFICIAL_CLI_STATUS_ARGS = ['auth', 'status'] as const

export type FeishuOfficialCliGuidedMode =
  | 'config-init-new'
  | 'auth-login-recommend'
  | 'auth-login-no-wait'

const FEISHU_OFFICIAL_CLI_GUIDED_ARGS: Record<FeishuOfficialCliGuidedMode, readonly string[]> = {
  'config-init-new': ['config', 'init', '--new'],
  'auth-login-recommend': ['auth', 'login', '--recommend'],
  'auth-login-no-wait': ['auth', 'login', '--no-wait'],
}

export function buildFeishuOfficialCliGuidedArgs(mode: FeishuOfficialCliGuidedMode): string[] {
  return [...FEISHU_OFFICIAL_CLI_GUIDED_ARGS[mode]]
}

export function buildFeishuOfficialCliGuidedCommand(mode: FeishuOfficialCliGuidedMode): string[] {
  return [FEISHU_OFFICIAL_CLI_COMMAND, ...buildFeishuOfficialCliGuidedArgs(mode)]
}

export function extractFirstNonEmptyLine(text: string): string {
  for (const line of String(text || '').split(/\r?\n/g)) {
    const trimmed = line.trim()
    if (trimmed) return trimmed
  }
  return ''
}

export function collectFeishuOfficialCliCommandDetail(
  result: Pick<CliResult, 'stdout' | 'stderr'>
): string {
  return [String(result.stderr || '').trim(), String(result.stdout || '').trim()]
    .filter(Boolean)
    .join('\n')
    .trim()
}

export function normalizeFeishuOfficialCliVersion(output: string): string {
  const firstLine = extractFirstNonEmptyLine(output)
  if (!firstLine) return ''
  return firstLine
    .replace(/^lark-cli\s*/i, '')
    .replace(/^version[:\s]*/i, '')
    .trim()
}

export function isMissingFeishuOfficialCliDetail(detail: string): boolean {
  const normalized = String(detail || '').toLowerCase()
  return (
    normalized.includes('not recognized as an internal or external command') ||
    normalized.includes('command not found') ||
    normalized.includes('no such file or directory') ||
    normalized.includes('enoent') ||
    normalized.includes('涓嶆槸鍐呴儴鎴栧閮ㄥ懡浠?') ||
    (normalized.includes('鏃犳硶灏?') && normalized.includes('璇嗗埆涓?')) ||
    normalized.includes('鏈壘鍒板懡浠?') ||
    normalized.includes('鎵句笉鍒版寚瀹氱殑鏂囦欢')
  )
}

export async function runFeishuOfficialCli(
  args: string[],
  timeout = MAIN_RUNTIME_POLICY.cli.lightweightProbeTimeoutMs
): Promise<CliResult> {
  return runShell(
    FEISHU_OFFICIAL_CLI_COMMAND,
    args,
    timeout,
    {
      controlDomain: 'env-setup',
      shell: process.platform === 'win32',
    }
  )
}
