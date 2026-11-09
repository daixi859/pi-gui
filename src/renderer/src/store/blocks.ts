/**
 * 正文切片：宿主的消息增量落进 msgs（顺序 + 按 key 存），再派生成 Block（ADR-0014）。
 * 派生按消息引用 memo（timeline.ts），未变的消息产出同引用块，
 * 于是列表一次都不重渲染，只有正在变的那一行重渲染。
 */
import { keyOf, type MessageDelta } from '@shared/ipc'
import type { Block } from '@shared/blocks'
import type { EngineState } from './state'
import { engine } from './state'
import { deriveBlocks } from './timeline'

/**
 * 应用一批消息增量。
 * full：丢掉旧缓存整棵重建（切会话 / 打开历史），同时把 viewPath 认成这批消息的归属。
 * 增量：只覆盖变了的消息；order 缺省时沿用旧引用。
 */
export function applyMessages(delta: MessageDelta, path: string | null): void {
  const s = engine.get()
  // 增量只属于当前会话，切换途中旧会话的增量直接丢掉
  if (!delta.full && path !== s.viewPath) return

  let byId = s.msgs.byId
  let order = s.msgs.order
  if (delta.full) {
    byId = {}
    order = delta.order ?? []
  } else if (delta.order) {
    order = delta.order
  }
  if (delta.items.length || delta.full) {
    byId = { ...byId }
    for (const m of delta.items) byId[keyOf(m)] = m
  }

  const d = deriveBlocks(order, byId)
  const patch: Partial<EngineState> = {
    msgs: { order, byId },
    order: d.order,
    byId: d.byId,
    answerText: d.answerText,
    liveTurnId: d.liveTurnId
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
