import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconSpinner } from './icons'

/**
 * 全站唯一按钮。四种语义变体 × 三档尺寸 × 两档形状，图标作为插槽。
 * 无 children 时按图标按钮渲染成正方形，此时必须给 aria-label。
 * 焦点环由 global.css 的 button:focus-visible 兜底，这里不再写。
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'
type Shape = 'square' | 'circle'

const BASE =
  'inline-flex shrink-0 select-none items-center justify-center gap-1 whitespace-nowrap leading-none transition-colors disabled:opacity-35'

const VARIANT: Record<Variant, string> = {
  /* 一屏只留一个主动作 */
  primary: 'bg-fg text-white enabled:hover:bg-fg/85',
  secondary: 'border border-edge text-fg enabled:hover:bg-tint',
  ghost: 'text-muted enabled:hover:bg-sunken enabled:hover:text-fg',
  danger: 'border border-edge text-del enabled:hover:bg-danger-1'
}

/* 24 / 28（默认，常规用这档） / 32 */
const SIZE: Record<Size, string> = {
  sm: 'h-6 px-2 text-sm',
  md: 'h-7 px-2 text-sm',
  lg: 'h-8 px-4 text-sm'
}

/* 图标按钮保持与高度同宽的正方形热区 */
const SQUARE: Record<Size, string> = {
  sm: 'size-6',
  md: 'size-7',
  lg: 'size-8'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  shape = 'square',
  icon,
  loading = false,
  className = '',
  children,
  ...rest
}: {
  variant?: Variant
  size?: Size
  /** circle 只改圆角：图标按钮变正圆，带文字的变胶囊 */
  shape?: Shape
  /** 前置图标，沿用 icons.tsx 的 16px 默认尺寸 */
  icon?: ReactNode
  loading?: boolean
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { children?: ReactNode }): ReactNode {
  const iconOnly = children === undefined || children === null || children === ''
  return (
    <button
      type="button"
      aria-busy={loading || undefined}
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        BASE,
        VARIANT[variant],
        iconOnly ? SQUARE[size] : SIZE[size],
        /* 二选一，不能两个都给：CSS 里 rounded-sm 排在 rounded-pill 后面，同时出现时圆角永远是 4px */
        shape === 'circle' ? 'rounded-pill' : 'rounded-sm',
        className
      )}
    >
      {loading ? <IconSpinner /> : icon}
      {iconOnly ? null : <span className="truncate">{children}</span>}
    </button>
  )
}
