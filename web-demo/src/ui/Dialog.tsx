import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

const SIZE_CLASS = {
  sm: 'max-w-[400px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[720px]'
} as const

export type DialogSize = keyof typeof SIZE_CLASS

/** 无第三方依赖的模态框：Esc 关闭、点遮罩关闭、Tab 焦点陷阱、关闭后归还焦点 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'sm',
  icon
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  size?: DialogSize
  icon?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const timer = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current
      target?.focus()
    }, 0)

    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return
    const nodes = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    if (!nodes.length) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="ui-overlay-enter absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={`ui-dialog-enter relative w-full ${SIZE_CLASS[size]} rounded-2xl border border-[var(--cds-border)] bg-[var(--cds-surface-popover)] p-5 shadow-[var(--cds-shadow-popover)] outline-none`}
      >
        <div className="flex items-start gap-3">
          {icon && (
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--cds-clay)]/10 text-[var(--cds-clay)]">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold leading-6">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-xs leading-5 text-[var(--cds-text-secondary)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="-mr-1 -mt-1 cursor-pointer rounded-md p-1.5 text-[var(--cds-text-muted)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {children && <div className="mt-4">{children}</div>}
        {footer && <div className="mt-5 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = true,
  children
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  children?: ReactNode
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      icon={<Icon name={danger ? 'alert' : 'sparkles'} size={16} />}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-[var(--cds-border)] px-3 py-1.5 text-xs font-medium text-[var(--cds-text-secondary)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                : 'bg-[var(--cds-clay)] hover:bg-[var(--cds-clay-hover)]'
            }`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}

