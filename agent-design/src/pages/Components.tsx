import { Fragment, useState, type FC, type ReactNode, type SVGProps } from 'react'
import { clsx } from 'clsx'
import { Button, Dropdown, MenuItem, MenuPanel, Toasts } from '../components'
import * as icons from '../components/icons'
import { COLOR_KEYS, FONT_KEYS, NUM_KEYS, VARS, useTokens, type Tokens, type TokenKey } from '../lib/tokenOverrides'
import styles from './Components.module.css'

/** 基础组件的预览页：看组件、调令牌。业务组件的预览留在主仓。 */

type Category = 'tokens' | 'icons' | 'buttons' | 'dialogs'

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'tokens', label: '外观令牌' },
  { id: 'icons', label: '图标' },
  { id: 'buttons', label: '按钮' },
  { id: 'dialogs', label: '弹层' }
]

export function Components(): ReactNode {
  const [active, setActive] = useState<Category>('tokens')
  const [tokens, set, reset] = useTokens()
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={clsx(styles.navItem, c.id === active && styles.navItemActive)}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <div className={styles.content}>
        <div className={styles.column}>
          {active === 'tokens' && <TokenPanel tokens={tokens} set={set} reset={reset} />}
          {active === 'icons' && <IconsDemo />}
          {active === 'buttons' && <ButtonsDemo />}
          {active === 'dialogs' && <DialogsDemo />}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
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
    <button type="button" onClick={onClick} className={clsx(styles.chip, active && styles.chipActive)}>
      {children}
    </button>
  )
}

