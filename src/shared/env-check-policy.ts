export interface EnvCheckSupportAction {
  kind: 'external-link'
  label: string
  href: string
}

const NODE_SITE_ACTION: EnvCheckSupportAction = Object.freeze({
  kind: 'external-link',
  label: '打开 Node 官网',
  href: 'https://nodejs.org/',
})

const NODE_WINDOWS_DOWNLOAD_ACTION: EnvCheckSupportAction = Object.freeze({
  kind: 'external-link',
  label: '打开 Node 下载页',
  href: 'https://nodejs.org/en/download',
})

const ISSUE_KIND_ACTIONS = new Map<string, readonly EnvCheckSupportAction[]>([
  ['blocked-by-policy', [NODE_WINDOWS_DOWNLOAD_ACTION]],
  ['corrupted-installer', [NODE_SITE_ACTION]],
  ['download-failed', [NODE_SITE_ACTION]],
  ['installer-failed', [NODE_WINDOWS_DOWNLOAD_ACTION]],
  ['missing-installer', [NODE_WINDOWS_DOWNLOAD_ACTION]],
  ['missing-system-command', [NODE_SITE_ACTION]],
  ['not-admin-user', [NODE_WINDOWS_DOWNLOAD_ACTION]],
  ['permission-denied', [NODE_WINDOWS_DOWNLOAD_ACTION]],
  ['unsupported-macos', [NODE_SITE_ACTION]],
  ['user-cancelled', [NODE_WINDOWS_DOWNLOAD_ACTION]],
])

export const ENV_CHECK_UI_POLICY = Object.freeze({
  loadingTips: Object.freeze([
    '正在检查系统环境...',
    'Mclaw 支持飞书、企微、钉钉、QQ渠道接入',
    '所有配置和数据仅保存在您的电脑上',
    '环境准备速度取决于本地硬件、磁盘权限和网络条件',
    '准备过程中可能需要系统授权或管理员密码',
    '如内置载荷不可用，程序才会尝试网络兜底',
  ]),
  nodeDownloadAction: NODE_SITE_ACTION,
  nodeWindowsDownloadAction: NODE_WINDOWS_DOWNLOAD_ACTION,
})

export function getEnvCheckSupportActionsForIssueKind(
  issueKind?: string | null
): EnvCheckSupportAction[] {
  if (!issueKind) {
    return []
  }

  return [...(ISSUE_KIND_ACTIONS.get(issueKind) || [])]
}
