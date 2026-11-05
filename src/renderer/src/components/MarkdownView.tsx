import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'

export function MarkdownView({ text, streaming }: { text: string; streaming?: boolean }): ReactNode {
  return (
    <div className={streaming ? 'md streaming' : 'md'}>
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
    </div>
  )
}
