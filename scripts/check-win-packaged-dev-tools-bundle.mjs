import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

function info(message) {
  console.log(`[win-packaged-dev-tools] ${message}`)
}

function fail(message) {
  throw new Error(message)
}

function parseArgs(argv) {
  const parsed = {
    releaseDir: '',
    winUnpackedDir: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim()
    if (current === '--release-dir') {
      parsed.releaseDir = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }
    if (current === '--win-unpacked-dir') {
      parsed.winUnpackedDir = String(argv[index + 1] || '').trim()
      index += 1
    }
  }

  return parsed
}

function exists(candidatePath) {
  try {
    return fs.existsSync(candidatePath)
  } catch {
    return false
  }
}

function ensureFile(filePath, label) {
  if (!exists(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`Missing ${label}: ${filePath}`)
  }
}

function ensureDirectory(dirPath, label) {
  if (!exists(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    fail(`Missing ${label}: ${dirPath}`)
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function runVersion(command, args, env = process.env) {
  const commandLine = [`"${command}"`, ...args].join(' ')
  const result = spawnSync(commandLine, {
    encoding: 'utf8',
    windowsHide: true,
    env,
    shell: true,
  })
  if (result.status !== 0) {
    fail(String(result.stderr || result.stdout || `Command failed: ${commandLine}`).trim())
  }
  return String(result.stdout || '').trim()
}

function resolveLatestWinUnpackedDir(releaseRoot) {
  if (!exists(releaseRoot)) return ''

  const entries = fs.readdirSync(releaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const releaseDir = path.join(releaseRoot, entry.name)
      const winUnpackedDir = path.join(releaseDir, 'win-unpacked')
      let mtimeMs = 0
      try {
        mtimeMs = fs.statSync(releaseDir).mtimeMs
      } catch {
        mtimeMs = 0
      }
      return {
        winUnpackedDir,
        mtimeMs,
      }
    })
    .filter((entry) => exists(entry.winUnpackedDir))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)

  return entries[0]?.winUnpackedDir || ''
}

function resolveWinUnpackedDir(options = {}) {
  if (options.winUnpackedDir) {
    return path.resolve(options.winUnpackedDir)
  }
  if (options.releaseDir) {
    return path.resolve(options.releaseDir, 'win-unpacked')
  }
  return resolveLatestWinUnpackedDir(path.resolve('release'))
}

export function verifyWinPackagedDevToolsBundle(options = {}) {
  const winUnpackedDir = resolveWinUnpackedDir(options)
  if (!winUnpackedDir) {
    fail('Could not resolve a win-unpacked directory. Pass --release-dir or --win-unpacked-dir.')
  }

  const resourcesDir = path.join(winUnpackedDir, 'resources')
  const bundleRoot = path.join(resourcesDir, 'dev-tools-bundle', 'windows-x64')
  const manifestPath = path.join(bundleRoot, 'manifest.json')
  const gitRoot = path.join(bundleRoot, 'git')
  const gitExe = path.join(gitRoot, 'cmd', 'git.exe')
  const gitBash = path.join(gitRoot, 'bin', 'bash.exe')
  const claudeRoot = path.join(bundleRoot, 'claude-code')
  const claudeCommand = path.join(claudeRoot, 'claude.cmd')
  const claudePackageRoot = path.join(claudeRoot, 'node_modules', '@anthropic-ai', 'claude-code')
  const claudePackagePath = path.join(claudePackageRoot, 'package.json')
  const claudeCliPath = path.join(claudePackageRoot, 'cli.js')
  const nodePath = path.join(resourcesDir, 'openclaw-bundle', 'runtime', 'windows-x64', 'node.exe')

  ensureDirectory(winUnpackedDir, 'win-unpacked directory')
  ensureDirectory(resourcesDir, 'packaged resources directory')
  ensureDirectory(bundleRoot, 'packaged dev-tools bundle root')
  ensureFile(manifestPath, 'packaged dev-tools manifest')
  ensureDirectory(gitRoot, 'packaged Git root')
  ensureFile(gitExe, 'packaged git.exe')
  ensureFile(gitBash, 'packaged bash.exe')
  ensureDirectory(claudeRoot, 'packaged Claude Code root')
  ensureFile(claudeCommand, 'packaged claude.cmd')
  ensureDirectory(claudePackageRoot, 'packaged Claude Code package root')
  ensureFile(claudePackagePath, 'packaged Claude Code package manifest')
  ensureFile(claudeCliPath, 'packaged Claude Code cli entry')
  ensureFile(nodePath, 'packaged bundled node.exe')

  const manifest = readJson(manifestPath)
  const claudePackage = readJson(claudePackagePath)
  const gitEnv = {
    ...process.env,
    PATH: [path.join(gitRoot, 'cmd'), path.join(gitRoot, 'bin'), path.join(gitRoot, 'usr', 'bin'), process.env.PATH || '']
      .filter(Boolean)
      .join(';'),
  }
  const gitVersion = runVersion(gitExe, ['--version'], gitEnv)
  const claudeVersion = String(
    execFileSync(nodePath, [claudeCliPath, '--version'], {
      encoding: 'utf8',
      env: {
        ...gitEnv,
        PATH: [path.dirname(nodePath), gitEnv.PATH || '']
          .filter(Boolean)
          .join(';'),
        CLAUDE_CODE_GIT_BASH_PATH: gitBash,
      },
    }) || ''
  ).trim()

  info(`Validated packaged dev-tools bundle: ${bundleRoot}`)
  info(`Packaged Git version: ${gitVersion}`)
  info(`Packaged Claude Code version: ${claudeVersion}`)
  info(`Manifest Claude Code version: ${String(manifest?.claudeCode?.version || '').trim() || 'unknown'}`)
  info(`Package Claude Code version: ${String(claudePackage?.version || '').trim() || 'unknown'}`)

  return {
    ok: true,
    winUnpackedDir,
    bundleRoot,
  }
}

const entryHref = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''

if (import.meta.url === entryHref) {
  try {
    const args = parseArgs(process.argv.slice(2))
    verifyWinPackagedDevToolsBundle(args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error(`[win-packaged-dev-tools] ERROR: ${message}`)
    process.exit(1)
  }
}
