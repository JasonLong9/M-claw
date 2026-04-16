import { describe, expect, it } from 'vitest'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

function readDashboardChatPanelSource(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'dashboard', 'DashboardChatPanel.tsx'),
    'utf8'
  )
}

describe('dashboard chat panel guardrails', () => {
  it('keeps the new-chat entrypoint on the upstream-aware createChatSession flow', () => {
    const source = readDashboardChatPanelSource()
    const handleCreateSessionBlock =
      source.match(/const handleCreateSession = async \(\) => \{[\s\S]*?\n  \}/)?.[0] || ''

    expect(handleCreateSessionBlock).toContain('window.api.createChatSession()')
    expect(handleCreateSessionBlock).not.toContain('window.api.createLocalChatSession()')
  })

  it('does not expose session metadata or routing notices in the user-facing chat surface', () => {
    const source = readDashboardChatPanelSource()
    const headerBlock =
      source.match(/<Group gap="xs">[\s\S]*?<\/Text>\n        <\/div>/)?.[0] || ''

    expect(headerBlock).not.toContain('currentSessionModelLabel')
    expect(headerBlock).not.toContain('sessionModelPresentation.modeLabel')
    expect(headerBlock).not.toContain('activeSessionStatus.sessionSource')

    expect(source).not.toContain('{activeSessionStatus.notice && (')
    expect(source).not.toContain('activeSessionStatus.notice ||')
  })

  it('does not expose the session diagnostics toggle in the user-facing toolbar', () => {
    const source = readDashboardChatPanelSource()

    expect(source).not.toContain('label={showDiagnostics ?')
    expect(source).not.toContain('IconActivityHeartbeat')
  })

  it('keeps the composer footer free of session continuation status text', () => {
    const source = readDashboardChatPanelSource()

    expect(source).not.toContain("activeSessionStatus.willForkOnSend ? '")
    expect(source).not.toContain('首次发送时自动创建会话')
  })

  it('renders chat images as clickable thumbnails with a preview modal', () => {
    const source = readDashboardChatPanelSource()

    expect(source).toContain('const [imagePreview, setImagePreview]')
    expect(source).toContain('const [imagePreviewScale, setImagePreviewScale]')
    expect(source).toContain("const [imagePreviewFitMode, setImagePreviewFitMode] = useState<ImagePreviewFitMode>('auto')")
    expect(source).toContain('const imageAttachments = Array.isArray(message.images)')
    expect(source).toContain("cursor: 'zoom-in'")
    expect(source).toContain("objectFit: 'contain'")
    expect(source).toContain('opened={Boolean(imagePreview)}')
    expect(source).toContain('CHAT_IMAGE_PREVIEW_MAX_HEIGHT')
    expect(source).toContain('onWheel={handleImagePreviewWheel}')
    expect(source).toContain("handleImagePreviewFitModeChange('width')")
    expect(source).toContain('event.ctrlKey || event.metaKey')
  })

  it('renders assistant file paths as clickable open-file actions', () => {
    const source = readDashboardChatPanelSource()

    expect(source).toContain('collectAssistantLocalPaths(messageText)')
    expect(source).toContain('normalizedLine.match(/(?:^|[^a-z0-9+.-])([a-z]:[\\\\/].+)$/i)')
    expect(source).toContain('window.api.openLocalPath(normalizedPath)')
    expect(source).toContain('打开 {describeLocalPathLabel(targetPath)}')
  })
})
