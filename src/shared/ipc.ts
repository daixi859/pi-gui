/**
 * utilityProcess(引擎) 与渲染层之间的精简协议。
 * 渲染层只发命令，引擎只发事件；两边都不依赖 pi 的 SDK 类型。
 */
import type { Block, ProjectMeta, ProjectRow, SessionMeta, Snapshot } from './blocks'

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
  /** 弹目录选择框（切换工作区），取消时为 null */
  pickDirectory: () => Promise<string | null>
  /** 打开 ~/.pi/agent/settings.json（设置 / 插件入口） */
  openAgentConfig: () => void
  /** 读图片为 base64（渲染层跨不了 file://），失败返回 null */
  readImage: (path: string) => Promise<{ data: string; mimeType: string } | null>
  /** 读文本文件（相对路径按引擎的工作目录解析），超过上限只给前一段 */
  readText: (path: string) => Promise<{ text: string; truncated: boolean } | null>
  /** 在资源管理器里定位文件 */
  revealPath: (path: string) => void
}

/** 图片附件：base64 数据与 MIME 类型，直接透给 pi 的 ImageContent */
export interface PromptImage {
  data: string
  mimeType: string
}

/**
 * 折叠行的增量：子块只带变了的那些。
 * 不动 children 的时长/中断态变化（每秒一次）只带这两个字段，不再重发整块。
 */
export interface TurnDelta {
  id: string
  durationMs: number
  aborted?: boolean
  /** 完整子块顺序；只有顺序变了才带，缺省沿用渲染层现有顺序 */
  order?: string[]
  /** 新增或变化的子块 */
  items: Block[]
}

export interface BlockDelta {
  /** true 时渲染层丢弃缓存、只用 items 重建（切会话 / 打开历史） */
  full?: boolean
  /** 顶层块 id 顺序：渲染层据此拼数组，不必关心增删位置；没变时不带 */
  order?: string[]
  /** 需要新增或更新的顶层块；full 时 turn 自带完整 children */
  items: Block[]
  /** 折叠行的子块增量；full 时不使用（turn 整块在 items 里） */
  turns?: TurnDelta[]
}

/** 扩展注册的斜杠命令，供输入框的 / 菜单 */
export interface CommandInfo {
  name: string
  description?: string
}

/** 工具执行前的确认策略：confirm = 写文件/执行命令前问一次，full = 直接跑 */
export type AccessMode = 'confirm' | 'full'

export type AgentCommand =
  | { type: 'init' }
  | { type: 'prompt'; text: string; images?: PromptImage[] }
  | { type: 'abort' }
  | { type: 'newSession' }
  /** 换工作区：以后新会话都建在这个目录下 */
  | { type: 'workspace'; path: string }
  /** 软移除项目：只从 PiGui 的列表里藏起来，可恢复，不动会话文件 */
  | { type: 'projectRemove'; path: string }
  | { type: 'projectRestore'; path: string }
  /** 真删项目：连同它下面所有会话文件一起删，pi 的原始数据会没 */
  | { type: 'projectDelete'; path: string }
  | { type: 'openSession'; path: string }
  /** 重命名会话：往它的 JSONL 追加 session_info */
  | { type: 'renameSession'; path: string; title: string }
  | { type: 'deleteSession'; path: string }
  | { type: 'setModel'; modelId: string }
  | { type: 'setThinkingLevel'; level: string }
  | { type: 'setAccess'; mode: AccessMode }
  | { type: 'uiReply'; id: string; reply: UiReply }
  /** 撤销一次编辑：把 edit 工具给的 patch 反向应用 */
  | { type: 'revertEdit'; patch: string }
  /** 取 cwd 下文件名，供输入框的 @ 提及下拉 */
  | { type: 'listFiles'; query: string }

export type AgentEvent =
  | {
      type: 'sessions'
      sessions: SessionMeta[]
      projects: ProjectMeta[]
      /** 项目管理页的所有项目（含已移除的，按 removedAt 区分） */
      projectRows: ProjectRow[]
      /** 工作区菜单：会话出现过的目录（绝对路径），当前目录在首位，已移除的不在内 */
      workspaces: string[]
      models: ModelOption[]
      /** 会话目录还在扫，列表会继续增长 */
      loading?: boolean
      commands: CommandInfo[]
    }
  /** path：这些块属于哪个会话文件；full 时渲染层据此认定「现在看的是哪个会话」 */
  | { type: 'blocks'; delta: BlockDelta; path: string | null }
  /** path：当前挂载的会话文件，渲染层据此判断哪个侧栏条目在运行 */
  | { type: 'status'; snapshot: Snapshot; streaming: boolean; path: string | null }
  /** path：这轮结束的会话文件；不是当前在看的会话时渲染层标成未读 */
  | { type: 'settled'; aborted: boolean; path: string | null }
  /** 长耗时操作（打开大会话）期间的阻塞提示 */
  | { type: 'busy'; active: boolean; label?: string }
  /** 工具开跑：args 是完整入参，只发一次，供交互适配器自行解释 */
  | { type: 'toolStart'; toolCallId: string; name: string; args: unknown }
  | { type: 'uiRequest'; req: UiRequest }
  | { type: 'files'; items: string[] }
  | { type: 'error'; message: string }
