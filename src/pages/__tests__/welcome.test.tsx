import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import appSource from '../../App.tsx?raw'
import Welcome from '../Welcome'

describe('Welcome', () => {
  it('renders the welcome frame without vertical scrolling', () => {
    expect(appSource).toMatch(
      /if \(appState === 'welcome'\) \{[\s\S]{0,220}renderFrame\([\s\S]{0,160}, false\)/
    )
  })

  it('shows the node environment risk notice for setup', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <Welcome onAccept={vi.fn()} />
      </MantineProvider>
    )

    expect(html).toContain('高危风险须知')
    expect(html).toContain('强烈建议**不要用于包含敏感数据的裸机系统**')
    expect(html).toContain('内置运行依赖 Node.js v22.16+')
    expect(html).toContain('这可能会导致您的旧版 npm/node 项目出现不可测损坏')
  })
})
