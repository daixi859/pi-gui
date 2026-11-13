import { memo, useRef, type ReactNode, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { DsIcon, type DsIconName } from '../icons/DsIcon'
import css from './display.module.css'

/* ================================= Tabs ================================= */

/** 一个 tab。 */
export interface TabItem {
  id: string
  label: string
  /** 右侧计数或徽标。 */
  count?: number | undefined
  /** 前导图标。 */
  icon?: DsIconName | undefined
  disabled?: boolean | undefined
}

/** Tabs props（受控）。 */
export interface TabsProps {
  items: readonly TabItem[]
  /** 当前选中 id。 */
  value: string
  /** 选中变化。 */
  onChange: (id: string) => void
  /** tablist 的无障碍名。 */
  label: string
  className?: string | undefined
}

/**
 * 页内区块切换。键盘：左右箭头在 tab 间移动并即时切换（自动激活模式），Home/End 跳首尾。
 *
 * 用 roving tabindex：只有当前 tab 在 Tab 序里，整组标签用一次 Tab 就能跳过，
 * 而不是每个标签都要 Tab 一遍。
 * @param props - 标签项、当前值与回调。
 * @returns 一条 tablist。
 */
export function Tabs({ items, value, onChange, label, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement | null>(null)

  const move = (delta: number): void => {
    const enabled = items.filter(item => !item.disabled)
    if (enabled.length === 0) return
    const current = enabled.findIndex(item => item.id === value)
    const next = enabled[(current + delta + enabled.length) % enabled.length]!
    onChange(next.id)
    const node = listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${next.id}"]`)
    node?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      const first = items.find(item => !item.disabled)
      if (first) {
        onChange(first.id)
        listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${first.id}"]`)?.focus()
      }
    } else if (event.key === 'End') {
      event.preventDefault()
      const enabled = items.filter(item => !item.disabled)
      const last = enabled[enabled.length - 1]
      if (last) {
        onChange(last.id)
        listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${last.id}"]`)?.focus()
      }
    }
  }

  return (
    <div ref={listRef} className={clsx(css.tabs, className)} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map(item => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab-id={item.id}
            className={css.tab}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            id={`tab-${item.id}`}
            tabIndex={selected ? 0 : -1}
            data-disabled={item.disabled || undefined}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
          >
            {item.icon && <DsIcon name={item.icon} size={14} />}
            {item.label}
            {item.count !== undefined && <span className={css.tabCount}>{item.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** tab 面板容器：与 Tabs 配对，负责 aria 关联。 */
export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0}>
      {children}
    </div>
  )
}

/* =========================== SegmentedControl =========================== */

/** 分段控件选项。 */
export interface SegmentOption {
  value: string
  label: string
  icon?: DsIconName | undefined
}

/** 分段控件 props。 */
export interface SegmentedControlProps {
  options: readonly SegmentOption[]
  value: string
  onChange: (value: string) => void
  /** radiogroup 的无障碍名。 */
  label: string
  /** 隐藏文字只留图标。 */
  iconOnly?: boolean | undefined
  className?: string | undefined
}

/**
 * 分段控件：2–4 个互斥选项的即时切换。
 *
 * 用 `role=radiogroup` 而不是 tablist——它是在同一处切换**同一个东西的视图**，
 * 语义上是「选一个值」，不是切换内容面板。方向键移动由原生 radio 提供。
 * @param props - 选项、当前值与回调。
 * @returns 一个 radiogroup。
 */
export function SegmentedControl({ options, value, onChange, label, iconOnly = false, className }: SegmentedControlProps) {
  return (
    <div className={clsx(css.segmented, className)} role="radiogroup" aria-label={label}>
      {options.map(option => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            className={css.segment}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={event => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp') return
              event.preventDefault()
              const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
              const index = options.findIndex(item => item.value === value)
              const next = options[(index + step + options.length) % options.length]!
              onChange(next.value)
            }}
          >
            {option.icon && <DsIcon name={option.icon} size={13} />}
            {!iconOnly && option.label}
          </button>
        )
      })}
    </div>
  )
}

/* ================================ Avatar ================================ */

/** 头像 props。 */
export interface AvatarProps {
  /** 显示名；没有图片时取首字。 */
  name: string
  /** 图片地址。 */
  src?: string | undefined
  /** 尺寸。 */
  size?: 'sm' | 'md' | 'lg' | undefined
  /** 配色：有图为默认，无图用强调色。 */
  tone?: 'accent' | 'neutral' | undefined
  /** 在线状态点。 */
  presence?: 'online' | 'busy' | 'away' | undefined
  className?: string | undefined
}

