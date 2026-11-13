/**
 * 悬停预览卡，对齐 DeepSeek Harness 的 HoverCard `variant="preview"`：
 * 鼠标停留 500ms 后出现；宽度取 `widthRef` 元素（缺省为锚点自身）两侧各内缩 24px；
 * 最高 420px，上方空间足够或比下方宽裕时翻到锚点上方；鼠标移入卡片保持打开，
 * 移出 120ms 后关闭；淡入淡出各 100ms；Escape 立即关闭；触屏不触发。
 */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import css from './HoverPreview.module.css'

const OPEN_DELAY_MS = 500
const CLOSE_GRACE_MS = 120
const FADE_MS = 100
const MAX_HEIGHT = 420
const INSET = 24
const GAP = 8
const MARGIN = 8

type Phase = 'closed' | 'open' | 'closing'
type TimerKey = 'open' | 'close' | 'fade'

interface Placement {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

/**
 * 包裹一个锚点，悬停后在 body 下浮出预览卡。
 * @param props.anchor - 悬停目标，原样渲染在包裹层内。
 * @param props.content - 卡片内容，鼠标可以停在上面阅读。
 * @param props.widthRef - 决定卡片宽度与左缘的参照元素，缺省用锚点自身。
 * @returns 锚点与（打开时的）门户卡片。
 */
export function HoverPreview({ anchor, content, widthRef }: {
  anchor: ReactNode
  content: ReactNode
  widthRef?: RefObject<HTMLElement | null>
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const timers = useRef<Partial<Record<TimerKey, number>>>({})
  const phaseRef = useRef<Phase>('closed')
  const [phase, setPhase] = useState<Phase>('closed')
  const [placement, setPlacement] = useState<Placement | null>(null)

  const setPhaseNow = (next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }
  const clearTimer = (key: TimerKey) => {
    const id = timers.current[key]
    if (id !== undefined) {
      window.clearTimeout(id)
      delete timers.current[key]
    }
  }
  const show = () => {
    clearTimer('open')
    clearTimer('close')
    clearTimer('fade')
    setPhaseNow('open')
  }
  const hide = () => {
    clearTimer('open')
    clearTimer('close')
    if (phaseRef.current !== 'open') return
    setPhaseNow('closing')
    timers.current.fade = window.setTimeout(() => {
      delete timers.current.fade
      setPhaseNow('closed')
    }, FADE_MS)
  }
  const scheduleClose = () => {
    clearTimer('open')
    if (phaseRef.current !== 'open') return
    timers.current.close = window.setTimeout(() => {
      delete timers.current.close
      hide()
    }, CLOSE_GRACE_MS)
  }
  const enter = (event: ReactPointerEvent) => {
    if (event.pointerType === 'touch') return
    clearTimer('close')
    if (phaseRef.current === 'open') return
    if (phaseRef.current === 'closing') {
      show()
      return
    }
    if (timers.current.open === undefined) {
      timers.current.open = window.setTimeout(() => {
        delete timers.current.open
        show()
      }, OPEN_DELAY_MS)
    }
  }

  useEffect(() => {
    return () => {
      clearTimer('open')
      clearTimer('close')
      clearTimer('fade')
    }
  }, [])

  useEffect(() => {
    if (phase !== 'open') return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      hide()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [phase])

  useLayoutEffect(() => {
    if (phase === 'closed') {
      setPlacement(null)
      return
    }
    const place = (): void => {
      const anchorEl = anchorRef.current
      if (anchorEl === null) return
      const rect = anchorEl.getBoundingClientRect()
      const bounds = (widthRef?.current ?? anchorEl).getBoundingClientRect()
      const width = Math.max(0, Math.min(bounds.width - INSET * 2, window.innerWidth - MARGIN * 2))
      const left = Math.max(MARGIN, Math.min(bounds.left + INSET, window.innerWidth - width - MARGIN))
      const above = Math.max(0, rect.top - GAP - MARGIN)
      const below = Math.max(0, window.innerHeight - rect.bottom - GAP - MARGIN)
      const onTop = above >= Math.min(MAX_HEIGHT, below)
      const maxHeight = Math.min(MAX_HEIGHT, onTop ? above : below)
      // 朝上时用 bottom 锚定，卡片实际高度变化也始终贴着锚点上缘。
      setPlacement(onTop
        ? { left, width, maxHeight, bottom: window.innerHeight - rect.top + GAP }
        : { left, width, maxHeight, top: rect.bottom + GAP })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [phase, widthRef])

  const closing = phase === 'closing'
  return (
    <>
      <div ref={anchorRef} className={css.anchor} onPointerEnter={enter} onPointerLeave={scheduleClose}>
        {anchor}
      </div>
      {phase !== 'closed' && createPortal(
        // 卡片 portal 到 body，脱离了 .pi-blocks 作用域：外再包一层 pi-blocks，
        // 否则卡片拿不到块的设计令牌（圆角、底色、阴影全退化成默认值）。
        <div className="pi-blocks">
          <div
            ref={cardRef}
            className={closing ? `${css.card} ${css.closing}` : css.card}
            data-hover-preview=""
            style={placement === null
              ? { visibility: 'hidden' }
              : { left: placement.left, top: placement.top, bottom: placement.bottom, width: placement.width, maxHeight: placement.maxHeight }}
            onPointerEnter={() => { clearTimer('close') }}
            onPointerLeave={scheduleClose}
          >
            {content}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
