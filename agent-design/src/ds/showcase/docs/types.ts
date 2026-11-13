import type { ReactNode } from 'react'
import type { DsIconName } from '../../icons/DsIcon'

/** 组件分组：决定组件页左侧列表怎么分组。 */
export type DocGroup = 'action' | 'input' | 'overlay' | 'display'

/** 分组显示名与顺序。 */
export const GROUP_META: readonly { id: DocGroup; label: string }[] = [
  { id: 'action', label: '动作' },
  { id: 'input', label: '输入' },
  { id: 'overlay', label: '浮层' },
  { id: 'display', label: '展示' },
]

/** 状态矩阵里的一个格子。 */
export interface DocState {
  /** 状态名，例如「默认」「悬停」。 */
  label: string
  /** 该状态的视觉样本。 */
  node: ReactNode
  /** 该状态为什么存在（一句话）。 */
  note?: string | undefined
}

/** props 表的一行。 */
export interface DocPropRow {
  name: string
  type: string
  default: string
  desc: string
}

/** 键盘路径的一行。 */
export interface DocKeyRow {
  keys: string
  action: string
}

/** 一个组件的完整文档。 */
export interface ComponentDoc {
  /** 与 `COMPONENT_INDEX` 里的 name 对应的稳定 id。 */
  id: string
  /** 显示名。 */
  name: string
  group: DocGroup
  /** 一句话说明这个东西是什么。 */
  summary: string
  /** 左侧列表图标。 */
  icon: DsIconName
  /** 何时用。 */
  use: readonly string[]
  /** 何时不用（以及改用什么）。 */
  avoid: readonly string[]
  /** 状态矩阵。 */
  states: readonly DocState[]
  /** 尺寸变体；没有尺寸差异的组件留空。 */
  sizes?: ReactNode
  /** props 表。 */
  props: readonly DocPropRow[]
  /** 键盘与 ARIA。 */
  keyboard: readonly DocKeyRow[]
  /** 双主题并排的示例；省略则用默认的「按当前主题渲染」。 */
  sample: ReactNode
  /** 实现备注（为什么这么做）。 */
  notes?: readonly string[]
}

/** 把组件文档按分组归拢，保持声明顺序。 */
export function groupDocs(docs: readonly ComponentDoc[]): readonly { id: DocGroup; label: string; items: readonly ComponentDoc[] }[] {
  return GROUP_META.map(meta => ({
    ...meta,
    items: docs.filter(doc => doc.group === meta.id),
  })).filter(group => group.items.length > 0)
}
