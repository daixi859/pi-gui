import { useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import type { Block, ToolState } from '@shared/blocks'
import { MarkdownView } from '../base/MarkdownView'
import { DiffBlock } from './DiffBlock'
import {
  IconChevronDown,
  IconChevronRight,
  IconImage,
  IconSparkle
} from '../base/icons'

function UserBlock({ text, images }: { text: string; images?: number }): ReactNode {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-lg rounded-br-sm bg-sunken px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap">
        {images ? (
          <div className="mb-1 flex items-center gap-1 text-xs text-muted">
            <IconImage className="size-3.5" />
            {images} 张图片
          </div>
        ) : null}
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
        className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-fg"
      >
        {open ? <IconChevronDown /> : <IconChevronRight />}
        <span>Thinking</span>
        {level && <span className="text-faint">· {level}</span>}
        <span className="text-faint">
          · {lines} 行 {open ? '' : '(hidden)'}
        </span>
      </button>
      {open && (
        <div className="mt-1 pl-4 text-sm leading-[1.8] whitespace-pre-wrap text-muted">
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
    <div className="rounded-sm text-xs">
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
        <span className="truncate font-mono text-xs text-muted">{args}</span>
        <span className="ml-auto shrink-0 text-xs text-faint">
          {state === 'running' ? '运行中' : state === 'error' ? '失败' : '完成'}
        </span>
      </button>
      {open && output && (
        <pre className="mt-1 ml-4 max-h-[280px] overflow-auto rounded-sm bg-sunken px-2 py-2 font-mono text-xs leading-[1.7] whitespace-pre-wrap text-muted">
          {output}
        </pre>
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
    <div className={clsx('flex items-center gap-2 text-xs', TONES[tone])}>
      <IconSparkle className="size-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  )
}

export function BlockView({ block }: { block: Block }): ReactNode {
  switch (block.kind) {
    case 'user':
      return <UserBlock text={block.text} images={block.images} />
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
    case 'system':
      return <SystemBlock tone={block.tone} text={block.text} />
  }
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

