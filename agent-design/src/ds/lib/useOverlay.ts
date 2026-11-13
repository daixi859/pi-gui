/**
 * 浮层通用行为：锚定定位、点击外部关闭、Esc 关闭、焦点归还。
 *
 * 单独抽出来的原因：5 种浮层（Popover / Menu / Tooltip / Dialog / Toast）里有 4 种
 * 需要「点外面关掉 + Esc 关掉 + 关闭后焦点回到触发元素」，各写一遍必然会漏其中一条。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** 浮层相对锚点的方位。 */
export type Side = 'bottom' | 'top'

/** 浮层坐标。 */
export interface AnchorPosition {
  x: number
  y: number
  side: Side
  /** 锚点宽度，菜单会对齐触发元素宽度。 */
  width: number
}

/**
 * 计算浮层坐标：默认贴锚点下沿，下方空间不足时翻到上方。
 * @param anchor - 触发元素。
 * @param layer - 浮层元素（用于测量自身高度）。
 * @param align - start 左对齐 / end 右对齐。
 * @param gap - 与锚点的距离。
 * @returns 视口坐标与翻面结果。
 */
export function placeLayer(
  anchor: HTMLElement,
  layer: HTMLElement | null,
  align: 'start' | 'end',
  gap: number,
): AnchorPosition {
  const rect = anchor.getBoundingClientRect()
  const height = layer?.offsetHeight ?? 0
  const width = layer?.offsetWidth ?? 0
  const below = window.innerHeight - rect.bottom
  const side: Side = below < height + gap + 8 && rect.top > height + gap + 8 ? 'top' : 'bottom'
  const y = side === 'bottom' ? rect.bottom + gap : rect.top - height - gap
  const rawX = align === 'start' ? rect.left : rect.right - width
  const x = Math.min(Math.max(8, rawX), Math.max(8, window.innerWidth - width - 8))
  return { x, y, side, width: rect.width }
}

/**
 * 打开状态下的全局监听：点外部、Esc、滚动与视口变化。
 * @param open - 是否开启。
 * @param root - 包含锚点与浮层的容器；点击其内部不关闭。
 * @param onClose - 关闭回调。
 * @param opts.escape - 是否响应 Esc，默认 true。
 * @param opts.onReposition - 滚动/缩放时重算位置。
 */
export function useDismiss(
  open: boolean,
  root: RefObject<HTMLElement | null>,
  onClose: () => void,
  opts: { escape?: boolean; onReposition?: (() => void) | undefined } = {},
): void {
  const { escape = true, onReposition } = opts
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target && root.current?.contains(target)) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (escape && event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    const reposition = (): void => onReposition?.()
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, root, onClose, escape, onReposition])
}

/**
 * 浮层定位状态：先渲染到 (0,0) 隐藏起来量尺寸，再放到真实位置，避免第一帧在左上角闪一下。
 * @param open - 是否开启。
 * @param anchorRef - 锚点引用。
 * @param layerRef - 浮层引用。
 * @param align - 对齐方式。
 * @returns 当前位置与重算函数。
 */
export function useAnchorPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  layerRef: RefObject<HTMLElement | null>,
  align: 'start' | 'end' = 'start',
): { position: AnchorPosition; measure: () => void } {
  const [position, setPosition] = useState<AnchorPosition>({ x: 0, y: 0, side: 'bottom', width: 0 })

  const measure = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    setPosition(placeLayer(anchor, layerRef.current, align, 6))
  }, [anchorRef, layerRef, align])

  useLayoutEffect(() => {
    if (!open) return
    measure()
  }, [open, measure])

  return { position, measure }
}

/**
 * Dialog 的焦点管理：打开时聚焦首元素，Tab 在内部循环，关闭时把焦点还给触发者。
 * @param open - 是否打开。
 * @param dialogRef - 对话框元素。
 */
export function useFocusTrap(open: boolean, dialogRef: RefObject<HTMLElement | null>): void {
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    if (!dialog) return
    const focusables = (): HTMLElement[] =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(element => element.offsetParent !== null)

    const first = focusables()[0]
    ;(first ?? dialog).focus()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) {
        event.preventDefault()
        return
      }
      const head = list[0]!
      const tail = list[list.length - 1]!
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault()
        tail.focus()
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault()
        head.focus()
      }
    }
    dialog.addEventListener('keydown', onKeyDown)
    return () => {
      dialog.removeEventListener('keydown', onKeyDown)
      restoreRef.current?.focus()
    }
  }, [open, dialogRef])
}

/**
 * 打开时锁住页面滚动。
 * @param open - 是否打开。
 */
export function useScrollLock(open: boolean): void {
  useEffect(() => {
    if (!open) return
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previous
    }
  }, [open])
}
