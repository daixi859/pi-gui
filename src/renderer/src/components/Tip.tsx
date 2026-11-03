import type { ReactNode } from 'react'

/**
 * 悬停提示：靠父级 group 显隐，纯 CSS 无状态。父元素要有 `relative group`。
 * 从按钮右下角往上弹，不挡点击。
 */
export function Tip({ text, kbd }: { text: string; kbd?: string }): ReactNode {
  return (
    <span className="pointer-events-none absolute right-0 bottom-full z-50 mb-1 hidden items-center gap-1 rounded-md border border-edge bg-surface px-2 py-0.5 whitespace-nowrap shadow-pop group-hover:flex">
      <span className="text-xs font-medium text-fg">{text}</span>
      {kbd && <kbd className="rounded-sm bg-sunken px-1 text-xs text-muted">{kbd}</kbd>}
    </span>
  )
}
