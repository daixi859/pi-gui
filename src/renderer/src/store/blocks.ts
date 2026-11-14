/**
 * 正文切片：宿主的消息增量落进 msgs（顺序 + 按 key 存），再派生成 Block（ADR-0014）。
 * 派生按消息引用 memo（timeline.ts），未变的消息产出同引用块，
 * 于是列表一次都不重渲染，只有正在变的那一行重渲染。
 */
import { keyOf, type MessageDelta, type PiMessage } from '@shared/ipc'
import type { Block, Turn } from 'agent-design/blocks'
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

  // full 只换内容，不动 streaming：切会话时 enter() 已经清过了；这里是宿主重发快照
  // （新建会话时 activate 会 forceFull 一次空快照），紧接着的 status 才代表真实流式状态。
  // 曾经在这里置 false，导致发完第一条消息后宿主那份空 full 快照把它抹掉，
  // 正文只剩「这个会话还没有内容」，直到 agent_start 之后的 status(true) 才回来。
  const patch: Partial<EngineState> = {
    msgs: { order, byId },
    ...deriveAndStamp(order, byId, s.streaming, s.settledAt)
  }
  if (delta.full) {
    patch.viewPath = path
    patch.settledAt = null
  }
  engine.set(patch)
}

/**
 * 落定耗时用墙钟：pi 的消息 timestamp 是「消息创建」时刻（首包就定），
 * 正文可能再流好几秒，末条消息 ts − user ts 只有几十毫秒，
 * 总行会闪一句「已完成，用时 不到 1 秒」。settled 事件带来的 settledAt 才是真实结束时间。
 * 只补最后一回合且还没补过（endedAt ≥ settledAt 说明已补过或本来就晚），不碰历史回合。
 */
function stampSettled(turns: Turn[], settledAt: number | null): Turn[] {
  if (settledAt === null || turns.length === 0) return turns
  const last = turns[turns.length - 1]
  if (last.status !== 'settled' || (last.endedAt ?? 0) >= settledAt) return turns
  return [...turns.slice(0, -1), { ...last, endedAt: settledAt }]
}

/** 派生块并把落定墙钟补上：消息增量与流式状态变化共用这一条路 */
function deriveAndStamp(
  order: string[],
  byId: Record<string, PiMessage>,
  streaming: boolean,
  settledAt: number | null
): Pick<EngineState, 'turns' | 'byId' | 'answerText'> {
  const d = deriveBlocks(order, byId, streaming)
  return { turns: stampSettled(d.turns, settledAt), byId: d.byId, answerText: d.answerText }
}

/**
 * 流式状态变了要重派生：末段「只有 user、回应未到」算不算 live 由它决定
 * （不重派生就会先画出一个落定的回合头，再等首条消息到达才纠正）。
 */
export function applyStreaming(): void {
  const s = engine.get()
  engine.set(deriveAndStamp(s.msgs.order, s.msgs.byId, s.streaming, s.settledAt))
}

export function blocksOf(): Block[] {
  const { turns, byId } = engine.get()
  const out: Block[] = []
  for (const t of turns) {
    if (t.userId) {
      const u = byId[t.userId]
      if (u) out.push(u)
    }
    for (const id of t.blockIds) {
      const b = byId[id]
      if (b) out.push(b)
    }
  }
  return out
}
