import { memo, useEffect, useRef, useState } from 'react'
import { DisclosureRow } from '../primitives/DisclosureRow'
import { TextShimmer } from '../primitives/TextShimmer'
import { IconThinkOutlineRegular } from '../icons'
import { zh } from '../i18n/zh'
import { formatDuration } from '../lib/format'
import type { ThinkingBlock } from '../reducer/types'

/** 最新「已完成段落」的首行；流式时摘要随段落推进，而不是停在开头。 */
function latestCompletedParagraphFirstLine(text: string): string {
  let summary = ''
  let paragraphStart = 0
  const separator = /\r?\n(?:[\t ]*\r?\n)+/g
  while (true) {
    const next = separator.exec(text)
    const paragraphEnd = next === null ? text.length : next.index + next[0].indexOf('\n')
    const newline = text.indexOf('\n', paragraphStart)
    if (newline !== -1 && newline <= paragraphEnd) {
      const candidate = text.slice(paragraphStart, newline).trim()
      if (candidate !== '') summary = candidate
    }
    if (next === null) return summary
    paragraphStart = next.index + next[0].length
  }
}

/** 一行思考：默认收起；流式时摘要取最新完成段落的首行，展开后才贴底跟随。 */
export const ThinkingRow = memo(function ThinkingRow({ block }: { block: ThinkingBlock }) {
  const [open, setOpen] = useState(false)
  const [fadeTop, setFadeTop] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const { streaming } = block

  // 展开时直接贴底；之后只有读者本来就在底部时才继续跟随后续增量。
  useEffect(() => {
    if (!open) return
    stick.current = true
    const body = bodyRef.current
    if (body !== null) body.scrollTop = body.scrollHeight
  }, [open])

  useEffect(() => {
    if (!open || !streaming) return
    const body = bodyRef.current
    if (body !== null && stick.current) body.scrollTop = body.scrollHeight
  }, [open, streaming, block.text])

  const handleScroll = () => {
    const body = bodyRef.current
    if (body === null) return
    stick.current = body.scrollHeight - body.scrollTop - body.clientHeight <= 12
    setFadeTop(body.scrollTop > 1)
  }

  const firstLine = block.text.split('\n').map(line => line.trim()).find(Boolean) ?? ''
  const summary = streaming ? latestCompletedParagraphFirstLine(block.text) : firstLine
  const title = streaming ? zh.block.thinking : zh.block.thoughtFor(formatDuration(block.durationMs))

  return (
    <div className="thinking">
      <DisclosureRow
        icon={<IconThinkOutlineRegular size={14} />}
        title={title}
        open={open}
        expandable={block.text !== ''}
        expandOnRowClick
        onToggle={() => setOpen(value => !value)}
        running={streaming}
        collapsedContent={summary !== '' ? <span className="toolSummary">{summary}</span> : null}
      >
        <div
          className="thinkingBody"
          ref={bodyRef}
          data-fade={streaming || undefined}
          data-fade-top={fadeTop || undefined}
          onScroll={handleScroll}
        >
          {block.text}
        </div>
      </DisclosureRow>
    </div>
  )
})

/** 折叠态单行摘要的独立版本，Gallery 用。 */
export function ThinkingCollapsed({ text, streaming, durationMs }: { text: string; streaming: boolean; durationMs?: number }) {
  const line = text.split('\n').map(s => s.trim()).find(Boolean) ?? ''
  return (
    <DisclosureRow
      icon={<IconThinkOutlineRegular size={14} />}
      title={streaming ? zh.block.thinking : zh.block.thoughtFor(formatDuration(durationMs))}
      open={false}
      expandable={false}
      onToggle={() => undefined}
      running={streaming}
      collapsedContent={<TextShimmer active={streaming} className="toolSummary">{line}</TextShimmer>}
    />
  )
}
