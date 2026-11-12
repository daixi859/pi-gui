import { memo } from 'react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { zh } from '../i18n/zh'
import type { AssistantBlock } from '../reducer/types'

/**
 * 助手文本。流式期间走 markdown（不完整语法由解析器兜底），
 * 光标用 CSS 挂在最后一个块级元素尾部，避免多出一个空行。
 */
export const AssistantText = memo(function AssistantText({ block }: { block: AssistantBlock }) {
  const streaming = block.status === 'running'
  return (
    <div className="blockAssistant">
      <div className={clsx('assistant', 'md')} data-final={block.final || undefined} data-streaming={streaming || undefined}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: props => <a {...props} target="_blank" rel="noreferrer" />,
          }}
        >
          {block.text}
        </ReactMarkdown>
      </div>
      {block.status === 'interrupted' && <div className="assistantFoot">{zh.block.interrupted}</div>}
    </div>
  )
})
