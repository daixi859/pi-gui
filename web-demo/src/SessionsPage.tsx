import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { fmtBytes, fmtRelative } from './format'
import type { SessionMock } from './types'
import { ConfirmDialog } from './ui/Dialog'
import { Segmented } from './ui/Controls'
import { Icon } from './ui/Icon'

type Filter = 'all' | 'pinned'

export function SessionsPage({
  sessions,
  focusSearchTick,
  onOpen,
  onNew,
  onTogglePin,
  onDelete
}: {
  sessions: SessionMock[]
  focusSearchTick: number
  onOpen: (id: string) => void
  onNew: () => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [focusIndex, setFocusIndex] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<SessionMock | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (focusSearchTick === 0) return
    searchRef.current?.focus()
    searchRef.current?.select()
  }, [focusSearchTick])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sessions.filter((session) => {
      if (filter === 'pinned' && !session.pinned) return false
      if (!needle) return true
      return `${session.title} ${session.cwd} ${session.model} ${session.source}`
        .toLowerCase()
        .includes(needle)
    })
  }, [sessions, query, filter])

  const pinned = visible.filter((s) => s.pinned)
  const recent = visible.filter((s) => !s.pinned)
  const totalBytes = sessions.reduce((sum, s) => sum + s.bytes, 0)

  const focusRow = (index: number) => {
    if (!visible.length) return
    const target = Math.min(Math.max(index, 0), visible.length - 1)
    setFocusIndex(target)
    rowRefs.current[target]?.focus()
  }

  const onRowKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    session: SessionMock,
    index: number
  ) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusRow(index + (event.key === 'ArrowDown' ? 1 : -1))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      focusRow(event.key === 'Home' ? 0 : visible.length - 1)
    } else if (event.key === 'p' || event.key === 'P') {
      event.preventDefault()
      onTogglePin(session.sessionId)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      setPendingDelete(session)
    }
  }

  const row = (session: SessionMock) => {
    const index = visible.findIndex((s) => s.sessionId === session.sessionId)
    return (
      <div
        key={session.sessionId}
        role="listitem"
        className="group flex items-center gap-2 border-b border-[var(--cds-border)] py-1"
      >
        <button
          ref={(node) => {
            rowRefs.current[index] = node
          }}
          type="button"
          tabIndex={focusIndex === index ? 0 : -1}
          onFocus={() => setFocusIndex(index)}
          onClick={() => onOpen(session.sessionId)}
          onKeyDown={(event) => onRowKeyDown(event, session, index)}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-[var(--cds-alpha-1)] focus-visible:bg-[var(--cds-alpha-1)]"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--cds-border)] bg-[var(--cds-surface-0)] text-[var(--cds-text-muted)]">
            <Icon name="message" size={13} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-[var(--cds-text-primary)]">
                {session.title}
              </span>
              {session.pinned && (
                <Icon name="pin" size={10} className="shrink-0 text-[var(--cds-clay)]" />
              )}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-[var(--cds-text-muted)]">
              <span className="tabular-nums">{session.turnCount} 轮</span>
              <span className="tabular-nums">{session.messageCount} 条消息</span>
              <span className="tabular-nums">{fmtBytes(session.bytes)}</span>
              <span className="max-w-[140px] truncate font-mono">{session.model}</span>
              <span className="max-w-[220px] truncate">{session.cwd}</span>
            </span>
          </span>
        </button>

        <span className="hidden shrink-0 text-[10px] tabular-nums text-[var(--cds-text-muted)] sm:block">
          {fmtRelative(session.updatedAt)}
        </span>

        <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onTogglePin(session.sessionId)}
            title={session.pinned ? '取消固定' : '固定到顶部'}
            aria-label={session.pinned ? '取消固定' : '固定到顶部'}
            className={`flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--cds-alpha-2)] hover:text-[var(--cds-clay)] ${
              session.pinned
                ? 'text-[var(--cds-clay)]'
                : 'text-[var(--cds-text-muted)]'
            }`}
          >
            <Icon name={session.pinned ? 'pin' : 'pin-outline'} size={13} />
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(session)}
            title="删除会话"
            aria-label="删除会话"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-[var(--cds-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
    )
  }

  const hasResults = visible.length > 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[860px] px-5 pb-20 pt-8 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--cds-text-primary)]">
              全部会话
            </h1>
            <p className="mt-1.5 text-xs leading-5 text-[var(--cds-text-secondary)]">
              {sessions.length} 个会话来自本机 pi 历史，共 {fmtBytes(totalBytes)} 原始记录，工具输出已截断。
            </p>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--cds-clay)] px-3 text-xs font-medium text-white shadow-[var(--cds-shadow-xs)] transition-colors hover:bg-[var(--cds-clay-hover)]"
          >
            <Icon name="plus" size={13} />
            新建会话
          </button>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative flex min-w-0 flex-1 items-center sm:max-w-[300px]">
            <Icon
              name="search"
              size={13}
              className="pointer-events-none absolute left-2.5 text-[var(--cds-text-muted)]"
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setFocusIndex(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (query) setQuery('')
                  else e.currentTarget.blur()
                } else if (e.key === 'Enter' && visible[0]) {
                  onOpen(visible[0].sessionId)
                }
              }}
              placeholder="搜索标题、路径或模型"
              aria-label="搜索会话"
              spellCheck={false}
              className="h-8 w-full rounded-lg border border-[var(--cds-border)] bg-[var(--cds-surface-1)] pl-8 pr-8 text-xs text-[var(--cds-text-primary)] outline-none transition-colors placeholder:text-[var(--cds-text-muted)] focus:border-[var(--cds-border-strong)] focus:bg-[var(--cds-surface-2)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="清除搜索"
                className="absolute right-1.5 flex size-5 cursor-pointer items-center justify-center rounded text-[var(--cds-text-muted)] hover:text-[var(--cds-text-primary)]"
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>

          <Segmented
            label="筛选会话"
            value={filter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'pinned', label: '已固定' }
            ]}
            onChange={(value) => {
              setFilter(value)
              setFocusIndex(0)
            }}
          />

          <span className="ml-auto text-[10px] tabular-nums text-[var(--cds-text-muted)]">
            {hasResults ? `显示 ${visible.length} 个` : '无匹配'}
          </span>
        </div>

        {!hasResults ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="flex size-11 items-center justify-center rounded-full border border-[var(--cds-border)] bg-[var(--cds-surface-0)] text-[var(--cds-text-muted)]">
              <Icon name={query ? 'search' : 'message'} size={18} />
            </div>
            <div className="mt-3 text-sm font-medium text-[var(--cds-text-primary)]">
              {query ? `没有找到「${query}」` : '这里还没有会话'}
            </div>
            <p className="mt-1 max-w-[320px] text-xs leading-5 text-[var(--cds-text-secondary)]">
              {query ? '换个关键词试试，或清除筛选查看全部会话。' : '新建一个会话开始和 Pi 对话。'}
            </p>
            <button
              type="button"
              onClick={() => {
                if (query) setQuery('')
                else onNew()
              }}
              className="mt-4 cursor-pointer rounded-lg border border-[var(--cds-border)] bg-[var(--cds-surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--cds-text-primary)] transition-colors hover:bg-[var(--cds-alpha-1)]"
            >
              {query ? '清除搜索' : '新建会话'}
            </button>
          </div>
        ) : (
          <div className="mt-5">
            {filter === 'all' && pinned.length > 0 && (
              <section className="mb-5">
                <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-medium text-[var(--cds-text-muted)]">
                  <Icon name="pin" size={10} className="text-[var(--cds-clay)]" />
                  已固定
                  <span className="tabular-nums">{pinned.length}</span>
                </div>
                <div role="list" aria-label="已固定会话" className="border-t border-[var(--cds-border)]">
                  {pinned.map(row)}
                </div>
              </section>
            )}

            <section>
              <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-medium text-[var(--cds-text-muted)]">
                <span>{filter === 'pinned' ? '已固定' : '最近'}</span>
                <span className="tabular-nums">
                  {(filter === 'pinned' ? pinned : recent).length}
                </span>
              </div>
              <div role="list" aria-label="最近会话" className="border-t border-[var(--cds-border)]">
                {(filter === 'pinned' ? pinned : recent).map(row)}
              </div>
            </section>
          </div>
        )}

        <footer className="mt-6 space-y-1.5 text-[10px] leading-4 text-[var(--cds-text-muted)]">
          <p>↑↓ 在列表里移动，Enter 打开，P 固定，Delete 删除。</p>
          <p>排序与固定状态保存在本地；原始数据路径 ~/.pi/agent/sessions。</p>
        </footer>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.sessionId)
          setPendingDelete(null)
        }}
        title="删除这个会话？"
        description={
          pendingDelete
            ? `「${pendingDelete.title}」会从列表中移除。删除后可以在底部提示里撤销。`
            : ''
        }
        confirmLabel="删除会话"
      />
    </div>
  )
}
