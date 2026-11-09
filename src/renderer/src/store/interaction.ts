/**
 * 交互切片：扩展 ui.* 请求的暂存、问卷答案按题号回填、通知的自动消失。
 *
 * 扩展在 rpc 模式下逐题 await，所以同一个工具调用里的请求必须严格按到达顺序回填；
 * 已认领成问卷的请求先挂起（等用户填完整张卡），未认领的直接进 ui 队列弹原生窗。
 * 适配器（interactions/）只管「答案翻译成什么字符串」，时序在这里。
 */
import type { AskAnswer, UiRequest } from '@shared/ipc'
import { multiReply, questionsOf, selectReply } from '../interactions'
import { engine, send, type Ask } from './state'

/** 一个工具调用里挂起的请求 */
interface UiSlot {
  name: string
  args: unknown
  /** 已到达的请求，按题号顺序 */
  reqs: UiRequest[]
  /** 每题的答案，提交后逐条回填 */
  answers?: AskAnswer[]
  /** 已回到第几题 */
  sent: number
}

const slots = new Map<string, UiSlot>()
/** 通知自动消失的句柄：统一留存，退订时清掉，免得定时器打到已卸载的 store 上 */
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** toolCallId → 工具名与完整入参：ui 请求到达时所属消息必已 end，参数必完整（ADR-0014） */
function findTool(callId: string): { name: string; args: unknown } | undefined {
  const { order, byId } = engine.get().msgs
  for (let i = order.length - 1; i >= 0; i--) {
    const m = byId[order[i]]
    if (m?.role !== 'assistant') continue
    for (const c of m.content) {
      if (c.type === 'toolCall' && c.id === callId) return { name: c.name ?? 'tool', args: c.arguments }
    }
  }
  return undefined
}

/** 登记一个请求；被问卷认领时返回 true（调用方负责等用户提交后再 flushSlot）。
 * toolStart 事件已删：槽位与问卷卡片都在第一个 ui 请求到达时按需建。 */
export function acceptRequest(req: UiRequest): boolean {
  const id = req.toolCallId
  if (!id) return false
  let slot = slots.get(id)
  if (!slot) {
    const tool = findTool(id)
    if (!tool) return false
    const questions = questionsOf(tool.args)
    if (questions.length === 0) return false
    slot = { name: tool.name, args: tool.args, reqs: [], sent: 0 }
    slots.set(id, slot)
    registerAsk(id, questions)
  }
  slot.reqs.push(req)
  return true
}

/** 把已提交的答案按题号顺序回填给挂起的 ui 请求 */
export function flushSlot(toolCallId: string): void {
  const slot = slots.get(toolCallId)
  if (!slot?.answers) return
  const questions = questionsOf(slot.args)
  while (slot.sent < slot.reqs.length && slot.sent < slot.answers.length) {
    const index = slot.sent
    const req = slot.reqs[index]
    const q = questions[index]
    const a = slot.answers[index]
    // 多选拼 "1,3; 自定义"；单选直接用请求里的选项行，自定义文本原样返回
    const value =
      q?.multiSelect === true ? multiReply(a, q.options.length) : selectReply(a, req.options ?? [])
    send({ type: 'uiReply', id: req.id, reply: { value } })
    slot.sent++
  }
}

export function pushToast(id: string, message: string, type: 'info' | 'warning' | 'error'): void {
  const prev = toastTimers.get(id)
  if (prev) clearTimeout(prev)
  engine.update((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
  toastTimers.set(
    id,
    setTimeout(() => {
      toastTimers.delete(id)
      engine.update((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3500)
  )
}

export function clearTimers(): void {
  for (const t of toastTimers.values()) clearTimeout(t)
  toastTimers.clear()
  slots.clear()
}

export function registerAsk(toolCallId: string, questions: Ask['questions']): void {
  engine.update((s) => ({ asks: [...s.asks, { id: `ask-${toolCallId}`, toolCallId, questions }] }))
}

export const answerAsk = (id: string, answers: AskAnswer[]): void => {
  const ask = engine.get().asks.find((a) => a.id === id)
  if (!ask) return
  const slot = slots.get(ask.toolCallId)
  if (slot) {
    slot.answers = answers
    flushSlot(ask.toolCallId)
  }
  engine.update((s) => ({ asks: s.asks.filter((a) => a.id !== id) }))
}

export const cancelAsk = (id: string): void => {
  const ask = engine.get().asks.find((a) => a.id === id)
  if (!ask) return
  const slot = slots.get(ask.toolCallId)
  // 取消：把已到但未回的请求全部标记为 cancelled，扩展会当作用户放弃
  for (const req of slot?.reqs.slice(slot.sent) ?? []) {
    send({ type: 'uiReply', id: req.id, reply: { cancelled: true } })
  }
  if (slot) slot.sent = slot.reqs.length
  engine.update((s) => ({ asks: s.asks.filter((a) => a.id !== id) }))
}

export const replyUi = (id: string, reply: { value?: string; confirmed?: boolean; cancelled?: boolean }): void => {
  send({ type: 'uiReply', id, reply })
  engine.update((s) => ({ ui: s.ui.filter((r) => r.id !== id) }))
}
