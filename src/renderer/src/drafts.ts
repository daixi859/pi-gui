import { useSyncExternalStore } from 'react'
import type { PromptImage } from '@shared/ipc'

/** 一份草稿：还没发出去的字和附件，只在内存里，退出应用即丢 */
interface Draft {
  text: string
  images: PromptImage[]
}

const drafts: Record<string, Draft> = {}
const listeners = new Set<() => void>()
/** 没草稿时给个稳定空数组，selector 每次返回新引用会让 React 反复重渲染 */
const NO_IMAGES: PromptImage[] = []
const empty = (): Draft => ({ text: '', images: [] })

/** 改一份草稿；改空了就删键，免得空草稿越堆越多 */
function write(scope: string, edit: (d: Draft) => Draft): void {
  const next = edit(drafts[scope] ?? empty())
  if (next.text || next.images.length) drafts[scope] = next
  else delete drafts[scope]
  for (const l of listeners) l()
}

export const setDraftText = (scope: string, text: string): void =>
  write(scope, (d) => ({ ...d, text }))

export const setDraftImages = (
  scope: string,
  edit: (prev: PromptImage[]) => PromptImage[]
): void => write(scope, (d) => ({ ...d, images: edit(d.images) }))

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 当前会话/工作区的草稿文字与附件 */
export function useDraft(scope: string): { text: string; images: PromptImage[] } {
  const text = useSyncExternalStore(subscribe, () => drafts[scope]?.text ?? '')
  const images = useSyncExternalStore(subscribe, () => drafts[scope]?.images ?? NO_IMAGES)
  return { text, images }
}
