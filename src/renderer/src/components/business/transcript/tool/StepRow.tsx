import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { clsx } from 'clsx'
import type { ToolState } from '@shared/blocks'
import { IconChevronDown, IconChevronUp } from '../../../base/icons'
import { Shimmer } from '../../../base/Shimmer'

export type Ico = ComponentType<SVGProps<SVGSVGElement>>

export interface StepProps {
  icon: Ico
  /** 中文动词，如「阅读」「执行」 */
  label: string
  /** 「 · 」之后的特色文案，截断显示；运行中改用 live（缺省「进行中…」） */
  detail?: string
  /** 运行中替代 detail 的文案，如思考的已完成段落首行；空串表示暂时没有可显示的一行 */
  live?: string
  /** 路径、命令走等宽 */
  mono?: boolean
  /** 插槽：摘要后面紧跟的内容，如 +3 −1、行数、耗时 */
  extra?: ReactNode
  state?: ToolState
  /** 悬停显示完整文案 */
  title?: string
  /** 流式文本：超宽时右端渐隐而不是省略号（只有思考摘要是「还在写」的文字） */
  streamSummary?: boolean
  /** 展开后是否保留摘要：思考展开后留摘要没有意义，工具行保留（照 deepseek-harness） */
  keepSummaryWhenOpen?: boolean
  /** 展开后把行头钉在顶部，长正文里收不起来时还能点到（照 deepseek-harness） */
  stickyHeader?: boolean
  /** 插槽：展开体。有内容才可展开（undefined = 不可展开） */
  children?: ReactNode
}

/**
 * 回合里的一行摘要：图标 + 「动词 · 特色」+ 紧跟的 extra 插槽。
 * 扫光覆盖整条行头（动词、分隔圆点、摘要、extra），照 deepseek-harness 的 DisclosureRow：
 * 分隔点是 2×2 的实心点而不是拼在字符串里的「 · 」，装饰层里跟着亮带走。
 * 可展开行的图标：收起时悬停变 ↓，展开后固定为 ↑；不可展开的行始终显示工具图标。
 */
export function StepRow({
  icon: Icon,
  label,
  detail,
  live,
  mono,
  extra,
  state,
  title,
  streamSummary = false,
  keepSummaryWhenOpen = true,
  stickyHeader = false,
  children
}: StepProps): ReactNode {
  const [open, setOpen] = useState(false)
  const expandable = children !== undefined
  const running = state === 'running'
  // live 传了空串 = 明确「现在没有一行可说」（思考还没写完一段），不回退到兜底文案
  const tail = running ? (live !== undefined ? live : '进行中…') : detail
  const showTail = tail !== undefined && tail !== '' && (keepSummaryWhenOpen || !open)

  const lead = !expandable ? (
    <Icon className="size-4 text-faint" />
  ) : open ? (
    <IconChevronUp className="size-4 text-faint" />
  ) : (
    <>
      <Icon className="size-4 text-faint group-hover:hidden" />
      <IconChevronDown className="hidden size-4 text-faint group-hover:block" />
    </>
  )

  const head = (
    <>
      <span title={title} className="flex shrink-0">
        {lead}
      </span>
      {/* 整条行头共用一次流转（照 deepseek-harness 的 DisclosureRow）：标题、分隔点、摘要、extra 一起扫，
          内层不再各自起动画。外壳按内容宽（pi-shimmer 的 max-content + max-w-full），
          文字短时亮带只扫过文字本身，长时收到可用宽度里 */}
      <Shimmer
        active={running}
        className={clsx('min-w-0 text-xs', state === 'error' ? 'text-del' : 'text-muted')}
      >
        <span className="shrink-0">{label}</span>
        {showTail ? (
          <>
            <span
              aria-hidden="true"
              data-shimmer-decoration
              className="mx-2 size-0.5 shrink-0 rounded-pill bg-faint"
            />
            <span
              className={clsx(
                'min-w-0 flex-1 overflow-hidden whitespace-nowrap',
                mono && !running && 'font-mono',
                // 流式中不做省略号，交给右端渐隐：文字还在写，末尾不该被读成「说完了」。
                // 渐隐加在摘要盒子上，装饰副本里的同一个盒子也一起被裁（两层的摘要布局一致）
                running && streamSummary ? 'pi-fade-end text-clip' : 'text-ellipsis'
              )}
            >
              {tail}
            </span>
          </>
        ) : null}
        {extra ? <span className="ml-2 flex shrink-0 items-center gap-2">{extra}</span> : null}
      </Shimmer>
      {running ? <span className="sr-only">进行中</span> : null}
      {state === 'error' ? <span className="sr-only">已失败</span> : null}
    </>
  )

  if (!expandable) {
    return <div className="flex h-7 items-center gap-2 px-1">{head}</div>
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'group flex h-7 w-full items-center gap-2 rounded-sm px-1 text-left transition-colors hover:bg-sunken',
          open && stickyHeader && 'pi-sticky-head'
        )}
        aria-expanded={open}
      >
        {head}
      </button>
      {open ? <div className="mt-1">{children}</div> : null}
    </div>
  )
}
