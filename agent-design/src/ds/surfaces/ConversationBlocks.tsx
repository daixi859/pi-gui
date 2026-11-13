/**
 * 高保真用的对话块：PiDS 规范重画的六个块。
 *
 * 与旧 `blocks/` 的区别不在功能而在取舍：旧块每个状态都要能跑事件流，
 * 这里只求「拿规范画一遍，看它成立不成立」。所以状态是可摆放的 props，
 * 而不是从 reducer 里推出来的。
 */
import { memo, useState, type ReactNode } from 'react'
import { DsIcon, type DsIconName } from '../icons/DsIcon'
import css from './surfaces.module.css'
import type {
  AssistantBlockView,
  AssistantItem,
  ChangedFiles,
  LineState,
  NoteLine,
  ProcessGroupItem,
  ProcessLine,
  ThinkingLine,
  ToolLine,
} from './conversation'

/** 工具动作 → 图标。 */
const TOOL_ICON: Record<string, DsIconName> = {
  检索: 'search',
  阅读: 'grid',
  修改: 'sliders',
  执行: 'command',
  写入: 'layers',
  脚本: 'command',
}

/** 行首状态图标：颜色 + 图形一起表意，不靠颜色单打。 */
function StateIcon({ state }: { state: LineState }) {
  if (state === 'running' || state === 'preparing') {
    return (
      <span className={css.spinWrap}>
        <DsIcon name="spinner" size={12} />
      </span>
    )
  }
  if (state === 'error') return <DsIcon name="alert" size={12} />
  if (state === 'stopped') return <DsIcon name="ban" size={12} />
  return <DsIcon name="check" size={12} />
}

/** 摘要里有多段反引号时切成等宽片段，避免整行等宽把中文也拉宽。 */
function renderRich(text: string): ReactNode[] {
  return text.split('`').map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className={css.inlineCode}>
        {part}
      </code>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

/** 用户消息：右对齐、单块底色；长文本靠 max-width 收行。 */
export const UserMsg = memo(function UserMsg({ text }: { text: string }) {
  return (
    <div className={css.user}>
      <div className={css.userText}>{text}</div>
    </div>
  )
})

/** 回合头：一行小字 + 折叠箭头，永远不抢正文注意力。 */
export const TurnHead = memo(function TurnHead({
  status,
  duration,
  failed,
  open,
  foldable,
  onToggle,
}: {
  status: 'settled' | 'live' | 'aborted'
  duration?: string | undefined
  failed?: number | undefined
  open: boolean
  foldable: boolean
  onToggle: () => void
}) {
  const label =
    status === 'aborted' ? '已停止' : status === 'live' ? '进行中' : `已完成${duration === undefined ? '' : `，用时 ${duration}`}`
  return (
    <button type="button" className={css.turnHead} onClick={foldable ? onToggle : undefined} disabled={!foldable} aria-expanded={foldable ? open : undefined}>
      <span className={css.turnHeadText}>{label}</span>
      {failed !== undefined && failed > 0 && (
        <span className={css.turnHeadFail}>
          <DsIcon name="alert" size={11} />
          {failed} 次失败
        </span>
      )}
      {foldable && (
        <span className={css.turnHeadChevron} data-open={open || undefined}>
          <DsIcon name="chevronDown" size={12} />
        </span>
      )}
    </button>
  )
})

/** 工具行：动作 + 摘要 + 右侧耗时，状态只体现在图标上。 */
const ToolRow = memo(function ToolRow({ line }: { line: ToolLine }) {
  const [open, setOpen] = useState(false)
  const expandable = line.output !== undefined || line.diff !== undefined
  return (
    <div className={css.row} data-state={line.state}>
      <button
        type="button"
        className={css.rowHead}
        onClick={expandable ? () => setOpen(value => !value) : undefined}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
      >
        <span className={css.rowIcon} data-state={line.state} aria-hidden="true">
          <StateIcon state={line.state} />
        </span>
        <span className={css.rowTitle}>
          <DsIcon name={TOOL_ICON[line.title] ?? 'dot'} size={12} />
          {line.title}
        </span>
        {line.summary !== '' && (
          <span className={css.rowSummary} data-mono={line.mono || undefined}>
            {line.summary}
          </span>
        )}
        {line.diff !== undefined && (
          <span className={css.rowDiff}>
            <span data-add>{`+${line.diff.added}`}</span>
            <span data-del>{`−${line.diff.removed}`}</span>
          </span>
        )}
        <span className={css.rowSpacer} />
        {line.duration !== undefined && <span className={css.rowMeta}>{line.duration}</span>}
      </button>
      {open && line.output !== undefined && <pre className={css.rowBody}>{line.output}</pre>}
    </div>
  )
})

/** 思考行：默认收起，展开是一段低对比度的正文。 */
const ThinkingRow = memo(function ThinkingRow({ line }: { line: ThinkingLine }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={css.row} data-tone="thinking">
      <button type="button" className={css.rowHead} onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <span className={css.rowIcon} data-tone="think" aria-hidden="true">
          <DsIcon name="dot" size={12} />
        </span>
        <span className={css.rowTitle}>
          {line.state === 'streaming' ? '正在思考' : '思考'}
          {line.duration !== undefined && <span className={css.rowMeta}>{line.duration}</span>}
        </span>
        {!open && line.liveSummary !== undefined && <span className={css.rowSummary}>{line.liveSummary}</span>}
        <span className={css.rowSpacer} />
        <span className={css.turnHeadChevron} data-open={open || undefined}>
          <DsIcon name="chevronDown" size={12} />
        </span>
      </button>
      {open && <p className={css.thinkBody}>{line.text}</p>}
    </div>
  )
})

