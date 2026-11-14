import { useState } from 'react'
import { Player } from './pages/Player'
import { Components } from './pages/Components'
import { zh } from './i18n/zh'

type Tab = 'replay' | 'components'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'replay', label: zh.tabs.replay },
  { id: 'components', label: zh.tabs.components },
]

/**
 * 应用外壳。
 *
 * 这个包有两个页面：回放验收页（事件流 → 对话块，块组件在 `src/blocks/`）
 * 与基础组件预览页（`src/components/` 的按钮、菜单、图标与令牌面板）。
 * PiGui 以 `agent-design/blocks` 与 `agent-design/components` 引入，这里的外壳只为两个验收页存在。
 * @returns 外壳与当前选中的页面。
 */
export default function App() {
  const [tab, setTab] = useState<Tab>('replay')
  return (
    <div className="app">
      <header className="appHeader">
        <div className="brand">
          <span className="brandTitle">{zh.appTitle}</span>
          <span className="brandSub">{zh.appSubtitle}</span>
        </div>
        <nav className="tabs" aria-label="页面">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === tab}
              className="tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      {tab === 'replay' ? <Player /> : <Components />}
    </div>
  )
}
