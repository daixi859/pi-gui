/**
 * 颜色解析与 WCAG 对比度计算。
 *
 * 规范页的对比度是**运行时从真实 CSS 变量读出来算的**，不是手填表格：
 * 令牌改一个值，规范页立刻变红，不会出现「文档写 4.6、实际 3.9」。
 * 因此这里必须能吃 CSS 计算值可能出现的所有写法：`oklch()`、`#rgb/#rrggbb`、
 * `rgb()/rgba()`、`color(srgb …)` 退化成 `rgb()`（浏览器 computed style 会归一）。
 */

/** sRGB 0–1 三元组 + 0–1 alpha。 */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** 把 0–255 的 sRGB 通道编码回线性光。 */
function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** 从计算样式字符串里取出数字，顺带兜住 `none` 与百分号。 */
function num(raw: string, scale = 1): number {
  const trimmed = raw.trim()
  if (trimmed === 'none') return 0
  const value = Number.parseFloat(trimmed.replace('%', ''))
  if (!Number.isFinite(value)) return 0
  return trimmed.endsWith('%') ? (value / 100) * scale : value
}

/** `oklch(L C H / A)` → sRGB。L 可为百分号，C 与 H 常规数值。 */
function parseOklch(body: string): Rgba {
  const [main = '', alphaPart] = body.split('/')
  const parts = main.trim().split(/\s+/)
  const lightness = num(parts[0] ?? '0')
  const chroma = num(parts[1] ?? '0')
  const hue = num(parts[2] ?? '0')
  const alpha = alphaPart === undefined ? 1 : num(alphaPart)

  const h = (hue * Math.PI) / 180
  const a = chroma * Math.cos(h)
  const b = chroma * Math.sin(h)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const encode = (value: number): number => {
    const clamped = Math.min(1, Math.max(0, value))
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
  }
  return { r: encode(linear[0]!), g: encode(linear[1]!), b: encode(linear[2]!), a: alpha }
}

/** 任意 CSS 颜色字符串 → RGBA。解析失败返回黑色，由调用方决定是否显示「—」。 */
export function parseColor(input: string): Rgba {
  const value = input.trim().toLowerCase()
  if (value.startsWith('#') || /^[0-9a-f]{3,8}$/.test(value)) {
    const hex = value.replace('#', '')
    const wide = hex.length <= 4 ? [...hex].map(ch => ch + ch).join('') : hex
    const at = (index: number): number => Number.parseInt((wide.slice(index * 2, index * 2 + 2) || '0').padEnd(2, '0'), 16) / 255
    return { r: at(0), g: at(1), b: at(2), a: wide.length >= 8 ? at(3) : 1 }
  }
  const open = value.indexOf('(')
  if (open < 0) return { r: 0, g: 0, b: 0, a: 1 }
  const fn = value.slice(0, open)
  const body = value.slice(open + 1, value.lastIndexOf(')'))
  if (fn === 'oklch') return parseOklch(body)
  const [main = '', alphaPart] = body.split('/')
  const RAW = main.replace(/,/g, ' ').trim().split(/\s+/)
  const channels = RAW.slice(0, 3).map(part => num(part, 255) / 255)
  let alpha = alphaPart === undefined ? 1 : num(alphaPart)
  if (RAW.length >= 4) alpha = num(RAW[3]!)
  const [r = 0, g = 0, b = 0] = channels
  if (fn === 'srgb') return { r, g, b, a: alpha }
  return { r, g, b, a: alpha }
}

/** 把颜色按其 alpha 叠到不透明底色上，得到实际可见色。 */
export function composite(color: Rgba, background: Rgba): Rgba {
  const a = color.a
  return {
    r: color.r * a + background.r * (1 - a),
    g: color.g * a + background.g * (1 - a),
    b: color.b * a + background.b * (1 - a),
    a: 1,
  }
}

/** WCAG 2.x 相对亮度。 */
export function luminance(color: Rgba): number {
  return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b)
}

/** 对比度比值（1–21）。前景带 alpha 时先叠到底色上。 */
export function contrastRatio(foreground: string, background: string): number {
  const bg = parseColor(background)
  const fg = composite(parseColor(foreground), bg)
  const light = Math.max(luminance(fg), luminance(bg))
  const dark = Math.min(luminance(fg), luminance(bg))
  return (light + 0.05) / (dark + 0.05)
}

/** AA 判定：正文 4.5、大字 3、非文字 3。 */
export type ContrastLevel = 'pass' | 'large-only' | 'fail'

/** 按 WCAG AA 给出一句结论。 */
export function judge(ratio: number, large = false): ContrastLevel {
  if (ratio >= 4.5) return 'pass'
  if (ratio >= 3) return large ? 'pass' : 'large-only'
  return 'fail'
}

/** 两色混合（用于生成 hover 蒙层的预览样本）。 */
export function mix(base: string, overlay: string, amount = 0.5): string {
  const b = parseColor(base)
  const o = parseColor(overlay)
  const c = composite({ ...o, a: o.a * amount }, b)
  const hex = (v: number): string => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}${c.a < 1 ? hex(c.a) : ''}`
}

/** 给色块用的展示值：oklch 原串里的 alpha 在预览里要能看出来。 */
export function toCss(color: Rgba): string {
  const round = (v: number): number => Math.round(v * 255)
  return `rgb(${round(color.r)} ${round(color.g)} ${round(color.b)} / ${Number(color.a.toFixed(2))})`
}

/** CSS 颜色串 → `#rrggbb`（带 alpha 时追加两位）。给规范页标注 HEX 用。 */
export function toHex(input: string): string {
  const color = parseColor(input)
  const hex = (v: number): string =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}${color.a < 1 ? hex(color.a) : ''}`
}
