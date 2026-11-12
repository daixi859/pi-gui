/**
 * pi 事件机制的 demo 重放（对齐 pi-agent-core 的 AgentEvent 与 pi-ai 的 AssistantMessageEvent）：
 * 一轮对话在 pi 里是这样产生的——
 *   turn_start → message_start(partial) → thinking/text/toolcall 增量帧（每次带全量 partial 消息）
 *   → message_end(完整消息) → tool_execution_start/end(工具结果以 toolResult 消息进入) → turn_end
 * 重放就是把一轮的最终消息反推回这条事件序列，再逐帧回放。
 * 渲染层拿到的始终是消息（不是事件），块由 blocks.ts 现派生——和主程序同一条链路。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssistantContent, AssistantMessage, SessionMessage, ToolResultMessage, Turn } from './types'

/** pi-ai AssistantMessageEvent 的 demo 子集：内容项级增量 */
export type TurnDelta =
  | { type: 'thinking_start' | 'thinking_delta' | 'thinking_end'; contentIndex: number }
  | { type: 'text_start' | 'text_delta' | 'text_end'; contentIndex: number }
  | { type: 'toolcall_start' | 'toolcall_delta' | 'toolcall_end'; contentIndex: number }

export type TurnEvent =
  | { type: 'turn_start' }
  | { type: 'message_start'; message: AssistantMessage }
  | { type: 'message_update'; message: AssistantMessage; delta: TurnDelta }
  | { type: 'message_end'; message: AssistantMessage }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string }
  | { type: 'tool_execution_end'; toolCallId: string; toolName: string; result: ToolResultMessage }
  | { type: 'turn_end' }

interface Frame {
  event: TurnEvent
  waitMs: number
}

