import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { IconCheck } from './icons'

/** 浮层遮罩：点击空白关闭。调用方可能位于窗口拖拽区，必须显式 no-drag 才能收到点击 */
export function MenuScrim({ onClose }: { onClose: () => void }): ReactNode {
  return (
    <button
      type="button"
      aria-label="关闭"
      className="fixed inset-0 z-40 cursor-default [-webkit-app-region:no-drag]"
      onClick={onClose}
    />
  )
}

/** 公共下拉框容器 */
export function MenuPanel({ className = '', children }: { className?: string; children: ReactNode }): ReactNode {
  return (
    <div className={clsx('pi-menu [-webkit-app-region:no-drag]', className)}>{children}</div>
  )
}

/** 公共下拉项：前置图标 + 文案 + 选中打勾 */
export function MenuItem({
  icon,
  label,
  title,
  selected,
  trailing,
  danger,
  onClick
}: {
  icon?: ReactNode
  label: string
  /** 悬停提示：文案被截断时给完整版 */
  title?: string
  selected?: boolean
  trailing?: ReactNode
  danger?: boolean
  onClick?: () => void
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={clsx('pi-menu-item', danger && 'text-del', selected && 'font-medium')}
    >
      {icon}
      <span className="truncate">{label}</span>
      {trailing}
      {selected && <IconCheck className="ml-auto size-[15px] shrink-0 text-muted" />}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }): ReactNode {
  return <div className="px-2 pt-1 pb-1 text-xs text-faint">{children}</div>
}
