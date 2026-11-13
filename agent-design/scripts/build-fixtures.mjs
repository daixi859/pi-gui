// 从真实 pi 会话生成回放夹具。事件形状与 `pi --mode json` 一致（message_update 只带增量
// assistantMessageEvent），额外字段：
//   dt        距上一条事件的毫秒数（回放节奏，真实流里没有）
//   durationMs  thinking_end / tool_execution_end 上的真实耗时（会话里的注解）
// 用法：node scripts/build-fixtures.mjs [id...]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const config = JSON.parse(fs.readFileSync(path.join(here, 'fixtures.config.json'), 'utf8'))
const only = process.argv.slice(2)
const OUT_DIR = path.join(root, 'public', 'fixtures')

const OUTPUT_CAP = 16_000 // 单条工具结果保留的字符数，超出截断并标注
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const chunk = (s, size) => {
  const out = []
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size))
  return out
}

const slimText = text =>
  text.length <= OUTPUT_CAP ? text : `${text.slice(0, OUTPUT_CAP)}\n… [输出已截断，原长 ${text.length} 字符]`

const slimContent = content =>
  (Array.isArray(content) ? content : [content])
    .filter(Boolean)
    .map(c => (c.type === 'image' ? { type: 'image', mimeType: c.mimeType, data: '' } : c))
    .map(c => (c.type === 'text' ? { ...c, text: slimText(c.text) } : c))

function build(cfg) {
  const entries = fs
    .readFileSync(cfg.file, 'utf8')
    .split('\n')
    .slice(cfg.from - 1, cfg.to)
    .filter(Boolean)
    .map(l => JSON.parse(l))

  const thinkingMs = new Map()
  for (const e of entries) {
    if (e.type === 'custom' && e.customType === 'compact-thinking-duration') {
      thinkingMs.set(`${e.data.messageTimestamp}:${e.data.contentIndex}`, e.data.durationMs)
    }
  }

  const events = []
  const push = (dt, ev) => events.push({ dt, ev })
  const limited = () => cfg.maxEvents !== undefined && events.length >= cfg.maxEvents

  let lastTs = null
  let lastAsstTs = null
  const gap = ts => {
    const dt = lastTs == null ? 0 : clamp(ts - lastTs, 150, 4000)
    lastTs = ts
    return dt
  }

  let aborted = cfg.aborted === true
  for (const e of entries) {
    if (limited()) break
    if (e.type !== 'message') continue
    const m = e.message

    if (m.role === 'user') {
      const dt = gap(m.timestamp)
      const msg = { role: 'user', content: slimContent(m.content), timestamp: m.timestamp }
      push(dt, { type: 'message_start', message: msg })
      push(0, { type: 'message_end', message: msg })
      continue
    }

    if (m.role === 'assistant') {
      const dt = gap(m.timestamp)
      lastAsstTs = m.timestamp
      if (m.stopReason === 'aborted') aborted = true
      push(dt, {
        type: 'message_start',
        message: { role: 'assistant', content: [], stopReason: 'pending', timestamp: m.timestamp },
      })
      for (const [ci, c] of (m.content ?? []).entries()) {
        if (limited()) break
        if (c.type === 'thinking') {
          const realMs = thinkingMs.get(`${m.timestamp}:${ci}`) ?? 1000
          const playMs = clamp(realMs, 300, 5000)
          const parts = chunk(c.thinking, 28)
          const step = clamp(playMs / Math.max(parts.length, 1), 15, 120)
          push(0, { type: 'message_update', assistantMessageEvent: { type: 'thinking_start', contentIndex: ci } })
          for (const d of parts) {
            if (limited()) break
            push(step, {
              type: 'message_update',
              assistantMessageEvent: { type: 'thinking_delta', contentIndex: ci, delta: d },
            })
          }
          push(0, {
            type: 'message_update',
            assistantMessageEvent: { type: 'thinking_end', contentIndex: ci, content: c.thinking, durationMs: realMs },
          })
        } else if (c.type === 'text') {
          const parts = chunk(c.text, 14)
          push(0, { type: 'message_update', assistantMessageEvent: { type: 'text_start', contentIndex: ci } })
          for (const d of parts) {
            if (limited()) break
            push(18, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: ci, delta: d } })
          }
          push(0, { type: 'message_update', assistantMessageEvent: { type: 'text_end', contentIndex: ci, content: c.text } })
        } else if (c.type === 'toolCall') {
          const args = JSON.stringify(c.arguments)
          push(0, {
            type: 'message_update',
            assistantMessageEvent: { type: 'toolcall_start', contentIndex: ci, id: c.id, toolName: c.name },
          })
          for (const d of chunk(args, 20)) {
            if (limited()) break
            push(15, { type: 'message_update', assistantMessageEvent: { type: 'toolcall_delta', contentIndex: ci, delta: d } })
          }
          push(0, {
            type: 'message_update',
            assistantMessageEvent: { type: 'toolcall_end', contentIndex: ci, toolCall: c },
          })
        }
      }
      const final = {
        ...m,
        content: (m.content ?? []).map(c => (c.type === 'thinking' ? { ...c, thinkingSignature: undefined } : c)),
      }
      push(0, { type: 'message_end', message: final })
      if (limited()) break
      for (const c of m.content ?? []) {
        if (c.type === 'toolCall') {
          push(0, { type: 'tool_execution_start', toolCallId: c.id, toolName: c.name, args: c.arguments })
        }
      }
      continue
    }

    if (m.role === 'toolResult') {
      const dt = gap(m.timestamp)
      const durationMs = m.timestamp - (lastAsstTs ?? m.timestamp)
      push(dt, {
        type: 'tool_execution_end',
        toolCallId: m.toolCallId,
        toolName: m.toolName,
        result: { content: slimContent(m.content), details: m.details },
        isError: m.isError === true,
        durationMs,
      })
      push(0, {
        type: 'message_end',
        message: {
          role: 'toolResult',
          toolCallId: m.toolCallId,
          toolName: m.toolName,
          content: slimContent(m.content),
          details: m.details,
          isError: m.isError === true,
          timestamp: m.timestamp,
        },
      })
    }
  }

  const truncated = limited()
  push(300, { type: 'agent_end', willRetry: false, ...(aborted ? { aborted: true } : {}) })
  push(0, { type: 'agent_settled', aborted })

  const total = events.reduce((s, x) => s + x.dt, 0)
  return {
    id: cfg.id,
    label: cfg.label,
    note: cfg.note,
    truncated,
    source: { file: path.basename(cfg.file), lines: [cfg.from, cfg.to] },
    stats: { events: events.length, durationMs: total },
    events,
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const index = []
for (const cfg of config) {
  if (only.length > 0 && !only.includes(cfg.id)) continue
  const fixture = build(cfg)
  fs.writeFileSync(path.join(OUT_DIR, `${cfg.id}.json`), JSON.stringify(fixture), 'utf8')
  index.push({
    id: fixture.id,
    label: fixture.label,
    note: fixture.note,
    truncated: fixture.truncated,
    events: fixture.stats.events,
    durationMs: fixture.stats.durationMs,
    source: fixture.source,
  })
  console.log(
    `${cfg.id.padEnd(12)} ${String(fixture.stats.events).padStart(5)} events  ${String(Math.round(fixture.stats.durationMs / 1000)).padStart(4)}s  ${(fs.statSync(path.join(OUT_DIR, `${cfg.id}.json`)).size / 1024).toFixed(0)}KB${fixture.truncated ? '  (truncated)' : ''}`,
  )
}

fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf8')
