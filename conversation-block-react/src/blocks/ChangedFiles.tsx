import { memo, useRef, useState } from 'react'
import { FileTypeIcon } from '../icons/file-types/FileTypeIcon'
import { IconChevronDownOutlineRegular, IconChevronUpOutlineRegular } from '../icons'
import { zh } from '../i18n/zh'
import { HoverPreview } from '../primitives/HoverPreview'
import type { ConversationState, ToolBlock, Turn } from '../reducer/types'
import { parseDiff, variantOf, type DiffLine } from './toolModel'

export interface ChangedFile {
  readonly path: string
  readonly added: number
  readonly removed: number
  /** 该文件本回合所有修改的 diff 行（多次修改之间以省略行分隔），悬停预览用。 */
  readonly lines: readonly DiffLine[]
}

const COLLAPSED_ROWS = 4
const PREVIEW_LINE_LIMIT = 500
const PATH_KEYS = ['path', 'file_path', 'filePath', 'target', 'filename'] as const

function pathOf(block: ToolBlock): string | undefined {
  const args = block.args
  if (args === undefined || args === null || typeof args !== 'object') return undefined
  for (const key of PATH_KEYS) {
    const value = (args as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return undefined
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

/** 一轮里成功 edit/write 的文件、增删行数与 diff 行；同一文件多次修改累加。 */
export function turnChanges(turn: Turn, state: ConversationState): readonly ChangedFile[] {
  const files = new Map<string, ChangedFile>()
  for (const id of turn.blockIds) {
    const block = state.blocks[id]
    if (block === undefined || block.kind !== 'tool' || block.state !== 'ok') continue
    const variant = variantOf(block.name)
    if (variant !== 'edit' && variant !== 'write') continue
    const path = pathOf(block)
    if (path === undefined) continue
    const diff = parseDiff((block.details as { diff?: unknown } | undefined)?.diff)
    let added = diff.added
    let removed = diff.removed
    let lines: readonly DiffLine[] = diff.lines
    if (added === 0 && removed === 0 && variant === 'write') {
      // pi 的 write 没有 diff，用写入内容近似「新增」，每行都按新增渲染。
      const content = typeof block.args === 'object' && block.args !== null
        ? (block.args as Record<string, unknown>).content
        : undefined
      if (typeof content === 'string' && content !== '') {
        const contentLines = content.split('\n')
        added = contentLines.length
        lines = contentLines.map((text, index) => ({ kind: 'add', number: index + 1, text }))
      }
    }
    if (added === 0 && removed === 0) continue
    const previous = files.get(path)
    files.set(path, {
      path,
      added: (previous?.added ?? 0) + added,
      removed: (previous?.removed ?? 0) + removed,
      lines: previous === undefined ? lines : [...previous.lines, { kind: 'gap', text: '⋯' }, ...lines],
    })
  }
  const deleted = deletedPaths(turn, state, files)
  return [...files.values()].filter(file => !deleted.has(file.path))
}

/** 同一回合里被命令删掉的文件（如临时脚本），不计入收尾改动。 */
function deletedPaths(turn: Turn, state: ConversationState, files: ReadonlyMap<string, ChangedFile>): Set<string> {
  const deleted = new Set<string>()
  for (const id of turn.blockIds) {
    const block = state.blocks[id]
    if (block === undefined || block.kind !== 'tool' || block.state !== 'ok') continue
    if (variantOf(block.name) !== 'bash') continue
    const args = block.args
    if (args === undefined || args === null || typeof args !== 'object') continue
    const command = (args as Record<string, unknown>).command ?? (args as Record<string, unknown>).cmd
    if (typeof command !== 'string' || !/(remove-item|rm|del|unlink)/i.test(command)) continue
    for (const path of files.keys()) {
      if (command.includes(path) || command.includes(basename(path))) deleted.add(path)
    }
  }
  return deleted
}

function Counts({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="changesCounts">
      <span className="diffAdd">+{added}</span>
      <span className="diffDel">−{removed}</span>
    </span>
  )
}

/** 悬停预览的内容：完整路径加该文件的 diff 行，超长时截断。 */
function ChangesPreview({ file }: { file: ChangedFile }) {
  const truncated = file.lines.length > PREVIEW_LINE_LIMIT
  const lines = truncated ? file.lines.slice(0, PREVIEW_LINE_LIMIT) : file.lines
  return (
    <div className="changesPreview" data-changes-preview="">
      <div className="changesPreviewHead">
        <span className="changesPreviewPath">{file.path}</span>
      </div>
      <div className="changesPreviewBody">
        {lines.length === 0 && <p className="changesPreviewNote">{zh.changes.noDiff}</p>}
        {lines.map((line, index) => (
          <div className="diffLine" data-kind={line.kind} key={index}>
            <span className="diffNum">{line.number ?? ''}</span>
            <span className="diffMarker">
              {line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : line.kind === 'gap' ? '' : ' '}
            </span>
            <span className="diffText">{line.text}</span>
          </div>
        ))}
        {truncated && <p className="changesPreviewNote">{zh.changes.truncated(PREVIEW_LINE_LIMIT)}</p>}
      </div>
    </div>
  )
}

/**
 * 回合收尾的文件改动卡片：单文件只留标题行（悬停预览该文件 diff），
 * 多文件按行列出路径与增删（每行悬停预览对应文件 diff）。
 * 与 harness 的 ui-deliverables ChangedFiles 同构，数据从 edit/write 块现算。
 */
export const ChangedFiles = memo(function ChangedFiles({
  turn,
  state,
}: {
  turn: Turn
  state: ConversationState
}) {
  const files = turnChanges(turn, state)
  const [expanded, setExpanded] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  if (files.length === 0) return null

  const single = files.length === 1 ? files[0] : undefined
  const added = files.reduce((sum, file) => sum + file.added, 0)
  const removed = files.reduce((sum, file) => sum + file.removed, 0)
  const foldable = files.length > COLLAPSED_ROWS
  const rows = foldable && !expanded ? files.slice(0, COLLAPSED_ROWS) : files

  const titleBlock = (
    <div className="changesHead">
      <span className="changesTile" aria-hidden="true">
        {single !== undefined
          ? <FileTypeIcon path={single.path} size={20} />
          : <FileTypeIcon kind="code" size={20} />}
      </span>
      <span className="changesTitles">
        <span className="changesTitle">
          {single !== undefined ? zh.changes.single(basename(single.path)) : zh.changes.title(files.length)}
        </span>
        <Counts added={added} removed={removed} />
      </span>
    </div>
  )

  return (
    <section ref={sectionRef} className="changes" data-single={single !== undefined || undefined}>
      {single !== undefined
        ? <HoverPreview widthRef={sectionRef} anchor={titleBlock} content={<ChangesPreview file={single} />} />
        : titleBlock}

      {single === undefined && (
        <ul className="changesList">
          {rows.map(file => (
            <li key={file.path}>
              <HoverPreview
                widthRef={sectionRef}
                anchor={
                  <div className="changesRow">
                    <span className="changesPath" title={file.path}>
                      {file.path}
                    </span>
                    <Counts added={file.added} removed={file.removed} />
                  </div>
                }
                content={<ChangesPreview file={file} />}
              />
            </li>
          ))}
        </ul>
      )}

      {foldable && (
        <button
          type="button"
          className="changesToggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
        >
          <span>{expanded ? zh.changes.collapse : zh.changes.all(files.length)}</span>
          {expanded ? <IconChevronUpOutlineRegular size={14} /> : <IconChevronDownOutlineRegular size={14} />}
        </button>
      )}
    </section>
  )
})
