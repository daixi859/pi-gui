import { useRef, useState, type ReactNode } from 'react'
import type { ProjectMeta, SessionMeta } from '@shared/blocks'
import { PiLogo } from './PiLogo'
import { MenuItem, MenuPanel, MenuScrim } from './Menu'
import {
  IconArrowLeft,
  IconArrowRight,
  IconBlocks,
  IconClock,
  IconChevronDown,
  IconClose,
  IconFilter,
  IconFolder,
  IconFolderOpen,
  IconHelp,
  IconMaximize,
  IconMinimize,
  IconPanelCollapse,
  IconPanelExpand,
  IconPlus,
  IconPlusCircle,
  IconSearch,
  IconSettings,
  IconSliders,
  IconSortList,
  IconSparkle,
  IconSpinner,
} from './icons'

type Nav = (route: 'start' | 'chat' | 'gallery') => void

const navRow =
  'flex h-9 w-full items-center gap-2 rounded-sm px-2 text-sm text-fg transition-colors hover:bg-select/60'

const iconBtn = 'pi-icon-btn'

/** 折叠按钮：展开态显示品牌 logo，hover 变收起图标；收起态显示展开图标。两者垂直/水平位置重合。 */
function CollapseButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }): ReactNode {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
        onClick={onClick}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className={
          'relative grid size-7 place-items-center rounded-sm text-fg transition-colors ' +
          (collapsed ? 'bg-tint-strong' : 'hover:bg-tint-strong')
        }
      >
        {collapsed ? (
          <IconPanelExpand className="size-[18px]" />
        ) : (
          <>
            <PiLogo size={20} className="group-hover:opacity-0" />
            <IconPanelCollapse className="absolute size-[18px] opacity-0 group-hover:opacity-100" />
          </>
        )}
      </button>
      <span className="pointer-events-none absolute top-full mt-1 left-0 z-50 hidden whitespace-nowrap rounded-sm border border-edge bg-panel px-2 py-0.5 text-xs text-muted shadow-pop group-hover:flex">
        {collapsed ? '展开侧栏' : '收起侧栏'}
        <kbd className="ml-2 rounded-sm border border-edge px-1 text-xs text-faint">Ctrl+B</kbd>
      </span>
    </div>
  )
}

const SORTS = [
  { key: 'project', label: '项目', icon: <IconFolder className="size-[15px] text-muted" /> },
  { key: 'group', label: '分组', icon: <span className="w-[15px] text-center text-sm leading-none text-muted">#</span> },
  { key: 'recent', label: '最近更新', icon: <IconClock className="size-[15px] text-muted" /> },
  { key: 'unread', label: '未读', icon: <IconSparkle className="size-[15px] text-muted" /> }
] as const

function SortMenu({
  value,
  onClose,
  onPick
}: {
  value: string
  onClose: () => void
  onPick: (k: string) => void
}): ReactNode {
  return (
    <>
      <MenuScrim onClose={onClose} />
      <MenuPanel className="top-full mt-1 right-4 w-[152px]">
        {SORTS.map((s) => (
          <MenuItem
            key={s.key}
            icon={s.icon}
            label={s.label}
            selected={value === s.key}
            onClick={() => {
              onPick(s.key)
              onClose()
            }}
          />
        ))}
      </MenuPanel>
    </>
  )
}

/** 按时间分桶：今天 / 昨天 / 更早 */
function timeBucket(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return '更早'
}

/** 标题超长时鼠标移入做走马灯，移出复位 */
function Marquee({ text }: { text: string }): ReactNode {
  const box = useRef<HTMLSpanElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  const [over, setOver] = useState(0)
  return (
    <span
      ref={box}
      className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"
      onMouseEnter={() => {
        const o = (inner.current?.scrollWidth ?? 0) - (box.current?.clientWidth ?? 0)
        setOver(Math.max(0, o))
      }}
      onMouseLeave={() => setOver(0)}
    >
      <span
        ref={inner}
        className="inline-block"
        style={
          over
            ? ({
                '--over': `-${over}px`,
                animation: `marquee ${Math.max(3, over / 25)}s linear infinite alternate`
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </span>
  )
}

function navButton(label: string, Ico: typeof IconPlus, hint?: string, onClick?: () => void): ReactNode {
  return (
    <button type="button" className={navRow} onClick={onClick}>
      <Ico className="shrink-0 text-fg/75" />
      <span>{label}</span>
      {hint && <span className="ml-auto text-xs text-faint">{hint}</span>}
    </button>
  )
}

/** 存本地的组件状态：重启、切会话、搜索后折叠状态都还在 */
function useStored<T>(key: string, init: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : init
    } catch {
      return init
    }
  })
  const set = (next: T | ((prev: T) => T)): void =>
    setValue((prev) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* 存不了就只活在本进程 */
      }
      return v
    })
  return [value, set]
}

