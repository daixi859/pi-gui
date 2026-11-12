import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '../ocu/CodeBlock'

/** 助手正文：完成后走 Markdown + OCU CodeBlock；流式输出中走纯文本，避免半截代码栅栏被误解析 */
export function AssistantText({ text, streaming }: { text: string; streaming?: boolean }) {
  if (streaming) {
    return <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{text}</div>
  }
  return (
    <div className="md text-[15px] leading-relaxed break-words select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ className, children }) => {
            const lang = /language-(\w+)/.exec(className ?? '')?.[1]
            if (!lang) return <code>{children}</code>
            return <CodeBlock code={String(children).replace(/\n$/, '')} language={lang} />
          },
          pre: ({ children }) => <>{children}</>
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
