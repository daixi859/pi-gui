import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * 全宽列表行：导航、会话列表、分组折叠行的统一底座。
 * select 档 hover 铺底色、active 实色铺底；quiet 档只提亮文字不铺底。
 * 行的控件外观只在这里写，业务组件不得手拼（ADR-0012）。
 */
type Tone = 'select' | 'quiet'

export function ListRow({
  icon,
  label,
  hint,
  active = false,
  tone = 'select',
  size = 'md',
  className,
  children,
  ...rest
}: {
  icon?: ReactNode
  label?: ReactNode
  /** 右对齐的辅助小字 */
  hint?: ReactNode
  active?: boolean
  tone?: Tone
  size?: 'md' | 'lg'
  className?: string
  /** 覆盖 label 区放自定义内容（走马灯、输入框等） */
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>): ReactNode {
  return (
    <button
      type="button"
      className={clsx(
        'flex w-full items-center gap-2 rounded-sm pr-1 pl-2 text-left text-sm transition-colors',
        /* 行高不在间距刻度内，按控件三档（Button 24/28/32）对齐：导航行 h-8、列表行 h-7 */
        size === 'lg' ? 'h-8' : 'h-7',
        tone === 'select'
          ? [active ? 'bg-select font-medium' : 'hover:bg-select/60']
          : 'text-muted hover:text-fg',
        className
      )}
      {...rest}
    >
      {icon}
      {children ?? (label != null && <span className="min-w-0 flex-1 truncate">{label}</span>)}
      {hint != null && <span className="ml-auto shrink-0 text-2xs text-faint">{hint}</span>}
    </button>
  )
}
