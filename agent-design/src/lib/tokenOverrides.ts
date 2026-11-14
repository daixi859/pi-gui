import { useEffect, useState } from 'react'

/*
 * 令牌面板的取值与持久化：从 :root 量出真值、回放用户改过的覆盖、写回 :root。
 * 只存改过的键，没动的继续跟 tokens.css 走。
 */

/** 兜底值：只在探测失败时用，真实值由 readDefaults() 从 :root 量出来 */
const DEFAULTS = {
  spacing: 4,
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 16,
  textXs: 12,
  textSm: 14,
  textXl: 28,
  canvas: '#ececee',
  panel: '#f8f8f8',
  surface: '#ffffff',
  fg: '#26241f',
  muted: '#8b8781',
  edge: '#e0e0e0',
  fontUi: "-apple-system, 'Segoe UI Variable Text', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif",
  fontMono: "'Cascadia Mono', 'Consolas', ui-monospace, monospace"
}
export type Tokens = typeof DEFAULTS
export type TokenKey = keyof Tokens

/** 每个字段对应的 CSS 变量；px 自动补单位，font 原样写入 */
export const VARS: Record<TokenKey, [string, 'px' | 'font' | '']> = {
  spacing: ['--pi-spacing', 'px'],
  radiusSm: ['--pi-radius-sm', 'px'],
  radiusMd: ['--pi-radius-md', 'px'],
  radiusLg: ['--pi-radius-lg', 'px'],
  textXs: ['--pi-text-xs', 'px'],
  textSm: ['--pi-text-sm', 'px'],
  textXl: ['--pi-text-2xl', 'px'],
  canvas: ['--pi-canvas', ''],
  panel: ['--pi-panel', ''],
  surface: ['--pi-surface', ''],
  fg: ['--pi-fg', ''],
  muted: ['--pi-muted', ''],
  edge: ['--pi-edge', ''],
  fontUi: ['--pi-font-ui', 'font'],
  fontMono: ['--pi-font-mono', 'font']
}
export const NUM_KEYS: TokenKey[] = ['spacing', 'radiusSm', 'radiusMd', 'radiusLg', 'textXs', 'textSm', 'textXl']
export const COLOR_KEYS: TokenKey[] = ['canvas', 'panel', 'surface', 'fg', 'muted', 'edge']
export const FONT_KEYS: TokenKey[] = ['fontUi', 'fontMono']
/* 键带版本：默认令牌变化时换版本号，旧的持久化值作废 */
const STORE = 'pi.preview.tokens.v6'

/** 从 :root 量真实值：自定义属性里是 color-mix()/var() 原文，读不出最终颜色 */
function readDefaults(): Tokens {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;left:-9999px;width:0;height:0'
  document.body.append(el)
  const canvas = document.createElement('canvas').getContext('2d')!
  const val = (k: TokenKey): number | string => {
    const [name, unit] = VARS[k]
    if (unit === 'px') {
      el.style.width = `var(${name})`
      return parseFloat(getComputedStyle(el).width) || DEFAULTS[k]
    }
    if (unit === 'font') {
      el.style.fontFamily = `var(${name})`
      return getComputedStyle(el).fontFamily || DEFAULTS[k]
    }
    el.style.backgroundColor = `var(${name})`
    // color-mix 的计算值可能是 color(srgb …)，交给 canvas 归一成 8 位 rgb
    canvas.fillStyle = getComputedStyle(el).backgroundColor
    canvas.clearRect(0, 0, 1, 1)
    canvas.fillRect(0, 0, 1, 1)
    const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
  }
  const pairs = (Object.keys(VARS) as TokenKey[]).map((k) => [k, val(k)])
  el.remove()
  return Object.fromEntries(pairs) as Tokens
}

/** :root 的真值；量之前先摘掉内联覆盖，否则量到的是自己写上去的值 */
let BASE: Tokens | null = null
export function themeTokens(): Tokens {
  if (!BASE) {
    const root = document.documentElement
    const inline = root.getAttribute('style')
    root.removeAttribute('style')
    BASE = readDefaults()
    if (inline) root.setAttribute('style', inline)
  }
  return BASE
}

function stored(): Partial<Tokens> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}')
  } catch {
    return {}
  }
}

/** 启动时就回放已保存的令牌，保证不进预览页也是同一套值 */
export function initTokens(): void {
  const root = document.documentElement.style
  for (const [k, v] of Object.entries(stored())) {
    const [name, unit] = VARS[k as TokenKey]
    root.setProperty(name, unit === 'px' ? `${v}px` : String(v))
  }
}

export function useTokens(): [Tokens, (k: TokenKey, v: number | string) => void, () => void] {
  const [tokens, setTokens] = useState<Tokens>(() => ({ ...themeTokens(), ...stored() }))
  const [dirty, setDirty] = useState<Set<TokenKey>>(() => new Set(Object.keys(stored()) as TokenKey[]))
  // 只把改过的键写到 :root 并持久化；没动的继续跟 tokens.css 走，进预览页不会突然变色
  useEffect(() => {
    const root = document.documentElement.style
    const saved: Record<string, number | string> = {}
    for (const k of Object.keys(VARS) as TokenKey[]) {
      const [name, unit] = VARS[k]
      if (!dirty.has(k)) {
        root.removeProperty(name)
        continue
      }
      root.setProperty(name, unit === 'px' ? `${tokens[k]}px` : String(tokens[k]))
      saved[k] = tokens[k]
    }
    localStorage.setItem(STORE, JSON.stringify(saved))
  }, [tokens, dirty])
  return [
    tokens,
    (k, v) => {
      setTokens((prev) => ({ ...prev, [k]: v }))
      setDirty((prev) => new Set(prev).add(k))
    },
    () => {
      setTokens(themeTokens())
      setDirty(new Set())
    }
  ]
}
