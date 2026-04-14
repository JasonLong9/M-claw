import { loadOpenClawGatewayRuntime } from './openclaw-gateway-runtime'
import { buildOpenClawLegacyEnvPatch, resolveOpenClawEnvValue } from './openclaw-legacy-env-migration'
import {
  OPENCLAW_WEBCHAT_CLIENT_ID,
  OPENCLAW_WEBCHAT_CLIENT_MODE,
  OPENCLAW_WEBCHAT_CLIENT_VERSION,
} from './chat-transport/gateway-streaming-chat-transport'

const { randomUUID } = process.getBuiltinModule('node:crypto') as typeof import('node:crypto')

const CONTROL_UI_LOAD_TIMEOUT_MS = 15_000
const CONTROL_UI_REQUEST_TIMEOUT_MS = 20_000

interface GatewayConnectionSettings {
  url: string
  token: string
  password?: string
}

interface BrowserWindowLike {
  loadURL: (url: string) => Promise<unknown>
  isDestroyed: () => boolean
  destroy: () => void
  webContents: {
    executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>
  }
}

interface BrowserWindowCreationOptions {
  show: boolean
  autoHideMenuBar: boolean
  webPreferences: {
    backgroundThrottling: boolean
    contextIsolation: boolean
    nodeIntegration: boolean
    partition: string
    sandbox: boolean
  }
}

interface ControlUiRpcDependencies {
  readConfig: () => Promise<Record<string, any> | null>
  readEnvFile: () => Promise<Record<string, string>>
  loadGatewayRuntime?: typeof loadOpenClawGatewayRuntime
  createBrowserWindow?: (options: BrowserWindowCreationOptions) => Promise<BrowserWindowLike> | BrowserWindowLike
}

interface ControlUiRpcCallOptions {
  timeoutMs?: number
  loadTimeoutMs?: number
}

interface ControlUiAppInspectOptions {
  timeoutMs?: number
  loadTimeoutMs?: number
}

interface ControlUiChatSendOptions {
  sessionKey: string
  message: string
  thinking?: string
  timeoutMs?: number
  loadTimeoutMs?: number
  runId?: string
}

export interface ControlUiAppInspectionResult {
  connected: boolean
  hasClient: boolean
  lastError?: string
  appKeys: string[]
  // These are projected browser snapshots for diagnostics and transition validation only.
  // Callers should normalize them in the main process instead of depending on page-private shape.
  helloSnapshot?: Record<string, unknown> | null
  healthResult?: Record<string, unknown> | null
  sessionsState?: Record<string, unknown> | null
  modelCatalogState?: Record<string, unknown> | null
  sessionsResult?: Record<string, unknown> | null
  chatModelCatalog?: unknown[] | null
  rpcStatus?: Record<string, unknown> | null
  rpcModels?: Record<string, unknown> | null
  rpcErrors?: string[]
}

interface ControlUiBrowserContext {
  settings: GatewayConnectionSettings
  controlUiUrl: string
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toOptionalString(value: unknown): string | undefined {
  const normalized = String(value || '').trim()
  return normalized || undefined
}

function toProcessEnvRecord(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value
  }
  return env
}

function mergeGatewayEnv(envFile: Record<string, string>): Record<string, string> {
  const baseEnv: Record<string, string | undefined> = {
    ...envFile,
    ...toProcessEnvRecord(),
  }
  const mergedEnv: Record<string, string | undefined> = {
    ...baseEnv,
    ...buildOpenClawLegacyEnvPatch(baseEnv),
  }
  const normalizedEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(mergedEnv)) {
    if (typeof value === 'string') {
      normalizedEnv[key] = value
    }
  }
  return normalizedEnv
}

function resolveGatewayUrl(config: Record<string, any> | null, env: Record<string, string>): string | null {
  const envUrl = resolveOpenClawEnvValue(env, 'OPENCLAW_GATEWAY_URL').value
  if (envUrl) return envUrl

  const gateway = normalizeRecord(config?.gateway)
  const remote = normalizeRecord(gateway?.remote)
  const mode = String(gateway?.mode || '').trim().toLowerCase()
  if (mode === 'remote') {
    return toOptionalString(remote?.url) || null
  }

  const port = Number(gateway?.port)
  const normalizedPort = Number.isFinite(port) && port > 0 ? Math.floor(port) : 18789
  const tlsEnabled = gateway?.tls && typeof gateway.tls === 'object' && (gateway.tls as Record<string, unknown>).enabled === true
  return `${tlsEnabled ? 'wss' : 'ws'}://127.0.0.1:${normalizedPort}`
}

