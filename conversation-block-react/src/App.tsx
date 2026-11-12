import { useState, type ReactElement } from 'react'
import { Gallery } from './pages/Gallery'
import { Player } from './pages/Player'
import { useTheme, type ThemeMode } from './lib/useTheme'
import { zh } from './i18n/zh'
import { IconDarkOutlineRegular, IconFollowsystemOutlineRegular, IconLightOutlineRegular } from './icons'

type Tab = 'player' | 'gallery'

const THEME_ICON: Record<ThemeMode, () => ReactElement> = {
  system: () => <IconFollowsystemOutlineRegular size={13} />,
  light: () => <IconLightOutlineRegular size={13} />,
  dark: () => <IconDarkOutlineRegular size={13} />,
}

export default function App() {
  const [tab, setTab] = useState<Tab>('player')
  const [theme, setTheme] = useTheme()

  return (
    <div className="app">
      <header className="appHeader">
        <div className="brand">
          <span className="brandTitle">{zh.appTitle}</span>
          <span className="brandSub">{zh.appSubtitle}</span>
        </div>
        <span className="spacer" />
        <div className="tabs" role="tablist">
          <button
            type="button"
            className="tab"
            role="tab"
            aria-selected={tab === 'player'}
            data-active={tab === 'player' || undefined}
            onClick={() => setTab('player')}
          >
            {zh.tabs.player}
          </button>
          <button
            type="button"
            className="tab"
            role="tab"
            aria-selected={tab === 'gallery'}
            data-active={tab === 'gallery' || undefined}
            onClick={() => setTab('gallery')}
          >
            {zh.tabs.gallery}
          </button>
        </div>
        <div className="segmented" role="group" aria-label="主题">
          {(Object.keys(THEME_ICON) as ThemeMode[]).map(mode => (
            <button
              type="button"
              key={mode}
              data-active={theme === mode || undefined}
              onClick={() => setTheme(mode)}
              title={zh.theme[mode]}
            >
              {THEME_ICON[mode]()}
              <span>{zh.theme[mode]}</span>
            </button>
          ))}
        </div>
      </header>

      {tab === 'player' ? <Player /> : <Gallery />}
    </div>
  )
}
