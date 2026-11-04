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
          pre: ({ children }) => <>{children}</>
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
