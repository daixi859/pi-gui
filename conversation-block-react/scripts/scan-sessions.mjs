// 扫描 ~/.pi/agent/sessions 下的会话，找出有代表性的回合（用户消息 → 下一条用户消息之前）。
// 用法：node scripts/scan-sessions.mjs [maxFiles]
// 输出每回合的统计，按场景打分排序；挑选结果写进 scripts/fixtures.config.json。
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = path.join(os.homedir(), '.pi', 'agent', 'sessions')
const MAX_FILES = Number(process.argv[2] ?? 400)

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.name.endsWith('.jsonl')) yield full
  }
}

const files = [...walk(ROOT)]
  .map(f => ({ f, size: fs.statSync(f).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, MAX_FILES)

const results = []
for (const { f, size } of files) {
  let lines
  try {
    lines = fs.readFileSync(f, 'utf8').split('\n')
  } catch {
    continue
  }
  const entries = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i]) continue
    try {
      entries.push({ line: i + 1, entry: JSON.parse(lines[i]) })
    } catch {
      /* 半行截断忽略 */
    }
  }
  let turn = null
  const flush = () => {
    if (turn === null) return
    const delta = { ...turn }
    delete delta.blocks
    results.push({ file: f, size, ...delta })
    turn = null
  }
  for (const { line, entry } of entries) {
    if (entry.type !== 'message') continue
    const m = entry.message
    if (m.role === 'user') {
      flush()
      turn = {
        from: line,
        to: line,
        turns: 0,
        text: String(m.content?.[0]?.text ?? '').slice(0, 80),
        tools: 0,
        errors: 0,
        codemode: 0,
        thinking: 0,
        maxOutput: 0,
        edit: 0,
        aborted: false,
      }
      continue
    }
    if (turn === null) continue
    turn.to = line
    if (m.role === 'assistant') {
      for (const c of m.content ?? []) {
        if (c.type === 'toolCall') {
          turn.tools += 1
          if (c.name === 'codemode') turn.codemode += 1
          if (c.name === 'edit' || c.name === 'write') turn.edit += 1
        }
        if (c.type === 'thinking') turn.thinking += 1
      }
      if (m.stopReason === 'aborted') turn.aborted = true
    }
    if (m.role === 'toolResult') {
      if (m.isError) turn.errors += 1
      const len = (m.content ?? []).reduce((s, c) => s + (typeof c.text === 'string' ? c.text.length : 0), 0)
      turn.maxOutput = Math.max(turn.maxOutput, len)
    }
  }
  flush()
  // 中断标记：custom 条目的 agent_settled? 会话末尾 stopReason 已是 aborted
  for (const r of results) if (r.file === f && !r.aborted) {
    // 会话最后一条 assistant 的 stopReason 为 aborted 视为中断回合
    const last = entries.filter(e => e.entry.type === 'message' && e.entry.message.role === 'assistant').at(-1)
    if (last?.entry.message.stopReason === 'aborted' && last.line >= r.from && last.line <= r.to) r.aborted = true
  }
}

const score = r =>
  r.tools * 2 + r.errors * 6 + r.codemode * 5 + r.thinking + (r.maxOutput > 20000 ? 6 : 0) + (r.aborted ? 20 : 0) + (r.edit > 0 ? 2 : 0)

results.sort((a, b) => score(b) - score(a))
console.log(`scanned ${files.length} sessions, ${results.length} turns\n`)
for (const r of results.slice(0, 40)) {
  console.log(
    `${String(score(r)).padStart(3)} | ${path.basename(r.file).slice(0, 44)} L${r.from}-${r.to} | tools=${r.tools} err=${r.errors} codemode=${r.codemode} think=${r.thinking} maxOut=${r.maxOutput} edit=${r.edit} aborted=${r.aborted}\n      ${r.text.replace(/\s+/g, ' ')}`,
  )
}
