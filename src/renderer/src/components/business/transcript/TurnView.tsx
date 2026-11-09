import { memo, useState, type ReactNode } from 'react'
import type { Block } from '@shared/blocks'
import { IconChevronDown, IconChevronRight, IconSpinner } from '../../base/icons'
import { workTime } from '../../../util'
import type { TurnSpan } from '../../../store/timeline'
import { Row, RowView } from './Transcript'

/** 段头状态文案：live 在跑 / 被中断 / 正常收工 */
function turnTitle(span: TurnSpan): string {
  const t = workTime(span.durationMs)
  if (span.live) return `进行中 · ${t}`
  if (span.aborted) return `已中断 · ${t}`
  return `已工作 ${t}`
}

/** 折叠头：统计与时长全来自段坐标，组件不读块内容 */
function TurnHead({ span, open, toggle }: { span: TurnSpan; open: boolean; toggle: () => void }): ReactNode {
  const label = span.toolCount ? `工具调用 ${span.toolCount} 项` : `过程 ${span.stepCount} 项`
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className="flex h-8 w-full items-center gap-1 border-b border-edge px-1 text-sm text-muted transition-colors hover:text-fg"
    >
      <span>{label}</span>
      <span className="text-faint">· {turnTitle(span)}</span>
      {span.live ? <IconSpinner className="size-3.5" /> : null}
      {open ? <IconChevronDown className="size-3.5 text-faint" /> : <IconChevronRight className="size-3.5 text-faint" />}
    </button>
  )
}

/** 无过程块（纯文本回合）：只给一行时长，不可折叠 */
function TurnBare({ span }: { span: TurnSpan }): ReactNode {
  return (
    <div className="flex h-8 w-full items-center gap-1 px-1 text-xs text-faint">
      {turnTitle(span)}
      {span.live ? <IconSpinner className="size-3.5" /> : null}
    </div>
  )
}

/** 段头三态：有过程给折叠按钮，只有中间文本给一行时长，纯问答什么都不给 */
function turnHead(span: TurnSpan, open: boolean, toggle: () => void): ReactNode {
  if (span.stepCount > 0) return <TurnHead span={span} open={open} toggle={toggle} />
  if (span.noteCount > 1) return <TurnBare span={span} />
  return null
}

/**
 * 一个回合的段容器：折叠与否在这里决定，数据只是段坐标。
 *
 * 收起：`工具调用 3 项 · 已工作 12 秒`（一行折叠头）
 *       中间文本1 → 中间文本2 → 结论
 * 展开：工具1 → 中间文本1 → 工具2 → 中间文本2 → 结论（原顺序交错）
 *
 * 文本（assistant 块）与 user 气泡无论收起展开都不受影响（Row 自己按 open 分发），
 * 其余过程块收起时整行不渲染。
 *
 * 折叠态存本地：切会话、重开后保持原样。key 用段 key（user 消息 timestamp），
 * 同一回合从 live 到落定命中同一条记录。
 */
function useTurnChoice(span: TurnSpan): { open: boolean; toggle: () => void } {
  const storeKey = `pi.turn.${span.key}`
  const [choice, setChoice] = useState<boolean | null>(() => {
    const saved = localStorage.getItem(storeKey)
    return saved === null ? null : saved === '1'
  })
  const open = choice ?? span.live
  const toggle = (): void => {
    localStorage.setItem(storeKey, open ? '0' : '1')
    setChoice(!open)
  }
  return { open, toggle }
}

/** 段体：收起时文本行仍在（间距更大），过程块由行自己按 open 吞掉 */
function TurnBody({ open, children }: { open: boolean; children: ReactNode }): ReactNode {
  return <div className={`mt-2 ${open ? 'space-y-0.5' : 'space-y-2'}`}>{children}</div>
}

/** store 版段容器：行级订阅（Row），别的块变了不惊动这一段 */
export const TurnSection = memo(function TurnSection({ span }: { span: TurnSpan }): ReactNode {
  const { open, toggle } = useTurnChoice(span)
  return (
    <div>
      {span.userId ? <Row id={span.userId} open={open} /> : null}
      {turnHead(span, open, toggle)}
      <TurnBody open={open}>
        {span.ids.map((id) => (
          <Row key={id} id={id} open={open} />
        ))}
      </TurnBody>
    </div>
  )
})

/** 静态版段容器：预览假流直接吃块数组，不碰引擎状态 */
export const StaticTurn = memo(function StaticTurn({ span, blocks }: { span: TurnSpan; blocks: Block[] }): ReactNode {
  const { open, toggle } = useTurnChoice(span)
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const user = span.userId ? byId.get(span.userId) : undefined
  return (
    <div>
      {user ? <RowView block={user} open={open} /> : null}
      {turnHead(span, open, toggle)}
      <TurnBody open={open}>
        {span.ids.map((id) => {
          const b = byId.get(id)
          return b ? <RowView key={id} block={b} open={open} /> : null
        })}
      </TurnBody>
    </div>
  )
})
