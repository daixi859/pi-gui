import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApprovalsPage } from './ApprovalsPage'
import { ChatPage } from './ChatPage'
import { CommandPalette } from './CommandPalette'
import { navigate, useHashRoute, useMediaQuery } from './router'
import { useSessionStore } from './sessionStore'
import { SettingsPage } from './SettingsPage'
import { SessionsPage } from './SessionsPage'
import { ShortcutsDialog } from './ShortcutsDialog'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useSettings } from './settings'
import { useToast } from './toast'
import { buildTurns, createMockTurn, userText } from './turns'
import { truncate } from './format'
import { APPROVAL_REQUESTS, type ApprovalVerdict } from './mock/approvals'
import type { SessionMock, Turn } from './types'

const DRAFT_ID = 'new'

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function App() {
  const route = useHashRoute()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const { settings, update, reset: resetSettings } = useSettings()
  const { push } = useToast()
  const { sessions, catalog, togglePin, move, remove, restore, reset: resetSessions } =
    useSessionStore()

  const [extras, setExtras] = useState<Record<string, Turn[]>>({})
  const [draft, setDraft] = useState<{ turns: Turn[] } | null>(null)
  const [draftKey, setDraftKey] = useState(0)
  const [decisions, setDecisions] = useState<Record<string, ApprovalVerdict>>({})

  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [sidebarSearchTick, setSidebarSearchTick] = useState(0)
  const [pageSearchTick, setPageSearchTick] = useState(0)

  // 直接访问 #/chat/new 时也要有一个草稿
  useEffect(() => {
    if (route.name === 'chat' && route.sessionId === DRAFT_ID && !draft) {
      setDraft({ turns: [] })
    }
  }, [route, draft])

  // 路由变了就收起移动端抽屉与命令面板
  useEffect(() => {
    setMobileOpen(false)
    setPaletteOpen(false)
  }, [route])

  // 访问了不存在的会话 id 时回退
  useEffect(() => {
    if (route.name !== 'chat' || !route.sessionId || route.sessionId === DRAFT_ID) return
    if (sessions.some((s) => s.sessionId === route.sessionId)) return
    navigate(sessions[0] ? `/chat/${sessions[0].sessionId}` : '/sessions')
  }, [route, sessions])

  const draftTitle = useMemo(() => {
    const first = draft?.turns[0] ? userText(draft.turns[0].user) : ''
    return first ? truncate(first.replace(/\s+/g, ' ').trim(), 20) : '新会话'
  }, [draft])

  const draftSession = useMemo<SessionMock>(
    () => ({
      source: '本地草稿',
      sessionId: DRAFT_ID,
      title: draftTitle,
      cwd: sessions[0]?.cwd ?? 'C:\\Users\\DELL',
      model: settings.model,
      updatedAt: Date.now(),
      messageCount: draft?.turns.reduce((sum, turn) => sum + 1 + turn.items.length, 0) ?? 0,
      turnCount: draft?.turns.length ?? 0,
      bytes: 0,
      pinned: false,
      messages: []
    }),
    [draftTitle, draft, sessions, settings.model]
  )

  const isDraft = route.name === 'chat' && route.sessionId === DRAFT_ID
  const activeSession =
    route.name === 'chat'
      ? isDraft
        ? draftSession
        : (sessions.find((s) => s.sessionId === route.sessionId) ?? sessions[0] ?? null)
      : null

  const baseTurns = useMemo(
    () =>
      activeSession && !isDraft
        ? buildTurns(activeSession.messages, activeSession.thinkingDurations)
        : [],
    [activeSession, isDraft]
  )

  const activeTurns = useMemo(() => {
    if (!activeSession) return []
    if (isDraft) return draft?.turns ?? []
    return [...baseTurns, ...(extras[activeSession.sessionId] ?? [])]
  }, [activeSession, isDraft, draft, baseTurns, extras])

  const pendingApprovals = useMemo(
    () => APPROVAL_REQUESTS.filter((request) => !decisions[request.id]).length,
    [decisions]
  )

  const bump = useCallback(() => undefined, [])

  const newSession = () => {
    const previous = draft
    setDraft({ turns: [] })
    setDraftKey((n) => n + 1)
    navigate(`/chat/${DRAFT_ID}`)
    if (previous && previous.turns.length > 0) {
      push({
        title: '已新建草稿',
        description: '上一个草稿的内容已清空，可以撤销恢复。',
        action: { label: '恢复草稿', onClick: () => setDraft(previous) }
      })
    }
  }

  const send = (text: string) => {
    if (!activeSession) return
    const turn = createMockTurn(text, Date.now())
    if (isDraft) {
      setDraft((prev) => ({ turns: [...(prev?.turns ?? []), turn] }))
    } else {
      setExtras((prev) => ({
        ...prev,
        [activeSession.sessionId]: [...(prev[activeSession.sessionId] ?? []), turn]
      }))
    }
  }

  const deleteSession = (id: string) => {
    const removed = remove(id)
    if (!removed) return
    setExtras((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (route.name === 'chat' && route.sessionId === id) {
      const next = sessions.find((s) => s.sessionId !== id)
      navigate(next ? `/chat/${next.sessionId}` : '/sessions')
    }
    push({
      title: '会话已删除',
      description: truncate(removed.session.title, 28),
      action: { label: '撤销', onClick: () => restore(removed.session, removed.index) }
    })
  }

  const decide = (id: string, verdict: ApprovalVerdict) => {
    setDecisions((prev) => ({ ...prev, [id]: verdict }))
  }

  const undoDecision = (id: string) => {
    setDecisions((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const resetDemoData = () => {
    resetSettings()
    resetSessions()
    setExtras({})
    setDraft(null)
    setDraftKey((n) => n + 1)
    setDecisions({})
    setMobileOpen(false)
  }

  const openSidebarSearch = () => {
    if (isMobile) setMobileOpen(true)
    else if (settings.sidebarCollapsed) update('sidebarCollapsed', false)
    setSidebarSearchTick((n) => n + 1)
  }

  // 全局快捷键
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setShortcutsOpen(false)
        setPaletteOpen((open) => !open)
        return
      }
      if (mod && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        if (isMobile) setMobileOpen((open) => !open)
        else update('sidebarCollapsed', !settings.sidebarCollapsed)
        return
      }
      if (event.key === 'Escape') {
        setMobileOpen(false)
        return
      }
      if (mod || event.altKey || isTypingTarget(event.target)) return
      if (event.key === '/') {
        if (paletteOpen || shortcutsOpen) return
        event.preventDefault()
        if (!isMobile && route.name === 'sessions') setPageSearchTick((n) => n + 1)
        else openSidebarSearch()
      } else if (event.key === '?') {
        if (paletteOpen) return
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMobile, update, settings.sidebarCollapsed, route, paletteOpen, shortcutsOpen])

  const sidebarVisible = isMobile ? mobileOpen : !settings.sidebarCollapsed

  return (
    <div className="flex h-full overflow-hidden bg-[var(--cds-surface-1)] text-[var(--cds-text-primary)]">
      {isMobile && mobileOpen && (
        <div
          className="ui-overlay-enter fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={
          isMobile
            ? `fixed inset-y-0 left-0 z-40 h-full transition-transform duration-200 ease-out ${
                mobileOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : `h-full shrink-0 overflow-hidden transition-[width] duration-200 ${
                settings.sidebarCollapsed ? 'w-0' : 'w-[264px]'
              }`
        }
        inert={!sidebarVisible ? true : undefined}
        aria-hidden={!sidebarVisible}
      >
        <Sidebar
          sessions={sessions}
          activeSessionId={route.name === 'chat' ? (activeSession?.sessionId ?? null) : null}
          routeName={route.name}
          draftTitle={draft ? draftTitle : null}
          pendingApprovals={pendingApprovals}
          focusSearchTick={sidebarSearchTick}
          onSelectSession={(id) => navigate(`/chat/${id}`)}
          onNewSession={newSession}
          onTogglePin={togglePin}
          onReorder={move}
          onNavigate={navigate}
          onCollapse={() => {
            if (isMobile) setMobileOpen(false)
            else update('sidebarCollapsed', true)
          }}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onSearchFocusRequest={() => setSidebarSearchTick((n) => n + 1)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          route={route}
          session={activeSession}
          isMobile={isMobile}
          sidebarOpen={sidebarVisible}
          onToggleSidebar={() => {
            if (isMobile) setMobileOpen((open) => !open)
            else update('sidebarCollapsed', !settings.sidebarCollapsed)
          }}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />

        <main className="min-h-0 flex-1">
          {route.name === 'chat' &&
            (activeSession ? (
              <ChatPage
                key={isDraft ? `draft-${draftKey}` : activeSession.sessionId}
                session={activeSession}
                turns={activeTurns}
                isDraft={isDraft}
                onSend={send}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--cds-clay)] text-xl font-semibold text-white">
                  π
                </div>
                <div className="text-sm font-medium">还没有任何会话</div>
                <p className="max-w-[300px] text-xs leading-5 text-[var(--cds-text-secondary)]">
                  新建一个会话，或者从本机 pi 历史里加载数据。
                </p>
                <button
                  type="button"
                  onClick={newSession}
                  className="mt-1 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--cds-clay)] px-3 text-xs font-medium text-white transition-colors hover:bg-[var(--cds-clay-hover)]"
                >
                  新建会话
                </button>
              </div>
            ))}

          {route.name === 'sessions' && (
            <SessionsPage
              sessions={sessions}
              focusSearchTick={pageSearchTick}
              onOpen={(id) => navigate(`/chat/${id}`)}
              onNew={newSession}
              onTogglePin={togglePin}
              onDelete={deleteSession}
            />
          )}

          {route.name === 'approvals' && (
            <ApprovalsPage
              decisions={decisions}
              onDecide={decide}
              onUndo={undoDecision}
              onOpenSettings={() => navigate('/settings')}
            />
          )}

          {route.name === 'settings' && (
            <SettingsPage sessions={sessions} catalog={catalog} onResetData={resetDemoData} />
          )}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        sessions={sessions}
        currentSessionId={route.name === 'chat' ? (activeSession?.sessionId ?? null) : null}
        onNavigate={navigate}
        onNewSession={newSession}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}
