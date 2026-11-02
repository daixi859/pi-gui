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
import { basename, join, relative } from 'node:path'
import { createAgentSession, DefaultResourceLoader, getAgentDir, SessionManager } from '@earendil-works/pi-coding-agent'
import type { ExtensionAPI, SessionInfo } from '@earendil-works/pi-coding-agent'
import type { AccessMode, AgentCommand, AgentEvent, CommandInfo, ModelOption, UiReply, UiRequest } from '@shared/ipc'
import type { Block, DiffLine, ProjectMeta, SessionMeta, Snapshot } from '@shared/blocks'

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

let session: Session | null = null
let detach: (() => void) | null = null
/** 当前会话的工作目录；默认进程 cwd，主进程可用 PI_AGENT_CWD 指定 */
let cwd = process.env.PI_AGENT_CWD || process.cwd()
let models: ModelOption[] = []
/** 工具执行前的确认策略；由渲染层的「变更前确认 / 完全访问」开关控制 */
let access: AccessMode = 'confirm'

/** 会改动磁盘或执行命令的工具，这些才需要用户点头 */
const RISKY = new Set(['write', 'edit', 'powershell', 'bash'])

/** 注入给 pi 的权限门：复用 ui 桥的 confirm，所以渲染层不用认识它 */
function permissionGate(pi: ExtensionAPI): void {
  pi.on('tool_call', async (event) => {
    if (access === 'full' || !RISKY.has(event.toolName)) return undefined
    const detail = JSON.stringify(event.input ?? {})
    const ok = await uiContext.confirm(
      `允许执行 ${event.toolName}？`,
      detail.length > 300 ? detail.slice(0, 300) + '…' : detail
    )
    return ok ? undefined : { block: true, reason: '用户拒绝了这次工具调用' }
  })
}

/** 上一轮已定稿的块、本轮尚未归档的块、本轮折叠行 */
let history: Block[] = []
/** 本轮全部块，按到达顺序；settled 时最后一条回答进正文，其余收进折叠行 */
let round: Block[] = []
let turn: Turn | null = null
let turnStart = 0
let seq = 0
let msgSeq = 0

const port = (process as unknown as { parentPort?: { postMessage(m: unknown): void; on(e: string, f: (m: { data: AgentCommand }) => void): void } }).parentPort
const send = (e: AgentEvent): void => port?.postMessage(e)

/** 已推给渲染层的块（按 id 存引用，引用变了就重发）+ 渲染层已有的顺序 */
let sent = new Map<string, { block: Block; rev: number }>()
let sentOrder: string[] = []
/** 增量比对用的版本号：块被原地修改时手动 bump */
const revs = new Map<string, number>()
let forceFull = false
const bump = (id: string): void => void revs.set(id, (revs.get(id) ?? 0) + 1)

/** 转瞬间的合并：流式文本每 60ms 推一次增量，避免渲染层重排风暴 */
let flushTimer: NodeJS.Timeout | null = null
function schedule(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushBlocks()
  }, 60)
}
function flushNow(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  flushBlocks()
}

/** 只推变了的块：顶层引用换了或被 bump 过。turn 自己带 children，整块重发 */
function flushBlocks(): void {
  const blocks = all()
  const order = blocks.map((b) => b.id)
  const items: Block[] = []
  for (const b of blocks) {
    const prev = sent.get(b.id)
    if (!prev || prev.block !== b || prev.rev !== (revs.get(b.id) ?? 0)) {
      items.push(b)
      sent.set(b.id, { block: b, rev: revs.get(b.id) ?? 0 })
    }
  }
  const orderChanged = order.length !== sentOrder.length || order.some((id, i) => id !== sentOrder[i])
  if (!items.length && !orderChanged && !forceFull) return
  if (orderChanged) {
    const live = new Set(order)
    for (const id of sent.keys()) if (!live.has(id)) sent.delete(id)
  }
  sentOrder = order
  send({ type: 'blocks', delta: { full: forceFull, order, items } })
  forceFull = false
}
function all(): Block[] {
  return turn ? [...history, ...round, turn] : [...history, ...round]
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
    model: session?.model?.name ?? '未选择模型',
    thinkingLevel: LEVEL_LABEL[session?.thinkingLevel ?? 'high'] ?? '高',
    cwd: basename(cwd),
    branch: branch(),
    access: access === 'full' ? '完全访问' : '变更前确认',
    accessFull: access === 'full'
  }
}

