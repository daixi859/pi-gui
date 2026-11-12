import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type Density = 'comfortable' | 'compact'
export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high'
export type ApprovalPolicy = 'ask' | 'readonly' | 'deny'

export interface Settings {
  theme: Theme
  density: Density
  reduceMotion: boolean
  sidebarCollapsed: boolean
  model: string
  thinking: ThinkingLevel
  approval: ApprovalPolicy
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  density: 'comfortable',
  reduceMotion: false,
  sidebarCollapsed: false,
  model: 'zai-coding-cn/glm-5.3-flash',
  thinking: 'medium',
  approval: 'ask'
}

const STORAGE_KEY = 'pigui-demo.settings.v1'

/** 首帧之前同步应用外观，避免深色模式下闪白 */
export function bootstrapAppearance(): void {
  const settings = readSettings()
  const dark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.mode = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.documentElement.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false'
  document.documentElement.dataset.density = settings.density
}

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

interface SettingsContextValue {
  settings: Settings
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  reset: () => void
  savedAt: number
  isDark: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(readSettings)
  const [savedAt, setSavedAt] = useState<number>(() => Date.now())
  const [isDark, setIsDark] = useState(false)

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      setSavedAt(Date.now())
    } catch {
      // 隐私模式下 localStorage 可能不可写，demo 不处理
    }
  }, [settings])

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mql.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.dataset.mode = dark ? 'dark' : 'light'
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
      setIsDark(dark)
    }
    apply()
    if (settings.theme !== 'system') return
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false'
  }, [settings.reduceMotion])

  useEffect(() => {
    document.documentElement.dataset.density = settings.density
  }, [settings.density])

  const value = useMemo(
    () => ({ settings, update, reset, savedAt, isDark }),
    [settings, update, reset, savedAt, isDark]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
