/**
 * utilityProcess(引擎) 与渲染层之间的精简协议。
 * 渲染层只发命令，引擎只发事件；两边都不依赖 pi 的 SDK 类型。
 */
import type { Block, ProjectMeta, SessionMeta, Snapshot } from './blocks'

/** 可用模型：levels 为该模型支持的思考强度，已按 pi 的 ThinkingLevel 收敛 */
export interface ModelOption {
  id: string
  name: string
  provider: string
  levels: string[]
}

/** 问卷题面（仅当渲染层按工具名认领了该工具时使用） */
export interface AskQuestion {
  header?: string
  question: string
  multiSelect: boolean
  options: Array<{ label: string; description?: string }>
}

/** 单题作答：单选回选中的序号，多选回序号集合，两者都可附一段自定义文本 */
export interface AskAnswer {
  option?: number
  selected?: number[]
  custom?: string
}

/**
 * 扩展通过 ui.* 提出的一次交互请求。kind 是 pi 的通用原语，与具体扩展无关；
 * toolCallId 指向最近一个尚未结束的工具调用，渲染层据此把请求交给对应的交互适配器。
 */
export interface UiRequest {
  id: string
  kind: 'select' | 'input' | 'confirm' | 'editor' | 'notify'
  toolCallId?: string
  title?: string
  message?: string
  placeholder?: string
  prefill?: string
  options?: string[]
  notifyType?: 'info' | 'warning' | 'error'
}

export interface UiReply {
  value?: string
  confirmed?: boolean
  cancelled?: boolean
}

/** 主进程能力：渲染层不能直接用 dialog / shell，要过这层 */
export interface HostBridge {
  copy: (text: string) => void
  openPath: (path: string) => void
  openExternal: (url: string) => void
  saveText: (defaultName: string, text: string) => void
  /** 弹文件选择框，返回选中的绝对路径；取消时为空数组 */
  pickFiles: () => Promise<string[]>
}

export interface BlockDelta {
  /** true 时渲染层丢弃缓存、只用 items 重建（切会话 / 打开历史） */
  full?: boolean
  /** 顶层块 id 顺序：渲染层据此拼数组，不必关心增删位置 */
  order: string[]
  /** 需要新增或更新的块；turn 自带完整 children */
  items: Block[]
}

export type AgentCommand =
  | { type: 'init' }
  | { type: 'prompt'; text: string }
  | { type: 'abort' }
  | { type: 'newSession' }
  | { type: 'openSession'; path: string }
  /** 重命名会话：往它的 JSONL 追加 session_info */
  | { type: 'renameSession'; path: string; title: string }
  | { type: 'deleteSession'; path: string }
  | { type: 'setModel'; modelId: string }
  | { type: 'setThinkingLevel'; level: string }
  | { type: 'uiReply'; id: string; reply: UiReply }
  /** 撤销一次编辑：把 edit 工具给的 patch 反向应用 */
  | { type: 'revertEdit'; patch: string }
  | { type: 'renameSession'; path: string; title: string }
  | { type: 'deleteSession'; path: string }

export type AgentEvent =
  | {
      type: 'sessions'
      sessions: SessionMeta[]
      projects: ProjectMeta[]
      models: ModelOption[]
      /** 会话目录还在扫，列表会继续增长 */
      loading?: boolean
    }
  | { type: 'blocks'; delta: BlockDelta }
  /** path：当前挂载的会话文件，渲染层据此判断哪个侧栏条目在运行 */
  | { type: 'status'; snapshot: Snapshot; streaming: boolean; path: string | null }
  | { type: 'settled'; aborted: boolean }
  /** 长耗时操作（打开大会话）期间的阻塞提示 */
  | { type: 'busy'; active: boolean; label?: string }
  /** 工具开跑：args 是完整入参，只发一次，供交互适配器自行解释 */
  | { type: 'toolStart'; toolCallId: string; name: string; args: unknown }
  | { type: 'uiRequest'; req: UiRequest }
  | { type: 'error'; message: string }