/** 系统行：一条带左侧色条的短提示。 */
const NoteRow = memo(function NoteRow({ line }: { line: NoteLine }) {
  return (
    <div className={css.noteRow} data-tone={line.tone ?? 'info'}>
      <DsIcon name="dot" size={10} />
      <span>{line.text}</span>
    </div>
  )
})

/** 组里的一行。 */
function ProcessRow({ line }: { line: ProcessLine }) {
  if (line.kind === 'tool') return <ToolRow line={line} />
  if (line.kind === 'thinking') return <ThinkingRow line={line} />
  return <NoteRow line={line} />
}

/** 过程组：一行标题，展开后是紧凑的行列表。 */
export const GroupBlock = memo(function GroupBlock({ group }: { group: ProcessGroupItem }) {
  const [open, setOpen] = useState(group.open ?? false)
  const live = group.state === 'live'
  return (
    <div className={css.group}>
      <button type="button" className={css.groupHead} onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <span className={css.groupIcon} data-live={live || undefined} aria-hidden="true">
          <DsIcon name={group.icon} size={13} />
        </span>
        <span className={css.groupTitle} data-live={live || undefined}>
          {group.title}
        </span>
        <span className={css.rowSpacer} />
        {live && <span className={css.sweep} aria-hidden="true" />}
        <span className={css.turnHeadChevron} data-open={open || undefined}>
          <DsIcon name="chevronDown" size={12} />
        </span>
      </button>
      {open && (
        <div className={css.groupRows}>
          {group.lines.map(line => (
            <ProcessRow line={line} key={line.id} />
          ))}
        </div>
      )}
    </div>
  )
})

/** 助手文本里的一段。 */
function Block({ view }: { view: AssistantBlockView }) {
  if (view.type === 'code') {
    return (
      <div className={css.codeBlock}>
        <div className={css.codeLang}>{view.lang}</div>
        <pre className={css.codePre}>{view.code}</pre>
      </div>
    )
  }
  if (view.type === 'list') {
    return (
      <ul className={css.list}>
        {view.items.map((item, index) => (
          <li key={index}>{renderRich(item)}</li>
        ))}
      </ul>
    )
  }
  return <p className={css.para}>{renderRich(view.text)}</p>
}

/** 助手消息：正文常显，`final` 只影响下边距。 */
export const AssistantMsg = memo(function AssistantMsg({ item }: { item: AssistantItem }) {
  return (
    <div className={css.assistant} data-final={item.final || undefined}>
      {item.blocks.map((view, index) => (
        <Block view={view} key={index} />
      ))}
    </div>
  )
})

/** 改动汇总：一行文件一条，带增删计数。 */
export const ChangesRow = memo(function ChangesRow({ changes }: { changes: ChangedFiles }) {
  return (
    <div className={css.changes}>
      <div className={css.changesHead}>
        <DsIcon name="layers" size={12} />
        已编辑 {changes.files.length} 个文件
      </div>
      {changes.files.map(file => (
        <div className={css.changeFile} key={file.name}>
          <span className={css.changeName}>{file.name}</span>
          <span className={css.changeDir}>{file.dir}</span>
          <span className={css.rowSpacer} />
          <span className={css.rowDiff}>
            <span data-add>{`+${file.added}`}</span>
            <span data-del>{`−${file.removed}`}</span>
          </span>
        </div>
      ))}
    </div>
  )
})

/** 运行指示器：全站唯一的标志性动效——一道 2px 扫光。 */
export const RunningIndicator = memo(function RunningIndicator({ label }: { label: string }) {
  return (
    <div className={css.running}>
      <span className={css.runningTrack} aria-hidden="true">
        <span className={css.runningBar} />
      </span>
      <span className={css.runningText}>{label}</span>
    </div>
  )
})
