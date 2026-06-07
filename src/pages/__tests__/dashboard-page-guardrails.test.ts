import { describe, expect, it } from 'vitest'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

function readDashboardPageSource(): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'Dashboard.tsx'), 'utf8')
}

describe('dashboard page guardrails', () => {
  it('keeps the internal OpenClaw workspace entry protected instead of exposing an open-folder action', () => {
    const source = readDashboardPageSource()

    expect(source).toContain('Mclaw 内部工作区已受保护')
    expect(source).toContain('如需导出结果，请使用桌面、文档或项目目录')
    expect(source).toContain('disabled')
    expect(source).not.toContain('window.api.openOpenClawWorkspace()')
    expect(source).not.toContain('打开 OpenClaw 工作区')
  })
})
