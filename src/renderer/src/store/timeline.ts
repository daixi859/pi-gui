/**
 * 消息 → 块 的派生（ADR-0014/0018）：宿主只搬运 pi 消息，转成什么样子在这里定。
 *
 * 形状由对话块库（agent-design/blocks）定：Block 五种、Turn 只有坐标与统计。
 * 折叠的呈现（哪些收进折叠、收起时留什么）不在数据里，全部由组件按 Turn 决定。
 * 流式中的 toolCall 参数还没解析完，画成 preparing 行。
 *
 * 派生结果按消息引用 memo：增量到达时未变的消息产出同引用块，行级 memo 继续生效。
 */
import type { PiMessage } from '@shared/ipc'
import type {
  AssistantBlock,
  AssistantStatus,
  Block,
  SystemBlock,
  ThinkingBlock,
  ToolBlock,
  ToolState,
  Turn,
  TurnActivity,
  UserBlock
} from 'agent-design/blocks'
import { liveReasoningDetail } from '../util'

type Assistant = Extract<PiMessage, { role: 'assistant' }>
type UserMessage = Extract<PiMessage, { role: 'user' }>
type ToolResult = Extract<PiMessage, { role: 'toolResult' }>

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((c: { type?: string; text?: string }) => (c.type === 'text' ? (c.text ?? '') : ''))
    .join('')
}

/** 工具参数预览：流式中（参数没解析完）给空串画 preparing；完整参数给 JSON 串，截断防大文件 */
function argsPreview(m: Assistant, args: unknown): string {
  if (m.stopReason === 'pending' || args === undefined || args === null) return ''
  const s = JSON.stringify(args) ?? ''
  return s.length > 2000 ? s.slice(0, 2000) + '…' : s
}

/** 用户消息里的图片：pi 给的是 base64 + mime，块里要可直接放进 <img src> 的地址 */
function imageSources(m: UserMessage): string[] {
  if (!Array.isArray(m.content)) return []
  return m.content.flatMap((c) =>
    c.type === 'image' && typeof c.data === 'string' && c.data !== ''
      ? [`data:${c.mimeType ?? 'image/png'};base64,${c.data}`]
      : []
  )
}

/** 错误摘要：工具失败时工具体只显示一行，完整输出仍在 output 里 */
function errorLine(text: string): string {
  const line = text.split('\n').find((s) => s.trim() !== '') ?? ''
  return line.length > 200 ? line.slice(0, 200) + '…' : line
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
  const status: AssistantStatus = streaming
    ? 'running'
    : m.stopReason === 'aborted'
      ? 'interrupted'
      : 'settled'
  // 流式尾巴只有一个块是「正在跑」的（照 deepseek-harness）：思考行只看自己是不是最后一个
  const last = m.content.length - 1
  m.content.forEach((c, i) => {
    if (c.type === 'thinking' && c.thinking) {
      const block: ThinkingBlock = {
        kind: 'thinking',
        id: `th-${m.timestamp}-${i}`,
        text: c.thinking,
        streaming: streaming && i === last,
        ts: m.timestamp
      }
      out.push(block)
    } else if (c.type === 'text' && c.text) {
      const block: AssistantBlock = {
        kind: 'assistant',
        id: `a-${m.timestamp}-${i}`,
        text: c.text,
        status,
        // 一条消息的最后一段文本、且不是因工具调用收尾，才是这段回答的答案
        final: !streaming && m.stopReason !== 'toolUse' && i === last,
        ts: m.timestamp
      }
      out.push(block)
    } else if (c.type === 'toolCall' && c.id) {
      const r = results.get(c.id)
      const output = r ? textOf(r.content) : ''
      const state: ToolState = r ? (r.isError ? 'error' : 'ok') : streaming ? 'preparing' : 'running'
      const block: ToolBlock = {
        kind: 'tool',
        id: `tc-${c.id}`,
        callId: c.id,
        name: c.name ?? 'tool',
        argsRaw: argsPreview(m, c.arguments),
        ...(c.arguments !== undefined && c.arguments !== null ? { args: c.arguments } : {}),
        state,
        ...(r ? { output: output.slice(0, 8000) || undefined, details: r.details } : {}),
        ...(r?.isError ? { error: { code: 'tool_error', message: errorLine(output) || '工具执行失败' } } : {}),
        ts: m.timestamp
      }
      out.push(block)
    }
  })
  return out
}

