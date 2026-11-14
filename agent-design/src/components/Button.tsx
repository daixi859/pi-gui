import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconSpinner } from './icons'
import styles from './Button.module.css'

/**
 * 全站唯一按钮。五种语义变体 × 三档尺寸 × 两档形状，图标作为插槽。
 * 无 children 时按图标按钮渲染成正方形，此时必须给 aria-label。
 * 焦点环由 Button.module.css 自带，不依赖宿主页面的全局样式。
 */

type Variant = 'primary' | 'secondary' | 'raised' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'
type Shape = 'square' | 'circle'

const VARIANT: Record<Variant, string> = {
  /* 一屏只留一个主动作 */
  primary: styles.primary,
  secondary: styles.secondary,
  /* 浮在内容/滚动区上方的实底按钮：hover 也只能加深，不能变半透明露出底下的字 */
  raised: styles.raised,
  ghost: styles.ghost,
  danger: styles.danger
}

/* 24 / 28（默认，常规用这档） / 32 */
const SIZE: Record<Size, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg
}

/* 图标按钮保持与高度同宽的正方形热区 */
const SQUARE: Record<Size, string> = {
  sm: styles.squareSm,
  md: styles.squareMd,
  lg: styles.squareLg
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
        styles.button,
        VARIANT[variant],
        iconOnly ? SQUARE[size] : SIZE[size],
        shape === 'circle' ? styles.circle : styles.square,
        className
      )}
    >
      {loading ? <IconSpinner /> : icon}
      {iconOnly ? null : <span className={styles.label}>{children}</span>}
    </button>
  )
}
