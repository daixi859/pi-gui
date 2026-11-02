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
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-[300px] flex-col gap-1.5">
      {items.map((t) => (
        <div
          key={t.id}
          className={`rounded-[10px] border bg-surface px-3 py-2 text-[12.5px] leading-[1.5] shadow-[0_6px_20px_-10px_rgba(0,0,0,0.3)] ${TONE[t.type] ?? TONE.info}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