function resolveGatewayToken(config: Record<string, any> | null, env: Record<string, string>): string | null {
  const configGateway = normalizeRecord(config?.gateway)
  const auth = normalizeRecord(configGateway?.auth)
  const explicitToken = typeof auth?.token === 'string' ? auth.token.trim() : ''
  if (explicitToken) return explicitToken

  const envToken = resolveOpenClawEnvValue(env, 'OPENCLAW_GATEWAY_TOKEN').value
  return envToken || null
}

async function resolveGatewayConnectionSettings(
  config: Record<string, any> | null,
  envFile: Record<string, string>,
  loadGatewayRuntime: typeof loadOpenClawGatewayRuntime
): Promise<GatewayConnectionSettings | null> {
  const mergedEnv = mergeGatewayEnv(envFile)

  try {
    const runtime = await loadGatewayRuntime()
    if (runtime) {
      const details = runtime.buildGatewayConnectionDetails({
        config,
      })
      const auth = await runtime.resolveGatewayConnectionAuth({
        config,
        env: mergedEnv as NodeJS.ProcessEnv,
      })
      const url = toOptionalString(details?.url)
      const token = toOptionalString(auth?.token)
      if (url && token) {
        return {
          url,
          token,
          password: toOptionalString(auth?.password),
        }
      }
    }
  } catch {
    // Fall back to Qclaw's lightweight resolver when OpenClaw internals are unavailable.
  }

  const url = resolveGatewayUrl(config, mergedEnv)
  const token = resolveGatewayToken(config, mergedEnv)
  if (!url || !token) return null

  return {
    url,
    token,
  }
}

export function normalizeControlUiBasePath(basePath: unknown): string {
  const normalized = String(basePath || '').trim()
  if (!normalized) return ''
  let nextPath = normalized
  if (!nextPath.startsWith('/')) nextPath = `/${nextPath}`
  if (nextPath === '/') return ''
  if (nextPath.endsWith('/')) nextPath = nextPath.slice(0, -1)
  return nextPath
}

export function buildOpenClawControlUiUrl(params: {
  gatewayUrl: string
  token: string
  basePath?: unknown
}): string {
  const url = new URL(params.gatewayUrl)
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
  const configuredBasePath = normalizeControlUiBasePath(params.basePath)
  const inferredBasePath = normalizeControlUiBasePath(url.pathname)
  const resolvedBasePath = configuredBasePath || (inferredBasePath && inferredBasePath !== '/' ? inferredBasePath : '')
  url.pathname = resolvedBasePath ? `${resolvedBasePath}/` : '/'
  url.search = ''
  url.hash = `token=${encodeURIComponent(params.token)}`
  return url.toString()
}

async function defaultCreateBrowserWindow(options: BrowserWindowCreationOptions): Promise<BrowserWindowLike> {
  const electronModule = await import('electron')
  return new electronModule.BrowserWindow(options) as unknown as BrowserWindowLike
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  if (!(timeoutMs > 0)) return promise
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
}

function buildControlUiRequestScript(method: string, params: unknown, timeoutMs: number): string {
  return `
    (async () => {
      const method = ${JSON.stringify(method)};
      const params = ${JSON.stringify(params ?? null)};
      const timeoutMs = ${JSON.stringify(timeoutMs)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const deadline = Date.now() + timeoutMs;

      await customElements.whenDefined('openclaw-app');

      let app = document.querySelector('openclaw-app');
      while (!app && Date.now() < deadline) {
        await sleep(50);
        app = document.querySelector('openclaw-app');
      }

      if (!app) {
        throw new Error('openclaw-app not found');
      }

      if ((!app.connected || !app.client) && typeof app.connect === 'function') {
        try {
          await app.connect();
        } catch {
          // Let the polling loop surface app.lastError or connection timeout below.
        }
      }

      while (Date.now() < deadline) {
        if (app.connected && app.client && typeof app.client.request === 'function') {
          return await app.client.request(method, params);
        }
        if (app.lastError) {
          throw new Error(String(app.lastError));
        }
        await sleep(100);
      }

      if (app.lastError) {
        throw new Error(String(app.lastError));
      }

      throw new Error('control ui connection timeout');
    })()
  `
}

