import { useEffect, useState, type ReactNode } from 'react'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'
import bash from 'shiki/langs/bash.mjs'
import css from 'shiki/langs/css.mjs'
import go from 'shiki/langs/go.mjs'
import html from 'shiki/langs/html.mjs'
import js from 'shiki/langs/js.mjs'
import json from 'shiki/langs/json.mjs'
import jsx from 'shiki/langs/jsx.mjs'
import md from 'shiki/langs/md.mjs'
import python from 'shiki/langs/python.mjs'
import rust from 'shiki/langs/rust.mjs'
import sql from 'shiki/langs/sql.mjs'
import ts from 'shiki/langs/ts.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import { IconCheck, IconChevronDown, IconChevronRight, IconStop } from './icons'

/** 语法包写死成静态 import：模板字符串的动态 import Vite 分析不了，打包后根本加载不到 */
const LANGS = { ts, tsx, js, jsx, json, bash, python, css, html, md, sql, go, rust }
let hl: Promise<HighlighterCore> | null = null
function highlighter(): Promise<HighlighterCore> {
  hl ??= createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: Object.values(LANGS).flat(),
    engine: createJavaScriptRegexEngine()
  })
  return hl
}

const cache = new Map<string, string>()

/** shiki 双主题：输出 --shiki-light / --shiki-dark 变量，配色由 .shiki 的 CSS 决定 */
export function CodeBlock({ code, lang }: { code: string; lang: string }): ReactNode {
  const key = `${lang}\u0000${code}`
  const [html, setHtml] = useState<string | null>(cache.get(key) ?? null)

  useEffect(() => {
    if (html !== null) return
    let alive = true
    void highlighter()
      .then((h) => {
        const norm = lang in LANGS ? lang : 'text'
        const out = h.codeToHtml(code, {
          lang: norm,
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false
        })
        cache.set(key, out)
        if (alive) setHtml(out)
      })
      .catch(() => alive && setHtml(null))
    return () => {
      alive = false
    }
  }, [html, key, lang, code])

  return (
    <figure className="my-4 overflow-hidden rounded-md border border-edge">
      <figcaption className="flex items-center justify-between border-b border-edge bg-sunken px-2 py-1 text-xs text-muted">
        <span className="font-mono">{lang}</span>
      </figcaption>
      {html ? (
        <div className="overflow-x-auto px-4 py-2 text-xs leading-[1.7]" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="overflow-x-auto px-4 py-2 font-mono text-xs leading-[1.7]">{code}</pre>
      )}
    </figure>
  )
}

export function Disclosure({
  open,
  onToggle,
  children,
  summary,
  className = ''
}: {
  open: boolean
  onToggle: () => void
  children: ReactNode
  summary: ReactNode
  className?: string
}): ReactNode {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 text-left text-xs text-muted transition-colors hover:text-fg"
      >
        {open ? <IconChevronDown className="shrink-0" /> : <IconChevronRight className="shrink-0" />}
        {summary}
      </button>
      {open && <div className="pt-1 pl-4">{children}</div>}
    </div>
  )
}

export function StateDot({ state }: { state: 'running' | 'done' | 'error' }): ReactNode {
  if (state === 'running')
    return (
      <span className="relative flex size-3 shrink-0 items-center justify-center">
        <span className="absolute size-3 animate-ping rounded-full bg-fg/10" />
        <span className="size-1.5 rounded-full bg-fg" />
      </span>
    )
  if (state === 'error') return <span className="size-1.5 shrink-0 rounded-full bg-del" />
  return <IconCheck className="size-3 shrink-0 text-add" />
}

export { IconStop }
