import { useMemo, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import type { SessionMeta } from '@shared/blocks'
import { removeProject, renameSession, useEngine } from '../../store'
import { count } from '../../perf'
import { Button } from '../base/Button'
import { Dropdown } from '../base/Dropdown'
import { ListRow } from '../base/ListRow'
import { Menu, MenuItem } from '../base/Menu'
import {
  IconBlocks,
  IconClock,
  IconChevronDown,
  IconClose,
  IconDots,
  IconFilter,
  IconFolder,
  IconFolderOpen,
  IconHelp,
  IconMaximize,
  IconMinimize,
  IconPlus,
  IconPlusCircle,
  IconSearch,
  IconSettings,
  IconSliders,
  IconSortList,
  IconSparkle,
  IconSpinner,
} from '../base/icons'

type Nav = (route: 'start' | 'chat' | 'gallery' | 'projects') => void

/** 项目行三点菜单的宽度：定位与面板共用，改一处就够 */
const MENU_W = 120

const SORTS = [
  { key: 'project', label: '项目', icon: <IconFolder className="size-[15px] text-muted" /> },
  { key: 'group', label: '分组', icon: <span className="w-[15px] text-center text-sm leading-none text-muted">#</span> },
  { key: 'recent', label: '最近更新', icon: <IconClock className="size-[15px] text-muted" /> },
  { key: 'unread', label: '未读', icon: <IconSparkle className="size-[15px] text-muted" /> }
] as const

function SortOptions({
  value,
  onPick,
  close
}: {
  value: string
  onPick: (k: string) => void
  close: () => void
}): ReactNode {
  return (
    <>
      {SORTS.map((s) => (
        <MenuItem
          key={s.key}
          icon={s.icon}
          label={s.label}
          selected={value === s.key}
          onClick={() => {
            onPick(s.key)
            close()
          }}
        />
      ))}
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
    <ListRow hint={hint} size="lg" onClick={onClick}>
      <Ico className="shrink-0 text-fg/75" />
      <span>{label}</span>
    </ListRow>
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
  onNavigate: Nav
  activeId: string | null
  onOpenSession: (id: string, path: string) => void
  onNewSession: () => void
  /** 在指定项目目录下开新会话 */
  onNewSessionIn: (path: string) => void
  onDelete: (path: string) => void
  /** 收起：宽度过渡到 0，内容被裁剪，不再参与焦点 */
  collapsed?: boolean
}

export function Sidebar({
  collapsed,
  onNavigate,
  activeId,
  onOpenSession,
  onNewSession,
  onNewSessionIn,
  onDelete
}: SidebarProps): ReactNode {
  count('sidebar')
  // 列表数据自己订阅：外壳（App）不会因为会话列表变化而重渲染
  const projects = useEngine((s) => s.projects)
  const sessions = useEngine((s) => s.sessions)
  const unread = useEngine((s) => s.unread)
  const [sort, setSort] = useState('project')
  /** 项目行三点菜单：项目路径 + 屏幕坐标 */
  const [menu, setMenu] = useState<{ path: string; x: number; y: number } | null>(null)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  /** 每个项目展开后显示多少条，默认 5，点「显示更多」每次 +10 */
  const [limit, setLimit] = useStored<Record<string, number>>('pi.sidebar.limit', {})
  /** 折叠的项目名集合（记住上一次，侧栏收起/重开不丢） */
  const [folded, setFolded] = useStored<Record<string, boolean>>('pi.sidebar.folded', {})

  const q = query.trim().toLowerCase()
  // 派生值只在搜索词或数据变化时算：流式期间 sessions 引用不变，这里一次都不跑
  const visible = useMemo(
    () =>
      sessions
        .filter((s) => !q || s.title.toLowerCase().includes(q))
        .sort((a, b) => b.modifiedAt - a.modifiedAt),
    [sessions, q]
  )
  // 按宿主给的 p.sessions 分组（按目录路径聚的），不能按项目名过滤：不同目录可能同名
  const grouped = useMemo(
    () =>
      projects
        .map((p) => ({
          ...p,
          sessions: p.sessions
            .filter((s) => !q || s.title.toLowerCase().includes(q))
            .sort((a, b) => b.modifiedAt - a.modifiedAt)
        }))
        .filter((p) => p.sessions.length > 0),
    [projects, q]
  )
  const unreadSet = useMemo(() => new Set(unread), [unread])
  const rowProps = (s: SessionMeta) => ({
    session: s,
    active: s.id === activeId,
    running: s.running === true,
    unread: unreadSet.has(s.path),
    onClick: () => onOpenSession(s.id, s.path),
    onRename: (title: string) => renameSession(s.path, title),
    onDelete: () => onDelete(s.path)
  })

  return (
    // 外层管宽度动画，内层固定 262px：过渡中内容不重排，只被右侧裁剪
    <aside
      className={clsx(
        'flex shrink-0 flex-col overflow-hidden transition-[width] duration-150 ease-out motion-reduce:transition-none',
        collapsed ? 'w-0' : 'w-[262px]'
      )}
      aria-hidden={collapsed}
      {...(collapsed ? { inert: true } : {})}
    >
      <div className="flex h-full w-[262px] flex-col pt-2">
      {/* 顶部 h-11 只留位：品牌与前进后退由 App 的浮动工具条画在最上层。
          这里刻意不设 drag：Windows 的拖拽矩形按几何算、不看 z 序，加了会吞掉上层的按钮点击 */}
      <div className="h-11 shrink-0" />

      <nav className="px-2 pt-2">
        {navButton('新建任务', IconPlusCircle, 'Ctrl+N', onNewSession)}
        {navButton('项目', IconFolder, undefined, () => onNavigate('projects'))}
        {navButton('组件预览', IconSliders, undefined, () => onNavigate('gallery'))}
        {navButton('插件市场', IconBlocks, undefined, () => window.pi?.host.openAgentConfig())}
      </nav>

      <div className="my-2 border-t border-edge" />

      {/* 固定行高：搜索时「任务列表」标题让位，输入框从左侧边缘铺开，整行高度不变所以列表不位移 */}
      <div className={clsx('relative flex h-9 shrink-0 items-center gap-2', searching ? 'px-2' : 'px-4')}>
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
            <Button
              aria-label="搜索"
              variant="ghost"
              className="ml-auto"
              onClick={() => setSearching(true)}
              icon={<IconSearch />}
            />
          </>
        )}
        <Dropdown
          align="end"
          width={152}
          trigger={({ open, toggle }) => (
            <Button
              aria-label="筛选"
              aria-expanded={open}
              variant="ghost"
              onClick={toggle}
              className={open ? 'text-fg' : ''}
              icon={<IconFilter />}
            />
          )}
        >
          {({ close }) => <SortOptions value={sort} onPick={setSort} close={close} />}
        </Dropdown>
      </div>

      {/* 分组标题行：项目下拉（排序）+ 排序 / 新建 */}
      <div className="flex h-8 shrink-0 items-center gap-1 px-4">
        {/* 外观来自 ListRow 的 quiet tone（ADR-0012）：-ml-2 抵消行内边距，文字与下方项目行对齐。
            浮层由 Dropdown 接管：portal 到 body，不再被侧栏 overflow 裁剪，也不再相对上方筛选行定位 */}
        <Dropdown
          width={152}
          trigger={({ open, toggle }) => (
            <ListRow tone="quiet" aria-expanded={open} className="-ml-2 w-auto gap-1" onClick={toggle}>
              {SORTS.find((s) => s.key === sort)?.label ?? '项目'}
              <IconChevronDown className="size-3" />
            </ListRow>
          )}
        >
          {({ close }) => <SortOptions value={sort} onPick={setSort} close={close} />}
        </Dropdown>
        <div className="ml-auto flex items-center gap-1">
          <Button aria-label="排序" variant="ghost" icon={<IconSortList />} />
          <Button aria-label="新建项目" variant="ghost" icon={<IconPlus />} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pl-2 pb-2 pr-0.5">
        {sort === 'project' &&
          grouped.map((p) => {
            const key = p.path || p.name
            const shown = p.sessions.slice(0, limit[key] ?? 5)
            const rest = p.sessions.length - shown.length
            const isFolded = folded[key]
            return (
              <div key={key}>
                <div className="group mb-0.5 flex h-7 items-center">
                  <ListRow
                    aria-expanded={!isFolded}
                    tone="quiet"
                    className="w-auto min-w-0 flex-1 gap-1"
                    onClick={() => setFolded((m) => ({ ...m, [key]: !m[key] }))}
                  >
                    {/* 收起/展开用文件夹开合表示：闭合 = 折叠，翻开 = 展开 */}
                    {isFolded ? (
                      <IconFolder className="size-4 shrink-0" />
                    ) : (
                      <IconFolderOpen className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{p.name || '未分组'}</span>
                  </ListRow>
                  {/* 悬停才露出的两个动作：更多菜单 / 新建任务（后者最右） */}
                  {p.path && (
                    <div className="flex shrink-0 items-center">
                      <Button
                        aria-label="更多"
                        aria-expanded={menu?.path === p.path}
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                        onClick={(e) => {
                          // 坐标要在事件里取：setState 的 updater 渲染时才跑，那时 currentTarget 已经是 null
                          const r = e.currentTarget.getBoundingClientRect()
                          setMenu((v) =>
                            v?.path === p.path ? null : { path: p.path, x: r.right - MENU_W, y: r.bottom + 4 }
                          )
                        }}
                        icon={<IconDots className="size-3.5" />}
                      />
                      <Button
                        aria-label={`在 ${p.name} 新建任务`}
                        title="新建任务"
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => onNewSessionIn(p.path)}
                        icon={<IconPlusCircle className="size-3.5" />}
                      />
                    </div>
                  )}
                </div>
                {!isFolded && shown.map((s) => <SessionRow key={s.id} {...rowProps(s)} />)}
                {!isFolded && rest > 0 && (
                  <ListRow
                    tone="select"
                    className="mb-0.5 pl-8 text-muted hover:text-fg"
                    onClick={() => setLimit((m) => ({ ...m, [key]: (m[key] ?? 5) + 10 }))}
                  >
                    显示更多{rest > 10 ? `（还有 ${rest} 条）` : ''}
                  </ListRow>
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
            .sort((a, b) => Number(unreadSet.has(b.path)) - Number(unreadSet.has(a.path)))
            .map((s) => <SessionRow key={s.id} {...rowProps(s)} />)}
      </div>

      <Menu
        open={menu !== null}
        onClose={() => setMenu(null)}
        fixed
        style={menu ? { left: menu.x, top: menu.y } : undefined}
      >
        <MenuItem
          label="移除"
          onClick={() => {
            removeProject(menu?.path ?? '')
            setMenu(null)
          }}
        />
      </Menu>

      <div className="border-t border-edge" />
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fg text-xs font-medium text-white">
          H
        </span>
        <span className="truncate text-sm">hwuscrxo</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="设置"
            variant="ghost"
            onClick={() => window.pi?.host.openAgentConfig()}
            icon={<IconSettings />}
          />
        </div>
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
      <ListRow
        active={active}
        className="mb-0.5"
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
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
        <span className="ml-auto shrink-0 text-2xs text-faint">{session.ageLabel}</span>
      </ListRow>
      <Menu
        open={menu !== null}
        onClose={() => setMenu(null)}
        fixed
        style={menu ? { left: menu.x, top: menu.y } : undefined}
        className="w-[132px]"
      >
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
      </Menu>
    </>
  )
}

export function WindowControls({ sessionPath }: { sessionPath?: string }): ReactNode {
  return (
    <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <Button
        aria-label="帮助"
        variant="ghost"
        onClick={() => window.pi?.host.openExternal('https://github.com/earendil-works/pi')}
        icon={<IconHelp />}
      />
      <Button
        aria-label="在文件夹中显示会话"
        variant="ghost"
        disabled={!sessionPath}
        onClick={() => sessionPath && window.pi?.host.revealPath(sessionPath)}
        icon={<IconFolder />}
      />
      <Button aria-label="最小化" variant="ghost" onClick={() => window.pi.window.minimize()} icon={<IconMinimize />} />
      <Button
        aria-label="最大化"
        variant="ghost"
        onClick={() => window.pi.window.toggleMaximize()}
        icon={<IconMaximize />}
      />
      <Button aria-label="关闭" variant="ghost" onClick={() => window.pi.window.close()} icon={<IconClose />} />
    </div>
  )
}