function buildControlUiInspectScript(timeoutMs: number): string {
  return `
    (async () => {
      const timeoutMs = ${JSON.stringify(timeoutMs)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const deadline = Date.now() + timeoutMs;

      const project = (value, depth = 0) => {
        if (value == null) return value;
        if (depth >= 3) {
          if (Array.isArray(value)) return '[array]';
          if (typeof value === 'object') return '[object]';
          return value;
        }
        const valueType = typeof value;
        if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
          return value;
        }
        if (Array.isArray(value)) {
          return value.slice(0, 50).map((entry) => project(entry, depth + 1));
        }
        if (valueType !== 'object') {
          return String(value);
        }

        const output = {};
        for (const key of Object.keys(value).slice(0, 80)) {
          try {
            output[key] = project(value[key], depth + 1);
          } catch {
            output[key] = '[unserializable]';
          }
        }
        return output;
      };

      await customElements.whenDefined('openclaw-app');

      let app = document.querySelector('openclaw-app');
      while (!app && Date.now() < deadline) {
        await sleep(50);
        app = document.querySelector('openclaw-app');
      }

      if (!app) {
        throw new Error('openclaw-app not found');
      }

      if ((!app.connected || !app.client) && typeof app.connect === 'function') {
        try {
          await app.connect();
        } catch {
          // Surface via app.lastError / timeout below.
        }
      }

      while (Date.now() < deadline) {
        if (app.connected || app.lastError) {
          break;
        }
        await sleep(100);
      }

      let rpcStatus = null;
      let rpcModels = null;
      const rpcErrors = [];
      if (app.connected && app.client && typeof app.client.request === 'function') {
        try {
          rpcStatus = await app.client.request('status', {});
        } catch (error) {
          rpcErrors.push('status:' + String(error));
        }

        try {
          rpcModels = await app.client.request('models.list', {});
        } catch (error) {
          rpcErrors.push('models.list:' + String(error));
        }
      }

      return {
        connected: Boolean(app.connected),
        hasClient: Boolean(app.client),
        lastError: app.lastError ? String(app.lastError) : '',
        appKeys: Object.keys(app).sort(),
        helloSnapshot: project(app.hello?.snapshot ?? null),
        healthResult: project(app.healthResult ?? null),
        sessionsState: project(app.sessionsState ?? null),
        modelCatalogState: project(app.modelCatalogState ?? null),
        sessionsResult: project(app.sessionsResult ?? null),
        chatModelCatalog: project(Array.isArray(app.chatModelCatalog) ? app.chatModelCatalog : null),
        rpcStatus: project(rpcStatus),
        rpcModels: project(rpcModels),
        rpcErrors,
      };
    })()
  `
}

