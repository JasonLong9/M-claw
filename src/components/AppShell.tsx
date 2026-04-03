import { Box, ScrollArea } from '@mantine/core'
import SettingsMenu from './SettingsMenu'
import type { ReactNode } from 'react'
import BrandWordmark from './BrandWordmark'

export default function AppShell({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  return (
    <Box
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--mantine-color-body)',
        color: 'var(--mantine-color-text)',
      }}
    >
      {/* Title bar drag region */}
      <Box
        h={40}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          WebkitAppRegion: 'drag',
        } as any}
      >
        <div style={{ userSelect: 'none', pointerEvents: 'none' }}>
          <BrandWordmark size="titlebar" muted />
        </div>
      </Box>

      {/* Content */}
      {scroll ? (
        <ScrollArea style={{ flex: 1 }} px="md" pb="md">
          {children}
        </ScrollArea>
      ) : (
        <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} px="lg" pb="lg">
          {children}
        </Box>
      )}

      <SettingsMenu />
    </Box>
  )
}
