import { createContext, memo, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePiTheme, type PiThemeMode } from './usePiTheme'
import '../tokens/tokens.css'
import '../base.css'

/** 主题上下文：后代组件（图表、着色示意）要按当前主题微调时读它。 */
const ThemeContext = createContext<{ mode: PiThemeMode; dark: boolean; setMode: (mode: PiThemeMode) => void }>({
  mode: 'light',
  dark: false,
  setMode: () => undefined,
})

/**
 * 浮层宿主：`--pi-*` 只声明在 `.pi-root` 上，浮层若直接挂 `document.body`
 * 就会落在令牌作用域外（背景、描边、阴影全部失效）。所以由 PiRoot 提供一个
 * 位于子树内的挂载点，浮层通过这个 context 取到它。
 */
const PortalHostContext = createContext<HTMLElement | null>(null)

/**
 * 读取当前 PiDS 主题。
 * @returns 主题模式、是否深色、设置函数。
 */
export function usePiThemeContext(): { mode: PiThemeMode; dark: boolean; setMode: (mode: PiThemeMode) => void } {
  return useContext(ThemeContext)
}

/**
 * 把内容送到最近的 PiRoot 浮层宿主。
 *
 * 宿主尚未挂载时返回 null：浮层晚一帧出现，但绝不会落进没有令牌的 body。
 * @param props.children - 要传送的内容。
 * @returns 传送门节点或 null。
 */
export function PiPortal({ children }: { children: ReactNode }): ReactNode {
  const host = useContext(PortalHostContext)
  if (host === null) return null
  return createPortal(children, host)
}

/** PiRoot props。 */
export interface PiRootProps {
  children: ReactNode
  /** 强制主题，用于规范页里「深浅并排」的样例；不传则跟随本地存储与系统。 */
  forceTheme?: 'light' | 'dark' | undefined
  className?: string | undefined
}

/**
 * PiDS 的根容器：挂载令牌、基座样式、主题属性、主题上下文与浮层宿主。
 *
 * 之所以必须有一层容器而不是直接改 body：`--dsw-*` 声明在 body 上，
 * 任何 :root 级同名变量都会被它吃掉；`.pi-root` 在 body 之下，令牌才可靠。
 * @param props - 子内容与可选主题覆盖。
 * @returns 带 `pi-root` 类的 div。
 */
export const PiRoot = memo(function PiRoot({ children, forceTheme, className }: PiRootProps) {
  const [mode, dark, setMode] = usePiTheme()
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const attachHost = useCallback((node: HTMLDivElement | null) => setHost(node), [])
  const effective = forceTheme === undefined ? dark : forceTheme === 'dark'
  const value = { mode, dark: effective, setMode }
  return (
    <ThemeContext.Provider value={value}>
      <div
        className={className === undefined ? 'pi-root' : `pi-root ${className}`}
        data-pi-theme={effective ? 'dark' : 'light'}
      >
        <PortalHostContext.Provider value={host}>{children}</PortalHostContext.Provider>
        {/* 零尺寸挂载点：display:contents 不生成盒子，浮层子元素仍用 fixed 相对视口定位。 */}
        <div ref={attachHost} className="pi-portal" aria-hidden="true" />
      </div>
    </ThemeContext.Provider>
  )
})
