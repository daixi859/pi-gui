import type { ReactNode } from 'react'

/** 三点呼吸：会话还在跑 / 宿主忙时挂在正文末尾，跑完自动消失 */
export function WorkingDots(): ReactNode {
  return (
    <div role="status" className="mt-4 flex items-center gap-1 pl-1 text-faint">
      <span className="sr-only">正在生成…</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="breathe size-1.5 rounded-pill bg-current"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  )
}
