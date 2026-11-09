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
import { createAgentSession, DefaultResourceLoader, getAgentDir, SessionManager } from '@earendil-works/pi-coding-agent'
import type { ExtensionAPI, SessionInfo } from '@earendil-works/pi-coding-agent'
import type {
  AccessMode,
  AgentCommand,
  AgentEvent,
  CommandInfo,
  ModelOption,
  TurnDelta,
  UiReply,
  UiRequest
} from '@shared/ipc'
import type { Block, DiffLine, ProjectMeta, ProjectRow, SessionMeta, Snapshot } from '@shared/blocks'

type Session = Awaited<ReturnType<typeof createAgentSession>>['session']
type Turn = Extract<Block, { kind: 'turn' }>
type Tool = Extract<Block, { kind: 'tool' }>

const LEVEL_LABEL: Record<string, string> = {
  off: '关闭',
  minimal: '最低',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '很高',
  max: '最高'
}

/** 一个会话在宿主里的全部状态：切走后原样留着，后台继续跑，切回来直接恢复 */
interface Mounted {
  session: Session
  manager: SessionManager
  detach: () => void
  cwd: string
  /** 上一轮已定稿的块、本轮尚未归档的块、本轮折叠行 */
  history: Block[]
  round: Block[]
  turn: Turn | null
  turnStart: number
  msgSeq: number
  /** 已推给渲染层的块（按 id 存引用，引用变了就重发）+ 渲染层已有的顺序 */
  sent: Map<string, { block: Block; rev: number }>
  sentOrder: string[]
  /** 增量比对用的版本号：块被原地修改时手动 bump */
  revs: Map<string, number>
  forceFull: boolean
  /** 流式文本每 60ms 推一次增量，避免渲染层重排风暴 */
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
let seq = 0

/** 会改动磁盘或执行命令的工具，这些才需要用户点头 */
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

const bump = (rec: Mounted, id: string): void => void rec.revs.set(id, (rec.revs.get(id) ?? 0) + 1)

function schedule(rec: Mounted): void {
  if (rec.flushTimer) return
  rec.flushTimer = setTimeout(() => {
    rec.flushTimer = null
    flushBlocks(rec)
  }, 60)
}
function flushNow(rec: Mounted): void {
  if (rec.flushTimer) {
    clearTimeout(rec.flushTimer)
    rec.flushTimer = null
  }
  flushBlocks(rec)
}

/**
 * 折叠行能否只推变化的部分。
 * 只有「子块按 id 一一对应（含末尾追加）」才能增量，否则返回 null 让调用方退回整块。
 * 省掉的是最常见的那种变化：每秒一次的 durationMs 与流式尾部那一条文本。
 */
function turnDelta(next: Turn, prev: Turn): TurnDelta | null {
  const sameLen = next.children.length === prev.children.length
  // 子块 id 逐个对应：允许内容变（流式尾部那条文本每帧都在变）
  const idsMatch = sameLen && prev.children.every((c, i) => c.id === next.children[i]?.id)
  // 末尾追加：前面的全部引用不变
  const grew =
    next.children.length > prev.children.length && prev.children.every((c, i) => c === next.children[i])
  if (!idsMatch && !grew) return null
  const items = idsMatch
    ? next.children.filter((c, i) => c !== prev.children[i])
    : next.children.slice(prev.children.length)
  // 什么都不变（连时长都没变）就不推
  if (!items.length && next.durationMs === prev.durationMs && next.aborted === prev.aborted) return null
  return {
    id: next.id,
    durationMs: next.durationMs,
    aborted: next.aborted,
    ...(grew ? { order: next.children.map((c) => c.id) } : {}),
    items
  }
}

/** 只推变了的块：顶层引用换了或被 bump 过；折叠行只推变了的子块 */
function flushBlocks(rec: Mounted): void {
  // 后台会话只维护自己的状态，不推给渲染层；切回来时 forceFull 一次补齐
  if (rec !== current) return
  const blocks = all(rec)
  const order = blocks.map((b) => b.id)
  const items: Block[] = []
  const turns: TurnDelta[] = []
  for (const b of blocks) {
    const prev = rec.sent.get(b.id)
    const rev = rec.revs.get(b.id) ?? 0
    const changed = !prev || prev.block !== b || prev.rev !== rev
    if (!changed) continue
    // 折叠行能算出差量就只发差量；否则走下面的整块
    if (!rec.forceFull && prev && prev.rev === rev && b.kind === 'turn' && prev.block.kind === 'turn') {
      const d = turnDelta(b, prev.block)
      if (d) {
        turns.push(d)
        rec.sent.set(b.id, { block: b, rev })
        continue
      }
    }
    // full 时渲染层会清空缓存，所以必须把全部块都带上，否则切回未变的会话会整页空白
    items.push(b)
    rec.sent.set(b.id, { block: b, rev })
  }
  const orderChanged =
    order.length !== rec.sentOrder.length || order.some((id, i) => id !== rec.sentOrder[i])
  if (!items.length && !turns.length && !orderChanged && !rec.forceFull) return
  if (orderChanged) {
    const live = new Set(order)
    for (const id of rec.sent.keys()) if (!live.has(id)) rec.sent.delete(id)
  }
  rec.sentOrder = order
  send({
    type: 'blocks',
    // 顺序没变就不带 order：渲染层沿用旧数组引用，列表本身一次都不重渲染
    delta: {
      full: rec.forceFull,
      ...(rec.forceFull || orderChanged ? { order } : {}),
      items,
      ...(turns.length ? { turns } : {})
    },
    path: rec.manager.getSessionFile() ?? null
  })
  rec.forceFull = false
}
function all(rec: Mounted): Block[] {
  return [...rec.history, ...liveBlocks(rec)]
}

/** 一组块拆成 [用户气泡, 过程块, 最后的回答]。回答只在回合确实以它收尾时才提到外面；
 * 回答后面还跟着工具时，它只是过程里的一句说明 */
function splitAnswer(items: Block[]): { users: Block[]; inner: Block[]; answer: Block[] } {
  const users = items.filter((b) => b.kind === 'user')
  const rest = items.filter((b) => b.kind !== 'user')
  let last = -1
  rest.forEach((b, i) => {
    if (b.kind === 'assistant') last = i
  })
  const tail = last >= 0 && last === rest.length - 1
  return { users, inner: tail ? rest.slice(0, -1) : rest, answer: tail ? [rest[last]] : [] }
}

/**
 * 流式中的回合：过程块收进 turn，最后一条回答提到外面——和结束态同一个形状。
 * 不这么做的话渲染层看到的是一排散块，既没有「进行中 · N 秒」，行距也会被撑开。
 */
function liveBlocks(rec: Mounted): Block[] {
  const { users, inner, answer } = splitAnswer(rec.round)
  if (!inner.length) {
    rec.turn = null
    return [...users, ...answer]
  }
  // 时长按秒取整：流式期间每秒才换一次引用，turn 不必逐帧重推
  const durationMs = Math.round((Date.now() - rec.turnStart) / 1000) * 1000
  const prev = rec.turn
  const same =
    prev !== null &&
    prev.durationMs === durationMs &&
    prev.children.length === inner.length &&
    prev.children.every((c, i) => c === inner[i])
  if (!same) rec.turn = { kind: 'turn', id: 't-live', durationMs, children: inner }
  return [...users, rec.turn as Turn, ...answer]
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((c: { type?: string; text?: string }) => (c.type === 'text' ? (c.text ?? '') : '')).join('')
}

function preview(args: unknown): string {
  const s = typeof args === 'string' ? args : JSON.stringify(args ?? {})
  return s.length > 160 ? s.slice(0, 160) + '…' : s
}

/** edit 工具输出的 diff 形如 "+  12 text"，转成 UI 的行模型 */
function parseDiff(diff: string, name: string): Extract<Block, { kind: 'diff' }> {
  const lines: DiffLine[] = []
  for (const raw of diff.split('\n')) {
    if (!raw) continue
    const sign = raw[0]
    if (sign !== '+' && sign !== '-' && sign !== ' ') continue
    const m = /^([+\- ])\s*(\d+)?\s?(.*)$/.exec(raw)
    if (!m) continue
    const no = m[2] ? Number(m[2]) : undefined
    if (m[3].trim() === '...') continue
    lines.push({ type: sign === '+' ? 'add' : sign === '-' ? 'del' : 'ctx', text: m[3], no })
  }
  return {
    kind: 'diff',
    id: `d-${++seq}`,
    file: name,
    added: lines.filter((l) => l.type === 'add').length,
    removed: lines.filter((l) => l.type === 'del').length,
    lines
  }
}

/** read 打开过的文件补一张卡，limit 只为给出“前 N 行”的提示 */
function fileBlock(path: string, limit: number): Block {
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toUpperCase() : '文件'
  return {
    kind: 'file',
    id: `f-${++seq}`,
    name,
    meta: limit ? `${ext} · 前 ${limit} 行` : ext,
    path
  }
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
  const rec: Mounted = {
    session: created,
    manager,
    detach: () => {},
    cwd: manager.getCwd() || cwd,
    history: [],
    round: [],
    turn: null,
    turnStart: 0,
    msgSeq: 0,
    sent: new Map(),
    sentOrder: [],
    revs: new Map(),
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

/** 切到某个会话：后台那个不 dispose，继续跑；块全量重发给渲染层 */
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
    rec.history = blocksFromEntries(manager.getEntries())
    await loadModels(rec)
    activate(rec)
    status(false)
  } finally {
    send({ type: 'busy', active: false })
  }
  prune()
}

/** 历史会话的 entry 流转成块：工具结果回填到对应的 tool 块上，折叠规则与实时流一致 */
function blocksFromEntries(entries: Array<{ type: string; timestamp?: string; message?: unknown }>): Block[] {
  const out: Block[] = []
  const tools = new Map<string, Tool>()
  /** toolCallId → 原始参数，补文件卡要拿完整 path（block.args 是截断过的预览） */
  const rawArgs = new Map<string, unknown>()
  let group: Block[] = []
  /** 这一组第一条 entry 的时间，用来算折叠行时长 */
  let groupStart = NaN
  /** 这一组最后一条 entry 的时间（不含下一条 user，否则会把思考间隔算进去） */
  let groupEnd = NaN
  for (const entry of entries) {
    if (entry.type !== 'message' || !entry.message) continue
    const ts = entry.timestamp ? Date.parse(entry.timestamp) : NaN
    if (Number.isFinite(ts)) groupEnd = ts
    const m = entry.message as {
      role: string
      content?: Array<{ type: string; text?: string; thinking?: string; id?: string; name?: string; arguments?: unknown }>
      thinkingLevel?: string
      toolCallId?: string
      isError?: boolean
      command?: string
      output?: string
      exitCode?: number | null
      cancelled?: boolean
    }
    if (m.role === 'user') {
      out.push(...settleInto(group, groupEnd - groupStart))
      groupStart = ts
      const imgs = Array.isArray(m.content) ? m.content.filter((c) => c.type === 'image').length : 0
      group = [
        {
          kind: 'user',
          id: `u-${++seq}`,
          text: textOf(m.content),
          ...(imgs ? { images: imgs } : {})
        }
      ]
    } else if (m.role === 'assistant') {
      const level = LEVEL_LABEL[m.thinkingLevel ?? ''] ?? undefined
      for (const c of m.content ?? []) {
        if (c.type === 'thinking' && c.thinking) {
          group.push({ kind: 'thinking', id: `th-${++seq}`, text: c.thinking, level })
        } else if (c.type === 'text' && c.text) {
          group.push({ kind: 'assistant', id: `a-${++seq}`, text: c.text })
        } else if (c.type === 'toolCall' && c.id) {
          const block: Tool = {
            kind: 'tool',
            id: `tc-${c.id}`,
            name: c.name ?? 'tool',
            args: preview(c.arguments),
            state: 'running'
          }
          tools.set(c.id, block)
          rawArgs.set(c.id, c.arguments)
          group.push(block)
        }
      }
    } else if (m.role === 'toolResult' && m.toolCallId) {
      const block = tools.get(m.toolCallId)
      if (block) {
        block.state = m.isError ? 'error' : 'done'
        block.output = textOf(m.content).slice(0, 8000)
        // 历史会话里的 read 也补一张文件卡，和实时流一致
        if (block.name === 'read' && !m.isError) {
          const raw = rawArgs.get(m.toolCallId) as { path?: unknown } | string | undefined
          const p =
            typeof raw === 'string' ? /"path":"([^"]+)"/.exec(raw)?.[1] : String(raw?.path ?? '')
          if (p) group.push(fileBlock(p, 0))
        }
      }
    } else if (m.role === 'bashExecution') {
      group.push({
        kind: 'tool',
        id: `tc-bash-${++seq}`,
        name: 'bash',
        args: m.command ?? '',
        state: m.cancelled || m.exitCode ? 'error' : 'done',
        output: (m.output ?? '').slice(0, 8000)
      })
    }
  }
  return [...out, ...settleInto(group, groupEnd - groupStart)]
}

