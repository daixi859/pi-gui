import type { Block } from '@shared/blocks'
import { IconWrench } from '../../../base/icons'
import { toolMeta } from '../../../../config/tools'
import { DiffLines, FilePeek, Output, TerminalBody } from './bodies'
import type { StepProps } from './StepRow'

type Tool = Extract<Block, { kind: 'tool' }>

/** 未登记工具的兜底图标；标签直接用原始工具名 */
const FALLBACK_ICON = IconWrench

/** 参数是宿主给的 postMessage 预览串：可能是 JSON，也可能被截断成半截原文 */
function parse(args: string): Record<string, unknown> | null {
  const raw = args.trim()
  if (!raw.startsWith('{')) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function str(o: Record<string, unknown> | null, key: string): string | undefined {
  const v = o?.[key]
  return typeof v === 'string' && v ? v : undefined
}

/** 行首只报文件名，全路径留给 title 和展开态 */
function base(path: string | undefined): string {
  if (!path) return ''
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

function count(text: string | undefined): number {
  return text ? text.split('\n').filter((l) => l.trim()).length : 0
}

/**
 * 一次工具调用要显示的完整信息。图标与标签查 config/tools.ts 的 TOOL_META（通用表）；
 * switch 只写每个工具独有的参数解读与展开体。外壳只在 StepRow 里装配一次。
 */
export function toolView(block: Tool): StepProps {
  const a = parse(block.args)
  const path = str(a, 'path') ?? str(a, 'file_path')
  const name = base(path)
  const out = block.output
  const hits = count(out)
  const meta = toolMeta(block.name)
  const common = {
    icon: meta?.icon ?? FALLBACK_ICON,
    label: meta?.verb ?? block.name,
    state: block.state
  }

  switch (block.name) {
    case 'read':
      return {
        ...common,
        detail: name,
        title: path,
        children: path ? <FilePeek path={path} /> : undefined
      }
    case 'ls':
      return {
        ...common,
        detail: path || '.',
        extra: hits ? `${hits} 项` : undefined,
        children: out ? <Output text={out} /> : undefined
      }
    case 'glob':
      return {
        ...common,
        detail: str(a, 'pattern') ?? block.args,
        extra: hits ? `${hits} 个文件` : undefined,
        children: out ? <Output text={out} /> : undefined
      }
    case 'grep':
      return {
        ...common,
        detail: str(a, 'pattern') ?? block.args,
        extra: hits ? `${hits} 处` : undefined,
        children: out ? <Output text={out} /> : undefined
      }
    case 'bash':
    case 'powershell':
      return {
        ...common,
        detail: str(a, 'command') ?? block.args,
        mono: true,
        children: <TerminalBody cmd={str(a, 'command') ?? block.args} out={out} />
      }
    case 'write':
    case 'edit': {
      const diff = block.diff
      return {
        ...common,
        detail: name,
        title: path,
        extra: diff ? (
          <>
            <span className="font-mono text-add">+{diff.added}</span>
            {diff.removed > 0 ? <span className="font-mono text-del">−{diff.removed}</span> : null}
          </>
        ) : undefined,
        children:
          diff && diff.lines.length ? (
            <DiffLines lines={diff.lines} />
          ) : out ? (
            <Output text={out} />
          ) : undefined
      }
    }
    default:
      // 没认领的工具：等宽的命令/模式优先，原文兜底
      return {
        ...common,
        detail: str(a, 'command') ?? str(a, 'pattern') ?? block.args,
        children: out ? <Output text={out} /> : undefined
      }
  }
}
