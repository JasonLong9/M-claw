export const FEISHU_OFFICIAL_GUIDE_URL = 'https://www.feishu.cn/content/article/7613711414611463386'
export const FEISHU_OFFICIAL_INSTALL_COMMAND = 'npx -y @larksuite/openclaw-lark-tools install'
export const FEISHU_LIVE_QR_URL_MARKER = 'MCLAW_FEISHU_QR_URL:'

export function extractHttpUrls(text: string): string[] {
  const matches = String(text || '').match(/https?:\/\/[^\s<>"']+/ig) || []
  return matches.map((url) => url.replace(/[),.;]+$/g, '').trim()).filter(Boolean)
}

export function extractFirstHttpUrl(text: string): string {
  return extractHttpUrls(text)[0] || ''
}

function isAllowedFeishuQrHost(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    return (
      host === 'open.feishu.cn'
      || host === 'open.larksuite.com'
      || host === 'accounts.feishu.cn'
      || host === 'accounts.larksuite.com'
    )
  } catch {
    return false
  }
}

function isLikelyFeishuQrUrl(url: string): boolean {
  if (!isAllowedFeishuQrHost(url) || url === FEISHU_OFFICIAL_GUIDE_URL) return false

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname.toLowerCase()
    return (
      pathname.includes('/oauth/')
      || pathname.includes('/oauth')
      || pathname.includes('/open-apis/auth')
      || parsed.searchParams.has('device_code')
      || parsed.searchParams.has('user_code')
      || parsed.searchParams.has('verification_uri')
    )
  } catch {
    return false
  }
}

export function extractFeishuLiveQrUrl(text: string): string {
  const lines = String(text || '').split(/\r?\n/)
  for (const line of lines) {
    const markerIndex = line.indexOf(FEISHU_LIVE_QR_URL_MARKER)
    if (markerIndex < 0) continue

    const markedSegment = line.slice(markerIndex + FEISHU_LIVE_QR_URL_MARKER.length)
    const candidate = extractFirstHttpUrl(markedSegment) || extractFirstHttpUrl(line)
    if (candidate && isAllowedFeishuQrHost(candidate) && candidate !== FEISHU_OFFICIAL_GUIDE_URL) {
      return candidate
    }
  }

  return extractHttpUrls(text).find((url) => isLikelyFeishuQrUrl(url)) || ''
}

export function extractFeishuAsciiQr(text: string): string {
  const lines = String(text || '').split(/\r?\n/)
  const scanLineIndex = lines.findIndex((line) => /scan with feishu to configure your bot/i.test(line))
  if (scanLineIndex < 0) return ''

  const qrLines: string[] = []
  for (let index = scanLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.trim()) {
      if (qrLines.length > 0) break
      continue
    }
    if (/fetching configuration results/i.test(line)) break
    if (/[█▄▀]/.test(line)) {
      qrLines.push(line)
      continue
    }
    if (qrLines.length > 0) break
  }

  return qrLines.join('\n').trim()
}

export function normalizeFeishuInstallerText(text: string): string {
  return String(text || '')
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, ' ')
    .replace(/\[[0-9;?]+[A-Za-z]/g, ' ')
    .replace(/\s+/g, ' ')
}

export function extractFeishuExistingBotPromptKey(text: string): string {
  const normalized = normalizeFeishuInstallerText(text)
  const promptMatches = [
    ...Array.from(normalized.matchAll(/Use it for this setup\?\s*\(\s*Y\s*\/\s*n\s*\)/gi)),
    ...Array.from(normalized.matchAll(/是否使用它进行配�\?\s*\(\s*Y\s*\/\s*n\s*\)/gi)),
  ].sort((left, right) => (left.index || 0) - (right.index || 0))
  if (promptMatches.length === 0) return ''

  const lastPromptIndex = promptMatches[promptMatches.length - 1]?.index ?? -1
  const appIdMatches = Array.from(normalized.matchAll(/(cli_[a-z0-9]+)/gi))
  const latestAppIdBeforePrompt =
    appIdMatches.filter((match) => (match.index ?? -1) <= lastPromptIndex).at(-1)?.[1]
  const latestAppId = appIdMatches.at(-1)?.[1]
  const appId = latestAppIdBeforePrompt || latestAppId || 'unknown-bot'
  return `${appId}:reuse-prompt:${promptMatches.length}`
}
