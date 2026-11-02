import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, utilityProcess } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import type { AgentCommand, AgentEvent } from '@shared/ipc'

let win: BrowserWindow | null = null
let host: Electron.UtilityProcess | null = null
/** 窗口尺寸/位置落盘，下次启动还原 */
const boundsFile = (): string => join(app.getPath('userData'), 'window.json')

function readBounds(): Partial<Electron.Rectangle> {
  try {
    return JSON.parse(readFileSync(boundsFile(), 'utf8'))
  } catch {
    return {}
  }
}

/** 引擎宿主：pi SDK 只在子进程里加载，主进程只做转发 */
function spawnHost(): void {
  host = utilityProcess.fork(join(import.meta.dirname, 'agent-host.js'), [], {
    serviceName: 'pi-agent-host',
    stdio: 'pipe',
    // 会话按这个目录归档，和 CLI 的 ~/.pi/agent/sessions 一致
    env: { ...process.env, PI_AGENT_CWD: process.cwd() }
  })
  host.stdout?.on('data', (d: Buffer) => console.log('[agent]', String(d).trim()))
  host.stderr?.on('data', (d: Buffer) => console.error('[agent]', String(d).trim()))
  host.on('message', (msg: AgentEvent) => win?.webContents.send('agent:event', msg))
  host.on('exit', (code) => {
    host = null
    win?.webContents.send('agent:event', { type: 'error', message: `引擎进程退出（${code}）` } satisfies AgentEvent)
  })
}

function send(cmd: AgentCommand): void {
  host?.postMessage(cmd)
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1192,
    height: 868,
    ...readBounds(),
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: '#fbfaf9',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win?.show())
  // 最大化时 getBounds 给的是全屏矩形，关窗会把全屏尺寸存下来，所以只在非最大化时记
  win.on('close', () => {
    if (!win || win.isMaximized()) return
    try {
      writeFileSync(boundsFile(), JSON.stringify(win.getBounds()))
    } catch {
      // 写入失败无所谓，下次用默认尺寸
    }
  })
  // 调试用：PI_SHOT=<路径> 启动后若干秒抓一张图，PI_SHOT_JS 先执行一段页面脚本
  if (process.env.PI_SHOT) {
    setTimeout(async () => {
      if (!win) return
      if (process.env.PI_SHOT_JS) await win.webContents.executeJavaScript(process.env.PI_SHOT_JS)
      setTimeout(async () => {
        const img = await win?.webContents.capturePage()
        if (img) (await import('node:fs')).writeFileSync(process.env.PI_SHOT!, img.toPNG())
      }, Number(process.env.PI_SHOT_DELAY ?? 3000))
    }, Number(process.env.PI_SHOT_AT ?? 12000))
  }
  win.on('maximize', () => win?.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win?.webContents.send('window:maximized', false))

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:toggleMaximize', () => {
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.on('window:close', () => win?.close())

ipcMain.handle('host:pickFiles', async () => {
  if (!win) return []
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections']
  })
  return canceled ? [] : filePaths
})

ipcMain.handle('host:readImage', async (_e, path: string) => {
  try {
    const buf = await (await import('node:fs/promises')).readFile(path)
    const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
    const mimeType =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/png'
    return { data: buf.toString('base64'), mimeType }
  } catch {
    return null
  }
})

ipcMain.on('agent:command', (_e, cmd: AgentCommand) => send(cmd))

ipcMain.on('host:openAgentConfig', () => void shell.openPath(join(homedir(), '.pi', 'agent', 'settings.json')))

// 渲染层（sandbox）拿不到 clipboard / shell / dialog，统一从这走
ipcMain.on('host:copy', (_e, text: string) => clipboard.writeText(text))
ipcMain.on('host:openPath', (_e, path: string) => void shell.openPath(path))
ipcMain.on('host:revealPath', (_e, path: string) => shell.showItemInFolder(path))
ipcMain.on('host:openExternal', (_e, url: string) => {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url)
})
ipcMain.on('host:saveText', async (_e, name: string, text: string) => {
  if (!win) return
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: join(app.getPath('documents'), name),
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (!canceled && filePath) await (await import('node:fs/promises')).writeFile(filePath, text, 'utf8')
})

app.whenReady().then(() => {
  // 双击图标只开一个窗口，否则两个宿主抢同一批会话文件
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })
  // 宿主先起：它要花 ~1.7s 加载 pi SDK，和建窗/渲染层加载并行
  spawnHost()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  host?.kill()
  if (process.platform !== 'darwin') app.quit()
})