export interface SidebarProps {
  onCollapse: () => void
  onNavigate: Nav
  projects: ProjectMeta[]
  sessions: SessionMeta[]
  activeId: string | null
  /** 后台跑完、未再打开的会话文件（蓝点） */
  unread: string[]
  onOpenSession: (id: string, path: string) => void
  onNewSession: () => void
  onRename: (path: string, title: string) => void
  onDelete: (path: string) => void
  canBack: boolean
  canForward: boolean
  onBack: () => void
  onForward: () => void
}

export function Sidebar({
  onCollapse,
  onNavigate,
  projects,
  sessions,
  activeId,
  unread,
  onOpenSession,
  onNewSession,
  onRename,
  onDelete,
  canBack,
  canForward,
  onBack,
  onForward
}: SidebarProps): ReactNode {
  const [sorting, setSorting] = useState(false)
  const [sort, setSort] = useState('project')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  /** 每个项目展开后显示多少条，默认 5，点「显示更多」每次 +10 */
  const [limit, setLimit] = useStored<Record<string, number>>('pi.sidebar.limit', {})
  /** 折叠的项目名集合（记住上一次，侧栏收起/重开不丢） */
  const [folded, setFolded] = useStored<Record<string, boolean>>('pi.sidebar.folded', {})

  const q = query.trim().toLowerCase()
  const visible = sessions
    .filter((s) => !q || s.title.toLowerCase().includes(q))
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
  const grouped = projects
    .map((p) => ({ ...p, sessions: visible.filter((s) => s.project === p.name) }))
    .filter((p) => p.sessions.length > 0)
  const rowProps = (s: SessionMeta) => ({
    session: s,
    active: s.id === activeId,
    running: s.running === true,
    unread: unread.includes(s.path),
    onClick: () => onOpenSession(s.id, s.path),
    onRename: (title: string) => onRename(s.path, title),
    onDelete: () => onDelete(s.path)
  })

  return (
    <aside className="flex w-[262px] shrink-0 flex-col overflow-hidden pt-2">
      <div className="flex h-11 shrink-0 items-center gap-1 pl-2 [-webkit-app-region:drag]">
        <CollapseButton collapsed={false} onClick={onCollapse} />
        <button
          type="button"
          aria-label="后退"
          disabled={!canBack}
          onClick={onBack}
          className={iconBtn + ' disabled:opacity-35 disabled:hover:bg-transparent'}
        >
          <IconArrowLeft />
        </button>
        <button
          type="button"
          aria-label="前进"
          disabled={!canForward}
          onClick={onForward}
          className={iconBtn + ' disabled:opacity-35 disabled:hover:bg-transparent'}
        >
          <IconArrowRight />
        </button>
      </div>

      <nav className="px-2 pt-2">
        {navButton('新建任务', IconPlusCircle, 'Ctrl+N', onNewSession)}
        {navButton('组件预览', IconSliders, undefined, () => onNavigate('gallery'))}
        {navButton('插件市场', IconBlocks, undefined, () => window.pi?.host.openAgentConfig())}
      </nav>

      <div className="my-2 border-t border-edge" />

      {/* 固定行高：搜索时「任务列表」标题让位，输入框从左侧边缘铺开，整行高度不变所以列表不位移 */}
      <div className={'relative flex h-9 shrink-0 items-center gap-2 ' + (searching ? 'px-2' : 'px-4')}>
        {searching ? (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setQuery('')
                setSearching(false)
              }
            }}
            onBlur={() => {
              if (!query) setSearching(false)
            }}
            placeholder="搜索任务标题"
            className="pi-input min-w-0 flex-1"
          />
        ) : (
          <>
            <span className="shrink-0 whitespace-nowrap text-sm text-muted">任务列表</span>
            <button
              type="button"
              aria-label="搜索"
              onClick={() => setSearching(true)}
              className="ml-auto shrink-0 text-muted hover:text-fg"
            >
              <IconSearch className="size-[15px]" />
            </button>
          </>
        )}
        <button
          type="button"
          aria-label="筛选"
          aria-expanded={sorting}
          onClick={() => setSorting((v) => !v)}
          className={'shrink-0 text-muted hover:text-fg ' + (sorting ? 'text-fg' : '')}
        >
          <IconFilter className="size-[15px]" />
        </button>
        {sorting && <SortMenu value={sort} onClose={() => setSorting(false)} onPick={setSort} />}
      </div>

      {/* 分组标题行：项目下拉（排序）+ 排序 / 新建 */}
      <div className="flex h-8 shrink-0 items-center gap-1 px-4">
        <button
          type="button"
          aria-label="切换排序"
          aria-expanded={sorting}
          onClick={() => setSorting((v) => !v)}
          className="flex items-center gap-1 text-sm text-faint transition-colors hover:text-muted"
        >
          {SORTS.find((s) => s.key === sort)?.label ?? '项目'}
          <IconChevronDown className="size-3" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="排序" className="text-muted hover:text-fg">
            <IconSortList className="size-[15px]" />
          </button>
          <button type="button" aria-label="新建项目" className="text-muted hover:text-fg">
            <IconPlus className="size-[15px]" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pl-2 pb-2">
        {sort === 'project' &&
          grouped.map((p) => {
            const shown = p.sessions.slice(0, limit[p.name] ?? 5)
            const rest = p.sessions.length - shown.length
            const isFolded = folded[p.name]
            return (
              <div key={p.name}>
                <button
                  type="button"
                  aria-expanded={!isFolded}
                  onClick={() => setFolded((m) => ({ ...m, [p.name]: !m[p.name] }))}
                  className="mb-0.5 flex h-7 w-full items-center gap-1 rounded-sm px-2 text-left text-sm text-muted transition-colors hover:bg-select/60 hover:text-fg"
                >
                  {/* 收起/展开用文件夹开合表示：闭合 = 折叠，翻开 = 展开 */}
                  {isFolded ? (
                    <IconFolder className="size-4 shrink-0" />
                  ) : (
                    <IconFolderOpen className="size-4 shrink-0" />
                  )}
                  <span className="truncate">{p.name || '未分组'}</span>
                </button>
                {!isFolded && shown.map((s) => <SessionRow key={s.id} {...rowProps(s)} />)}
                {!isFolded && rest > 0 && (
                  <button
                    type="button"
                    onClick={() => setLimit((m) => ({ ...m, [p.name]: (m[p.name] ?? 5) + 10 }))}
                    className="mb-0.5 h-7 w-full rounded-sm pl-[30px] text-left text-sm text-muted transition-colors hover:bg-select/60 hover:text-fg"
                  >
                    显示更多{rest > 10 ? `（还有 ${rest} 条）` : ''}
                  </button>
                )}
              </div>
            )
          })}
        {sort === 'group' &&
          ['今天', '昨天', '更早'].map((bucket) => {
            const items = visible.filter((s) => timeBucket(s.modifiedAt) === bucket)
            if (items.length === 0) return null
            return (
              <div key={bucket}>
                <div className="px-2 py-1 text-xs text-faint">{bucket}</div>
                {items.map((s) => (
                  <SessionRow key={s.id} {...rowProps(s)} />
                ))}
              </div>
            )
          })}
        {sort === 'recent' && visible.map((s) => <SessionRow key={s.id} {...rowProps(s)} />)}
        {sort === 'unread' &&
          [...visible]
            .sort((a, b) => Number(unread.includes(b.path)) - Number(unread.includes(a.path)))
            .map((s) => <SessionRow key={s.id} {...rowProps(s)} />)}
      </div>

      <div className="border-t border-edge" />
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fg text-xs font-medium text-white">
          H
        </span>
        <span className="truncate text-sm">hwuscrxo</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="设置"
            onClick={() => window.pi?.host.openAgentConfig()}
            className="text-muted hover:text-fg"
          >
            <IconSettings className="size-[15px]" />
          </button>
        </div>
      </div>
    </aside>
  )
}

