import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import styles from './Toasts.module.css'

type Toast = { id: string; message: string; type: 'info' | 'warning' | 'error' }

const TONE: Record<Toast['type'], string> = {
  info: styles.info,
  warning: styles.warning,
  error: styles.error
}

/** 扩展 notify 的轻量提示：右下角堆叠，3.5s 自动消失（消失由 useAgent 计时） */
export function Toasts({ items }: { items: Toast[] }): ReactNode {
  if (items.length === 0) return null
  return (
    <div className={styles.stack}>
      {items.map((t) => (
        <div key={t.id} className={clsx(styles.toast, TONE[t.type])}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
