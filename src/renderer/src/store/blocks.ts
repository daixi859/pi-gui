/**
 * 正文切片：把宿主的 BlockDelta 落成「顺序 + 按 id 存的块」。
 *
 * 为什么不用一个 Block 数组：增量到达时只改 byId 里那一个键，顺序没变就还是同一个数组，
 * 于是列表一次都不重渲染，只有那个块对应的行重渲染。turn 的子块同理（applyTurn）。
 * 见 docs/adr/0013。
 */
import type { BlockDelta, TurnDelta } from '@shared/ipc'
import type { Block } from '@shared/blocks'
import { engine } from './state'

/** 最后一条顶层回答的文本：turn 之外的 assistant 就是答案（宿主 splitAnswer 的约定） */
export function lastAnswer(order: string[], byId: Record<string, Block>): string {
  for (let i = order.length - 1; i >= 0; i--) {
    const b = byId[order[i]]
    if (b?.kind === 'assistant') return b.text
  }
  return ''
}

/**
 * 最后一个回合的 id：只有它在流式时算「活着」，折叠默认展开也看它。
 * 正常结构是 […, turn, answer]，从尾部往前数两步就命中；历史里没有回合时退化为 null。
 */
function lastTurn(order: string[], byId: Record<string, Block>): string | null {
  for (let i = order.length - 1; i >= 0; i--) {
    const b = byId[order[i]]
    if (b?.kind === 'turn') return b.id
  }
  return null
}

/** 折叠行的子块增量：按 id 覆盖、缺的新增；顺序变了以 order 为准 */
function applyTurn(prev: Block, delta: TurnDelta): Block {
  if (prev.kind !== 'turn') return prev
  const old = new Map(prev.children.map((c) => [c.id, c]))
  const changed = new Map(delta.items.map((b) => [b.id, b]))
  let children: Block[]
  if (delta.order) {
    children = delta.order.map((id) => changed.get(id) ?? old.get(id)).filter((b): b is Block => !!b)
  } else {
    children = prev.children.map((c) => changed.get(c.id) ?? c)
    for (const b of delta.items) if (!old.has(b.id)) children.push(b)
  }
  return { ...prev, durationMs: delta.durationMs, aborted: delta.aborted, children }
}

/**
 * 应用一批增量。
 * full：丢掉旧缓存整棵重建（切会话 / 打开历史），同时把 viewPath 认成这批块的归属。
 * 增量：只覆盖变了的块；order 缺省时沿用旧引用，列表不重渲染。
 */
export function applyBlocks(delta: BlockDelta, path: string | null): void {
  const s = engine.get()
  // 增量只属于当前会话，切换途中旧会话的增量直接丢掉
  if (!delta.full && path !== s.viewPath) return

  let byId = s.byId
  let order = s.order
  const touched = delta.items.length > 0 || (delta.turns?.length ?? 0) > 0

  if (delta.full) {
    byId = {}
    order = delta.order ?? []
    for (const b of delta.items) byId[b.id] = b
  } else {
    if (delta.order) order = delta.order
    if (touched) {
      byId = { ...byId }
      for (const b of delta.items) byId[b.id] = b
      for (const t of delta.turns ?? []) {
        const prev = byId[t.id]
        if (prev) byId[t.id] = applyTurn(prev, t)
      }
    }
  }

  const patch: Parameters<typeof engine.set>[0] = { byId, order }
  if (touched || delta.full) {
    patch.answerText = lastAnswer(order, byId)
    // 尾部是 […, turn, answer]，从后往前数很快就命中
    patch.liveTurnId = lastTurn(order, byId)
  }
  if (delta.full) {
    patch.viewPath = path
    patch.streaming = false
    patch.settledAt = null
  }
  engine.set(patch)
}

/** 导出 / 复制用：按顺序拼出完整块数组。只在用户点按钮时调用，不进渲染路径 */
export function blocksOf(): Block[] {
  const { order, byId } = engine.get()
  const out: Block[] = []
  for (const id of order) {
    const b = byId[id]
    if (b) out.push(b)
  }
  return out
}
