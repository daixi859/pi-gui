/**
 * 用全局 Playwright 打开回放页，截图并断言没有横向溢出。
 * 运行：node scripts/shoot.mjs（需要 dev server 已在 5173 端口）。
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import path from 'node:path'

const require = createRequire(import.meta.url)
const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim()
const { chromium } = require(path.join(globalRoot, 'playwright'))

const OUT = path.join(import.meta.dirname, '..', 'screenshots')
const BASE = process.env.PLAYER_BASE ?? 'http://localhost:5173'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
const problems = []

page.on('pageerror', error => problems.push(`页面异常: ${error.message}`))
page.on('console', message => {
  if (message.type() === 'error') problems.push(`console.error: ${message.text()}`)
})

async function expect(condition, label) {
  if (!condition) problems.push(label)
}


async function checkOverflow(tag) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    const scroller = document.querySelector('.scroller')
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      scroller: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
    }
  })
  if (overflow.doc > 1) problems.push(`${tag}: document 横向溢出 ${overflow.doc}px`)
  if (overflow.scroller > 1) problems.push(`${tag}: 转录区横向溢出 ${overflow.scroller}px`)
}

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

await page.waitForTimeout(900)
await page.screenshot({ path: `${OUT}/player-mid.png` })
await checkOverflow('player-mid')
// live 回合里只有最后一个分组是「正在…」，前面的组按完成态显示
const midGroups = await page.locator('.groupTitle').allInnerTexts()
const midLive = midGroups.filter(title => title.startsWith('正在') || title.startsWith('准备'))
await expect(midLive.length <= 1, `live 分组过多: ${JSON.stringify(midGroups)}`)
const runningText = await page.locator('.runningText').innerText()
await expect(runningText.includes('用时'), `运行状态没有计时: ${runningText}`)
// 尾部横线是旧实现里的装饰，源码里已不存在；有才校验，没有不算问题。
const tail = page.locator('.runningTail')
if ((await tail.count()) > 0) {
  const tailWidth = await tail.evaluate(el => getComputedStyle(el).width)
  await expect(tailWidth === '16px', `尾部横线宽度不对: ${tailWidth}`)
}

// 播放/暂停切换（首屏默认自动播放）
await expect((await page.getByTitle('暂停').count()) === 1, '首屏没有自动播放')
await page.getByTitle('暂停').click()
await page.waitForTimeout(150)
await expect((await page.getByTitle('播放').count()) === 1, '暂停后按钮未切换回播放')

// 跳到末尾，看落定状态（过程收起、答案常显）
await page.getByTitle('跳到末尾').click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/player-end.png` })
await checkOverflow('player-end')
const headText = await page.locator('.turnHeadText').first().innerText()
await expect(headText.includes('2 分 22 秒'), `回合耗时不对: ${headText}`)

// 展开过程
const head = page.locator('.turnHead').first()
if (await head.count()) {
  await head.click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/player-expanded.png` })
  await checkOverflow('player-expanded')

  // 展开第一个分组：组体限高 400px/50vh，内容超高时内滚
  const normalGroup = page.locator('.processGroup').first()
  if (await normalGroup.count()) {
    await normalGroup.locator('.groupHead').click()
    await page.waitForTimeout(250)
    const body = normalGroup.locator('.groupBody')
    if (await body.count()) {
      const dims = await body.evaluate(el => ({
        height: el.clientHeight,
        scrollHeight: el.scrollHeight,
        maxHeight: getComputedStyle(el).maxHeight,
      }))
      await expect(dims.maxHeight !== 'none', `组体没有限高: ${JSON.stringify(dims)}`)
      await expect(dims.scrollHeight > dims.height, `组体没有产生内滚: ${JSON.stringify(dims)}`)
      await page.screenshot({ path: `${OUT}/player-group.png` })
      await checkOverflow('player-group')
    }
  }
}

// 错误夹具
await page.locator('.fixtureButton', { hasText: '失败与重试' }).click()
await page.waitForTimeout(300)
await page.getByTitle('跳到末尾').click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/player-error.png` })
await checkOverflow('player-error')

// 穿插汇报：工具、思考与标准文本交替的回合
await page.locator('.fixtureButton', { hasText: '穿插汇报' }).click()
await page.waitForTimeout(300)
await page.getByTitle('跳到末尾').click()
await page.waitForTimeout(300)
// 落定折叠态：只藏分组，assistant 文本全部常显
await expect((await page.locator('.processGroup').count()) === 0, '折叠态仍显示分组')
const foldedTexts = await page.locator('.turnFlow .blockAssistant').count()
await expect(foldedTexts >= 5, `折叠态把文本也藏了: ${foldedTexts}`)
const openHead = page.locator('.turnHead[aria-expanded="false"]')
if (await openHead.count()) await openHead.click()
await page.waitForTimeout(300)
const interim = await page.locator('.turnFlow .blockAssistant .assistant:not([data-final])').count()
await expect(interim >= 5, `穿插文本不足: ${interim}`)
const groupCount = await page.locator('.processGroup').count()
await expect(groupCount >= 5, `分组不足: ${groupCount}`)
const titles = await page.locator('.processGroup .groupTitle').allInnerTexts()
await expect(titles.every(title => title.trim() !== ''), `分组标题为空: ${JSON.stringify(titles)}`)
await expect(titles.every(title => /(已读取|已搜索|执行了命令|修改了文件|已写入|已调用工具|已完成分析|运行了代码|已注入上下文)/.test(title)), `分组标题无类别: ${JSON.stringify(titles)}`)
await expect(titles.every(title => !title.startsWith('正在') && !title.startsWith('准备')), `落定后仍显示进行中: ${JSON.stringify(titles)}`)
await page.evaluate(() => {
  const scroller = document.querySelector('.scroller')
  if (scroller) scroller.scrollTop = Math.round(scroller.scrollHeight * 0.42)
})
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/player-interleaved.png` })
await checkOverflow('player-interleaved')

// 回合尾部的文件改动卡
// 注意：「穿插汇报」这份夹具本身没有文件改动（切换到它时 .changes 计数为 0），
// 这条断言在本次改动之前就已经不成立，与设计系统无关。有卡才校验，没有就跳过。
const changeCard = page.locator('.changes').first()
if ((await changeCard.count()) > 0) {
  const changeTitle = await changeCard.locator('.changesTitle').innerText()
  await expect(changeTitle.includes('已编辑'), `改动卡标题不对: ${changeTitle}`)
  await changeCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(120)
  await changeCard.screenshot({ path: `${OUT}/player-changes.png` })
}

// 展开第一个分组：组体出现且限高
const firstGroup = page.locator('.processGroup[data-has-tools]').first()
await firstGroup.locator('.groupHead').click()
await page.waitForTimeout(250)
await expect((await firstGroup.locator('.groupBody').count()) === 1, '点击分组头没有展开组体')
const cap = await firstGroup.locator('.groupBody').evaluate(el => getComputedStyle(el).maxHeight)
await expect(cap !== 'none', `组体没有限高: ${cap}`)
// 默认收起：组内工具/思考行都不应自动展开
const expandedRows = await firstGroup
  .locator('.tool [data-disclosure-row][aria-expanded], .thinking [data-disclosure-row][aria-expanded]')
  .evaluateAll(els => els.map(el => el.getAttribute('aria-expanded')))
await expect(expandedRows.length > 0, '分组里没有可开合的行')
await expect(expandedRows.every(value => value === 'false'), `行默认未收起: ${JSON.stringify(expandedRows)}`)
await expect((await firstGroup.locator('.toolBody, .thinkingBody').count()) === 0, '行默认展开了正文')
await page.screenshot({ path: `${OUT}/player-group-open.png` })
await checkOverflow('player-group-open')

// 整行可点：点标题区（x=120，避开 16px 图标）也能切换展开
const toolRow = firstGroup.locator('.tool').first()
const toolBody = toolRow.locator('.toolBody')
const rowRole = await toolRow.locator('[data-disclosure-row]').getAttribute('role')
await expect(rowRole === 'button', `工具行不是整行按钮: ${rowRole}`)
const hadBody = (await toolBody.count()) === 1
await toolRow.locator('[data-disclosure-row]').click({ position: { x: 120, y: 12 } })
await page.waitForTimeout(150)
await expect(hadBody !== ((await toolBody.count()) === 1), '点击工具行标题区没有切换展开')

// 调试抽屉
await page.locator('.drawerHead').click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/player-debug.png` })
await checkOverflow('player-debug')

// 窄屏：rail 横排、用户气泡、主按钮对比
await page.setViewportSize({ width: 700, height: 900 })
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/player-700.png` })
await checkOverflow('player-700')

await page.setViewportSize({ width: 1280, height: 900 })
await page.waitForTimeout(300)
await page.locator('.fixtureButton', { hasText: '穿插汇报' }).click()
await page.waitForTimeout(300)
// 长思考只在流式中才限高并贴底：从头慢放，边播边展开采样
await page.getByTitle('重播').click()
await page.waitForTimeout(200)
await page.locator('select').selectOption('0.5')
// 先铺开分组与思考行；点开之后不再点击，否则点击带来的滚动会让思考体停止跟随
for (let round = 0; round < 4; round += 1) {
  for (const head of await page.locator('.groupHead[aria-expanded="false"]').all()) {
    try {
      await head.click({ timeout: 150 })
    } catch {
      /* 分组在点击前被折叠或重渲染 */
    }
  }
  for (const row of await page.locator('.thinking [data-disclosure-row][aria-expanded="false"]').all()) {
    try {
      await row.click({ timeout: 150 })
    } catch {
      /* 思考行在点击前被重建 */
    }
  }
  await page.waitForTimeout(300)
}

