// 列出单个会话里每个回合（user → 下一条 user 之前）的统计，便于挑夹具区间。
// 用法：node scripts/list-turns.mjs <session.jsonl> [maxTurns]
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2]
const max = Number(process.argv[3] ?? 80)
const lines = fs.readFileSync(file, 'utf8').split('\n')
const entries = []
for (let i = 0; i < lines.length; i += 1) {
  if (!lines[i]) continue
  try {
    entries.push({ line: i + 1, entry: JSON.parse(lines[i]) })
  } catch {
    /* ignore */
  }
}

const turns = []
let turn = null
const flush = () => {
  if (turn !== null) turns.push(turn)
  turn = null
}
for (const { line, entry } of entries) {
  if (entry.type !== 'message') continue
  const m = entry.message
  if (m.role === 'user') {
    flush()
    turn = { from: line, to: line, tools: 0, errors: 0, codemode: 0, thinking: 0, maxOut: 0, stop: '', text: String(m.content?.[0]?.text ?? '').slice(0, 60).replace(/\s+/g, ' ') }
    continue
  }
  if (turn === null) continue
  turn.to = line
  if (m.role === 'assistant') {
    for (const c of m.content ?? []) {
      if (c.type === 'toolCall') {
        turn.tools += 1
        if (c.name === 'codemode') turn.codemode += 1
      }
      if (c.type === 'thinking') turn.thinking += 1
    }
    turn.stop = m.stopReason ?? turn.stop
  }
  if (m.role === 'toolResult') {
    if (m.isError) turn.errors += 1
    const len = (m.content ?? []).reduce((s, c) => s + (typeof c.text === 'string' ? c.text.length : 0), 0)
    turn.maxOut = Math.max(turn.maxOut, len)
  }
}
flush()

console.log(`${path.basename(file)} — ${turns.length} turns`)
for (const t of turns.slice(0, max)) {
  console.log(`L${t.from}-${t.to} lines=${t.to - t.from + 1} tools=${t.tools} err=${t.errors} codemode=${t.codemode} think=${t.thinking} maxOut=${t.maxOut} stop=${t.stop}\n   ${t.text}`)
}
