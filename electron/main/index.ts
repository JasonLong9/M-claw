import { app, BrowserWindow, Menu, Notification, Tray, nativeImage, screen, shell } from 'electron'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { registerIpcHandlers } from './ipc-handlers'
import { runAppExitCleanup } from './app-exit-cleanup'
import { startWatchdog } from './watchdog'
import { isAllowedExternalOpenUrl } from '../../src/shared/desktop-url-policy'
import {
  DESKTOP_WINDOW_POLICY,
  resolveMainWindowBounds,
  shouldDisableHardwareAccelerationForPlatform,
} from '../../src/shared/desktop-window-policy'
import { tryNormalizeProcessCwd } from './runtime-working-directory'
import { revealWindow, showOrCreateWindow } from './window-lifecycle'
import { reloadGatewayForConfigChange } from './gateway-lifecycle-controller'
import { ensureGatewayRunning } from './openclaw-gateway-service'
import { sanitizeNodeOptionsForElectron } from './node-options'
import { ensureRequiredOpenClawStateDirs, repairManagedOpenClawStateLayout } from './openclaw-state-bootstrap'
import { resolveOpenClawPaths } from './openclaw-paths'
import { mkdir } from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OPEN_CONTACT_MODAL_CHANNEL = 'app:open-contact-modal'
const OPEN_MODELS_PAGE_CHANNEL = 'app:open-models-page'
const WATCHDOG_BOOT_DELAY_MS = 30_000
const WATCHDOG_START_THRESHOLDS = {
  healthCheckIntervalMs: 15_000,
  maxConsecutiveFailures: 3,
  circuitOpenDurationMs: 60_000,
} as const

function sanitizeNodeOptionsForElectronRuntime(): void {
  const sanitized = sanitizeNodeOptionsForElectron(process.env.NODE_OPTIONS)
  if (sanitized) {
    process.env.NODE_OPTIONS = sanitized
  } else {
    delete process.env.NODE_OPTIONS
  }
}

sanitizeNodeOptionsForElectronRuntime()

process.env.APP_ROOT = path.join(__dirname, '../..')
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const IS_DEV = !!VITE_DEV_SERVER_URL || !app.isPackaged

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (shouldDisableHardwareAccelerationForPlatform(process.platform, os.release())) {
  app.disableHardwareAcceleration()
}
if (process.platform === 'win32') app.setAppUserModelId('com.mclawai.mclaw')
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }

let win: BrowserWindow | null = null
let tray: Tray | null = null
let appExitCleanupDone = false
let appExitCleanupPromise: Promise<void> | null = null
let isQuitting = false
let watchdogStartupTimer: NodeJS.Timeout | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')
const focusApp = process.platform === 'darwin'
  ? (options: { steal: boolean }) => app.focus(options)
  : undefined
function resolveRuntimeAppIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app-icon.png')
    : path.join(process.env.APP_ROOT!, 'src', 'assets', 'logo.png')
}

function loadRuntimeAppIcon() {
  const iconPath = resolveRuntimeAppIconPath()
  if (!existsSync(iconPath)) return null

  const icon = nativeImage.createFromPath(iconPath)
  return icon.isEmpty() ? null : icon
}

function createWindow() {
  tryNormalizeProcessCwd()

  const workAreaSize = screen.getPrimaryDisplay().workAreaSize
  const mainWindowBounds = resolveMainWindowBounds(workAreaSize)

  const appIcon = loadRuntimeAppIcon()
    || nativeImage.createFromPath(
      process.platform === 'win32'
        ? path.join(process.env.VITE_PUBLIC!, 'favicon.ico')
        : path.join(process.env.VITE_PUBLIC!, 'tray@2x.png')
    )

  if (process.platform === 'darwin') {
    const dockIcon = loadRuntimeAppIcon()
    if (dockIcon) {
      app.dock.setIcon(dockIcon)
    }
  }

  const browserWindow = new BrowserWindow({
    title: 'Mclaw',
    icon: appIcon.isEmpty() ? undefined : appIcon,
    width: mainWindowBounds.width,
    height: mainWindowBounds.height,
    minWidth: mainWindowBounds.minWidth,
    minHeight: mainWindowBounds.minHeight,
    titleBarStyle: 'hiddenInset',
    show: false,
    backgroundColor: DESKTOP_WINDOW_POLICY.backgroundColor,
    webPreferences: { preload },
  })
  win = browserWindow

  browserWindow.once('ready-to-show', () => {
    if (win !== browserWindow) return
    revealWindow(browserWindow, focusApp)
  })

  browserWindow.on('closed', () => {
    if (win === browserWindow) {
      win = null
    }
  })

  browserWindow.on('close', (event) => {
    if (process.platform !== 'darwin' || isQuitting) return
    event.preventDefault()
    browserWindow.hide()
  })

  if (VITE_DEV_SERVER_URL) {
    void browserWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void browserWindow.loadFile(indexHtml)
  }

  if (IS_DEV) {
    browserWindow.webContents.openDevTools({ mode: 'detach' })
  }

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalOpenUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  return browserWindow
}

async function initializeManagedRuntimeEnvironment(): Promise<void> {
  const userDataDir = app.getPath('userData')
  process.env.QCLAW_USER_DATA_DIR = userDataDir
  process.env.QCLAW_SAFE_WORK_DIR = path.join(userDataDir, 'runtime')

  await mkdir(process.env.QCLAW_SAFE_WORK_DIR, { recursive: true }).catch(() => undefined)

  const openClawPaths = resolveOpenClawPaths({
    userDataDir,
    userHomeDir: app.getPath('home'),
    platform: process.platform,
  })
  await repairManagedOpenClawStateLayout(openClawPaths.homeDir).catch(() => undefined)
  await ensureRequiredOpenClawStateDirs(path.join(openClawPaths.homeDir, '.openclaw')).catch(() => undefined)

  if (process.platform === 'win32') {
    const { cleanupWindowsGatewayLaunchersForMclaw } = await import('./cli')
    await cleanupWindowsGatewayLaunchersForMclaw().catch(() => undefined)
  }
}

