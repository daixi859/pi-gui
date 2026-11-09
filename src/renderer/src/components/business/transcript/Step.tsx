import { memo, type ReactNode } from 'react'
import { clsx } from 'clsx'
import type { Block } from '@shared/blocks'
import { IconFile, IconSparkle, IconThinking } from '../../base/icons'
import { MarkdownView } from '../../base/MarkdownView'
import { workTime } from '../../../util'
import { StepRow } from './tool/StepRow'
import { toolView } from './tool/tools'

/** 回合里的单步：思考 / 工具（diff 并在其字段里）/ 文件 / 提示。块引用不变就不重渲染 */
export const Step = memo(function Step({ block }: { block: Block }): ReactNode {
  switch (block.kind) {
    case 'thinking': {
      const meta = [
        block.streaming ? '思考中…' : block.durationMs ? `持续 ${workTime(block.durationMs)}` : '',
        block.level ?? ''
      ].filter(Boolean)
      return (
        <StepRow
          icon={IconThinking}
          label="思考"
          detail={meta.join(' · ')}
          state={block.streaming ? 'running' : undefined}
          children={
            block.text ? (
              <div className="text-xs leading-prose whitespace-pre-wrap text-muted">{block.text}</div>
            ) : undefined
          }
        />
      )
    }
    case 'tool':
      return <StepRow {...toolView(block)} />
    case 'file':
      return <StepRow icon={IconFile} label="文件" detail={`${block.name} · ${block.meta}`} />
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
