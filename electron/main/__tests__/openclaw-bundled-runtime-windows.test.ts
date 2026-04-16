import { describe, expect, it } from 'vitest'
import {
  buildBundledOpenClawWindowsCopyPlan,
  buildBundledOpenClawWindowsTargetLayout,
  inspectBundledOpenClawWindowsSourceLayout,
  isSafeBundledOpenClawWindowsPrefixDir,
  resolveBundledOpenClawWindowsExecutionPlan,
  resolveBundledOpenClawWindowsPrefixDir,
  validateBundledOpenClawWindowsCopyPlan,
} from '../openclaw-bundled-runtime-windows'
import { buildTestEnv } from './test-env'

describe('openclaw-bundled-runtime-windows', () => {
  it('resolves the default roaming npm prefix', () => {
    expect(
      resolveBundledOpenClawWindowsPrefixDir(buildTestEnv({
        APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
      }))
    ).toBe('C:\\Users\\alice\\AppData\\Roaming\\npm')
  })

  it('accepts only the expected roaming npm prefixes as safe targets', () => {
    const env = buildTestEnv({
      APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
      USERPROFILE: 'C:\\Users\\alice',
    })

    expect(isSafeBundledOpenClawWindowsPrefixDir('C:\\Users\\alice\\AppData\\Roaming\\npm', env)).toBe(true)
    expect(isSafeBundledOpenClawWindowsPrefixDir('D:\\tmp\\npm', env)).toBe(false)
  })

  it('builds the expected Windows target layout', () => {
    expect(buildBundledOpenClawWindowsTargetLayout('C:\\Users\\alice\\AppData\\Roaming\\npm')).toEqual({
      prefixDir: 'C:\\Users\\alice\\AppData\\Roaming\\npm',
      binaryTargets: [
        'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.cmd',
        'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.ps1',
        'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw',
      ],
      nodeTarget: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\node.exe',
      packageRootTarget: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\node_modules\\openclaw',
    })
  })

  it('produces a valid execution plan when bundled-runtime is available on Windows', () => {
    const result = resolveBundledOpenClawWindowsExecutionPlan(
      {
        platform: 'win32',
        arch: 'x64',
        preferredSource: 'bundled-runtime',
        runtimeBinaryPath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd',
        runtimePath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64',
        payloadPath: null,
        manifestPath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json',
        defaultDeliveryMode: 'bundled-runtime',
        targetDeliveryMode: 'bundled-runtime',
        warnings: [],
      },
      {
        ...buildTestEnv({
          APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
          USERPROFILE: 'C:\\Users\\alice',
        }),
      }
    )

    expect(result.ok).toBe(true)
    expect(result.targetLayout?.prefixDir).toBe('C:\\Users\\alice\\AppData\\Roaming\\npm')
    expect(result.targetLayout?.packageRootTarget).toBe(
      'C:\\Users\\alice\\AppData\\Roaming\\npm\\node_modules\\openclaw'
    )
  })

  it('inspects source layout and builds a copy plan for runtime takeover', () => {
    const executionPlan = resolveBundledOpenClawWindowsExecutionPlan(
      {
        platform: 'win32',
        arch: 'x64',
        preferredSource: 'bundled-runtime',
        runtimeBinaryPath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd',
        runtimePath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64',
        payloadPath: null,
        manifestPath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json',
        defaultDeliveryMode: 'bundled-runtime',
        targetDeliveryMode: 'bundled-runtime',
        warnings: [],
      },
      buildTestEnv({
        APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
        USERPROFILE: 'C:\\Users\\alice',
      })
    )

    const sourceLayout = inspectBundledOpenClawWindowsSourceLayout(executionPlan, (candidatePath) =>
      [
        'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd',
        'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.ps1',
        'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\node.exe',
        'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\node_modules\\openclaw\\package.json',
      ].includes(candidatePath)
    )
    const copyPlan = buildBundledOpenClawWindowsCopyPlan(executionPlan, sourceLayout)

    expect(sourceLayout?.packageRootSource).toBe(
      'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\node_modules\\openclaw'
    )
    expect(sourceLayout?.nodeSource).toBe(
      'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\node.exe'
    )
    expect(copyPlan?.binaryCopies).toEqual([
      {
        sourcePath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd',
        targetPath: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.cmd',
      },
      {
        sourcePath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.ps1',
        targetPath: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.ps1',
      },
    ])
    expect(copyPlan?.nodeCopy).toEqual({
      sourcePath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\node.exe',
      targetPath: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\node.exe',
    })
  })

  it('validates copied runtime targets', () => {
    const validation = validateBundledOpenClawWindowsCopyPlan(
      {
        runtimeRoot: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64',
        targetLayout: {
          prefixDir: 'C:\\Users\\alice\\AppData\\Roaming\\npm',
          binaryTargets: [
            'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.cmd',
            'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.ps1',
            'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw',
          ],
          nodeTarget: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\node.exe',
          packageRootTarget: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\node_modules\\openclaw',
        },
        binaryCopies: [
          {
            sourcePath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd',
            targetPath: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.cmd',
          },
        ],
        nodeCopy: {
          sourcePath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\node.exe',
          targetPath: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\node.exe',
        },
        packageRootSource: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\node_modules\\openclaw',
        packageRootTarget: 'C:\\Users\\alice\\AppData\\Roaming\\npm\\node_modules\\openclaw',
      },
      (candidatePath) =>
        [
          'C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.cmd',
          'C:\\Users\\alice\\AppData\\Roaming\\npm\\node.exe',
          'C:\\Users\\alice\\AppData\\Roaming\\npm\\node_modules\\openclaw\\package.json',
        ].includes(candidatePath)
    )

    expect(validation.ok).toBe(true)
    expect(validation.binaryPath).toBe('C:\\Users\\alice\\AppData\\Roaming\\npm\\openclaw.cmd')
    expect(validation.nodePath).toBe('C:\\Users\\alice\\AppData\\Roaming\\npm\\node.exe')
    expect(validation.errors).toEqual([])
  })

  it('rejects runtime execution when the preferred source is not bundled-runtime', () => {
    const result = resolveBundledOpenClawWindowsExecutionPlan(
      {
        platform: 'win32',
        arch: 'x64',
        preferredSource: 'bundled-fallback',
        runtimeBinaryPath: null,
        runtimePath: null,
        payloadPath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\openclaw-2026.3.24.tgz',
        manifestPath: 'C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\manifest.json',
        defaultDeliveryMode: 'bundled-fallback',
        targetDeliveryMode: 'bundled-runtime',
        warnings: [],
      },
      {
        ...buildTestEnv({
          APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
        }),
      }
    )

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('wrong-source')
  })
})