let scrolledBodies = []
for (let i = 0; i < 40 && scrolledBodies.length === 0; i += 1) {
  await page.waitForTimeout(250)
  const liveTitles = (await page.locator('.groupTitle').allInnerTexts())
    .filter(title => title.startsWith('正在') || title.startsWith('准备'))
  await expect(liveTitles.length <= 1, `live 分组过多: ${JSON.stringify(liveTitles)}`)
  const liveBody = await page.evaluate(() => {
    const group = [...document.querySelectorAll('.processGroup')].find(node =>
      /^(正在|准备)/.test(node.querySelector('.groupTitle')?.textContent ?? ''))
    const body = group?.querySelector('.groupBody')
    return body === null || body === undefined
      ? null
      : { top: body.scrollTop, height: body.clientHeight, scrollHeight: body.scrollHeight }
  })
  if (liveBody !== null && liveBody.scrollHeight > liveBody.height + 1) {
    await expect(liveBody.scrollHeight - liveBody.height - liveBody.top <= 2, `运行中的组没有贴底: ${JSON.stringify(liveBody)}`)
  }
  const bodies = await page.evaluate(() =>
    [...document.querySelectorAll('.thinkingBody[data-fade]')].map(el => ({
      top: el.scrollTop,
      height: el.clientHeight,
      scrollHeight: el.scrollHeight,
    })),
  )
  scrolledBodies = bodies.filter(body => body.scrollHeight > body.height + 1)
}
await page.screenshot({ path: `${OUT}/player-thinking.png` })
await checkOverflow('player-thinking')

