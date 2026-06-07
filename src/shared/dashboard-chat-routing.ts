import type {
  ChatStreamEvent,
  ChatSessionOrigin,
  ChatSessionSummary,
  DashboardChatHistorySummary,
  DashboardChatSessionStatus,
} from './chat-panel'
import { getChannelDisplayName, parseChatSessionSourceFromKey } from './dashboard-chat-session-source'

export type DirectChatSessionAction = 'reuse' | 'create'

function normalizeModelLabel(model: string | undefined, fallback: string): string {
  return String(model || '').trim() || fallback
}

function describeChannelSession(session: ChatSessionSummary): string {
  const source = parseChatSessionSourceFromKey(session.sessionKey)
  if (source.sourceType !== 'channel') return '渠道历史会话'
  return `${getChannelDisplayName(source.sourceChannel)} 历史会话`
}

function canContinueChannelHistorySession(session: ChatSessionSummary | null | undefined): boolean {
  if (!session) return false
  const source = parseChatSessionSourceFromKey(session.sessionKey)
  if (session.kind !== 'channel' && source.sourceType !== 'channel') return false
  return session.canContinue ?? source.sourceType === 'channel'
}

function isUpstreamConfirmedDirectShadow(session: ChatSessionSummary | null | undefined): boolean {
  if (!session) return false
  if (session.kind !== 'direct') return false
  if (parseChatSessionSourceFromKey(session.sessionKey).sourceType === 'channel') return false
  if (session.hasLocalTranscript) return false
  if (session.cachePresence !== 'local-shell') return false
  if (String(session.sessionKey || '').trim() === '') return false
  return session.authorityKind === 'upstream-direct' || session.authorityKind === 'mixed'
}

export function resolveChatSessionOrigin(session: ChatSessionSummary | null | undefined): ChatSessionOrigin {
  if (!session) return 'unknown'
  if (session.kind === 'channel') return 'channel'

  const source = parseChatSessionSourceFromKey(session.sessionKey)
  if (source.sourceType === 'channel') return 'channel'

  if (session.authorityKind === 'local-cache-only') return 'local-direct'
  if (session.authorityKind === 'upstream-direct' || session.authorityKind === 'mixed') return 'external-direct'

  if (session.kind !== 'direct') return 'unknown'
  if (session.localOnly === true || session.hasLocalTranscript === true) return 'local-direct'
  return 'external-direct'
}

function describeSessionSource(session: ChatSessionSummary | null | undefined, origin: ChatSessionOrigin): string {
  if (!session) return '未选择会话'
  if (origin === 'local-direct') {
    return session.cachePresence === 'local-shell' && !session.hasLocalTranscript
      ? 'Mclaw 本地空会话'
      : 'Mclaw 本地会话'
  }
  if (origin === 'external-direct') {
    if (isUpstreamConfirmedDirectShadow(session)) {
      return session.cachePresence === 'local-shell' ? '直连会话' : '直连会话'
    }
    if (session.authorityKind === 'mixed' && session.cachePresence === 'local-transcript') {
      return '直连历史会话（含本地缓存）'
    }
    if (session.authorityKind === 'mixed' && session.cachePresence === 'local-shell') {
      return '直连会话（含本地缓存）'
    }
    return '直连历史会话'
  }
  if (origin === 'channel') return describeChannelSession(session)
  return '未知来源'
}

function buildSessionNotice(params: {
  defaultModel: string
  session: ChatSessionSummary | null | undefined
  origin: ChatSessionOrigin
  sessionModel: string
}): { willForkOnSend: boolean; notice: string } {
  if (!params.session) {
    return {
      willForkOnSend: false,
      notice: '',
    }
  }

  if (params.origin === 'channel') {
    const source = parseChatSessionSourceFromKey(params.session.sessionKey)
    const channelLabel = getChannelDisplayName(source.sourceChannel)
    if (canContinueChannelHistorySession(params.session)) {
      return {
        willForkOnSend: false,
        notice: `当前浏览的是${channelLabel}来源会话；发送新消息会继续写入该会话。`,
      }
    }
    return {
      willForkOnSend: true,
      notice: `当前浏览的是${channelLabel}来源的历史会话；发送新消息时会新建本地会话。`,
    }
  }

  if (params.origin === 'external-direct') {
    const canContinue = params.session.canContinue ?? Boolean(String(params.session.sessionKey || '').trim())
    if (isUpstreamConfirmedDirectShadow(params.session)) {
      return {
        willForkOnSend: !canContinue,
        notice: canContinue
          ? '当前直连会话已确认创建；发送新消息会继续写入该会话。'
          : '当前直连会话已确认创建，但暂时缺少可续写标识；发送新消息时会新建本地会话。',
      }
    }
    return {
      willForkOnSend: !canContinue,
      notice: canContinue
        ? '当前浏览的是直连历史会话；发送新消息会继续写入该会话。'
        : '当前历史会话缺少可续写标识；发送新消息时会新建本地会话。',
    }
  }

  return {
    willForkOnSend: false,
    notice: '',
  }
}

