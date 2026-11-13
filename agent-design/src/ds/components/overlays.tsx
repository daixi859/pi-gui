import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { DsIcon, type DsIconName } from '../icons/DsIcon'
import { Button } from './Button'
import { useAnchorPosition, useDismiss, useFocusTrap, useScrollLock } from '../lib/useOverlay'
import { PiPortal } from '../theme/PiRoot'
import css from './overlays.module.css'

/* =========================== 可复用浮层部件 ===========================
 * 每个浮层都被拆成「面板本体」与「定位/开关外壳」两半：
 *   MenuList / TooltipBubble / DialogSurface 是纯面板，可以在任何地方内联渲染
 *   （规范页做深浅并排、把菜单嵌进对话框都需要）；
 *   Menu / Tooltip / Dialog 负责传送门、定位与关闭行为。
 */

/** 锚点触发器要接的 props。 */
export interface TriggerProps {
  ref: (node: HTMLElement | null) => void
  onClick: () => void
  'aria-expanded': boolean
  'aria-haspopup': 'menu' | 'dialog' | 'listbox'
}

/* ================================ Menu ================================ */

/** 菜单项。 */
export interface MenuItem {
  id: string
  label: string
  /** 次要说明。 */
  description?: string | undefined
  /** 左侧图标。 */
  icon?: DsIconName | undefined
  /** 快捷键提示，仅展示不解析。 */
  shortcut?: string | undefined
  /** 危险操作着色。 */
  tone?: 'default' | 'danger' | undefined
  /** 已选中（显示对勾，用于单选组）。 */
  checked?: boolean | undefined
  /** 禁用。 */
  disabled?: boolean | undefined
  /** 点击回调。 */
  onSelect?: (() => void) | undefined
}

/** 分隔线或分组标题。 */
export interface MenuSeparator {
  id: string
  separator: true
  /** 有值即渲染成分组标题而不是一条线。 */
  label?: string | undefined
}

/** 菜单条目联合类型。 */
export type MenuEntry = MenuItem | MenuSeparator

/** 判断条目是否为分隔线。 */
export function isSeparator(entry: MenuEntry): entry is MenuSeparator {
  return 'separator' in entry
}

/** 菜单面板 props。 */
export interface MenuListProps {
  items: readonly MenuEntry[]
  /** 无障碍名。 */
  label: string
  /** 选中后回调；不传则面板只做展示。 */
  onSelect?: ((id: string) => void) | undefined
  /** 当前活动索引（受控）；不传则内部管理。 */
  activeIndex?: number | undefined
  /** 外部注入的额外类。 */
  className?: string | undefined
}

/**
 * 菜单面板本体（不含定位与开关）。可在传送门里渲染，也可内联。
 *
 * 键盘：上下键移动、Home/End 跳首尾、Enter/Space 选择、Tab 交出焦点。
 * 焦点用 roving tabindex：整组只有一项在 Tab 序里，避免逐项 Tab 过去。
 * @param props - 条目、当前活动项与回调。
 * @returns 一个 role=menu 的容器。
 */