/** 取名字里第一个有意义的字符（跳过空格与 emoji 变体选择符）。 */
function initial(name: string): string {
  const cleaned = name.trim()
  return cleaned.length > 0 ? (Array.from(cleaned)[0] ?? '?').toUpperCase() : '?'
}

/**
 * 头像。没有图片时用首字母，不生成占位图请求。
 *
 * 装饰性：名字由旁边的文本承担，因此默认 aria-hidden；
 * 单独使用时给 `name` 即可作为可访问名。
 * @param props - 名字、图片与状态。
 * @returns 头像（可能带状态点）。
 */
export const Avatar = memo(function Avatar({ name, src, size = 'md', tone = 'accent', presence, className }: AvatarProps) {
  const node = (
    <span
      className={clsx(css.avatar, className)}
      data-size={size}
      data-tone={src !== undefined ? undefined : tone}
      role="img"
      aria-label={name}
    >
      {src !== undefined ? <img src={src} alt="" /> : initial(name)}
    </span>
  )
  if (presence === undefined) return node
  return (
    <span className={css.avatarWrap}>
      {node}
      <span className={css.presence} data-state={presence} aria-hidden="true" />
    </span>
  )
})

/* ================================ Badge ================================ */

/** 徽标语气。 */
export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

/** 徽标 props。 */
export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone | undefined
  size?: 'sm' | 'md' | undefined
  /** 只有描边没有底色。 */
  outline?: boolean | undefined
  /** 前导圆点（状态用）。 */
  dot?: boolean | undefined
  className?: string | undefined
}

/**
 * 数量或状态徽标。只承载短文本，超过 3 个字应该用 Tag。
 * @param props - 文本、语气与尺寸。
 * @returns 一个行内徽标。
 */
export const Badge = memo(function Badge({ children, tone = 'neutral', size = 'md', outline = false, dot = false, className }: BadgeProps) {
  return (
    <span className={clsx(css.badge, className)} data-tone={tone} data-size={size} data-outline={outline || undefined}>
      {dot && <span className={css.dotBadge} style={{ background: 'currentColor' }} aria-hidden="true" />}
      {children}
    </span>
  )
})

/** 可删除标签 props。 */
export interface TagProps {
  children: ReactNode
  /** 提供则显示删除按钮。 */
  onRemove?: (() => void) | undefined
  /** 删除按钮的无障碍名模板。 */
  removeLabel?: string | undefined
  className?: string | undefined
}

/**
 * 标签：比 Badge 更长、可删除的实体（例如已选条件、附件名）。
 * @param props - 文本与删除回调。
 * @returns 一个行内标签。
 */
export function Tag({ children, onRemove, removeLabel = '移除', className }: TagProps) {
  return (
    <span className={clsx(css.tag, className)}>
      {children}
      {onRemove !== undefined && (
        <button type="button" className={css.tagRemove} aria-label={removeLabel} onClick={onRemove}>
          <DsIcon name="close" size={10} />
        </button>
      )}
    </span>
  )
}

/* ================================= Card ================================= */

/** 卡片 props。 */
export interface CardProps {
  children: ReactNode
  /** 带标题区。 */
  title?: string | undefined
  /** 标题下的说明。 */
  description?: string | undefined
  /** 标题右侧的动作区。 */
  actions?: ReactNode | undefined
  /** 底部动作区。 */
  footer?: ReactNode | undefined
  /** 加一层极淡投影（用于脱离背景的卡片）。 */
  elevated?: boolean | undefined
  /** 去掉边框与底色，只保留布局。 */
  flush?: boolean | undefined
  className?: string | undefined
}

/**
 * 卡片：一组相关内容的边界。默认靠 1px 描边分组，不靠阴影。
 * @param props - 内容与可选的头/尾区域。
 * @returns 一个 section 容器。
 */
