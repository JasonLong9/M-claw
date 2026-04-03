import { describe, expect, it } from 'vitest'
import {
  buildBundledOpenClawDarwinCopyPlan,
  buildBundledOpenClawDarwinTargetLayout,
  inspectBundledOpenClawDarwinSourceLayout,
  isSafeBundledOpenClawDarwinPrefixDir,
  resolveBundledOpenClawDarwinExecutionPlan,
  resolveBundledOpenClawDarwinPrefixDir,
  validateBundledOpenClawDarwinCopyPlan,
} from '../openclaw-bundled-runtime-darwin'
import { buildTestEnv } from './test-env'

describe('openclaw-bundled-runtime-darwin', () => {
  it('resolves the default darwin runtime prefix', () => {
    expect(
      resolveBundledOpenClawDarwinPrefixDir(
        buildTestEnv({
          HOME: '/Users/alice',
        })
      )
    ).toBe('/Users/alice/.openclaw-runtime/bin')
  })

  it('accepts only the expected home-scoped runtime prefix as safe target', () => {
    const env = buildTestEnv({
      HOME: '/Users/alice',
    })

    expect(isSafeBundledOpenClawDarwinPrefixDir('/Users/alice/.openclaw-runtime/bin', env)).toBe(true)
    expect(isSafeBundledOpenClawDarwinPrefixDir('/tmp/openclaw/bin', env)).toBe(false)
  })

  it('builds the expected darwin target layout', () => {
    expect(buildBundledOpenClawDarwinTargetLayout('/Users/alice/.openclaw-runtime/bin')).toEqual({
      prefixDir: '/Users/alice/.openclaw-runtime/bin',
      binaryTarget: '/Users/alice/.openclaw-runtime/bin/openclaw',
      packageRootTarget: '/Users/alice/.openclaw-runtime/node_modules/openclaw',
    })
  })

  it('produces a valid execution plan when bundled-runtime is available on darwin', () => {
    const result = resolveBundledOpenClawDarwinExecutionPlan(
      {
        platform: 'darwin',
        arch: 'arm64',
        preferredSource: 'bundled-runtime',
        runtimeBinaryPath: '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64/bin/openclaw',
        runtimePath: '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64',
        payloadPath: null,
        manifestPath: '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/manifest.json',
        defaultDeliveryMode: 'bundled-runtime',
        targetDeliveryMode: 'bundled-runtime',
        warnings: [],
      },
      buildTestEnv({
        HOME: '/Users/alice',
      })
    )

    expect(result.ok).toBe(true)
    expect(result.targetLayout?.prefixDir).toBe('/Users/alice/.openclaw-runtime/bin')
    expect(result.targetLayout?.packageRootTarget).toBe('/Users/alice/.openclaw-runtime/node_modules/openclaw')
  })

  it('inspects source layout and builds a darwin copy plan', () => {
    const executionPlan = resolveBundledOpenClawDarwinExecutionPlan(
      {
        platform: 'darwin',
        arch: 'arm64',
        preferredSource: 'bundled-runtime',
        runtimeBinaryPath: '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64/bin/openclaw',
        runtimePath: '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64',
        payloadPath: null,
        manifestPath: '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/manifest.json',
        defaultDeliveryMode: 'bundled-runtime',
        targetDeliveryMode: 'bundled-runtime',
        warnings: [],
      },
      buildTestEnv({
        HOME: '/Users/alice',
      })
    )

    const sourceLayout = inspectBundledOpenClawDarwinSourceLayout(executionPlan, (candidatePath) =>
      [
        '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64/bin/openclaw',
        '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64/node_modules/openclaw/package.json',
      ].includes(candidatePath)
    )
    const copyPlan = buildBundledOpenClawDarwinCopyPlan(executionPlan, sourceLayout)

    expect(sourceLayout?.packageRootSource).toBe(
      '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64/node_modules/openclaw'
    )
    expect(copyPlan?.binaryTarget).toBe('/Users/alice/.openclaw-runtime/bin/openclaw')
    expect(copyPlan?.packageRootTarget).toBe('/Users/alice/.openclaw-runtime/node_modules/openclaw')
  })

  it('validates copied darwin runtime targets', () => {
    const validation = validateBundledOpenClawDarwinCopyPlan(
      {
        runtimeRoot: '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64',
        targetLayout: {
          prefixDir: '/Users/alice/.openclaw-runtime/bin',
          binaryTarget: '/Users/alice/.openclaw-runtime/bin/openclaw',
          packageRootTarget: '/Users/alice/.openclaw-runtime/node_modules/openclaw',
        },
        binarySource: '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64/bin/openclaw',
        binaryTarget: '/Users/alice/.openclaw-runtime/bin/openclaw',
        packageRootSource: '/Applications/Mclaw.app/Contents/Resources/openclaw-bundle/runtime/darwin-arm64/node_modules/openclaw',
        packageRootTarget: '/Users/alice/.openclaw-runtime/node_modules/openclaw',
      },
      (candidatePath) =>
        [
          '/Users/alice/.openclaw-runtime/bin/openclaw',
          '/Users/alice/.openclaw-runtime/node_modules/openclaw/package.json',
        ].includes(candidatePath)
    )

    expect(validation.ok).toBe(true)
    expect(validation.binaryPath).toBe('/Users/alice/.openclaw-runtime/bin/openclaw')
    expect(validation.errors).toEqual([])
  })
})
