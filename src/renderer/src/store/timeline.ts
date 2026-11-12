/**
 * 消息 → Block 的派生（ADR-0014/0015）：宿主只搬运 pi 消息，转成什么样子在这里定。
 * 产出是平铺块 + 回合段坐标（TurnSpan）：tool 状态配对、diff 从消息推导，
 * 折叠的呈现（哪些收进折叠、收起时留什么）不在数据里，全部由组件按段坐标决定。
 * 流式中的 toolCall 只有名字（参数要等 message_end 才解析完），画成 pending 行。
 *
 * 派生结果按消息引用 memo：增量到达时未变的消息产出同引用块，行级 memo 继续生效。
 */
import type { PiMessage } from '@shared/ipc'
import { LEVEL_LABEL, type Block, type DiffBlock, type DiffLine, type SystemTone } from '@shared/blocks'
import { liveReasoningDetail } from '../util'

type Assistant = Extract<PiMessage, { role: 'assistant' }>
type ToolResult = Extract<PiMessage, { role: 'toolResult' }>

let seq = 0

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((c: { type?: string; text?: string }) => (c.type === 'text' ? (c.text ?? '') : '')).join('')
}

/** 工具参数预览：流式中（参数没解析完）给空串画 pending；完整参数给 JSON 串，截断防大文件 */
function argsPreview(m: Assistant, args: unknown): string {
  if (m.stopReason === 'pending' || args === undefined || args === null) return ''
  const s = JSON.stringify(args) ?? ''
  return s.length > 2000 ? s.slice(0, 2000) + '…' : s
}

/** edit 工具输出的 diff 形如 "+  12 text"，转成 UI 的行模型 */
function parseDiff(diff: string, name: string): DiffBlock {
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
    id: `d-${++seq}`,
    file: name,
    added: lines.filter((l) => l.type === 'add').length,
    removed: lines.filter((l) => l.type === 'del').length,
    lines
  }
}

/* ---------------- 按消息 memo ----------------
 * assistant 的派生依赖它的 toolCall 配对结果（结果到达换引用才重派生），
 * 其余消息自包含，deps 为空。 */

interface Memo {
  deps: unknown[]
  blocks: Block[]
}
const memo = new WeakMap<object, Memo>()

function memoBlocks(key: object, deps: unknown[], make: () => Block[]): Block[] {
  const hit = memo.get(key)
  if (hit && hit.deps.length === deps.length && hit.deps.every((d, i) => d === deps[i])) return hit.blocks
  const blocks = make()
  memo.set(key, { deps: [...deps], blocks })
  return blocks
}

function assistantBlocks(m: Assistant, results: Map<string, ToolResult>): Block[] {
  const out: Block[] = []
  const streaming = m.stopReason === 'pending'
  const level = LEVEL_LABEL[m.thinkingLevel ?? ''] ?? undefined
  // 流式尾巴只有一个块是「正在跑」的（照 deepseek-harness）：思考行只看自己是不是最后一个
  const last = m.content.length - 1
  m.content.forEach((c, i) => {
    if (c.type === 'thinking' && c.thinking) {
      out.push({
        kind: 'thinking',
        id: `th-${m.timestamp}-${i}`,
        text: c.thinking,
        level,
        streaming: streaming && i === last
      })
    } else if (c.type === 'text' && c.text) {
      out.push({ kind: 'assistant', id: `a-${m.timestamp}-${i}`, text: c.text, streaming })
    } else if (c.type === 'toolCall' && c.id) {
      const r = results.get(c.id)
      const details = r?.details as { diff?: unknown; patch?: unknown } | undefined
      const args = c.arguments as { path?: unknown } | undefined
      const d =
        r && typeof details?.diff === 'string' && details.diff
          ? {
              ...parseDiff(details.diff, String(args?.path ?? c.name)),
              patch: typeof details.patch === 'string' ? details.patch : undefined
            }
          : undefined
      out.push({
        kind: 'tool',
        id: `tc-${c.id}`,
        name: c.name ?? 'tool',
        args: argsPreview(m, c.arguments),
        state: r ? (r.isError ? 'error' : 'done') : 'running',
        ...(r ? { output: textOf(r.content).slice(0, 8000) || undefined } : {}),
        // diff 属于它的工具行，派生时直接并进来
        ...(d ? { diff: d } : {})
      })
    }
  })
  return out
}