export function Card({ children, title, description, actions, footer, elevated = false, flush = false, className }: CardProps) {
  const hasHead = title !== undefined || actions !== undefined
  return (
    <section className={clsx(css.card, className)} data-elevated={elevated || undefined} data-flush={flush || undefined}>
      {hasHead && (
        <div className={css.cardHead}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
            {title !== undefined && <h3 className={css.cardTitle}>{title}</h3>}
            {description !== undefined && <p className={css.cardDesc}>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={css.cardBody}>{children}</div>
      {footer !== undefined && <div className={css.cardFoot}>{footer}</div>}
    </section>
  )
}

/* ================================ Divider ================================ */

/** 分隔线 props。 */
export interface DividerProps {
  orientation?: 'horizontal' | 'vertical' | undefined
  /** 中间带文字标签（仅水平方向）。 */
  label?: string | undefined
  className?: string | undefined
}

/**
 * 分隔线。水平用于分组，垂直用于工具栏里的并列动作。
 * @param props - 方向与可选标签。
 * @returns 一个 hr 或带标签的行。
 */
export function Divider({ orientation = 'horizontal', label, className }: DividerProps) {
  if (label !== undefined && orientation === 'horizontal') {
    return (
      <div className={clsx(css.dividerLabeled, className)} role="separator" aria-label={label}>
        {label}
      </div>
    )
  }
  return <hr className={clsx(css.divider, className)} data-orientation={orientation} />
}

/* =============================== Skeleton =============================== */

/** 骨架屏 props。 */
export interface SkeletonProps {
  /** 宽度，默认 100%。 */
  width?: number | string | undefined
  /** 高度，默认 12px。 */
  height?: number | string | undefined
  /** 圆角覆盖。 */
  radius?: number | string | undefined
  className?: string | undefined
}

/**
 * 骨架占位。必须与真实内容同样的尺寸，否则加载完成时布局会跳。
 * @param props - 尺寸。
 * @returns 一个动画占位块。
 */
export function Skeleton({ width = '100%', height = 12, radius, className }: SkeletonProps) {
  return (
    <span
      className={clsx(css.skeleton, className)}
      style={{ display: 'block', width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

/* ============================== EmptyState ============================== */

/** 空态 props。 */
export interface EmptyStateProps {
  /** 图标名。 */
  icon?: DsIconName | undefined
  /** 一句话说明发生了什么。 */
  title: string
  /** 下一步该做什么。 */
  description?: string | undefined
  /** 动作按钮区。 */
  actions?: ReactNode | undefined
  className?: string | undefined
}

/**
 * 空态：说明现状 + 给出一个出路。没有动作按钮的空态基本等于死路。
 * @param props - 图标、文案与动作。
 * @returns 一个居中的占位区。
 */
export function EmptyState({ icon = 'chat', title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={clsx(css.empty, className)}>
      <span className={css.emptyIcon} aria-hidden="true">
        <DsIcon name={icon} size={18} />
      </span>
      <h3 className={css.emptyTitle}>{title}</h3>
      {description !== undefined && <p className={css.emptyDesc}>{description}</p>}
      {actions !== undefined && <div className={css.emptyActions}>{actions}</div>}
    </div>
  )
}

/* ================================ NavItem ================================ */

/** 侧栏导航项 props。 */
export interface NavItemProps {
  /** 文案。 */
  label: string
  /** 前导图标。 */
  icon?: DsIconName | undefined
  /** 右侧元信息（计数、状态）。 */
  meta?: ReactNode | undefined
  /** 当前项。 */
  active?: boolean | undefined
  /** 禁用。 */
  disabled?: boolean | undefined
  /** 点击回调。 */
  onSelect?: (() => void) | undefined
  /** 嵌套层级用。 */
  nested?: boolean | undefined
  className?: string | undefined
}

/**
 * 侧栏导航项：用 button 而非 a，因为这里没有 URL 路由；
 * 当前项用 `aria-current=page` 表达，读屏能报出「当前」。
 * @param props - 文案、图标与状态。
 * @returns 一个导航按钮。
 */
export function NavItem({ label, icon, meta, active = false, disabled = false, onSelect, nested = false, className }: NavItemProps) {
  return (
    <button
      type="button"
      className={clsx(css.navItem, className)}
      aria-current={active ? 'page' : undefined}
      data-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onSelect}
    >
      {icon && (
        <span className={css.navIcon}>
          <DsIcon name={icon} size={15} />
        </span>
      )}
      <span className={css.navText}>{label}</span>
      {meta !== undefined && <span className={css.navMeta}>{meta}</span>}
      {nested && null}
    </button>
  )
}

/** 导航分组。 */
export interface NavGroupProps {
  /** 分组标题，空则不显示。 */
  label?: string | undefined
  children: ReactNode
  className?: string | undefined
}

/**
 * 导航分组容器。
 * @param props - 标题与子项。
 * @returns 一个 nav 容器。
 */
export function NavGroup({ label, children, className }: NavGroupProps) {
  return (
    <nav className={clsx(css.nav, className)} aria-label={label}>
      {label !== undefined && <div className={css.navGroupLabel}>{label}</div>}
      {children}
    </nav>
  )
}
