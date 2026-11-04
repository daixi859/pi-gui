import { useRef, type PointerEvent } from 'react'

/** 滚动条平时透明，鼠标贴到右边缘的轨道那几像素（原生滚动条宽度）才露出来。
 * WebKit 的 ::-webkit-scrollbar 没法用 CSS 表达「hover 轨道」，只能自己判 x 位置。
 * 露出是立即的，收起延迟一点：擦过边缘或滚出容器时不会闪。 */
export function useScrollRail(delay = 350): {
  onPointerMove: (e: PointerEvent<HTMLElement>) => void
  onPointerLeave: (e: PointerEvent<HTMLElement>) => void
} {
  const timer = useRef<number>(undefined)
  const set = (el: HTMLElement, on: boolean): void => {
    window.clearTimeout(timer.current)
    if (on) {
      el.classList.add('rail-on')
      return
    }
    // 元素还在就用；卸载后 timer 里的引用也只是空转一次
    timer.current = window.setTimeout(() => el.classList.remove('rail-on'), delay)
  }
  return {
    onPointerMove: (e) => {
      const el = e.currentTarget
      // 有垂直滚动条时 offsetWidth - clientWidth 正好是条宽；没有就不要乱亮
      const rail = el.offsetWidth - el.clientWidth
      set(el, rail > 0 && el.getBoundingClientRect().right - e.clientX <= rail + 2)
    },
    onPointerLeave: (e) => set(e.currentTarget, false)
  }
}
