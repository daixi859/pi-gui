import type { SessionMock } from './types'
import { useSettings } from './settings'
import type { Route } from './router'
import { Icon } from './ui/Icon'

export const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

const PAGE_LABEL: Record<Exclude<Route['name'], 'chat'>, string> = {
  sessions: '全部会话',
  approvals: '工具审批',
  settings: '设置'
}

export function Topbar({
  route,
  session,
  isMobile,
  sidebarOpen,
  onToggleSidebar,
  onOpenPalette,
  onOpenShortcuts
}: {
  route: Route
  session: SessionMock | null
  isMobile: boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onOpenPalette: () => void
  onOpenShortcuts: () => void
}) {
  const { isDark, update } = useSettings()
  const showToggle = isMobile || !sidebarOpen

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--cds-border)] bg-[var(--cds-surface-1)] px-3">
      {showToggle && (
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={isMobile ? '打开侧栏' : '展开侧栏'}
          title={isMobile ? '打开侧栏' : '展开侧栏 (⌘B)'}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-[var(--cds-text-secondary)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]"
        >
          <Icon name="panel-left" size={16} />
        </button>
      )}

      <div className="flex min-w-0 items-center gap-1.5 text-xs">
        {route.name === 'chat' ? (
          <>
            <span className="hidden shrink-0 text-[var(--cds-text-muted)] sm:inline">会话</span>
            <Icon
              name="chevron-right"
              size={11}
              className="hidden shrink-0 text-[var(--cds-text-muted)] sm:block"
            />
            <span className="truncate font-medium text-[var(--cds-text-primary)]">
              {session?.title ?? '对话'}
            </span>
          </>
        ) : (
          <span className="font-medium text-[var(--cds-text-primary)]">
            {PAGE_LABEL[route.name]}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {route.name === 'chat' && session && (
          <span
            title={session.model}
            className="mr-1 hidden max-w-[180px] items-center gap-1.5 truncate rounded-md border border-[var(--cds-border)] bg-[var(--cds-surface-0)] px-1.5 py-1 font-mono text-[10px] text-[var(--cds-text-secondary)] lg:flex"
          >
            <Icon name="sparkles" size={11} className="shrink-0 text-[var(--cds-clay)]" />
            <span className="truncate">{session.model.split('/').pop()}</span>
          </span>
        )}

        <button
          type="button"
          onClick={onOpenPalette}
          className="hidden h-7 cursor-pointer items-center gap-1.5 rounded-md border border-[var(--cds-border)] bg-[var(--cds-surface-0)] px-2 text-[11px] text-[var(--cds-text-muted)] transition-colors hover:border-[var(--cds-border-strong)] hover:text-[var(--cds-text-primary)] sm:flex"
          aria-label="打开命令面板"
          title="搜索会话或页面"
        >
          <Icon name="search" size={12} />
          <span className="pr-2">搜索或跳转</span>
          <kbd className="kbd">{MOD_KEY} K</kbd>
        </button>
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="打开命令面板"
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-[var(--cds-text-secondary)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)] sm:hidden"
        >
          <Icon name="search" size={15} />
        </button>

        <button
          type="button"
          onClick={() => update('theme', isDark ? 'light' : 'dark')}
          aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
          title={isDark ? '切换到浅色模式' : '切换到深色模式'}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-[var(--cds-text-secondary)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]"
        >
          <Icon name={isDark ? 'sun' : 'moon'} size={14} />
        </button>

        <button
          type="button"
          onClick={onOpenShortcuts}
          aria-label="查看快捷键"
          title="快捷键 ( ? )"
          className="hidden size-7 cursor-pointer items-center justify-center rounded-md text-[var(--cds-text-secondary)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)] md:flex"
        >
          <Icon name="keyboard" size={14} />
        </button>
      </div>
    </header>
  )
}