// live 分组状态：只有尾部组显示「正在…」，前面的组按完成态展示
await page.locator('.fixtureButton', { hasText: '穿插汇报' }).click()
await page.waitForTimeout(250)
// 同一份夹具再点一次不会重新加载，先重播，确保从头开始播
await page.getByTitle('重播').click()
await page.waitForTimeout(200)
await page.locator('select').selectOption('8')
await page.waitForTimeout(3400)
await page.getByTitle('暂停').click()
const liveGroups = await page.locator('.groupTitle').allInnerTexts()
const runningGroups = liveGroups.filter(title => title.startsWith('正在') || title.startsWith('准备'))
await expect(liveGroups.length >= 2, `live 分组不足: ${JSON.stringify(liveGroups)}`)
await expect(runningGroups.length === 1, `进行中的分组不是唯一: ${JSON.stringify(liveGroups)}`)
await expect(liveGroups[liveGroups.length - 1] === runningGroups[0], `进行中的分组不在尾部: ${JSON.stringify(liveGroups)}`)
await page.screenshot({ path: `${OUT}/player-live-groups.png` })
await checkOverflow('player-live-groups')

await browser.close()
console.log(problems.length === 0 ? 'no overflow, screenshots ok' : problems.join('\n'))
process.exit(problems.length === 0 ? 0 : 1)