/** 一条消息贡献的行；toolResult 不单独出块（配对进工具行），system 是系统提示不进正文 */
function messageBlocks(m: PiMessage, results: Map<string, ToolResult>): Block[] {
  switch (m.role) {
    case 'user': {
      const imgs = Array.isArray(m.content) ? m.content.filter((c) => c.type === 'image').length : 0
      return memoBlocks(m, [], () => [
        {
          kind: 'user',
          id: `u-${m.timestamp}`,
          text: textOf(m.content),
          ...(imgs ? { images: imgs } : {})
        }
      ])
    }
    case 'assistant':
      return memoBlocks(
        m,
        m.content.filter((c) => c.type === 'toolCall').map((c) => results.get(c.id)),
        () => assistantBlocks(m, results)
      )
    case 'bashExecution':
      return memoBlocks(m, [], () => [
        {
          kind: 'tool',
          id: `tc-bash-${m.timestamp}`,
          name: 'bash',
          args: m.command ?? '',
          state: m.cancelled || m.exitCode ? 'error' : 'done',
          output: (m.output ?? '').slice(0, 8000)
        }
      ])
    case 'custom':
      if (!m.display) return []
      return memoBlocks(m, [], () => [
        {
          kind: 'system',
          id: `s-${m.timestamp}`,
          tone: ((m.details as { tone?: SystemTone } | undefined)?.tone ?? 'info'),
          text: typeof m.content === 'string' ? m.content : textOf(m.content)
        }
      ])
    case 'compactionSummary':
      // 历史里的压缩记录与实时的合成通知（pigui-notice）同一副面孔
      return memoBlocks(m, [], () => [
        {
          kind: 'system',
          id: `s-${m.timestamp}`,
          tone: 'info',
          text: `上下文已压缩：${Math.round(Number(m.tokensBefore ?? 0) / 1000)}k tokens`
        }
      ])
    default:
      return []
  }
}

/* ---------------- 回合分段与总装配 ---------------- */

interface Group {
  user: PiMessage | null
  items: PiMessage[]
}

/** user 消息开一段；首条 user 之前的散件（压缩通知等）自成一段 */
function groupMessages(order: string[], byId: Record<string, PiMessage>): Group[] {
  const groups: Group[] = []
  let cur: Group = { user: null, items: [] }
  for (const k of order) {
    const m = byId[k]
    if (!m) continue
    if (m.role === 'user') {
      if (cur.user || cur.items.length) groups.push(cur)
      cur = { user: m, items: [] }
    } else {
      cur.items.push(m)
    }
  }
  if (cur.user || cur.items.length) groups.push(cur)
  return groups
}

/** 回合还活着吗：消息在流式、有工具没结果，或末条 assistant 因工具收尾——
 * 结果虽都配对了，模型马上接着说（工具间隙），不算落定，否则头会闪断式收起又展开 */
function groupLive(g: Group, results: Map<string, ToolResult>): boolean {
  for (let i = g.items.length - 1; i >= 0; i--) {
    const m = g.items[i]
    if (m.role !== 'assistant') continue
    if (m.stopReason === 'pending' || m.stopReason === 'toolUse') return true
    break // 只看末条 assistant 的终态（stop/length/error/aborted = 落定）
  }
  for (const m of g.items) {
    if (m.role !== 'assistant') continue
    for (const c of m.content) {
      if (c.type === 'toolCall' && !results.has(c.id)) return true
    }
  }
  return false
}

/** live 段此刻在干什么：工具优先（带参数摘要），其次流式思考 / 回复 */
export interface TurnActivity {
  kind: 'thinking' | 'replying' | 'tool'
  /** kind === 'tool' 时的工具名 */
  toolName?: string
  /** 一行任务摘要（command/path/pattern… 截断；参数没流完时缺省） */
  detail?: string
}

/** 一个回合的段坐标：只记范围与统计，不嵌套块。折叠与否、收起时留什么由组件决定 */
export interface TurnSpan {
  /** `t-${user 消息 timestamp}`：live 到落定不变，折叠记忆也按它存 */
  key: string
  /** user 气泡块 id，渲染在段头之前；首条 user 之前的散件组没有 */
  userId?: string
  /** 段头之后的全部块（过程、中间文本、答案），顺序即渲染顺序 */
  ids: string[]
  /** 回合起点；live 走表（UI 时钟）与落定时长（durationMs）都从它算 */
  startedAt: number
  /** 落定后的总时长；live 段恒 0（走表不靠派生刷新，交给组件里的时钟） */
  durationMs: number
  /** 过程块数（thinking/tool/diff/file/system），> 0 才有折叠按钮 */
  stepCount: number
  /** 文本块数（中间文本 + 答案），> 1 且无过程块才有纯时长行 */
  noteCount: number
  toolCount: number
  /** 已收到 isError 的工具数；折叠时也不能吞掉失败 */
  errorCount: number
  live: boolean
  /** live 段当前活动；落定后无 */
  activity?: TurnActivity
  aborted: boolean
}

export interface Derived {
  turns: TurnSpan[]
  byId: Record<string, Block>
  answerText: string
}

/** 上一次的段索引：值没变的段复用旧对象（含 ids 引用），段容器 memo 才能命中 */
let prevTurns: TurnSpan[] = []

/** 工具参数抽一行摘要：command/path/pattern 优先，压空白截长。mock 假流也用它 */
export function argDetail(args: Record<string, unknown> | undefined): string | undefined {
  if (!args) return undefined
  for (const key of ['command', 'path', 'pattern', 'query', 'url']) {
    const v = args[key]
    if (typeof v !== 'string' || !v) continue
    const s = v.replace(/\s+/g, ' ').trim()
    return s.length > 80 ? s.slice(0, 80) + '…' : s
  }
  return undefined
}

