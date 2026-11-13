import { useCallback, useState, type ReactElement } from 'react'
import { Gallery } from './pages/Gallery'
import { Player } from './pages/Player'
import { useTheme, type ThemeMode } from './lib/useTheme'
import { zh } from './i18n/zh'
import { IconDarkOutlineRegular, IconFollowsystemOutlineRegular, IconLightOutlineRegular } from './icons'
import { DsShell, type DsNavEntry, type DsSection, type LegacyTab } from './ds/shell/DsShell'
import { PiRoot } from './ds/theme/PiRoot'
import { SpecPage } from './ds/spec/SpecPage'
import { ShowcasePage } from './ds/showcase/ShowcasePage'
import { SurfacesPage } from './ds/surfaces/SurfacesPage'

/** 旧页面（冻结的对照物）的 tab。 */
type LegacyTabName = LegacyTab

/** 新系统的三个分区。 */
const NAV: readonly DsNavEntry[] = [
  { id: 'spec', label: '规范', icon: 'sliders' },
  { id: 'components', label: '基础组件', icon: 'grid' },
  { id: 'surfaces', label: '高保真', icon: 'layers' },
]

/** 旧外壳的主题图标（沿用旧 sprite，不引新图标）。 */
const LEGACY_THEME_ICON: Record<ThemeMode, () => ReactElement> = {
  system: () => <IconFollowsystemOutlineRegular size={13} />,
  light: () => <IconLightOutlineRegular size={13} />,
  dark: () => <IconDarkOutlineRegular size={13} />,
}

/** 规范页的速查卡里写作「Badge / Tag」，组件页的 id 是单个词。 */
function toComponentId(name: string): string {
  return name.split(' / ')[0] ?? name
}

/**
 * 应用外壳。
 *
 * 两种模式互斥：
 * - 设计系统：PiDS 自己接管整个窗口（令牌、基座、顶栏、rail）；
 * - 旧页面：原封不动保留旧外壳与旧样式，只多一个「设计系统」出口。
 * 旧页面不包进 PiRoot——`.pi-root` 会改子树字体与底色，包住就让对照物失真了。
 * @returns 当前模式对应的整页。
 */
export default function App() {
  const [section, setSection] = useState<DsSection>('spec')
  const [componentId, setComponentId] = useState<string | undefined>(undefined)
  const [legacy, setLegacy] = useState<LegacyTabName | null>(null)
  const [theme, setTheme] = useTheme()

  /** 规范页点组件卡：切到组件页并定位到该组件。 */
  const openComponent = useCallback((name: string) => {
    setComponentId(toComponentId(name))
    setSection('components')
  }, [])

  if (legacy === null) {
    return (
      <PiRoot>
        <DsShell section={section} onSectionChange={setSection} nav={NAV} onLegacyChange={setLegacy}>
          {section === 'spec' && <SpecPage onOpenComponent={openComponent} />}
          {section === 'components' && <ShowcasePage activeId={componentId} onSelect={setComponentId} />}
          {section === 'surfaces' && <SurfacesPage />}
        </DsShell>
      </PiRoot>
    )
  }

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
            aria-selected={legacy === 'player'}
            data-active={legacy === 'player' || undefined}
            onClick={() => setLegacy('player')}
          >
            {zh.tabs.player}
          </button>
          <button
            type="button"
            className="tab"
            role="tab"
            aria-selected={legacy === 'gallery'}
            data-active={legacy === 'gallery' || undefined}
            onClick={() => setLegacy('gallery')}
          >
            {zh.tabs.gallery}
          </button>
        </div>
        <div className="tabs" role="group" aria-label="设计系统">
          <button type="button" className="tab" onClick={() => setLegacy(null)}>
            设计系统
          </button>
        </div>
        <div className="segmented" role="group" aria-label="主题">
          {(Object.keys(LEGACY_THEME_ICON) as ThemeMode[]).map(mode => (
            <button
              type="button"
              key={mode}
              data-active={theme === mode || undefined}
              onClick={() => setTheme(mode)}
              title={zh.theme[mode]}
            >
              {LEGACY_THEME_ICON[mode]()}
              <span>{zh.theme[mode]}</span>
            </button>
          ))}
        </div>
      </header>
      {legacy === 'player' ? <Player /> : <Gallery />}
    </div>
  )
}
