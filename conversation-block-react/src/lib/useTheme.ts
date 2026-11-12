import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'pi.theme'

function systemDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

function apply(mode: ThemeMode): void {
  const dark = mode === 'dark' || (mode === 'system' && systemDark())
  document.body.toggleAttribute('data-ds-dark-theme', dark)
}

/**
 * 主题：跟随系统 / 浅色 / 深色三态，写 localStorage。深色通过
 * `body[data-ds-dark-theme]` 激活，直接复用搬来的 token 覆盖。
 * @returns 当前模式与切换函数。
 */
export function useTheme(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  })

  useEffect(() => {
    apply(mode)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* 隐私模式忽略 */
    }
    if (mode !== 'system' || typeof matchMedia === 'undefined') return
    const query = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [mode])

  const set = useCallback((next: ThemeMode) => setMode(next), [])
  return [mode, set]
}
