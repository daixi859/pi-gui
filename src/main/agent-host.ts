/**
 * 在 utilityProcess 里跑的引擎宿主：唯一直接接触 pi SDK 的地方。
 * 对外只有 AgentCommand 进、AgentEvent 出，渲染层不认识 pi。
 *
 * 分层原则：宿主只做「pi 事件 → 通用协议」的搬运，不认识任何具体扩展或工具。
 * 工具语义（例如某个工具的参数含义、某个扩展期望的答案字符串格式）属于渲染层的交互适配器，
 * 见 src/renderer/src/interactions/。
 */
import { readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { readdir } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  sessionEntryToContextMessages
} from '@earendil-works/pi-coding-agent'
import type { ExtensionAPI, SessionInfo } from '@earendil-works/pi-coding-agent'
import {
  keyOf,
  type AccessMode,
  type AgentCommand,
  type AgentEvent,
  type CommandInfo,
  type ModelOption,
  type PiMessage,
  type UiReply,
  type UiRequest
} from '@shared/ipc'
import { LEVEL_LABEL } from '@shared/blocks'
import type { ProjectMeta, ProjectRow, SessionMeta, Snapshot } from '@shared/blocks'

type Session = Awaited<ReturnType<typeof createAgentSession>>['session']

/** 一个会话在宿主里的全部状态：切走后原样留着，后台继续跑，切回来直接恢复 */
interface Mounted {
  session: Session
  manager: SessionManager
  detach: () => void
  cwd: string
  /** 会话消息：key 是 timestamp（start → end → 落盘不变，ADR-0014），按到达顺序存 */
  msgs: Map<string, PiMessage>
  order: string[]
  /** 已推给渲染层的消息（同 key 引用变了才重发）+ 已有顺序 */
  sent: Map<string, PiMessage>
  sentOrder: string[]
  forceFull: boolean
  /** 流式消息每 60ms 推一次增量，避免渲染层重排风暴 */
  flushTimer: NodeJS.Timeout | null
  /** 尚未结束的工具调用，栈顶即最近开始的那个；ui 请求据此认领到具体工具 */
  liveTools: string[]
}

/** key 是会话文件路径；后台会话也在里面，切走不会 dispose 它们 */
const mounted = new Map<string, Mounted>()
/** 当前展示的会话 */
let current: Mounted | null = null
/** 切换会话串行执行：挂载大会话要几秒，这期间到的 prompt 必须等切完再写进正确的会话 */
let switching: Promise<void> = Promise.resolve()
function switchTo(run: () => Promise<void>): Promise<void> {
  const next = switching.then(run, run)
  switching = next.catch(() => {})
  return next
}
/** 当前会话的工作目录；默认进程 cwd，主进程可用 PI_AGENT_CWD 指定 */
let cwd = process.env.PI_AGENT_CWD || process.cwd()
let models: ModelOption[] = []
/** 工具执行前的确认策略；由渲染层的「变更前确认 / 完全访问」开关控制 */
let access: AccessMode = 'confirm'

/** 会改动磁盘或执行命令的工具，这些才需要用户点头。内置工具不带 annotations，只能按名字列 */
const RISKY = new Set(['write', 'edit', 'powershell', 'bash'])

type UiBridge = ReturnType<typeof uiContextFor>

/** 注入给 pi 的权限门：复用 ui 桥的 confirm，所以渲染层不用认识它 */
function permissionGate(ui: UiBridge): (pi: ExtensionAPI) => void {
  return (pi) => {
    pi.on('tool_call', async (event) => {
      if (access === 'full' || !RISKY.has(event.toolName)) return undefined
      const detail = JSON.stringify(event.input ?? {})
      const ok = await ui.confirm(
        `允许执行 ${event.toolName}？`,
        detail.length > 300 ? detail.slice(0, 300) + '…' : detail
      )
      return ok ? undefined : { block: true, reason: '用户拒绝了这次工具调用' }
    })
  }
}

const port = (process as unknown as { parentPort?: { postMessage(m: unknown): void; on(e: string, f: (m: { data: AgentCommand }) => void): void } }).parentPort
const send = (e: AgentEvent): void => port?.postMessage(e)

