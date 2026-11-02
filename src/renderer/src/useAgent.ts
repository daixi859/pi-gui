import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentCommand, AgentEvent, AskAnswer, AskQuestion, ModelOption, UiRequest } from '@shared/ipc'
import type { Block, ProjectMeta, SessionMeta, Snapshot } from '@shared/blocks'
import { multiReply, questionsOf, selectReply } from './interactions'

export interface Ask {
  id: string
  /** 对应 pi 的 toolCallId，答案按它回填 */
  toolCallId: string
  questions: AskQuestion[]
}

export interface AgentState {
  blocks: Block[]
  /** 长耗时操作（打开大会话等）的阻塞提示 */
  busy?: string
  /** 会话列表（侧栏） */
  sessions: SessionMeta[]
  /** 正在运行 agent 的会话文件，侧栏用加载图标标出 */
  runningPath: string | null
  /** 运行中被切走（宿主 dispose 了它）、还没再打开过的会话文件，侧栏用蓝点标出 */
  unread: string[]
  /** 会话目录还在扫，列表会继续增长 */
  sessionsLoading: boolean
  projects: ProjectMeta[]
  models: ModelOption[]
  snapshot: Snapshot
  streaming: boolean
  /** 本轮结束时间戳；没聊过为 null */
  settledAt: number | null
  /** 待用户作答的问卷，队首即当前卡片 */
  asks: Ask[]
  /** 其他扩展抛来的裸 UI 请求（不含已认领的问卷与 notify） */
  ui: UiRequest[]
  /** 扩展的临时通知，自动消失 */
  toasts: Array<{ id: string; message: string; type: 'info' | 'warning' | 'error' }>
  error?: string
}

const initial: AgentState = {
  blocks: [],
  sessions: [],
  runningPath: null,
  unread: [],
  sessionsLoading: true,
  projects: [],
  models: [],
  snapshot: { model: '加载中…', thinkingLevel: '高', cwd: '—', branch: '—', access: '变更前确认' },
  streaming: false,
  settledAt: null,
  asks: [],
  ui: [],
  toasts: []
}

/**
 * 切走会话（新建或打开别的）：宿主会 dispose 当前会话，正在跑的那个就此中断，
 * 标成未读让用户知道它还有没看的输出；打开的目标则清掉它的未读标记。
 */
function leave(s: AgentState, nextPath: string | null): AgentState {
  const lost = s.runningPath && s.runningPath !== nextPath ? s.runningPath : null
  const unread = s.unread.filter((p) => p !== nextPath)
  if (lost && !unread.includes(lost)) unread.push(lost)
  return { ...s, runningPath: null, unread }
}

/** 一个工具调用里挂起的 ui 请求：rpiv 逐题 await，所以同一时刻最多一个在等 */
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

/**
 * 引擎状态的唯一入口：发命令、收事件，view 只读它。
 * 交互适配器（interactions/）负责把 ui 请求解释成具体控件与答案格式，这里只管收发。
 */
