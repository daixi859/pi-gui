import { useState, type ReactNode } from 'react'
import { IconDots, IconFolder, IconClose } from './icons'
import { WindowControls } from './Sidebar'
import { MenuItem, MenuPanel, MenuScrim } from './Menu'

const iconBtn =
  'grid size-7 place-items-center rounded-[6px] text-muted transition-colors hover:bg-sunken hover:text-fg'

/** 面板顶部：会话标题 + 窗口控件。收起侧栏时左侧由 CollapsedHeaderBar 占位。 */
export function TitleBar({
  collapsed,
  title,
  showTitle,
  sessionPath,
  onExport,
  error,
  onClearError
}: {
  collapsed: boolean
  title?: string
  showTitle: boolean
  sessionPath?: string
  onExport: () => void
  error?: string
  onClearError: () => void
}): ReactNode {
  const [menu, setMenu] = useState(false)
  return (
    <header className="flex h-11 shrink-0 items-center gap-1.5 px-3 [-webkit-app-region:drag]">
      <div className={collapsed ? 'w-[92px] shrink-0' : 'hidden'} />
      {showTitle && title && (
        <>
          <IconFolder className="shrink-0 text-muted" />
          <span className="truncate text-[13px]">{title}</span>
          <div className="relative">
            <button
              type="button"
              aria-label="会话信息"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className={iconBtn + ' [-webkit-app-region:no-drag]'}
            >
              <IconDots />
            </button>
            {menu && (
              <>
                <MenuScrim onClose={() => setMenu(false)} />
                <MenuPanel className="top-[calc(100%+6px)] left-0 w-[176px]">
                  <MenuItem
                    label="复制会话路径"
                    onClick={() => {
                      if (sessionPath) window.pi?.host.copy(sessionPath)
                      setMenu(false)
                    }}
                  />
                  <MenuItem
                    label="导出为 Markdown"
                    onClick={() => {
                      onExport()
                      setMenu(false)
                    }}
                  />
                </MenuPanel>
              </>
            )}
          </div>
        </>
      )}
      {error && (
        <div className="ml-2 flex min-w-0 items-center gap-1.5 rounded-[7px] bg-del/8 px-2 py-1 text-[12px] text-del [-webkit-app-region:no-drag]">
          <span className="truncate">{error}</span>
          <button type="button" aria-label="关闭提示" onClick={onClearError} className="shrink-0 opacity-70 hover:opacity-100">
            <IconClose className="size-3.5" />
          </button>
        </div>
      )}
      <div className="ml-auto">
        <WindowControls sessionPath={sessionPath} />
      </div>
    </header>
  )
}
