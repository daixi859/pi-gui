import { clsx } from 'clsx'
import { Fragment, useEffect, useState, type FC, type ReactNode, type SVGProps } from 'react'
import { galleryBlocks, gallerySections, snapshot, type GallerySection } from '../mock'
import { TranscriptStack } from './blocks'
import { MockStage } from './transcript/MockStage'
import { ComposerCard } from './Composer'
import { AskCard } from './AskCard'
import { UiPrompt } from './UiPrompt'
import { Toasts } from './Toasts'
import { MenuItem, MenuPanel } from './Menu'
import { Button } from './Button'
import * as icons from './icons'

/** 开发期组件预览：分类看组件，右侧面板实时改全局令牌 */

type Category = 'tokens' | 'icons' | 'buttons' | 'inputs' | 'display' | 'dialogs' | 'transcript'

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'tokens', label: '外观令牌' },
  { id: 'icons', label: '图标' },
  { id: 'buttons', label: '按钮' },
  { id: 'inputs', label: '输入' },
  { id: 'display', label: '展示' },
  { id: 'dialogs', label: '弹窗' },
  { id: 'transcript', label: '对话块' }
]

/* ---------------- 令牌面板 ---------------- */

/** 兜底值：只在探测失败时用，真实值由 readDefaults() 从 @theme 量出来 */
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
  edge: '#e0e0e0',
  fontUi: "-apple-system, 'Segoe UI Variable Text', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif",
  fontMono: "'Cascadia Mono', 'Consolas', ui-monospace, monospace"
}
type Tokens = typeof DEFAULTS
type TokenKey = keyof Tokens

/** 每个字段对应的 CSS 变量；px 自动补单位，font 原样写入 */
const VARS: Record<TokenKey, [string, 'px' | 'font' | '']> = {
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
  edge: ['--color-edge', ''],
  fontUi: ['--font-ui', 'font'],
  fontMono: ['--font-mono', 'font']
}
const NUM_KEYS: TokenKey[] = ['spacing', 'radiusSm', 'radiusMd', 'radiusLg', 'textXs', 'textSm', 'textXl']
const COLOR_KEYS: TokenKey[] = ['canvas', 'panel', 'surface', 'fg', 'muted', 'edge']
const FONT_KEYS: TokenKey[] = ['fontUi', 'fontMono']
/* 键带版本：默认令牌变化时换版本号，旧的持久化值作废。只存用户改过的键 */
const STORE = 'pi.preview.tokens.v5'

/** 从 @theme 量真实值：自定义属性里是 color-mix()/var() 原文，读不出最终颜色 */
function readDefaults(): Tokens {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;left:-9999px;width:0;height:0'
  document.body.append(el)
  const canvas = document.createElement('canvas').getContext('2d')!
  const val = (k: TokenKey): number | string => {
    const [name, unit] = VARS[k]
    if (unit === 'px') {
      el.style.width = `var(${name})`
      return parseFloat(getComputedStyle(el).width) || DEFAULTS[k]
    }
    if (unit === 'font') {
      el.style.fontFamily = `var(${name})`
      return getComputedStyle(el).fontFamily || DEFAULTS[k]
    }
    el.style.backgroundColor = `var(${name})`
    // color-mix 的计算值可能是 color(srgb …)，交给 canvas 归一成 8 位 rgb
    canvas.fillStyle = getComputedStyle(el).backgroundColor
    canvas.clearRect(0, 0, 1, 1)
    canvas.fillRect(0, 0, 1, 1)
    const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
  }
  const pairs = (Object.keys(VARS) as TokenKey[]).map((k) => [k, val(k)])
  el.remove()
  return Object.fromEntries(pairs) as Tokens
}

/** @theme 的真值；量之前先摘掉内联覆盖，否则量到的是自己写上去的值 */
let BASE: Tokens | null = null
function themeTokens(): Tokens {
  if (!BASE) {
    const root = document.documentElement
    const inline = root.getAttribute('style')
    root.removeAttribute('style')
    BASE = readDefaults()
    if (inline) root.setAttribute('style', inline)
  }
  return BASE
}

function stored(): Partial<Tokens> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}')
  } catch {
    return {}
  }
}

/** 启动时就回放已保存的令牌，保证不进预览页也是同一套值 */
export function initTokens(): void {
  const root = document.documentElement.style
  for (const [k, v] of Object.entries(stored())) {
    const [name, unit] = VARS[k as TokenKey]
    root.setProperty(name, unit === 'px' ? `${v}px` : String(v))
  }
}