/** upsert 一条消息：浅拷贝换引用——pi 可能原地改同一条消息，增量比对靠引用变化 */
function upsert(rec: Mounted, msg: PiMessage | undefined): void {
  if (!msg || typeof msg.timestamp !== 'number') return
  const key = keyOf(msg)
  if (!rec.msgs.has(key)) rec.order.push(key)
  rec.msgs.set(key, { ...msg })
}

/** 合成一条会话内通知（压缩 / 撤销 / 出错），渲染层按提示行显示 */
function notice(rec: Mounted, text: string, tone: 'info' | 'warn' | 'error' = 'info'): void {
  upsert(rec, {
    role: 'custom',
    customType: 'pigui-notice',
    content: text,
    display: true,
    details: { tone },
    timestamp: Date.now()
  })
}

function schedule(rec: Mounted): void {
  if (rec.flushTimer) return
  rec.flushTimer = setTimeout(() => {
    rec.flushTimer = null
    flushMessages(rec)
  }, 60)
}
function flushNow(rec: Mounted): void {
  if (rec.flushTimer) {
    clearTimeout(rec.flushTimer)
    rec.flushTimer = null
  }
  flushMessages(rec)
}

/** 只推变了的消息；顺序没变不带 order，渲染层沿用旧数组引用（ADR-0014） */
function flushMessages(rec: Mounted): void {
  // 后台会话只维护自己的状态，不推给渲染层；切回来时 forceFull 一次补齐
  if (rec !== current) return
  const items: PiMessage[] = []
  for (const key of rec.order) {
    const m = rec.msgs.get(key)
    if (!m) continue
    if (rec.forceFull || rec.sent.get(key) !== m) {
      items.push(m)
      rec.sent.set(key, m)
    }
  }
  const orderChanged =
    rec.order.length !== rec.sentOrder.length || rec.order.some((k, i) => k !== rec.sentOrder[i])
  if (!items.length && !orderChanged && !rec.forceFull) return
  // 拷贝而不是直接赋引用：order 会被 upsert 原地 push，引用共享会让 orderChanged 永远为 false
  rec.sentOrder = [...rec.order]
  send({
    type: 'messages',
    delta: {
      full: rec.forceFull,
      ...(rec.forceFull || orderChanged ? { order: rec.order } : {}),
      items
    },
    path: rec.manager.getSessionFile() ?? null
  })
  rec.forceFull = false
}

function branch(): string {
  try {
    const head = readFileSync(join(cwd, '.git', 'HEAD'), 'utf8').trim()
    return head.startsWith('ref: refs/heads/') ? head.slice(16) : '分离头指针'
  } catch {
    return 'main'
  }
}

function snapshot(): Snapshot {
  return {
    model: current?.session.model?.name ?? '未选择模型',
    thinkingLevel: LEVEL_LABEL[current?.session.thinkingLevel ?? 'high'] ?? '高',
    cwd: basename(cwd),
    workspace: cwd,
    branch: branch(),
    access: access === 'full' ? '完全访问' : '变更前确认',
    accessFull: access === 'full'
  }
}

function status(streaming: boolean): void {
  send({ type: 'status', snapshot: snapshot(), streaming, path: current?.manager.getSessionFile() ?? null })
}

/* ---------------- 扩展 UI 桥 ----------------
 * 宿主不认识任何具体扩展或工具：ui.* 的每次调用都原样抛给渲染层，渲染层回什么就转发什么。
 * 语义（例如某个扩展期望的 "1,3; 自定义" 格式、保留行、header）属于渲染层的交互适配器。
 * 每个请求带上"最近一个尚未结束的工具"，供适配器把请求认领到具体工具。
 */

interface PendingUi {
  resolve: (r: UiReply) => void
}

const pending = new Map<string, PendingUi>()
let uiSeq = 0

