import type { ReactNode } from 'react'
import { IconCheck } from './icons'

/** 浮层遮罩：点击空白关闭 */
export function MenuScrim({ onClose }: { onClose: () => void }): ReactNode {
  return <button type="button" aria-label="关闭" className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
}

/** 公共下拉框容器 */
export function MenuPanel({ className = '', children }: { className?: string; children: ReactNode }): ReactNode {
  return (
    <div
      className={
        'absolute z-50 rounded-[12px] border border-edge bg-panel p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.2)] ' +
        className
      }
    >
      {children}
    </div>
  )
}

/** 公共下拉项：前置图标 + 文案 + 选中打勾 */
export function MenuItem({
  icon,
  label,
  selected,
  trailing,
  danger,
  onClick
}: {
  icon?: ReactNode
  label: string
  selected?: boolean
  trailing?: ReactNode
  danger?: boolean
  onClick?: () => void
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex w-full items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-left text-[13.5px] transition-colors hover:bg-sunken ' +
        (danger ? 'text-del ' : '') +
        (selected ? 'font-medium' : '')
      }
    >
      {icon}
      <span className="truncate">{label}</span>
      {trailing}
      {selected && <IconCheck className="ml-auto size-[15px] shrink-0 text-muted" />}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }): ReactNode {
  return <div className="px-2 pt-1 pb-1 text-[11.5px] text-faint">{children}</div>
}
