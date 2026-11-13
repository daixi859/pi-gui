import { memo, useState } from 'react'
import { DisclosureRow } from '../primitives/DisclosureRow'
import { StateDot } from '../primitives/StateDot'
import { zh } from '../i18n/zh'
import { formatDuration } from '../lib/format'
import type { ToolBlock, ToolState } from '../reducer/types'
import { KIND_ICON } from './kindIcons'
import { hasBody, parseDiff, splitOutput, toolRowModel } from './toolModel'

const DOT: Record<ToolState, 'done' | 'error' | 'warning' | 'ongoing'> = {
  preparing: 'ongoing',
  running: 'ongoing',
  ok: 'done',
  error: 'error',
  stopped: 'warning',
}

function Code({ text, wrap }: { text: string; wrap?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { head, rest, total } = splitOutput(text)
  if (head === '') return null
  return (
    <>
      <pre className="code" data-wrap={wrap || undefined}>{expanded ? text : head}</pre>
      {rest !== '' && (
        <div className="codeMore">
          <button type="button" className="linkButton" onClick={() => setExpanded(value => !value)}>
            {expanded ? zh.block.collapse : zh.block.showAll(total)}
          </button>
        </div>
      )}
    </>
  )
}

/** 工具行：折叠头 + 结果体（终端输出 / diff / codemode 子调用）。 */
export const ToolRow = memo(function ToolRow({
  block,
  defaultOpen = false,
}: {
  block: ToolBlock
  /** 画廊/调试用：强制初始展开。 */
  defaultOpen?: boolean
}) {
  const model = toolRowModel(block)
  const running = block.state === 'preparing' || block.state === 'running'
  const expandable = hasBody(block)
  const diff = parseDiff((block.details as { diff?: unknown } | undefined)?.diff)
  const hasDiff = diff.lines.length > 0 && (model.kind === 'edit' || model.kind === 'write')
  // 所有工具默认收起，包括失败与修改；需要时手动开。
  const [open, setOpen] = useState(defaultOpen)

  const toggle = () => setOpen(value => !value)

  const summary = model.summary !== '' ? model.summary : block.state === 'preparing' ? zh.block.preparing : ''
  const accessory = (
    <span className="toolAccessory">
      {hasDiff && block.state !== 'preparing' && block.state !== 'running' && (
        <span className="diffStat">
          <span className="diffAdd">+{diff.added}</span>
          <span className="diffDel">−{diff.removed}</span>
        </span>
      )}
      {block.durationMs !== undefined && <span>{formatDuration(block.durationMs)}</span>}
      {block.state === 'error' && <span className="toolError">{zh.block.failed}</span>}
      {block.state === 'stopped' && <span>{zh.block.stopped}</span>}
      {block.state !== 'preparing' && block.state !== 'running' && <StateDot state={DOT[block.state]} />}
    </span>
  )

  return (
    <div className="tool">
      <DisclosureRow
        icon={KIND_ICON[model.kind]}
        title={model.title}
        open={open}
        expandable={expandable}
        expandOnRowClick
        onToggle={toggle}
        running={running}
        titleClassName="compactTitle"
        headerAccessory={accessory}
        collapsedContent={
          summary !== '' ? (
            <span
              className="toolSummary"
              data-mono={model.mono || undefined}
              title={model.detail}
            >
              {summary}
            </span>
          ) : null
        }
      >
        <div className="toolBody">
          <ToolBody block={block} diffLines={diff.lines} added={diff.added} removed={diff.removed} />
        </div>
      </DisclosureRow>
    </div>
  )
})

function ToolBody({
  block,
  diffLines,
  added,
  removed,
}: {
  block: ToolBlock
  diffLines: ReturnType<typeof parseDiff>['lines']
  added: number
  removed: number
}) {
  const model = toolRowModel(block)
  const error = block.error
  return (
    <>
      <div className="toolBodyHead" data-error={block.state === 'error' || undefined}>
        <span className="label toolBodyLabel">{model.title}</span>
        {model.detail !== undefined && <span>{model.detail}</span>}
        {model.kind === 'code' && (block.subCalls?.length ?? 0) > 0 && (
          <span className="label toolBodyMeta">
            {zh.tool.subCalls(block.subCalls?.length ?? 0)}
          </span>
        )}
        <span className="spacer" />
        {diffLines.length > 0 && (
          <span className="diffStats">
            <span className="diffAdded">+{added}</span>
            <span className="diffRemoved">-{removed}</span>
          </span>
        )}
        {block.state === 'error' && <span className="toolBodyMeta">{error?.message ?? zh.block.failed}</span>}
        {block.state === 'stopped' && <span className="toolBodyMeta">{zh.block.stopped}</span>}
      </div>

      {block.subCalls?.length ? (
        <div className="subCalls">
          {block.subCalls.map(call => (
            <div className="subCall" key={call.id}>
              <StateDot state={call.state === 'error' ? 'error' : 'done'} size={8} />
              <span className="subCallName">{call.name}</span>
              <span className="subCallArgs">{describeArgs(call.args)}</span>
              {call.durationMs !== undefined && <span className="subCallTime">{formatDuration(call.durationMs)}</span>}
            </div>
          ))}
        </div>
      ) : null}

      {diffLines.length > 0 ? (
        <div className="diff">
          {diffLines.map((line, index) => (
            <div className="diffLine" data-kind={line.kind} key={index}>
              <span className="diffNum">{line.number ?? ''}</span>
              <span className="diffMarker">
                {line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : line.kind === 'gap' ? '' : ' '}
              </span>
              <span className="diffText">{line.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      {block.output !== undefined && block.output !== '' ? (
        <Code text={block.output} />
      ) : block.state === 'ok' || block.state === 'error' || block.state === 'stopped' ? (
        diffLines.length === 0 && (block.subCalls?.length ?? 0) === 0 && (
          <pre className="code">{zh.block.noOutput}</pre>
        )
      ) : null}
    </>
  )
}

/** codemode 子调用的参数可能是 JSON 串，尽量显示成一行。 */
function describeArgs(args: unknown): string {
  if (typeof args === 'string') {
    try {
      const parsed: unknown = JSON.parse(args)
      const first = parsed !== null && typeof parsed === 'object' ? Object.values(parsed as Record<string, unknown>)[0] : parsed
      return typeof first === 'string' ? first : args
    } catch {
      return args
    }
  }
  if (args !== null && typeof args === 'object') {
    const first = Object.values(args as Record<string, unknown>)[0]
    if (typeof first === 'string') return first
    return JSON.stringify(args)
  }
  return ''
}
