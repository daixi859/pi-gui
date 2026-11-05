import { useEffect, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import type { DiffLine } from '@shared/blocks'

/** 展开体的四种形态：纯输出、文件预览、终端、diff。都按数据类型复用，与工具名无关 */

export function Output({ text }: { text: string }): ReactNode {
  return (
    <pre className="max-h-64 overflow-auto rounded-md border border-edge px-2 py-1 font-mono text-xs leading-code whitespace-pre-wrap text-muted">
      {text}
    </pre>
  )
}

/** 点开才读盘：行号 + 前 200 行，超长给提示。读不到就直说 */
export function FilePeek({ path }: { path: string }): ReactNode {
  const [file, setFile] = useState<{ text: string; truncated: boolean } | null | 'loading'>('loading')

  useEffect(() => {
    let alive = true
    void window.pi.host.readText(path).then((r) => {
      if (alive) setFile(r)
    })
    return () => {
      alive = false
    }
  }, [path])

  if (file === 'loading') return <div className="px-1 py-1 text-xs text-muted">读取中…</div>
  if (!file) return <div className="px-1 py-1 text-xs text-muted">读不到这个文件</div>

  const lines = file.text.replace(/\r\n/g, '\n').split('\n')
  const shown = lines.slice(0, 200)
  const rest = lines.length - shown.length
  return (
    <div className="max-h-80 overflow-y-auto rounded-md border border-edge py-1 font-mono text-xs leading-code text-muted">
      {shown.map((l, i) => (
        <div key={i} className="flex gap-2 px-2">
          <span className="w-8 shrink-0 text-right text-faint tabular-nums select-none">{i + 1}</span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{l || ' '}</span>
        </div>
      ))}
      {rest > 0 || file.truncated ? (
        <div className="px-2 py-1 text-faint">
          {rest > 0 ? `… 还有 ${rest} 行` : ''}
          {file.truncated ? '（文件超过 512KB，只读了前一段）' : ''}
        </div>
      ) : null}
    </div>
  )
}

/** 终端：命令一行 + 输出，长命令在行内截断，卡片里给全文 */
export function TerminalBody({ cmd, out }: { cmd: string; out?: string }): ReactNode {
  return (
    <div className="overflow-hidden rounded-md border border-edge text-muted">
      <div className="flex gap-2 px-2 py-1 font-mono text-xs">
        <span className="shrink-0 select-none text-faint">$</span>
        <span className="break-all whitespace-pre-wrap">{cmd}</span>
      </div>
      {out ? (
        <pre className="max-h-64 overflow-auto border-t border-edge px-2 py-1 font-mono text-xs leading-code whitespace-pre-wrap text-muted">
          {out}
        </pre>
      ) : null}
    </div>
  )
}

export function DiffLines({ lines }: { lines: DiffLine[] }): ReactNode {
  const shown = lines.length > 200 ? lines.slice(0, 200) : lines
  return (
    <div className="max-h-64 overflow-y-auto rounded-md border border-edge py-1 font-mono text-xs leading-code text-muted">
      {shown.map((l, i) => (
        <div
          key={i}
          className={clsx(
            'flex gap-2 px-2',
            l.type === 'add' ? 'bg-success-1' : l.type === 'del' ? 'bg-danger-1' : ''
          )}
        >
          <span className="w-6 shrink-0 text-right text-faint tabular-nums select-none">{l.no ?? ''}</span>
          <span
            className={clsx(
              'w-2 shrink-0 select-none',
              l.type === 'add' ? 'text-add' : l.type === 'del' ? 'text-del' : 'text-transparent'
            )}
          >
            {l.type === 'add' ? '+' : l.type === 'del' ? '−' : '.'}
          </span>
          <span className={clsx('min-w-0 flex-1 whitespace-pre-wrap break-all', l.type === 'del' && 'text-del')}>
            {l.text}
          </span>
        </div>
      ))}
      {lines.length > shown.length ? (
        <div className="px-2 py-1 text-faint">… 还有 {lines.length - shown.length} 行</div>
      ) : null}
    </div>
  )
}