function findExistingSessionId(
  sessions: ChatSessionSummary[],
  candidateSessionId: string | undefined
): string {
  const normalizedSessionId = String(candidateSessionId || '').trim()
  if (!normalizedSessionId) return ''
  return sessions.some((session) => session.sessionId === normalizedSessionId) ? normalizedSessionId : ''
}

function isOpenClawMainWebchatSession(session: ChatSessionSummary | null | undefined): boolean {
  if (!session) return false
  return parseChatSessionSourceFromKey(session.sessionKey).sourceType === 'webchat'
}

function shouldAutoSelectDashboardSession(session: ChatSessionSummary | null | undefined): boolean {
  if (!session) return false
  if (isOpenClawMainWebchatSession(session)) return false

  const origin = resolveChatSessionOrigin(session)
  if (origin === 'channel') return false
  if (session.hasLocalTranscript) return true
  if (session.authorityKind === 'local-cache-only' || session.localOnly === true) return true
  if (isUpstreamConfirmedDirectShadow(session)) return true
  return false
}

export function pickDefaultActiveSession(params: {
  sessions: ChatSessionSummary[]
  preferredSessionId?: string
  currentActiveSessionId?: string
}): string {
  const sessions = Array.isArray(params.sessions) ? params.sessions : []
  const preferredSessionId = findExistingSessionId(sessions, params.preferredSessionId)
  if (preferredSessionId) return preferredSessionId

  const currentActiveSessionId = findExistingSessionId(sessions, params.currentActiveSessionId)
  if (currentActiveSessionId) return currentActiveSessionId

  const firstAutoSelectableSession = sessions.find((session) => shouldAutoSelectDashboardSession(session))
  return firstAutoSelectableSession?.sessionId || ''
}

export function resolveDirectChatSessionAction(params: { activeSessionId?: string }): DirectChatSessionAction {
  return String(params.activeSessionId || '').trim() ? 'reuse' : 'create'
}

export function resolveChatStreamSessionBinding(params: {
  trackedSessionId?: string
  incomingSessionId?: string
  eventType: ChatStreamEvent['type']
}): string {
  const trackedSessionId = String(params.trackedSessionId || '').trim()
  const incomingSessionId = String(params.incomingSessionId || '').trim()
  if (!trackedSessionId) return ''
  if (!incomingSessionId) return trackedSessionId
  if (incomingSessionId === trackedSessionId) return trackedSessionId
  if (params.eventType === 'assistant-start') return incomingSessionId
  return trackedSessionId
}

export function resolveCompletedSendSessionId(params: {
  requestedSessionId?: string
  resultSessionId?: string
}): string {
  const resultSessionId = String(params.resultSessionId || '').trim()
  if (resultSessionId) return resultSessionId
  return String(params.requestedSessionId || '').trim()
}

export function buildDashboardChatSessionStatus(params: {
  defaultModel?: string
  session?: ChatSessionSummary | null
}): DashboardChatSessionStatus {
  const session = params.session || null
  const origin = resolveChatSessionOrigin(session)
  const rawDefaultModel = String(params.defaultModel || '').trim()
  const defaultModel = rawDefaultModel || '未设置'
  const sessionModel = session ? normalizeModelLabel(session.model, '默认路由') : '未选择会话'
  const noticeState = buildSessionNotice({
    defaultModel: rawDefaultModel,
    session,
    origin,
    sessionModel,
  })

  return {
    defaultModel,
    sessionModel,
    sessionSource: describeSessionSource(session, origin),
    sessionOrigin: origin,
    authorityKind: session?.authorityKind,
    cachePresence: session?.cachePresence,
    canContinue: session?.canContinue,
    willForkOnSend: noticeState.willForkOnSend,
    notice: noticeState.notice,
  }
}

