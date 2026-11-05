import { memo, useState, type ReactNode } from 'react'
import type { Block } from '@shared/blocks'
import { IconChevronDown, IconChevronRight, IconSpinner } from '../../base/icons'
import { MarkdownView } from '../../base/MarkdownView'
import { Step } from './Step'
import { workTime } from '../../../util'

type Turn = Extract<Block, { kind: 'turn' }>

/**
 * 一个回合的「工作过程」：思考与工具折叠成一行摘要，答案留在外面。
 * 默认展开条件跟着 live 走，用户手动点过就听用户的。
 */
export const TurnView = memo(function TurnView({
  block,
  live
}: {
  block: Turn
  live: boolean
}): ReactNode {
  // 折叠态记在本地：切会话、重开后保持原样。live 的 t-live 落定后会换 id，
  // 用第一个子块的 id 做 key，同一个回合前后命中同一条记录
  const storeKey = `pi.turn.${block.children[0]?.id ?? block.id}`
  const [choice, setChoice] = useState<boolean | null>(() => {
    const saved = localStorage.getItem(storeKey)
    return saved === null ? null : saved === '1'
  })
  const open = choice ?? live
  const toggle = (): void => {
    localStorage.setItem(storeKey, open ? '0' : '1')
    setChoice(!open)
  }

  const last = block.children[block.children.length - 1]
  const answer = last?.kind === 'assistant' ? last : undefined
  const steps = answer ? block.children.slice(0, -1) : block.children
  const title = live
    ? `进行中 · ${workTime(block.durationMs)}`
    : block.aborted
      ? `已中断 · ${workTime(block.durationMs)}`
      : `已工作 ${workTime(block.durationMs)}`

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="flex h-8 w-full items-center gap-1 border-b border-edge px-1 text-sm text-muted transition-colors hover:text-fg"
        aria-expanded={open}
      >
        <span>{title}</span>
        {live ? <IconSpinner className="size-3.5" /> : null}
        {open ? (
          <IconChevronDown className="size-3.5 text-faint" />
        ) : (
          <IconChevronRight className="size-3.5 text-faint" />
        )}
      </button>
      {open && steps.length > 0 ? (
        <div className="mt-2 space-y-0.5">
          {steps.map((b, i) => {
            // edit / write 后面的 diff 并进工具行，不再单独占一行
            if (b.kind === 'diff') {
              const prev = steps[i - 1]
              const merged = prev?.kind === 'tool' && (prev.name === 'edit' || prev.name === 'write')
              return merged ? null : <Step key={b.id} block={b} />
            }
            const next = steps[i + 1]
            return <Step key={b.id} block={b} diff={next?.kind === 'diff' ? next : undefined} />
          })}
        </div>
      ) : null}
      {answer ? (
        <div className="mt-2">
          <MarkdownView text={answer.text} streaming={live && answer.streaming} />
        </div>
      ) : null}
    </div>
  )
})
