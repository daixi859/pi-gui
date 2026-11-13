/**
 * store 的底座：状态形状 + zustand 实例 + 发命令的薄封装。
 *
 * 单独一层是为了打断循环引用：index.ts（切片 API）、blocks.ts、interaction.ts、
 * engine.ts 都只依赖这里，彼此之间没有 import 环。
 */
import { create } from 'zustand'
import type { AgentCommand, AskQuestion, CommandInfo, ModelOption, PiMessage, UiRequest } from '@shared/ipc'
import type { Block, Turn } from 'agent-design/blocks'
import type { ProjectMeta, ProjectRow, SessionMeta, Snapshot } from '@shared/blocks'

/** 待用户作答的问卷（一张卡一道或多道题） */
export interface Ask {
  id: string
  /** 对应 pi 的 toolCallId，答案按它回填 */
  toolCallId: string
  questions: AskQuestion[]
}

export interface Toast {
  id: string
  message: string
  type: 'info' | 'warning' | 'error'
}

export interface EngineState {
  /* ---- 正文 ---- */
  /** 宿主消息（传输模型，ADR-0014）：key 是 timestamp */
  msgs: { order: string[]; byId: Record<string, PiMessage> }
  /** 回合坐标（timeline.ts）：只记范围与统计，折叠呈现全在组件；未变回合复用旧引用 */
  turns: Turn[]
  /** 回合内全部块（timeline.ts 派生），没有嵌套，行级订阅只认这里 */
  byId: Record<string, Block>
  /** 最后一段回答的纯文本，随正文增量顺带更新（复制用） */
  answerText: string
  streaming: boolean
  /** 本轮结束时间戳；没聊过为 null */
  settledAt: number | null
  /** 正在看的会话文件；切走后它仍在后台跑，侧栏用加载图标标出 */
  viewPath: string | null

  /* ---- 会话 ---- */
  sessions: SessionMeta[]
  projects: ProjectMeta[]
  /** 项目管理页：所有项目（含已移除的，看 removedAt） */
  projectRows: ProjectRow[]
  /** 工作区菜单：会话出现过的目录，当前目录在首位 */
  workspaces: string[]
  models: ModelOption[]
  commands: CommandInfo[]
  /** 后台跑完、还没再打开过的会话文件，侧栏用蓝点标出 */
  unread: string[]
  snapshot: Snapshot

  /* ---- 交互 ---- */
  /** 长耗时操作（打开大会话等）的阻塞提示 */
  busy?: string
  /** 待用户作答的问卷，队首即当前卡片 */
  asks: Ask[]
  /** 其他扩展抛来的裸 UI 请求（不含已认领的问卷与 notify） */
  ui: UiRequest[]
  /** 扩展的临时通知，自动消失 */
  toasts: Toast[]
  /** @ 提及的候选文件（相对 cwd） */
  files: string[]
  error?: string
}

export const initial: EngineState = {
  msgs: { order: [], byId: {} },
  turns: [],
  byId: {},
  answerText: '',
  streaming: false,
  settledAt: null,
  viewPath: null,
  sessions: [],
  projects: [],
  projectRows: [],
  workspaces: [],
  models: [],
  commands: [],
  unread: [],
  snapshot: {
    model: '加载中…',
    thinkingLevel: '高',
    cwd: '—',
    workspace: '',
    branch: '—',
    access: '变更前确认',
    accessFull: false
  },
  asks: [],
  ui: [],
  toasts: [],
  files: []
}

export const useEngine = create<EngineState>()(() => initial)

/** 非 React 环境（engine.ts、事件回调、点击处理器里）读写状态用这个 */
export const engine = {
  get: (): EngineState => useEngine.getState(),
  set: (patch: Partial<EngineState>): void => useEngine.setState(patch),
  update: (fn: (s: EngineState) => Partial<EngineState>): void => useEngine.setState(fn)
}

/** 发命令给宿主；浏览器预览（无 preload）时静默丢弃 */
export const send = (cmd: AgentCommand): void => {
  window.pi?.agent.send(cmd)
}