interface SessionRowProps {
  session: SessionMeta
  active: boolean
  running: boolean
  unread: boolean
  onClick: () => void
  onRename: (title: string) => void
  onDelete: () => void
}

/** 会话行：左侧状态（运行加载 / 未读蓝点 / 当前高亮图标），右键菜单重命名与删除 */
function SessionRow({ session, active, running, unread, onClick, onRename, onDelete }: SessionRowProps): ReactNode {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.title)

  const commit = (): void => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== session.title) onRename(draft)
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        className={
          // 激活态只换底色/字重，左右内边距与普通行相同，标题不左右跳
          'mb-0.5 flex h-7 w-full items-center gap-2 rounded-sm pr-1 pl-2 text-left text-sm transition-colors ' +
          (active ? 'bg-select font-medium' : 'hover:bg-select/60')
        }
      >
        <span className="grid size-3.5 shrink-0 place-items-center">
          {running ? (
            <IconSpinner className="size-3.5" />
          ) : unread ? (
            <span className="size-1.5 rounded-full bg-link" aria-label="未读" />
          ) : active ? (
            <IconSparkle className="size-3 text-muted" />
          ) : null}
        </span>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                e.preventDefault()
                setEditing(false)
              }
            }}
            onBlur={commit}
            className="min-w-0 flex-1 rounded-sm border border-edge bg-panel px-1 outline-none"
          />
        ) : (
          <Marquee text={session.title} />
        )}
        <span className="ml-auto shrink-0 text-xs text-faint">{session.ageLabel}</span>
      </button>
      {menu && (
        <>
          <MenuScrim onClose={() => setMenu(null)} />
          <div className="fixed z-50" style={{ left: menu.x, top: menu.y }}>
            <MenuPanel className="top-0 left-0 w-[132px]">
              <MenuItem
                label="重命名"
                onClick={() => {
                  setMenu(null)
                  setDraft(session.title)
                  setEditing(true)
                }}
              />
              <MenuItem
                label="在文件夹中显示"
                onClick={() => {
                  setMenu(null)
                  window.pi?.host.revealPath(session.path)
                }}
              />
              <MenuItem
                label="删除"
                danger
                onClick={() => {
                  setMenu(null)
                  if (window.confirm(`删除任务「${session.title}」？文件会被永久移除。`)) onDelete()
                }}
              />
            </MenuPanel>
          </div>
        </>
      )}
    </>
  )
}

