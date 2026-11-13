import { ACTION_DOCS } from './action'
import { DISPLAY_DOCS } from './display'
import { INPUT_DOCS } from './input'
import { OVERLAY_DOCS } from './overlay'
import { groupDocs, type ComponentDoc } from './types'

export { GROUP_META, groupDocs } from './types'
export type { ComponentDoc, DocGroup, DocKeyRow, DocPropRow, DocState } from './types'

/** 全部 P0 组件文档，按「动作 → 输入 → 浮层 → 展示」排列。 */
export const ALL_DOCS: readonly ComponentDoc[] = [...ACTION_DOCS, ...INPUT_DOCS, ...OVERLAY_DOCS, ...DISPLAY_DOCS]

/** 分组后的文档，供左侧列表渲染。 */
export const DOC_GROUPS = groupDocs(ALL_DOCS)

/** 按 id 找一篇文档。 */
export function findDoc(id: string): ComponentDoc | undefined {
  return ALL_DOCS.find(doc => doc.id === id)
}