export function MenuList({ items, label, onSelect, activeIndex: controlledIndex, className }: MenuListProps) {
  const [innerIndex, setInnerIndex] = useState(() => {
    const first = items.findIndex(entry => !isSeparator(entry) && !entry.disabled)
    return first < 0 ? 0 : first
  })
  const listRef = useRef<HTMLDivElement | null>(null)
  const activeIndex = controlledIndex ?? innerIndex
  const setActive = (index: number): void => {
    if (controlledIndex === undefined) setInnerIndex(index)
  }

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    node?.focus()
  }, [activeIndex])

  const move = (delta: number): void => {
    const enabled = items
      .map((entry, index) => ({ entry, index }))
      .filter((item): item is { entry: MenuItem; index: number } => !isSeparator(item.entry) && !item.entry.disabled)
    if (enabled.length === 0) return
    const current = enabled.findIndex(item => item.index === activeIndex)
    const next = enabled[(current + delta + enabled.length) % enabled.length]!
    setActive(next.index)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        move(-items.length)
        break
      case 'End':
        event.preventDefault()
        move(items.length)
        break
      default:
        break
    }
  }

  return (
    <div ref={listRef} className={className === undefined ? css.menu : `${css.menu} ${className}`} role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((entry, index) =>
        isSeparator(entry) ? (
          entry.label === undefined ? (
            <hr key={entry.id} className={css.menuSeparator} />
          ) : (
            <div key={entry.id} className={css.menuLabel} role="presentation">
              {entry.label}
            </div>
          )
        ) : (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            className={css.menuItem}
            data-index={index}
            data-active={index === activeIndex || undefined}
            data-disabled={entry.disabled || undefined}
            data-tone={entry.tone}
            tabIndex={index === activeIndex ? 0 : -1}
            aria-disabled={entry.disabled || undefined}
            aria-checked={entry.checked}
            onClick={() => {
              if (entry.disabled) return
              entry.onSelect?.()
              onSelect?.(entry.id)
            }}
          >
            {entry.icon && <DsIcon name={entry.icon} size={14} />}
            <span className={css.menuItemText}>
              <span className={css.menuItemLabel}>{entry.label}</span>
              {entry.description !== undefined && <span className={css.menuItemDesc}>{entry.description}</span>}
            </span>
            {entry.checked === true && (
              <span className={css.menuItemCheck}>
                <DsIcon name="check" size={13} />
              </span>
            )}
            {entry.shortcut !== undefined && <span className={css.menuItemShortcut}>{entry.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  )
}

/** 菜单 props。 */
export interface MenuProps {
  /** 触发器渲染函数；收到的 props 必须挂到可聚焦元素上。 */
  trigger: (props: TriggerProps) => ReactNode
  /** 条目。 */
  items: readonly MenuEntry[]
  /** 对齐方式。 */
  align?: 'start' | 'end' | undefined
  /** 无障碍名。 */
  label: string
}

/**
 * 下拉菜单：触发器 + 传送门面板。
 * @param props - 触发器与条目。
 * @returns 触发器与浮层。
 */
export function Menu({ trigger, items, align = 'start', label }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const { position } = useAnchorPosition(open, anchorRef, layerRef, align)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, rootRef, close)

  return (
    <div ref={rootRef} style={{ display: 'inline-flex' }}>
      {trigger({
        ref: (node: HTMLElement | null) => {
          anchorRef.current = node
        },
        onClick: () => setOpen(!open),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {open && (
        <PiPortal>
          <div
            ref={layerRef}
            className={css.pop}
            data-side={position.side}
            data-flush
            style={{ left: position.x, top: position.y }}
          >
            <MenuList items={items} label={label} onSelect={close} />
          </div>
        </PiPortal>
      )}
    </div>
  )
}

/* ============================ Popover ============================ */

/** 浮层面板 props（可内联复用）。 */
export interface PopoverProps {
  /** 触发器。 */
  trigger: (props: TriggerProps) => ReactNode
  /** 面板内容。 */
  children: ReactNode
  /** 对齐方式。 */
  align?: 'start' | 'end' | undefined
  /** 去掉内边距（纯列表或纯图表用）。 */
  flush?: boolean | undefined
  /** 面板至少与触发器同宽。 */
  matchWidth?: boolean | undefined
  /** 受控开关。 */
  open?: boolean | undefined
  /** 开关变化回调。 */
  onOpenChange?: ((open: boolean) => void) | undefined
  /** 无障碍名。 */
  label?: string | undefined
}

/**
 * 通用锚定浮层：点外部关闭、Esc 关闭、空间不足自动翻面。
 * 内容自由，键盘模型由内容自己决定；需要标准菜单行为时用 `Menu`。
 * @param props - 触发器、内容与对齐。
 * @returns 触发器与传送门浮层。
 */
export function Popover({
  trigger,
  children,
  align = 'start',
  flush = false,
  matchWidth = false,
  open,
  onOpenChange,
  label,
}: PopoverProps) {
  const [innerOpen, setInnerOpen] = useState(false)
  const isOpen = open ?? innerOpen
  const rootRef = useRef<HTMLDivElement | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const { position } = useAnchorPosition(isOpen, anchorRef, layerRef, align)

  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInnerOpen(next)
      onOpenChange?.(next)
    },
    [open, onOpenChange],
  )
  useDismiss(isOpen, rootRef, useCallback(() => setOpen(false), [setOpen]))

  return (
    <div ref={rootRef} style={{ display: 'inline-flex' }}>
      {trigger({
        ref: (node: HTMLElement | null) => {
          anchorRef.current = node
        },
        onClick: () => setOpen(!isOpen),
        'aria-expanded': isOpen,
        'aria-haspopup': 'dialog',
      })}
      {isOpen && (
        <PiPortal>
          <div
            ref={layerRef}
            className={css.pop}
            data-side={position.side}
            data-flush={flush || undefined}
            role="dialog"
            aria-label={label}
            style={{ left: position.x, top: position.y, minWidth: matchWidth ? position.width : undefined }}
          >
            {children}
          </div>
        </PiPortal>
      )}
    </div>
  )
}

/* =============================== Tooltip =============================== */

/** 提示气泡本体（不含定位），可内联渲染。 */
export const TooltipBubble = memo(function TooltipBubble({ content }: { content: string }) {
  return (
    <div className={css.tooltip} role="tooltip">
      {content}
    </div>
  )
})

/** Tooltip props。 */
export interface TooltipProps {
  /** 提示文字。 */
  content: string
  /** 触发元素。 */
  children: ReactNode
  /** 偏好方位。 */
  side?: 'bottom' | 'top' | undefined
  /** 显示延迟 ms，默认 400——立即出现会在鼠标扫过界面时不停闪。 */
  delay?: number | undefined
  className?: string | undefined
}

/**
 * 悬浮提示。只用于补充说明，不承载唯一信息：触屏与键盘用户可能永远看不到。
 *
 * 键盘：聚焦 400ms 后显示，Esc 立即隐藏；气泡本身 `pointer-events: none`，不改变鼠标轨迹。
 * @param props - 文案与触发元素。
 * @returns 包裹触发元素的 span。
 */
export function Tooltip({ content, children, side = 'top', delay = 400, className }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const holderRef = useRef<HTMLSpanElement | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = (): void => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(true), delay)
  }
  const hide = (): void => {
    window.clearTimeout(timer.current)
    setVisible(false)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!visible) return
    const anchor = holderRef.current
    const tip = tipRef.current
    if (!anchor || !tip) return
    const rect = anchor.getBoundingClientRect()
    const width = tip.offsetWidth
    const height = tip.offsetHeight
    const x = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
    const y = side === 'top' ? rect.top - height - 6 : rect.bottom + 6
    setPosition({ x, y })
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible, side])

  return (
    <span
      ref={holderRef}
      className={className}
      style={{ display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <PiPortal>
          <div ref={tipRef} style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 80 }}>
            <TooltipBubble content={content} />
          </div>
        </PiPortal>
      )}
    </span>
  )
}

