/**
 * 事件 → 块/回合的纯函数归约。不依赖 React，也不依赖数据来源：
 * 回放夹具、未来的 `pi --mode json` 实时流都走同一个 `reduce`。
 *
 * 约定（DESIGN.md §1.2）：
 * - `message_end` 是权威定稿，流式文本只用于显示；
 * - `tool_execution_start` 之前工具只是 `toolcall`（preparing）；
 * - `agent_settled` 到达后回合落定；aborted 时未完成的工具记为 stopped。
 */
import type {
  AssistantBlock,
  Block,
  ConversationState,
  PiContent,
  PiEvent,
  PiMessage,
  ThinkingBlock,
  ToolBlock,
  ToolSubCall,
  Turn,
  UserBlock,
} from './types.ts'

export function createInitialState(): ConversationState {
  return {
    turns: [],
    blocks: {},
    seq: 0,
    callIndex: {},
    liveMessage: null,
    activeTurn: null,
    liveTools: {},
  }
}

interface Draft {
  state: ConversationState
}

function nextId(draft: Draft, prefix: string): string {
  draft.state = { ...draft.state, seq: draft.state.seq + 1 }
  return `${prefix}:${draft.state.seq}`
}

/** 追加一个块到当前 live 回合（没有回合时静默丢弃）。 */
function appendBlock(draft: Draft, block: Block): ConversationState {
  const state = draft.state
  const active = state.activeTurn
  if (active === null) return state
  const turn = state.turns.find(t => t.key === active)
  if (turn === undefined) return state
  return {
    ...state,
    blocks: { ...state.blocks, [block.id]: block },
    turns: state.turns.map(t =>
      t.key === active
        ? {
            ...t,
            blockIds: [...t.blockIds, block.id],
            toolCount: t.toolCount + (block.kind === 'tool' ? 1 : 0),
            errorCount:
              t.errorCount + (block.kind === 'tool' && block.state === 'error' ? 1 : 0),
          }
        : t,
    ),
  }
}

function updateBlock<T extends Block>(
  draft: Draft,
  id: string,
  patch: (block: T) => T,
): ConversationState {
  const block = draft.state.blocks[id] as T | undefined
  if (block === undefined) return draft.state
  const next = patch(block)
  return { ...draft.state, blocks: { ...draft.state.blocks, [id]: next } }
}

function updateTurn(draft: Draft, key: string | null, patch: (turn: Turn) => Turn): ConversationState {
  if (key === null) return draft.state
  return {
    ...draft.state,
    turns: draft.state.turns.map(t => (t.key === key ? patch(t) : t)),
  }
}

function textOf(content: readonly PiContent[] | undefined): string {
  if (content === undefined) return ''
  return content
    .filter((c): c is Extract<PiContent, { type: 'text' }> => c.type === 'text')
    .map(c => c.text)
    .join('')
}

function imagesOf(content: readonly PiContent[] | undefined): string[] {
  if (content === undefined) return []
  return content
    .filter((c): c is Extract<PiContent, { type: 'image' }> => c.type === 'image')
    .map(c => (c.data === undefined || c.data === '' ? '' : `data:${c.mimeType ?? 'image/png'};base64,${c.data}`))
    .filter(Boolean)
}

function toolIdOf(state: ConversationState, callId: string): string | undefined {
  return state.callIndex[callId]
}

function subCallsOf(details: unknown): readonly ToolSubCall[] | undefined {
  if (details === null || typeof details !== 'object') return undefined
  const calls = (details as { calls?: unknown }).calls
  if (!Array.isArray(calls)) return undefined
  const out: ToolSubCall[] = []
  for (const raw of calls) {
    if (raw === null || typeof raw !== 'object') continue
    const call = raw as { id?: unknown; name?: unknown; args?: unknown; status?: unknown; durationMs?: unknown }
    if (typeof call.name !== 'string') continue
    const status = typeof call.status === 'string' ? call.status : ''
    out.push({
      id: typeof call.id === 'string' ? call.id : `${out.length}`,
      name: call.name,
      args: call.args,
      state: status === 'error' || status === 'failed' ? 'error' : 'ok',
      durationMs: typeof call.durationMs === 'number' ? call.durationMs : undefined,
    })
  }
  return out.length === 0 ? undefined : out
}

/** 一条 user 消息开启新回合。 */
function startUserTurn(draft: Draft, message: PiMessage, at: number): ConversationState {
  const ts = at
  const user: UserBlock = {
    kind: 'user',
    id: nextId(draft, 'user'),
    text: textOf(message.content),
    images: imagesOf(message.content),
    ts,
  }
  const key = nextId(draft, 'turn')
  const turn: Turn = {
    key,
    userId: user.id,
    blockIds: [user.id],
    status: 'live',
    startedAt: ts,
    toolCount: 0,
    errorCount: 0,
  }
  return {
    ...draft.state,
    blocks: { ...draft.state.blocks, [user.id]: user },
    turns: [...draft.state.turns.map(t => (t.status === 'live' ? { ...t, status: 'settled' as const, endedAt: t.endedAt ?? ts } : t)), turn],
    activeTurn: key,
    liveMessage: null,
  }
}

