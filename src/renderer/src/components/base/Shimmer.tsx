import type { ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * 运行中文字的一次扫光（照 deepseek-harness 的 TextShimmer）：真实文字留在基础层，
 * 之上叠一份 inert 的装饰副本，由移动的遮罩扫出亮带；两层用相反的 translateX 抵消，
 * 字形位置不动。结构常驻、只切装饰层有无，落定时不会重挂载（避免文本跳动）。
 * 只包文字与插槽内容，不要套在可点的整行上；装饰层 aria-hidden，读屏只读基础层。
 */
export function Shimmer({
  active = false,
  className,
  contentClassName,
  children
}: {
  active?: boolean
  className?: string
  /** 基础层与装饰副本共用的布局类，保证两层字形对齐 */
  contentClassName?: string
  children: ReactNode
}): ReactNode {
  return (
    <span className={clsx('pi-shimmer', className)} data-shimmer={active || undefined}>
      <span className={clsx('pi-shimmer-content', contentClassName)}>{children}</span>
      {active ? (
        <span className="pi-shimmer-decoration" aria-hidden="true" inert>
          <span className="pi-sweep">
            <span className={clsx('pi-sweep-copy', contentClassName)}>{children}</span>
          </span>
        </span>
      ) : null}
    </span>
  )
}
