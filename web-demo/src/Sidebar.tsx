import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { fmtRelative } from './format'
import { useSettings } from './settings'
import type { SessionMock } from './types'
import { Icon, type IconName } from './ui/Icon'

type RouteName = 'chat' | 'sessions' | 'approvals' | 'settings'

interface NavItem {
  name: RouteName
  label: string
  icon: IconName
  path: string
  badge?: number
}

const THEME_LABEL = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统'
} as const

const THEME_ICON = {
  light: 'sun',
  dark: 'moon',
  system: 'monitor'
} as const

export function Sidebar({
  sessions,
  activeSessionId,
  routeName,
  draftTitle,
  pendingApprovals,
  focusSearchTick,
  onSelectSession,
  onNewSession,
  onTogglePin,
  onReorder,
  onNavigate,
  onCollapse,
  onOpenShortcuts,
  onSearchFocusRequest
}: {
  sessions: SessionMock[]
  activeSessionId: string | null
  routeName: RouteName
  draftTitle: string | null
  pendingApprovals: number
  focusSearchTick: number
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onTogglePin: (id: string) => void
  onReorder: (id: string, targetId: string, position: 'before' | 'after') => void
  onNavigate: (path: string) => void
  onCollapse: () => void
  onOpenShortcuts: () => void
  onSearchFocusRequest: () => void
}) {
  const { settings, update } = useSettings()
  const [query, setQuery] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ id: string; position: 'before' | 'after' } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusSearchTick === 0) return
    searchRef.current?.focus()
    searchRef.current?.select()
  }, [focusSearchTick])

  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? sessions.filter((s) =>
        `${s.title} ${s.cwd} ${s.model}`.toLowerCase().includes(needle)
      )
    : sessions

  const pinned = filtered.filter((s) => s.pinned)
  const recent = filtered.filter((s) => !s.pinned)

  const navItems: NavItem[] = [
    {
      name: 'chat',
      label: '对话',
      icon: 'message',
      path: sessions[0] ? `/chat/${sessions[0].sessionId}` : '/chat'
    },
    { name: 'sessions', label: '全部会话', icon: 'list', path: '/sessions' },
    {
      name: 'approvals',
      label: '工具审批',
      icon: 'shield',
      path: '/approvals',
      badge: pendingApprovals
    },
    { name: 'settings', label: '设置', icon: 'settings', path: '/settings' }
  ]

  const cycleTheme = () => {
    const next =
      settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light'
    update('theme', next)
  }

  const startDrag = (id: string, event: DragEvent) => {
    setDraggedId(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }

  const dragOver = (id: string, event: DragEvent) => {
    if (!draggedId || draggedId === id) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    if (drop?.id !== id || drop.position !== position) setDrop({ id, position })
  }

  const dropOn = (id: string, event: DragEvent) => {
    event.preventDefault()
    if (draggedId && drop) onReorder(draggedId, id, drop.position)
    setDraggedId(null)
    setDrop(null)
  }

  const keyMove = (id: string, event: KeyboardEvent, group: SessionMock[]) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    const index = group.findIndex((s) => s.sessionId === id)
    const target = group[index + (event.key === 'ArrowUp' ? -1 : 1)]
    if (!target) return
    onReorder(id, target.sessionId, event.key === 'ArrowUp' ? 'before' : 'after')
  }

  const renderSession = (session: SessionMock, group: SessionMock[]) => {
    const active = session.sessionId === activeSessionId
    const isDropTarget = drop?.id === session.sessionId
    return (
      <div
        key={session.sessionId}
        role="listitem"
        className={`group/row relative ${draggedId === session.sessionId ? 'opacity-40' : ''}`}
        draggable
        onDragStart={(e) => startDrag(session.sessionId, e)}
        onDragOver={(e) => dragOver(session.sessionId, e)}
        onDrop={(e) => dropOn(session.sessionId, e)}
        onDragEnd={() => {
          setDraggedId(null)
          setDrop(null)
        }}
      >
        {isDropTarget && drop.position === 'before' && (
          <span className="pointer-events-none absolute inset-x-1 -top-px z-10 h-0.5 rounded-full bg-[var(--cds-clay)]" />
        )}
        <button
          type="button"
          aria-current={active ? 'page' : undefined}
          title={session.title}
          onClick={() => onSelectSession(session.sessionId)}
          onKeyDown={(e) => keyMove(session.sessionId, e, group)}
          className={`relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-md pl-2 pr-7 text-left text-xs transition-colors ${
            active
              ? 'bg-[var(--cds-bg-selected)] font-medium text-[var(--cds-text-primary)]'
              : 'text-[var(--cds-text-secondary)] hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]'
          }`}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--cds-clay)]" />
          )}
          <span className="truncate">{session.title}</span>
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-[var(--cds-text-muted)] transition-opacity group-hover/row:opacity-0 max-md:opacity-0">
            {fmtRelative(session.updatedAt)}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin(session.sessionId)
          }}
          aria-label={session.pinned ? '取消固定' : '固定到顶部'}
          title={session.pinned ? '取消固定' : '固定到顶部'}
          className={`invisible absolute right-1 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[var(--cds-text-muted)] hover:bg-[var(--cds-alpha-2)] hover:text-[var(--cds-clay)] group-hover/row:visible group-focus-within/row:visible max-md:visible ${
            session.pinned ? 'text-[var(--cds-clay)]' : ''
          }`}
        >
          <Icon name={session.pinned ? 'pin' : 'pin-outline'} size={12} />
        </button>
        {isDropTarget && drop.position === 'after' && (
          <span className="pointer-events-none absolute inset-x-1 -bottom-px z-10 h-0.5 rounded-full bg-[var(--cds-clay)]" />
        )}
      </div>
    )
  }

  return (
    <aside className="flex h-full w-[264px] shrink-0 select-none flex-col border-r border-[var(--cds-border)] bg-[var(--cds-surface-0)]">
      {/* 品牌 */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 px-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--cds-clay)] text-[15px] font-semibold text-white shadow-[var(--cds-shadow-sm)]">
          π
        </div>
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="text-sm font-semibold tracking-tight">Pi</span>
          <span className="text-[10px] text-[var(--cds-text-muted)]">agent shell</span>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          title="收起侧栏 (⌘B)"
          aria-label="收起侧栏"
          className="hidden size-7 cursor-pointer items-center justify-center rounded-md text-[var(--cds-text-muted)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)] md:flex"
        >
          <Icon name="panel-left" size={15} />
        </button>
      </div>

      <div className="px-2.5 pb-2">
        <button
          type="button"
          onClick={onNewSession}
          className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--cds-border)] bg-[var(--cds-surface-1)] px-2.5 text-xs font-medium text-[var(--cds-text-primary)] shadow-[var(--cds-shadow-xs)] transition-colors hover:border-[var(--cds-border-strong)] hover:bg-[var(--cds-alpha-1)] active:scale-[0.99]"
        >
          <Icon name="plus" size={14} className="text-[var(--cds-clay)]" />
          新建会话
        </button>
      </div>

      {/* 主导航 */}
      <nav aria-label="主导航" className="px-2.5 pb-2">
        {navItems.map((item) => {
          const active = routeName === item.name
          return (
            <button
              key={item.name}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(item.path)}
              className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-xs transition-colors ${
                active
                  ? 'bg-[var(--cds-alpha-1)] font-medium text-[var(--cds-text-primary)]'
                  : 'text-[var(--cds-text-secondary)] hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]'
              }`}
            >
              <Icon
                name={item.icon}
                size={14}
                className={active ? 'text-[var(--cds-clay)]' : 'text-[var(--cds-text-muted)]'}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--cds-clay)] px-1 text-[9px] font-semibold leading-none text-white">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mx-2.5 mb-2 h-px bg-[var(--cds-border)]" />

      {/* 会话搜索 */}
      <div className="px-2.5 pb-1.5">
        <div className="relative flex items-center">
          <Icon
            name="search"
            size={13}
            className="pointer-events-none absolute left-2 text-[var(--cds-text-muted)]"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (query) setQuery('')
                else e.currentTarget.blur()
              }
            }}
            placeholder="搜索会话"
            aria-label="搜索会话"
            spellCheck={false}
            className="h-7 w-full rounded-md border border-transparent bg-[var(--cds-alpha-1)] pl-7 pr-7 text-xs text-[var(--cds-text-primary)] outline-none transition-colors placeholder:text-[var(--cds-text-muted)] focus:border-[var(--cds-border-strong)] focus:bg-[var(--cds-surface-1)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="清除搜索"
              className="absolute right-1 flex size-5 cursor-pointer items-center justify-center rounded text-[var(--cds-text-muted)] hover:text-[var(--cds-text-primary)]"
            >
              <Icon name="x" size={11} />
            </button>
          ) : (
            <kbd className="kbd absolute right-1.5">/</kbd>
          )}
        </div>
      </div>

      {/* 会话列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {draftTitle !== null && !needle && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-medium text-[var(--cds-text-muted)]">
              草稿
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/chat/new')}
              className={`relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-md pl-2 pr-2 text-left text-xs ${
                activeSessionId === 'new'
                  ? 'bg-[var(--cds-bg-selected)] font-medium text-[var(--cds-text-primary)]'
                  : 'text-[var(--cds-text-secondary)] hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]'
              }`}
            >
              {activeSessionId === 'new' && (
                <span className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--cds-clay)]" />
              )}
              <Icon name="sparkles" size={12} className="shrink-0 text-[var(--cds-clay)]" />
              <span className="truncate">{draftTitle}</span>
              <span className="ml-auto shrink-0 text-[10px] text-[var(--cds-text-muted)]">草稿</span>
            </button>
          </div>
        )}

        {pinned.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 pb-1 pt-2 text-[10px] font-medium text-[var(--cds-text-muted)]">
              <span>已固定</span>
              <span className="text-[9px]">Alt + ↑↓ 排序</span>
            </div>
            <div role="list" className="space-y-0.5">
              {pinned.map((session) => renderSession(session, pinned))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between px-2 pb-1 pt-2 text-[10px] font-medium text-[var(--cds-text-muted)]">
            <span>最近</span>
            <span className="tabular-nums">{recent.length}</span>
          </div>
          {recent.length > 0 ? (
            <div role="list" className="space-y-0.5">
              {recent.map((session) => renderSession(session, recent))}
            </div>
          ) : (
            <p className="px-2 py-3 text-[11px] leading-5 text-[var(--cds-text-muted)]">
              {needle ? '没有匹配的会话' : '还没有最近会话'}
            </p>
          )}
        </div>

        {needle && pinned.length + recent.length === 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              onSearchFocusRequest()
            }}
            className="mt-1 flex h-7 w-full cursor-pointer items-center justify-center rounded-md text-[11px] text-[var(--cds-clay)] hover:bg-[var(--cds-alpha-1)]"
          >
            清除搜索
          </button>
        )}
      </div>

      {/* 底部工具区 */}
      <div className="shrink-0 border-t border-[var(--cds-border)] px-2.5 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={cycleTheme}
            title={`主题：${THEME_LABEL[settings.theme]}`}
            className="flex h-7 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-[11px] text-[var(--cds-text-secondary)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]"
          >
            <Icon name={THEME_ICON[settings.theme]} size={13} />
            {THEME_LABEL[settings.theme]}
          </button>
          <button
            type="button"
            onClick={onOpenShortcuts}
            title="快捷键"
            aria-label="快捷键"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-[var(--cds-text-muted)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]"
          >
            <Icon name="keyboard" size={14} />
          </button>
        </div>
        <div className="px-2 pt-1.5 text-[9px] leading-4 text-[var(--cds-text-muted)]">
          web demo · 本地 mock 数据
        </div>
      </div>
    </aside>
  )
}
