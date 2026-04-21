import { describe, expect, it } from 'vitest'

import shellSource from '../ChannelsPageShell.tsx?raw'

describe('ChannelsPageShell', () => {
  it('keeps the shared page-shell contract for loading plus all composed surface props', () => {
    expect(shellSource).toContain("import type { ComponentProps } from 'react'")
    expect(shellSource).toContain("import { Loader } from '@mantine/core'")
    expect(shellSource).toContain("import ChannelsPageTopPanel from './ChannelsPageTopPanel'")
    expect(shellSource).toContain("import ChannelsPageChannelListPanel from './ChannelsPageChannelListPanel'")
    expect(shellSource).toContain("import ChannelsPageChannelCards from './ChannelsPageChannelCards'")
    expect(shellSource).toContain("import ChannelsPageConfigModal from './ChannelsPageConfigModal'")
    expect(shellSource).toContain("import ChannelsPagePairingModal from './ChannelsPagePairingModal'")
    expect(shellSource).toContain("import ChannelsPageModelConfigModal from './ChannelsPageModelConfigModal'")
    expect(shellSource).toContain("import ChannelsPageDiagnosticsModal from './ChannelsPageDiagnosticsModal'")
    expect(shellSource).toContain('interface ChannelsPageShellProps {')
    expect(shellSource).toContain('loading: boolean')
    expect(shellSource).toContain('topPanelProps: ComponentProps<typeof ChannelsPageTopPanel>')
    expect(shellSource).toContain('channelListPanelProps: ComponentProps<typeof ChannelsPageChannelListPanel>')
    expect(shellSource).toContain('channelCardsProps: ComponentProps<typeof ChannelsPageChannelCards>')
    expect(shellSource).toContain('configModalProps: ComponentProps<typeof ChannelsPageConfigModal>')
    expect(shellSource).toContain('pairingModalProps: ComponentProps<typeof ChannelsPagePairingModal>')
    expect(shellSource).toContain('modelConfigModalProps: ComponentProps<typeof ChannelsPageModelConfigModal>')
    expect(shellSource).toContain('diagnosticsModalProps: ComponentProps<typeof ChannelsPageDiagnosticsModal>')
  })

  it('renders one shared loader-or-page shell that composes the page surfaces and modals', () => {
    expect(shellSource).toContain('if (loading) {')
    expect(shellSource).toContain('<Loader size="lg" />')
    expect(shellSource).toContain('<ChannelsPageTopPanel {...topPanelProps} />')
    expect(shellSource).toContain('<ChannelsPageChannelListPanel {...channelListPanelProps}>')
    expect(shellSource).toContain('<ChannelsPageChannelCards {...channelCardsProps} />')
    expect(shellSource).toContain('<ChannelsPageConfigModal {...configModalProps} />')
    expect(shellSource).toContain('<ChannelsPagePairingModal {...pairingModalProps} />')
    expect(shellSource).toContain('<ChannelsPageModelConfigModal {...modelConfigModalProps} />')
    expect(shellSource).toContain('<ChannelsPageDiagnosticsModal {...diagnosticsModalProps} />')
  })
})
