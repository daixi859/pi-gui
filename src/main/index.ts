import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, utilityProcess } from 'electron'
import { isAbsolute, join } from 'node:path'
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

/** 关窗后宿主还在收尾（exit/message 回调），窗口已销毁，不能直接发 */
function emit(msg: AgentEvent): void {
  if (win && !win.isDestroyed()) win.webContents.send('agent:event', msg)
}

/** 引擎宿主：pi SDK 只在子进程里加载，主进程只做转发 */
function spawnHost(): void {
  host = utilityProcess.fork(join(import.meta.dirname, 'agent-host.js'), [], {
    serviceName: 'pi-agent-host',
    stdio: 'pipe',
    // 会话按这个目录归档，和 CLI 的 ~/.pi/agent/sessions 一致
    env: { ...process.env, PI_AGENT_CWD: process.cwd(), PI_USER_DATA: app.getPath('userData') }
  })
  host.stdout?.on('data', (d: Buffer) => console.log('[agent]', String(d).trim()))
  host.stderr?.on('data', (d: Buffer) => console.error('[agent]', String(d).trim()))
  host.on('message', (msg: AgentEvent) => emit(msg))
  host.on('exit', (code) => {
    host = null
    emit({ type: 'error', message: `引擎进程退出（${code}）` } satisfies AgentEvent)
  })
}

function send(cmd: AgentCommand): void {
  host?.postMessage(cmd)
}

/** 只放行 http(s)；file:// 等一律不在应用窗口里打开 */
const EXTERNAL = /^https?:\/\//

/** file:// 的 origin 恒为 "null"，只能对 http(s) 判同源；畸形 URL 当外链处理 */
function sameOrigin(a: string, b: string): boolean {
  if (!EXTERNAL.test(a)) return false
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
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

  // 渲染层任何导航都交给系统浏览器，不在应用窗口里打开网页
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (EXTERNAL.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const current = win?.webContents.getURL()
    if (current && sameOrigin(url, current)) return
    e.preventDefault()
    if (EXTERNAL.test(url)) void shell.openExternal(url)
  })
  win.on('ready-to-show', () => win?.show())
  win.on('closed', () => {
    win = null
  })
  // F12 / Ctrl+Shift+I 开关开发者工具
  win.webContents.on('before-input-event', (_e, input) => {
    const key = input.key.toLowerCase()
    if (input.type === 'keyDown' && (key === 'f12' || (input.control && input.shift && key === 'i'))) {
      win?.webContents.toggleDevTools()
    }
  })
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
      if (process.env.PI_SHOT_JS || process.env.PI_SHOT_JS_FILE) {
        // PI_SHOT_JS_FILE 优先：脚本写在文件里，省得和 PowerShell 的引号搏斗
        const js = process.env.PI_SHOT_JS_FILE
          ? readFileSync(process.env.PI_SHOT_JS_FILE, 'utf8')
          : process.env.PI_SHOT_JS
        // 脚本的返回值打到 stdout，方便断言
        const out = js ? await win.webContents.executeJavaScript(js) : undefined
        if (out !== undefined) console.log('[PI_SHOT]', out)
      }
      setTimeout(async () => {
        const img = await win?.webContents.capturePage()
        if (img) writeFileSync(process.env.PI_SHOT!, img.toPNG())
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

ipcMain.handle('host:pickDir', async () => {
  if (!win) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return canceled ? null : (filePaths[0] ?? null)
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

ipcMain.handle('host:readText', async (_e, path: string) => {
  try {
    const fs = await import('node:fs/promises')
    // 相对路径按引擎的工作目录解析（PI_AGENT_CWD 也是它）
    const abs = isAbsolute(path) ? path : join(process.cwd(), path)
    const handle = await fs.open(abs, 'r')
    try {
      const size = (await handle.stat()).size
      if (!size && size !== 0) return null
      const len = Math.min(size, 512 * 1024)
      const buf = Buffer.alloc(len)
      await handle.read(buf, 0, len, 0)
      return { text: buf.toString('utf8'), truncated: size > len }
    } finally {
      await handle.close()
    }
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
  // 双击图标只开一个窗口，否则两个宿主抢同一批会话文件。
  // dev（有 ELECTRON_RENDERER_URL）不抢：它要和构建产物并行跑起来调试。
  if (!process.env.ELECTRON_RENDERER_URL && !app.requestSingleInstanceLock()) {
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
