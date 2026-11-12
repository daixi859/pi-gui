import type { SessionMessage, Turn, UserMessage } from './types'
import { textOf } from './types'

/** 把扁平的消息流按用户消息切成轮次；工具结果留在平铺序列里，配对归派生层（blocks.ts） */
export function buildTurns(messages: SessionMessage[], durations?: Turn['durations']): Turn[] {
  const turns: Turn[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      turns.push({ user: m, items: [], ...(durations ? { durations } : {}) })
      continue
    }
    const turn = turns[turns.length - 1]
    if (!turn) continue
    turn.items.push(m)
  }
  return turns
}

/** 发送框提交时生成的 mock 轮次：pi 形状的消息（思考 → 工具调用 → 正文 + 工具结果），重放走同一事件机制 */
export function createMockTurn(text: string, now = Date.now()): Turn {
  const user: UserMessage = {
    role: 'user',
    id: `mock-u-${now}`,
    timestamp: now,
    content: [{ type: 'text', text }]
  }
  const items: Turn['items'] = [
    {
      role: 'assistant',
      id: `mock-a-${now}`,
      timestamp: now + 1,
      model: 'mock/echo',
      stopReason: 'stop',
      content: [
        {
          type: 'thinking',
          thinking: `用户说：「${text}」。先确认输入，再调用一次本地命令演示工具块。`
        },
        { type: 'toolCall', id: `mock-call-${now}`, name: 'powershell', arguments: { command: 'Get-Date' } },
        {
          type: 'text',
          text: `收到：「${text}」。\n\n这是一条 **mock 回复**，用来演示 pi 事件机制的重放：思考块、工具块、正文逐字输出。\n\n\`\`\`ts\nconst reply = 'mock'\nconsole.log(reply)\n\`\`\``
        }
      ]
    },
    {
      role: 'toolResult',
      id: `mock-r-${now}`,
      timestamp: now + 2,
      toolCallId: `mock-call-${now}`,
      toolName: 'powershell',
      isError: false,
      durationMs: 84,
      content: [{ type: 'text', text: new Date(now).toString() }]
    }
  ]
  // mock 轮的思考耗时没有历史记录可查，给一个演示值
  const durations = { [`${now + 1}`]: { 0: 1200 } }
  return { user, items, durations }
}

export function userText(message: UserMessage): string {
  return textOf(message.content)
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
