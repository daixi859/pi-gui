import { memo, useEffect, useState, type ReactNode } from 'react'
import type { Block } from '@shared/blocks'
import { IconChevronDown, IconChevronRight, IconSpinner } from '../../base/icons'
import { workTime } from '../../../util'
import type { TurnActivity, TurnSpan } from '../../../store/timeline'
import { Row, RowView } from './Transcript'

/** 工具名 → 头上的中文动词 */
const VERB: Record<string, string> = {
  read: '阅读',
  ls: '查看',
  glob: '查找',
  grep: '检索',
  bash: '执行',
  edit: '修改',
  write: '写入'
}

/** live 段的活动文案：工具带参数摘要（参数没流完就省略号），思考 / 回复兜底 */
function activityText(a: TurnActivity | undefined): string {
  if (!a) return '进行中'
  if (a.kind === 'thinking') return '思考中'
  if (a.kind === 'replying') return '回复中'
  const verb = VERB[a.toolName ?? ''] ?? `调用 ${a.toolName}`
  return a.detail ? `正在${verb} ${a.detail}` : `正在${verb}…`
}

/** live 段的走表时钟：独立组件每秒只重渲这一个数，派生与转录都不参与 */
function RunClock({ startedAt }: { startedAt: number }): ReactNode {
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span className="text-faint">· {workTime(Date.now() - startedAt)}</span>
}

/** 落定后的状态文案：正常收工带定格时长（紧凑写法，如「3分15秒」），中断替换掉时长 */
function turnTitle(span: TurnSpan): string {
  if (span.aborted) return '已中断'
  return `已完成，用时 ${workTime(span.durationMs).replace(/ /g, '')}`
}

/** 折叠头：live 显示当前活动 + 走表，落定只留状态文案；统计与时长全来自段坐标 */
function TurnHead({ span, open, toggle }: { span: TurnSpan; open: boolean; toggle: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className="flex h-8 w-full items-center gap-1 border-b border-edge px-1 text-sm text-muted transition-colors hover:text-fg"
    >
      <span>{span.live ? activityText(span.activity) : turnTitle(span)}</span>
      {span.live ? <RunClock startedAt={span.startedAt} /> : null}
      {span.live ? <IconSpinner className="size-3.5" /> : null}
      {open ? <IconChevronDown className="size-3.5 text-faint" /> : <IconChevronRight className="size-3.5 text-faint" />}
    </button>
  )
}

/** 无过程块（纯文本回合）：只给一行状态，不可折叠 */
function TurnBare({ span }: { span: TurnSpan }): ReactNode {
  return (
    <div className="flex h-8 w-full items-center gap-1 px-1 text-xs text-faint">
      <span>{span.live ? activityText(span.activity) : turnTitle(span)}</span>
      {span.live ? <RunClock startedAt={span.startedAt} /> : null}
      {span.live ? <IconSpinner className="size-3.5" /> : null}
    </div>
  )
}

/** 段头三态：有过程给折叠按钮，只有中间文本给一行状态，纯问答什么都不给 */
function turnHead(span: TurnSpan, open: boolean, toggle: () => void): ReactNode {
  if (span.stepCount > 0) return <TurnHead span={span} open={open} toggle={toggle} />
  if (span.noteCount > 1) return <TurnBare span={span} />
  return null
}

/**
 * 一个回合的段容器：折叠与否在这里决定，数据只是段坐标。
 *
 * 收起：`已完成，用时 12秒`（一行折叠头）
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
