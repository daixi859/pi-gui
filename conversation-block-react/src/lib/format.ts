/** 纯展示用的小工具。 */

/** 1分15秒 / 12 秒；用于回合头与工具耗时。 */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return ''
  const seconds = Math.max(0, ms) / 1000
  if (seconds < 1) return '不到 1 秒'
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes} 分` : `${minutes} 分 ${rest} 秒`
}

/** 毫秒 → `m:ss`，回放进度用。 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** 把参数对象压成一行摘要，嵌套调用与未知工具用。 */
export function summarizeArgs(args: unknown, max = 80): string {
  if (args === undefined || args === null) return ''
  if (typeof args === 'string') return args.length > max ? `${args.slice(0, max)}…` : args
  if (typeof args !== 'object') return String(args)
  const first = Object.values(args as Record<string, unknown>).find(
    value => typeof value === 'string' && value !== '',
  )
  const text = typeof first === 'string' ? first : JSON.stringify(args)
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 事件列表里的短描述（调试抽屉用）。 */
export function describeEvent(ev: { type: string } & Record<string, unknown>): string {
  switch (ev.type) {
    case 'message_update': {
      const inner = ev.assistantMessageEvent as { type: string; contentIndex?: number } | undefined
      return `${ev.type} · ${inner?.type ?? ''}${inner?.contentIndex !== undefined ? `#${inner.contentIndex}` : ''}`
    }
    case 'tool_execution_start':
    case 'tool_execution_end':
      return `${ev.type} · ${String(ev.toolName ?? '')}`
    case 'message_start':
    case 'message_end': {
      const message = ev.message as { role?: string } | undefined
      return `${ev.type} · ${message?.role ?? ''}`
    }
    default:
      return ev.type
  }
}
