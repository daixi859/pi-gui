import type { ReactNode } from 'react'

const TONE: Record<string, string> = {
  info: 'border-edge text-fg',
  warning: 'border-warn/40 text-warn',
  error: 'border-del/40 text-del'
}

/** 扩展 notify 的轻量提示：右下角堆叠，3.5s 自动消失（消失由 useAgent 计时） */
export function Toasts({
  items
}: {
  items: Array<{ id: string; message: string; type: 'info' | 'warning' | 'error' }>
}): ReactNode {
  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-[300px] flex-col gap-1">
      {items.map((t) => (
        <div
          key={t.id}
          className={`rounded-md border bg-surface px-2 py-2 text-xs leading-[1.5] shadow-toast ${TONE[t.type] ?? TONE.info}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
