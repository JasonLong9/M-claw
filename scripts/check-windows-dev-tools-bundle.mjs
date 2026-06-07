import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function fail(message) {
  throw new Error(message)
}

function info(message) {
  console.log(`[check-win-dev-tools] ${message}`)
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`Missing ${label}: ${filePath}`)
  }
}

function ensureDirectory(dirPath, label) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    fail(`Missing ${label}: ${dirPath}`)
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function runVersion(command, args, env = process.env) {
  // 在当前 Windows 打包环境里，直接 spawn Git for Windows 二进制会触发 EPERM。
  // 这里只执行受控的 `--version` 探测，改用 shell 代起更稳定。
  const commandLine = [`"${command}"`, ...args].join(' ')
  const result = spawnSync(commandLine, {
    encoding: 'utf8',
    windowsHide: true,
    env,
    shell: true,
  })
  if (result.status !== 0) {
    fail(String(result.stderr || result.stdout || `Command failed: ${command} ${args.join(' ')}`).trim())
  }
  return String(result.stdout || '').trim()
}

const workspaceRoot = process.cwd()
const bundleRoot = path.join(workspaceRoot, 'resources', 'dev-tools-bundle', 'windows-x64')
const manifestPath = path.join(bundleRoot, 'manifest.json')
const gitRoot = path.join(bundleRoot, 'git')
const gitExe = path.join(gitRoot, 'cmd', 'git.exe')
const gitBash = path.join(gitRoot, 'bin', 'bash.exe')
const claudeRoot = path.join(bundleRoot, 'claude-code')
const claudeCommand = path.join(claudeRoot, 'claude.cmd')
const claudePackageRoot = path.join(claudeRoot, 'node_modules', '@anthropic-ai', 'claude-code')
const claudePackagePath = path.join(claudePackageRoot, 'package.json')
const claudeCliPath = path.join(claudePackageRoot, 'cli.js')
const bundledNodePath = path.join(workspaceRoot, 'resources', 'openclaw-bundle', 'runtime', 'windows-x64', 'node.exe')
const devNodePath = path.join(workspaceRoot, 'node-v24.14.1-win-x64', 'node-v24.14.1-win-x64', 'node.exe')
const nodePath = fs.existsSync(bundledNodePath) ? bundledNodePath : devNodePath

ensureDirectory(bundleRoot, 'Windows dev-tools bundle root')
ensureFile(manifestPath, 'Windows dev-tools manifest')
ensureDirectory(gitRoot, 'bundled Git root')
ensureFile(gitExe, 'bundled git.exe')
ensureFile(gitBash, 'bundled bash.exe')
ensureDirectory(claudeRoot, 'bundled Claude Code root')
ensureFile(claudeCommand, 'bundled claude.cmd')
ensureDirectory(claudePackageRoot, 'bundled Claude Code package root')
ensureFile(claudePackagePath, 'bundled Claude Code package manifest')
ensureFile(claudeCliPath, 'bundled Claude Code cli entry')
ensureFile(nodePath, 'Node runtime for Claude Code verification')

const manifest = readJson(manifestPath)
const claudePackage = readJson(claudePackagePath)
const gitEnv = {
  ...process.env,
  PATH: [path.join(gitRoot, 'cmd'), path.join(gitRoot, 'bin'), path.join(gitRoot, 'usr', 'bin'), process.env.PATH || '']
    .filter(Boolean)
    .join(';'),
}
const gitVersion = runVersion(gitExe, ['--version'], gitEnv)
const claudeVersion = runVersion(nodePath, [claudeCliPath, '--version'], {
  ...gitEnv,
  PATH: [path.dirname(nodePath), gitEnv.PATH || '']
    .filter(Boolean)
    .join(';'),
  CLAUDE_CODE_GIT_BASH_PATH: gitBash,
})

info(`manifest=${path.relative(workspaceRoot, manifestPath)}`)
info(`gitVersion=${gitVersion}`)
info(`claudeVersion=${claudeVersion}`)
info(`manifestClaudeVersion=${String(manifest?.claudeCode?.version || '').trim() || 'unknown'}`)
info(`packageClaudeVersion=${String(claudePackage?.version || '').trim() || 'unknown'}`)