function buildControlUiChatSendScript(options: ControlUiChatSendOptions): string {
  return `
    (async () => {
      const sessionKey = ${JSON.stringify(options.sessionKey)};
      const message = ${JSON.stringify(options.message)};
      const thinking = ${JSON.stringify(options.thinking || 'off')};
      const timeoutMs = ${JSON.stringify(options.timeoutMs ?? CONTROL_UI_REQUEST_TIMEOUT_MS)};
      const requestedRunId = ${JSON.stringify(options.runId || randomUUID())};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const deadline = Date.now() + timeoutMs;

      await customElements.whenDefined('openclaw-app');

      let app = document.querySelector('openclaw-app');
      while (!app && Date.now() < deadline) {
        await sleep(50);
        app = document.querySelector('openclaw-app');
      }

      if (!app) {
        throw new Error('openclaw-app not found');
      }

      if ((!app.connected || !app.client) && typeof app.connect === 'function') {
        try {
          await app.connect();
        } catch {
          // Surface app.lastError or timeout below.
        }
      }

      while (Date.now() < deadline) {
        if (app.connected && app.client && typeof app.client.request === 'function') {
          break;
        }
        if (app.lastError) {
          throw new Error(String(app.lastError));
        }
        await sleep(100);
      }

      if (!app.connected || !app.client || typeof app.client.request !== 'function') {
        throw new Error(app.lastError ? String(app.lastError) : 'control ui connection timeout');
      }

      const client = app.client;
      const normalizeEventEntries = () => Array.isArray(app.eventLogBuffer) ? app.eventLogBuffer : [];
      const normalizeChatMessages = () => Array.isArray(app.chatMessages) ? app.chatMessages : [];
      const findTerminalChatPayload = (acceptedRunIds, currentRunId) => {
        const entries = normalizeEventEntries();
        for (const entry of entries) {
          if (!entry || entry.event !== 'chat') continue;
          const payload = entry.payload || {};
          if (String(payload.sessionKey || '').trim() !== sessionKey) continue;
          const incomingRunId = String(payload.runId || '').trim();
          if (currentRunId && incomingRunId && incomingRunId !== currentRunId && !acceptedRunIds.has(incomingRunId)) {
            continue;
          }
          if (payload.state === 'final' || payload.state === 'error' || payload.state === 'aborted') {
            return {
              payload,
              incomingRunId,
            };
          }
        }
        return null;
      };
      const findLastAssistantMessage = (baselineMessageCount) => {
        const newMessages = normalizeChatMessages().slice(baselineMessageCount);
        for (let index = newMessages.length - 1; index >= 0; index -= 1) {
          const candidate = newMessages[index];
          if (candidate && candidate.role === 'assistant') {
            return candidate;
          }
        }
        return null;
      };

      if (typeof app.sessionKey === 'string') {
        app.sessionKey = sessionKey;
      }
      app.chatRunId = requestedRunId;
      app.chatSending = true;
      app.chatStream = '';
      app.chatStreamStartedAt = Date.now();
      app.lastError = null;
      if (typeof app.requestUpdate === 'function') {
        try {
          app.requestUpdate();
        } catch {
          // Best-effort state sync only.
        }
      }

      const baselineMessageCount = normalizeChatMessages().length;

      try {
        await client.request('sessions.subscribe', {});
      } catch {
        // Chat events broadcast globally today; keep this as a best-effort parity step with Control UI.
      }

      const response = await client.request('chat.send', {
        sessionKey,
        message,
        thinking,
        deliver: false,
        timeoutMs,
        idempotencyKey: requestedRunId,
      });

      let runId = String(response?.runId || requestedRunId || '').trim() || requestedRunId;
      const acceptedRunIds = new Set([requestedRunId, runId].filter(Boolean));
      app.chatRunId = runId;

      while (Date.now() < deadline) {
        if (!app.connected) {
          throw new Error(String(app.lastError || 'control ui disconnected'));
        }

        const terminalMatch = findTerminalChatPayload(acceptedRunIds, runId);
        if (terminalMatch) {
          if (terminalMatch.incomingRunId) {
            acceptedRunIds.add(terminalMatch.incomingRunId);
            runId = terminalMatch.incomingRunId;
          }

          if (terminalMatch.payload.state === 'final') {
            return {
              runId: runId || requestedRunId,
              sessionKey,
              payload: terminalMatch.payload,
            };
          }

          throw new Error(String(terminalMatch.payload.errorMessage || terminalMatch.payload.stopReason || terminalMatch.payload.state));
        }

        if (!app.chatSending && !String(app.chatRunId || '').trim()) {
          const lastAssistantMessage = findLastAssistantMessage(baselineMessageCount);
          if (lastAssistantMessage) {
            return {
              runId: runId || requestedRunId,
              sessionKey,
              payload: {
                state: 'final',
                message: lastAssistantMessage,
              },
            };
          }
          if (app.lastError) {
            throw new Error(String(app.lastError));
          }
        }

        await sleep(100);
      }

      throw new Error('control ui chat.send timeout');
    })()
  `
}

