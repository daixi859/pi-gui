/** Transcript 块的唯一数据模型。UI 与引擎事件共用，引擎尚未接入，先由 mock 供给。 */

export interface DiffLine {
  type: 'add' | 'del' | 'ctx'
  text: string
  no?: number
}

export type ToolState = 'running' | 'done' | 'error'
export type SystemTone = 'info' | 'warn' | 'error'

export type Block =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; streaming?: boolean }
  | { kind: 'thinking'; id: string; text: string; level?: string; streaming?: boolean }
  | { kind: 'tool'; id: string; name: string; args: string; state: ToolState; output?: string }
  | {
      kind: 'diff'
      id: string
      file: string
      added: number
      removed: number
      lines: DiffLine[]
      /** edit 工具给的 unified patch，用于「撤销」 */
      patch?: string
    }
  | {
      kind: 'file'
      id: string
      name: string
      meta: string
      /** 绝对路径；宿主能拿到时才给，有值才能「打开」 */
      path?: string
    }
  | { kind: 'turn'; id: string; durationMs: number; aborted?: boolean; children: Block[] }
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
}

export interface ProjectMeta {
  name: string
  sessions: SessionMeta[]
}

export interface Snapshot {
  model: string
  thinkingLevel: string
  cwd: string
  branch: string
  access: string
}
