import { memo, type ReactNode } from 'react'
import { clsx } from 'clsx'
import type { Block } from '@shared/blocks'
import { IconEdit, IconFile, IconSparkle, IconThinking } from '../icons'
import { DiffLines } from './tool/bodies'
import { workTime } from '../../util'
import { StepRow } from './tool/StepRow'
import { toolView } from './tool/tools'

/** 回合里的单步：思考 / 工具 / diff / 文件 / 提示。块引用不变就不重渲染 */
export const Step = memo(function Step({
  block,
  diff
}: {
  block: Block
  /** edit / write 紧跟的 diff 块，合并进工具行，别单独占一行 */
  diff?: Extract<Block, { kind: 'diff' }>
}): ReactNode {
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
      return <StepRow {...toolView(block, diff)} />
    case 'diff':
      return (
        <StepRow
          icon={IconEdit}
          label="修改"
          detail={block.file}
          extra={
            <>
              <span className="font-mono text-add">+{block.added}</span>
              <span className="font-mono text-del">−{block.removed}</span>
            </>
          }
          children={block.lines.length ? <DiffLines lines={block.lines} /> : undefined}
        />
      )
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
    case 'assistant':
      return <AssistantNote text={block.text} />
    case 'user':
      return <StepRow icon={IconSparkle} label="用户" detail={block.text} />
    case 'turn':
      return null
  }
})

/** 回合中途的说明文字：属于过程，折叠后不占版面 */
function AssistantNote({ text }: { text: string }): ReactNode {
  return <div className="px-1 py-1 text-sm leading-prose whitespace-pre-wrap text-muted">{text}</div>
}
