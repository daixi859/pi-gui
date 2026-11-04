import { useEffect, useState, type FC, type ReactNode, type SVGProps } from 'react'
import { galleryBlocks, gallerySections, snapshot, type GallerySection } from '../mock'
import { TranscriptStack } from './blocks'
import { ComposerCard } from './Composer'
import { AskCard } from './AskCard'
import { UiPrompt } from './UiPrompt'
import { Toasts } from './Toasts'
import { MenuItem, MenuPanel } from './Menu'
import * as icons from './icons'

/** 开发期组件预览：分类看组件，右侧面板实时改全局令牌 */

type Category = 'icons' | 'inputs' | 'display' | 'dialogs' | 'transcript'

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'icons', label: '图标' },
  { id: 'inputs', label: '输入' },
  { id: 'display', label: '展示' },
  { id: 'dialogs', label: '弹窗' },
  { id: 'transcript', label: '对话块' }
]

/* ---------------- 令牌面板 ---------------- */

/** 默认值与 global.css 的 @theme 保持一致 */
const DEFAULTS = {
  spacing: 4,
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 16,
  textXs: 12,
  textSm: 14,
  textXl: 28,
  canvas: '#ececee',
  panel: '#f8f8f8',
  surface: '#ffffff',
  fg: '#26241f',
  muted: '#8b8781',
  edge: '#e0e0e0'
}
type Tokens = typeof DEFAULTS
type TokenKey = keyof Tokens

/** 每个字段对应的 CSS 变量；带 px 的自动补单位 */
const VARS: Record<TokenKey, [string, 'px' | '']> = {
  spacing: ['--spacing', 'px'],
  radiusSm: ['--radius-sm', 'px'],
  radiusMd: ['--radius-md', 'px'],
  radiusLg: ['--radius-lg', 'px'],
  textXs: ['--text-xs', 'px'],
  textSm: ['--text-sm', 'px'],
  textXl: ['--text-2xl', 'px'],
  canvas: ['--color-canvas', ''],
  panel: ['--color-panel', ''],
  surface: ['--color-surface', ''],
  fg: ['--color-fg', ''],
  muted: ['--color-muted', ''],
  edge: ['--color-edge', '']
}
const NUM_KEYS: TokenKey[] = ['spacing', 'radiusSm', 'radiusMd', 'radiusLg', 'textXs', 'textSm', 'textXl']
const COLOR_KEYS: TokenKey[] = ['canvas', 'panel', 'surface', 'fg', 'muted', 'edge']
/* 键带版本：默认令牌变化时换版本号，旧的持久化值作废 */
const STORE = 'pi.preview.tokens.v4'

function useTokens(): [Tokens, (k: TokenKey, v: number | string) => void, () => void] {
  const [tokens, setTokens] = useState<Tokens>(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') }
    } catch {
      return DEFAULTS
    }
  })
  // 实时写到 :root，预览页之外也生效（刷新后从 localStorage 恢复）
  useEffect(() => {
    const root = document.documentElement.style
    for (const k of Object.keys(VARS) as TokenKey[]) {
      const [name, unit] = VARS[k]
      root.setProperty(name, `${tokens[k]}${unit}`)
    }
    localStorage.setItem(STORE, JSON.stringify(tokens))
  }, [tokens])
  return [
    tokens,
    (k, v) => setTokens((prev) => ({ ...prev, [k]: v })),
    () => setTokens(DEFAULTS)
  ]
}

