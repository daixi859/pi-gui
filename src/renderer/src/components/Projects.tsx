import { useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import type { ProjectRow } from '@shared/blocks'
import { MenuItem, MenuPanel, MenuScrim } from './Menu'
import { Button } from './Button'
import { IconChevronDown, IconChevronRight, IconFolder, IconSearch, IconTrash } from './icons'
import { useScrollRail } from '../useScrollRail'

/** 相对时间：和会话列表的口径一致，但这里是明细页，给到「分钟/小时/天」 */
function ago(ms: number): string {
  if (!ms) return '从未使用'
  const mins = Math.floor((Date.now() - ms) / 60_000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return days === 1 ? '昨天' : `${days}天前`
}

const SORTS = [
  { key: 'recent', label: '最近活动' },
  { key: 'name', label: '名称' },
  { key: 'sessions', label: '会话数' }
] as const

type SortKey = (typeof SORTS)[number]['key']

const cell = 'flex h-10 items-center gap-2 px-2'

export interface ProjectsProps {
  rows: ProjectRow[]
  onRemove: (path: string) => void
  onRestore: (path: string) => void
  /** 真删：会话文件一起删，调用方自己弹确认 */
  onDelete: (path: string) => void
}

/** 项目页：所有数据都从会话扫描派生，PiGui 只额外记「哪个项目被软移除」 */
export function Projects({ rows, onRemove, onRestore, onDelete }: ProjectsProps): ReactNode {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [sorting, setSorting] = useState(false)
  const [showRemoved, setShowRemoved] = useState(true)
  const rail = useScrollRail()

  const q = query.trim().toLowerCase()
  const mine = rows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q))
  const live = mine
    .filter((r) => !r.removedAt)
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'sessions') return b.sessionCount - a.sessionCount
      return b.lastActiveAt - a.lastActiveAt
    })
  const gone = mine.filter((r) => r.removedAt).sort((a, b) => (b.removedAt ?? 0) - (a.removedAt ?? 0))

  const confirmDelete = (r: ProjectRow): void => {
    const extra = r.sessionCount > 0 ? `它下面的 ${r.sessionCount} 个会话文件会被永久删除，` : ''
    if (window.confirm(`删除项目「${r.name}」？${extra}此操作不可撤销。`)) onDelete(r.path)
  }

  return (
    <div className="rail-scroll h-full overflow-y-auto" {...rail}>
      <div className="pi-page">
        <div className="mb-4 flex items-center gap-2 pt-4">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索项目名或路径"
              className="pi-input w-full pl-7"
            />
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              aria-expanded={sorting}
              onClick={() => setSorting((v) => !v)}
              className="flex h-8 items-center gap-1 rounded-sm border border-edge px-2 text-sm text-muted hover:text-fg"
            >
              {SORTS.find((s) => s.key === sort)?.label}
              <IconChevronDown className="size-3" />
            </button>
            {sorting && (
              <>
                <MenuScrim onClose={() => setSorting(false)} />
                <MenuPanel className="top-full right-0 mt-1 w-[132px]">
                  {SORTS.map((s) => (
                    <MenuItem
                      key={s.key}
                      label={s.label}
                      selected={sort === s.key}
                      onClick={() => {
                        setSort(s.key)
                        setSorting(false)
                      }}
                    />
                  ))}
                </MenuPanel>
              </>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-edge">
          <div className="flex h-8 items-center border-b border-edge bg-sunken text-xs text-muted">
            <div className={clsx(cell, 'min-w-0 flex-1')}>项目</div>
            <div className={clsx(cell, 'w-20 justify-end')}>会话</div>
            <div className={clsx(cell, 'w-28 justify-end')}>最近活动</div>
            <div className="w-16 shrink-0" />
          </div>
          {live.length === 0 && <p className="px-2 py-6 text-center text-xs text-faint">没有匹配的项目</p>}
          {live.map((r) => (
            <ProjectLine key={r.path} row={r} onRemove={() => onRemove(r.path)} />
          ))}
        </div>

        {gone.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              aria-expanded={showRemoved}
              onClick={() => setShowRemoved((v) => !v)}
              className="flex h-8 w-full items-center gap-1 text-sm text-muted hover:text-fg"
            >
              {showRemoved ? <IconChevronDown className="size-3" /> : <IconChevronRight className="size-3" />}
              已移除的项目
              <span className="ml-auto text-xs text-faint">{gone.length} 个项目</span>
            </button>
            {showRemoved && (
              <div className="overflow-hidden rounded-md border border-edge">
                {gone.map((r) => (
                  <div
                    key={r.path}
                    className="flex h-12 items-center gap-2 border-b border-edge px-2 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-muted">{r.name}</div>
                      <div className="truncate text-xs text-faint">{r.path}</div>
                    </div>
                    <span className="shrink-0 text-xs text-faint">{ago(r.removedAt ?? 0)}移除</span>
                    <button
                      type="button"
                      onClick={() => onRestore(r.path)}
                      className="flex h-7 shrink-0 items-center rounded-sm border border-edge px-2 text-xs text-muted hover:text-fg"
                    >
                      恢复
                    </button>
                    <Button
                      aria-label="删除项目"
                      title="连同会话文件一起删除"
                      variant="ghost"
                      size="sm"
                      className="text-del"
                      onClick={() => confirmDelete(r)}
                      icon={<IconTrash />}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectLine({ row, onRemove }: { row: ProjectRow; onRemove: () => void }): ReactNode {
  return (
    <div className="group flex h-12 items-center border-b border-edge last:border-b-0 hover:bg-select/40">
      <div className={clsx(cell, 'min-w-0 flex-1 text-left')}>
        <IconFolder className="size-4 shrink-0 text-muted" />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm">{row.name}</span>
            {row.sessionCount === 0 && (
              <span className="shrink-0 rounded-sm bg-sunken px-1 text-2xs text-faint">没有会话</span>
            )}
          </span>
          <span className="block truncate text-xs text-faint">{row.path}</span>
        </span>
      </div>
      <div className={clsx(cell, 'w-20 justify-end text-sm text-muted')}>{row.sessionCount}</div>
      <div className={clsx(cell, 'w-28 justify-end text-xs text-muted')}>{ago(row.lastActiveAt)}</div>
      {/* 未移除的项目只给一个移除动作；真删只在已移除区里露出 */}
      <div className="flex w-16 shrink-0 justify-end pr-2">
        <button
          type="button"
          onClick={onRemove}
          className="h-7 rounded-sm px-2 text-xs text-muted opacity-0 transition-colors group-hover:opacity-100 hover:bg-sunken hover:text-fg focus-visible:opacity-100"
        >
          移除
        </button>
      </div>
    </div>
  )
}