async function withControlUiBrowser<T>(
  deps: ControlUiRpcDependencies,
  options: {
    loadTimeoutMs?: number
    timeoutMs?: number
    execute: (browserWindow: BrowserWindowLike, context: ControlUiBrowserContext) => Promise<T>
  }
): Promise<T> {
  const loadGatewayRuntime = deps.loadGatewayRuntime || loadOpenClawGatewayRuntime
  const createBrowserWindow = deps.createBrowserWindow || defaultCreateBrowserWindow
  const [config, envFile] = await Promise.all([deps.readConfig(), deps.readEnvFile()])
  const settings = await resolveGatewayConnectionSettings(config, envFile, loadGatewayRuntime)
  if (!settings) {
    throw new Error('gateway control ui config unavailable')
  }

  const basePath = normalizeRecord(config?.gateway)?.controlUi
  const controlUiUrl = buildOpenClawControlUiUrl({
    gatewayUrl: settings.url,
    token: settings.token,
    basePath: normalizeRecord(basePath)?.basePath,
  })
  const browserWindow = await createBrowserWindow({
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      partition: `qclaw-control-ui-rpc:${randomUUID()}`,
      sandbox: true,
    },
  })

  try {
    await withTimeout(
      browserWindow.loadURL(controlUiUrl) as Promise<unknown>,
      options.loadTimeoutMs ?? CONTROL_UI_LOAD_TIMEOUT_MS,
      'control ui page load timeout'
    )
    return await options.execute(browserWindow, {
      settings,
      controlUiUrl,
    })
  } finally {
    try {
      if (!browserWindow.isDestroyed()) {
        browserWindow.destroy()
      }
    } catch {
      // Ignore cleanup failures from a hidden helper window.
    }
  }
}

function buildBrowserGatewayRpcScript(params: {
  settings: GatewayConnectionSettings
  method: string
  requestParams: unknown
  timeoutMs: number
}): string {
  return `
    (async () => {
      const gatewayUrl = ${JSON.stringify(params.settings.url)};
      const authToken = ${JSON.stringify(params.settings.token)};
      const authPassword = ${JSON.stringify(params.settings.password || '')};
      const method = ${JSON.stringify(params.method)};
      const requestParams = ${JSON.stringify(params.requestParams ?? null)};
      const timeoutMs = ${JSON.stringify(params.timeoutMs)};
      const platform = ${JSON.stringify(process.platform)};
      const clientId = ${JSON.stringify(OPENCLAW_WEBCHAT_CLIENT_ID)};
      const clientMode = ${JSON.stringify(OPENCLAW_WEBCHAT_CLIENT_MODE)};
      const clientVersion = ${JSON.stringify(OPENCLAW_WEBCHAT_CLIENT_VERSION)};
      const randomId = () =>
        globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : 'browser-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      const closeSocket = (socket) => {
        try {
          socket && socket.close();
        } catch {
          // Ignore cleanup failures from the helper socket.
        }
      };

      if (typeof WebSocket !== 'function') {
        throw new Error('browser websocket unavailable');
      }

      return await new Promise((resolve, reject) => {
        let settled = false;
        let connectRequestId = '';
        let methodRequestId = '';
        const socket = new WebSocket(gatewayUrl);
        const timeoutId = setTimeout(() => {
          settle(new Error('browser gateway rpc timeout for ' + method));
        }, timeoutMs);

        const settle = (error, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          closeSocket(socket);
          if (error) reject(error);
          else resolve(value);
        };

        socket.addEventListener('message', (event) => {
          let frame;
          try {
            frame = JSON.parse(String(event.data || ''));
          } catch {
            return;
          }

          if (frame && frame.type === 'event' && frame.event === 'connect.challenge') {
            const nonce = String((frame.payload && frame.payload.nonce) || '').trim();
            if (!nonce) {
              settle(new Error('browser gateway connect challenge missing nonce'));
              return;
            }

            connectRequestId = randomId();
            socket.send(JSON.stringify({
              type: 'req',
              id: connectRequestId,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: clientId,
                  displayName: 'Qclaw',
                  version: clientVersion,
                  platform,
                  mode: clientMode,
                },
                role: 'operator',
                scopes: ['operator.admin', 'operator.read', 'operator.write'],
                auth: {
                  token: authToken,
                  ...(authPassword ? { password: authPassword } : {}),
                },
              },
            }));
            return;
          }

          if (frame && frame.type === 'res' && connectRequestId && frame.id === connectRequestId) {
            if (!frame.ok) {
              settle(new Error(String((frame.error && frame.error.message) || 'browser gateway connect failed')));
              return;
            }

            methodRequestId = randomId();
            socket.send(JSON.stringify({
              type: 'req',
              id: methodRequestId,
              method,
              params: requestParams,
            }));
            return;
          }

          if (frame && frame.type === 'res' && methodRequestId && frame.id === methodRequestId) {
            if (!frame.ok) {
              settle(
                new Error(
                  String((frame.error && frame.error.message) || ('browser gateway request failed for ' + method))
                )
              );
              return;
            }
            settle(null, Object.prototype.hasOwnProperty.call(frame, 'payload') ? frame.payload : null);
          }
        });

        socket.addEventListener('error', () => {
          settle(new Error('browser gateway websocket error'));
        });
        socket.addEventListener('close', () => {
          if (!settled) {
            settle(new Error('browser gateway websocket closed'));
          }
        });
      });
    })()
  `
}