/** 一条消息贡献的行；toolResult 不单独出块（配对进工具行），system 是系统提示不进正文 */
function messageBlocks(m: PiMessage, results: Map<string, ToolResult>): Block[] {
  switch (m.role) {
    case 'user': {
      const images = imageSources(m)
      return memoBlocks(m, [], () => {
        const block: UserBlock = {
          kind: 'user',
          id: `u-${m.timestamp}`,
          text: textOf(m.content),
          images,
          ts: m.timestamp
        }
        return [block]
      })
    }
    case 'assistant':
      return memoBlocks(
        m,
        m.content.filter((c) => c.type === 'toolCall').map((c) => results.get(c.id)),
        () => assistantBlocks(m, results)
      )
    case 'bashExecution':
      return memoBlocks(m, [], () => {
        const block: ToolBlock = {
          kind: 'tool',
          id: `tc-bash-${m.timestamp}`,
          callId: `bash-${m.timestamp}`,
          name: 'bash',
          argsRaw: m.command ?? '',
          state: m.cancelled ? 'stopped' : m.exitCode ? 'error' : 'ok',
          output: (m.output ?? '').slice(0, 8000),
          ts: m.timestamp
        }
        return [block]
      })
    case 'custom':
      if (!m.display) return []
      return memoBlocks(m, [], () => {
        const block: SystemBlock = {
          kind: 'system',
          id: `s-${m.timestamp}`,
          tone: (m.details as { tone?: SystemBlock['tone'] } | undefined)?.tone ?? 'info',
          text: typeof m.content === 'string' ? m.content : textOf(m.content),
          ts: m.timestamp
        }
        return [block]
      })
    case 'compactionSummary':
      // 历史里的压缩记录与实时的合成通知（pigui-notice）同一副面孔
      return memoBlocks(m, [], () => {
        const block: SystemBlock = {
          kind: 'system',
          id: `s-${m.timestamp}`,
          tone: 'info',
          text: `上下文已压缩：${Math.round(Number(m.tokensBefore ?? 0) / 1000)}k tokens`,
          ts: m.timestamp
        }
        return [block]
      })
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
 * 结果虽都配对了，模型马上接着说（工具间隙），不算落定，否则头会闪断式收起又展开。
 * streaming 是宿主报的这一轮在跑：刚发出 user、回应还没到那一段也算活着，
 * 否则回合头会先闪一下「已完成，用时 不到 1 秒」。 */
function groupLive(g: Group, results: Map<string, ToolResult>, streaming: boolean): boolean {
  if (g.items.length === 0) return streaming
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

export interface Derived {
  turns: Turn[]
  byId: Record<string, Block>
  answerText: string
}

/** 工具参数抽一行摘要：command/path/pattern 优先，压空白截长 */
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
      return { kind: 'tool', ...(detail ? { detail } : {}) }
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
  return a.kind === b.kind && a.detail === b.detail
}

/** 值相等（含 blockIds 逐位）才算没变：live 段的走表不进派生，只有内容 / 活动真变了才换对象 */
function sameTurn(p: Turn, t: Turn): boolean {
  return (
    p.userId === t.userId &&
    p.status === t.status &&
    p.endedAt === t.endedAt &&
    p.startedAt === t.startedAt &&
    p.toolCount === t.toolCount &&
    p.errorCount === t.errorCount &&
    sameActivity(p.activity, t.activity) &&
    p.blockIds.length === t.blockIds.length &&
    p.blockIds.every((id, i) => id === t.blockIds[i])
  )
}

/** 上一次的回合索引：值没变的回合复用旧对象（含 blockIds 引用），回合容器 memo 才能命中 */
let prevTurns: Turn[] = []

/** 全量派生：平铺块按消息顺序产出，回合只给坐标。最后一段在流式 / 有工具没结果时算 live。
 * streaming 由调用方从 store 给：它决定「只有 user、回应未到」的那一段算不算 live。 */
export function deriveBlocks(
  order: string[],
  byId: Record<string, PiMessage>,
  streaming = false
): Derived {
  const groups = groupMessages(order, byId)
  const outById: Record<string, Block> = {}
  const turns: Turn[] = []
  let answerText = ''

  groups.forEach((g, gi) => {
    const results = new Map<string, ToolResult>()
    for (const m of g.items) if (m.role === 'toolResult') results.set(m.toolCallId, m)

    // user 气泡单独走（渲染在回合头之前），回合头之下只放回应过程
    const userBlock = g.user ? messageBlocks(g.user, results)[0] : undefined
    const items: Block[] = []
    for (const m of g.items) items.push(...messageBlocks(m, results))

    // 一条 user 都还没有、也没有可渲染的块（首条 user 之前的 system prompt 等）：不成回合，
    // 否则正文顶上会多出一个空回合头（「已完成，用时 0 秒」）
    if (!userBlock && items.length === 0) return

    if (userBlock) outById[userBlock.id] = userBlock
    for (const b of items) {
      outById[b.id] = b
      // 顺序遍历，最后一个 assistant 块即最终答案
      if (b.kind === 'assistant') answerText = b.text
    }

    const userTs = g.user ? g.user.timestamp : (g.items[0]?.timestamp ?? 0)
    const live = gi === groups.length - 1 && groupLive(g, results, streaming)
    // live 段不定格（走表归 UI 时钟），落定用末条消息 timestamp
    const endTs = live ? undefined : (g.items[g.items.length - 1]?.timestamp ?? userTs)
    const aborted = g.items.some((m) => m.role === 'assistant' && m.stopReason === 'aborted')
    const activity = live ? groupActivity(g, results) : undefined

    turns.push({
      key: `t-${userTs}`,
      userId: userBlock ? userBlock.id : null,
      blockIds: items.map((b) => b.id),
      status: live ? 'live' : aborted ? 'aborted' : 'settled',
      startedAt: userTs,
      ...(endTs !== undefined ? { endedAt: endTs } : {}),
      ...(activity ? { activity } : {}),
      toolCount: items.filter((b) => b.kind === 'tool').length,
      errorCount: items.filter((b) => (b.kind === 'tool' && b.state === 'error') || (b.kind === 'system' && b.tone === 'error')).length
    })
  })

  const prevByKey = new Map(prevTurns.map((t) => [t.key, t]))
  const stable = turns.map((t) => {
    const p = prevByKey.get(t.key)
    return p && sameTurn(p, t) ? p : t
  })
  prevTurns = stable
  return { turns: stable, byId: outById, answerText }
}