/** 收起侧栏后顶部工具条：logo / 前进后退 / 展开。放在 TitleBar 的左槽里，不能绝对定位叠在拖拽区上 */
export function CollapsedHeaderBar({
  onExpand,
  canBack,
  canForward,
  onBack,
  onForward
}: {
  onExpand: () => void
  canBack: boolean
  canForward: boolean
  onBack: () => void
  onForward: () => void
}): ReactNode {
  return (
    <div className="-ml-2 flex items-center gap-1 [-webkit-app-region:drag]">
      <CollapseButton collapsed onClick={onExpand} />
      <button
        type="button"
        aria-label="后退"
        disabled={!canBack}
        onClick={onBack}
        className={iconBtn + ' disabled:opacity-35 disabled:hover:bg-transparent'}
      >
        <IconArrowLeft />
      </button>
      <button
        type="button"
        aria-label="前进"
        disabled={!canForward}
        onClick={onForward}
        className={iconBtn + ' disabled:opacity-35 disabled:hover:bg-transparent'}
      >
        <IconArrowRight />
      </button>
    </div>
  )
}

export function WindowControls({ sessionPath }: { sessionPath?: string }): ReactNode {
  return (
    <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        type="button"
        aria-label="帮助"
        onClick={() => window.pi?.host.openExternal('https://github.com/earendil-works/pi')}
        className={iconBtn}
      >
        <IconHelp />
      </button>
      <button
        type="button"
        aria-label="在文件夹中显示会话"
        onClick={() => sessionPath && window.pi?.host.revealPath(sessionPath)}
        disabled={!sessionPath}
        className={iconBtn + ' disabled:opacity-35 disabled:hover:bg-transparent'}
      >
        <IconFolder />
      </button>
      <button type="button" aria-label="最小化" className={iconBtn} onClick={() => window.pi.window.minimize()}>
        <IconMinimize />
      </button>
      <button type="button" aria-label="最大化" className={iconBtn} onClick={() => window.pi.window.toggleMaximize()}>
        <IconMaximize />
      </button>
      <button type="button" aria-label="关闭" className={iconBtn} onClick={() => window.pi.window.close()}>
        <IconClose />
      </button>
    </div>
  )
}
