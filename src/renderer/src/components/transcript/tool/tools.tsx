import type { Block } from '@shared/blocks'
import {
  IconEdit,
  IconEye,
  IconFolder,
  IconSearch,
  IconTerminal,
  IconWrench
} from '../../icons'
import { DiffLines, FilePeek, Output, TerminalBody } from './bodies'
import type { StepProps } from './StepRow'

type Tool = Extract<Block, { kind: 'tool' }>
type Diff = Extract<Block, { kind: 'diff' }>

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
 * 一次工具调用要显示的完整信息。返回描述而不是节点：外壳只在 StepRow 里装配一次，
 * 新增工具 = 加一个 case，不动渲染逻辑。
 */
export function toolView(block: Tool, diff?: Diff): StepProps {
  const a = parse(block.args)
  const path = str(a, 'path') ?? str(a, 'file_path')
  const name = base(path)
  const out = block.output
  const hits = count(out)
  const state = block.state

  switch (block.name) {
    case 'read':
      return {
        icon: IconEye,
        label: '阅读',
        detail: name,
        title: path,
        state,
        children: path ? <FilePeek path={path} /> : undefined
      }
    case 'ls':
      return {
        icon: IconFolder,
        label: '列出',
        detail: path || '.',
        state,
        extra: hits ? `${hits} 项` : undefined,
        children: out ? <Output text={out} /> : undefined
      }
    case 'glob':
      return {
        icon: IconSearch,
        label: '查找',
        detail: str(a, 'pattern') ?? block.args,
        state,
        extra: hits ? `${hits} 个文件` : undefined,
        children: out ? <Output text={out} /> : undefined
      }
    case 'grep':
      return {
        icon: IconSearch,
        label: '检索',
        detail: str(a, 'pattern') ?? block.args,
        state,
        extra: hits ? `${hits} 处` : undefined,
        children: out ? <Output text={out} /> : undefined
      }
    case 'bash':
      return {
        icon: IconTerminal,
        label: '终端',
        detail: str(a, 'command') ?? block.args,
        mono: true,
        state,
        children: <TerminalBody cmd={str(a, 'command') ?? block.args} out={out} />
      }
    case 'write':
    case 'edit':
      return {
        icon: IconEdit,
        label: block.name === 'write' ? '写入' : '编辑',
        detail: name,
        title: path,
        state,
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
    default:
      // 没认领的工具：等宽的命令/模式优先，原文兜底
      return {
        icon: IconWrench,
        label: block.name,
        detail: str(a, 'command') ?? str(a, 'pattern') ?? block.args,
        state,
        children: out ? <Output text={out} /> : undefined
      }
  }
}
