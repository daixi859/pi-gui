// 把 pi 历史会话 JSONL 转成 web-demo 的会话结构（消息直通，工具结果截断以控制体积）
import fs from 'node:fs'
import path from 'node:path'

export const DEFAULT_RESULT_LIMIT = 900

/** 折叠空白，按字符（而不是 UTF-16 码元）截断 */
export function clipText(text, limit) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(flat)
  return chars.length > limit ? `${chars.slice(0, limit).join('')}…` : flat
}

/**
 * 输出 pi 形状的 AgentMessage（ADR-0014）：content 数组直通，不预烘焙块。
 * 思考耗时是演示元数据，单独放 session.thinkingDurations，不进消息本体。
 *
 * @param {string} src jsonl 文件路径
 * @param {{ resultLimit?: number }} options
 */
export function convertSession(src, { resultLimit = DEFAULT_RESULT_LIMIT } = {}) {
  const records = fs
    .readFileSync(src, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))

  const header = records.find((r) => r.type === 'session')
  const modelChanges = records.filter((r) => r.type === 'model_change')
  const latestModel = modelChanges[modelChanges.length - 1]

  // compact-thinking-duration 按 (消息时间戳, 内容块下标) 记录思考耗时
  const thinkingDurations = {}
  for (const r of records) {
    if (r.type === 'custom' && r.customType === 'compact-thinking-duration') {
      const key = String(r.data.messageTimestamp)
      ;(thinkingDurations[key] ??= {})[r.data.contentIndex] = r.data.durationMs
    }
  }

  const clip = (s) => {
    const text = String(s ?? '')
    if (text.length <= resultLimit) return text
    return `${text.slice(0, resultLimit)}\n…[已截断 ${text.length - resultLimit} 字符]`
  }

  const messages = []
  for (const r of records) {
    if (r.type !== 'message' || !r.message) continue
    const m = r.message
    if (m.role === 'user') {
      if (!Array.isArray(m.content)) continue
      const content = m.content
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => ({ type: 'text', text: b.text }))
      if (content.length === 0) continue
      messages.push({ role: 'user', id: r.id, timestamp: m.timestamp, content })
    } else if (m.role === 'assistant') {
      if (!Array.isArray(m.content)) continue
      messages.push({
        role: 'assistant',
        id: r.id,
        timestamp: m.timestamp,
        model: m.model,
        stopReason: m.stopReason,
        content: m.content
          .filter((b) => b.type === 'thinking' || b.type === 'text' || b.type === 'toolCall')
          .map((b) => {
            if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking ?? '' }
            if (b.type === 'text') return { type: 'text', text: b.text ?? '' }
            return { type: 'toolCall', id: b.id, name: b.name, arguments: b.arguments ?? {} }
          })
      })
    } else if (m.role === 'toolResult') {
      const text = Array.isArray(m.content)
        ? m.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
        : ''
      messages.push({
        role: 'toolResult',
        id: r.id,
        timestamp: m.timestamp,
        toolCallId: m.toolCallId,
        toolName: m.toolName,
        isError: m.isError,
        durationMs: m.durationMs ?? null,
        content: [{ type: 'text', text: clip(text) }]
      })
    }
  }

  const firstUser = messages.find((m) => m.role === 'user')
  const rawTitle = (firstUser?.content[0]?.text ?? '')
    .split('\n')[0]
    .replace(/[A-Za-z]:\\[^\s，。；、]+/g, ' ')
    .replace(/[：:，,。；;\s]+$/g, '')
    .trim()
  const title = clipText(rawTitle, 28) || '未命名会话'
  const timestamps = messages.map((m) => m.timestamp).filter((t) => typeof t === 'number')
  const updatedAt = timestamps.length ? Math.max(...timestamps) : fs.statSync(src).mtimeMs
  const model = latestModel ? `${latestModel.provider}/${latestModel.modelId}` : messages.find((m) => m.role === 'assistant')?.model

  return {
    source: path.basename(src),
    sessionId: header?.id ?? path.basename(src, '.jsonl'),
    title,
    cwd: header?.cwd ?? '',
    model: model ?? '',
    updatedAt,
    messageCount: messages.length,
    turnCount: messages.filter((m) => m.role === 'user').length,
    bytes: fs.statSync(src).size,
    pinned: false,
    ...(Object.keys(thinkingDurations).length > 0 ? { thinkingDurations } : {}),
    messages
  }
}