/* ---------------- 令牌 ---------------- */

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
    ':root {',
    ...NUM_KEYS.map((k) => `  ${VARS[k][0]}: ${tokens[k]}px;`),
    ...COLOR_KEYS.map((k) => `  ${VARS[k][0]}: ${tokens[k]};`),
    ...FONT_KEYS.map((k) => `  ${VARS[k][0]}: ${tokens[k]};`),
    '}'
  ].join('\n')
  return (
    <section className={styles.tokenPanel}>
      <div className={styles.tokenHead}>
        <span className={styles.tokenTitle}>外观令牌</span>
        <button type="button" onClick={reset} className={styles.link}>
          重置
        </button>
      </div>

      <div className={styles.tokenGrid}>
        {NUM_KEYS.map((k) => (
          <label key={k} className={styles.tokenField}>
            <span className={styles.faint}>{VARS[k][0]}</span>
            <input
              type="number"
              value={tokens[k]}
              onChange={(e) => set(k, Number(e.target.value))}
              className={styles.input}
            />
          </label>
        ))}
      </div>

      <div className={styles.tokenGrid}>
        {COLOR_KEYS.map((k) => (
          <label key={k} className={styles.tokenColor}>
            <input
              type="color"
              value={tokens[k] as string}
              onChange={(e) => set(k, e.target.value)}
              className={styles.swatch}
            />
            <span className={styles.colorName}>{VARS[k][0].replace('--pi-', '')}</span>
          </label>
        ))}
      </div>

      {FONT_KEYS.map((k) => (
        <label key={k} className={styles.tokenField}>
          <span className={styles.faint}>{VARS[k][0]}（逗号分隔多家，前面的没装自动回退）</span>
          <input
            type="text"
            spellCheck={false}
            value={tokens[k] as string}
            onChange={(e) => set(k, e.target.value)}
            className={styles.input}
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
        className={styles.copy}
      >
        {copied ? '已复制' : '复制为 CSS'}
      </button>
      <p className={styles.hint}>改动实时写到 :root 并记住；复制后贴回 src/styles/tokens.css 的 :root 即可固化。</p>
    </section>
  )
}

/* ---------------- 图标 ---------------- */

const SIZES = [16, 20, 24, 28] as const
const SIZE_CLASS: Record<number, string> = {
  16: styles.s16,
  20: styles.s20,
  24: styles.s24,
  28: styles.s28
}
const ICON_COLORS = {
  fg: styles.colorFg,
  muted: styles.colorMuted,
  faint: styles.colorFaint,
  link: styles.colorLink,
  del: styles.colorDel
}
type IconColor = keyof typeof ICON_COLORS

function IconsDemo(): ReactNode {
  const [size, setSize] = useState<number>(20)
  const [color, setColor] = useState<IconColor>('fg')
  // 开外框：图标四周画出色块边界，验证墨迹不越界、三档大小是否一致
  const [frame, setFrame] = useState(false)
  const list = Object.entries(icons).filter(([name]) => name.startsWith('Icon')) as Array<
    [string, FC<SVGProps<SVGSVGElement>>]
  >
  return (
    <div className={styles.stack12}>
      <div className={styles.row}>
        <span className={styles.faint}>尺寸</span>
        {SIZES.map((s) => (
          <Chip key={s} active={s === size} onClick={() => setSize(s)}>
            {s}
          </Chip>
        ))}
        <span className={clsx(styles.faint, styles.gapLeft)}>颜色</span>
        {(Object.keys(ICON_COLORS) as IconColor[]).map((c) => (
          <Chip key={c} active={c === color} onClick={() => setColor(c)}>
            {c}
          </Chip>
        ))}
        <Chip active={frame} onClick={() => setFrame((v) => !v)}>
          外框
        </Chip>
      </div>
      <div className={styles.iconGrid}>
        {list.map(([name, Icon]) => (
          <div key={name} className={styles.iconCell} title={name}>
            {/* 边框常驻只换样式（透明 → 虚线）：否则开关外框时卡片高度会因多出描边而跳动 */}
            <div className={clsx(styles.iconBox, SIZE_CLASS[size], ICON_COLORS[color], frame && styles.iconFrame)}>
              <Icon className={SIZE_CLASS[size]} />
            </div>
            <span className={styles.iconName}>{name.slice(4)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- 按钮 ---------------- */

function ButtonsDemo(): ReactNode {
  const [hits, setHits] = useState<string[]>([])
  const hit = (label: string): void => setHits((prev) => [label, ...prev].slice(0, 4))
  const variants = [
    ['primary', '主按钮'],
    ['secondary', '次要'],
    ['raised', '浮层'],
    ['ghost', '幽灵'],
    ['danger', '危险']
  ] as const
  return (
    <div className={styles.stack24}>
      <Section title="变体（md，图标按钮见下方）">
        <div className={styles.row}>
          {variants.map(([v, label]) => (
            <Button key={v} variant={v} onClick={() => hit(label)}>
              {label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="尺寸 24 / 28（默认，日常都用这档） / 32">
        <div className={styles.row}>
          {variants.map(([v, label]) => (
            <Button key={v} size="sm" variant={v}>
              {label}
            </Button>
          ))}
          <span className={styles.divider} />
          {variants.map(([v, label]) => (
            <Button key={v} variant={v}>
              {label}
            </Button>
          ))}
          <span className={styles.divider} />
          {variants.map(([v, label]) => (
            <Button key={v} size="lg" variant={v}>
              {label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="带前置图标">
        <div className={styles.row}>
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
        <div className={styles.row}>
          <Button aria-label="添加附件" icon={<icons.IconPlus />} variant="ghost" />
          <Button aria-label="更多" icon={<icons.IconDots />} variant="ghost" size="sm" />
          <Button aria-label="搜索" icon={<icons.IconSearch />} variant="secondary" size="sm" />
          <Button aria-label="删除" icon={<icons.IconTrash />} variant="danger" />
          <Button aria-label="设置" icon={<icons.IconSettings />} variant="primary" size="lg" />
        </div>
      </Section>

      <Section title="圆形（shape=&quot;circle&quot;：图标为正圆，带文字为胶囊）">
        <div className={styles.row}>
          <Button shape="circle" aria-label="发送" icon={<icons.IconArrowUp />} variant="primary" />
          <Button shape="circle" aria-label="添加附件" icon={<icons.IconPlus />} variant="ghost" />
          <Button shape="circle" aria-label="停止" icon={<icons.IconStop />} variant="ghost" size="sm" />
          <Button shape="circle" aria-label="关闭" icon={<icons.IconClose />} variant="secondary" size="lg" />
          <Button shape="circle" aria-label="回到最新" icon={<icons.IconArrowDown />} variant="raised" />
          <span className={styles.divider} />
          <Button shape="circle" icon={<icons.IconSparkle />} variant="secondary">
            胶囊按钮
          </Button>
        </div>
      </Section>

      <Section title="状态矩阵（默认 / 禁用 / 加载）">
        <div className={styles.statusGrid}>
          <span />
          {['默认', '禁用', '加载'].map((h) => (
            <span key={h} className={styles.faint}>
              {h}
            </span>
          ))}
          {variants.map(([v, label]) => (
            <Fragment key={v}>
              <span className={styles.muted}>{label}</span>
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

      <Section title="工具条（次要 + 选中态用 select 令牌）">
        <div className={styles.toolRow}>
          <Button aria-label="继续" icon={<icons.IconPause />} variant="ghost" />
          <Button variant="ghost">重播</Button>
          <Button variant="ghost">末尾</Button>
          <span className={styles.divider} />
          {['1×', '2×', '4×'].map((s, i) => (
            <Button key={s} variant="ghost" className={clsx(i === 0 && styles.toolActive)}>
              {s}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="整行截断（长文案不换行）">
        <Button className={styles.fixed240} icon={<icons.IconFolder />} variant="secondary">
          一个很长很长的按钮文案用来验证截断行为
        </Button>
      </Section>

      <p className={styles.note}>
        最近点击：{hits.length > 0 ? hits.join(' / ') : '—'}；hover、按下与焦点环请用鼠标和 Tab 实测。
      </p>
    </div>
  )
}

/* ---------------- 弹层 ---------------- */

function DialogsDemo(): ReactNode {
  const [toasts, setToasts] = useState(false)
  return (
    <div className={styles.stack24}>
      <Section title="菜单（内联）">
        <div className={styles.menuSlot}>
          <MenuPanel className={styles.menuAnchor}>
            <MenuItem label="复制会话路径" />
            <MenuItem label="导出为 Markdown" selected />
            <MenuItem label="删除会话" danger />
          </MenuPanel>
        </div>
      </Section>

      <Section title="下拉（Dropdown：portal 到 body + 自动翻转/贴边）">
        <div className={styles.row}>
          <Dropdown
            width={176}
            trigger={({ open, toggle }) => (
              <Button aria-expanded={open} onClick={toggle}>
                底部左对齐
                <icons.IconChevronDown className={styles.s12} />
              </Button>
            )}
          >
            <MenuItem label="复制会话路径" />
            <MenuItem label="导出为 Markdown" selected />
          </Dropdown>
          <Dropdown
            placement="top"
            align="end"
            width={176}
            trigger={({ open, toggle }) => (
              <Button aria-expanded={open} variant="ghost" onClick={toggle}>
                顶部右对齐
                <icons.IconChevronDown className={styles.s12} />
              </Button>
            )}
          >
            <MenuItem label="重命名会话" />
            <MenuItem label="删除会话" danger />
          </Dropdown>
        </div>
      </Section>

      <Section title="提示条">
        <div className={styles.row}>
          <Chip active={toasts} onClick={() => setToasts((v) => !v)}>
            {toasts ? '关闭提示条' : '打开提示条'}
          </Chip>
        </div>
      </Section>
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
