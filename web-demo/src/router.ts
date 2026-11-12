import { useEffect, useState } from 'react'

export type Route =
  | { name: 'chat'; sessionId: string | null }
  | { name: 'sessions' }
  | { name: 'approvals' }
  | { name: 'settings' }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const [head, second] = path.split('/')
  if (head === 'sessions') return { name: 'sessions' }
  if (head === 'approvals') return { name: 'approvals' }
  if (head === 'settings') return { name: 'settings' }
  if (head === 'chat') {
    return { name: 'chat', sessionId: second ? decodeURIComponent(second) : null }
  }
  return { name: 'chat', sessionId: null }
}

export function navigate(path: string) {
  const next = path.startsWith('/') ? path : `/${path}`
  if (window.location.hash === `#${next}`) return
  window.location.hash = next
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

/** 简单的媒体查询 hook，用于移动端侧栏抽屉 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
