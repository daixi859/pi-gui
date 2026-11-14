import { useEffect, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
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
import styles from './CodeBlock.module.css'

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

/** shiki 双主题：输出 --shiki-light / --shiki-dark 变量，配色由 .shiki 的 CSS 决定。
 * 流式中先渲染纯文本：半截代码每帧都要重新着色，是单条消息里最贵的一步 */
export function CodeBlock({
  code,
  lang,
  streaming
}: {
  code: string
  lang: string
  streaming?: boolean
}): ReactNode {
  const key = `${lang}\u0000${code}`
  const [html, setHtml] = useState<string | null>(cache.get(key) ?? null)

  useEffect(() => {
    if (streaming || html !== null) return
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
  }, [html, key, lang, code, streaming])

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className={styles.lang}>{lang}</span>
      </figcaption>
      {html && !streaming ? (
        <div className={styles.code} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className={clsx(styles.code, styles.pre)}>{code}</pre>
      )}
    </figure>
  )
}