/* ================================ Kbd ================================ */

/**
 * 键帽：展示快捷键，只做视觉不分键位。
 * @param props.children - 按键名。
 * @returns 一个行内 kbd。
 */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={css.kbd}>{children}</kbd>
}

/* ============================== Dialog ============================== */

/** 对话框面板 props（不含遮罩，可内联）。 */
export interface DialogSurfaceProps {
  title: string
  /** 标题的 id，默认自动生成。 */
  titleId?: string | undefined
  description?: string | undefined
  descriptionId?: string | undefined
  children?: ReactNode
  footer?: ReactNode
  /** 右上角关闭按钮；不传则不显示。 */
  onClose?: (() => void) | undefined
  width?: number | undefined
  className?: string | undefined
}

/**
 * 对话框面板本体：标题 + 说明 + 内容 + 动作。
 * 内联渲染时它就是一个普通卡片（规范页的双主题对照需要）；
 * 真正弹出时由 `Dialog` 套上遮罩、焦点陷阱与 Esc。
 * @param props - 内容与宽度。
 * @returns 一个 role=dialog 的面板。
 */
export function DialogSurface({
  title,
  titleId,
  description,
  descriptionId,
  children,
  footer,
  onClose,
  width,
  className,
}: DialogSurfaceProps) {
  const autoTitle = useId()
  const autoDesc = useId()
  const headId = titleId ?? `pi-dialog-title-${autoTitle}`
  const descId = descriptionId ?? `pi-dialog-desc-${autoDesc}`
  return (
    <div
      className={className === undefined ? css.dialog : `${css.dialog} ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headId}
      aria-describedby={description === undefined ? undefined : descId}
      tabIndex={-1}
      style={width === undefined ? undefined : { width: `min(${width}px, 100%)` }}
      onMouseDown={event => event.stopPropagation()}
    >
      <div className={css.dialogHead}>
        <div className={css.dialogHeadText}>
          <h2 id={headId} className={css.dialogTitle}>
            {title}
          </h2>
          {description !== undefined && (
            <p id={descId} className={css.dialogDesc}>
              {description}
            </p>
          )}
        </div>
        {onClose !== undefined && (
          <Button variant="ghost" size="sm" icon="close" aria-label="关闭" onClick={onClose} />
        )}
      </div>
      {children !== undefined && <div className={css.dialogBody}>{children}</div>}
      {footer !== undefined && <div className={css.dialogFoot}>{footer}</div>}
    </div>
  )
}

/** Dialog props。 */
export interface DialogProps extends Omit<DialogSurfaceProps, 'className'> {
  /** 是否打开。 */
  open: boolean
  /** 关闭回调（Esc、点遮罩、关闭按钮都走这里）。 */
  onClose: () => void
  /** 点遮罩是否关闭，默认 true。填写类对话框应关掉，避免误删输入。 */
  dismissOnScrim?: boolean | undefined
}

/**
 * 模态对话框。
 *
 * 键盘：Esc 关闭、Tab 在内部循环、关闭后焦点回到触发元素；打开时锁页面滚动。
 * @param props - 内容、开关与关闭策略。
 * @returns 传送门渲染的遮罩 + 面板。
 */
export function Dialog({ open, onClose, dismissOnScrim = true, ...surface }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useFocusTrap(open, dialogRef)
  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null
  return (
    <PiPortal>
      <div
        className={css.scrim}
        onMouseDown={event => {
          if (dismissOnScrim && event.target === event.currentTarget) onClose()
        }}
      >
        <div ref={dialogRef}>
          <DialogSurface {...surface} onClose={onClose} />
        </div>
      </div>
    </PiPortal>
  )
}

/* ================================ Toast ================================ */

/** Toast 语气。 */
export type ToastTone = 'info' | 'success' | 'warning' | 'danger'

/** 一条 Toast 的数据。 */
export interface ToastItem {
  id: string
  message: string
  tone?: ToastTone | undefined
  /** 自动消失毫秒数，默认 4000；0 表示常驻。 */
  duration?: number | undefined
}

const TOAST_ICON: Record<ToastTone, DsIconName> = {
  info: 'alert',
  success: 'check',
  warning: 'alert',
  danger: 'ban',
}

/** 单条 Toast props。 */
export interface ToastProps extends ToastItem {
  /** 关闭回调。 */
  onDismiss: (id: string) => void
}

/**
 * 单条提示。`role=status` 由读屏主动播报但不抢焦点；不阻塞任何操作。
 * @param props - 文案、语气与关闭回调。
 * @returns 一条 Toast。
 */
export const Toast = memo(function Toast({ id, message, tone = 'info', duration = 4000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (duration === 0) return
    const timer = window.setTimeout(() => onDismiss(id), duration)
    return () => window.clearTimeout(timer)
  }, [id, duration, onDismiss])

  return (
    <div className={css.toast} data-tone={tone} role="status">
      <span className={css.toastIcon}>
        <DsIcon name={TOAST_ICON[tone]} size={14} />
      </span>
      <span className={css.toastText}>{message}</span>
      <button type="button" className={css.toastClose} aria-label="关闭提示" onClick={() => onDismiss(id)}>
        <DsIcon name="close" size={12} />
      </button>
    </div>
  )
})

/**
 * Toast 容器：固定在视口底部居中堆叠。
 * @param props.toasts - 当前列表。
 * @param props.onDismiss - 关闭回调。
 * @returns 传送门渲染的容器。
 */
export function ToastLayer({ toasts, onDismiss }: { toasts: readonly ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <PiPortal>
      <div className={css.toastLayer} aria-live="polite" aria-atomic="false">
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
        ))}
      </div>
    </PiPortal>
  )
}
