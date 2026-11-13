import { memo, type ButtonHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import { DsIcon, type DsIconName } from '../icons/DsIcon'
import css from './Button.module.css'

/** 按钮语义层级。一个视图里 primary 最多一个。 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
/** 高度档位：24 / 28 / 32 / 36。 */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

/** 按钮通用 props。透传原生 button 属性，`variant` 与 `size` 是 PiDS 增加的。 */
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** 语义层级，默认 secondary。 */
  variant?: ButtonVariant | undefined
  /** 高度档位，默认 md（28px）。 */
  size?: ButtonSize | undefined
  /** 左侧图标。 */
  icon?: DsIconName | undefined
  /** 右侧图标（例如下拉箭头的 chevronDown）。 */
  trailingIcon?: DsIconName | undefined
  /** 占满父容器宽度。 */
  fullWidth?: boolean | undefined
  /** 加载中：保留宽度、显示转圈、禁用交互。 */
  loading?: boolean | undefined
  /** 仅供规范页的状态矩阵强制视觉态；生产代码不要传。 */
  forceState?: 'hover' | 'active' | undefined
  className?: string | undefined
  children?: ReactNode
}

/**
 * 标准按钮。
 *
 * 键盘：原生 `<button>`，Enter/Space 触发，Tab 聚焦，禁用用 `disabled`（同时退出 Tab 序）。
 * 加载中用 `aria-busy` + `aria-disabled` 而非 `disabled`，读屏仍能读到按钮名。
 * @param props - 语义、尺寸、图标、加载态。
 * @returns 一个 button 元素。
 */
export const Button = memo(function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  trailingIcon,
  fullWidth = false,
  loading = false,
  forceState,
  className,
  children,
  disabled = false,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={clsx(css.root, className)}
      data-variant={variant}
      data-size={size}
      data-full-width={fullWidth || undefined}
      data-loading={loading || undefined}
      data-force={forceState}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={disabled || loading || undefined}
    >
      {loading && <DsIcon name="spinner" size={14} className={css.spinner} />}
      <span className={css.label}>
        {icon && <DsIcon name={icon} size={size === 'sm' ? 13 : 14} />}
        {children}
        {trailingIcon && <DsIcon name={trailingIcon} size={size === 'sm' ? 13 : 14} />}
      </span>
    </button>
  )
})

/** 纯图标按钮。必须给 `label`，否则读屏读不出用途。 */
export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'trailingIcon' | 'fullWidth' | 'children'> {
  /** 图标名。 */
  icon: DsIconName
  /** 无障碍名，同时作为原生 title 的兜底。 */
  label: string
}

/**
 * 正方形图标按钮，边长与 Button 同高。
 * @param props - 图标、无障碍名、语义、尺寸。
 * @returns 一个 button 元素。
 */
export const IconButton = memo(function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  forceState,
  disabled = false,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={clsx(css.root, css.icon, className)}
      data-variant={variant}
      data-size={size}
      data-force={forceState}
      disabled={disabled}
      aria-label={label}
      title={rest.title ?? label}
    >
      <DsIcon name={icon} size={size === 'sm' ? 13 : size === 'lg' ? 15 : 14} />
    </button>
  )
})

/** 相连按钮组：用于视图切换等强关联动作。 */
export interface ButtonGroupProps {
  /** 子按钮，建议用 Button。 */
  children: ReactNode
  /** 无障碍组名。 */
  label: string
  className?: string | undefined
}

/**
 * 把多个按钮拼成一组，只有首尾有圆角，相邻边只画一条线。
 * @param props - 子按钮与组名。
 * @returns 一个 role=group 的容器。
 */
export function ButtonGroup({ children, label, className }: ButtonGroupProps) {
  return (
    <div className={clsx(css.group, className)} role="group" aria-label={label}>
      {children}
    </div>
  )
}
