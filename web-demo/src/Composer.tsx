import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Icon } from './ui/Icon'

/** 发送框：Enter 发送，Shift+Enter 换行；输入法合成中不触发发送 */
export function Composer({
  value,
  onChange,
  onSend,
  focusSignal = 0,
  disabled = false
}: {
  value: string
  onChange: (value: string) => void
  onSend: (text: string) => void
  focusSignal?: number
  disabled?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 172)}px`
  }, [value])

  useEffect(() => {
    if (focusSignal === 0) return
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [focusSignal])

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    onChange('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--cds-border)] bg-[var(--cds-surface-1)] p-2 shadow-[var(--cds-shadow-sm)] transition-colors focus-within:border-[var(--cds-border-strong)]">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="给 Pi 发消息…"
        aria-label="消息输入框"
        className="block max-h-[172px] min-h-[40px] w-full resize-none bg-transparent px-2.5 py-2 text-[14px] leading-6 text-[var(--cds-text-primary)] outline-none placeholder:text-[var(--cds-text-muted)] disabled:opacity-60"
      />
      <div className="flex items-center gap-2 px-1.5 pb-0.5 pt-1">
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--cds-text-muted)]">
          <Icon name="corner-down-left" size={11} />
          <span>
            Enter 发送 · Shift+Enter 换行
          </span>
        </span>
        <span className="hidden items-center gap-1 text-[10px] text-[var(--cds-text-muted)] sm:flex">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          本地 mock
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="发送消息"
          title="发送消息 (Enter)"
          className="ml-auto flex size-7 cursor-pointer items-center justify-center rounded-full bg-[var(--cds-clay)] text-white transition-all hover:bg-[var(--cds-clay-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100"
        >
          <Icon name="arrow-up" size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