function useTokens(): [Tokens, (k: TokenKey, v: number | string) => void, () => void] {
  const [tokens, setTokens] = useState<Tokens>(() => ({ ...themeTokens(), ...stored() }))
  const [dirty, setDirty] = useState<Set<TokenKey>>(() => new Set(Object.keys(stored()) as TokenKey[]))
  // 只把改过的键写到 :root 并持久化；没动的继续跟 @theme 走，进预览页不会突然变色
  useEffect(() => {
    const root = document.documentElement.style
    const saved: Record<string, number | string> = {}
    for (const k of Object.keys(VARS) as TokenKey[]) {
      const [name, unit] = VARS[k]
      if (!dirty.has(k)) {
        root.removeProperty(name)
        continue
      }
      root.setProperty(name, unit === 'px' ? `${tokens[k]}px` : String(tokens[k]))
      saved[k] = tokens[k]
    }
    localStorage.setItem(STORE, JSON.stringify(saved))
  }, [tokens, dirty])
  return [
    tokens,
    (k, v) => {
      setTokens((prev) => ({ ...prev, [k]: v }))
      setDirty((prev) => new Set(prev).add(k))
    },
    () => {
      setTokens(themeTokens())
      setDirty(new Set())
    }
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
    ...FONT_KEYS.map((k) => `  ${VARS[k][0]}: ${tokens[k]};`),
    '}'
  ].join('\n')
  return (
    <section className="flex w-[460px] max-w-full flex-col gap-3">
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

      {FONT_KEYS.map((k) => (
        <label key={k} className="flex flex-col gap-0.5">
          <span className="text-xs text-faint">{VARS[k][0]}（逗号分隔多家，前面的没装自动回退）</span>
          <input
            type="text"
            spellCheck={false}
            value={tokens[k] as string}
            onChange={(e) => set(k, e.target.value)}
            className="pi-input w-full px-1 py-0.5"
          />
        </label>
      ))}

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
    </section>
  )
}

/* ---------------- 各分类 ---------------- */

const SIZES = [16, 20, 24, 28] as const
/* 尺寸只走 className（STYLE §6.1），预览页负责验证这条路 */
const SIZE_CLASS: Record<number, string> = { 16: 'size-4', 20: 'size-5', 24: 'size-6', 28: 'size-7' }
const ICON_COLORS = ['text-fg', 'text-muted', 'text-faint', 'text-link', 'text-del'] as const