function applyAssistantMessageEnd(draft: Draft, message: PiMessage): ConversationState {
  const msgTs = draft.state.liveMessage?.ts ?? 0
  // 落定：message_end 是权威，把这条消息的流式块收尾
  let state: ConversationState = {
    ...draft.state,
    blocks: Object.fromEntries(
      Object.entries(draft.state.blocks).map(([id, block]) => {
        if (block.kind === 'assistant' && id.startsWith(`text:${msgTs}:`)) {
          return [id, { ...block, status: 'settled' as const }]
        }
        if (block.kind === 'thinking' && id.startsWith(`think:${msgTs}:`)) {
          return [id, { ...block, streaming: false }]
        }
        return [id, block]
      }),
    ),
    liveMessage: null,
  }
  // 最后一段 text 在 stop 结束时升级为「答案」
  const final = message.stopReason !== 'toolUse' && message.stopReason !== 'pending'
  if (final) {
    const lastText = Object.values(state.blocks)
      .filter((b): b is AssistantBlock => b.kind === 'assistant' && b.id.startsWith(`text:${msgTs}:`))
      .at(-1)
    if (lastText !== undefined) {
      state = { ...state, blocks: { ...state.blocks, [lastText.id]: { ...lastText, final: true } } }
    }
  }
  return state
}

/**
 * 归约一条事件。
 * @param state - 上一状态。
 * @param event - pi JSON 事件。
 * @param at - 事件发生时刻（回放时用夹具的绝对时间），用于耗时计算。
 * @returns 新状态（未变化时返回原对象）。
 */
