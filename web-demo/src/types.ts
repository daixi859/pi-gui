// pi AgentMessage 的直通形状（对齐 ADR-0014：正文传输是消息，块由渲染层派生）。
// 与 scripts/build-sessions.mjs 输出的结构保持一致。

export interface TextContent {
  type: 'text'
  text: string
}

export interface ThinkingContent {
  type: 'thinking'
  thinking: string
}

export interface ToolCallContent {
  type: 'toolCall'
  id: string
  name: string
  /** 完整参数；流式中间帧为空对象 + partialArgs，message_end 后才解析完 */
  arguments?: Record<string, unknown>
  partialArgs?: string
}

export type AssistantContent = TextContent | ThinkingContent | ToolCallContent

export interface UserMessage {
  role: 'user'
  id: string
  timestamp: number
  content: TextContent[]
}

export interface AssistantMessage {
  role: 'assistant'
  id: string
  timestamp: number
  model: string
  /** pi 的停止原因：流式中为 'pending'，等工具回填为 'toolUse' */
  stopReason: 'pending' | 'stop' | 'length' | 'toolUse' | 'aborted' | 'error'
  content: AssistantContent[]
}

export interface ToolResultMessage {
  role: 'toolResult'
  id: string
  timestamp: number
  toolCallId: string
  toolName: string
  isError: boolean
  durationMs: number | null
  content: TextContent[]
}

export type SessionMessage = UserMessage | AssistantMessage | ToolResultMessage

/** demo 演示元数据：思考耗时来自 pi 历史的 compact-thinking-duration 自定义记录，不属于消息本体 */
export type ThinkingDurations = Record<string, Record<number, number>>

export const textOf = (content: UserMessage['content']): string =>
  content.map((c) => c.text).join('\n')

/** 一轮对话：user 消息 + 其后的全部消息（平铺，toolResult 也在其中），顺序即 pi 的事件顺序 */
export interface Turn {
  user: UserMessage
  items: SessionMessage[]
  durations?: ThinkingDurations
}

export interface SessionMock {
  source: string
  sessionId: string
  title: string
  cwd: string
  model: string
  updatedAt: number
  messageCount: number
  turnCount: number
  bytes: number
  pinned: boolean
  messages: SessionMessage[]
  thinkingDurations?: ThinkingDurations
}

export interface SessionCatalog {
  source: string
  generatedAt: number
  sessions: SessionMock[]
}
