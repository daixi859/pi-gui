import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronDownOutlineRegular, IconChevronUpOutlineRegular } from '../icons'
import { useFold } from '../lib/useFold'
import { TextShimmer } from '../primitives/TextShimmer'
import type { Block, ConversationState } from '../reducer/types'
import { KIND_ICON } from './kindIcons'
import { SystemRow } from './SystemRow'
import { ThinkingRow } from './ThinkingRow'
import { ToolRow } from './ToolRow'
import { groupActivity, groupDoneTitle, groupLiveTitle, type ProcessGroupView } from './turnGroups'

function renderRow(block: Block) {
  switch (block.kind) {
    case 'thinking':
      return <ThinkingRow block={block} key={block.id} />
    case 'tool':
      return <ToolRow block={block} key={block.id} />
    case 'system':
      return <SystemRow block={block} key={block.id} />
    default:
      return null
  }
}

/**
 * 分组：思考与工具行的容器，assistant 文本之间的过程归为一组。
 * 收起时只显示一行类别摘要（或实时活动），展开后组体限高内滚。
 */
export const ProcessGroup = memo(function ProcessGroup({
  group,
  state,
  scope,
}: {
  group: ProcessGroupView
  state: ConversationState
  scope: string
}) {
  const [open, toggle] = useFold(scope, group.key, false)
  const [edges, setEdges] = useState({ up: false, down: false })
  const bodyRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const closedRef = useRef(group.closed)
  closedRef.current = group.closed
  const rows = group.blockIds.map(id => state.blocks[id]).filter((block): block is Block => block !== undefined)
  const activity = groupActivity(group)
  const title = group.closed ? groupDoneTitle(group) : groupLiveTitle(group)

  const syncEdges = useCallback(() => {
    const body = bodyRef.current
    if (body === null) return
    stick.current = body.scrollHeight - body.scrollTop - body.clientHeight <= 12
    setEdges({
      up: body.scrollTop > 1,
      down: body.scrollTop + body.clientHeight < body.scrollHeight - 1,
    })
  }, [])

  // 运行中的组展开时贴底跟随；落定后从顶部开始读。
  useEffect(() => {
    if (!open) return
    stick.current = !closedRef.current
    const body = bodyRef.current
    if (body !== null) body.scrollTop = closedRef.current ? 0 : body.scrollHeight
    syncEdges()
    body?.addEventListener('scroll', syncEdges, { passive: true })
    window.addEventListener('resize', syncEdges)
    const content = contentRef.current
    const observer = content === null ? null : new ResizeObserver(() => {
      if (!closedRef.current && stick.current && body !== null) body.scrollTop = body.scrollHeight
      syncEdges()
    })
    if (content !== null) observer?.observe(content)
    return () => {
      body?.removeEventListener('scroll', syncEdges)
      window.removeEventListener('resize', syncEdges)
      observer?.disconnect()
    }
  }, [open, syncEdges])

  // 回合落定时停止跟随，但不把已经展开的组弹回顶部。
  useEffect(() => {
    if (group.closed) stick.current = false
  }, [group.closed])

  return (
    <div className="processGroup" data-open={open || undefined} data-has-tools={rows.some(block => block.kind === 'tool') || undefined}>
      <button
        type="button"
        className="groupHead"
        aria-expanded={open}
        data-process-activity={activity}
        onClick={toggle}
      >
        <span className="groupLeading" aria-hidden="true">
          <span className="groupIcon">{KIND_ICON[activity]}</span>
          <span className="groupChevron">
            {open ? <IconChevronUpOutlineRegular /> : <IconChevronDownOutlineRegular />}
          </span>
        </span>
        <TextShimmer active={!group.closed} className="groupTitle">
          {title}
        </TextShimmer>
      </button>

      {open && rows.length > 0 && (
        <div
          className="groupBody"
          ref={bodyRef}
          data-fade-up={edges.up || undefined}
          data-fade-down={edges.down || undefined}
        >
          <div className="groupContent" ref={contentRef}>{rows.map(renderRow)}</div>
        </div>
      )}
    </div>
  )
})