function showMainWindow() {
  const result = showOrCreateWindow({
    browserWindow: win,
    createWindow,
    focusApp,
  })
  win = result.window
}

function openContactModalWindow() {
  const result = showOrCreateWindow({
    browserWindow: win,
    createWindow,
    focusApp,
  })
  win = result.window

  const sendOpenContactModal = () => {
    if (result.window.isDestroyed()) return
    result.window.webContents.send(OPEN_CONTACT_MODAL_CHANNEL)
  }

  if (result.window.webContents.isLoadingMainFrame()) {
    result.window.webContents.once('did-finish-load', () => {
      setTimeout(sendOpenContactModal, 50)
    })
    return
  }

  sendOpenContactModal()
}

function openModelsPageWindow() {
  const result = showOrCreateWindow({
    browserWindow: win,
    createWindow,
    focusApp,
  })
  win = result.window

  const sendOpenModelsPage = () => {
    if (result.window.isDestroyed()) return
    result.window.webContents.send(OPEN_MODELS_PAGE_CHANNEL)
  }

  if (result.window.webContents.isLoadingMainFrame()) {
    result.window.webContents.once('did-finish-load', () => {
      setTimeout(sendOpenModelsPage, 50)
    })
    return
  }

  sendOpenModelsPage()
}

function showTrayNotification(options: { title: string; body: string }) {
  if (!Notification.isSupported()) return
  new Notification({
    title: options.title,
    body: options.body,
    silent: true,
  }).show()
}

async function restartGatewayFromTray() {
  showTrayNotification({
    title: 'Mclaw',
    body: '网关正在重启，请稍候...',
  })

  try {
    const result = await reloadGatewayForConfigChange('tray-manual-reload', {
      preferEnsureWhenNotRunning: true,
    })

    if (!result?.ok) {
      throw new Error(result?.stderr || result?.stdout || '网关重启失败')
    }

    showTrayNotification({
      title: 'Mclaw',
      body: '网关已重启完成',
    })
  } catch (error) {
    showTrayNotification({
      title: 'Mclaw',
      body: error instanceof Error ? error.message : '网关重启失败，请稍后重试',
    })
  }
}

function createTray() {
  const trayIconPath = path.join(process.env.VITE_PUBLIC!, 'tray.png')
  const trayIcon = nativeImage.createFromPath(trayIconPath)
  trayIcon.setTemplateImage(true)
  const resized = trayIcon.resize({ width: 32, height: 32 })
  tray = new Tray(resized)
  tray.setToolTip('Mclaw')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '配置模型',
      click: () => { openModelsPageWindow() },
    },
    { type: 'separator' },
    {
      label: '联系我们',
      click: () => { openContactModalWindow() },
    },
    {
      label: '重启网关',
      click: () => { void restartGatewayFromTray() },
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    showMainWindow()
  })
}

function scheduleWatchdogStart(): void {
  if (watchdogStartupTimer) {
    clearTimeout(watchdogStartupTimer)
  }

  watchdogStartupTimer = setTimeout(() => {
    watchdogStartupTimer = null
    startWatchdog(WATCHDOG_START_THRESHOLDS)
  }, WATCHDOG_BOOT_DELAY_MS)
}

async function warmupGatewayOnAppReady(): Promise<void> {
  try {
    const first = await ensureGatewayRunning({
      skipRuntimePrecheck: true,
    })
    if (first.ok && first.running) return

    const corpus = `${String(first.summary || '')}\n${String(first.stderr || '')}\n${String(first.stdout || '')}`.toLowerCase()
    const looksLikeManagedChannelFailure =
      first.stateCode === 'plugin_load_failure'
      || first.stateCode === 'config_invalid'
      || /unknown channel id|failed to load plugin|manifest|allowlist/.test(corpus)
    if (!looksLikeManagedChannelFailure) return

    const { repairManagedChannelPlugin } = await import('./managed-channel-plugin-lifecycle')
    await repairManagedChannelPlugin('openclaw-weixin').catch(() => null)
    await repairManagedChannelPlugin('feishu').catch(() => null)
    await ensureGatewayRunning({
      skipRuntimePrecheck: true,
    }).catch(() => null)
  } catch {
    // Keep startup resilient; renderer still has manual recovery controls.
  }
}

app.whenReady().then(() => {
  return initializeManagedRuntimeEnvironment()
    .catch(() => undefined)
    .then(() => {
      registerIpcHandlers()
      return warmupGatewayOnAppReady()
    })
    .then(() => {
      createWindow()
      createTray()
      scheduleWatchdogStart()
    })
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  isQuitting = true
  if (watchdogStartupTimer) {
    clearTimeout(watchdogStartupTimer)
    watchdogStartupTimer = null
  }
  if (appExitCleanupDone) return
  event.preventDefault()

  if (!appExitCleanupPromise) {
    appExitCleanupPromise = runAppExitCleanup()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        appExitCleanupDone = true
        appExitCleanupPromise = null
        app.quit()
      })
  }
})

app.on('second-instance', () => {
  showMainWindow()
})

app.on('activate', () => {
  showMainWindow()
})
