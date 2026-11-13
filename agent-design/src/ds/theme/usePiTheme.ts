import { useCallback, useEffect, useState } from 'react'

/** 主题三态：与系统设置一致。 */
export type PiThemeMode = 'system' | 'light' | 'dark'

/** PiDS 用的 localStorage key；与旧 `pi.theme` 分开，避免两套系统互相覆盖。 */
const STORAGE_KEY = 'pi.ds.theme'

/** 系统是否偏好深色。 */
function systemDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * PiDS 主题状态。
 *
 * 与旧 `useTheme` 的区别：这里不碰 `document.body`，只返回一个布尔值交给
 * `.pi-root` 的 `data-pi-theme`。两套主题因此可以在同一页面里各管各的。
 * @returns 当前模式、解析后的深色判定、设置函数。
 */
export function usePiTheme(): [PiThemeMode, boolean, (mode: PiThemeMode) => void] {
  const [mode, setMode] = useState<PiThemeMode>(() => {
    if (typeof localStorage === 'undefined') return 'light'
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'light'
  })
  const [dark, setDark] = useState<boolean>(() => mode === 'dark' || (mode === 'system' && systemDark()))

  useEffect(() => {
    const resolve = (): boolean => mode === 'dark' || (mode === 'system' && systemDark())
    setDark(resolve())
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* 隐私模式忽略 */
    }
    if (mode !== 'system' || typeof matchMedia === 'undefined') return
    const query = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setDark(resolve())
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [mode])

  const set = useCallback((next: PiThemeMode) => setMode(next), [])
  return [mode, dark, set]
}
