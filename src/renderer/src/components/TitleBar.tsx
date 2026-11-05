import { useState, type ReactNode } from 'react'
import { IconDots, IconFolder, IconClose } from './icons'
import { WindowControls } from './Sidebar'
import { Button } from './Button'
import { MenuItem, MenuPanel, MenuScrim } from './Menu'

/** 面板顶部：左槽（收起侧栏时的工具条）+ 会话标题 + 窗口控件。 */
export function TitleBar({
  leading,
  title,
  showTitle,
  sessionPath,
  onExport,
  error,
  onClearError
}: {
  leading?: ReactNode
  title?: string
  showTitle: boolean
  sessionPath?: string
  onExport: () => void
  error?: string
  onClearError: () => void
}): ReactNode {
  const [menu, setMenu] = useState(false)
  return (
    <header className="flex h-11 shrink-0 items-center gap-1 px-2 [-webkit-app-region:drag]">
      {leading}
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
            {menu && (
              <>
                <MenuScrim onClose={() => setMenu(false)} />
                <MenuPanel className="top-full mt-1 left-0 w-[176px]">
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
