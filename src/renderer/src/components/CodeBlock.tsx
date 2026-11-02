import { useEffect, useState, type ReactNode } from 'react'
import type { HighlighterCore } from 'shiki/core'
import { IconCheck, IconChevronDown, IconChevronRight, IconStop } from './icons'

const LANGS = ['ts', 'tsx', 'js', 'jsx', 'json', 'bash', 'python', 'css', 'html', 'md', 'sql', 'go', 'rust']
let hl: Promise<HighlighterCore> | null = null
function highlighter(): Promise<HighlighterCore> {
  hl ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, ...mods] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
      ...LANGS.map((l) => import(`shiki/langs/${l}.mjs`))
    ])
    return createHighlighterCore({
      themes: [mods[0].default, mods[1].default],
      langs: mods.slice(2).map((m) => m.default),
      engine: createJavaScriptRegexEngine()
    })
  })()
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
        const norm = LANGS.includes(lang) ? lang : 'text'
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
    <figure className="my-4 overflow-hidden rounded-[10px] border border-line">
      <figcaption className="flex items-center justify-between border-b border-line bg-sunken px-3 py-1.5 text-[11px] text-muted">
        <span className="font-mono">{lang}</span>
      </figcaption>
      {html ? (
        <div className="overflow-x-auto px-3.5 py-3 text-[12.5px] leading-[1.7]" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12.5px] leading-[1.7]">{code}</pre>
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
        className="flex w-full items-center gap-1.5 text-left text-[13px] text-muted transition-colors hover:text-fg"
      >
        {open ? <IconChevronDown className="shrink-0" /> : <IconChevronRight className="shrink-0" />}
        {summary}
      </button>
      {open && <div className="pt-1.5 pl-[22px]">{children}</div>}
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
