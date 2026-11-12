/**
 * 消息 → 块的派生（demo 版 store/timeline.ts，对齐 ADR-0014/0015）：
 * 重放状态和历史全量是同一种东西——都只有消息，块在这里现算。
 * tool 状态 = toolCall ↔ toolResult 按 toolCallId 配对；流式 = stopReason === 'pending'。
 */
import type { AssistantMessage, SessionMessage, ThinkingDurations, ToolResultMessage, Turn } from './types'

export interface ThinkingBlock {
  kind: 'thinking'
  id: string
  /** 所属消息的时间戳：Pi 头部等按消息分组的信息从这里来 */
  ts: number
  text: string
  /** 落定后的真实耗时（演示元数据）；流式中为 null，走表归 UI 时钟 */
  durationMs: number | null
  streaming: boolean
}

export interface TextBlock {
  kind: 'text'
  id: string
  ts: number
  text: string
  streaming: boolean
}

export interface ToolBlock {
  kind: 'tool'
  id: string
  ts: number
  name: string
  args: Record<string, unknown>
  /** 流式中参数没解析完，只有 partialArgs */
  partialArgs?: string
  state: 'running' | 'done' | 'error'
  result?: ToolResultMessage
}

export type TurnBlock = ThinkingBlock | TextBlock | ToolBlock

export interface DerivedTurn {
  blocks: TurnBlock[]
  /** 轮内是否还有流式或未配对的工具（live 段） */
  live: boolean
}

const isAssistant = (m: SessionMessage): m is AssistantMessage => m.role === 'assistant'
const isResult = (m: SessionMessage): m is ToolResultMessage => m.role === 'toolResult'

/** 派生一轮的块：user 不在内（气泡单独渲染），只派生 user 之后的平铺消息 */
export function deriveTurn(turn: Pick<Turn, 'items' | 'durations'>): DerivedTurn {
  const results = new Map<string, ToolResultMessage>()
  for (const m of turn.items) if (isResult(m)) results.set(m.toolCallId, m)

  const blocks: TurnBlock[] = []
  let live = false

  for (const m of turn.items) {
    if (!isAssistant(m)) continue
    const streaming = m.stopReason === 'pending'
    const durations = turn.durations?.[String(m.timestamp)]
    const last = m.content.length - 1

    m.content.forEach((c, i) => {
      if (c.type === 'thinking') {
        // 流式尾巴只有最后一项是「正在写的那段」
        blocks.push({
          kind: 'thinking',
          id: `th-${m.timestamp}-${i}`,
          ts: m.timestamp,
          text: c.thinking,
          durationMs: streaming ? null : (durations?.[i] ?? null),
          streaming: streaming && i === last
        })
      } else if (c.type === 'text') {
        blocks.push({ kind: 'text', id: `t-${m.timestamp}-${i}`, ts: m.timestamp, text: c.text, streaming })
      } else if (c.type === 'toolCall') {
        const r = results.get(c.id)
        if (!r) live = true
        blocks.push({
          kind: 'tool',
          id: `tc-${c.id}`,
          ts: m.timestamp,
          name: c.name ?? 'tool',
          // 流式中间帧参数为空对象 + partialArgs（ADR-0014），message_end 后才有完整参数
          args: c.arguments ?? {},
          ...(c.partialArgs !== undefined ? { partialArgs: c.partialArgs } : {}),
          state: r ? (r.isError ? 'error' : 'done') : 'running',
          ...(r ? { result: r } : {})
        })
      }
    })
    if (streaming) live = true
  }

  return { blocks, live }
}
