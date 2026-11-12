import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fmtRelative } from './format'
import type { SessionMock } from './types'
import { Icon, type IconName } from './ui/Icon'

interface PaletteItem {
  key: string
  group: '页面' | '会话'
  title: string
  hint: string
  icon: IconName
  run: () => void
}

export function CommandPalette({
  open,
  onClose,
  sessions,
  currentSessionId,
  onNavigate,
  onNewSession,
  onOpenShortcuts
}: {
  open: boolean
  onClose: () => void
  sessions: SessionMock[]
  currentSessionId: string | null
  onNavigate: (path: string) => void
  onNewSession: () => void
  onOpenShortcuts: () => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const items = useMemo<PaletteItem[]>(() => {
    const pages: PaletteItem[] = [
      {
        key: 'new',
        group: '页面',
        title: '新建会话',
        hint: '草稿',
        icon: 'plus',
        run: onNewSession
      },
      {
        key: 'sessions',
        group: '页面',
        title: '全部会话',
        hint: '页面',
        icon: 'list',
        run: () => onNavigate('/sessions')
      },
      {
        key: 'approvals',
        group: '页面',
        title: '工具审批',
        hint: '页面',
        icon: 'shield',
        run: () => onNavigate('/approvals')
      },
      {
        key: 'settings',
        group: '页面',
        title: '设置',
        hint: '页面',
        icon: 'settings',
        run: () => onNavigate('/settings')
      },
      {
        key: 'shortcuts',
        group: '页面',
        title: '键盘快捷键',
        hint: '帮助',
        icon: 'keyboard',
        run: onOpenShortcuts
      }
    ]

    const sessionItems: PaletteItem[] = sessions.map((session) => ({
      key: session.sessionId,
      group: '会话' as const,
      title: session.title,
      hint: `${session.turnCount} 轮 · ${fmtRelative(session.updatedAt)}`,
      icon: 'message' as const,
      run: () => onNavigate(`/chat/${session.sessionId}`)
    }))

    const needle = query.trim().toLowerCase()
    const match = (item: PaletteItem) =>
      !needle || `${item.title} ${item.hint}`.toLowerCase().includes(needle)

    const visiblePages = pages.filter(match)
    const visibleSessions = sessionItems.filter(match).slice(0, needle ? 20 : 5)
    return [...visiblePages, ...visibleSessions]
  }, [query, sessions, onNavigate, onNewSession, onOpenShortcuts])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    restoreRef.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (active > items.length - 1) setActive(Math.max(0, items.length - 1))
  }, [items.length, active])

  useEffect(() => {
    if (!open) return
    const option = document.getElementById(`palette-option-${active}`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

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

  const choose = (index: number) => {
    const item = items[index]
    if (!item) return
    item.run()
    onClose()
  }

  const move = (delta: number) => {
    if (!items.length) return
    setActive((prev) => (prev + delta + items.length) % items.length)
  }

  const groups = (['页面', '会话'] as const)
    .map((group) => ({ group, entries: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.entries.length > 0)

  let flatIndex = -1

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="ui-overlay-enter absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        className="ui-dialog-enter relative w-full max-w-[560px] overflow-hidden rounded-xl border border-[var(--cds-border)] bg-[var(--cds-surface-popover)] shadow-[var(--cds-shadow-popover)]"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--cds-border)] px-3.5">
          <Icon name="search" size={16} className="shrink-0 text-[var(--cds-text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            role="combobox"
            aria-label="搜索会话或页面"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-autocomplete="list"
            aria-activedescendant={items[active] ? `palette-option-${active}` : undefined}
            placeholder="搜索会话、页面或操作"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                move(1)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                move(-1)
              } else if (e.key === 'Home') {
                e.preventDefault()
                setActive(0)
              } else if (e.key === 'End') {
                e.preventDefault()
                setActive(items.length - 1)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                choose(active)
              } else if (e.key === 'Tab') {
                e.preventDefault()
              }
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-[var(--cds-text-primary)] outline-none placeholder:text-[var(--cds-text-muted)]"
          />
          <kbd className="kbd shrink-0">esc</kbd>
        </div>

        <div
          id="palette-listbox"
          role="listbox"
          aria-label="搜索结果"
          className="max-h-[min(420px,55vh)] overflow-y-auto p-1.5"
        >
          {groups.length === 0 && (
            <div className="px-3 py-10 text-center">
              <div className="text-xs text-[var(--cds-text-secondary)]">
                没有找到与「{query}」相关的内容
              </div>
              <div className="mt-1 text-[11px] text-[var(--cds-text-muted)]">
                试试搜索会话标题、页面名称
              </div>
            </div>
          )}

          {groups.map(({ group, entries }) => {
            const labelId = `palette-group-${group}`
            return (
              <div key={group} role="group" aria-labelledby={labelId} className="mb-1 last:mb-0">
                <div
                  id={labelId}
                  className="px-2.5 pb-1 pt-2 text-[10px] font-medium text-[var(--cds-text-muted)]"
                >
                  {group}
                </div>
                {entries.map((item) => {
                  flatIndex += 1
                  const index = flatIndex
                  const selected = index === active
                  const showCurrent = item.key === currentSessionId && group === '会话'
                  return (
                    <button
                      key={item.key}
                      id={`palette-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(index)}
                      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        selected ? 'bg-[var(--cds-alpha-1)]' : ''
                      }`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--cds-border)] ${
                          selected
                            ? 'bg-[var(--cds-surface-1)] text-[var(--cds-clay)]'
                            : 'bg-[var(--cds-surface-0)] text-[var(--cds-text-muted)]'
                        }`}
                      >
                        <Icon name={item.icon} size={13} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--cds-text-primary)]">
                        {item.title}
                        {showCurrent && (
                          <span className="ml-2 rounded bg-[var(--cds-alpha-1)] px-1 py-0.5 text-[9px] text-[var(--cds-text-muted)]">
                            当前
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--cds-text-muted)]">
                        {item.hint}
                      </span>
                      {selected && (
                        <Icon
                          name="corner-down-left"
                          size={12}
                          className="shrink-0 text-[var(--cds-text-muted)]"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--cds-border)] bg-[var(--cds-surface-0)] px-3 py-2 text-[10px] text-[var(--cds-text-muted)]">
          <span className="flex items-center gap-1">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            选择
          </span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">↵</kbd>
            打开
          </span>
          <span className="ml-auto">{items.length} 个结果</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