function buildBrowserGatewayChatSendScript(params: {
  settings: GatewayConnectionSettings
  options: ControlUiChatSendOptions
}): string {
  return `
    (async () => {
      const gatewayUrl = ${JSON.stringify(params.settings.url)};
      const authToken = ${JSON.stringify(params.settings.token)};
      const authPassword = ${JSON.stringify(params.settings.password || '')};
      const sessionKey = ${JSON.stringify(params.options.sessionKey)};
      const message = ${JSON.stringify(params.options.message)};
      const thinking = ${JSON.stringify(params.options.thinking || 'off')};
      const timeoutMs = ${JSON.stringify(params.options.timeoutMs ?? CONTROL_UI_REQUEST_TIMEOUT_MS)};
      const requestedRunId = ${JSON.stringify(params.options.runId || randomUUID())};
      const platform = ${JSON.stringify(process.platform)};
      const clientId = ${JSON.stringify(OPENCLAW_WEBCHAT_CLIENT_ID)};
      const clientMode = ${JSON.stringify(OPENCLAW_WEBCHAT_CLIENT_MODE)};
      const clientVersion = ${JSON.stringify(OPENCLAW_WEBCHAT_CLIENT_VERSION)};
      const randomId = () =>
        globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : 'browser-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      const closeSocket = (socket) => {
        try {
          socket && socket.close();
        } catch {
          // Ignore cleanup failures from the helper socket.
        }
      };

      if (typeof WebSocket !== 'function') {
        throw new Error('browser websocket unavailable');
      }

      return await new Promise((resolve, reject) => {
        let settled = false;
        let connectRequestId = '';
        let sendRequestId = '';
        let runId = '';
        const acceptedRunIds = new Set([requestedRunId].filter(Boolean));
        const socket = new WebSocket(gatewayUrl);
        const timeoutId = setTimeout(() => {
          settle(new Error('browser gateway chat.send timeout for ' + sessionKey));
        }, timeoutMs);

        const settle = (error, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          closeSocket(socket);
          if (error) reject(error);
          else resolve(value);
        };

        socket.addEventListener('message', (event) => {
          let frame;
          try {
            frame = JSON.parse(String(event.data || ''));
          } catch {
            return;
          }

          if (frame && frame.type === 'event' && frame.event === 'connect.challenge') {
            const nonce = String((frame.payload && frame.payload.nonce) || '').trim();
            if (!nonce) {
              settle(new Error('browser gateway connect challenge missing nonce'));
              return;
            }

            connectRequestId = randomId();
            socket.send(JSON.stringify({
              type: 'req',
              id: connectRequestId,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: clientId,
                  displayName: 'Qclaw',
                  version: clientVersion,
                  platform,
                  mode: clientMode,
                },
                role: 'operator',
                scopes: ['operator.admin', 'operator.read', 'operator.write'],
                auth: {
                  token: authToken,
                  ...(authPassword ? { password: authPassword } : {}),
                },
              },
            }));
            return;
          }

          if (frame && frame.type === 'res' && connectRequestId && frame.id === connectRequestId) {
            if (!frame.ok) {
              settle(new Error(String((frame.error && frame.error.message) || 'browser gateway connect failed')));
              return;
            }

            sendRequestId = randomId();
            socket.send(JSON.stringify({
              type: 'req',
              id: sendRequestId,
              method: 'chat.send',
              params: {
                sessionKey,
                message,
                thinking,
                deliver: false,
                timeoutMs,
                idempotencyKey: requestedRunId,
              },
            }));
            return;
          }

          if (frame && frame.type === 'res' && sendRequestId && frame.id === sendRequestId) {
            if (!frame.ok) {
              settle(new Error(String((frame.error && frame.error.message) || 'browser gateway chat.send failed')));
              return;
            }

            const responseRunId = String((frame.payload && frame.payload.runId) || '').trim();
            if (responseRunId) {
              runId = responseRunId;
              acceptedRunIds.add(responseRunId);
            }
            return;
          }

          if (!(frame && frame.type === 'event' && frame.event === 'chat')) {
            return;
          }

          const payload = frame.payload || {};
          if (String(payload.sessionKey || '').trim() !== sessionKey) {
            return;
          }

          const incomingRunId = String(payload.runId || '').trim();
          if (runId && incomingRunId && incomingRunId !== runId && !acceptedRunIds.has(incomingRunId)) {
            return;
          }
          if (incomingRunId) {
            runId = incomingRunId;
            acceptedRunIds.add(incomingRunId);
          }

          const state = String(payload.state || '').trim();
          if (state === 'final') {
            settle(null, {
              runId: runId || requestedRunId,
              sessionKey,
              payload,
            });
            return;
          }

          if (state === 'error' || state === 'aborted') {
            settle(new Error(String(payload.errorMessage || payload.stopReason || state)));
          }
        });

        socket.addEventListener('error', () => {
          settle(new Error('browser gateway websocket error'));
        });
        socket.addEventListener('close', () => {
          if (!settled) {
            settle(new Error('browser gateway websocket closed'));
          }
        });
      });
    })()
  `
}

