import { memo, type ReactNode } from 'react'
import type { Block } from '@shared/blocks'
import { MarkdownView } from '../MarkdownView'
import { IconImage } from '../icons'
import { Step } from './Step'
import { TurnView } from './TurnView'

function UserLine({ text, images }: { text: string; images?: number }): ReactNode {
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

const Row = memo(function Row({
  block,
  live
}: {
  block: Block
  live: boolean
}): ReactNode {
  switch (block.kind) {
    case 'user':
      return <UserLine text={block.text} images={block.images} />
    case 'assistant':
      return <MarkdownView text={block.text} streaming={block.streaming} />
    case 'turn':
      return <TurnView block={block} live={live} />
    default:
      return <Step block={block} />
  }
})

/** 会话正文：块引用不变就不重渲染，只有正在流式的那个块会跟着增量走 */
export const Transcript = memo(function Transcript({
  blocks,
  streaming
}: {
  blocks: Block[]
  streaming: boolean
}): ReactNode {
  let liveTurnId: string | null = null
  if (streaming) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].kind === 'turn') {
        liveTurnId = blocks[i].id
        break
      }
    }
  }

  return (
    <div className="space-y-4">
      {blocks.map((b) => (
        <Row key={b.id} block={b} live={b.id === liveTurnId} />
      ))}
    </div>
  )
})
