/**
 * 把 deepseek 的图标 sprite 注入文档：`icons/index.tsx` 里的每个图标都是
 * `<use href="#dsw-icon-…">`，没有 symbol 就渲染不出来。搬自 harness 的
 * ui-theme/icon-sprite.ts，去掉主题替换与 Cordis 生命周期。
 */
import { ICON_SYMBOLS, type IconSymbolId } from './artwork'

const SVG_NS = 'http://www.w3.org/2000/svg'
/** 只影响单次渲染、不属于可复用图形本身的根属性。 */
const DROPPED = new Set(['width', 'height', 'xmlns', 'class', 'aria-hidden'])

function toSymbol(id: string, markup: string): SVGSymbolElement {
  const root = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement
  const symbol = document.createElementNS(SVG_NS, 'symbol')
  for (const { name, value } of root.attributes) if (!DROPPED.has(name)) symbol.setAttribute(name, value)
  symbol.id = id
  symbol.append(...[...root.childNodes].map(node => document.importNode(node, true)))
  return symbol
}

let installed = false

/** 幂等安装；在首次渲染前调用即可。 */
export function installIconSprite(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  const sprite = document.createElementNS(SVG_NS, 'svg')
  sprite.setAttribute('aria-hidden', 'true')
  sprite.setAttribute('data-dsh-icon-sprite', '')
  sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
  for (const [id, markup] of Object.entries(ICON_SYMBOLS) as [IconSymbolId, string][]) {
    sprite.append(toSymbol(id, markup))
  }
  document.body.prepend(sprite)
}
