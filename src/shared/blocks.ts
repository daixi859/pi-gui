/** Transcript 块的唯一数据模型。UI 与引擎事件共用，引擎尚未接入，先由 mock 供给。 */

/** pi 思考强度 → 界面文案；宿主快照与渲染层派生共用 */
export const LEVEL_LABEL: Record<string, string> = {
  off: '关闭',
  minimal: '最低',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '很高',
  max: '最高'
}

export interface DiffLine {
  type: 'add' | 'del' | 'ctx'
  text: string
  no?: number
}

export type ToolState = 'running' | 'done' | 'error'
export type SystemTone = 'info' | 'warn' | 'error'

/** diff 块形状：transcript 里并进 tool.diff，独立 kind 只剩预览库在用 */
export type DiffBlock = {
  id: string
  file: string
  added: number
  removed: number
  lines: DiffLine[]
  /** edit 工具给的 unified patch，用于「撤销」 */
  patch?: string
}

export type Block =
  | { kind: 'user'; id: string; text: string; images?: number }
  | { kind: 'assistant'; id: string; text: string; streaming?: boolean }
  | {
      kind: 'thinking'
      id: string
      text: string
      level?: string
      streaming?: boolean
      /** 思考耗时；宿主还没接入，先由 mock 供给 */
      durationMs?: number
    }
  | {
      kind: 'tool'
      id: string
      name: string
      args: string
      state: ToolState
      output?: string
      /** edit / write 的变更（toolResult.details.diff 派生）：diff 属于它的工具行 */
      diff?: DiffBlock
    }
  | ({ kind: 'diff' } & DiffBlock)
  | {
      kind: 'file'
      id: string
      name: string
      meta: string
      /** 绝对路径；宿主能拿到时才给，有值才能「打开」 */
      path?: string
    }
  | { kind: 'system'; id: string; tone: SystemTone; text: string }

export interface SessionMeta {
  id: string
  /** 会话 JSONL 的绝对路径，点开时直接交给引擎 */
  path: string
  title: string
  project: string
  ageLabel: string
  /** 最后活动时间（毫秒），用于排序与时间分组 */
  modifiedAt: number
  /** 这个会话的 agent 还在后台跑（侧栏显示加载图标） */
  running?: boolean
}

export interface ProjectMeta {
  name: string
  /** 项目目录绝对路径（新建任务 / 移除都要用它，不能靠 name 反推） */
  path: string
  sessions: SessionMeta[]
}

/** 项目管理页的一行：全从会话扫描派生，唯一的外部状态是 removedAt（PiGui 自己的软移除） */
export interface ProjectRow {
  /** 绝对路径，唯一标识一个项目 */
  path: string
  name: string
  /** 该目录下的会话数 */
  sessionCount: number
  /** 最近活动时间（毫秒），0 = 从未使用 */
  lastActiveAt: number
  /** 软移除时间；有值说明在「已移除」区，会话文件一个都没动 */
  removedAt?: number
}

export interface Snapshot {
  model: string
  thinkingLevel: string
  cwd: string
  /** 当前工作目录的绝对路径，工作区菜单据此打勾 */
  workspace: string
  branch: string
  access: string
  /** access 的机器可读版本：true = 完全访问，工具不再逐次确认 */
  accessFull: boolean
}
