import type { ToolBlock } from '../reducer/types'

/**
 * 过程类别：驱动「组头汇总、组头图标、工具行图标」的那一维。
 * 取词与 DeepSeek harness 的 step-process 轴一致。
 */
export type ProcessKind =
  | 'thinking'
  | 'read'
  | 'readImage'
  | 'write'
  | 'search'
  | 'edit'
  | 'commands'
  | 'code'
  | 'webSearch'
  | 'webFetch'
  | 'subagents'
  | 'plan'
  | 'questions'
  | 'tools'
  | 'context'

export interface ToolMeta {
  readonly kind: ProcessKind
  /** 行首动词：工具行的标题就是它。 */
  readonly verb: string
}

/**
 * 工具名 → 类别与动词。这里是唯一的登记处：分组计数、组头图标、
 * 工具行标题都从它取，避免同一个工具在四处各写一遍。
 */
const TOOLS: Record<string, ToolMeta> = {
  read: { kind: 'read', verb: '阅读' },
  ls: { kind: 'read', verb: '查看' },
  read_image: { kind: 'readImage', verb: '查看图片' },
  readImage: { kind: 'readImage', verb: '查看图片' },
  grep: { kind: 'search', verb: '检索' },
  glob: { kind: 'search', verb: '查找' },
  write: { kind: 'write', verb: '写入' },
  edit: { kind: 'edit', verb: '修改' },
  apply_patch: { kind: 'edit', verb: '修改' },
  bash: { kind: 'commands', verb: '执行' },
  pwsh: { kind: 'commands', verb: '执行' },
  powershell: { kind: 'commands', verb: '执行' },
  cmd: { kind: 'commands', verb: '执行' },
  exec_command: { kind: 'commands', verb: '执行' },
  write_stdin: { kind: 'commands', verb: '输入' },
  run_code: { kind: 'code', verb: '脚本' },
  codemode: { kind: 'code', verb: '脚本' },
  web_search: { kind: 'webSearch', verb: '搜索网页' },
  web_fetch: { kind: 'webFetch', verb: '获取网页' },
  subagent: { kind: 'subagents', verb: '子智能体' },
  todo_write: { kind: 'plan', verb: '更新计划' },
  create_goal: { kind: 'plan', verb: '更新计划' },
  update_goal: { kind: 'plan', verb: '更新计划' },
  get_goal: { kind: 'plan', verb: '查看计划' },
  ask_user_question: { kind: 'questions', verb: '提问' },
  request_user_input: { kind: 'questions', verb: '提问' },
}

/** 未登记的工具名按命名约定归类，动词就用工具名本身。 */
function fallbackKind(name: string): ProcessKind {
  if (name.endsWith('_inspect')) return 'search'
  if (name.startsWith('terminal_')) return 'commands'
  if (name.startsWith('subagent_')) return 'subagents'
  return 'tools'
}

export function toolMeta(name: string): ToolMeta {
  return TOOLS[name] ?? { kind: fallbackKind(name), verb: name }
}

/** 工具名 → 类别；未登记一律「调用工具」。 */
export function toolKind(name: string): ProcessKind {
  return toolMeta(name).kind
}

/** 工具名 → 行首动词。 */
export function toolVerb(name: string): string {
  return toolMeta(name).verb
}

/** 单个工具块属于哪个类别（分组计数与图标共用）。 */
export function blockKind(block: ToolBlock): ProcessKind {
  return toolKind(block.name)
}
