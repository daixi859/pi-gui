import { Dialog } from './ui/Dialog'
import { MOD_KEY } from './Topbar'

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: [MOD_KEY, 'K'], label: '打开命令面板' },
  { keys: [MOD_KEY, 'B'], label: '收起 / 展开侧栏' },
  { keys: ['/'], label: '聚焦会话搜索' },
  { keys: ['?'], label: '显示这个快捷键列表' },
  { keys: ['Alt', '↑ / ↓'], label: '调整会话顺序（侧栏中）' },
  { keys: ['Enter'], label: '发送消息' },
  { keys: ['Shift', 'Enter'], label: '输入换行' },
  { keys: ['Esc'], label: '关闭弹窗，或清空搜索' }
]

export function ShortcutsDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="键盘快捷键"
      description="侧栏、命令面板和会话列表都可以只用键盘操作。"
      size="md"
    >
      <div className="divide-y divide-[var(--cds-border)] rounded-lg border border-[var(--cds-border)]">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.label} className="flex items-center justify-between px-3 py-2.5">
            <span className="text-xs text-[var(--cds-text-secondary)]">{shortcut.label}</span>
            <span className="flex items-center gap-1">
              {shortcut.keys.map((key) => (
                <kbd key={key} className="kbd min-w-5 text-center">
                  {key}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-[var(--cds-text-muted)]">
        {MOD_KEY === '⌘' ? 'macOS' : 'Windows'} 下生效；在输入框中打字时不会触发单键快捷键。
      </p>
    </Dialog>
  )
}
