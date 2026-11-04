import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import type { ToolState } from '@shared/blocks'
import { IconSpinner } from '../../icons'

export type Ico = ComponentType<SVGProps<SVGSVGElement>>

export interface StepProps {
  icon: Ico
  label: string
  detail?: string
  /** 路径、命令走等宽 */
  mono?: boolean
  /** 行尾附加信息，如行数、+3 −1 */
  extra?: ReactNode
  state?: ToolState
  /** 悬停显示完整路径 */
  title?: string
  /** 有内容才可展开 */
  children?: ReactNode
}

/** 回合里的一行摘要：图标 + 标签 + 次要文案 + 行尾状态。展开体只在这一处挂载 */
export function StepRow({
  icon: Icon,
  label,
  detail,
  mono,
  extra,
  state,
  title,
  children
}: StepProps): ReactNode {
  const [open, setOpen] = useState(false)
  const expandable = children !== undefined

  const head = (
    <>
      <span title={title} className="flex shrink-0">
        <Icon className="size-4 text-faint" />
      </span>
      <span className="shrink-0 text-sm font-medium text-muted">{label}</span>
      {detail ? (
        <span className={'truncate text-xs text-muted ' + (mono ? 'font-mono' : '')}>{detail}</span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-2 pl-2 text-xs text-faint">
        {extra}
        {state === 'running' ? <IconSpinner className="size-3.5 text-muted" /> : null}
        {state === 'error' ? <span className="size-1.5 rounded-pill bg-del" /> : null}
      </span>
    </>
  )

  if (!expandable) {
    return <div className="flex h-7 items-center gap-2 px-1">{head}</div>
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-full items-center gap-2 rounded-sm px-1 text-left transition-colors hover:bg-sunken"
        aria-expanded={open}
      >
        {head}
      </button>
      {open ? <div className="mt-1">{children}</div> : null}
    </div>
  )
}
