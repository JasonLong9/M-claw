import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function fail(message) {
  throw new Error(message)
}

function info(message) {
  console.log(`[stage-win-dev-tools] ${message}`)
}

function resolveArgValue(flagName) {
  const index = process.argv.indexOf(flagName)
  if (index === -1) return ''
  return String(process.argv[index + 1] || '').trim()
}

function resolveExistingFile(candidatePath) {
  const normalized = String(candidatePath || '').trim()
  if (!normalized) return ''
  try {
    return fs.statSync(normalized).isFile() ? normalized : ''
  } catch {
    return ''
  }
}

function resolveExistingDirectory(candidatePath) {
  const normalized = String(candidatePath || '').trim()
  if (!normalized) return ''
  try {
    return fs.statSync(normalized).isDirectory() ? normalized : ''
  } catch {
    return ''
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function ensureInsideWorkspace(targetPath, workspaceRoot) {
  const normalizedTarget = path.resolve(targetPath)
  const normalizedWorkspace = path.resolve(workspaceRoot)
  const relativePath = path.relative(normalizedWorkspace, normalizedTarget)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    fail(`Refusing to write outside workspace: ${normalizedTarget}`)
  }
}

function copyDirectory(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.cpSync(sourcePath, targetPath, { recursive: true, force: true })
}

function copyFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
}

function runVersion(command, args, env = process.env) {
  try {
    const commandLine = [`"${command}"`, ...args].join(' ')
    const result = spawnSync(commandLine, {
      encoding: 'utf8',
      windowsHide: true,
      env,
      shell: true,
    })
    if (result.status !== 0) {
      return ''
    }
    return String(result.stdout || '').trim()
  } catch {
    return ''
  }
}

if (process.platform !== 'win32') {
  fail('This staging script currently only supports running on Windows.')
}

const workspaceRoot = process.cwd()
const targetRoot = path.resolve(
  resolveArgValue('--target') || path.join(workspaceRoot, 'resources', 'dev-tools-bundle', 'windows-x64')
)
ensureInsideWorkspace(targetRoot, workspaceRoot)

const gitRoot = resolveExistingDirectory(
  resolveArgValue('--git-root') || path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git')
)
const claudeShimDir = resolveExistingDirectory(
  resolveArgValue('--claude-shim-dir') || path.join(process.env.APPDATA || '', 'npm')
)
const claudePackageDir = resolveExistingDirectory(
  resolveArgValue('--claude-package-dir')
  || path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code')
)

if (!gitRoot) {
  fail('Could not find Git for Windows. Expected C:\\Program Files\\Git or pass --git-root.')
}
if (!claudeShimDir) {
  fail('Could not find the Claude Code shim directory. Expected %APPDATA%\\npm or pass --claude-shim-dir.')
}
if (!claudePackageDir) {
  fail('Could not find the Claude Code package directory. Expected %APPDATA%\\npm\\node_modules\\@anthropic-ai\\claude-code or pass --claude-package-dir.')
}

const requiredClaudeShims = ['claude.cmd']
const optionalClaudeShims = ['claude', 'claude.ps1']
for (const shimName of requiredClaudeShims) {
  if (!resolveExistingFile(path.join(claudeShimDir, shimName))) {
    fail(`Missing required Claude Code shim: ${path.join(claudeShimDir, shimName)}`)
  }
}

const targetGitRoot = path.join(targetRoot, 'git')
const targetClaudeRoot = path.join(targetRoot, 'claude-code')
const targetClaudePackageRoot = path.join(targetClaudeRoot, 'node_modules', '@anthropic-ai', 'claude-code')
const targetManifestPath = path.join(targetRoot, 'manifest.json')

info(`staging Git from ${gitRoot}`)
info(`staging Claude Code shims from ${claudeShimDir}`)
info(`staging Claude Code package from ${claudePackageDir}`)

fs.rmSync(targetRoot, { recursive: true, force: true })
fs.mkdirSync(targetRoot, { recursive: true })

copyDirectory(gitRoot, targetGitRoot)
fs.mkdirSync(targetClaudeRoot, { recursive: true })
for (const shimName of [...requiredClaudeShims, ...optionalClaudeShims]) {
  const sourcePath = resolveExistingFile(path.join(claudeShimDir, shimName))
  if (!sourcePath) continue
  copyFile(sourcePath, path.join(targetClaudeRoot, shimName))
}
copyDirectory(claudePackageDir, targetClaudePackageRoot)

const claudePackage = readJson(path.join(targetClaudePackageRoot, 'package.json'))
const gitVersion = runVersion(path.join(gitRoot, 'cmd', 'git.exe'), ['--version'], {
  ...process.env,
  PATH: [path.join(gitRoot, 'cmd'), path.join(gitRoot, 'bin'), path.join(gitRoot, 'usr', 'bin'), process.env.PATH || '']
    .filter(Boolean)
    .join(';'),
})
const manifest = {
  generatedAt: new Date().toISOString(),
  target: 'windows-x64',
  git: {
    sourceRoot: gitRoot,
    root: 'git',
    version: gitVersion,
    gitExe: 'git/cmd/git.exe',
    bashExe: fs.existsSync(path.join(targetGitRoot, 'bin', 'bash.exe')) ? 'git/bin/bash.exe' : '',
  },
  claudeCode: {
    sourceShimDir: claudeShimDir,
    sourcePackageDir: claudePackageDir,
    version: String(claudePackage?.version || '').trim(),
    command: 'claude-code/claude.cmd',
    packageDir: 'claude-code/node_modules/@anthropic-ai/claude-code',
    license: String(claudePackage?.license || '').trim(),
  },
}
fs.writeFileSync(targetManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

info(`wrote manifest: ${targetManifestPath}`)
info(`bundled Git version: ${manifest.git.version || 'unknown'}`)
info(`bundled Claude Code version: ${manifest.claudeCode.version || 'unknown'}`)
info(`completed staging into ${targetRoot}`)
