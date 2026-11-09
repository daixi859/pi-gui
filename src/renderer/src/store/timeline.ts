/**
 * 消息 → Block 的派生（ADR-0014）：宿主只搬运 pi 消息，转成什么样子在这里定。
 * turn 折叠、tool 状态配对、diff / 文件卡全部从消息推导；
 * 流式中的 toolCall 只有名字（参数要等 message_end 才解析完），画成 pending 行。
 *
 * 派生结果按消息引用 memo：增量到达时未变的消息产出同引用块，行级 memo 继续生效。
 */
import type { PiMessage } from '@shared/ipc'
import { LEVEL_LABEL, type Block, type DiffLine, type SystemTone } from '@shared/blocks'

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
  const name = path.split(/[\\/]/).pop() || path
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toUpperCase() : '文件'
  return {
    kind: 'file',
    id: `f-${++seq}-${name}`,
    name,
    meta: limit ? `${ext} · 前 ${limit} 行` : ext,
    path
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
  m.content.forEach((c, i) => {
    if (c.type === 'thinking' && c.thinking) {
      out.push({ kind: 'thinking', id: `th-${m.timestamp}-${i}`, text: c.thinking, level, streaming })
    } else if (c.type === 'text' && c.text) {
      out.push({ kind: 'assistant', id: `a-${m.timestamp}-${i}`, text: c.text, streaming })
    } else if (c.type === 'toolCall' && c.id) {
      const r = results.get(c.id)
      out.push({
        kind: 'tool',
        id: `tc-${c.id}`,
        name: c.name ?? 'tool',
        args: argsPreview(m, c.arguments),
        state: r ? (r.isError ? 'error' : 'done') : 'running',
        ...(r ? { output: textOf(r.content).slice(0, 8000) || undefined } : {})
      })
      if (r) {
        const details = r.details as { diff?: unknown; patch?: unknown } | undefined
        const args = c.arguments as { path?: unknown; limit?: unknown } | undefined
        if (typeof details?.diff === 'string' && details.diff) {
          out.push({
            ...parseDiff(details.diff, String(args?.path ?? c.name)),
            patch: typeof details.patch === 'string' ? details.patch : undefined
          })
        }
        // read 成功时补一张文件卡，模型看到了什么用户也看得到
        if (c.name === 'read' && !r.isError && typeof args?.path === 'string' && args.path) {
          out.push(fileBlock(args.path, Number(args.limit ?? 0)))
        }
      }
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

/* ---------------- 回合分组与总装配 ---------------- */

interface Group {
  user: PiMessage | null
  items: PiMessage[]
}

/** user 消息开一组；首条 user 之前的散件（压缩通知等）自成一组 */
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

/** 回合还活着吗：消息在流式，或工具调了还没结果 */
function groupLive(g: Group, results: Map<string, ToolResult>): boolean {
  for (const m of g.items) {
    if (m.role !== 'assistant') continue
    if (m.stopReason === 'pending') return true
    for (const c of m.content) {
      if (c.type === 'toolCall' && !results.has(c.id)) return true
    }
  }
  return false
}

export interface Derived {
  order: string[]
  byId: Record<string, Block>
  liveTurnId: string | null
  answerText: string
}

/** 全量派生：组内 [用户气泡, 折叠行, 回答]，回答只在确实以它收尾时提到折叠行外 */
export function deriveBlocks(order: string[], byId: Record<string, PiMessage>): Derived {
  const groups = groupMessages(order, byId)
  const rows: Block[] = []
  const outById: Record<string, Block> = {}
  let liveTurnId: string | null = null
  const now = Date.now()

  groups.forEach((g, gi) => {
    const results = new Map<string, ToolResult>()
    for (const m of g.items) if (m.role === 'toolResult') results.set(m.toolCallId, m)

    if (g.user) rows.push(...messageBlocks(g.user, results))
    const steps = g.items.flatMap((m) => messageBlocks(m, results))
    const answer = steps[steps.length - 1]?.kind === 'assistant' ? steps.pop() : undefined

    if (steps.length) {
      const userTs = g.user ? g.user.timestamp : (g.items[0]?.timestamp ?? 0)
      const live = gi === groups.length - 1 && groupLive(g, results)
      const endTs = live ? now : (g.items[g.items.length - 1]?.timestamp ?? userTs)
      const aborted = g.items.some((m) => m.role === 'assistant' && m.stopReason === 'aborted')
      const turn: Block = {
        kind: 'turn',
        id: `t-${userTs}`,
        durationMs: Math.max(0, endTs - userTs),
        ...(aborted ? { aborted } : {}),
        children: steps
      }
      rows.push(turn)
      if (live) liveTurnId = turn.id
    }
    if (answer) rows.push(answer)
  })

  for (const b of rows) outById[b.id] = b
  let answerText = ''
  for (let i = rows.length - 1; i >= 0; i--) {
    const b = rows[i]
    if (b.kind === 'assistant') {
      answerText = b.text
      break
    }
  }
  return { order: rows.map((b) => b.id), byId: outById, liveTurnId, answerText }
}
