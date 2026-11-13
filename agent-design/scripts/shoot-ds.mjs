/**
 * PiDS 截图与冒烟验收：三个分区各截若干张，顺便断言没有横向溢出、页面异常、
 * 双主题并排存在、令牌导出可用。
 *
 * 运行：node scripts/shoot-ds.mjs（需要 dev server 在 5173）。
 * 与 shoot.mjs 的分工：那个脚本管旧的 Player / Gallery，这个只管 PiDS。
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import path from 'node:path'

const require = createRequire(import.meta.url)
const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim()
const { chromium } = require(path.join(globalRoot, 'playwright'))

const OUT = path.join(import.meta.dirname, '..', 'screenshots')
const BASE = 'http://localhost:5173'

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await context.newPage()
const problems = []

page.on('pageerror', error => problems.push(`页面异常: ${error.message}`))
page.on('console', message => {
  if (message.type() === 'error') problems.push(`console.error: ${message.text()}`)
})

/** 断言 document 没有横向溢出。 */
async function overflow(tag) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement
    return { doc: doc.scrollWidth - doc.clientWidth }
  })
  if (result.doc > 1) problems.push(`${tag}: document 横向溢出 ${result.doc}px`)
}

/** 滚到某章并截图。用目录按钮而不是 scrollIntoView，顺带验证目录可用。 */
async function gotoChapter(label, file) {
  await page.getByRole('button', { name: label }).click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${file}` })
}

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

/* ---------------------------------- 规范页 --------------------------------- */

const theme = await page.evaluate(
  () => document.querySelector('.pi-root')?.getAttribute('data-pi-theme') ?? null,
)
if (theme !== 'light') problems.push(`默认主题不是浅色: ${String(theme)}`)

// 首屏必须停在第一章：曾经因为 autoFocus 一进来就滚到第八章
const initialScroll = await page.evaluate(
  () => document.querySelector('.pi-root [class*="_doc_"]')?.scrollTop ?? -1,
)
if (initialScroll > 8) problems.push(`规范页首屏没有停在顶部: scrollTop=${initialScroll}`)

await page.screenshot({ path: `${OUT}/ds-spec-cover.png` })
await overflow('spec')

await gotoChapter('02 色彩', 'ds-spec-color.png')
await gotoChapter('04 间距与布局', 'ds-spec-space.png')
await gotoChapter('06 图标', 'ds-spec-icons.png')
await gotoChapter('07 动效', 'ds-spec-motion.png')
await gotoChapter('08 可访问性', 'ds-spec-a11y.png')

// 扫光真的在动（CSS Modules 会改名 @keyframes，内联 animation 指不到）
const sweepBefore = await page.evaluate(() => {
  const bar = document.querySelector('[class*="sweepBar"]')
  return bar === null ? null : getComputedStyle(bar).transform
})
await page.waitForTimeout(260)
const sweepAfter = await page.evaluate(() => {
  const bar = document.querySelector('[class*="sweepBar"]')
  return bar === null ? null : getComputedStyle(bar).transform
})
if (sweepBefore === null) problems.push('找不到运行指示器的扫光样例')
else if (sweepBefore === sweepAfter) problems.push('运行指示器扫光没有动')

// 令牌导出：导出的 JSON 必须两套主题都有值且确实不同
await page.getByRole('button', { name: '导出浅色 + 深色' }).click()
await page.waitForTimeout(500)
const exported = await page.evaluate(() => navigator.clipboard.readText())
try {
  const parsed = JSON.parse(exported)
  const lightCount = Object.keys(parsed.light ?? {}).length
  const darkCount = Object.keys(parsed.dark ?? {}).length
  if (lightCount < 100) problems.push(`浅色令牌太少: ${lightCount}`)
  if (darkCount !== lightCount) problems.push(`两套主题令牌数量不一致: ${lightCount} / ${darkCount}`)
  if (parsed.light['--pi-canvas'] === parsed.dark['--pi-canvas']) {
    problems.push('深色主题没有重绑 --pi-canvas')
  }
} catch {
  problems.push(`令牌导出不是合法 JSON（前 80 字）: ${exported.slice(0, 80)}`)
}

/* --------------------------------- 组件页 --------------------------------- */

await page.getByRole('button', { name: '基础组件' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/ds-components-button.png` })
await overflow('components')

const docCount = await page.locator('.pi-root nav[aria-label="基础组件列表"] button').count()
if (docCount !== 26) problems.push(`组件列表按钮数不对: ${docCount}`)

// 每篇文档都要有深浅双主题并排
const panes = await page.locator('.pi-root [class*="themePane"]').count()
if (panes < 2) problems.push(`双主题并排缺失: ${panes}`)

// 切到输入类，看另一组
await page.getByRole('button', { name: 'Textarea' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/ds-components-textarea.png` })

/* --------------------------------- 高保真 --------------------------------- */

await page.getByRole('button', { name: '高保真' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/ds-surface-chat.png` })
await overflow('surface-chat')

const turnCount = await page.locator('.pi-root [class*="_turn_"]').count()
if (turnCount === 0) problems.push('主对话壳没有渲染回合')

for (const [label, file] of [
  ['起始页', 'ds-surface-start.png'],
  ['设置页', 'ds-surface-settings.png'],
  ['浮层', 'ds-surface-overlays.png'],
  ['空态与异常', 'ds-surface-states.png'],
]) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${file}` })
  await overflow(label)
}

// 浮层面：命令面板 / 确认弹窗 / Toast，三个都要能开能关
await page.getByRole('button', { name: '浮层', exact: true }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: '命令面板' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/ds-surface-palette.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
if ((await page.locator('.pi-root [class*="paletteScrim"]').count()) > 0) {
  problems.push('命令面板没有响应 Esc')
}

await page.getByRole('button', { name: '确认弹窗' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/ds-surface-dialog.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

await page.getByRole('button', { name: 'Toast · 失败' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/ds-surface-toast.png` })

/* --------------------------------- 深色主题 -------------------------------- */

await page.getByRole('button', { name: '主对话壳', exact: true }).click()
await page.getByRole('button', { name: '深色' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/ds-surface-chat-dark.png` })
await overflow('surface-chat-dark')

await page.getByRole('button', { name: '基础组件' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/ds-components-dark.png` })

await page.getByRole('button', { name: '浅色' }).click()
await page.waitForTimeout(300)

/* ---------------------------------- 窄屏 ---------------------------------- */

await page.getByRole('button', { name: '高保真' }).click()
await page.getByRole('button', { name: '主对话壳', exact: true }).click()
await page.setViewportSize({ width: 900, height: 820 })
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/ds-surface-chat-900.png` })
await overflow('900')

await browser.close()
console.log(problems.length === 0 ? 'PiDS screenshots ok' : problems.join('\n'))
process.exit(problems.length === 0 ? 0 : 1)