/** 一组块折成 [用户气泡, 折叠行, 最后一条回答]，不碰全局状态 */
function settleInto(items: Block[], durationMs = 0): Block[] {
  const { users, inner, answer } = splitAnswer(items)
  const wrapped: Block[] =
    inner.length > 0 ? [{ kind: 'turn', id: `t-${++seq}`, durationMs, children: inner }] : []
  return [...users, ...wrapped, ...answer]
}

/** 当前 assistant 消息渲染进 round：先清掉这条消息上一帧的块，再按顺序重新放 */
function syncMessage(rec: Mounted, partial: { content?: unknown[]; thinkingLevel?: string }, streaming: boolean): void {
  rec.round = rec.round.filter((b) => !b.id.startsWith(`m${rec.msgSeq}-`))
  const level = LEVEL_LABEL[partial.thinkingLevel ?? ''] ?? undefined
  ;(partial.content ?? []).forEach((raw, i) => {
    const c = raw as { type: string; text?: string; thinking?: string }
    if (c.type === 'thinking' && c.thinking) {
      rec.round.push({ kind: 'thinking', id: `m${rec.msgSeq}-th${i}`, text: c.thinking, level, streaming })
    } else if (c.type === 'text' && c.text) {
      rec.round.push({ kind: 'assistant', id: `m${rec.msgSeq}-a${i}`, text: c.text, streaming })
    }
  })
}

