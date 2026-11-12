import { memo, useState, type ReactNode } from 'react'
import type { Block } from '@shared/blocks'
import { IconCheck, IconChevronDown, IconChevronRight, IconClose } from '../../base/icons'
import { Shimmer } from '../../base/Shimmer'
import { workTime } from '../../../util'
import { toolMeta } from '../../../config/tools'
import type { TurnActivity, TurnSpan } from '../../../store/timeline'
import { Row, RowView } from './Transcript'

/**
 * live 段的活动文案：动词 + 一行任务摘要，用同一个「 · 」分隔（照 deepseek-harness 的分组头）。
 * 摘要来自此刻正在做的事：工具参数、正在写的思考段落；没有摘要时只报动词。
 */
function activityText(a: TurnActivity | undefined): string {
  if (!a) return '进行中'
  if (a.kind === 'thinking') return a.detail ? `正在思考 · ${a.detail}` : '正在思考'
  if (a.kind === 'replying') return '正在回复'
  const verb = toolMeta(a.toolName ?? '')?.verb ?? `调用 ${a.toolName}`
  const label = `正在${verb}`
  return a.detail ? `${label} · ${a.detail}` : label
}

/**
 * live 段的状态行：只报「此刻在干什么」，整体流光。
 * 不外挂走表——进行中的时长不是信息，每秒重渲一次也只为了让数字变；落定后的总时长由 turnTitle 给。
 * 摘要随内容变长，始终单行：超出即省略号（照 deepseek-harness 分组头的 .label）。
 */
function LiveLine({ a }: { a: TurnActivity | undefined }): ReactNode {
  return (
    <Shimmer active className="min-w-0 flex-1">
      <span className="block truncate">{activityText(a)}</span>
    </Shimmer>
  )
}

/** 落定后的状态文案：正常收工带定格时长（紧凑写法，如「3分15秒」），中断替换掉时长 */
function TurnStatus({ span }: { span: TurnSpan }): ReactNode {
  const failed = span.errorCount > 0
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className={failed ? 'flex shrink-0 text-del' : 'flex shrink-0 text-faint'}>
        {failed || span.aborted ? <IconClose className="size-3.5" /> : <IconCheck className="size-3.5" />}
      </span>
      <span className={failed ? 'text-del' : undefined}>
        {span.aborted ? '已中断' : failed ? `${span.errorCount} 个步骤失败` : '已完成'}
      </span>
      <span aria-hidden="true" className="size-0.5 shrink-0 rounded-pill bg-faint" />
      <span className="shrink-0 text-xs">{workTime(span.durationMs).replace(/ /g, '')}</span>
      {span.toolCount ? (
        <span className="ml-auto shrink-0 text-xs">{span.toolCount} 次工具调用</span>
      ) : null}
    </span>
  )
}

/** 折叠头：箭头在前（与思考 / 工具行同一侧），live 显示当前活动，落定只留状态文案 */
function TurnHead({ span, open, toggle }: { span: TurnSpan; open: boolean; toggle: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className="flex h-8 w-full items-center gap-1 border-b border-edge px-1 text-sm text-muted transition-colors hover:text-fg"
    >
      {open ? (
        <IconChevronDown className="size-3.5 shrink-0 text-faint" />
      ) : (
        <IconChevronRight className="size-3.5 shrink-0 text-faint" />
      )}
      {span.live ? <LiveLine a={span.activity} /> : <TurnStatus span={span} />}
    </button>
  )
}

/** 无过程块（纯文本回合）：只给一行状态，不可折叠 */
function TurnBare({ span }: { span: TurnSpan }): ReactNode {
  return (
    <div className="flex h-8 w-full items-center px-1 text-xs text-faint">
      {span.live ? <LiveLine a={span.activity} /> : <TurnStatus span={span} />}
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
function useTurnChoice(span: TurnSpan, defaultOpen?: boolean): { open: boolean; toggle: () => void } {
  const storeKey = `pi.turn.${span.key}`
  const [choice, setChoice] = useState<boolean | null>(() => {
    const saved = localStorage.getItem(storeKey)
    return saved === null ? null : saved === '1'
  })
  const open = choice ?? defaultOpen ?? span.live
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
export const StaticTurn = memo(function StaticTurn({
  span,
  blocks,
  defaultOpen
}: {
  span: TurnSpan
  blocks: Block[]
  /** 设计稿默认展示工具过程；运行页仍遵循 live 展开、落定收起的记忆策略。 */
  defaultOpen?: boolean
}): ReactNode {
  const { open, toggle } = useTurnChoice(span, defaultOpen)
  const expanded = open
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const user = span.userId ? byId.get(span.userId) : undefined
  return (
    <div>
      {user ? <RowView block={user} open={expanded} /> : null}
      {turnHead(span, expanded, toggle)}
      <TurnBody open={expanded}>
        {span.ids.map((id) => {
          const b = byId.get(id)
          return b ? <RowView key={id} block={b} open={expanded} /> : null
        })}
      </TurnBody>
    </div>
  )
})
