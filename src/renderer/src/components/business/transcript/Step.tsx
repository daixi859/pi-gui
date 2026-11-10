import { memo, type ReactNode } from 'react'
import { clsx } from 'clsx'
import type { Block } from '@shared/blocks'
import { IconSparkle } from '../../base/icons'
import { MarkdownView } from '../../base/MarkdownView'
import { reasoningSummary, workTime } from '../../../util'
import { StepRow } from './tool/StepRow'
import { toolView } from './tool/tools'
import { toolMeta } from '../../../config/tools'

/** 回合里的单步：思考 / 工具（diff 并在其字段里）/ 提示。块引用不变就不重渲染 */
export const Step = memo(function Step({ block }: { block: Block }): ReactNode {
  switch (block.kind) {
    case 'thinking': {
      // 摘要照 deepseek-harness：流式中只推「已完成段落首行」，落定给首行；全文在展开体里。
      // 空思考（只有签名/空白）整行不渲染，和 harness 一样
      if (block.text.trim() === '') return null
      const running = block.streaming === true
      const summary = reasoningSummary(block.text, running)
      const meta = toolMeta('thinking')
      // 档位一直报；耗时只在落定后报（摘要之后的 extra 插槽）
      const info = [!running && block.durationMs ? `持续 ${workTime(block.durationMs)}` : '', block.level ?? '']
        .filter(Boolean)
        .join(' · ')
      return (
        <StepRow
          icon={meta?.icon ?? IconSparkle}
          label={meta?.verb ?? '思考'}
          live={running ? summary : undefined}
          detail={running ? undefined : summary}
          extra={info || undefined}
          state={running ? 'running' : undefined}
          streamSummary
          keepSummaryWhenOpen={false}
          stickyHeader
          children={
            <div className="text-xs leading-prose whitespace-pre-wrap text-muted">{block.text}</div>
          }
        />
      )
    }
    case 'tool':
      return <StepRow {...toolView(block)} />
    case 'system':
      return (
        <div
          className={clsx(
            'flex h-7 items-center gap-2 px-1 text-xs',
            block.tone === 'error' ? 'text-del' : block.tone === 'warn' ? 'text-warn' : 'text-muted'
          )}
        >
          <IconSparkle className="size-4 shrink-0" />
          <span className="truncate">{block.text}</span>
        </div>
      )
    // 中间文本由 TurnView 直接渲染（需带 streaming 与 Markdown），这里只是兜底
    case 'assistant':
      return (
        <div className="px-1 py-1">
          <MarkdownView text={block.text} streaming={block.streaming} />
        </div>
      )
    case 'user':
      return <StepRow icon={IconSparkle} label="用户" detail={block.text} />
  }
})
