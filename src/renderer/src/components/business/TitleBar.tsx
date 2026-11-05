import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { IconDots, IconFolder, IconClose, IconPanelCollapse, IconPanelExpand } from '../base/icons'
import { WindowControls } from './Sidebar'
import { Button } from '../base/Button'
import { PiLogo } from '../base/PiLogo'
import { Menu, MenuItem } from '../base/Menu'

/** 品牌按钮：展开收起共用这一颗，hover 才换箭头，尺寸位置不变所以不抖 */
export function CollapseButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }): ReactNode {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
        onClick={onClick}
        className="relative grid size-7 place-items-center rounded-sm text-fg transition-colors hover:bg-tint-strong"
      >
        <PiLogo size={28} className="group-hover:opacity-0" />
        {collapsed ? (
          <IconPanelExpand className="absolute size-4.5 opacity-0 group-hover:opacity-100" />
        ) : (
          <IconPanelCollapse className="absolute size-4.5 opacity-0 group-hover:opacity-100" />
        )}
      </button>
      <span className="pointer-events-none absolute top-full mt-1 left-0 z-50 hidden whitespace-nowrap rounded-sm border border-edge bg-panel px-2 py-0.5 text-2xs text-muted shadow-pop group-hover:flex">
        {collapsed ? '展开侧栏' : '收起侧栏'}
        <kbd className="ml-2 rounded-sm border border-edge px-1 text-2xs text-faint">Ctrl+B</kbd>
      </span>
    </div>
  )
}

/** 面板顶部：会话标题 + 窗口控件。左侧 reserveLeft 给浮动的品牌/历史按钮让位。 */
export function TitleBar({
  title,
  showTitle,
  reserveLeft,
  sessionPath,
  onExport,
  error,
  onClearError
}: {
  title?: string
  /** 侧栏收起时给最上层的浮动按钮留出宽度 */
  reserveLeft: boolean
  showTitle: boolean
  sessionPath?: string
  onExport: () => void
  error?: string
  onClearError: () => void
}): ReactNode {
  const [menu, setMenu] = useState(false)
  return (
    <header className="flex h-11 shrink-0 items-center gap-1 border-b border-edge px-2 [-webkit-app-region:drag]">
      {/* 尺寸对齐 App 里的浮动工具条：left-2 + 3 个 28px 按钮 + 2 个 gap-1 = 100px；宽度过渡跟随侧栏收展 */}
      <span
        className={clsx(
          'shrink-0 transition-[width] duration-150 ease-out motion-reduce:transition-none',
          reserveLeft ? 'w-24' : 'w-0'
        )}
      />
      {showTitle && title && (
        <>
          <IconFolder className="shrink-0 text-muted" />
          <span className="truncate text-sm">{title}</span>
          <div className="relative">
            <Button
              aria-label="会话信息"
              aria-expanded={menu}
              variant="ghost"
              onClick={() => setMenu((v) => !v)}
              className="[-webkit-app-region:no-drag]"
              icon={<IconDots />}
            />
            <Menu
              open={menu}
              onClose={() => setMenu(false)}
              className="top-full mt-1 left-0 w-[176px]"
            >
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
            </Menu>
          </div>
        </>
      )}
      {error && (
        <div className="ml-2 flex min-w-0 items-center gap-1 rounded-md bg-danger-1 px-2 py-1 text-xs text-del [-webkit-app-region:no-drag]">
          <span className="truncate">{error}</span>
          <Button
            aria-label="关闭提示"
            variant="ghost"
            size="sm"
            shape="circle"
            onClick={onClearError}
            icon={<IconClose />}
          />
        </div>
      )}
      <div className="ml-auto">
        <WindowControls sessionPath={sessionPath} />
      </div>
    </header>
  )
}
