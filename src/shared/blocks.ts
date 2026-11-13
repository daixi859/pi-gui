/** 跨进程的会话/工作区元数据。对话块类型不在这里——它来自 agent-design/blocks。 */

/** pi 思考强度 → 界面文案；宿主快照与渲染层共用 */
export const LEVEL_LABEL: Record<string, string> = {
  off: '关闭',
  minimal: '最低',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '很高',
  max: '最高'
}

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
