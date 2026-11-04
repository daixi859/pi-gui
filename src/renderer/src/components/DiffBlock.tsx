import { useState, type ReactNode } from 'react'
import type { DiffLine } from '@shared/blocks'
import { IconChevronDown, IconChevronRight, IconUndo } from './icons'

export function DiffBlock({
  file,
  added,
  removed,
  lines,
  patch
}: {
  file: string
  added: number
  removed: number
  lines: DiffLine[]
  patch?: string
}): ReactNode {
  const [open, setOpen] = useState(false)
  const [reverting, setReverting] = useState(false)
  const count = lines.length > 0
  const changed = added + removed > 0

  const revert = (): void => {
    if (!patch || reverting) return
    setReverting(true)
    window.pi?.agent.send({ type: 'revertEdit', patch })
    // 引擎会回一条 system 块，这里只负责防连点
    setTimeout(() => setReverting(false), 1200)
  }

  return (
    <div className="rounded-md border border-edge">
      <button
        type="button"
        onClick={() => count && setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left"
      >
        {count ? (
          open ? (
            <IconChevronDown className="text-muted" />
          ) : (
            <IconChevronRight className="text-muted" />
          )
        ) : (
          <span className="w-4" />
        )}
        <span className="text-xs">
          {changed ? '1 个文件已更改' : '暂无差异内容'}
        </span>
        <span className="font-mono text-xs text-add">+{added}</span>
        <span className="font-mono text-xs text-del">-{removed}</span>
        <span
          role={patch ? 'button' : undefined}
          onClick={(e) => {
            if (!patch) return
            e.stopPropagation()
            revert()
          }}
          className={
            'ml-auto flex items-center gap-1 text-xs ' +
            (patch ? 'text-muted hover:text-fg' : 'text-faint')
          }
        >
          <IconUndo className="size-3.5" />
          {reverting ? '撤销中…' : '撤销'}
        </span>
      </button>
      {open && (
        <div className="border-t border-edge">
          <div className="border-b border-edge bg-sunken px-4 py-1 font-mono text-xs text-muted">
            {file}
          </div>
          <div className="max-h-[320px] overflow-auto py-1 font-mono text-xs leading-[1.75]">
            {(lines.length > 300 ? lines.slice(0, 300) : lines).map((l, i) => (
              <div
                key={i}
                className={
                  'flex gap-2 px-4 ' +
                  (l.type === 'add' ? 'bg-success-1' : l.type === 'del' ? 'bg-danger-1' : '')
                }
              >
                <span className="w-8 shrink-0 text-right text-faint select-none">{l.no ?? ''}</span>
                <span
                  className={
                    'w-2 shrink-0 select-none ' +
                    (l.type === 'add' ? 'text-add' : l.type === 'del' ? 'text-del' : 'text-transparent')
                  }
                >
                  {l.type === 'add' ? '+' : l.type === 'del' ? '−' : '.'}
                </span>
                <span className={l.type === 'del' ? 'whitespace-pre-wrap text-del' : 'whitespace-pre-wrap'}>
                  {l.text}
                </span>
              </div>
            ))}
            {lines.length > 300 && (
              <div className="px-4 py-1 text-faint">… 还有 {lines.length - 300} 行
未展开</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
