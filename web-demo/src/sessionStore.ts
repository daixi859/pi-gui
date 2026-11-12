import { useCallback, useEffect, useState } from 'react'
import rawCatalog from './mock/sessions.json'
import type { SessionCatalog, SessionMock } from './types'

const catalog = rawCatalog as unknown as SessionCatalog
const STORAGE_KEY = 'pigui-demo.sessions.v1'

interface SessionMeta {
  order: string[]
  pinned: string[]
}

function readMeta(): SessionMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionMeta
    if (!Array.isArray(parsed.order) || !Array.isArray(parsed.pinned)) return null
    return parsed
  } catch {
    return null
  }
}

function buildInitial(): SessionMock[] {
  const meta = readMeta()
  const pins = meta ? new Set(meta.pinned) : null
  const order = meta?.order ?? []

  return catalog.sessions
    .map((session) => ({
      ...session,
      pinned: pins ? pins.has(session.sessionId) : session.pinned
    }))
    .sort((a, b) => {
      const ia = order.indexOf(a.sessionId)
      const ib = order.indexOf(b.sessionId)
      return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib)
    })
}

/** 会话顺序、固定状态存 localStorage；mock 内容本身来自 sessions.json */
export function useSessionStore() {
  const [sessions, setSessions] = useState<SessionMock[]>(buildInitial)

  useEffect(() => {
    const meta: SessionMeta = {
      order: sessions.map((s) => s.sessionId),
      pinned: sessions.filter((s) => s.pinned).map((s) => s.sessionId)
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
    } catch {
      // 忽略无法写入 localStorage 的场景
    }
  }, [sessions])

  const togglePin = useCallback((id: string) => {
    setSessions((prev) => prev.map((s) => (s.sessionId === id ? { ...s, pinned: !s.pinned } : s)))
  }, [])

  const move = useCallback((id: string, targetId: string, position: 'before' | 'after') => {
    if (id === targetId) return
    setSessions((prev) => {
      const from = prev.findIndex((s) => s.sessionId === id)
      const target = prev.find((s) => s.sessionId === targetId)
      if (from === -1 || !target) return prev
      const item = prev[from]
      const rest = prev.filter((s) => s.sessionId !== id)
      const targetIndex = rest.findIndex((s) => s.sessionId === targetId)
      rest.splice(targetIndex + (position === 'after' ? 1 : 0), 0, {
        ...item,
        pinned: target.pinned
      })
      return rest
    })
  }, [])

  const remove = useCallback(
    (id: string): { session: SessionMock; index: number } | null => {
      const index = sessions.findIndex((s) => s.sessionId === id)
      if (index === -1) return null
      const session = sessions[index]
      setSessions((prev) => prev.filter((s) => s.sessionId !== id))
      return { session, index }
    },
    [sessions]
  )

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 忽略
    }
    setSessions(buildInitial())
  }, [])

  const restore = useCallback((session: SessionMock, index: number) => {
    setSessions((prev) => {
      if (prev.some((s) => s.sessionId === session.sessionId)) return prev
      const next = [...prev]
      next.splice(Math.min(Math.max(index, 0), next.length), 0, session)
      return next
    })
  }, [])

  return { sessions, catalog, togglePin, move, remove, restore, reset }
}