function status(streaming: boolean): void {
  send({ type: 'status', snapshot: snapshot(), streaming, path: session?.sessionFile ?? null })
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
/** 尚未结束的工具调用，栈顶即最近开始的那个 */
const liveTools: string[] = []
let uiSeq = 0

function ask(req: Omit<UiRequest, 'id' | 'toolCallId'>): Promise<UiReply> {
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
const uiContext = {
  async select(title: string, options: string[]) {
    const r = await ask({ kind: 'select', title, options })
    return r.cancelled ? undefined : r.value
  },
  async confirm(title: string, message: string) {
    return Boolean((await ask({ kind: 'confirm', title, message })).confirmed)
  },
  async input(title: string, placeholder?: string) {
    const r = await ask({ kind: 'input', title, placeholder })
    return r.cancelled ? undefined : r.value
  },
  async editor(title: string, prefill?: string) {
    const r = await ask({ kind: 'editor', title, prefill })
    return r.cancelled ? undefined : r.value
  },
  notify(message: string, type?: 'info' | 'warning' | 'error') {
    void ask({ kind: 'notify', message, notifyType: type })
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

/** 会话扫描可能重入（init 与 turn 结束都会触发），只跑一个 */
let scanning = false
/** 最近一次扫描结果，用于重发（模型列表变了但不必重扫盘） */
let lastList: readonly SessionInfo[] = []

/** 把一次扫描结果发给渲染层；partial 时列表还在增长，先发已扫到的 */
function publishSessions(list: readonly SessionInfo[], loading = false): void {
  const byProject = new Map<string, SessionMeta[]>()
  const sessions: SessionMeta[] = []
  for (const info of list) {
    const project = info.cwd ? basename(info.cwd) : '未分组'
    const meta: SessionMeta = {
      id: info.id,
      path: info.path,
      title: titleOf(info),
      project,
      ageLabel: ageLabel(info.modified),
      modifiedAt: info.modified.getTime()
    }
    sessions.push(meta)
    const bucket = byProject.get(project) ?? []
    bucket.push(meta)
    byProject.set(project, bucket)
  }
  const projects: ProjectMeta[] = [...byProject].map(([name, s]) => ({ name, sessions: s }))
  send({ type: 'sessions', sessions, projects, models, loading, commands: commands() })
}

/** 斜杠命令列表：只取扩展注册的命令，每次读最新的 runner */
function commands(): CommandInfo[] {
  const runner = session?.extensionRunner
  if (!runner) return []
  return runner.getRegisteredCommands().map((c) => ({ name: c.name, description: c.description }))
}

/** 重命名 / 删除只改内存里的扫描结果再重发，不重扫盘（约 850ms） */
async function renameSession(path: string, title: string): Promise<void> {
  const clean = title.trim()
  if (!clean) return
  // managerRef 只指向当前会话，其他会话要单独打开才能写
  const manager = managerRef?.getSessionFile() === path ? managerRef : SessionManager.open(path)
  manager.appendSessionInfo(clean)
  lastList = lastList.map((i) => (i.path === path ? { ...i, name: clean } : i))
  publishSessions(lastList, scanning)
}

async function deleteSession(path: string): Promise<void> {
  lastList = lastList.filter((i) => i.path !== path)
  // 删的是当前挂载的会话：先切到新会话，免得 dispose 后还往已删文件写
  if (session?.sessionFile === path) await start()
  unlinkSync(path)
  publishSessions(lastList, scanning)
}

async function emitSessions(): Promise<void> {
  if (scanning) return
  scanning = true
  // 上一批结果先顶上，免得重扫时侧栏一闪变空
  publishSessions(lastList, true)
  try {
    // pi 要逐个头读 JSONL 才能拿到首条消息，633 个会话要 ~850ms；分批先发已扫到的
    const list = await SessionManager.listAll((_loaded, _total, partial) => {
      if (partial?.length) publishSessions(partial, true)
    })
    lastList = list
    publishSessions(list)
  } finally {
    scanning = false
  }
}

/* ---------------- 会话 ---------------- */

/** 当前会话的 manager：重命名要往它的 JSONL 里追加 session_info */
let managerRef: SessionManager | null = null

async function loadModels(): Promise<void> {
  if (!session) return
  models = (await session.modelRuntime.getAvailable()).map((m) => ({
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

function bind(s: Session): void {
  detach?.()
  session = s
  detach = s.subscribe(onEvent)
}

function resetTranscript(): void {
  history = []
  round = []
  turn = null
  msgSeq = 0
  sent = new Map()
  sentOrder = []
  revs.clear()
  forceFull = true
}

/** 建会话后挂上 UI 桥；mode="rpc" 让扩展走可编程的 ui.* 路径而不是 TUI 渲染 */
async function adopt(s: Session): Promise<void> {
  bind(s)
  await s.bindExtensions({ uiContext: uiContext as never, mode: 'rpc' })
}

/** 默认 loader 之外多挂一个权限门扩展；其余扩展、技能、模板照旧从 ~/.pi/agent 加载 */
async function createSession(manager: SessionManager): Promise<Session> {
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir: getAgentDir(),
    extensionFactories: [{ name: 'pigui-permission-gate', factory: permissionGate, hidden: true }]
  })
  await loader.reload()
  return (await createAgentSession({ sessionManager: manager, cwd, resourceLoader: loader })).session
}

async function start(cwdOverride?: string): Promise<void> {
  detach?.()
  if (session) session.dispose()
  resetTranscript()
  if (cwdOverride) cwd = cwdOverride
  const manager = SessionManager.create(cwd)
  managerRef = manager
  const created = await createSession(manager)
  await adopt(created)
  await loadModels()
  flushNow()
  status(false)
  // 会话列表不阻塞建会话：init 时就并行扫了；这里只把模型列表补给渲染层
  // scanning 时不能报 loading=false，否则会把正在用的搜索状态清掉
  publishSessions(lastList, scanning)
}

async function open(path: string): Promise<void> {
  // 大会话（几十 MB / 上千条 entry）要几秒，先告诉渲染层进阻塞态
  send({ type: 'busy', active: true, label: '正在打开会话' })
  try {
    detach?.()
    if (session) session.dispose()
    resetTranscript()
    const manager = SessionManager.open(path)
    cwd = manager.getCwd() || cwd
    managerRef = manager
    const created = await createSession(manager)
    await adopt(created)
    await loadModels()
    history = blocksFromEntries(manager.getEntries())
    flushNow()
    status(false)
  } finally {
    send({ type: 'busy', active: false })
  }
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
  const users = items.filter((b) => b.kind === 'user')
  const rest = items.filter((b) => b.kind !== 'user')
  let last = -1
  rest.forEach((b, i) => {
    if (b.kind === 'assistant') last = i
  })
  const answer = last >= 0 ? rest.slice(last) : []
  const inner = last >= 0 ? rest.slice(0, last) : rest
  const wrapped: Block[] =
    inner.length > 0 ? [{ kind: 'turn', id: `t-${++seq}`, durationMs, children: inner }] : []
  return [...users, ...wrapped, ...answer]
}

/** 当前 assistant 消息渲染进 round：先清掉这条消息上一帧的块，再按顺序重新放 */
function syncMessage(partial: { content?: unknown[]; thinkingLevel?: string }, streaming: boolean): void {
  round = round.filter((b) => !b.id.startsWith(`m${msgSeq}-`))
  const level = LEVEL_LABEL[partial.thinkingLevel ?? ''] ?? undefined
  ;(partial.content ?? []).forEach((raw, i) => {
    const c = raw as { type: string; text?: string; thinking?: string }
    if (c.type === 'thinking' && c.thinking) {
      round.push({ kind: 'thinking', id: `m${msgSeq}-th${i}`, text: c.thinking, level, streaming })
    } else if (c.type === 'text' && c.text) {
      round.push({ kind: 'assistant', id: `m${msgSeq}-a${i}`, text: c.text, streaming })
    }
  })
}

/** 一轮结束：用户气泡与最后一条回答留在正文，其余过程收进折叠行（保持时间顺序） */
function settleRound(aborted: boolean): void {
  const items = settleInto(round).map((b) =>
    b.kind === 'turn' ? { ...b, durationMs: Date.now() - turnStart, aborted } : b
  )
  history = [...history, ...items]
  round = []
  turn = null
}

function onEvent(ev: Record<string, any>): void {
  switch (ev.type) {
    case 'message_start':
      if (ev.message?.role === 'assistant') msgSeq++
      break
    case 'message_update':
      if (ev.message?.role === 'assistant') {
        syncMessage(ev.message, ev.message.stopReason === 'pending')
        schedule()
      }
      break
    case 'message_end':
      if (ev.message?.role === 'assistant') {
        syncMessage(ev.message, false)
        flushNow()
      }
      break
    case 'tool_execution_start': {
      round.push({
        kind: 'tool',
        id: `tc-${ev.toolCallId}`,
        name: ev.toolName,
        args: preview(ev.args),
        state: 'running'
      })
      liveTools.push(ev.toolCallId)
      // 完整入参只发一次，交渲染层的交互适配器自行解释（宿主不解析工具参数）
      send({ type: 'toolStart', toolCallId: ev.toolCallId, name: ev.toolName, args: ev.args })
      flushNow()
      break
    }
    case 'tool_execution_end': {
      const at = liveTools.lastIndexOf(ev.toolCallId)
      if (at >= 0) liveTools.splice(at, 1)
      const block = round.find((b) => b.id === `tc-${ev.toolCallId}`) as Tool | undefined
      if (block) {
        block.state = ev.isError ? 'error' : 'done'
        block.output = textOf(ev.result?.content).slice(0, 8000) || preview(ev.result?.details)
        bump(block.id)
        const diff = ev.result?.details?.diff
        const patch = ev.result?.details?.patch
        if (typeof diff === 'string' && diff) {
          round.push({
            ...parseDiff(diff, String(ev.args?.path ?? ev.toolName)),
            patch: typeof patch === 'string' ? patch : undefined
          })
        }
        // read 成功时补一张文件卡，模型看到了什么用户也看得到
        if (ev.toolName === 'read' && !ev.isError) {
          const path = String(ev.args?.path ?? '')
          if (path) round.push(fileBlock(path, Number(ev.args?.limit ?? 0)))
        }
      }
      flushNow()
      break
    }
    case 'thinking_level_changed':
      status(session?.isStreaming ?? false)
      break
    case 'agent_start':
      turnStart = Date.now()
      status(true)
      flushNow()
      break
    case 'agent_settled': {
      settleRound(Boolean(ev.aborted))
      flushNow()
      status(false)
      send({ type: 'settled', aborted: Boolean(ev.aborted) })
      // 新会话这时才落盘，标题/顺序都会变
      void emitSessions()
      break
    }
    case 'compaction_start':
      break
    case 'compaction_end':
      if (!ev.aborted && ev.result) {
        const before = Math.round(Number(ev.result.tokensBefore ?? 0) / 1000)
        const after = Math.round(Number(ev.result.estimatedTokensAfter ?? 0) / 1000)
        round.push({
          kind: 'system',
          id: `s-${++seq}`,
          tone: 'info',
          text: after ? `上下文已压缩：${before}k → ${after}k tokens` : `上下文已压缩：${before}k tokens`
        })
      }
      break
    case 'auto_retry_start':
      round.push({
        kind: 'system',
        id: `s-${++seq}`,
        tone: 'warn',
        text: `请求失败，${Math.round(ev.delayMs / 1000)}s 后重试（${ev.attempt}/${ev.maxAttempts}）：${ev.errorMessage}`
      })
      flushNow()
      break
  }
}

/* ---------------- 命令 ---------------- */

async function prompt(text: string, images?: Array<{ data: string; mimeType: string }>): Promise<void> {
  if (!session) return
  round.push({
    kind: 'user',
    id: `u-${++seq}`,
    text,
    ...(images?.length ? { images: images.length } : {})
  })
  turnStart = Date.now()
  flushNow()
  try {
    await session.prompt(
      text,
      images?.length ? { images: images.map((i) => ({ type: 'image' as const, ...i })) } : undefined
    )
  } catch (err) {
    round.push({ kind: 'system', id: `s-${++seq}`, tone: 'error', text: String((err as Error)?.message ?? err) })
    flushNow()
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
    round.push({ kind: 'system', id: `s-${++seq}`, tone: 'info', text: '已撤销这次修改' })
  } catch (err) {
    console.error('[agent-host] revert failed', err)
    send({ type: 'error', message: `撤销失败：${(err as Error).message}` })
  } finally {
    rmSync(file, { force: true })
    flushNow()
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
  if (!session) return
  const available = await session.modelRuntime.getAvailable()
  const found = available.find((m) => m.id === id)
  if (!found) return
  await session.setModel(found as Parameters<Session['setModel']>[0])
  await loadModels()
  flushNow()
  status(session.isStreaming)
}

function setLevel(level: string): void {
  session?.setThinkingLevel(level as Parameters<Session['setThinkingLevel']>[0])
  status(session?.isStreaming ?? false)
  flushNow()
}

async function handle(cmd: AgentCommand): Promise<void> {
  try {
    switch (cmd.type) {
      case 'init':
        // 扫会话列表要 ~850ms，和建会话并行，先用分批结果把侧栏填上
        void emitSessions()
        await start()
        break
      case 'prompt':
        await prompt(cmd.text, cmd.images)
        break
      case 'abort':
        await session?.abort()
        break
      case 'newSession':
        await start()
        break
      case 'openSession':
        await open(cmd.path)
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
        status(false)
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