export function reduce(state: ConversationState, event: PiEvent, at: number = Date.now()): ConversationState {
  const draft: Draft = { state }

  switch (event.type) {
    case 'message_start': {
      const message = event.message
      if (message.role === 'user') {
        // 同一条 user 消息的 start/end 会成对出现，end 不重复建块
        return startUserTurn(draft, message, at)
      }
      if (message.role === 'assistant') {
        return { ...state, liveMessage: { ts: at } }
      }
      return state
    }

    case 'message_end': {
      const message = event.message
      if (message.role === 'toolResult') {
        const callId = message.toolCallId ?? ''
        const id = toolIdOf(state, callId)
        if (id === undefined) return state
        const details = message.details
        return updateBlock<ToolBlock>(draft, id, block => ({
          ...block,
          output: textOf(message.content),
          details,
          subCalls: subCallsOf(details) ?? block.subCalls,
          state: message.isError === true ? 'error' : block.state === 'preparing' ? 'ok' : block.state,
          error:
            message.isError === true
              ? { code: 'tool_error', message: '工具返回错误' }
              : block.error,
        }))
      }
      if (message.role === 'assistant') return applyAssistantMessageEnd(draft, message)
      return state
    }

    case 'message_update': {
      const e = event.assistantMessageEvent
      const msgTs = state.liveMessage?.ts ?? 0
      const ci = e.contentIndex
      switch (e.type) {
        case 'thinking_start': {
          const block: ThinkingBlock = {
            kind: 'thinking',
            id: `think:${msgTs}:${ci}`,
            text: '',
            streaming: true,
            ts: at,
          }
          const next = appendBlock(draft, block)
          return updateTurn({ state: next }, next.activeTurn, t => ({ ...t, activity: { kind: 'thinking' } }))
        }
        case 'thinking_delta':
          return updateBlock<ThinkingBlock>(draft, `think:${msgTs}:${ci}`, block => ({
            ...block,
            text: block.text + e.delta,
          }))
        case 'thinking_end':
          return updateBlock<ThinkingBlock>(draft, `think:${msgTs}:${ci}`, block => ({
            ...block,
            text: e.content ?? block.text,
            streaming: false,
            durationMs: e.durationMs ?? at - block.ts,
          }))
        case 'text_start': {
          const block: AssistantBlock = {
            kind: 'assistant',
            id: `text:${msgTs}:${ci}`,
            text: '',
            status: 'running',
            final: false,
            ts: at,
          }
          const next = appendBlock(draft, block)
          return updateTurn({ state: next }, next.activeTurn, t => ({
            ...t,
            activity: { kind: 'replying' },
          }))
        }
        case 'text_delta':
          return updateBlock<AssistantBlock>(draft, `text:${msgTs}:${ci}`, block => ({
            ...block,
            text: block.text + e.delta,
          }))
        case 'text_end':
          return updateBlock<AssistantBlock>(draft, `text:${msgTs}:${ci}`, block => ({
            ...block,
            text: e.content ?? block.text,
            status: 'settled',
          }))
        case 'toolcall_start': {
          const block: ToolBlock = {
            kind: 'tool',
            id: `tool:${e.id}`,
            callId: e.id,
            name: e.toolName,
            argsRaw: '',
            state: 'preparing',
            ts: at,
          }
          const next = appendBlock(draft, block)
          return {
            ...next,
            callIndex: { ...next.callIndex, [e.id]: block.id },
            liveTools: { ...next.liveTools, [`${msgTs}:${ci}`]: e.id },
          }
        }
        case 'toolcall_delta': {
          const callId = state.liveTools[`${msgTs}:${ci}`]
          if (callId === undefined) return state
          const id = toolIdOf(state, callId)
          if (id === undefined) return state
          return updateBlock<ToolBlock>(draft, id, block => ({
            ...block,
            argsRaw: block.argsRaw + e.delta,
          }))
        }
        case 'toolcall_end': {
          const id = toolIdOf(state, e.toolCall.id)
          if (id === undefined) return state
          return updateBlock<ToolBlock>(draft, id, block => ({
            ...block,
            argsRaw: block.argsRaw === '' ? JSON.stringify(e.toolCall.arguments) : block.argsRaw,
            args: e.toolCall.arguments,
          }))
        }
      }
      return state
    }

    case 'tool_execution_start': {
      const id = toolIdOf(state, event.toolCallId)
      if (id === undefined) return state
      const next = updateBlock<ToolBlock>(draft, id, block => ({
        ...block,
        state: 'running',
        args: event.args ?? block.args,
        argsRaw: block.argsRaw === '' && event.args !== undefined ? JSON.stringify(event.args) : block.argsRaw,
      }))
      return updateTurn({ state: next }, next.activeTurn, t => ({ ...t, activity: { kind: 'tool' } }))
    }

    case 'tool_execution_update': {
      const id = toolIdOf(state, event.toolCallId)
      if (id === undefined) return state
      const partial = textOf(event.partialResult?.content)
      return updateBlock<ToolBlock>(draft, id, block => ({
        ...block,
        output: (block.output ?? '') + partial,
      }))
    }

    case 'tool_execution_end': {
      const id = toolIdOf(state, event.toolCallId)
      if (id === undefined) return state
      const details = event.result?.details
      return updateBlock<ToolBlock>(draft, id, block => ({
        ...block,
        state: event.isError === true ? 'error' : 'ok',
        output: textOf(event.result?.content) || block.output,
        details: details ?? block.details,
        subCalls: subCallsOf(details) ?? block.subCalls,
        durationMs: event.durationMs ?? at - block.ts,
        error:
          event.isError === true
            ? { code: 'tool_error', message: '工具返回错误' }
            : undefined,
      }))
    }

    case 'agent_settled': {
      const aborted = event.aborted === true
      const now = at
      let next: ConversationState = {
        ...state,
        liveMessage: null,
        blocks: Object.fromEntries(
          Object.entries(state.blocks).map(([id, block]) => {
            if (block.kind === 'tool' && (block.state === 'running' || block.state === 'preparing')) {
              return [id, { ...block, state: 'stopped' as const, error: { code: 'interrupted', message: '已中断' } }]
            }
            if (block.kind === 'assistant' && block.status === 'running') {
              return [id, { ...block, status: 'interrupted' as const }]
            }
            if (block.kind === 'thinking' && block.streaming) return [id, { ...block, streaming: false }]
            return [id, block]
          }),
        ),
        turns: state.turns.map(t =>
          t.status === 'live'
            ? { ...t, status: aborted ? ('aborted' as const) : ('settled' as const), endedAt: now }
            : t,
        ),
      }
      if (aborted) {
        const interrupted: Block = {
          kind: 'system',
          id: nextId(draft, 'sys'),
          tone: 'warn',
          text: '已中断',
          ts: now,
        }
        next = appendBlock({ state: next }, interrupted)
      }
      return { ...next, activeTurn: null }
    }

    case 'agent_end':
    case 'agent_start':
    case 'turn_start':
    case 'turn_end':
      return state
  }
}

/** 连续归约一串事件（调试与测试用；页面走分帧回放）。 */
export function reduceAll(events: readonly { readonly ev: PiEvent; readonly dt?: number }[]): ConversationState {
  let state = createInitialState()
  let clock = 0
  for (const item of events) {
    clock += item.dt ?? 0
    state = reduce(state, item.ev, clock)
  }
  return state
}

/** 回合是否应该自动折叠：已落定且有过过程块。 */
export function turnFoldable(turn: Turn): boolean {
  return turn.status !== 'live' && turn.blockIds.length > 1
}

/** live 回合的当前活动（段头文案用）。 */
export function currentActivity(state: ConversationState, turn: Turn): Turn['activity'] {
  if (turn.status !== 'live') return undefined
  for (let i = turn.blockIds.length - 1; i >= 0; i -= 1) {
    const block = state.blocks[turn.blockIds[i]]
    if (block === undefined) continue
    if (block.kind === 'tool' && block.state !== 'ok' && block.state !== 'error') return { kind: 'tool', detail: block.name }
    if (block.kind === 'thinking' && block.streaming) {
      const line = block.text.split('\n').map(s => s.trim()).find(Boolean)
      return { kind: 'thinking', detail: line }
    }
    if (block.kind === 'assistant' && block.status === 'running') return { kind: 'replying' }
    if (block.kind === 'assistant' || block.kind === 'tool') break
  }
  return { kind: 'thinking' }
}
