import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { clsx } from 'clsx'
import { IconCheck } from './icons'
import styles from './Menu.module.css'

/** 浮层遮罩：点击空白关闭。调用方可能位于窗口拖拽区，必须显式 no-drag 才能收到点击 */
export function MenuScrim({ onClose }: { onClose: () => void }): ReactNode {
  return (
    <button
      type="button"
      aria-label="关闭"
      tabIndex={-1}
      className={styles.scrim}
      onClick={onClose}
    />
  )
}

/** 退场期间保持挂载，让 CSS 过渡播完。时长与 Menu.module.css 里 .panel 的 transition 保持一致 */
const EXIT_MS = 140
export function usePresence(open: boolean): boolean {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const t = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(t)
  }, [open])
  return mounted
}

/** 公共下拉浮层：遮罩 + 面板 + 显隐过渡，调用方只管 open */
export function Menu({
  open,
  onClose,
  fixed,
  className,
  style,
  children
}: {
  open: boolean
  onClose: () => void
  /** 用坐标定位的场景（右键菜单）改用 fixed */
  fixed?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}): ReactNode {
  const mounted = usePresence(open)
  // 关闭后仍渲染 140ms，位置沿用最后一次的，否则会跳到静态位置
  const lastStyle = useRef(style)
  if (open) lastStyle.current = style
  if (!mounted) return null
  return (
    <>
      {open && <MenuScrim onClose={onClose} />}
      <MenuPanel open={open} fixed={fixed} className={className} style={lastStyle.current}>
        {children}
      </MenuPanel>
    </>
  )
}

/** 公共下拉框容器。open 变化触发 CSS 显隐过渡，默认恒开（预览页静态展示用） */
export function MenuPanel({
  open = true,
  fixed,
  className = '',
  style,
  ref,
  children
}: {
  open?: boolean
  fixed?: boolean
  className?: string
  style?: CSSProperties
  /** 定位由调用方计算时（Dropdown）需要读面板尺寸 */
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}): ReactNode {
  return (
    <div
      ref={ref}
      data-open={open}
      style={fixed ? { position: 'fixed', ...style } : style}
      className={clsx(styles.panel, className)}
    >
      {children}
    </div>
  )
}

/** 公共下拉项：前置图标 + 文案 + 选中打勾 */
export function MenuItem({
  icon,
  label,
  title,
  selected,
  trailing,
  danger,
  onClick,
  children
}: {
  icon?: ReactNode
  /** 与 children 二选一：没给 children 时才渲染 label */
  label?: string
  /** 悬停提示：文案被截断时给完整版 */
  title?: string
  selected?: boolean
  trailing?: ReactNode
  danger?: boolean
  onClick?: () => void
  /** 覆盖 label 区放富内容（命令提示的名称 + 描述两段） */
  children?: ReactNode
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={clsx(styles.item, danger && styles.danger, selected && styles.selected)}
    >
      {icon}
      {children ?? (label != null && <span className={styles.label}>{label}</span>)}
      {trailing}
      {selected && <IconCheck className={styles.check} />}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }): ReactNode {
  return <div className={styles.menuLabel}>{children}</div>
}