export async function callGatewayRpcViaControlUiBrowser(
  deps: ControlUiRpcDependencies,
  method: string,
  params: unknown,
  options: ControlUiRpcCallOptions = {}
): Promise<unknown> {
  return withControlUiBrowser(deps, {
    loadTimeoutMs: options.loadTimeoutMs,
    timeoutMs: options.timeoutMs,
    execute: (browserWindow, context) =>
      withTimeout(
        browserWindow.webContents.executeJavaScript(
          buildControlUiRequestScript(
            method,
            params,
            options.timeoutMs ?? CONTROL_UI_REQUEST_TIMEOUT_MS
          ),
          true
        ),
        options.timeoutMs ?? CONTROL_UI_REQUEST_TIMEOUT_MS,
        `control ui request timeout for ${method}`
      ),
  })
}

export async function inspectControlUiAppViaBrowser(
  deps: ControlUiRpcDependencies,
  options: ControlUiAppInspectOptions = {}
): Promise<ControlUiAppInspectionResult> {
  return withControlUiBrowser(deps, {
    loadTimeoutMs: options.loadTimeoutMs,
    timeoutMs: options.timeoutMs,
    execute: (browserWindow) =>
      withTimeout(
        browserWindow.webContents.executeJavaScript(
          buildControlUiInspectScript(options.timeoutMs ?? CONTROL_UI_REQUEST_TIMEOUT_MS),
          true
        ) as Promise<ControlUiAppInspectionResult>,
        options.timeoutMs ?? CONTROL_UI_REQUEST_TIMEOUT_MS,
        'control ui inspect timeout'
      ),
  })
}

export async function runGatewayChatViaControlUiBrowser(
  deps: ControlUiRpcDependencies,
  options: ControlUiChatSendOptions
): Promise<Record<string, unknown>> {
  return withControlUiBrowser(deps, {
    loadTimeoutMs: options.loadTimeoutMs,
    timeoutMs: options.timeoutMs,
    execute: (browserWindow, context) =>
      withTimeout(
        browserWindow.webContents.executeJavaScript(
          buildControlUiChatSendScript(options),
          true
        ),
        options.timeoutMs ?? CONTROL_UI_REQUEST_TIMEOUT_MS,
        `control ui chat.send timeout for ${options.sessionKey}`
      ) as Promise<Record<string, unknown>>,
  })
}
