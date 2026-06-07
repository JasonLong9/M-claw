import { describe, expect, it } from 'vitest'

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

function readElectronBuilderConfig(): Record<string, unknown> {
  const configPath = path.join(process.cwd(), 'electron-builder.json')
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
}

describe('electron-builder mac dmg config', () => {
  it('does not pass an empty dmg title that would collapse the mounted volume path to /Volumes', () => {
    const config = readElectronBuilderConfig()
    const dmg = (config.dmg ?? {}) as Record<string, unknown>

    if (!Object.prototype.hasOwnProperty.call(dmg, 'title')) {
      expect(dmg.title).toBeUndefined()
      return
    }

    expect(typeof dmg.title).toBe('string')
    expect(String(dmg.title).trim().length).toBeGreaterThan(0)
  })
})

describe('electron-builder Windows runtime payload config', () => {
  it('packages only the Windows OpenClaw runtime into Windows artifacts', () => {
    const config = readElectronBuilderConfig()
    const topLevelResources = Array.isArray(config.extraResources) ? config.extraResources : []
    const win = (config.win ?? {}) as Record<string, unknown>
    const winResources = Array.isArray(win.extraResources) ? win.extraResources : []
    const serializedTopLevelResources = JSON.stringify(topLevelResources)
    const serializedWinResources = JSON.stringify(winResources)

    expect(serializedTopLevelResources).not.toContain('resources/openclaw-bundle')
    expect(serializedWinResources).toContain('resources/openclaw-bundle/runtime/windows-x64')
    expect(serializedWinResources).not.toContain('openclaw-2026.3.24.tgz')
    expect(serializedWinResources).not.toContain('resources/openclaw-bundle/runtime/darwin-x64')
    expect(serializedWinResources).not.toContain('resources/openclaw-bundle/runtime/darwin-arm64')
  })
})
