/**
 * 渲染计数（只在 dev 生效）：验收「流式时列表不重渲染」用。
 *
 * 在组件渲染体里调 count('side')，然后在控制台或 PI_SHOT_JS 里读
 * window.__piPerf.renders.side。生产构建里 count 是空函数，被打包器摇掉。
 */
const dev = import.meta.env.DEV

const renders: Record<string, number> = {}

/** 记一次渲染；reset 后从零数，方便「流式 5 秒内 Sidebar 渲染几次」这种量法 */
export function count(name: string): void {
  if (!dev) return
  renders[name] = (renders[name] ?? 0) + 1
}

export function resetPerf(): void {
  if (!dev) return
  for (const k of Object.keys(renders)) delete renders[k]
}

if (dev) {
  const w = window as unknown as {
    __piPerf?: { renders: Record<string, number>; reset: () => void }
  }
  w.__piPerf = { renders, reset: resetPerf }
}