function IconsDemo(): ReactNode {
  const [size, setSize] = useState<number>(20)
  const [color, setColor] = useState<string>('text-fg')
  // 开外框：图标四周画出色块边界，验证墨迹不越界、三档大小是否一致
  const [frame, setFrame] = useState(false)
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
        <Chip active={frame} onClick={() => setFrame((v) => !v)}>
          外框
        </Chip>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {list.map(([name, Icon]) => (
          <div
            key={name}
            className="flex flex-col items-center gap-1 rounded-sm border border-edge px-1 py-2"
            title={name}
          >
            {/* 边框常驻只换颜色（透明 → 虚线）：否则开关外框时卡片高度会因多出描边而跳动 */}
            <div
              className={clsx(
                'box-content flex items-center justify-center',
                SIZE_CLASS[size],
                color,
                frame ? 'border border-dashed border-edge' : 'border border-transparent'
              )}
            >
              <Icon className={SIZE_CLASS[size]} />
            </div>
            <span className="w-full truncate text-center text-xs text-faint">{name.slice(4)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ButtonsDemo(): ReactNode {
  const [hits, setHits] = useState<string[]>([])
  const hit = (label: string): void => setHits((prev) => [label, ...prev].slice(0, 4))
  const variants = [
    ['primary', '主按钮'],
    ['secondary', '次要'],
    ['ghost', '幽灵'],
    ['danger', '危险']
  ] as const
  return (
    <div className="flex flex-col gap-6">
      <Section title="变体（md，图标按钮见下方）">
        <div className="flex flex-wrap items-center gap-2">
          {variants.map(([v, label]) => (
            <Button key={v} variant={v} onClick={() => hit(label)}>
              {label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="尺寸 24 / 28（默认，日常都用这档） / 32">
        <div className="flex flex-wrap items-center gap-2">
          {variants.map(([v, label]) => (
            <Button key={v} size="sm" variant={v}>
              {label}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-edge" />
          {variants.map(([v, label]) => (
            <Button key={v} variant={v}>
              {label}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-edge" />
          {variants.map(([v, label]) => (
            <Button key={v} size="lg" variant={v}>
              {label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="带前置图标">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<icons.IconPlus />}>新建会话</Button>
          <Button icon={<icons.IconUpload />} variant="secondary">
            导入
          </Button>
          <Button icon={<icons.IconTrash />} variant="ghost" size="sm">
            删除
          </Button>
          <Button icon={<icons.IconClose />} variant="danger">
            放弃修改
          </Button>
        </div>
      </Section>

      <Section title="仅图标（必须给 aria-label，方形热区 24/28/32）">
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-label="添加附件" icon={<icons.IconPlus />} variant="ghost" />
          <Button aria-label="更多" icon={<icons.IconDots />} variant="ghost" size="sm" />
          <Button aria-label="搜索" icon={<icons.IconSearch />} variant="secondary" size="sm" />
          <Button aria-label="删除" icon={<icons.IconTrash />} variant="danger" />
          <Button aria-label="设置" icon={<icons.IconSettings />} variant="primary" size="lg" />
        </div>
      </Section>

      <Section title="圆形（shape=&quot;circle&quot;：图标为正圆，带文字为胶囊）">
        <div className="flex flex-wrap items-center gap-2">
          <Button shape="circle" aria-label="发送" icon={<icons.IconArrowUp />} variant="primary" />
          <Button shape="circle" aria-label="添加附件" icon={<icons.IconPlus />} variant="ghost" />
          <Button shape="circle" aria-label="停止" icon={<icons.IconStop />} variant="ghost" size="sm" />
          <Button shape="circle" aria-label="关闭" icon={<icons.IconClose />} variant="secondary" size="lg" />
          <span className="mx-1 h-4 w-px bg-edge" />
          <Button shape="circle" icon={<icons.IconSparkle />} variant="secondary">
            胶囊按钮
          </Button>
        </div>
      </Section>

      <Section title="状态矩阵（默认 / 禁用 / 加载）">
        <div className="inline-grid grid-cols-[80px_repeat(3,minmax(0,1fr))] items-center gap-2">
          <span />
          {['默认', '禁用', '加载'].map((h) => (
            <span key={h} className="text-xs text-faint">
              {h}
            </span>
          ))}
          {variants.map(([v, label]) => (
            <Fragment key={v}>
              <span className="text-xs text-muted">{label}</span>
              <Button variant={v}>{label}</Button>
              <Button variant={v} disabled>
                {label}
              </Button>
              <Button variant={v} loading>
                {label}
              </Button>
            </Fragment>
          ))}
        </div>
      </Section>

      <Section title="工具条（次要 + 选中态用 bg-select）">
        <div className="flex flex-wrap items-center gap-1">
          <Button aria-label="继续" icon={<icons.IconPause />} variant="ghost" />
          <Button variant="ghost">重播</Button>
          <Button variant="ghost">末尾</Button>
          <span className="mx-1 h-4 w-px bg-edge" />
          {['1×', '2×', '4×'].map((s, i) => (
            <Button key={s} variant="ghost" className={clsx(i === 0 && 'bg-select text-fg')}>
              {s}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="整行截断（长文案不换行）">
        <Button className="w-[240px] justify-start" icon={<icons.IconFolder />} variant="secondary">
          一个很长很长的按钮文案用来验证截断行为
        </Button>
      </Section>

      <p className="text-xs text-faint">
        最近点击：{hits.length > 0 ? hits.join(' / ') : '—'}；hover、按下与焦点环请用鼠标和 Tab 实测。
      </p>
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
      className={clsx(
        'rounded-sm border px-2 py-0.5 text-xs transition-colors',
        active ? 'border-edge bg-select text-fg' : 'border-transparent text-muted hover:bg-sunken'
      )}
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
  return (
    <div className="flex flex-col gap-4">
      <Section title="mock 回放（脚本模拟 pi 工具调用，含延时）">
        <MockStage />
      </Section>
      <Section title="旧渲染 · 静态样例">
        <TranscriptStack blocks={gallerySections.flatMap((s) => galleryBlocks[s.id])} />
      </Section>
    </div>
  )
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
  const [active, setActive] = useState<Category>('tokens')
  const [tokens, set, reset] = useTokens()
  return (
    <div className="flex h-full">
      <nav className="w-[168px] shrink-0 overflow-y-auto border-r border-edge py-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={clsx(
              'block w-full px-4 py-1.5 text-left text-xs transition-colors hover:bg-sunken',
              c.id === active ? 'font-medium text-fg' : 'text-muted'
            )}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[860px] px-8 py-6">
          {active === 'tokens' && <TokenPanel tokens={tokens} set={set} reset={reset} />}
          {active === 'icons' && <IconsDemo />}
          {active === 'buttons' && <ButtonsDemo />}
          {active === 'inputs' && <InputsDemo />}
          {active === 'display' && <DisplayDemo />}
          {active === 'dialogs' && <DialogsDemo />}
          {active === 'transcript' && <TranscriptDemo />}
        </div>
      </div>
    </div>
  )
}