function truncateHistoryText(value: string, maxLength: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function resolveHistorySessionTitle(session: ChatSessionSummary, origin: ChatSessionOrigin): string {
  const explicitTitle = truncateHistoryText(String(session.title || '').trim(), 42)
  if (explicitTitle) return explicitTitle

  if (origin === 'channel') {
    const source = parseChatSessionSourceFromKey(session.sessionKey)
    return `${getChannelDisplayName(source.sourceChannel)} 会话`
  }

  if (origin === 'external-direct') {
    const model = String(session.model || '').trim()
    return model ? `直连 · ${model}` : '直连会话'
  }

  const model = String(session.model || '').trim()
  return model ? `本地对话 · ${model}` : '本地对话'
}

function resolveHistorySessionPreview(session: ChatSessionSummary): string | undefined {
  const preview = truncateHistoryText(String(session.previewText || '').trim(), 88)
  if (!preview) return undefined
  const title = truncateHistoryText(String(session.title || '').trim(), 42)
  if (title && preview === title) return undefined
  return preview
}

function resolveHistorySessionSourceDetail(session: ChatSessionSummary, origin: ChatSessionOrigin): string {
  if (origin === 'channel') {
    const source = parseChatSessionSourceFromKey(session.sessionKey)
    return `${getChannelDisplayName(source.sourceChannel)} 来源会话`
  }

  if (origin === 'external-direct') {
    return isUpstreamConfirmedDirectShadow(session)
      ? '已确认的直连会话'
      : '来自直连服务的历史会话'
  }

  if (session.hasLocalTranscript) {
    if (Number.isFinite(session.messageCount) && Number(session.messageCount) > 0) {
      return `本地记录 · ${Number(session.messageCount)} 条消息`
    }
    return '本地记录'
  }

  if (session.authorityKind === 'local-cache-only' || session.localOnly) {
    return '本地创建，尚未发送消息'
  }

  return '本地缓存会话'
}

export function buildHistorySessionSummary(session: ChatSessionSummary): DashboardChatHistorySummary {
  const origin = resolveChatSessionOrigin(session)
  const title = resolveHistorySessionTitle(session, origin)
  const previewText = resolveHistorySessionPreview(session)
  const sourceDetail = resolveHistorySessionSourceDetail(session, origin)

  if (origin === 'external-direct') {
    const canContinue = session.canContinue ?? Boolean(String(session.sessionKey || '').trim())
    if (isUpstreamConfirmedDirectShadow(session)) {
      return {
        title,
        previewText,
        sourceDetail,
        originBadge: '直连会话',
        secondaryBadge: canContinue ? '已确认' : '待确认',
        modelDetail: session.model ? `当前模型：${session.model}` : '',
      }
    }
    return {
      title,
      previewText,
      sourceDetail,
      originBadge: '直连历史',
      secondaryBadge: canContinue ? '可续写' : '只读历史',
      modelDetail: session.model ? `历史模型：${session.model}` : '',
    }
  }

  if (origin === 'channel') {
    const source = parseChatSessionSourceFromKey(session.sessionKey)
    const channelLabel = getChannelDisplayName(source.sourceChannel)
    return {
      title,
      previewText,
      sourceDetail,
      originBadge: `${channelLabel}会话`,
      secondaryBadge: canContinueChannelHistorySession(session) ? '可续写' : '只读历史',
      modelDetail: session.model ? `历史模型：${session.model}` : '',
    }
  }

  if (session.hasLocalTranscript && (session.authorityKind === 'local-cache-only' || session.localOnly)) {
    return {
      title,
      previewText,
      sourceDetail,
      originBadge: '本地记录',
      secondaryBadge: '本地创建',
      modelDetail: session.model ? `最近使用：${session.model}` : '',
    }
  }

  if (session.hasLocalTranscript) {
    return {
      title,
      previewText,
      sourceDetail,
      originBadge: '本地记录',
      modelDetail: session.model ? `最近使用：${session.model}` : '',
    }
  }

  if (session.authorityKind === 'local-cache-only' || session.localOnly) {
    return {
      title,
      previewText,
      sourceDetail,
      originBadge: '本地创建',
      modelDetail: session.model ? `最近使用：${session.model}` : '',
    }
  }

  return {
    title,
    previewText,
    sourceDetail,
    originBadge: '未知来源',
    modelDetail: session.model ? `历史模型：${session.model}` : '',
  }
}