function TokenPanel({
  tokens,
  set,
  reset
}: {
  tokens: Tokens
  set: (k: TokenKey, v: number | string) => void
  reset: () => void
}): ReactNode {
  const [copied, setCopied] = useState(false)
  const css = [
    '@theme {',
    ...NUM_KEYS.map((k) => `  ${VARS[k][0]}: ${tokens[k]}px;`),
    ...COLOR_KEYS.map((k) => `  ${VARS[k][0]}: ${tokens[k]};`),
    '}'
  ].join('\n')
  return (
    <aside className="flex w-[236px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-edge p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg">外观令牌</span>
        <button type="button" onClick={reset} className="text-xs text-muted hover:text-fg">
          重置
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {NUM_KEYS.map((k) => (
          <label key={k} className="flex flex-col gap-0.5">
            <span className="text-xs text-faint">{VARS[k][0]}</span>
            <input
              type="number"
              value={tokens[k]}
              onChange={(e) => set(k, Number(e.target.value))}
              className="pi-input w-full px-1 py-0.5"
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {COLOR_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-1 text-xs text-faint">
            <input
              type="color"
              value={tokens[k] as string}
              onChange={(e) => set(k, e.target.value)}
              className="size-4 shrink-0 rounded-sm border border-edge bg-transparent p-0"
            />
            <span className="truncate">{VARS[k][0].replace('--color-', '')}</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(css)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="rounded-sm border border-edge px-2 py-1 text-xs text-muted hover:bg-sunken hover:text-fg"
      >
        {copied ? '已复制' : '复制为 CSS'}
      </button>
      <p className="text-xs leading-[1.5] text-faint">
        改动实时写到 :root 并记住；复制后贴回 global.css 的 @theme 即可固化。
      </p>
    </aside>
  )
}

/* ---------------- 各分类 ---------------- */

const SIZES = [16, 20, 24, 28] as const
const ICON_COLORS = ['text-fg', 'text-muted', 'text-faint', 'text-link', 'text-del'] as const

function IconsDemo(): ReactNode {
  const [size, setSize] = useState<number>(20)
  const [color, setColor] = useState<string>('text-fg')
  const list = Object.entries(icons).filter(([name]) => name.startsWith('Icon')) as Array<
    [string, FC<SVGProps<SVGSVGElement>>]
  >
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-faint">尺寸</span>
        {SIZES.map((s) => (
          <Chip key={s} active={s === size} onClick={() => setSize(s)}>
            {s}
          </Chip>
        ))}
        <span className="ml-2 text-xs text-faint">颜色</span>
        {ICON_COLORS.map((c) => (
          <Chip key={c} active={c === color} onClick={() => setColor(c)}>
            {c.replace('text-', '')}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1">
        {list.map(([name, Icon]) => (
          <div
            key={name}
            className="flex flex-col items-center gap-1 rounded-sm border border-edge px-1 py-2"
            title={name}
          >
            <span className={color}>
              <Icon width={size} height={size} />
            </span>
            <span className="w-full truncate text-center text-xs text-faint">{name.slice(4)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-sm border px-2 py-0.5 text-xs transition-colors ' +
        (active ? 'border-edge bg-select text-fg' : 'border-transparent text-muted hover:bg-sunken')
      }
    >
      {children}
    </button>
  )
}

const MOCK_QUESTIONS = [
  {
    header: '权限确认',
    question: '执行这个方案前，需要你确认一件事',
    multiSelect: false,
    options: [
      { label: '直接修改接口', description: '改动面小，但需要重启宿主' },
      { label: '先加适配层', description: '兼容旧调用，改动更多' }
    ]
  }
]

const MOCK_MODELS = [
  { id: 'deepseek', name: 'DeepSeek V4.1 Flash (OpenDesign)', provider: 'deepseek', levels: ['off', 'low', 'medium', 'high'] },
  { id: 'claude', name: 'Claude Sonnet 5', provider: 'anthropic', levels: ['off', 'medium', 'high'] }
]

function InputsDemo(): ReactNode {
  const [text, setText] = useState('')
  return (
    <div className="flex flex-col gap-6">
      <Section title="输入框">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="搜索任务标题"
          className="pi-input w-[280px]"
        />
      </Section>
      <Section title="输入卡（起始页大卡）">
        <ComposerCard
          scope="preview"
          snapshot={snapshot}
          models={MOCK_MODELS}
          streaming={false}
          onSubmit={() => undefined}
          onModel={() => undefined}
          onLevel={() => undefined}
          files={[]}
          onQueryFiles={() => undefined}
          commands={[]}
          onAccess={() => undefined}
          onSwitchWorkspace={() => undefined}
          workspaces={[]}
        />
      </Section>
      <Section title="提问卡">
        <AskCard id="preview-ask" questions={MOCK_QUESTIONS} onAnswer={() => undefined} onCancel={() => undefined} />
      </Section>
    </div>
  )
}

function DisplayDemo(): ReactNode {
  const [section, setSection] = useState<GallerySection>('assistant')
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {gallerySections.map((s) => (
          <Chip key={s.id} active={s.id === section} onClick={() => setSection(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>
      <TranscriptStack blocks={galleryBlocks[section]} />
    </div>
  )
}

function DialogsDemo(): ReactNode {
  const [prompt, setPrompt] = useState(false)
  const [toasts, setToasts] = useState(false)
  return (
    <div className="flex flex-col gap-6">
      <Section title="菜单（内联）">
        <div className="relative h-[168px] w-[220px]">
          <MenuPanel className="top-0 left-0">
            <MenuItem label="复制会话路径" />
            <MenuItem label="导出为 Markdown" selected />
            <MenuItem label="删除会话" danger />
          </MenuPanel>
        </div>
      </Section>
      <Section title="工具确认弹窗 / 提示条">
        <div className="flex gap-2">
          <Chip active={prompt} onClick={() => setPrompt((v) => !v)}>
            {prompt ? '关闭弹窗' : '打开弹窗'}
          </Chip>
          <Chip active={toasts} onClick={() => setToasts((v) => !v)}>
            {toasts ? '关闭提示条' : '打开提示条'}
          </Chip>
        </div>
      </Section>
      {prompt && (
        <UiPrompt
          req={{
            id: 'preview-confirm',
            kind: 'confirm',
            title: '允许执行 write？',
            message: '{"path":"src/renderer/src/App.tsx","content":"…"}'
          }}
          onReply={() => setPrompt(false)}
        />
      )}
      {toasts && (
        <Toasts
          items={[
            { id: 't1', message: '会话已导出为 Markdown', type: 'info' },
            { id: 't2', message: '上下文即将压缩', type: 'warning' },
            { id: 't3', message: '撤销失败：补丁不适用', type: 'error' }
          ]}
        />
      )}
    </div>
  )
}

function TranscriptDemo(): ReactNode {
  return <TranscriptStack blocks={gallerySections.flatMap((s) => galleryBlocks[s.id])} />
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      {children}
    </section>
  )
}

/* ---------------- 页面 ---------------- */

export function Preview(): ReactNode {
  const [active, setActive] = useState<Category>('icons')
  const [tokens, set, reset] = useTokens()
  return (
    <div className="flex h-full">
      <nav className="w-[168px] shrink-0 overflow-y-auto border-r border-edge py-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={
              'block w-full px-4 py-1.5 text-left text-xs transition-colors hover:bg-sunken ' +
              (c.id === active ? 'font-medium text-fg' : 'text-muted')
            }
          >
            {c.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[860px] px-8 py-6">
          {active === 'icons' && <IconsDemo />}
          {active === 'inputs' && <InputsDemo />}
          {active === 'display' && <DisplayDemo />}
          {active === 'dialogs' && <DialogsDemo />}
          {active === 'transcript' && <TranscriptDemo />}
        </div>
      </div>
      <TokenPanel tokens={tokens} set={set} reset={reset} />
    </div>
  )
}
