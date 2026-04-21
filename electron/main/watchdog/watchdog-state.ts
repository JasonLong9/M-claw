import type {
  WatchdogState,
  WatchdogStateCode,
  WatchdogEvent,
  WatchdogEventKind,
  WatchdogRecoveryAction,
} from './watchdog-types'

const MAX_EVENT_HISTORY = 100

let currentState: WatchdogState = {
  stateCode: 'idle',
  lastHealthCheckTime: null,
  lastHealthyTime: null,
  consecutiveFailures: 0,
  totalRecoveries: 0,
  totalFailures: 0,
  circuitOpenUntil: null,
  lastRecoveryTime: null,
}

let eventHistory: WatchdogEvent[] = []
let stateChangeListeners: Array<(state: WatchdogState) => void> = []
let eventListeners: Array<(event: WatchdogEvent) => void> = []

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function getWatchdogState(): WatchdogState {
  return { ...currentState }
}

export function setWatchdogState(partial: Partial<WatchdogState>): void {
  currentState = { ...currentState, ...partial }
  notifyStateChange()
}

export function getEventHistory(): WatchdogEvent[] {
  return [...eventHistory]
}

export function addEvent(
  kind: WatchdogEventKind,
  message: string,
  options?: {
    action?: WatchdogRecoveryAction
    detail?: string
  }
): WatchdogEvent {
  const event: WatchdogEvent = {
    id: generateEventId(),
    timestamp: Date.now(),
    kind,
    message,
    action: options?.action,
    detail: options?.detail,
    stateCode: currentState.stateCode,
  }

  eventHistory.push(event)

  if (eventHistory.length > MAX_EVENT_HISTORY) {
    eventHistory = eventHistory.slice(-MAX_EVENT_HISTORY)
  }

  notifyEvent(event)
  return event
}

export function onStateChange(listener: (state: WatchdogState) => void): () => void {
  stateChangeListeners.push(listener)
  return () => {
    stateChangeListeners = stateChangeListeners.filter((l) => l !== listener)
  }
}

export function onEvent(listener: (event: WatchdogEvent) => void): () => void {
  eventListeners.push(listener)
  return () => {
    eventListeners = eventListeners.filter((l) => l !== listener)
  }
}

function notifyStateChange(): void {
  for (const listener of stateChangeListeners) {
    try {
      listener(getWatchdogState())
    } catch {
    }
  }
}

function notifyEvent(event: WatchdogEvent): void {
  for (const listener of eventListeners) {
    try {
      listener(event)
    } catch {
    }
  }
}

export function resetWatchdogState(): void {
  currentState = {
    stateCode: 'idle',
    lastHealthCheckTime: null,
    lastHealthyTime: null,
    consecutiveFailures: 0,
    totalRecoveries: 0,
    totalFailures: 0,
    circuitOpenUntil: null,
    lastRecoveryTime: null,
  }
  eventHistory = []
  notifyStateChange()
}
