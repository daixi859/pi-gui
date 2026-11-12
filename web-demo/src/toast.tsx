import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { Icon } from './ui/Icon'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastInput {
  title: string
  description?: string
  action?: ToastAction
}

interface ToastItem extends ToastInput {
  id: number
}

interface ToastContextValue {
  push: (input: ToastInput) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((input: ToastInput) => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-2), { ...input, id }])
    return id
  }, [])

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(onDismiss, toast.action ? 7000 : 4200)
    return () => window.clearTimeout(timer)
  }, [paused, toast.action, onDismiss])

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="toast-in pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-xl border border-[var(--cds-border)] bg-[var(--cds-surface-popover)] px-3.5 py-3 text-sm shadow-[var(--cds-shadow-md)]"
    >
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
        <Icon name="check" size={12} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium leading-5 text-[var(--cds-text-primary)]">{toast.title}</div>
        {toast.description && (
          <div className="mt-0.5 text-xs leading-5 text-[var(--cds-text-secondary)]">
            {toast.description}
          </div>
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick()
            onDismiss()
          }}
          className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-[var(--cds-clay)] transition-colors hover:bg-[var(--cds-alpha-1)]"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="关闭提示"
        className="-mr-1 -mt-1 cursor-pointer rounded-md p-1 text-[var(--cds-text-muted)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]"
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
