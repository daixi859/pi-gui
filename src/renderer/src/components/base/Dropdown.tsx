import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MenuPanel, MenuScrim, usePresence } from './Menu'

/**
 * 点击展开的下拉：定位 + 开关 + 关闭，全部在这里；面板外观与菜单项仍来自 Menu。
 * 浮层 portal 到 body 并以 fixed 定位，所以不受父级 overflow 裁剪，也不用在业务组件里写 top-full mt-1。
 * 只管点击展开；hover 提示用 Tip，不混进来。
 */


/** 面板与触发元素的间距，与 pi-menu 的视觉节奏对齐 */
const GAP = 4
/** 贴视口边缘的最小留白 */
const EDGE = 8
/** 没给宽度时的最窄宽度 */
const MIN_W = 132
/** 两侧都放不下时的最小可用高度：宁愿越过视口也要能读，不要压成 0 */
const MIN_H = 120

type Geo = {
  left: number
  top: number
  maxHeight?: number
  minWidth?: number
  width?: number
}

export function Dropdown({
  placement = 'bottom',
  align,
  width,
  className,
  trigger,
  children
}: {
  /** 默认在触发元素下方；上方放不下时自动翻到上方 */
  placement?: 'bottom' | 'top'
  /** 水平对齐：start 面板左边对齐触发元素，end 让右边对齐 */
  align?: 'start' | 'end'
  /** 数字是固定宽度，'anchor' 跟触发元素同宽，不给则最窄 132 由内容撑开 */
  width?: number | 'anchor'
  className?: string
  /** render prop：aria-expanded / onClick 要落在调用方自己的按钮上 */
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode
  /** 传函数可以拿到 close：选中后自己关（并夹业务逻辑） */
  children: ReactNode | ((state: { close: () => void }) => ReactNode)
}): ReactNode {
  const [open, setOpen] = useState(false)
  const mounted = usePresence(open)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState<Geo | null>(null)

  const measure = useCallback((): Geo | null => {
    const anchor = anchorRef.current?.firstElementChild as HTMLElement | null
    if (!anchor) return null
    const rect = anchor.getBoundingClientRect()
    const panel = panelRef.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    // scrollHeight 是内容自然高度，被 maxHeight 截断后仍能拿到，翻向与贴边才不会抖
    const naturalH = panel?.scrollHeight ?? 0
    // 参与定位与贴边夹取的宽度：anchor 只是 minWidth，内容可以比锚宽，夹取按实际渲染宽算
    const boxW =
      width === 'anchor'
        ? Math.max(rect.width, panel?.offsetWidth ?? 0)
        : (width ?? panel?.offsetWidth ?? MIN_W)

    const wantsTop = placement === 'top'
    const spaceBelow = vh - rect.bottom - GAP - EDGE
    const spaceAbove = rect.top - GAP - EDGE
    // 优先按 placement，放不下且另一侧更宽裕时翻向；两侧都不够就压到空间大的那侧滚动
    const fits = naturalH <= (wantsTop ? spaceAbove : spaceBelow)
    const flip = !fits && (wantsTop ? spaceBelow : spaceAbove) > (wantsTop ? spaceAbove : spaceBelow)
    const space = Math.max(flip ? spaceAbove : spaceBelow, MIN_H)
    const height = Math.min(naturalH, space)

    const wantsEnd = align === 'end'
    const rawLeft = wantsEnd ? rect.right - boxW : rect.left
    const left = Math.min(Math.max(EDGE, rawLeft), Math.max(EDGE, vw - boxW - EDGE))

    return {
      left,
      top: flip ? rect.top - GAP - height : rect.bottom + GAP,
      maxHeight: space,
      width: width === undefined || width === 'anchor' ? undefined : boxW,
      minWidth: width === undefined ? MIN_W : width === 'anchor' ? rect.width : undefined
    }
  }, [placement, align, width])

  useLayoutEffect(() => {
    if (!open || !mounted) return
    const update = (): void => {
      const next = measure()
      if (!next) return
      // 数值没变就不换引用，否则打开状态下滚动容器每帧滚动都会重渲染整个下拉
      setGeo((prev) =>
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.maxHeight === next.maxHeight &&
        prev.minWidth === next.minWidth &&
        prev.width === next.width
          ? prev
          : next
      )
    }
    update()
    // 面板宽度依赖内容，首次测量后宽度才定下来，下一帧再量一次高度才准
    const raf = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    // 捕获阶段，父级滚动容器（侧栏、正文）滚动时也要跟着走
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, mounted, measure])

  // Esc 关闭；Tab 顺序沿用浏览器默认，不做焦点陷阱
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // 退场 140ms 内不再测量，geo 停在最后一次的位置，面板不会跳到静态位置；首次打开的第一帧 geo 为空，先藏起来。
  // 先算一次大概位置再开。面板还没挂载时（首次打开）量不到内容高度，就留空让渲染等 useLayoutEffect 首帧测量，
  // 否则 placement="top" 会先算成 height=0、贴在触发元素上再被纠正
  const toggle = (): void => {
    if (!open && panelRef.current) {
      const next = measure()
      if (next) setGeo(next)
    }
    setOpen((v) => !v)
  }

  return (
    <>
      <span ref={anchorRef} className="contents">
        {trigger({ open, toggle })}
      </span>
      {mounted &&
        createPortal(
          <>
            {open && <MenuScrim onClose={() => setOpen(false)} />}
            <MenuPanel
              ref={panelRef}
              open={open}
              fixed
              className={className}
              style={
                geo
                  ? {
                      left: geo.left,
                      top: geo.top,
                      maxHeight: geo.maxHeight,
                      minWidth: geo.minWidth,
                      width: geo.width,
                      overflowY: 'auto'
                    }
                  : { visibility: 'hidden' }
              }
            >
              {typeof children === 'function'
                ? children({ close: () => setOpen(false) })
                : children}
            </MenuPanel>
          </>,
          document.body
        )}
    </>
  )
}
