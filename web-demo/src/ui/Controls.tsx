import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: IconName
}

/** 分段选择器：等宽轨道 + 滑动指示块，方向键切换（radiogroup 语义） */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className = ''
}: {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )
  const count = options.length

  const move = (event: KeyboardEvent, next: number) => {
    event.preventDefault()
    const wrapped = (next + count) % count
    onChange(options[wrapped].value)
    refs.current[wrapped]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, i: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(event, i + 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(event, i - 1)
    else if (event.key === 'Home') move(event, 0)
    else if (event.key === 'End') move(event, count - 1)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative inline-grid rounded-lg bg-[var(--cds-segmented-track,#f0efec)] p-[2px] text-xs ${className}`}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[2px] top-[2px] rounded-md bg-[var(--cds-segmented-thumb,var(--cds-surface-2))] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[left] duration-200 ease-out"
        style={{
          width: `calc((100% - 4px) / ${count})`,
          left: `calc(2px + ${index} * (100% - 4px) / ${count})`
        }}
      />
      {options.map((option, i) => {
        const active = i === index
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[i] = node
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, i)}
            className={`relative z-10 flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
              active
                ? 'text-[var(--cds-text-primary)]'
                : 'text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)]'
            }`}
          >
            {option.icon && <Icon name={option.icon} size={13} />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** 开关：button[role=switch]，空格 / 回车均可切换 */
export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked
          ? 'bg-[var(--cds-clay)]'
          : 'bg-[var(--cds-alpha-3)] hover:bg-[var(--cds-alpha-4)]'
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/** 表单行：左侧说明，右侧控件；窄屏自动堆叠 */
export function FieldRow({
  title,
  hint,
  children
}: {
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-3 border-b border-[var(--cds-border)] py-5 last:border-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--cds-text-primary)]">{title}</div>
        <p className="mt-1 text-xs leading-5 text-[var(--cds-text-secondary)]">{hint}</p>
      </div>
      <div className="justify-self-start md:justify-self-end">{children}</div>
    </div>
  )
}