export function useAgent(): AgentState & {
  prompt: (text: string) => void
  abort: () => void
  newSession: () => void
  openSession: (path: string) => void
  renameSession: (path: string, title: string) => void
  deleteSession: (path: string) => void
  clearError: () => void
  setModel: (id: string) => void
  setThinkingLevel: (level: string) => void
  answerAsk: (id: string, answers: AskAnswer[]) => void
  cancelAsk: (id: string) => void
  replyUi: (id: string, reply: { value?: string; confirmed?: boolean; cancelled?: boolean }) => void
} {
  const [state, setState] = useState<AgentState>(initial)
  const ready = useRef(false)
  const slots = useRef(new Map<string, UiSlot>())
  /** 块缓存：id → 块。增量到达时只替换变了的那些，其余保持引用不变 */
  const cache = useRef(new Map<string, Block>())

  const sendCmd = useCallback((cmd: AgentCommand) => {
    window.pi?.agent.send(cmd)
  }, [])

  /** 把已提交的答案按题号顺序回填给挂起的 ui 请求 */
  const flushSlot = useCallback(
    (toolCallId: string) => {
      const slot = slots.current.get(toolCallId)
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
        sendCmd({ type: 'uiReply', id: req.id, reply: { value } })
        slot.sent++
      }
    },
    [sendCmd]
  )

  useEffect(() => {
    const api = window.pi?.agent
    // 浏览器里预览（无 preload）时降级为静态，不崩
    if (!api) {
      setState((s) => ({ ...s, error: '未连接到引擎（浏览器预览）' }))
      return
    }
    const off = api.onEvent((ev: AgentEvent) => {
      // 工具入参与 ui 请求的处理需要读写 ref，放在 setState 外面
      if (ev.type === 'toolStart') {
        slots.current.set(ev.toolCallId, { name: ev.name, args: ev.args, reqs: [], sent: 0 })
        const questions = questionsOf(ev.args)
        if (ev.name === 'ask_user_question' && questions.length > 0) {
          setState((s) => ({
            ...s,
            asks: [...s.asks, { id: `ask-${ev.toolCallId}`, toolCallId: ev.toolCallId, questions }]
          }))
        }
        return
      }
      if (ev.type === 'uiRequest') {
        const slot = ev.req.toolCallId ? slots.current.get(ev.req.toolCallId) : undefined
        // 已被问答卡认领的请求：先挂起，等用户提交后再按题号回填
        if (slot && questionsOf(slot.args).length > 0) {
          slot.reqs.push(ev.req)
          flushSlot(ev.req.toolCallId as string)
          return
        }
        if (ev.req.kind === 'notify') {
          // 通知是单向的，立刻确认；界面上作为 toast 出现并自动消失
          sendCmd({ type: 'uiReply', id: ev.req.id, reply: {} })
          const toast = {
            id: ev.req.id,
            message: ev.req.message ?? '',
            type: ev.req.notifyType ?? 'info'
          }
          setState((s) => ({ ...s, toasts: [...s.toasts, toast] }))
          setTimeout(
            () => setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== toast.id) })),
            3500
          )
          return
        }
        setState((s) => ({ ...s, ui: [...s.ui, ev.req] }))
        return
      }
      setState((s) => {
        switch (ev.type) {
          case 'sessions':
            return {
              ...s,
              sessions: ev.sessions,
              projects: ev.projects,
              models: ev.models,
              sessionsLoading: ev.loading === true
            }
          case 'blocks': {
            const { full, order, items } = ev.delta
            // 全量时丢掉缓存，否则只覆盖变了的块；没变的块沿用旧引用，React 不会重渲染它们
            const next = full ? new Map<string, Block>() : cache.current
            for (const b of items) next.set(b.id, b)
            cache.current = next
            const blocks: Block[] = []
            for (const id of order) {
              const b = next.get(id)
              if (b) blocks.push(b)
            }
            return { ...s, blocks }
          }
          case 'busy':
            return { ...s, busy: ev.active ? (ev.label ?? '处理中…') : undefined }
          case 'status':
            return {
              ...s,
              snapshot: ev.snapshot,
              streaming: ev.streaming,
              runningPath: ev.streaming ? ev.path : null
            }
          case 'error':
            return { ...s, error: ev.message }
          case 'settled':
            return { ...s, streaming: false, settledAt: Date.now() }
          default:
            return s
        }
      })
    })
    if (!ready.current) {
      ready.current = true
      api.send({ type: 'init' })
    }
    return off
  }, [flushSlot, sendCmd])

  return {
    ...state,
    prompt: (text) => sendCmd({ type: 'prompt', text }),
    abort: () => sendCmd({ type: 'abort' }),
    newSession: () => {
      setState((s) => leave(s, null))
      sendCmd({ type: 'newSession' })
    },
    openSession: (path) => {
      setState((s) => leave(s, path))
      sendCmd({ type: 'openSession', path })
    },
    renameSession: (path, title) => sendCmd({ type: 'renameSession', path, title }),
    deleteSession: (path) => sendCmd({ type: 'deleteSession', path }),
    clearError: () => setState((s) => ({ ...s, error: undefined })),
    setModel: (modelId) => sendCmd({ type: 'setModel', modelId }),
    setThinkingLevel: (level) => sendCmd({ type: 'setThinkingLevel', level }),
    answerAsk: (id, answers) => {
      const ask = state.asks.find((a) => a.id === id)
      if (!ask) return
      const slot = slots.current.get(ask.toolCallId)
      if (slot) {
        slot.answers = answers
        flushSlot(ask.toolCallId)
      }
      setState((s) => ({ ...s, asks: s.asks.filter((a) => a.id !== id) }))
    },
    cancelAsk: (id) => {
      const ask = state.asks.find((a) => a.id === id)
      if (!ask) return
      const slot = slots.current.get(ask.toolCallId)
      // 取消：把已到但未回的请求全部标记为 cancelled，扩展会当作用户放弃
      for (const req of slot?.reqs.slice(slot.sent) ?? []) {
        sendCmd({ type: 'uiReply', id: req.id, reply: { cancelled: true } })
      }
      if (slot) slot.sent = slot.reqs.length
      setState((s) => ({ ...s, asks: s.asks.filter((a) => a.id !== id) }))
    },
    replyUi: (id, reply) => {
      sendCmd({ type: 'uiReply', id, reply })
      setState((s) => ({ ...s, ui: s.ui.filter((r) => r.id !== id) }))
    }
  }
}