function ask(liveTools: string[], req: Omit<UiRequest, 'id' | 'toolCallId'>): Promise<UiReply> {
  const id = `ui-${++uiSeq}`
  const full: UiRequest = { ...req, id, toolCallId: liveTools[liveTools.length - 1] }
  return new Promise((resolve) => {
    pending.set(id, { resolve })
    send({ type: 'uiRequest', req: full })
  })
}

function settleUi(id: string, reply: UiReply): void {
  const entry = pending.get(id)
  if (!entry) return
  pending.delete(id)
  entry.resolve(reply)
}

/** 给 pi 的 uiContext：所有原语都转发给渲染层，宿主不做业务判断 */
function uiContextFor(liveTools: string[]) {
  return {
    async select(title: string, options: string[]) {
      const r = await ask(liveTools, { kind: 'select', title, options })
      return r.cancelled ? undefined : r.value
    },
    async confirm(title: string, message: string) {
      return Boolean((await ask(liveTools, { kind: 'confirm', title, message })).confirmed)
    },
    async input(title: string, placeholder?: string) {
      const r = await ask(liveTools, { kind: 'input', title, placeholder })
      return r.cancelled ? undefined : r.value
    },
    async editor(title: string, prefill?: string) {
      const r = await ask(liveTools, { kind: 'editor', title, prefill })
      return r.cancelled ? undefined : r.value
    },
    notify(message: string, type?: 'info' | 'warning' | 'error') {
      void ask(liveTools, { kind: 'notify', message, notifyType: type })
    },
    onTerminalInput: () => () => {},
    setStatus() {},
    setWorkingMessage() {},
    setWorkingVisible() {},
    setWorkingIndicator() {},
    setHiddenThinkingLabel() {},
    setWidget() {},
    setFooter() {},
    setHeader() {},
    setTitle() {},
    custom: async () => undefined,
    pasteToEditor() {},
    setEditorText() {},
    getEditorText: () => '',
    addAutocompleteProvider() {},
    get theme() {
      return undefined
    },
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: () => ({ success: false, error: 'no theme' }),
    getToolsExpanded: () => false,
    setToolsExpanded() {}
  }
}

/* ---------------- 会话列表 ---------------- */

