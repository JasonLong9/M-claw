import { describe, expect, it, vi } from 'vitest'
import {
  OPENCLAW_BUNDLED_MANAGED_PLUGIN_MANIFEST,
  listBundledManagedPluginDirectoryCandidates,
  materializeBundledManagedPlugin,
  resolveBundledManagedPluginSourcePath,
} from '../openclaw-bundled-managed-plugin'

describe('listBundledManagedPluginDirectoryCandidates', () => {
  it('includes bundled resource and repo-local managed plugin candidates', () => {
    const candidates = listBundledManagedPluginDirectoryCandidates({
      pluginId: 'openclaw-lark',
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
    })

    expect(candidates).toEqual([
      'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\managed-plugins\\openclaw-lark',
      'C:\\repo\\resources\\openclaw-bundle\\managed-plugins\\openclaw-lark',
      'C:\\repo\\openclaw-bundle\\managed-plugins\\openclaw-lark',
    ])
  })
})

describe('resolveBundledManagedPluginSourcePath', () => {
  it('returns the first candidate that contains the managed plugin manifest', () => {
    const resolved = resolveBundledManagedPluginSourcePath({
      pluginId: 'openclaw-lark',
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      exists: (candidatePath) =>
        candidatePath ===
        `C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\managed-plugins\\openclaw-lark\\${OPENCLAW_BUNDLED_MANAGED_PLUGIN_MANIFEST}`,
    })

    expect(resolved).toBe(
      'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\managed-plugins\\openclaw-lark'
    )
  })
})

describe('materializeBundledManagedPlugin', () => {
  it('copies a bundled managed plugin into the target install directory', async () => {
    const mkdir = vi.fn().mockResolvedValue(undefined)
    const remove = vi.fn().mockResolvedValue(undefined)
    const copy = vi.fn().mockResolvedValue(undefined)

    const result = await materializeBundledManagedPlugin({
      pluginId: 'openclaw-lark',
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\Program Files\\Mclaw\\resources',
      targetPath: 'C:\\Users\\alice\\.openclaw\\extensions\\openclaw-lark',
      exists: (candidatePath) =>
        candidatePath ===
        `C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\managed-plugins\\openclaw-lark\\${OPENCLAW_BUNDLED_MANAGED_PLUGIN_MANIFEST}`,
      mkdir,
      remove,
      copy,
    })

    expect(result).toEqual({
      ok: true,
      copied: true,
      sourcePath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\managed-plugins\\openclaw-lark',
      targetPath: 'C:\\Users\\alice\\.openclaw\\extensions\\openclaw-lark',
    })
    expect(mkdir).toHaveBeenCalledWith('C:\\Users\\alice\\.openclaw\\extensions', {
      recursive: true,
    })
    expect(remove).toHaveBeenCalledWith('C:\\Users\\alice\\.openclaw\\extensions\\openclaw-lark', {
      recursive: true,
      force: true,
    })
    expect(copy).toHaveBeenCalledWith(
      'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\managed-plugins\\openclaw-lark',
      'C:\\Users\\alice\\.openclaw\\extensions\\openclaw-lark',
      {
        recursive: true,
        force: true,
        errorOnExist: false,
      }
    )
  })
})
