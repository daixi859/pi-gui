import { zh } from '../i18n/zh'
import type { AssistantBlock, Block, ConversationState, ToolBlock, Turn } from '../reducer/types'
import { toolKind, type ProcessKind } from './tools'

export type { ProcessKind } from './tools'

export interface ProcessCount {
  readonly kind: ProcessKind
  readonly count: number
}

/** 实时活动：组标题在未落定时显示「正在… · 详情」。 */
export interface ProcessActivity {
  readonly kind: ProcessKind
  readonly detail: string
  readonly preparing: boolean
}

export interface ProcessGroupView {
  readonly key: string
  readonly blockIds: readonly string[]
  /** 按次数降序；次数相同按首次出现顺序。 */
  readonly counts: readonly ProcessCount[]
  readonly hasThinking: boolean
  readonly running?: ProcessActivity
  /** 回合已落定即为 true，与组自身是否展开无关。 */
  readonly closed: boolean
}

export type TurnEntry =
  | { readonly kind: 'group'; readonly group: ProcessGroupView }
  | { readonly kind: 'text'; readonly block: AssistantBlock }

export interface TurnLayout {
  readonly entries: readonly TurnEntry[]
  readonly groups: readonly ProcessGroupView[]
}

const DETAIL_KEYS = [
  'command',
  'cmd',
  'query',
  'pattern',
  'path',
  'file_path',
  'url',
  'description',
  'title',
  'code',
] as const

function normalizeDetail(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > 160 ? `${normalized.slice(0, 159)}…` : normalized
}

function toolDetail(block: ToolBlock): string {
  const args = block.args
  if (args === undefined || args === null || typeof args !== 'object') return ''
  for (const key of DETAIL_KEYS) {
    const value = (args as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim() !== '') return normalizeDetail(value)
  }
  return ''
}

/** 最新非空段落的首行；用于思考中的实时标题。 */
function latestParagraphLine(text: string): string {
  const paragraphs = text.split(/\r?\n(?:[\t ]*\r?\n)+/)
  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    const firstLine = paragraphs[index].split('\n').find(line => line.trim() !== '')
    if (firstLine !== undefined) return normalizeDetail(firstLine.replaceAll('**', ''))
  }
  return ''
}

function countTools(block: ToolBlock, counts: Map<ProcessKind, number>, seen: Set<string>): void {
  const subCalls = block.subCalls ?? []
  if (subCalls.length > 0) {
    // codemode 这类包装器只计子调用，避免「调用工具 + 读取 + 搜索」重复计一次。
    for (const sub of subCalls) {
      if (seen.has(sub.id)) continue
      seen.add(sub.id)
      const kind = toolKind(sub.name)
      counts.set(kind, (counts.get(kind) ?? 0) + 1)
    }
    return
  }
  if (seen.has(block.callId)) return
  seen.add(block.callId)
  const kind = toolKind(block.name)
  counts.set(kind, (counts.get(kind) ?? 0) + 1)
}

function buildGroup(blocks: readonly Block[], turnKey: string, closed: boolean): ProcessGroupView {
  const counts = new Map<ProcessKind, number>()
  const seen = new Set<string>()
  let hasThinking = false
  let contextCount = 0
  let running: ProcessActivity | undefined

  for (const block of blocks) {
    if (block.kind === 'tool') {
      countTools(block, counts, seen)
      if (block.state === 'preparing' || block.state === 'running') {
        running = { kind: toolKind(block.name), detail: toolDetail(block), preparing: block.state === 'preparing' }
      }
    } else if (block.kind === 'thinking') {
      if (block.text.trim() !== '') hasThinking = true
      if (block.streaming && running === undefined) {
        running = { kind: 'thinking', detail: latestParagraphLine(block.text), preparing: false }
      }
    } else if (block.kind === 'system') {
      contextCount += 1
    }
  }

  // 整组只有系统行时，按上下文注入计一次（与 harness 的 context 类别一致）。
  if (counts.size === 0 && contextCount > 0) counts.set('context', contextCount)
  if (running !== undefined && running.detail === '' && running.kind === 'thinking') {
    running = { ...running, detail: '' }
  }

  return {
    key: `grp:${turnKey}:${blocks[0].id}`,
    blockIds: blocks.map(block => block.id),
    counts: [...counts]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
    hasThinking,
    running,
    closed,
  }
}

/**
 * 一个回合的三层结构：assistant 文本把过程切成分组；文本本身常显，
 * 折叠只隐藏分组。最终答案也是普通文本块，只是 `final` 为 true。
 */
export function turnLayout(turn: Turn, state: ConversationState): TurnLayout {
  const entries: TurnEntry[] = []
  const groups: ProcessGroupView[] = []
  const live = turn.status === 'live'
  let pending: Block[] = []

  // 只有 live 回合的最后一个分组处于「进行中」；被文本切开的分组已经完成。
  const flush = (closed: boolean): void => {
    if (pending.length === 0) return
    const group = buildGroup(pending, turn.key, closed)
    pending = []
    groups.push(group)
    entries.push({ kind: 'group', group })
  }

  for (const id of turn.blockIds) {
    const block = state.blocks[id]
    if (block === undefined || block.kind === 'user') continue
    if (block.kind === 'assistant') {
      flush(true)
      entries.push({ kind: 'text', block })
    } else {
      pending.push(block)
    }
  }
  flush(!live)

  return { entries, groups }
}

/**
 * 收起后的组标题：按次数取前 3 类，无次数。
 * 两项用「并」并去掉重复的「已」；三项用「，」；超过 3 类末尾加「等」。
 */
export function groupDoneTitle(group: ProcessGroupView): string {
  const labels = group.counts.slice(0, 3).map(({ kind }) => zh.process.done[kind])
  const first = labels[0]
  if (first === undefined) {
    return group.hasThinking ? zh.process.done.thinking : zh.process.done.context
  }
  const second = labels[1]
  if (second === undefined) return first
  if (labels.length === 2) {
    const prefix = zh.process.sharedPrefix
    const shared = first.startsWith(prefix) && second.startsWith(prefix)
    const tail = shared ? second.slice(prefix.length) : second
    return zh.process.joinTwo(first, tail.charAt(0).toLowerCase() + tail.slice(1))
  }
  const rest = labels.slice(1).map(label => label.charAt(0).toLowerCase() + label.slice(1))
  const title = [first, ...rest].join(zh.process.comma)
  return group.counts.length > 3 ? zh.process.more(title) : title
}

/** 未落定时的组标题：「正在读取文件 · 路径 / 正在分析请求」。 */
export function groupLiveTitle(group: ProcessGroupView): string {
  const running = group.running
  if (running === undefined) return zh.process.live.thinking
  const base = running.preparing ? zh.process.prepare[running.kind] : zh.process.live[running.kind]
  return running.detail === '' ? base : `${base} · ${running.detail}`
}

/** 组头图标用的主类别。 */
export function groupActivity(group: ProcessGroupView): ProcessKind {
  return group.running?.kind ?? group.counts[0]?.kind ?? (group.hasThinking ? 'thinking' : 'context')
}