function ageLabel(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时`
  return `${Math.floor(hours / 24)}天`
}

function titleOf(info: { name?: string; firstMessage: string }): string {
  const clean = (info.name?.trim() || info.firstMessage.trim().split('\n')[0] || '未命名任务')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length > 28 ? clean.slice(0, 28) + '…' : clean
}

/** 会话扫描可能重入（init / 用户消息 / turn 结束都会触发），只跑一个 */
let scanning = false
/** 扫描期间又来了请求（通常是新会话刚落盘），跑完再补一次 */
let scanAgain = false
/** 最近一次扫描结果，用于重发（模型列表变了但不必重扫盘） */
let lastList: readonly SessionInfo[] = []

/* ---------------- 项目覆盖层 ----------------
 * 项目本身不落盘：全部从会话扫描派生。PiGui 只记自己的一层状态（软移除的项目 → 时间）。
 * 不存项目名 / 会话数 / 最近活动，那些每次都重算，免得和 pi 的会话文件脱节。
 */

/** 路径规范化只用于做 key：Windows 下盘符与分隔符写法不一，不统一会出现重复项目 */
const projectKey = (p: string): string => resolve(p).replace(/\\/g, '/').toLowerCase()

/** 会话目录名：照搬 pi 的编码（去掉开头分隔符，把 / \ : 换成 -），只用来跳过已移除的项目 */
const sessionDirName = (cwd: string): string =>
  ('--' + resolve(cwd).replace(/^[/\\]/, '').replace(/[/\\:]/g, '-') + '--').toLowerCase()

const projectsFile = (): string => join(process.env.PI_USER_DATA ?? tmpdir(), 'projects.json')

/** 已移除的项目：规范化路径 → 移除时的快照（路径 / 名 / 会话数 / 时间）。
 * 会话不再扫，所以行数据只能靠这份快照；恢复时再重扫拿真值。 */
interface RemovedProject {
  path: string
  name: string
  sessions: number
  at: number
}
let removed = new Map<string, RemovedProject>()

function loadProjects(): void {
  try {
    const raw = JSON.parse(readFileSync(projectsFile(), 'utf8')) as {
      // 旧版存的是时间戳，兼容一下
      removed?: Record<string, number | RemovedProject>
    }
    removed = new Map(
      Object.entries(raw.removed ?? {}).map(([key, v]) =>
        typeof v === 'number'
          ? [key, { path: key, name: basename(key), sessions: 0, at: v }]
          : [key, v]
      )
    )
  } catch {
    removed = new Map()
  }
}

function saveProjects(): void {
  try {
    writeFileSync(
      projectsFile(),
      JSON.stringify({ version: 2, removed: Object.fromEntries(removed) }, null, 2)
    )
  } catch (err) {
    console.error('[agent-host] 写 projects.json 失败', err)
  }
}

/** 扫描结果 + 覆盖层 → 项目行；已移除的用快照补上（它们已经不在扫描结果里了） */
function projectRows(list: readonly SessionInfo[]): ProjectRow[] {
  const rows = new Map<string, ProjectRow>()
  for (const info of list) {
    if (!info.cwd) continue
    const key = projectKey(info.cwd)
    const row = rows.get(key) ?? {
      path: info.cwd,
      // 盘符根目录的 basename 是空串（D:\），退回用原路径
      name: basename(info.cwd) || info.cwd,
      sessionCount: 0,
      lastActiveAt: 0
    }
    row.sessionCount++
    row.lastActiveAt = Math.max(row.lastActiveAt, info.modified.getTime())
    rows.set(key, row)
  }
  for (const [key, r] of removed) {
    if (rows.has(key)) continue
    rows.set(key, { path: r.path, name: r.name, sessionCount: r.sessions, lastActiveAt: r.at, removedAt: r.at })
  }
  return [...rows.values()].sort((a, b) => b.lastActiveAt - a.lastActiveAt)
}

/** 把一次扫描结果发给渲染层；partial 时列表还在增长，先发已扫到的 */
function publishSessions(list: readonly SessionInfo[], loading = false): void {
  const byProject = new Map<string, ProjectMeta>()
  const sessions: SessionMeta[] = []
  const hide = (p: string | undefined): boolean => !!p && removed.has(projectKey(p))
  for (const info of list) {
    // 已移除项目的会话整组不发给侧栏；文件一个都没动，恢复就回来
    if (hide(info.cwd)) continue
    const project = info.cwd ? basename(info.cwd) : '未分组'
    const meta: SessionMeta = {
      id: info.id,
      path: info.path,
      title: titleOf(info),
      project,
      ageLabel: ageLabel(info.modified),
      modifiedAt: info.modified.getTime(),
      // 后台会话也在跑，侧栏按会话标加载图标
      running: mounted.get(info.path)?.session.isStreaming === true
    }
    sessions.push(meta)
    // 按路径分组：不同目录可能同名（tmp / tmp），侧栏仍然只按名字展示
    const key = info.cwd ? projectKey(info.cwd) : ''
    const bucket = byProject.get(key) ?? { name: project, path: info.cwd ?? '', sessions: [] }
    bucket.sessions.push(meta)
    byProject.set(key, bucket)
  }
  const projects: ProjectMeta[] = [...byProject.values()]
  const rows = projectRows(list)
  // 工作区菜单 = 未移除的目录，当前目录排最前
  const workspaces = [
    ...new Set([cwd, ...rows.filter((r) => !r.removedAt).map((r) => r.path)])
  ].filter((p) => !hide(p))
  send({ type: 'sessions', sessions, projects, projectRows: rows, workspaces, models, loading, commands: commands() })
}

function removeProject(path: string): void {
  const key = projectKey(path)
  // 存移除时的快照：之后该项目不再扫描，行数据全靠它
  const mine = lastList.filter((i) => !!i.cwd && projectKey(i.cwd) === key)
  removed.set(key, {
    path,
    name: basename(path) || path,
    sessions: mine.length,
    at: Date.now()
  })
  saveProjects()
  lastList = lastList.filter((i) => !i.cwd || projectKey(i.cwd) !== key)
  publishSessions(lastList, scanning)
}

function restoreProject(path: string): void {
  if (!removed.delete(projectKey(path))) return
  saveProjects()
  // 恢复要把这个项目的会话扫回来，所以走一次重扫（其余项目已被 lastList 缓存）
  publishSessions(lastList, scanning)
  void emitSessions()
}

/** 真删：连同目录下所有会话文件。不可恢复，调用方必须先确认 */
async function deleteProject(path: string): Promise<void> {
  const key = projectKey(path)
  // 已移除的项目不在 lastList 里，所以直接按会话目录取文件；两边都取一遍防漏
  const dir = join(getAgentDir(), 'sessions', sessionDirName(path))
  const files = (await readdir(dir).catch(() => [] as string[]))
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(dir, f))
  const fromList = lastList.filter((i) => i.cwd && projectKey(i.cwd) === key).map((i) => i.path)
  for (const file of new Set([...files, ...fromList])) {
    const rec = mounted.get(file)
    if (rec) {
      mounted.delete(file)
      if (rec === current) current = null
      rec.detach()
      rec.session.dispose()
    }
    rmSync(file, { force: true })
  }
  lastList = lastList.filter((i) => !i.cwd || projectKey(i.cwd) !== key)
  removed.delete(key)
  saveProjects()
  // 删的可能是当前挂载的会话，没东西可看了就切个新的
  if (!current) await start()
  publishSessions(lastList, scanning)
}

/** 斜杠命令列表：只取扩展注册的命令，每次读最新的 runner */
function commands(): CommandInfo[] {
  const runner = current?.session.extensionRunner
  if (!runner) return []
  return runner.getRegisteredCommands().map((c) => ({ name: c.name, description: c.description }))
}

/** 重命名 / 删除只改内存里的扫描结果再重发，不重扫盘（约 850ms） */
async function renameSession(path: string, title: string): Promise<void> {
  const clean = title.trim()
  if (!clean) return
  // 只有挂载中的会话能直接用它的 manager，其余的单独打开才能写
  const manager = mounted.get(path)?.manager ?? SessionManager.open(path)
  manager.appendSessionInfo(clean)
  lastList = lastList.map((i) => (i.path === path ? { ...i, name: clean } : i))
  publishSessions(lastList, scanning)
}

async function deleteSession(path: string): Promise<void> {
  const rec = mounted.get(path)
  if (rec) {
    mounted.delete(path)
    if (rec === current) current = null
    rec.detach()
    rec.session.dispose()
  }
  lastList = lastList.filter((i) => i.path !== path)
  // 删的是当前挂载的会话：先切到新会话，免得删完没东西可看
  if (!current) await start()
  unlinkSync(path)
  publishSessions(lastList, scanning)
}

async function emitSessions(): Promise<void> {
  if (scanning) {
    scanAgain = true
    return
  }
  scanning = true
  // 上一批结果先顶上，免得重扫时侧栏一闪变空
  publishSessions(lastList, true)
  try {
    // 已移除的项目整个跳过：它们的会话不必再读 JSONL（每个会话要逐个头扫）
    const root = join(getAgentDir(), 'sessions')
    const skip = new Set([...removed.values()].map((r) => sessionDirName(r.path)))
    const dirs = (await readdir(root, { withFileTypes: true }).catch(() => []))
      .filter((d) => d.isDirectory() && !skip.has(d.name.toLowerCase()))
      .map((d) => join(root, d.name))
    // 当前目录排最前：进来先看到自己的会话，其余项目随后陆续填
    const mine = sessionDirName(cwd)
    dirs.sort((a, b) => Number(b.toLowerCase().endsWith(mine)) - Number(a.toLowerCase().endsWith(mine)))
    const all: SessionInfo[] = []
    for (const dir of dirs) {
      // pi 要逐个头读 JSONL 才能拿到首条消息，一个项目几十个会话就要上百 ms
      all.push(
        ...(await SessionManager.listAll(dir, (_loaded, _total, partial) => {
          if (partial?.length && !scanAgain) publishSessions([...all, ...partial], true)
        }))
      )
      if (scanAgain) break
      publishSessions(all, true)
    }
    // 扫描中途又被叫了一次（新会话刚落盘）：保留旧的全量，等下面重扫
    if (!scanAgain) {
      lastList = all
      publishSessions(all)
    }
  } finally {
    scanning = false
    if (scanAgain) {
      scanAgain = false
      void emitSessions()
    }
  }
}

/* ---------------- 会话 ---------------- */

async function loadModels(rec: Mounted): Promise<void> {
  models = (await rec.session.modelRuntime.getAvailable()).map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    levels: levelsOf(m)
  }))
}

/** 模型自己的思考强度映射表决定它到底支持哪几档，null 表示不支持 */
function levelsOf(model: { thinkingLevelMap?: Record<string, string | null>; reasoning?: boolean }): string[] {
  if (!model.reasoning) return ['off']
  const map = model.thinkingLevelMap
  if (!map) return Object.keys(LEVEL_LABEL)
  return Object.keys(LEVEL_LABEL).filter((k) => typeof map[k] === 'string')
}

/** 默认 loader 之外多挂一个权限门扩展；其余扩展、技能、模板照旧从 ~/.pi/agent 加载 */
async function createSession(manager: SessionManager, ui: UiBridge): Promise<Session> {
  const dir = manager.getCwd() || cwd
  const loader = new DefaultResourceLoader({
    cwd: dir,
    agentDir: getAgentDir(),
    extensionFactories: [{ name: 'pigui-permission-gate', factory: permissionGate(ui), hidden: true }]
  })
  await loader.reload()
  return (await createAgentSession({ sessionManager: manager, cwd: dir, resourceLoader: loader })).session
}

/** 建会话、订阅事件、挂 UI 桥；一个会话一份状态，切走不是 dispose */
async function mount(manager: SessionManager): Promise<Mounted> {
  const liveTools: string[] = []
  const ui = uiContextFor(liveTools)
  const created = await createSession(manager, ui)
  // 顺序执行：ui 请求不带 toolCallId，并行时 liveTools 栈顶会认错工具
  created.agent.toolExecution = 'sequential'
  const rec: Mounted = {
    session: created,
    manager,
    detach: () => {},
    cwd: manager.getCwd() || cwd,
    msgs: new Map(),
    order: [],
    sent: new Map(),
    sentOrder: [],
    forceFull: true,
    flushTimer: null,
    liveTools
  }
  rec.detach = created.subscribe((ev) => onEvent(rec, ev))
  // mode="rpc" 让扩展走可编程的 ui.* 路径而不是 TUI 渲染
  await created.bindExtensions({ uiContext: ui as never, mode: 'rpc' })
  mounted.set(manager.getSessionFile() ?? '', rec)
  return rec
}

/** 切到某个会话：后台那个不 dispose，继续跑；消息全量重发给渲染层 */
function activate(rec: Mounted): void {
  current = rec
  cwd = rec.cwd
  rec.forceFull = true
  flushNow(rec)
  status(rec.session.isStreaming)
}

/** 切走后空闲的会话不必留在内存里（切回来从磁盘重读）；还在跑/压缩的留着继续跑 */
function prune(): void {
  for (const [path, rec] of mounted) {
    if (rec === current || !rec.session.isIdle) continue
    mounted.delete(path)
    rec.detach()
    rec.session.dispose()
  }
}

async function start(cwdOverride?: string): Promise<void> {
  if (cwdOverride) cwd = cwdOverride
  const manager = SessionManager.create(cwd)
  const rec = await mount(manager)
  await loadModels(rec)
  activate(rec)
  // 会话列表不阻塞建会话：init 时就并行扫了；这里只把模型列表补给渲染层
  // scanning 时不能报 loading=false，否则会把正在用的搜索状态清掉
  publishSessions(lastList, scanning)
  prune()
}

async function open(path: string): Promise<void> {
  // 已经挂着的（比如刚切走的会话）直接恢复，不重读磁盘
  const existing = mounted.get(path)
  if (existing) {
    await loadModels(existing)
    activate(existing)
    publishSessions(lastList, scanning)
    prune()
    return
  }


  // 大会话（几十 MB / 上千条 entry）要几秒，先告诉渲染层进阻塞态
  send({ type: 'busy', active: true, label: '正在打开会话' })
  try {
    const manager = SessionManager.open(path)
    const rec = await mount(manager)
    // 历史直通：entry → 消息由 pi 官方转换（ADR-0014），宿主不再组装块
    for (const entry of manager.getEntries()) {
      for (const m of sessionEntryToContextMessages(entry)) upsert(rec, m)
    }
    await loadModels(rec)
    activate(rec)
    status(false)
  } finally {
    send({ type: 'busy', active: false })
  }
  prune()
}

function onEvent(rec: Mounted, ev: Record<string, any>): void {
  const live = rec === current
  switch (ev.type) {
    case 'message_start':
      // 消息开始：user / toolResult 一开始就是完整态，assistant 是空壳
      upsert(rec, ev.message)
      schedule(rec)
      break
    case 'message_update':
      // assistant 流式增量：整条 partial 消息原样换进来（ADR-0014：宿主不过滤内容），60ms 合并后推
      upsert(rec, ev.message)
      schedule(rec)
      break
    case 'message_end':
      // 单条消息定稿：立即推
      upsert(rec, ev.message)
      flushNow(rec)
      // 新会话这时才落盘，侧栏得补一次条目；已在列表里的不必每条消息都重扫
      if (ev.message?.role === 'user') {
        const path = rec.manager.getSessionFile()
        if (!lastList.some((i) => i.path === path)) setTimeout(() => void emitSessions(), 0)
      }
      break
    case 'tool_execution_start':
      // 工具开跑：只入 liveTools 栈（ui 请求认领用）；正文状态由 toolCall ↔ toolResult 消息推导
      rec.liveTools.push(ev.toolCallId)
      break
    case 'tool_execution_end': {
      // 工具结束：出栈；结果由随后的 toolResult 消息携带
      const at = rec.liveTools.lastIndexOf(ev.toolCallId)
      if (at >= 0) rec.liveTools.splice(at, 1)
      break
    }
    case 'thinking_level_changed':
      // 思考强度变了：刷新顶栏快照
      if (live) status(rec.session.isStreaming)
      break
    case 'agent_start':
      // 一轮开跑：顶栏进 streaming，侧栏标加载图标；时长由渲染层按消息时间戳算
      if (live) status(true)
      publishSessions(lastList, scanning)
      break
    case 'agent_settled': {
      // 整轮结束：最后一批消息落定；重扫列表（标题/顺序会变，新会话也是这时才落盘）
      flushNow(rec)
      if (live) status(false)
      // 路径让渲染层区分：不是正在看的会话就把未读点打上
      send({ type: 'settled', aborted: Boolean(ev.aborted), path: rec.manager.getSessionFile() ?? null })
      publishSessions(lastList, scanning)
      void emitSessions()
      break
    }
    case 'compaction_end':
      // 压缩完成：插一条合成通知消息；中止了不插（ADR-0014：非落盘事件不再有位置，压缩是保留的那个）
      if (!ev.aborted && ev.result) {
        const before = Math.round(Number(ev.result.tokensBefore ?? 0) / 1000)
        const after = Math.round(Number(ev.result.estimatedTokensAfter ?? 0) / 1000)
        notice(
          rec,
          after ? `上下文已压缩：${before}k → ${after}k tokens` : `上下文已压缩：${before}k tokens`
        )
        flushNow(rec)
      }
      break
  }
}

/* ---------------- 命令 ---------------- */

async function prompt(text: string, images?: Array<{ data: string; mimeType: string }>): Promise<void> {
  // 切换还在挂载时发的消息，等切完再落到目标会话，别写进上一个
  await switching
  const rec = current
  if (!rec) return
  try {
    // 用户消息不做本地乐观插入：session.prompt 会同步发 user 的 message 事件（日志实测同一 tick）
    await rec.session.prompt(
      text,
      images?.length ? { images: images.map((i) => ({ type: 'image' as const, ...i })) } : undefined
    )
  } catch (err) {
    notice(rec, String((err as Error)?.message ?? err), 'error')
    flushNow(rec)
  }
}

/** 撤销一次编辑：把 edit 工具给的 unified patch 反向应用（git apply 在非仓库目录也能用） */
async function revert(patch: string): Promise<void> {
  const file = join(tmpdir(), `pi-revert-${Date.now()}.patch`)
  writeFileSync(file, patch, 'utf8')
  try {
    await new Promise<void>((resolve, reject) => {
      execFile('git', ['apply', '-R', '--whitespace=nowarn', file], { cwd }, (err, _o, stderr) =>
        err ? reject(new Error(String(stderr || err.message).trim())) : resolve()
      )
    })
    if (current) notice(current, '已撤销这次修改')
  } catch (err) {
    console.error('[agent-host] revert failed', err)
    send({ type: 'error', message: `撤销失败：${(err as Error).message}` })
  } finally {
    rmSync(file, { force: true })
    if (current) flushNow(current)
  }
}

/** @ 提及：在 cwd 下按文件名模糊匹配，只扫两层，避开 node_modules */
async function listFiles(query: string): Promise<void> {
  const needle = query.toLowerCase()
  const out: string[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (out.length >= 40 || depth > 2) return
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      if (out.length >= 40) return
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'out') continue
      const path = join(dir, e.name)
      if (e.isDirectory()) await walk(path, depth + 1)
      else {
        const rel = relative(cwd, path).replace(/\\/g, '/')
        if (!needle || rel.toLowerCase().includes(needle)) out.push(rel)
      }
    }
  }
  await walk(cwd, 0)
  send({ type: 'files', items: out })
}

async function setModel(id: string): Promise<void> {
  const rec = current
  if (!rec) return
  const available = await rec.session.modelRuntime.getAvailable()
  const found = available.find((m) => m.id === id)
  if (!found) return
  await rec.session.setModel(found as Parameters<Session['setModel']>[0])
  await loadModels(rec)
  flushNow(rec)
  status(rec.session.isStreaming)
}

function setLevel(level: string): void {
  const rec = current
  if (!rec) return
  rec.session.setThinkingLevel(level as Parameters<Session['setThinkingLevel']>[0])
  status(rec.session.isStreaming)
  flushNow(rec)
}

async function handle(cmd: AgentCommand): Promise<void> {
  try {
    switch (cmd.type) {
      case 'init':
        loadProjects()
        // 扫会话列表要 ~850ms，和建会话并行，先用分批结果把侧栏填上
        void emitSessions()
        await start()
        break
      case 'prompt':
        await prompt(cmd.text, cmd.images)
        break
      case 'abort':
        await current?.session.abort()
        break
      case 'newSession':
        await switchTo(() => start())
        break
      // 换工作区就是在新目录下开一个会话；旧会话留在后台继续跑
      case 'workspace':
        await switchTo(() => start(cmd.path))
        break
      case 'projectRemove':
        removeProject(cmd.path)
        break
      case 'projectRestore':
        restoreProject(cmd.path)
        break
      case 'projectDelete':
        await deleteProject(cmd.path)
        break
      case 'openSession':
        await switchTo(() => open(cmd.path))
        break
      case 'renameSession':
        await renameSession(cmd.path, cmd.title)
        break
      case 'deleteSession':
        await deleteSession(cmd.path)
        break
      case 'revertEdit':
        await revert(cmd.patch)
        break
      case 'listFiles':
        await listFiles(cmd.query)
        break
      case 'setModel':
        await setModel(cmd.modelId)
        break
      case 'setThinkingLevel':
        setLevel(cmd.level)
        break
      case 'setAccess':
        access = cmd.mode
        status(current?.session.isStreaming ?? false)
        break
      case 'uiReply':
        settleUi(cmd.id, cmd.reply)
        break
    }
  } catch (err) {
    send({ type: 'error', message: String((err as Error)?.message ?? err) })
  }
}

port?.on('message', (m) => void handle(m.data))
