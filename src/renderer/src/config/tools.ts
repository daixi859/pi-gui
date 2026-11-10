import type { ComponentType, SVGProps } from 'react'
import { IconEdit, IconEye, IconFolder, IconSearch, IconTerminal, IconThinking } from '../components/base/icons'

/** 工具的界面元数据：图标 + 中文动词（行首标签与进行中文案共用） */
export interface ToolMeta {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  verb: string
}

/** 工具名 → 元数据。新增工具加一行；未登记的工具由调用方走兜底 */
export const TOOL_META: Record<string, ToolMeta> = {
  read: { icon: IconEye, verb: '阅读' },
  ls: { icon: IconFolder, verb: '查看' },
  glob: { icon: IconSearch, verb: '查找' },
  grep: { icon: IconSearch, verb: '检索' },
  bash: { icon: IconTerminal, verb: '执行' },
  powershell: { icon: IconTerminal, verb: '执行' },
  edit: { icon: IconEdit, verb: '修改' },
  write: { icon: IconEdit, verb: '写入' },
  thinking: { icon: IconThinking, verb: '思考' }
}

export function toolMeta(name: string): ToolMeta | undefined {
  return TOOL_META[name]
}
