import { memo, type ReactNode } from 'react'
import type { Block } from '@shared/blocks'
import { MarkdownView } from '../../base/MarkdownView'
import { IconImage } from '../../base/icons'
import { useEngine } from '../../../store'
import { count } from '../../../perf'
import { Step } from './Step'
import { TurnSection, StaticTurn } from './TurnView'
import type { TurnSpan } from '../../../store/timeline'

function UserLine({ text, images }: { text: string; images?: number }): ReactNode {
  return (
    <div className="mb-8 flex justify-end">
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

/** 三点呼吸：会话还在跑时挂在正文末尾，跑完自动消失 */
export function WorkingDots(): ReactNode {
  return (
    <div role="status" className="mt-4 flex items-center gap-1 pl-1 text-faint">
      <span className="sr-only">正在生成…</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="breathe size-1.5 rounded-pill bg-current"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  )
}

/**
 * 一个块 → 一行。引用不变就跳过渲染（memo 的浅比较就是这个语义）。
 * open = 所在段展开与否：收起时 user 气泡与 assistant 文本仍显示，过程块整行不渲染。
 */
export const RowView = memo(function RowView({ block, open }: { block: Block; open: boolean }): ReactNode {
  count('row')
  switch (block.kind) {
    case 'user':
      return <UserLine text={block.text} images={block.images} />
    case 'assistant':
      return <MarkdownView text={block.text} streaming={block.streaming} />
    default:
      return open ? <Step block={block} /> : null
  }
})

/**
 * 一行只订阅自己那个块（按 id）。
 * 别的块变了不惊动这一行，这一行变了也只有它重渲染——段容器也不参与。
 */
export const Row = memo(function Row({ id, open }: { id: string; open: boolean }): ReactNode {
  const block = useEngine((s) => s.byId[id])
  return block ? <RowView block={block} open={open} /> : null
})

/** 会话正文：只订阅段坐标（turns），折叠呈现与块内容都由段容器 / 行自己负责。 */
export const Transcript = memo(function Transcript(): ReactNode {
  const turns = useEngine((s) => s.turns)
  return (
    <div className="space-y-4">
      {turns.map((span) => (
        <TurnSection key={span.key} span={span} />
      ))}
    </div>
  )
})

/** 给定段结构直接渲染：预览页的假流用，不碰引擎状态 */
export const StaticTranscript = memo(function StaticTranscript({
  turns
}: {
  turns: { span: TurnSpan; blocks: Block[] }[]
}): ReactNode {
  return (
    <div className="space-y-4">
      {turns.map(({ span, blocks }) => (
        <StaticTurn key={span.key} span={span} blocks={blocks} />
      ))}
    </div>
  )
})
