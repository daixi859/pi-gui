// 归约校验：不渲染 DOM，只把夹具喂给 reducer，打印每份夹具的段/块统计与关键状态。
import fs from 'node:fs'
import path from 'node:path'
import { createInitialState, reduce } from '../src/reducer/reduce.ts'

const dir = path.join(import.meta.dirname, '..', 'public', 'fixtures')
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json')
let failed = 0
for (const file of files) {
  const fx = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  let state = createInitialState()
  let clock = 0
  for (const { dt, ev } of fx.events) {
    clock += dt
    state = reduce(state, ev, clock)
  }
  const blocks = Object.values(state.blocks)
  const byKind = k => blocks.filter(b => b.kind === k).length
  const tools = blocks.filter(b => b.kind === 'tool')
  const states = tools.reduce((m, b) => ({ ...m, [b.state]: (m[b.state] ?? 0) + 1 }), {})
  const streamingLeft = blocks.filter(b => (b.kind === 'thinking' && b.streaming) || (b.kind === 'assistant' && b.status === 'running')).length
  const liveTurns = state.turns.filter(t => t.status === 'live').length
  const thinking = blocks.filter(b => b.kind === 'thinking').reduce((sum, b) => sum + (b.durationMs ?? 0), 0)
  const subCalls = tools.reduce((s, b) => s + (b.subCalls?.length ?? 0), 0)
  const errs = []
  if (liveTurns > 0) errs.push('live turn 残留')
  if (streamingLeft > 0) errs.push(`流式块残留 ${streamingLeft}`)
  if (tools.some(t => t.state === 'running' || t.state === 'preparing')) errs.push('工具未落定')
  if (errs.length) failed += 1
  console.log(
    `${fx.id.padEnd(12)} turns=${state.turns.length} user=${byKind('user')} think=${byKind('thinking')} tool=${tools.length} text=${byKind('assistant')} sys=${byKind('system')} | ${JSON.stringify(states)} subCalls=${subCalls} thinkMs=${Math.round(thinking / 1000)}s | ${errs.length ? 'FAIL ' + errs.join('; ') : 'ok'}`,
  )
}
console.log(failed === 0 ? '\nall fixtures settled cleanly' : `\n${failed} fixture(s) failed`)
process.exit(failed === 0 ? 0 : 1)
