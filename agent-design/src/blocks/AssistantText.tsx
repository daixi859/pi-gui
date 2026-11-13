import { memo, type ReactNode } from 'react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { zh } from '../i18n/zh'
import type { AssistantBlock } from '../reducer/types'

/**
 * 渲染一段 Markdown。默认用 react-markdown + gfm；
 * 宿主可以注入自己的实现（代码高亮、链接拦截等），块本身不关心解析细节。
 * 第二个参数是该段文本是否还在流式追加：宿主靠它跳过流式期的高亮等昂贵处理。
 */
export type MarkdownRenderer = (text: string, streaming: boolean) => ReactNode

export const defaultRenderMarkdown: MarkdownRenderer = text => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: props => <a {...props} target="_blank" rel="noreferrer" />,
    }}
  >
    {text}
  </ReactMarkdown>
)

/**
 * 助手文本。流式期间照常渲染 markdown（不完整语法由解析器兜底），
 * 光标用 CSS 挂在最后一个块级元素尾部，避免多出一个空行。
 */
export const AssistantText = memo(function AssistantText({
  block,
  renderMarkdown = defaultRenderMarkdown,
}: {
  block: AssistantBlock
  /** 调用方注入的 Markdown 渲染器；不传就用包自带的实现。 */
  renderMarkdown?: MarkdownRenderer
}) {
  const streaming = block.status === 'running'
  return (
    <div className="blockAssistant">
      <div className={clsx('assistant', 'md')} data-final={block.final || undefined} data-streaming={streaming || undefined}>
        {renderMarkdown(block.text, streaming)}
      </div>
      {block.status === 'interrupted' && <div className="assistantFoot">{zh.block.interrupted}</div>}
    </div>
  )
})
