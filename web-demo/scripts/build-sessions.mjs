// 扫描 pi 历史会话目录，把最近的若干个会话转成 web-demo 的 mock 数据。
// 用法：node web-demo/scripts/build-sessions.mjs [会话目录]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertSession } from './lib/convert.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const sessionsRoot = path.join(os.homedir(), '.pi/agent/sessions')
const preferred = path.join(sessionsRoot, '--C--Users-DELL--')
const dir = process.argv[2] ?? (fs.existsSync(preferred) ? preferred : sessionsRoot)
const out = path.join(here, '../src/mock/sessions.json')
const MAX_SESSIONS = 8

function walk(folder) {
  const found = []
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) found.push(...walk(full))
    else if (entry.name.endsWith('.jsonl')) found.push(full)
  }
  return found
}

if (!fs.existsSync(dir)) {
  console.error(`sessions directory not found: ${dir}`)
  process.exit(1)
}

const files = walk(dir)
  .map((file) => ({ file, mtime: fs.statSync(file).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, MAX_SESSIONS)

const sessions = []
for (const { file } of files) {
  try {
    const session = convertSession(file)
    if (session.messages.length > 0) sessions.push(session)
  } catch (err) {
    console.warn(`skip ${path.basename(file)}: ${err.message}`)
  }
}

// 固定两个最近的会话，方便演示「固定 / 最近」分组
sessions.sort((a, b) => b.updatedAt - a.updatedAt)
sessions.slice(0, 2).forEach((s) => {
  s.pinned = true
})

const catalog = {
  source: '本机 pi 历史会话',
  generatedAt: Date.now(),
  sessions
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(catalog))
console.log(
  `wrote ${out}: ${sessions.length} sessions, ${(fs.statSync(out).size / 1024).toFixed(1)} KB`
)
