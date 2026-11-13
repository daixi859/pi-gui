/**
 * tool 块 → 行模型：标题、摘要、diff 行与统计。
 * 类别与动词来自 tools.ts（唯一登记处），这里只负责「这个块怎么显示」。
 */
import type { ToolBlock, ToolSubCall, ToolState } from '../reducer/types'
import { toolMeta, toolVerb, type ProcessKind } from './tools'

interface Args {
  readonly path?: unknown
  readonly file_path?: unknown
  readonly command?: unknown
  readonly pattern?: unknown
  readonly glob?: unknown
  readonly offset?: unknown
  readonly limit?: unknown
  readonly code?: unknown
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** 取路径的最后一段，完整路径通过 title 悬停可见。 */
export function baseName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index === -1 ? normalized : normalized.slice(index + 1) || normalized
}

export interface ToolRowModel {
  readonly kind: ProcessKind
  readonly title: string
  readonly summary: string
  /** 摘要走等宽字体（命令、pattern、原始参数）。 */
  readonly mono: boolean
  /** 摘要的完整值，作为 title 悬停提示。 */
  readonly detail?: string
  readonly extra?: string
  readonly state: ToolState
  readonly durationMs?: number
}

function extraOf(block: ToolBlock, kind: ProcessKind): string | undefined {
  const args = (block.args ?? {}) as Args
  if (kind === 'read' && typeof args.offset === 'number') return `第 ${args.offset} 行起`
  if (block.state === 'stopped') return '已中断'
  return undefined
}

/** 摘要优先用参数；参数还没到时为空串（行尾显示「准备中…」）。 */
export function toolRowModel(block: ToolBlock): ToolRowModel {
  const args = (block.args ?? {}) as Args
  const { kind } = toolMeta(block.name)
  const path = str(args.path) ?? str(args.file_path)
  let summary = ''
  let detail: string | undefined
  let mono = false

  switch (kind) {
    case 'read':
      summary = path !== undefined ? baseName(path) : (block.name === 'ls' ? '.' : '')
      detail = path
      break
    case 'search': {
      const pattern = str(args.pattern) ?? ''
      summary = pattern
      detail = path !== undefined ? `${pattern}  in ${path}` : pattern
      mono = true
      break
    }
    case 'commands':
      summary = str(args.command) ?? ''
      detail = summary
      mono = true
      break
    case 'edit':
    case 'write':
      summary = path !== undefined ? baseName(path) : ''
      detail = path
      break
    case 'code': {
      const calls = block.subCalls ?? []
      summary = calls.length > 0 ? `${calls.length} 次嵌套调用` : ''
      break
    }
    default:
      summary = block.argsRaw
      mono = true
      break
  }

  return {
    kind,
    title: toolVerb(block.name),
    summary,
    mono,
    detail,
    extra: extraOf(block, kind),
    state: block.state,
    durationMs: block.durationMs,
  }
}

export interface DiffLine {
  readonly kind: 'add' | 'remove' | 'context' | 'gap'
  readonly number?: number
  readonly text: string
}

/**
 * pi 的 `details.diff` 是带行号的 unified 片段（` 204 text` / `-208 text` / `+208 text`），
 * 片段之间用 `  ...` 省略。行号拆到 gutter，正文只留代码。
 */
export function parseDiff(diff: unknown): { lines: readonly DiffLine[]; added: number; removed: number } {
  if (typeof diff !== 'string' || diff === '') return { lines: [], added: 0, removed: 0 }
  const lines: DiffLine[] = []
  let added = 0
  let removed = 0
  for (const raw of diff.split(/\r?\n/)) {
    if (raw === '') continue
    const match = /^([ +-])\s*(\d+)\s?(.*)$/.exec(raw)
    if (match === null) {
      if (/^\s*\.{3}\s*$/.test(raw)) lines.push({ kind: 'gap', text: '⋯' })
      else lines.push({ kind: 'context', text: raw })
      continue
    }
    const text = match[3]
    if (match[1] === '+') {
      added += 1
      lines.push({ kind: 'add', number: Number(match[2]), text })
    } else if (match[1] === '-') {
      removed += 1
      lines.push({ kind: 'remove', number: Number(match[2]), text })
    } else {
      lines.push({ kind: 'context', number: Number(match[2]), text })
    }
  }
  return { lines, added, removed }
}

/** codemode 子调用的状态计数。 */
export function subCallStats(calls: readonly ToolSubCall[]): { ok: number; total: number } {
  return { ok: calls.filter(c => c.state !== 'error').length, total: calls.length }
}

/** 工具是否已经有可展示的结果体。 */
export function hasBody(block: ToolBlock): boolean {
  return (
    block.state === 'error' ||
    block.state === 'stopped' ||
    (block.output !== undefined && block.output !== '') ||
    (block.details !== undefined && block.details !== null) ||
    (block.subCalls?.length ?? 0) > 0
  )
}

export const DEFAULT_VISIBLE_LINES = 24

/** 超长输出只渲染前 N 行，按钮展开全部。 */
export function splitOutput(output: string): { head: string; rest: string; total: number } {
  const lines = output.split(/\r?\n/)
  if (lines.length <= DEFAULT_VISIBLE_LINES) return { head: output, rest: '', total: lines.length }
  return {
    head: lines.slice(0, DEFAULT_VISIBLE_LINES).join('\n'),
    rest: lines.slice(DEFAULT_VISIBLE_LINES).join('\n'),
    total: lines.length,
  }
}
