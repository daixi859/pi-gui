import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 流式摘要的单行走马灯：内容超出视窗才滚动，短文本保持静止。
 * 第二份内容只用于无缝衔接，读屏只读第一份；减少动态时由 CSS 收起副本。
 */
export function Marquee({ text }: { text: string }): ReactNode {
  const viewport = useRef<HTMLSpanElement>(null)
  const first = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const box = viewport.current
    const line = first.current
    if (!box || !line) return
    const measure = (): void => setOverflow(line.offsetWidth > box.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    observer.observe(line)
    return () => observer.disconnect()
  }, [text])

  return (
    <span ref={viewport} className="pi-marquee" data-overflow={overflow || undefined} title={text}>
      <span className="pi-marquee-track">
        <span ref={first} className="pi-marquee-segment">
          {text}
        </span>
        <span className="pi-marquee-segment pi-marquee-copy" aria-hidden="true">
          {text}
        </span>
      </span>
    </span>
  )
}