/** 重放状态：只有消息 + 思考走表，块全部派生 */
export interface ReplayState {
  items: SessionMessage[]
  done: boolean
  /** 流式思考已进行的毫秒数（UI 时钟）；不在思考时为 null */
  thinkingMs: number | null
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** partial 消息：流式中 stopReason 恒为 pending，内容项只有已到的部分 */
const partial = (final: AssistantMessage, content: AssistantContent[]): AssistantMessage => ({
  ...final,
  stopReason: 'pending',
  content
})

/** 把一轮的最终消息反推回 pi 事件脚本：思考/正文按字符切片，工具参数按 partialArgs 渐进拼接 */
function buildScript(turn: Turn): Frame[] {
  const frames: Frame[] = []
  const results = new Map<string, ToolResultMessage>()
  for (const m of turn.items) if (m.role === 'toolResult') results.set(m.toolCallId, m)

  frames.push({ event: { type: 'turn_start' }, waitMs: 0 })

  for (const item of turn.items) {
    if (item.role !== 'assistant') continue
    const final = item
    frames.push({ event: { type: 'message_start', message: partial(final, []) }, waitMs: 80 })

    // pi 的 partial 消息按 contentIndex 累积：已完成的内容项保持原样，流式帧只长在当前项上
    const done: AssistantContent[] = []

    final.content.forEach((c, i) => {
      if (c.type === 'thinking') {
        const text = c.thinking
        // 真实思考耗时来自演示元数据（compact-thinking-duration）；步数按时长铺开，重放才贴得住真实节奏
        const total = clamp(turn.durations?.[String(final.timestamp)]?.[i] ?? 900, 500, 1800)
        const steps = Math.max(1, Math.round(total / 40))
        const chunk = Math.max(1, Math.ceil(text.length / steps))
        const stepMs = total / steps
        frames.push({
          event: {
            type: 'message_update',
            message: partial(final, [...done, { type: 'thinking', thinking: '' }]),
            delta: { type: 'thinking_start', contentIndex: i }
          },
          waitMs: 0
        })
        for (let s = 1; s <= steps; s++) {
          const len = Math.min(s * chunk, text.length)
          frames.push({
            event: {
              type: 'message_update',
              message: partial(final, [...done, { type: 'thinking', thinking: text.slice(0, len) }]),
              delta: { type: 'thinking_delta', contentIndex: i }
            },
            waitMs: stepMs
          })
        }
        frames.push({
          event: {
            type: 'message_update',
            message: partial(final, [...done, { type: 'thinking', thinking: text }]),
            delta: { type: 'thinking_end', contentIndex: i }
          },
          waitMs: 100
        })
        done.push({ type: 'thinking', thinking: text })
      } else if (c.type === 'text') {
        const text = c.text
        const steps = Math.max(1, Math.ceil(text.length / 6))
        frames.push({
          event: {
            type: 'message_update',
            message: partial(final, [...done, { type: 'text', text: '' }]),
            delta: { type: 'text_start', contentIndex: i }
          },
          waitMs: 0
        })
        for (let s = 1; s <= steps; s++) {
          const len = Math.min(s * 6, text.length)
          frames.push({
            event: {
              type: 'message_update',
              message: partial(final, [...done, { type: 'text', text: text.slice(0, len) }]),
              delta: { type: 'text_delta', contentIndex: i }
            },
            waitMs: 16
          })
        }
        frames.push({
          event: {
            type: 'message_update',
            message: partial(final, [...done, { type: 'text', text }]),
            delta: { type: 'text_end', contentIndex: i }
          },
          waitMs: 60
        })
        done.push({ type: 'text', text })
      } else {
        // 工具调用：pi 的中间帧 arguments 为空对象、参数走 partialArgs 半截文本，message_end 才完整
        const argsJson = JSON.stringify(c.arguments ?? {})
        frames.push({
          event: {
            type: 'message_update',
            message: partial(final, [
              ...done,
              { type: 'toolCall', id: c.id, name: c.name, arguments: {}, partialArgs: '' }
            ]),
            delta: { type: 'toolcall_start', contentIndex: i }
          },
          waitMs: 40
        })
        for (let len = 12; len < argsJson.length; len += 20) {
          frames.push({
            event: {
              type: 'message_update',
              message: partial(final, [
                ...done,
                { type: 'toolCall', id: c.id, name: c.name, arguments: {}, partialArgs: argsJson.slice(0, len) }
              ]),
              delta: { type: 'toolcall_delta', contentIndex: i }
            },
            waitMs: 12
          })
        }
        frames.push({
          event: {
            type: 'message_update',
            message: partial(final, [...done, { type: 'toolCall', id: c.id, name: c.name, arguments: c.arguments ?? {} }]),
            delta: { type: 'toolcall_end', contentIndex: i }
          },
          waitMs: 0
        })
        done.push({ type: 'toolCall', id: c.id, name: c.name, arguments: c.arguments ?? {} })
      }
    })

    frames.push({ event: { type: 'message_end', message: final }, waitMs: 150 })

    for (const c of final.content) {
      if (c.type !== 'toolCall') continue
      const r = results.get(c.id)
      if (!r) continue
      frames.push({
        event: { type: 'tool_execution_start', toolCallId: c.id, toolName: c.name },
        waitMs: 320
      })
      frames.push({
        event: { type: 'tool_execution_end', toolCallId: c.id, toolName: c.name, result: r },
        waitMs: 240
      })
    }
  }

  frames.push({ event: { type: 'turn_end' }, waitMs: 0 })
  return frames
}

/** 事件帧 → 状态：渲染层只看到消息到达，toolResult 也一样（ADR-0014：配对在派生层做） */
function applyEvent(state: ReplayState, event: TurnEvent, waitMs: number): ReplayState {
  switch (event.type) {
    case 'message_start':
      return { ...state, items: [...state.items, event.message], thinkingMs: null }
    case 'message_update': {
      const index = state.items.findIndex((m) => m.id === event.message.id)
      if (index === -1) return state
      const items = state.items.slice()
      items[index] = event.message
      const last = event.message.content[event.message.content.length - 1]
      // 思考走表按真实帧间隔推进，交给 ThinkingAccordion 的 elapsedMs
      const thinking = last?.type === 'thinking' ? (state.thinkingMs ?? 0) + waitMs : null
      return { ...state, items, thinkingMs: thinking === null ? null : thinking }
    }
    case 'message_end': {
      const index = state.items.findIndex((m) => m.id === event.message.id)
      if (index === -1) return state
      const items = state.items.slice()
      items[index] = event.message
      return { ...state, items, thinkingMs: null }
    }
    case 'tool_execution_end':
      return { ...state, items: [...state.items, event.result] }
    case 'turn_end':
      return { ...state, done: true }
    default:
      return state
  }
}

const EMPTY: ReplayState = { items: [], done: false, thinkingMs: null }

/** 逐事件回放一轮对话；每次 play 都会使前一次运行失效，stop 立即回到静态全量 */
export function useTurnReplay(turn: Turn, autoPlay = false) {
  const [state, setState] = useState<ReplayState | null>(autoPlay ? EMPTY : null)
  const runId = useRef(0)
  const started = useRef(false)
  const playRef = useRef<() => Promise<void>>(async () => {})

  const stop = useCallback(() => {
    runId.current++
    setState(null)
  }, [])

  const play = useCallback(async () => {
    const id = ++runId.current
    const alive = () => runId.current === id
    setState(EMPTY)

    for (const frame of buildScript(turn)) {
      if (frame.waitMs > 0) {
        await sleep(frame.waitMs)
        if (!alive()) return
      }
      setState((s) => applyEvent(s ?? EMPTY, frame.event, frame.waitMs))
    }
  }, [turn])

  playRef.current = play

  // 新发送的一轮自动开始回放；初始为空态，避免整段内容闪一下再收起
  useEffect(() => {
    if (!autoPlay || started.current) return
    started.current = true
    void playRef.current()
    return () => {
      started.current = false
    }
  }, [autoPlay])

  // 卸载时取消未完成的重放，避免向已卸载组件写状态
  useEffect(() => stop, [stop])

  return { state, playing: !!state && !state.done, play, stop }
}
