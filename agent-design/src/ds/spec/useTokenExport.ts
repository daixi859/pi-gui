/**
 * 令牌导出：把 `--pi-*` 自定义属性连同当前主题下的解析值导出成 JSON。
 *
 * 为什么不手写一份令牌清单：手写的清单一定会和 tokens.css 走散。
 * 这里改成运行时遍历样式表收集属性名，再逐个读计算值——加一条令牌不用改代码，
 * 删一条也不会留下幽灵项。
 */
import { useCallback, useState } from 'react'

/** 递归收集样式表里所有 `--pi-*` 自定义属性的名字。 */
function collectNames(rules: CSSRuleList, into: Set<string>): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const style = rule.style
      for (const name of Array.from(style)) {
        if (name.startsWith('--pi-')) into.add(name)
      }
      continue
    }
    // @media / @supports / @layer 里还嵌着规则
    if ('cssRules' in rule) {
      const nested = (rule as CSSGroupingRule).cssRules
      if (nested !== undefined) collectNames(nested, into)
    }
  }
}

/** 收集全部令牌名。跨域样式表读不到 cssRules，跳过即可。 */
export function collectTokenNames(): readonly string[] {
  const names = new Set<string>()
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    collectNames(rules, names)
  }
  return Array.from(names).sort()
}

/** 读一个元素上这些令牌的计算值。 */
function readAll(element: HTMLElement, names: readonly string[]): Record<string, string> {
  const computed = getComputedStyle(element)
  const out: Record<string, string> = {}
  for (const name of names) {
    out[name] = computed.getPropertyValue(name).trim()
  }
  return out
}

/**
 * 在体外的临时 `.pi-root` 上读另一套主题的值。
 *
 * 必须挂在 document.body 上：`.pi-root` 的令牌就声明在这个类名上，
 * 脱离文档树的元素拿不到继承来的自定义属性。
 */
function readTheme(mode: 'light' | 'dark', names: readonly string[]): Record<string, string> {
  const probe = document.createElement('div')
  probe.className = 'pi-root'
  probe.setAttribute('data-pi-theme', mode)
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:0;height:0;pointer-events:none'
  document.body.append(probe)
  const values = readAll(probe, names)
  probe.remove()
  return values
}

export interface TokenExportState {
  /** 导出按钮旁边那句「已复制」。 */
  copiedLabel: string | null
  copyAll: () => void
  copyCurrent: () => void
}

/** 导出令牌 JSON：`copyCurrent` 只导当前主题，`copyAll` 导深浅两套。 */
export function useTokenExport(docRef: { current: HTMLElement | null }): TokenExportState {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  const write = useCallback((label: string, clone: (root: HTMLElement) => void) => {
    // 令牌声明在 `.pi-root` 上，从页面里的任意节点往上找它即可
    const root = docRef.current?.closest<HTMLElement>('.pi-root') ?? null
    if (root === null) return
    try {
      clone(root)
      setCopiedLabel(label)
    } catch {
      setCopiedLabel('复制失败')
    }
    window.setTimeout(() => setCopiedLabel(null), 1600)
  }, [docRef])

  const copyCurrent = useCallback(() => {
    write('已复制当前主题', root => {
      const names = collectTokenNames()
      const json = JSON.stringify({ theme: root.dataset.piTheme ?? 'light', tokens: readAll(root, names) }, null, 2)
      void navigator.clipboard.writeText(json)
    })
  }, [write])

  const copyAll = useCallback(() => {
    write('已复制两套主题', () => {
      const names = collectTokenNames()
      const json = JSON.stringify(
        {
          light: readTheme('light', names),
          dark: readTheme('dark', names),
        },
        null,
        2,
      )
      void navigator.clipboard.writeText(json)
    })
  }, [write])

  return { copiedLabel, copyAll, copyCurrent }
}
