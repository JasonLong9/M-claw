import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import appSource from '../../App.tsx?raw'
import Welcome from '../Welcome'

describe('Welcome', () => {
  it('renders the welcome frame without vertical scrolling', () => {
    expect(appSource).toContain("if (appState === 'welcome')")
    expect(appSource).toContain("<Welcome onAccept={() => setAppState('env-check')} />")
  })

  it('shows compact setup risk notice and confirmation button', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <Welcome onAccept={vi.fn()} />
      </MantineProvider>
    )

    expect(html).toContain('高风险提示')
    expect(html).toContain('系统提权风险')
    expect(html).toContain('Node.js 升级风险')
    expect(html).toContain('确认继续')
  })
})
