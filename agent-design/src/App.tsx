import { Player } from './pages/Player'
import { zh } from './i18n/zh'

/**
 * 应用外壳。
 *
 * 这个包只做一件事：把 pi 的事件流还原成对话块的回放验收页。
 * 块组件本身在 `src/blocks/`，PiGui 以 `agent-design/blocks` 引入；这里的外壳只为验收块存在。
 * @returns 回放页整页。
 */
export default function App() {
  return (
    <div className="app">
      <header className="appHeader">
        <div className="brand">
          <span className="brandTitle">{zh.appTitle}</span>
          <span className="brandSub">{zh.appSubtitle}</span>
        </div>
      </header>
      <Player />
    </div>
  )
}
