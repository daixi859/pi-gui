import { useState, type ReactNode } from 'react'
import type { Block, ToolState } from '@shared/blocks'
import { formatDuration } from '../util'
import { MarkdownView } from './MarkdownView'
import { DiffBlock } from './DiffBlock'
import {
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconFile,
  IconShare,
  IconSparkle,
  IconThumbDown,
  IconThumbUp
} from './icons'

/** 渲染层不能直接用 shell / clipboard，全部过 preload 的主进程桥 */
const host = (): Window['pi']['host'] | undefined => window.pi?.host

function UserBlock({ text }: { text: string }): ReactNode {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[14px] rounded-br-[6px] bg-sunken px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

function AssistantBlock({ text, streaming }: { text: string; streaming?: boolean }): ReactNode {
  return <MarkdownView text={text} streaming={streaming} />
}

function ThinkingBlock({
  text,
  level,
  streaming
}: {
  text: string
  level?: string
  streaming?: boolean
}): ReactNode {
  const [open, setOpen] = useState(false)
  const lines = text.split('\n').length
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-fg"
      >
        {open ? <IconChevronDown /> : <IconChevronRight />}
        <span>Thinking</span>
        {level && <span className="text-faint">· {level}</span>}
        <span className="text-faint">
          · {lines} 行 {open ? '' : '(hidden)'}
        </span>
      </button>
      {open && (
        <div className="mt-1.5 pl-[22px] text-[13px] leading-[1.8] whitespace-pre-wrap text-muted">
          {text}
        </div>
      )}
      {streaming && <span className="sr-only">thinking…</span>}
    </div>
  )
}

function ToolBlock({
  name,
  args,
  state,
  output
}: {
  name: string
  args: string
  state: ToolState
  output?: string
}): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-[8px] text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-0.5 text-left"
      >
        {open ? (
          <IconChevronDown className="shrink-0 text-faint" />
        ) : (
          <IconChevronRight className="shrink-0 text-faint" />
        )}
        <span className={state === 'error' ? 'font-medium text-del' : 'font-medium'}>{name}</span>
        <span className="truncate font-mono text-[12px] text-muted">{args}</span>
        <span className="ml-auto shrink-0 text-[11px] text-faint">
          {state === 'running' ? '运行中' : state === 'error' ? '失败' : '完成'}
        </span>
      </button>
      {open && output && (
        <pre className="mt-1.5 ml-[22px] max-h-[280px] overflow-auto rounded-[8px] bg-sunken px-3 py-2 font-mono text-[12px] leading-[1.7] whitespace-pre-wrap text-muted">
          {output}
        </pre>
      )}
    </div>
  )
}

function FileBlock({ name, meta, path }: { name: string; meta: string; path?: string }): ReactNode {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-line px-3.5 py-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-link/8 text-link">
        <IconFile className="size-[18px]" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13.5px]">{name}</div>
        <div className="text-[12px] text-muted">{meta}</div>
      </div>
      <button
        type="button"
        disabled={!path}
        onClick={() => path && host()?.openPath(path)}
        className="ml-auto flex shrink-0 items-center gap-1 rounded-[8px] border border-line px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-sunken disabled:opacity-40 disabled:hover:bg-transparent"
      >
        打开
      </button>
    </div>
  )
}

function TurnBlock({
  durationMs,
  aborted,
  children
}: {
  durationMs: number
  aborted?: boolean
  children: Block[]
}): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-[10px] border border-line/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[13px] text-muted transition-colors hover:text-fg"
      >
        {open ? <IconChevronDown /> : <IconChevronRight />}
        <span>{aborted ? '已中断' : '已完成'}</span>
        <span className="text-faint">· {formatDuration(durationMs)}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line/70 px-3 py-3">
          {children.map((c) => (
            <BlockView key={c.id} block={c} />
          ))}
        </div>
      )}
    </div>
  )
}

const TONES = {
  info: 'text-muted',
  warn: 'text-warn',
  error: 'text-del'
} as const

function SystemBlock({ tone, text }: { tone: keyof typeof TONES; text: string }): ReactNode {
  return (
    <div className={'flex items-center gap-2 text-[12.5px] ' + TONES[tone]}>
      <IconSparkle className="size-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  )
}

export function BlockView({ block }: { block: Block }): ReactNode {
  switch (block.kind) {
    case 'user':
      return <UserBlock text={block.text} />
    case 'assistant':
      return <AssistantBlock text={block.text} streaming={block.streaming} />
    case 'thinking':
      return <ThinkingBlock text={block.text} level={block.level} streaming={block.streaming} />
    case 'tool':
      return <ToolBlock name={block.name} args={block.args} state={block.state} output={block.output} />
    case 'diff':
      return (
        <DiffBlock
          file={block.file}
          added={block.added}
          removed={block.removed}
          lines={block.lines}
          patch={block.patch}
        />
      )
    case 'file':
      return <FileBlock name={block.name} meta={block.meta} path={block.path} />
    case 'turn':
      return (
        <TurnBlock durationMs={block.durationMs} aborted={block.aborted}>
          {block.children}
        </TurnBlock>
      )
    case 'system':
      return <SystemBlock tone={block.tone} text={block.text} />
  }
}

export function MessageActions({ text, time }: { text: string; time: string }): ReactNode {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)
  const [copied, setCopied] = useState(false)
  const items = [
    {
      key: 'copy',
      icon: IconCopy,
      label: copied ? '已复制' : '复制',
      onClick: () => {
        host()?.copy(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    },
    {
      key: 'up',
      icon: IconThumbUp,
      label: '有帮助',
      active: voted === 'up',
      onClick: () => setVoted((v) => (v === 'up' ? null : 'up'))
    },
    {
      key: 'down',
      icon: IconThumbDown,
      label: '没帮助',
      active: voted === 'down',
      onClick: () => setVoted((v) => (v === 'down' ? null : 'down'))
    },
    {
      key: 'share',
      icon: IconShare,
      label: '导出为 Markdown',
      onClick: () => host()?.saveText('Pi 会话.md', text)
    }
  ]
  return (
    <div className="flex items-center gap-1 text-faint">
      {items.map(({ key, icon: Ico, label, active, onClick }) => (
        <button
          key={key}
          type="button"
          title={label}
          aria-label={label}
          onClick={onClick}
          className={
            'grid size-7 place-items-center rounded-[6px] transition-colors hover:bg-sunken hover:text-muted ' +
            (active ? 'text-fg' : '')
          }
        >
          <Ico className="size-[15px]" />
        </button>
      ))}
      <span className="ml-1 text-[12px]">{time}</span>
    </div>
  )
}

export function TranscriptStack({ blocks }: { blocks: Block[] }): ReactNode {
  return (
    <div className="space-y-6">
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
    </div>
  )
}

/** 最后一个块里最后一段回答的纯文本，供复制 / 导出用 */
export function lastText(blocks: Block[]): string {
  const tail = [...blocks].reverse().find((b) => b.kind === 'assistant')
  return tail?.kind === 'assistant' ? tail.text : ''
}
