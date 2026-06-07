import type { ChatSessionSummary, ChatTaskMode } from '../../src/shared/chat-panel'
import type {
  CodingModelProfileId,
  CodingWorkspaceStatusSnapshot,
} from '../../src/shared/coding-mode'
import {
  DEFAULT_CODING_MODEL_PROFILE_ID,
  getCodingModelProfileOption,
  normalizeCodingWorkspacePathInput,
} from '../../src/shared/coding-mode'
import { isLikelyMclawInternalPath } from '../../src/shared/mclaw-protected-paths'
import { parseChatSessionSourceFromKey } from '../../src/shared/dashboard-chat-session-source'

const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'Makefile',
]

const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const path = process.getBuiltinModule('node:path') as typeof import('node:path')

function resolveProtectedCodingWorkspaceRoots(): string[] {
  const userDataDir = String(process.env.QCLAW_USER_DATA_DIR || '').trim()
  const roots = [
    userDataDir,
    userDataDir ? path.join(userDataDir, 'openclaw-state') : '',
    userDataDir ? path.join(userDataDir, 'runtime') : '',
    userDataDir ? path.join(userDataDir, 'npm-cache') : '',
    userDataDir ? path.join(userDataDir, 'tools', 'claude-code') : '',
    String(process.resourcesPath || '').trim(),
    String(process.resourcesPath || '').trim() ? path.join(process.resourcesPath, 'openclaw-bundle') : '',
    String(process.resourcesPath || '').trim() ? path.join(process.resourcesPath, 'dev-tools-bundle') : '',
  ]
  return Array.from(new Set(roots.map((root) => String(root || '').trim()).filter(Boolean)))
}

export interface RoutedChatTaskDecision {
  mode: ChatTaskMode
  workspacePath?: string
  reason?: string
}

function isLocalDirectSession(session: ChatSessionSummary | null | undefined): boolean {
  if (!session) return true
  const source = parseChatSessionSourceFromKey(session.sessionKey)
  if (session.kind === 'channel' || source.sourceType === 'channel') return false
  if (session.authorityKind === 'upstream-direct' || session.authorityKind === 'mixed') return false
  return (
    session.localOnly === true
    || session.hasLocalTranscript === true
    || session.authorityKind === 'local-cache-only'
  )
}

function findProjectMarkers(workspacePath: string): string[] {
  return PROJECT_MARKERS.filter((marker) => fs.existsSync(path.join(workspacePath, marker)))
}

export function inspectCodingWorkspacePath(workspacePath?: string): CodingWorkspaceStatusSnapshot {
  const requestedPath = String(workspacePath || '')
  const normalizedPath = normalizeCodingWorkspacePathInput(requestedPath)
  if (normalizedPath && isLikelyMclawInternalPath(normalizedPath, { protectedRoots: resolveProtectedCodingWorkspaceRoots() })) {
    return {
      requestedPath,
      normalizedPath,
      exists: true,
      isDirectory: true,
      ready: false,
      setupState: 'not-project',
      summary: '该路径属于 Mclaw 内部受保护目录，不能作为开发工作区使用。请改选你自己的项目目录。',
      detectedMarkers: [],
    }
  }

  if (!normalizedPath) {
    return {
      requestedPath,
      normalizedPath: '',
      exists: false,
      isDirectory: false,
      ready: false,
      setupState: 'missing',
      summary: '请先填写本地开发项目目录。',
      detectedMarkers: [],
    }
  }

  let stat: import('node:fs').Stats | null = null
  try {
    stat = fs.statSync(normalizedPath)
  } catch {
    stat = null
  }

  if (!stat) {
    return {
      requestedPath,
      normalizedPath,
      exists: false,
      isDirectory: false,
      ready: false,
      setupState: 'not-found',
      summary: '项目目录不存在，请检查路径是否填写正确。',
      detectedMarkers: [],
    }
  }

  if (!stat.isDirectory()) {
    return {
      requestedPath,
      normalizedPath,
      exists: true,
      isDirectory: false,
      ready: false,
      setupState: 'not-directory',
      summary: '当前路径不是文件夹，请切换到真正的项目目录。',
      detectedMarkers: [],
    }
  }

  const detectedMarkers = findProjectMarkers(normalizedPath)
  if (detectedMarkers.length === 0) {
    return {
      requestedPath,
      normalizedPath,
      exists: true,
      isDirectory: true,
      ready: true,
      setupState: 'new-project',
      summary: '当前目录还没有识别到 .git、package.json、pyproject.toml、go.mod 等项目标记，但它仍可用于从 0 开始创建新项目。',
      detectedMarkers,
    }
  }

  return {
    requestedPath,
    normalizedPath,
    exists: true,
    isDirectory: true,
    ready: true,
    setupState: 'ready',
    summary: `已识别为开发项目目录：${detectedMarkers.join('、')}`,
    detectedMarkers,
  }
}

export function routeChatTask(params: {
  requestedTaskMode?: ChatTaskMode
  workspacePath?: string
  codingModelProfileId?: CodingModelProfileId
  matchedSession?: ChatSessionSummary | null
}): RoutedChatTaskDecision {
  const requestedTaskMode =
    params.requestedTaskMode === 'coding-executor' ? 'coding-executor' : 'normal-chat'
  const codingModelProfile =
    getCodingModelProfileOption(params.codingModelProfileId)
    || getCodingModelProfileOption(DEFAULT_CODING_MODEL_PROFILE_ID)
  const workspaceStatus = inspectCodingWorkspacePath(params.workspacePath)

  if (requestedTaskMode !== 'coding-executor') {
    return { mode: 'normal-chat' }
  }

  if (!workspaceStatus.ready) {
    return {
      mode: 'normal-chat',
      reason: workspaceStatus.summary,
    }
  }

  if (!codingModelProfile || codingModelProfile.availability !== 'available') {
    return {
      mode: 'normal-chat',
      reason: `${String(codingModelProfile?.label || params.codingModelProfileId || '所选开发模型')} 还未接入 Mclaw 开发模式，请先切换到当前可用的 Claude Code 当前模型。`,
    }
  }

  if (!isLocalDirectSession(params.matchedSession)) {
    return {
      mode: 'normal-chat',
      reason: 'Claude Code 开发任务模式只支持本地 direct 会话，请切到本地会话后再试。',
    }
  }

  return {
    mode: 'coding-executor',
    workspacePath: workspaceStatus.normalizedPath,
  }
}
