/**
 * 会话块模型：pi JSON 事件流（`pi --mode json` / session 回放）归约后的渲染输入。
 * 形状刻意贴近深寻 harness 的 `ToolRowState` / `AssistantChatData`，便于将来把
 * blocks/ 目录整体搬回宿主。
 */

/** 工具行状态，取名与 deepseek harness 的 `ToolRowState` 一致（ok 而非 completed）。 */
export type ToolState = 'preparing' | 'running' | 'ok' | 'error' | 'stopped'

/** 助手文本块：一条 assistant 消息里的一段 text。 */
export type AssistantStatus = 'running' | 'settled' | 'interrupted'

export interface UserBlock {
  readonly kind: 'user'
  readonly id: string
  readonly text: string
  readonly images: readonly string[]
  readonly ts: number
}

export interface AssistantBlock {
  readonly kind: 'assistant'
  readonly id: string
  readonly text: string
  readonly status: AssistantStatus
  /** 是否是整条 assistant 消息的最终文本（stop 结束），用于区分中间话与答案。 */
  readonly final: boolean
  readonly ts: number
}

export interface ThinkingBlock {
  readonly kind: 'thinking'
  readonly id: string
  readonly text: string
  readonly streaming: boolean
  /** 真实思考耗时；流式期间为 undefined。 */
  readonly durationMs?: number
  readonly ts: number
}

export interface ToolSubCall {
  readonly id: string
  readonly name: string
  readonly args: unknown
  readonly state: ToolState
  readonly durationMs?: number
}

export interface ToolBlock {
  readonly kind: 'tool'
  readonly id: string
  readonly callId: string
  readonly name: string
  /** 原始 JSON 参数串；`toolcall_delta` 逐段追加，结束前可能不完整。 */
  readonly argsRaw: string
  /** 解析后的参数；`toolcall_end` 之后才可用。 */
  readonly args?: unknown
  readonly state: ToolState
  /** 结果纯文本（toolResult 的 text 块拼接）。 */
  readonly output?: string
  readonly details?: unknown
  /** 结构化错误码，`interrupted` 用于区分「被中断」和「工具报错」。 */
  readonly error?: { readonly code: string; readonly message: string }
  readonly durationMs?: number
  /** codemode 等工具的嵌套调用。 */
  readonly subCalls?: readonly ToolSubCall[]
  readonly ts: number
}

export interface SystemBlock {
  readonly kind: 'system'
  readonly id: string
  readonly tone: 'info' | 'warn' | 'error'
  readonly text: string
  readonly ts: number
}

export type Block = UserBlock | AssistantBlock | ThinkingBlock | ToolBlock | SystemBlock

export interface TurnActivity {
  readonly kind: 'thinking' | 'tool' | 'replying'
  readonly detail?: string
}

export type TurnStatus = 'live' | 'settled' | 'aborted'

export interface Turn {
  readonly key: string
  /** 该回合的开场 user 块；无 user 的续写回合为 null。 */
  readonly userId: string | null
  readonly blockIds: readonly string[]
  readonly status: TurnStatus
  readonly startedAt: number
  readonly endedAt?: number
  readonly activity?: TurnActivity
  readonly toolCount: number
  readonly errorCount: number
}

export interface ConversationState {
  readonly turns: readonly Turn[]
  readonly blocks: Readonly<Record<string, Block>>
  /** 单调递增的块 id 序号，保证同一事件流重放时 id 稳定。 */
  readonly seq: number
  /** callId → tool block id，处理执行期事件时用。 */
  readonly callIndex: Readonly<Record<string, string>>
  /** 当前 streaming 的 assistant 消息（message_start → message_end 之间）。 */
  readonly liveMessage: { readonly ts: number } | null
  /** 当前 live 回合的 key。 */
  readonly activeTurn: string | null
  /** `${消息时间戳}:${contentIndex}` → toolCallId，toolcall_delta 只有 contentIndex。 */
  readonly liveTools: Readonly<Record<string, string>>
  /** 最近一条消息的时间戳，回合落定时用它算耗时（不依赖墙钟）。 */
}

/** 回放夹具里的事件：`dt` 是距上一条事件的毫秒数（真实 pi 流里没有，回放用）。 */
export interface FixtureEvent {
  readonly dt: number
  readonly ev: PiEvent
}

/** pi 的 JSON 事件，只声明本应用消费的字段。 */
export type PiEvent =
  | { readonly type: 'agent_start' }
  | { readonly type: 'turn_start' }
  | { readonly type: 'turn_end' }
  | { readonly type: 'agent_end'; readonly willRetry?: boolean }
  | { readonly type: 'agent_settled'; readonly aborted?: boolean }
  | { readonly type: 'message_start'; readonly message: PiMessage }
  | { readonly type: 'message_end'; readonly message: PiMessage }
  | { readonly type: 'message_update'; readonly assistantMessageEvent: AssistantMessageEvent }
  | {
      readonly type: 'tool_execution_start'
      readonly toolCallId: string
      readonly toolName: string
      readonly args?: unknown
    }
  | {
      readonly type: 'tool_execution_update'
      readonly toolCallId: string
      readonly partialResult?: { readonly content?: readonly PiContent[] }
    }
  | {
      readonly type: 'tool_execution_end'
      readonly toolCallId: string
      readonly toolName?: string
      readonly result?: { readonly content?: readonly PiContent[]; readonly details?: unknown }
      readonly isError?: boolean
      readonly durationMs?: number
    }

export interface PiMessage {
  readonly role: string
  readonly timestamp?: number
  readonly stopReason?: string
  readonly content?: readonly PiContent[]
  readonly toolCallId?: string
  readonly toolName?: string
  readonly details?: unknown
  readonly isError?: boolean
}

export type PiContent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'thinking'; readonly thinking: string }
  | { readonly type: 'image'; readonly mimeType?: string; readonly data?: string }
  | {
      readonly type: 'toolCall'
      readonly id: string
      readonly name: string
      readonly arguments: unknown
    }

export type AssistantMessageEvent =
  | { readonly type: 'thinking_start'; readonly contentIndex: number }
  | { readonly type: 'thinking_delta'; readonly contentIndex: number; readonly delta: string }
  | {
      readonly type: 'thinking_end'
      readonly contentIndex: number
      readonly content?: string
      readonly durationMs?: number
    }
  | { readonly type: 'text_start'; readonly contentIndex: number }
  | { readonly type: 'text_delta'; readonly contentIndex: number; readonly delta: string }
  | { readonly type: 'text_end'; readonly contentIndex: number; readonly content?: string }
  | {
      readonly type: 'toolcall_start'
      readonly contentIndex: number
      readonly id: string
      readonly toolName: string
    }
  | { readonly type: 'toolcall_delta'; readonly contentIndex: number; readonly delta: string }
  | {
      readonly type: 'toolcall_end'
      readonly contentIndex: number
      readonly toolCall: { readonly id: string; readonly name: string; readonly arguments: unknown }
    }

export interface Fixture {
  readonly id: string
  readonly label: string
  readonly note?: string
  readonly source: { readonly file: string; readonly lines?: readonly number[] }
  readonly events: readonly FixtureEvent[]
}
