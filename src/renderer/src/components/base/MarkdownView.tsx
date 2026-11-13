import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'

/**
 * 宿主注入给对话块的 Markdown 渲染器（ADR-0018）：代码走 shiki 高亮、外链走系统浏览器。
 * 只管解析与高亮，不套外层排版——排版与流式光标由对话块自己的 `.md` / `data-streaming` 负责。
 */
export function MarkdownView({ text, streaming }: { text: string; streaming?: boolean }): ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: ({ className, children }) => {
          const lang = /language-(\w+)/.exec(className ?? '')?.[1]
          if (!lang) return <code>{children}</code>
          return <CodeBlock code={String(children).replace(/\n$/, '')} lang={lang} streaming={streaming} />
        },
        pre: ({ children }) => <>{children}</>,
        // 链接走系统默认浏览器；相对链接不拦（主进程只放行 http/https）
        a: ({ href, children }) => (
          <a
            href={href}
            onClick={(e) => {
              if (!href || !/^https?:\/\//.test(href)) return
              e.preventDefault()
              window.pi?.host.openExternal(href)
            }}
          >
            {children}
          </a>
        )
      }}
    >
      {text}
    </ReactMarkdown>
  )
}
