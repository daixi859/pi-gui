/**
 * 调试日志：追加写到项目根的 tmp/log/ 目录，每次启动一个以时间戳命名的文件。
 * tmp/ 是约定的一次性产物目录（见 tmp/README.md），已被 .gitignore 忽略。
 * 日志只是辅助，任何写失败都静默放弃，不能反过来弄崩应用。
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// 只在开发环境落盘：打包版不建 tmp/、不写文件（与渲染层 [boot] 埋点同一开关）
const enabled = !!process.env.ELECTRON_RENDERER_URL
const dir = join(process.cwd(), 'tmp', 'log')
// 主进程拉起宿主时会把同一个文件名传下来：三次进程的时间线落在一个文件里，才能按顺序读
const stamp = process.env.PI_LOG_FILE ?? startupStamp()
const file = join(dir, `${stamp}.log`)
let ready = false

/** 本次启动的日志文件名（不含扩展名），主进程用它传给宿主 */
export const logStamp = stamp

/** 文件名用本地时间：2026-11-09_15-42-07.log */
function startupStamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

/** 对象序列化并截断，控制流式会话别把日志撑爆 */
function fmt(v: unknown): string {
  if (typeof v === 'string') return v
  try {
    const s = JSON.stringify(v)
    return s && s.length > 800 ? s.slice(0, 800) + `…(+${s.length - 800}B)` : String(s)
  } catch {
    return String(v)
  }
}

/** 自本进程启动以来的毫秒数：启动日志里行首带它，一眼看出「这行多晚才来」 */
export const sinceStart = (): number => Math.round(process.uptime() * 1000)

/** 追加一行：ISO 时间 + 进程内已过毫秒 + 标签 + 内容 */
export function logLine(tag: string, ...parts: unknown[]): void {
  if (!enabled) return
  const line = `${new Date().toISOString()} +${sinceStart()}ms [${tag}] ${parts.map(fmt).join(' ')}\n`
  try {
    if (!ready) {
      mkdirSync(dir, { recursive: true })
      ready = true
    }
    appendFileSync(file, line)
  } catch {
    // 目录建不了 / 盘写不下：放弃这一行
  }
}

/** 量一段异步操作的耗时，跑完（含抛错）都记一行：await track('host:init', 'loader.reload', () => loader.reload()) */
export async function track<T>(tag: string, label: string, run: () => Promise<T>): Promise<T> {
  const at = Date.now()
  try {
    return await run()
  } finally {
    logLine(tag, `${label} ${Date.now() - at}ms`)
  }
}

/** 把流式 chunk 按行切好再落盘，避免一条日志被 TCP/管道的分块拆成多行 */
export function drainLines(onLine: (line: string) => void): (chunk: Buffer) => void {
  let rest = ''
  return (chunk) => {
    rest += String(chunk)
    for (;;) {
      const at = rest.indexOf('\n')
      if (at < 0) break
      onLine(rest.slice(0, at))
      rest = rest.slice(at + 1)
    }
  }
}
