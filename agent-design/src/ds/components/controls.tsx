import {
  memo,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ChangeEvent,
} from 'react'
import clsx from 'clsx'
import { DsIcon } from '../icons/DsIcon'
import css from './controls.module.css'

/** 表单控件共用尺寸档位。 */
export type ControlSize = 'sm' | 'md' | 'lg'

/** 带标签、提示与错误信息的字段外壳。所有控件都该套这一层。 */
export interface FieldProps {
  /** 字段名。 */
  label: string
  /** 辅助说明，常态显示。 */
  hint?: string | undefined
  /** 校验错误的说明；有值即进入 invalid 态。 */
  error?: string | undefined
  /** 是否必填，会在标签后加标记。 */
  required?: boolean | undefined
  /** 控件的 id；不传时内部生成并与 label 关联。 */
  htmlFor?: string | undefined
  className?: string | undefined
  children: ReactNode
}

/**
 * 字段外壳：标签 + 控件 + 提示/错误。
 *
 * 提示与错误不会同时显示——错误优先，避免两行互相矛盾。
 * @param props - 文案、错误态与子控件。
 * @returns 一个纵向排列的容器。
 */
export function Field({ label, hint, error, required = false, htmlFor, className, children }: FieldProps) {
  return (
    <div className={clsx(css.field, className)}>
      <label className={css.label} htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {error !== undefined ? (
        <span className={css.hint} data-invalid role="alert">
          {error}
        </span>
      ) : (
        hint !== undefined && <span className={css.hint}>{hint}</span>
      )}
    </div>
  )
}

/** 输入框 props。 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'className'> {
  /** 高度档位，默认 md（28px）。 */
  size?: ControlSize | undefined
  /** 前导图标，例如搜索。 */
  icon?: 'search' | undefined
  /** 尾部内容，例如 Kbd 提示或字数。 */
  trailing?: ReactNode
  /** 校验错误态（通常由 Field 传入）。 */
  invalid?: boolean | undefined
  className?: string | undefined
}

/**
 * 单行输入框。
 *
 * 键盘：Tab 进出，Enter 提交所在表单，Esc 由使用方处理（不自动清空）。
 * @param props - 尺寸、图标、错误态与原生 input 属性。
 * @returns 一个带装饰的输入框。
 */
export const Input = memo(function Input({
  size = 'md',
  icon,
  trailing,
  invalid = false,
  className,
  disabled = false,
  ...rest
}: InputProps) {
  return (
    <div
      className={clsx(css.control, className)}
      data-size={size}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
    >
      {icon && (
        <span className={css.leading}>
          <DsIcon name={icon} size={14} />
        </span>
      )}
      <input {...rest} className={css.input} disabled={disabled} aria-invalid={invalid || undefined} />
      {trailing !== undefined && <span className={css.trailing}>{trailing}</span>}
    </div>
  )
})

/** 多行输入 props。 */
export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  /** 校验错误态。 */
  invalid?: boolean | undefined
  /** 显示右下角字数统计，需要同时给 maxLength。 */
  showCount?: boolean | undefined
  className?: string | undefined
}

/**
 * 多行输入。默认不可手动拖拽高度（拖拽会破坏紧凑布局），需要自适应高度的场景由使用方控制 rows。
 * @param props - 错误态、字数统计与原生 textarea 属性。
 * @returns 一个带装饰的多行输入。
 */
export const Textarea = memo(function Textarea({
  invalid = false,
  showCount = false,
  className,
  disabled = false,
  maxLength,
  value,
  ...rest
}: TextareaProps) {
  const length = typeof value === 'string' ? value.length : 0
  return (
    <div
      className={clsx(css.control, css.textarea, className)}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
    >
      <textarea {...rest} value={value} maxLength={maxLength} className={css.input} disabled={disabled} aria-invalid={invalid || undefined} />
      {showCount && maxLength !== undefined && (
        <span className={css.hint} aria-hidden="true">
          {length}/{maxLength}
        </span>
      )}
    </div>
  )
})

/** 下拉选项。 */
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean | undefined
}

/** 原生下拉 props。 */
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'className' | 'children'> {
  /** 选项列表。 */
  options: readonly SelectOption[]
  /** 高度档位。 */
  size?: ControlSize | undefined
  /** 占位选项：只在受控值为空时出现，且不可选。 */
  placeholder?: string | undefined
  /** 校验错误态。 */
  invalid?: boolean | undefined
  className?: string | undefined
}

/**
 * 下拉选择。
 *
 * 用原生 `<select>` 而不是自绘菜单：原生控件在 Windows 上有系统级键盘行为、
 * 屏幕阅读器支持与移动端滚轮，自绘需要重写全部这些且做不到一样好。
 * 需要搜索或多选时用 CommandPalette（P1）。
 * @param props - 选项、尺寸与原生 select 属性。
 * @returns 一个带箭头的下拉。
 */
