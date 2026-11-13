import { useCallback, useEffect, useState } from 'react'

/**
 * 回合过程区的展开状态：先读 localStorage 里的手动选择，没有就按默认策略
 * （live 展开、settled 且有过程块则收起）。手动切换会写回，跨刷新保留。
 * @param scope - 会话/夹具命名空间，避免不同夹具的 turn:N 互相串开合状态。
 * @param key - 回合或分组的稳定 key。
 * @param defaultOpen - 没有手动记录时的默认值。
 * @returns 当前展开状态与切换函数。
 */
export function useFold(scope: string, key: string, defaultOpen: boolean): [boolean, () => void] {
  const storageKey = `pi.fold.${scope || 'default'}.${key}`
  const [open, setOpen] = useState<boolean>(() => {
    const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey)
    if (stored === '1') return true
    if (stored === '0') return false
    return defaultOpen
  })

  // 默认值随回合状态变化（live → settled）时，没有手动记录则跟随
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem(storageKey) !== null) return
    setOpen(defaultOpen)
  }, [storageKey, defaultOpen])

  const toggle = useCallback(() => {
    setOpen(previous => {
      const next = !previous
      try {
        localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        /* 隐私模式忽略 */
      }
      return next
    })
  }, [storageKey])

  return [open, toggle]
}
