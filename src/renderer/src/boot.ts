/**
 * 启动耗时埋点（只在 dev 生效）：`console.log('[boot] …')` 会被主进程的 console-message 监听
 * 转发进 tmp/log/<时间戳>.log，和主进程、引擎宿主的时间线落在同一个文件里，方便对齐。
 *
 * 时间基准是渲染层的 navigation start（performance.now() 从页面加载算起），
 * 主进程和宿主用的是各自进程的 uptime，两个进程各有自己的零点，比较时看的是先后顺序。
 *
 * 本模块必须是 main.tsx 的第一个 import：它要在 React/shiki 那些模块求值之前就挂上观察器。
 */
const dev = import.meta.env.DEV

export function bootLog(label: string): void {
  if (!dev) return
  console.log(`[boot] ${label} +${Math.round(performance.now())}ms`)
}
/** 资源时间线 + 长任务：只在真正要查启动慢时调一次（数量大，平时不打） */
export function bootResources(limit = 10): void {
  if (!dev) return
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (nav) {
    bootLog(
      `导航 ttfb=${Math.round(nav.responseStart - nav.requestStart)}ms 响应体=${Math.round(
        nav.responseEnd - nav.responseStart
      )}ms domInteractive=${Math.round(nav.domInteractive)}ms`
    )
  }
  const all = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  const sum = (rows: PerformanceResourceTiming[]): number => Math.round(rows.reduce((a, r) => a + r.duration, 0))
  const deps = all.filter((r) => r.name.includes('/node_modules/.vite/deps/'))
  const src = all.filter((r) => r.name.includes('/src/'))
  const lastEnd = all.reduce((a, r) => Math.max(a, r.startTime + r.duration), 0)
  bootLog(
    `资源 ${all.length} 个（deps ${deps.length} 个 ${sum(deps)}ms，src ${src.length} 个 ${sum(
      src
    )}ms），累计 ${sum(all)}ms，最晚结束 +${Math.round(lastEnd)}ms`
  )
  // 最慢的请求：dev 下每个模块是一次 HTTP，看它们是不是把关键路径串起来了
  for (const r of [...all].sort((a, b) => b.duration - a.duration).slice(0, limit)) {
    bootLog(`  慢请求 ${Math.round(r.duration)}ms @${Math.round(r.startTime)}ms ${r.name.replace(/^https?:\/\/[^/]+/, '')}`)
  }
  const long = performance.getEntriesByType('longtask')
  bootLog(`长任务 ${long.length} 个，累计 ${Math.round(long.reduce((a, e) => a + e.duration, 0))}ms`)
  for (const e of long.slice(0, limit)) bootLog(`  长任务 @${Math.round(e.startTime)}ms 持续 ${Math.round(e.duration)}ms`)
}