export const Select = memo(function Select({
  options,
  size = 'md',
  placeholder,
  invalid = false,
  className,
  disabled = false,
  value,
  defaultValue,
  ...rest
}: SelectProps) {
  const empty = value === '' || value === undefined
  return (
    <div className={css.selectWrap}>
      <select
        {...rest}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        className={clsx(css.control, css.select, className)}
        data-size={size}
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
      >
        {empty && placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <span className={css.selectArrow}>
        <DsIcon name="chevronDown" size={14} />
      </span>
    </div>
  )
})

/** 勾选类控件的公共 props。 */
export interface ChoiceProps {
  /** 控件名（表单提交用）。 */
  name?: string | undefined
  /** 主标签文本。 */
  label: string
  /** 次要说明，换行显示在标签下方。 */
  description?: string | undefined
  /** 受控选中态。 */
  checked?: boolean | undefined
  /** 默认选中（非受控）。 */
  defaultChecked?: boolean | undefined
  /** 禁用。 */
  disabled?: boolean | undefined
  /** 半选（仅 Checkbox 有意义）。 */
  indeterminate?: boolean | undefined
  /** 值变化回调。 */
  onChange?: ((checked: boolean) => void) | undefined
  /** 原生 value（表单提交用）。 */
  value?: string | undefined
  className?: string | undefined
}

/** 复选框 props。 */
export type CheckboxProps = ChoiceProps
/** 单选框 props。 */
export type RadioProps = ChoiceProps

/**
 * 复选框。原生 input 做语义，视觉由 span 画，因此键盘与读屏行为与浏览器一致。
 * @param props - 标签、选中态与回调。
 * @returns 一个 label 包裹的复选框。
 */
export const Checkbox = memo(function Checkbox({
  name,
  label,
  description,
  checked,
  defaultChecked,
  disabled = false,
  indeterminate = false,
  onChange,
  value,
  className,
}: ChoiceProps) {
  const id = useId()
  const handle = (event: ChangeEvent<HTMLInputElement>): void => onChange?.(event.target.checked)
  return (
    <label className={clsx(css.choice, className)} data-disabled={disabled || undefined} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        className={css.box}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={handle}
        ref={element => {
          if (element) element.indeterminate = indeterminate && !checked
        }}
      />
      <span className={css.mark} aria-hidden="true">
        {(checked === true || indeterminate) && <DsIcon name={indeterminate && checked !== true ? 'more' : 'check'} size={11} />}
      </span>
      <span className={css.choiceText}>
        <span className={css.choiceLabel}>{label}</span>
        {description !== undefined && <span className={css.choiceDesc}>{description}</span>}
      </span>
    </label>
  )
})

/**
 * 单选框。同一 `name` 下互斥；方向键在组内移动由浏览器原生提供。
 * @param props - 标签、选中态与回调。
 * @returns 一个 label 包裹的单选框。
 */
export const Radio = memo(function Radio({
  name,
  label,
  description,
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  value,
  className,
}: ChoiceProps) {
  const id = useId()
  const handle = (event: ChangeEvent<HTMLInputElement>): void => onChange?.(event.target.checked)
  return (
    <label className={clsx(css.choice, className)} data-disabled={disabled || undefined} htmlFor={id}>
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        className={css.box}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={handle}
      />
      <span className={clsx(css.mark, css.markRadio)} aria-hidden="true">
        <span className={css.radioDot} />
      </span>
      <span className={css.choiceText}>
        <span className={css.choiceLabel}>{label}</span>
        {description !== undefined && <span className={css.choiceDesc}>{description}</span>}
      </span>
    </label>
  )
})

/** 开关 props。 */
export interface SwitchProps {
  /** 无障碍名（开关正文常由外部标题承担）。 */
  label: string
  /** 受控状态。 */
  checked?: boolean | undefined
  /** 默认状态（非受控）。 */
  defaultChecked?: boolean | undefined
  /** 禁用。 */
  disabled?: boolean | undefined
  /** 状态变化回调。 */
  onChange?: ((checked: boolean) => void) | undefined
  /** 开关右侧是否显示文字标签。 */
  showLabel?: boolean | undefined
  className?: string | undefined
}

/**
 * 开关：立即生效的二态设置。需要「提交后才生效」时用 Checkbox。
 *
 * 键盘：Space 切换；读屏报 `role=switch` 与开关状态。
 * @param props - 状态与回调。
 * @returns 一个 role=switch 的控件。
 */
export const Switch = memo(function Switch({
  label,
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  showLabel = false,
  className,
}: SwitchProps) {
  const id = useId()
  const handle = (event: ChangeEvent<HTMLInputElement>): void => onChange?.(event.target.checked)
  return (
    <label className={clsx(css.switch, className)} data-disabled={disabled || undefined} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={css.box}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={handle}
        aria-label={showLabel ? undefined : label}
      />
      <span className={css.switchTrack} data-on={(checked ?? defaultChecked) || undefined} aria-hidden="true">
        <span className={css.switchThumb} />
      </span>
      {showLabel && <span className={css.choiceLabel}>{label}</span>}
    </label>
  )
})