/** 一轮结束：用户气泡与最后一条回答留在正文，其余过程收进折叠行（保持时间顺序） */
function settleRound(rec: Mounted, aborted: boolean): void {
  // 结算必须换成新 id：`t-live` 只属于正在跑的回合。历史里若留着同 id 的 turn，
  // 渲染层按 id 缓存，下一轮 order 里同一 id 出现两次，正文就会画出两份「进行中」
  const items = settleInto(rec.round, Date.now() - rec.turnStart).map((b) =>
    b.kind === 'turn' ? { ...b, aborted } : b
  )
  rec.history = [...rec.history, ...items]
  rec.round = []
  rec.turn = null
}

function onEvent(rec: Mounted, ev: Record<string, any>): void {
  const live = rec === current
  switch (ev.type) {
    case 'message_start':
      if (ev.message?.role === 'assistant') rec.msgSeq++
      break
    case 'message_update':
      if (ev.message?.role === 'assistant') {
        syncMessage(rec, ev.message, ev.message.stopReason === 'pending')
        schedule(rec)
      }
      break
    case 'message_end':
      if (ev.message?.role === 'assistant') {
        syncMessage(rec, ev.message, false)
        flushNow(rec)
      }
      // 新会话这时才落盘，侧栏得补一次条目；已在列表里的不必每条消息都重扫
      if (ev.message?.role === 'user') {
        const path = rec.manager.getSessionFile()
        if (!lastList.some((i) => i.path === path)) setTimeout(() => void emitSessions(), 0)
      }
      break
    case 'tool_execution_start': {
      rec.round.push({
        kind: 'tool',
        id: `tc-${ev.toolCallId}`,
        name: ev.toolName,
        args: preview(ev.args),
        state: 'running'
      })
      rec.liveTools.push(ev.toolCallId)
      // 完整入参只发一次，交渲染层的交互适配器自行解释（宿主不解析工具参数）
      send({ type: 'toolStart', toolCallId: ev.toolCallId, name: ev.toolName, args: ev.args })
      flushNow(rec)
      break
    }
    case 'tool_execution_end': {
      const at = rec.liveTools.lastIndexOf(ev.toolCallId)
      if (at >= 0) rec.liveTools.splice(at, 1)
      const block = rec.round.find((b) => b.id === `tc-${ev.toolCallId}`) as Tool | undefined
      if (block) {
        block.state = ev.isError ? 'error' : 'done'
        block.output = textOf(ev.result?.content).slice(0, 8000) || preview(ev.result?.details)
        bump(rec, block.id)
        const diff = ev.result?.details?.diff
        const patch = ev.result?.details?.patch
        if (typeof diff === 'string' && diff) {
          rec.round.push({
            ...parseDiff(diff, String(ev.args?.path ?? ev.toolName)),
            patch: typeof patch === 'string' ? patch : undefined
          })
        }
        // read 成功时补一张文件卡，模型看到了什么用户也看得到
        if (ev.toolName === 'read' && !ev.isError) {
          const path = String(ev.args?.path ?? '')
          if (path) rec.round.push(fileBlock(path, Number(ev.args?.limit ?? 0)))
        }
      }
      flushNow(rec)
      break
    }
    case 'thinking_level_changed':
      if (live) status(rec.session.isStreaming)
      break
    case 'agent_start':
      rec.turnStart = Date.now()
      if (live) status(true)
      // 后台会话开跑也要让侧栏标上加载图标
      publishSessions(lastList, scanning)
      break
    case 'agent_settled': {
      settleRound(rec, Boolean(ev.aborted))
      flushNow(rec)
      if (live) status(false)
      // 路径让渲染层区分：不是正在看的会话就把未读点打上
      send({ type: 'settled', aborted: Boolean(ev.aborted), path: rec.manager.getSessionFile() ?? null })
      publishSessions(lastList, scanning)
      // 标题/顺序会变（新会话也是这时才落盘）
      void emitSessions()
      break
    }
    case 'compaction_start':
      break
    case 'compaction_end':
      if (!ev.aborted && ev.result) {
        const before = Math.round(Number(ev.result.tokensBefore ?? 0) / 1000)
        const after = Math.round(Number(ev.result.estimatedTokensAfter ?? 0) / 1000)
        rec.round.push({
          kind: 'system',
          id: `s-${++seq}`,
          tone: 'info',
          text: after ? `上下文已压缩：${before}k → ${after}k tokens` : `上下文已压缩：${before}k tokens`
        })
      }
      break
    case 'auto_retry_start':
      rec.round.push({
        kind: 'system',
        id: `s-${++seq}`,
        tone: 'warn',
        text: `请求失败，${Math.round(ev.delayMs / 1000)}s 后重试（${ev.attempt}/${ev.maxAttempts}）：${ev.errorMessage}`
      })
      flushNow(rec)
      break
  }
}

/* ---------------- 命令 ---------------- */

async function prompt(text: string, images?: Array<{ data: string; mimeType: string }>): Promise<void> {
  // 切换还在挂载时发的消息，等切完再落到目标会话，别写进上一个
  await switching
  const rec = current
  if (!rec) return
  rec.round.push({
    kind: 'user',
    id: `u-${++seq}`,
    text,
    ...(images?.length ? { images: images.length } : {})
  })
  rec.turnStart = Date.now()
  flushNow(rec)
  try {
    await rec.session.prompt(
      text,
      images?.length ? { images: images.map((i) => ({ type: 'image' as const, ...i })) } : undefined
    )
  } catch (err) {
    rec.round.push({ kind: 'system', id: `s-${++seq}`, tone: 'error', text: String((err as Error)?.message ?? err) })
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
    const rec = current
    rec?.round.push({ kind: 'system', id: `s-${++seq}`, tone: 'info', text: '已撤销这次修改' })
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
