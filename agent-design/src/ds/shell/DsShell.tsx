import { memo, type ReactNode } from 'react'
import { DsIcon, type DsIconName } from '../icons/DsIcon'
import { usePiThemeContext } from '../theme/PiRoot'
import type { PiThemeMode } from '../theme/usePiTheme'
import css from './DsShell.module.css'

/** 新系统的三个分区。 */
export type DsSection = 'spec' | 'components' | 'surfaces'

/** 一个导航项。 */
export interface DsNavEntry {
  id: DsSection
  label: string
  icon: DsIconName
}

/** 旧页面（冻结保留的对照物）。 */
export type LegacyTab = 'player' | 'gallery'

/** 顶栏主题按钮。 */
const THEME_ICON: Record<PiThemeMode, DsIconName> = {
  system: 'auto',
  light: 'sun',
  dark: 'moon',
}

/** 主题模式的中文名。 */
const THEME_LABEL: Record<PiThemeMode, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}

/** DsShell props。 */
export interface DsShellProps {
  /** 当前分区。 */
  section: DsSection
  /** 切换分区。 */
  onSectionChange: (section: DsSection) => void
  /** 导航项（顺序即显示顺序）。 */
  nav: readonly DsNavEntry[]
  /** 主内容。 */
  children: ReactNode
  /** 旧页面对照：当前 tab；不传表示正在看新系统。 */
  legacyTab?: LegacyTab | undefined
  /** 切到旧页面的回调。 */
  onLegacyChange?: ((tab: LegacyTab) => void) | undefined
  /** 正在看旧页面时为 true：新系统导航置灰，提示「正在查看冻结的旧页面」。 */
  legacyActive?: boolean | undefined
}

/**
 * PiDS 文档外壳：顶栏（品牌 / 主题 / 旧页面对照）+ 左侧 rail + 内容舞台。
 *
 * 外壳自己就是 PiDS 的第一个消费者：顶栏高度、rail 宽度、按钮状态全部走令牌，
 * 与文档里写的内容同源，不存在「文档一套、外壳另一套」。
 * @param props - 分区状态、导航项与内容。
 * @returns 整个文档页。
 */
export const DsShell = memo(function DsShell({
  section,
  onSectionChange,
  nav,
  children,
  legacyTab,
  onLegacyChange,
  legacyActive = false,
}: DsShellProps) {
  const { mode, dark, setMode } = usePiThemeContext()
  return (
    <div className={css.shell}>
      <header className={css.topbar}>
        <div className={css.brand}>
          <span className={css.brandMark} aria-hidden="true">
            <DsIcon name="pi" size={13} />
          </span>
          <span className={css.brandName}>Pi Design System</span>
          <span className={css.brandVersion}>1.0</span>
        </div>
        <span className={css.spacer} />
        <div className={css.themeSwitch} role="group" aria-label="主题">
          {(Object.keys(THEME_ICON) as PiThemeMode[]).map(option => (
            <button
              key={option}
              type="button"
              className={css.themeButton}
              data-active={mode === option || undefined}
              onClick={() => setMode(option)}
              title={`${THEME_LABEL[option]}（当前${dark ? '深色' : '浅色'}）`}
              aria-label={THEME_LABEL[option]}
              aria-pressed={mode === option}
            >
              <DsIcon name={THEME_ICON[option]} size={14} />
            </button>
          ))}
        </div>
        {onLegacyChange !== undefined && (
          <>
            <span className={css.topDivider} aria-hidden="true" />
            <div className={css.legacyTabs} role="group" aria-label="冻结的旧页面">
              {(Object.keys(LEGACY_LABEL) as LegacyTab[]).map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={css.legacyTab}
                  data-active={(legacyActive && legacyTab === tab) || undefined}
                  onClick={() => onLegacyChange(tab)}
                >
                  {LEGACY_LABEL[tab]}
                </button>
              ))}
            </div>
          </>
        )}
      </header>

      <div className={css.body}>
        <nav className={css.rail} aria-label="Pi Design System 分区">
          {nav.map(entry => (
            <button
              key={entry.id}
              type="button"
              className={css.railItem}
              data-active={(!legacyActive && section === entry.id) || undefined}
              aria-current={!legacyActive && section === entry.id ? 'page' : undefined}
              onClick={() => onSectionChange(entry.id)}
              title={entry.label}
            >
              <DsIcon name={entry.icon} size={15} />
              <span className={css.railLabel}>{entry.label}</span>
            </button>
          ))}
          <div className={css.railFoot}>
            <span className={css.railFootText}>令牌前缀</span>
            <span className={css.railFootText}>
              <code>--pi-*</code>
            </span>
          </div>
        </nav>
        <main className={css.stage}>{children}</main>
      </div>
    </div>
  )
})

/** 旧页面的显示名。 */
const LEGACY_LABEL: Record<LegacyTab, string> = {
  player: '回放（旧）',
  gallery: '状态画廊（旧）',
}
