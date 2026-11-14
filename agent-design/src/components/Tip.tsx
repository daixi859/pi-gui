import type { ReactNode } from 'react'
import styles from './Tip.module.css'

/**
 * 悬停提示：诗在宿主元素上（`tipHost` 提供定位上下文，并让悬停宿主时显示），纯 CSS 无状态。
 * 从宿主正上方居中弹出，不挡点击。
 */
export const tipHost = styles.host

export function Tip({ text, kbd }: { text: string; kbd?: string }): ReactNode {
  return (
    <span className={styles.tip}>
      <span className={styles.text}>{text}</span>
      {kbd && <kbd className={styles.kbd}>{kbd}</kbd>}
    </span>
  )
}
