import { useLayoutEffect, useState, type RefObject } from 'react'
import { usePiThemeContext } from '../theme/PiRoot'

/**
 * 从探针元素上读出真实生效的令牌值。
 *
 * 规范页展示的所有颜色、尺寸都是运行时从 CSS 里读的，不是写死在 TS 里的：
 * 令牌改一个值、切换主题，页面立刻跟着变。这样规范页永远不会与实现漂移。
 * @param probeRef - 挂在 `.pi-root` 内部的探针元素。
 * @param names - 要读的变量名。
 * @returns 变量名 → 计算值（已是 var() 替换后的最终值）。
 */
export function useTokens(probeRef: RefObject<HTMLElement | null>, names: readonly string[]): Record<string, string> {
  const { dark } = usePiThemeContext()
  const [values, setValues] = useState<Record<string, string>>({})

  useLayoutEffect(() => {
    const element = probeRef.current
    if (!element) return
    const computed = getComputedStyle(element)
    const next: Record<string, string> = {}
    for (const name of names) next[name] = computed.getPropertyValue(name).trim()
    setValues(next)
  }, [probeRef, names, dark])

  return values
}

/** 读单个数值型令牌（例如 `--pi-sp-16` → 16）。 */
export function pxOf(value: string | undefined): number {
  if (value === undefined) return 0
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}