/** live 段此刻在干什么：只看末条 assistant——顺序执行下它未配对的调用即当前活动。
 * 参数要等 message_end 才完整（ADR-0014），没流完就不带摘要（「正在调用 X…」）；
 * 调用都收尾了说明模型在准备下一步，显示思考中。不回溯旧消息，避免间隙闪回过期活动 */
function groupActivity(g: Group, results: Map<string, ToolResult>): TurnActivity {
  for (let i = g.items.length - 1; i >= 0; i--) {
    const m = g.items[i]
    if (m.role !== 'assistant') continue
    let call: { name?: string; args: unknown } | null = null
    for (const c of m.content) {
      if (c.type === 'toolCall' && !results.has(c.id)) call = { name: c.name, args: c.arguments }
    }
    if (call) {
      const detail =
        m.stopReason === 'pending' ? undefined : argDetail(call.args as Record<string, unknown> | undefined)
      return { kind: 'tool', toolName: call.name ?? 'tool', ...(detail ? { detail } : {}) }
    }
    if (m.stopReason === 'pending') {
      const last = [...m.content].reverse().find((c) => c.type === 'thinking' || c.type === 'text')
      if (last?.type !== 'thinking') return { kind: 'replying' }
      // 分组头报「此刻正在写的那一段」，与思考行自己的「已完成段落首行」刻意不同（照 deepseek-harness）
      const detail = liveReasoningDetail(last.thinking ?? '')
      return { kind: 'thinking', ...(detail ? { detail } : {}) }
    }
    return { kind: 'thinking' }
  }
  return { kind: 'thinking' }
}

function sameActivity(a: TurnActivity | undefined, b: TurnActivity | undefined): boolean {
  if (!a || !b) return a === b
  return a.kind === b.kind && a.toolName === b.toolName && a.detail === b.detail
}

/** 值相等（含 ids 逐位）才算没变：live 段的走表不进派生，只有内容 / 活动真变了才换对象 */
function sameSpan(p: TurnSpan, t: TurnSpan): boolean {
  return (
    p.userId === t.userId &&
    p.live === t.live &&
    p.aborted === t.aborted &&
    p.durationMs === t.durationMs &&
    p.stepCount === t.stepCount &&
    p.noteCount === t.noteCount &&
    p.toolCount === t.toolCount &&
    p.errorCount === t.errorCount &&
    sameActivity(p.activity, t.activity) &&
    p.ids.length === t.ids.length &&
    p.ids.every((id, i) => id === t.ids[i])
  )
}

/** 全量派生：平铺块按消息顺序产出，回合只给段坐标。最后一段在流式 / 有工具没结果时算 live */
export function deriveBlocks(order: string[], byId: Record<string, PiMessage>): Derived {
  const groups = groupMessages(order, byId)
  const outById: Record<string, Block> = {}
  const turns: TurnSpan[] = []
  let answerText = ''

  groups.forEach((g, gi) => {
    const results = new Map<string, ToolResult>()
    for (const m of g.items) if (m.role === 'toolResult') results.set(m.toolCallId, m)

    // user 气泡单独走（渲染在段头之前），段头之下只放回应过程
    const userBlock = g.user ? messageBlocks(g.user, results)[0] : undefined
    const items: Block[] = []
    for (const m of g.items) items.push(...messageBlocks(m, results))

    if (userBlock) outById[userBlock.id] = userBlock
    for (const b of items) {
      outById[b.id] = b
      // 顺序遍历，最后一个 assistant 块即最终答案
      if (b.kind === 'assistant') answerText = b.text
    }

    const userTs = g.user ? g.user.timestamp : (g.items[0]?.timestamp ?? 0)
    const live = gi === groups.length - 1 && groupLive(g, results)
    // live 段不算时长（走表归 UI 时钟），落定用末条消息 timestamp 定格
    const endTs = live ? userTs : (g.items[g.items.length - 1]?.timestamp ?? userTs)
    turns.push({
      key: `t-${userTs}`,
      ...(userBlock ? { userId: userBlock.id } : {}),
      ids: items.map((b) => b.id),
      startedAt: userTs,
      durationMs: Math.max(0, endTs - userTs),
      stepCount: items.filter((b) => b.kind !== 'assistant').length,
      noteCount: items.filter((b) => b.kind === 'assistant').length,
      toolCount: items.filter((b) => b.kind === 'tool').length,
      errorCount: items.filter((b) => (b.kind === 'tool' && b.state === 'error') || (b.kind === 'system' && b.tone === 'error')).length,
      live,
      ...(live ? { activity: groupActivity(g, results) } : {}),
      aborted: g.items.some((m) => m.role === 'assistant' && m.stopReason === 'aborted')
    })
  })

  const prevByKey = new Map(prevTurns.map((t) => [t.key, t]))
  const stable = turns.map((t) => {
    const p = prevByKey.get(t.key)
    return p && sameSpan(p, t) ? p : t
  })
  prevTurns = stable
  return { turns: stable, byId: outById, answerText }
}
