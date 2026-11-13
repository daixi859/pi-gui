import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DsIcon, ICON_NAMES } from '../icons/DsIcon'
import { Button, IconButton } from '../components/Button'
import { Badge } from '../components/display'
import { contrastRatio, judge, toHex, type ContrastLevel } from '../lib/color'
import {
  COLOR_GROUPS,
  LINE_HEIGHT_NOTE,
  MOTION_SCALE,
  NEUTRAL_RAMP,
  RADIUS_SCALE,
  SPACE_SCALE,
  TYPE_SCALE,
} from './catalog'
import { pxOf, useTokens } from './useTokens'
import { useTokenExport } from './useTokenExport'
import css from './spec.module.css'

/* ============================================================================
 * 章节目录
 * ========================================================================== */

/** 一章的元信息。 */
interface ChapterMeta {
  id: string
  title: string
}

/** 九章：顺序即阅读顺序，也是「从抽象到具体」的顺序。 */
const CHAPTERS: readonly ChapterMeta[] = [
  { id: 'stance', title: '立场' },
  { id: 'color', title: '色彩' },
  { id: 'type', title: '字体' },
  { id: 'space', title: '间距与布局' },
  { id: 'shape', title: '圆角、描边与层级' },
  { id: 'icon', title: '图标' },
  { id: 'motion', title: '动效' },
  { id: 'a11y', title: '可访问性' },
  { id: 'index', title: '组件速查' },
]

/* ============================================================================
 * 需要读的令牌：模块级常量，保证 useTokens 的依赖数组稳定
 * ========================================================================== */

/** 全部要读取真实值的令牌名。 */
const TOKEN_NAMES: readonly string[] = [
  ...NEUTRAL_RAMP,
  ...COLOR_GROUPS.flatMap(group => group.items.map(item => item.name)),
  ...TYPE_SCALE.map(item => item.token),
  ...SPACE_SCALE.map(item => item.token),
  ...RADIUS_SCALE.map(item => item.token),
  ...MOTION_SCALE.map(item => item.token),
  ...LINE_HEIGHT_NOTE.map(item => item.token),
  '--pi-font-ui',
  '--pi-font-mono',
  '--pi-w-prose',
  '--pi-w-sidebar',
  '--pi-w-dialog',
  '--pi-h-bar',
  '--pi-w-composer',
  '--pi-w-settings-nav',
  '--pi-w-settings-pane',
  '--pi-w-palette',
  '--pi-w-rail',
  '--pi-w-doc-nav',
  '--pi-fw-medium',
  '--pi-fw-semibold',
]

/* ============================================================================
 * 小工具
 * ========================================================================== */

/** 计算一对颜色的对比度；任一边还没读到值时返回 null。 */
function ratioOf(values: Record<string, string>, fg: string, bg: string): number | null {
  const foreground = values[fg]
  const background = values[bg]
  if (foreground === undefined || foreground === '' || background === undefined || background === '') return null
  return contrastRatio(foreground, background)
}

/** 对比度徽标：数值 + 结论，颜色本身就是结论。 */
const RatioBadge = memo(function RatioBadge({ value, large = false }: { value: number | null; large?: boolean | undefined }) {
  if (value === null) {
    return (
      <span className={css.ratio} data-level="fail">
        —
      </span>
    )
  }
  const level: ContrastLevel = judge(value, large)
  return (
    <span className={css.ratio} data-level={level} title={LEVEL_TEXT[level]}>
      {value.toFixed(2)}
    </span>
  )
})

/** 徽标三态的读屏文本。 */
const LEVEL_TEXT: Record<ContrastLevel, string> = {
  pass: 'AA 通过',
  'large-only': '仅大字通过（需 ≥18.66px 粗体或 ≥24px）',
  fail: '不达 AA',
}

/** 规则条目。 */
const Rule = memo(function Rule({ index, head, why }: { index: number; head: string; why: string }) {
  return (
    <li className={css.rule}>
      <span className={css.ruleMark} aria-hidden="true">
        {index + 1}
      </span>
      <span className={css.ruleBody}>
        <span className={css.ruleHead}>{head}</span>
        {why !== '' && <span className={css.ruleWhy}>{why}</span>}
      </span>
    </li>
  )
})

/** 一条规则的数据。 */
interface RuleItem {
  head: string
  why: string
}

/** 把规则数组渲染成列表。 */
function RuleList({ items }: { items: readonly RuleItem[] }) {
  return (
    <ul className={css.rules}>
      {items.map((item, index) => (
        <Rule key={item.head} index={index} head={item.head} why={item.why} />
      ))}
    </ul>
  )
}

/** 小节。 */
const Section = memo(function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string | undefined
  children: ReactNode
}) {
  return (
    <section className={css.section}>
      <h3 className={css.sectionTitle}>{title}</h3>
      {note !== undefined && <p className={css.sectionNote}>{note}</p>}
      {children}
    </section>
  )
})

/** 可复制的代码块。 */
const CodeBlock = memo(function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const copy = useCallback(() => {
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 1400)
      })
      .catch(() => setCopied(false))
  }, [code])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <pre className={css.code}>
      <span className={css.codeActions}>
        <IconButton icon={copied ? 'check' : 'copy'} label={copied ? '已复制' : '复制'} size="sm" onClick={copy} />
      </span>
      {code}
    </pre>
  )
})

/** 深色浮层里强制深色主题，用于并排对照（由 PiRoot.forceTheme 提供）。 */
function PaneLabel({ children }: { children: ReactNode }) {
  return (
    <span className={css.demoPaneLabel}>
      <DsIcon name="grid" size={13} />
      {children}
    </span>
  )
}

/* ============================================================================
 * 第 1 章 · 立场
 * ========================================================================== */

/** 四条设计立场。 */
const PRINCIPLES: readonly { title: string; body: string }[] = [
  {
    title: '结构先于装饰',
    body: '分组靠间距与一层发丝描边完成，不靠色块、渐变或卡片阴影堆叠。去掉所有颜色后，界面层级仍然读得出来——这是检验结构是否成立的唯一标准。',
  },
  {
    title: '一个强调色',
    body: '全系统只有一个彩色强调（色相 258）。它只出现在「当前」「主操作」「进行中」三处，其余一切保持中性。强调色一旦变成装饰，就再也无法表达强调。',
  },
  {
    title: '状态必须可辨',
    body: '每个可交互元素都要定义默认、悬停、按下、聚焦、禁用、加载六个状态，并逐一验过对比度。只有默认态好看的控件等于没有设计。',
  },
  {
    title: '文档即实现',
    body: '本页所有色值、尺寸、对比度都是运行时从真实 CSS 令牌读出来算的。令牌改了页面立刻变，不可能出现「文档写 4.6、实际 3.9」。',
  },
]

/** 明确不做的事。 */
const NON_GOALS: readonly string[] = [
  '不提供双密度档——单档 13/14px，少一个维度就少一半组合爆炸。',
  '不引入 webfont——中英文混排的加载闪烁比字形差异更伤体验。',
  '不做装饰性渐变、玻璃拟态、大面积投影。',
  '不用颜色区分同级层级（五个灰底叠在一起只会让界面变脏）。',
  '不做弹性/回弹缓动——工具界面里「弹」意味着不确定。',
  '不把图标做成填充式——1.5px 描边在 13px 文字旁才不抢份量。',
]

/** 反例与正例。 */
const CONTRASTS: readonly { bad: string; good: string }[] = [
  {
    bad: '用 5 层灰底表达 5 级层级，层级越多越糊',
    good: '三层表面（canvas / panel / raised）+ 一层发丝描边表达层级',
  },
  {
    bad: '次要文字压到 3.3:1，「更淡」看起来更精致',
    good: '次要文字守住 4.5:1，靠字号与字重区分主次',
  },
  {
    bad: '13px / 15px / 17px 混合使用，节奏断裂',
    good: '12 / 13 / 14 / 16 / 20 固定阶梯，跨级才有对比',
  },
]

function StanceChapter() {
  return (
    <div className={css.chapter} data-chapter="stance">
      <div className={css.chapterHead}>
        <span className={css.chapterIndex}>01</span>
        <h2 className={css.chapterTitle}>立场</h2>
        <p className={css.chapterLead}>
          这是一个给「长时间盯着看」的界面用的设计系统。它不追求第一眼惊艳，追求的是第 200
          次使用时依然不刺眼、不迷惑、不需要重新学习。所有取舍围绕一句话展开：<strong>静默的工具</strong>。
        </p>
      </div>
      <div className={css.principleGrid}>
        {PRINCIPLES.map(item => (
          <div key={item.title} className={css.principle}>
            <span className={css.principleTitle}>{item.title}</span>
            <span className={css.principleBody}>{item.body}</span>
          </div>
        ))}
      </div>
      <Section title="反例与正例" note="左边是「看起来更精致」的做法，右边是这套系统实际采用的。">
        <div className={css.contrastPair}>
          <div className={css.contrastCell} data-bad>
            <strong>反例</strong>
            <span>{CONTRASTS[0]!.bad}</span>
          </div>
          <div className={css.contrastCell} data-good>
            <strong>正例</strong>
            <span>{CONTRASTS[0]!.good}</span>
          </div>
          <div className={css.contrastCell} data-bad>
            <span>{CONTRASTS[1]!.bad}</span>
          </div>
          <div className={css.contrastCell} data-good>
            <span>{CONTRASTS[1]!.good}</span>
          </div>
          <div className={css.contrastCell} data-bad>
            <span>{CONTRASTS[2]!.bad}</span>
          </div>
          <div className={css.contrastCell} data-good>
            <span>{CONTRASTS[2]!.good}</span>
          </div>
        </div>
      </Section>
      <Section title="明确不做" note="写下不做的事，比写下要做的事更能约束设计。">
        <RuleList items={NON_GOALS.map(text => ({ head: text, why: '' }))} />
      </Section>
    </div>
  )
}

/* ============================================================================
 * 第 2 章 · 色彩
 * ========================================================================== */

/** 色彩章。 */
function ColorChapter({ values }: { values: Record<string, string> }) {
  return (
    <div className={css.chapter} data-chapter="color">
      <div className={css.chapterHead}>
        <span className={css.chapterIndex}>02</span>
        <h2 className={css.chapterTitle}>色彩</h2>
        <p className={css.chapterLead}>
          颜色用 OKLCH 定义。选它的理由很实际：OKLCH 的 L 通道是感知明度，调色阶时只要按等距取
          L，得到的灰阶在眼睛看来就是等距的；HSL 做不到这一点，同样间距的 L 会一会儿跳一会儿黏。
          行尾注释里是等价的 HEX，供不认 oklch() 的工具与人工核对。
        </p>
      </div>

      <Section title="中性色阶" note="17 档，色相 262（偏冷的蓝灰，比纯灰更耐看）。语义层只从这里取值。">
        <div className={css.ramp}>
          {NEUTRAL_RAMP.map(name => {
            const value = values[name] ?? ''
            return (
              <div key={name} className={css.rampChip}>
                <span className={css.rampSwatch} style={{ background: `var(${name})` }} />
                <span className={css.rampName}>{name.replace('--pi-n-', 'n')}</span>
                <span className={css.rampHex}>{value === '' ? '—' : toHex(value)}</span>
              </div>
            )
          })}
        </div>
        <p className={css.caption}>
          实际取用集中在 n0 / n25 / n100 / n150 / n200 / n700 / n900 这七档，其余为深色主题与特殊表面准备。
        </p>
      </Section>

      {COLOR_GROUPS.map(group => (
        <Section key={group.id} title={group.title} note={group.note}>
          <table className={css.tokenTable}>
            <thead>
              <tr>
                <th scope="col" className={css.tokenSwatchCell} />
                <th scope="col">令牌</th>
                <th scope="col">当前值</th>
                <th scope="col">用途</th>
                <th scope="col">对比度</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map(item => {
                const value = values[item.name] ?? ''
                const ratio = item.on === undefined ? null : ratioOf(values, item.name, item.on)
                return (
                  <tr key={item.name}>
                    <td className={css.tokenSwatchCell}>
                      <span className={css.tokenSwatch} style={{ background: `var(${item.name})` }} />
                    </td>
                    <td className={css.tokenName}>{item.name}</td>
                    <td className={css.tokenValue}>{value === '' ? '—' : toHex(value)}</td>
                    <td>{item.usage}</td>
                    <td>
                      {item.on === undefined ? (
                        <span className={css.caption}>—</span>
                      ) : (
                        <RatioBadge value={ratio} large={item.kind === 'edge'} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {group.items.some(item => item.on !== undefined) && (
            <p className={css.caption}>
              括号内为对 <span className={css.inlineMono}>--pi-panel</span>{' '}
              的实测比值；文字需 ≥4.5:1，边框与图形需 ≥3:1。比值随主题切换实时变化。
            </p>
          )}
        </Section>
      ))}

      <Section
        title="双主题策略"
        note="深色不是把浅色反相。反相会让强调色在深底上过饱和、状态色糊成一片。做法是同一组语义令牌名在深色下重新绑值：强调色提亮（a-600 → a-400），状态色换成各自的 lift 版，表面层降低明度差。"
      >
        <RuleList
          items={[
            {
              head: '同一组令牌名，两套值',
              why: '组件只写 var(--pi-fg)，一行都不用为主题改；新增组件自动支持双主题。',
            },
            {
              head: '深色下降低表面间明度差',
              why: '浅色 canvas 与 panel 差 1 个 n 档就够；深色下继续按浅色比例放大会显得脏，因此差得更小、靠描边分离。',
            },
            {
              head: '深色下几乎不用阴影',
              why: '阴影在深底上几乎不可见，只会让边缘发灰；改用一层更亮的描边表达悬浮。',
            },
          ]}
        />
      </Section>
    </div>
  )
}

/* ============================================================================
 * 第 3 章 · 字体
 * ========================================================================== */

/** 字体章。 */
function TypeChapter({ values }: { values: Record<string, string> }) {
  return (
    <div className={css.chapter} data-chapter="type">
      <div className={css.chapterHead}>
        <span className={css.chapterIndex}>03</span>
        <h2 className={css.chapterTitle}>字体</h2>
        <p className={css.chapterLead}>
          不引入 webfont：中文字体动辄几 MB，加载闪烁与回退落差比任何字形收益都大。全部使用系统栈，
          并按「中文优先于字形个性」排序。等宽栈刻意不写裸 <span className={css.inlineMono}>monospace</span>：
          Windows 上中文会回退到宋体，出现方框与宽窄不一。
        </p>
      </div>

      <Section title="字族" note="界面栈与等宽栈两条，没有第三条。">
        <div className={css.demoRow}>
          <div className={css.demoPane}>
            <PaneLabel>界面 · --pi-font-ui</PaneLabel>
            <span style={{ fontFamily: 'var(--pi-font-ui)', fontSize: 14 }}>
              静默的工具 · Agent 正在读取 3 个文件
            </span>
            <span className={css.caption}>{values['--pi-font-ui'] ?? ''}</span>
          </div>
          <div className={css.demoPane}>
            <PaneLabel>等宽 · --pi-font-mono</PaneLabel>
            <span style={{ fontFamily: 'var(--pi-font-mono)', fontSize: 13 }}>
              const blocks = derive(timeline)
            </span>
            <span className={css.caption}>{values['--pi-font-mono'] ?? ''}</span>
          </div>
        </div>
      </Section>

      <Section
        title="字号阶梯"
        note="八档，每一档只有一个用途。跳档才产生对比，相邻档只用于微调层级——大多数界面只需要 13 / 14 / 20 三档；11px 只给等宽微标签，不排正文。"
      >
        {TYPE_SCALE.map(item => {
          const size = pxOf(values[item.token])
          return (
            <div key={item.token} className={css.typeRow}>
              <span className={css.typeToken}>{item.token.replace('--pi-fs-', '')}px</span>
              <span style={{ fontSize: size === 0 ? undefined : size, lineHeight: 1.35 }}>{item.sample}</span>
              <span className={css.typeRole}>{item.role}</span>
            </div>
          )
        })}
      </Section>

      <Section title="行高" note="行高按用途分，不按字号分。中文汉字是方块，1.5 的行高会让密集段落显得挤。">
        {LINE_HEIGHT_NOTE.map(item => (
          <div key={item.token} className={css.typeRow}>
            <span className={css.typeToken}>{item.value}</span>
            <span className={css.typeRole}>{item.usage}</span>
            <span className={css.typeRole}>
              <span className={css.inlineMono}>{item.token}</span>
            </span>
          </div>
        ))}
      </Section>

      <Section title="字重" note="只有三档。中文在 500 与 600 之间的差异往往被系统字体吞掉，不必细分。">
        <div className={css.demoStack}>
          <span style={{ fontWeight: 400 }}>400 · 正文与说明</span>
          <span style={{ fontWeight: 500 }}>500 · 界面标签、按钮、导航当前项</span>
          <span style={{ fontWeight: 600 }}>600 · 标题、对话框标题</span>
        </div>
      </Section>

      <Section title="排版规则">
        <RuleList
          items={[
            { head: '正文 14px / 行高 1.75，界面文字 13px / 行高 1.6', why: '长段落需要更松的行高才不累眼；界面元素行高松了会显得松散、失去控件感。' },
            { head: '正文最大行宽 68 个字符（约 820px）', why: '超过这个宽度的中文长行，视线回扫时容易跳行。' },
            { head: '不用大写字母做强调', why: '中文没有大小写；中英混排时大写会破坏基线节奏，强调交给字重与强调色。' },
            { head: '数字用 tabular-nums', why: '计时、计数、行号会跳动，等宽数字能避免宽度抖动。' },
          ]}
        />
        <CodeBlock code={`.prose {\n  font-size: var(--pi-fs-14);\n  line-height: var(--pi-lh-prose);\n  max-width: 68ch;\n}\n\n.counter {\n  font-variant-numeric: tabular-nums;\n}`} />
      </Section>
    </div>
  )
}

/* ============================================================================
 * 第 4 章 · 间距与布局
 * ========================================================================== */

/** 间距章。 */
function SpaceChapter({ values }: { values: Record<string, string> }) {
  return (
    <div className={css.chapter} data-chapter="space">
      <div className={css.chapterHead}>
        <span className={css.chapterIndex}>04</span>
        <h2 className={css.chapterTitle}>间距与布局</h2>
        <p className={css.chapterLead}>
          4px 基准，从 2 到 48 共十档。2px 是唯一的刻度外特例，只用于图标与文字之间的光学微调；
          超过 16 之后的档位（20 / 24 / 32 / 40 / 48）只做「块与块之间」的分隔，不进控件内部。
          间距是这套系统里最省力也最有效的表达层级的手段——同一组内用 8，组之间用 24，章节之间用
          40，层级自然就出来了，不需要任何视觉装饰。
        </p>
      </div>

      <Section title="间距阶梯" note="条形长度即真实像素值。">
        {SPACE_SCALE.map(item => {
          const width = pxOf(values[item.token])
          return (
            <div key={item.token} className={css.spaceRow}>
              <span className={css.spaceToken}>{item.token.replace('--pi-sp-', '')}px</span>
              <span className={css.spaceBar} style={{ width: width === 0 ? 10 : width }} />
              <span className={css.spaceUsage}>{item.usage}</span>
            </div>
          )
        })}
      </Section>

      <Section title="节奏三条" note="不需要背下来的规则：只要按「关系亲疏」选间距即可。">
        <RuleList
          items={[
            { head: '同一控件内部：4 / 8', why: '图标与文字 4，输入框内边距 8。超过 8 就不像同一个控件了。' },
            { head: '同一组元素之间：8 / 12', why: '列表项、按钮组、表单字段之间。12 用于内容较重的字段。' },
            { head: '不同组之间：24 / 32', why: '这是「换话题」的信号。24 是界面内的分组，32 留给页面级分栏。' },
            { head: '章节之间：40 / 48', why: '文档与长页面里的分节。48 同时是文档的左右页边距。' },
          ]}
        />
      </Section>

      <Section title="版式宽度" note="宽度是令牌，不是随手写的 max-width。">
        <table className={css.tokenTable}>
          <thead>
            <tr>
              <th scope="col">令牌</th>
              <th scope="col">当前值</th>
              <th scope="col">用途</th>
            </tr>
          </thead>
          <tbody>
            {[
              { token: '--pi-w-prose', usage: '对话正文列宽' },
              { token: '--pi-w-sidebar', usage: '会话侧栏宽度' },
              { token: '--pi-w-dialog', usage: '对话框宽度' },
              { token: '--pi-h-bar', usage: '顶栏高度' },
              { token: '--pi-w-composer', usage: '输入卡宽度' },
              { token: '--pi-w-settings-nav', usage: '设置页二级导航' },
              { token: '--pi-w-settings-pane', usage: '设置页内容列' },
              { token: '--pi-w-palette', usage: '命令面板宽度' },
              { token: '--pi-w-rail', usage: '外壳一级导航条' },
              { token: '--pi-w-doc-nav', usage: '规范页 / 组件页左侧目录' },
            ].map(item => (
              <tr key={item.token}>
                <td className={css.tokenName}>{item.token}</td>
                <td className={css.tokenValue}>{values[item.token] ?? '—'}</td>
                <td>{item.usage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title="三栏骨架"
        note="主对话壳是这套系统里信息密度最高的画面。左栏 262 可收起、正文 820 居中、顶栏 44。收起侧栏后正文不重排（列宽固定），避免阅读时文字跳动。"
      >
        <CodeBlock
          code={`.shell {\n  display: grid;\n  grid-template-columns: var(--pi-w-sidebar) minmax(0, 1fr);\n}\n\n.prose {\n  width: min(100%, var(--pi-w-prose));\n  margin-inline: auto;\n}\n\n/* 顶栏永远 44px：比内容字号大一档，紧凑但不拥挤 */\n.topbar {\n  height: 44px;\n}`}
        />
      </Section>
    </div>
  )
}

/* ============================================================================
 * 第 5 章 · 圆角、描边与层级
 * ========================================================================== */

/** 形状章。 */
function ShapeChapter({ values }: { values: Record<string, string> }) {
  return (
    <div className={css.chapter} data-chapter="shape">
      <div className={css.chapterHead}>
        <span className={css.chapterIndex}>05</span>
        <h2 className={css.chapterTitle}>圆角、描边与层级</h2>
        <p className={css.chapterLead}>
          层级由三样东西共同表达：表面明度、描边强度、阴影。这套系统把前两者的比重放大、把阴影压到最低——
          阴影会让界面看起来「浮」在页面上，而工具界面应该看起来像一整个平面。
        </p>
      </div>

      <Section title="圆角" note="五档。嵌套时内圆角 = 外圆角 − 内边距，最小取 4——否则内外圆角不同心，看起来会歪。">
        <div className={css.chipRow}>
          {RADIUS_SCALE.map(item => (
            <div key={item.token} className={css.shapeChip}>
              <span
                className={css.shapeBox}
                style={{ borderRadius: item.token === '--pi-r-full' ? '999px' : `var(${item.token})` }}
              />
              <span className={css.shapeName}>{item.token.replace('--pi-r-', '')}</span>
              <span className={css.caption}>{values[item.token] ?? '—'}</span>
              <span className={css.caption} style={{ textAlign: 'center' }}>
                {item.usage}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="三层表面 + 三级描边" note="表面只差 1 档明度，靠描边承担分离。">
        <div className={css.demoRow}>
          <div className={css.demoPane} style={{ background: 'var(--pi-canvas)' }}>
            <PaneLabel>canvas · 应用底</PaneLabel>
            <div className={css.demoPane} style={{ background: 'var(--pi-panel)', borderColor: 'var(--pi-edge)' }}>
              <PaneLabel>panel · 工作面</PaneLabel>
              <div className={css.demoPane} style={{ background: 'var(--pi-raised)', borderColor: 'var(--pi-edge-strong)' }}>
                <PaneLabel>raised · 浮层</PaneLabel>
                <span className={css.caption}>edge-subtle / edge / edge-strong</span>
              </div>
            </div>
          </div>
          <div className={css.demoPane}>
            <PaneLabel>描边强度</PaneLabel>
            <div className={css.demoStack} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <span style={{ height: 1, background: 'var(--pi-edge-subtle)' }} />
              <span className={css.caption}>edge-subtle · 组内分隔，几乎看不见</span>
              <span style={{ height: 1, background: 'var(--pi-edge)' }} />
              <span className={css.caption}>edge · 常规边界（卡片、输入框）</span>
              <span style={{ height: 1, background: 'var(--pi-edge-strong)' }} />
              <span className={css.caption}>edge-strong · 可交互控件边界，≥3:1</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="阴影" note="只有浮层用阴影，且只有三档。静态表面一律不用。">
        <div className={css.chipRow}>
          {[
            { token: '--pi-shadow-card', usage: '卡片（可选，默认靠描边）' },
            { token: '--pi-shadow-pop', usage: '菜单、气泡、下拉' },
            { token: '--pi-shadow-dialog', usage: '模态对话框' },
          ].map(item => (
            <div key={item.token} className={css.shapeChip} style={{ minWidth: 200 }}>
              <span
                style={{
                  width: '100%',
                  height: 56,
                  borderRadius: 12,
                  background: 'var(--pi-raised)',
                  border: '1px solid var(--pi-edge)',
                  boxShadow: `var(${item.token})`,
                }}
              />
              <span className={css.shapeName}>{item.token.replace('--pi-shadow-', '')}</span>
              <span className={css.caption}>{item.usage}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="层级规则">
        <RuleList
          items={[
            { head: '最多三层表面', why: '第四层开始读者无法分辨，只会觉得「脏」。需要更多层级时改用分组标题。' },
            { head: '可悬浮的东西才有阴影', why: '阴影暗示 z 轴。给平面元素加阴影会让整个界面失去纵深逻辑。' },
            { head: '描边 1px，不用 0.5px 也不用 2px', why: '1px 在 1x 与 2x 屏上都稳定；0.5px 在 1x 屏上会被舍入成 0 或 1，不连续。' },
            { head: '焦点环永远可见', why: '键盘用户唯一能定位自己的东西。不能用 overflow: hidden 裁掉，也不能降透明度。' },
          ]}
        />
      </Section>
    </div>
  )
}

/* ============================================================================
 * 第 6 章 · 图标
 * ========================================================================== */

/** 图标章。 */
function IconChapter() {
  return (
    <div className={css.chapter} data-chapter="icon">
      <div className={css.chapterHead}>
        <span className={css.chapterIndex}>06</span>
        <h2 className={css.chapterTitle}>图标</h2>
        <p className={css.chapterLead}>
          全部手绘在 16×16 网格上，1.5px 描边，圆头端与圆角连接，不填充。这样它们在 13px
          文字旁边不会因为笔画过粗而抢注意力。绘制时遵守一条：把图标缩到 16px 看，仍然能认出是什么。
        </p>
      </div>

      <Section title={`全部图标（${ICON_NAMES.length} 个）`} note="尺寸只在 12 / 14 / 16 / 20 四档取用，不写任意值。">
        <div className={css.iconGrid}>
          {ICON_NAMES.map(name => (
            <div key={name} className={css.iconCell}>
              <DsIcon name={name} size={16} />
              <span className={css.iconName}>{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="尺寸与对齐">
        <div className={css.demoRow}>
          <div className={css.demoPane}>
            <PaneLabel>尺寸阶梯</PaneLabel>
            <div className={css.demoStack}>
              {[12, 14, 16, 20].map(size => (
                <span key={size} className={css.demoStack}>
                  <DsIcon name="chat" size={size} />
                  <span className={css.caption}>{size}px</span>
                </span>
              ))}
            </div>
          </div>
          <div className={css.demoPane}>
            <PaneLabel>与文字对齐</PaneLabel>
            <span className={css.demoStack} style={{ fontSize: 13 }}>
              <DsIcon name="check" size={14} />
              <span>图标基线与文字基线对齐，不是与行框居中</span>
            </span>
            <span className={css.caption}>
              描边会随尺寸补偿：14px 时描边略粗于 1.5，保证视觉重量一致。
            </span>
          </div>
        </div>
      </Section>

      <Section title="规则">
        <RuleList
          items={[
            { head: '纯图标按钮必须有 label', why: '没有可见文字的按钮，读屏只能靠 aria-label；缺了它按钮就是「未命名按钮」。' },
            { head: '图标不单独承载语义', why: '颜色与图形都可能不可辨（色盲、低视力），关键状态永远配文字。' },
            { head: '状态色只用于状态图标', why: '成功/警告/错误色出现在装饰图标上会稀释状态色的信号强度。' },
            { head: '相邻图标间距 ≥8px', why: '紧凑排布时 1.5px 描边容易视觉粘连。' },
          ]}
        />
      </Section>
    </div>
  )
}

/* ============================================================================
 * 第 7 章 · 动效
 * ========================================================================== */

/** 动效演示：小球按给定时长来回跑。 */
const MotionBench = memo(function MotionBench({
  duration,
  label,
  token,
}: {
  duration: number
  label: string
  token: string
}) {
  return (
    <div className={css.motionDemo} data-playing>
      <span className={css.motionLabel}>
        {token.replace('--pi-dur-', '')} · {duration}ms
      </span>
      <span className={css.motionTrack}>
        <span className={css.motionBall} style={{ ['--demo-duration' as string]: `${duration}ms` }} />
      </span>
      <span className={css.motionUse}>{label}</span>
    </div>
  )
})

/** 动效章。 */
function MotionChapter() {
  return (
    <div className={css.chapter} data-chapter="motion">
      <div className={css.chapterHead}>
        <span className={css.chapterIndex}>07</span>
        <h2 className={css.chapterTitle}>动效</h2>
        <p className={css.chapterLead}>
          动效只做一件事：让「变了」这件事被看见。因此它必须短、必须可预期、必须只走一个方向。
          三条时长，一条缓动，全部只作用于 opacity / transform / mask——这三样不触发重排。
        </p>
      </div>

      <Section
        title="时长阶梯"
        note="前三条是交互时长：超过 200ms 的过渡在这类界面里会被感知为「卡」。第四条是唯一的循环动画，属于氛围而非反馈，量级完全不同，所以单独一档。"
      >
        {MOTION_SCALE.map(item => (
          <MotionBench key={item.token} duration={item.ms} label={item.usage} token={item.token} />
        ))}
        <p className={css.caption}>
          缓动统一 <span className={css.inlineMono}>cubic-bezier(0.2, 0, 0, 1)</span>：起步快、收尾慢，
          与「物体被轻轻放下」的直觉一致。
        </p>
      </Section>

      <Section
        title="标志性动效：运行指示器"
        note="全系统唯一允许「有性格」的地方，也是唯一一条循环动画。一条 2px 高的细光带从左扫到右，周期 1.2s，只在 agent 正在工作时出现。它同时表达了「进行中」与「还在动」两层意思，因此不需要再加文字。"
      >
        <div className={css.sweepStage}>
          <div className={css.sweepRow}>
            <span className={css.sweepDot} />
            <span className={css.sweepTitle}>正在读取 4 个文件</span>
            <span className={css.sweepMeta}>进行中</span>
          </div>
          <div className={css.sweepDemo}>
            <span className={css.sweepBar} />
          </div>
        </div>
        <p className={css.caption}>
          实现用 CSS <span className={css.inlineMono}>transform</span> 位移，不用 width 动画；reduced-motion 下退化为静态 3 个点。
        </p>
        <CodeBlock
          code={`.indicator { animation: pi-sweep var(--pi-dur-sweep) var(--pi-ease) infinite; }\n\n@keyframes pi-sweep {\n  from { transform: translateX(-100%); }\n  to   { transform: translateX(320%); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .indicator { animation: none; }\n}`}
        />
      </Section>

      <Section title="规则">
        <RuleList
          items={[
            { head: '只动 opacity / transform / mask', why: '动 width/height/top/left 会触发重排，长列表里直接掉帧。' },
            { head: '入场有动效，出场可以没有', why: '出场动效会让用户等待「它消失」，而用户已经知道结果了。' },
            { head: '不做回弹、不做弹簧', why: '弹簧缓动暗示物理不确定性；工具界面需要「精确」。' },
            { head: 'reduced-motion 下全部瞬时', why: '前庭功能障碍用户会因位移动画眩晕；这不是偏好，是医学需求。' },
            { head: '同屏最多一处无限动画', why: '多个循环动画会分散注意力，也让用户无法判断哪个在「进行中」。' },
          ]}
        />
      </Section>
    </div>
  )
}

/* ============================================================================
 * 第 8 章 · 可访问性
 * ========================================================================== */

/** 一组待验的对比度对。 */
interface RatioPair {
  fg: string
  bg: string
  label: string
  large: boolean
}

/** 关键对比度对：这是验收清单，不是示例。 */
const RATIO_PAIRS: readonly RatioPair[] = [
  { fg: '--pi-fg', bg: '--pi-panel', label: '正文 / 面板', large: false },
  { fg: '--pi-fg', bg: '--pi-canvas', label: '正文 / 应用底', large: false },
  { fg: '--pi-fg-2', bg: '--pi-panel', label: '次要文字 / 面板', large: false },
  { fg: '--pi-fg-3', bg: '--pi-panel', label: '最次要文字 / 面板', large: false },
  { fg: '--pi-fg-3', bg: '--pi-sunken', label: '最次要文字 / 凹面', large: false },
  { fg: '--pi-accent', bg: '--pi-panel', label: '强调文字 / 面板', large: false },
  { fg: '--pi-on-accent', bg: '--pi-accent-solid', label: '主按钮文字 / 主按钮底', large: false },
  { fg: '--pi-on-danger-tint', bg: '--pi-danger-tint', label: '错误文字 / 错误底', large: false },
  { fg: '--pi-on-success-tint', bg: '--pi-success-tint', label: '成功文字 / 成功底', large: false },
  { fg: '--pi-edge-strong', bg: '--pi-panel', label: '控件边界 / 面板', large: true },
]

/** 键盘路径表。 */
const KEYBOARD_PATHS: readonly { component: string; keys: string }[] = [
  { component: 'Button / IconButton', keys: 'Tab 聚焦 · Enter / Space 触发' },
  { component: 'Menu', keys: 'Enter / ↓ 打开 · ↑ ↓ 移动 · Home / End 首末 · Esc 关闭 · 关闭后焦点回触发器' },
  { component: 'Dialog', keys: '打开后焦点进面板 · Tab 内部循环 · Esc 关闭 · 关闭后焦点回触发元素' },
  { component: 'Tabs', keys: '← → 切换 · Home / End 首末 · Tab 离开 tablist' },
  { component: 'SegmentedControl', keys: '← → 切换选中值（radiogroup 语义）' },
  { component: 'Checkbox / Radio', keys: 'Space 切换；Radix 里方向键在组内移动' },
  { component: 'Switch', keys: 'Space 切换' },
  { component: 'Select', keys: '原生 select：↑ ↓ / Home / End / 首字母跳转' },
  { component: 'Tooltip', keys: '聚焦触发（不靠悬停）· Esc 关闭' },
  { component: 'Toast', keys: '不抢焦点 · 自动消失前可被读屏播报 · 关闭按钮可 Tab 到' },
]

/** 可访问性章。 */
function A11yChapter({ values }: { values: Record<string, string> }) {
  return (
    <div className={css.chapter} data-chapter="a11y">
      <div className={css.chapterHead}>
        <span className={css.chapterIndex}>08</span>
        <h2 className={css.chapterTitle}>可访问性</h2>
        <p className={css.chapterLead}>
          可访问性不是最后一层「检查项」，而是前面七章每一条规则的来源。这里把它变成可以逐项勾选的
          验收清单：对比度实时计算、键盘路径逐条写死、焦点环与触达尺寸都有下限。
        </p>
      </div>

      <Section
        title="对比度验收（运行时计算）"
        note="下表比值由本页从当前主题的真实令牌计算得出，切到深色会重新算。任何一项标红即视为缺陷，不是「可优化项」。"
      >
        <table className={css.tokenTable}>
          <thead>
            <tr>
              <th scope="col">组合</th>
              <th scope="col">前景</th>
              <th scope="col">背景</th>
              <th scope="col">比值</th>
              <th scope="col">阈值</th>
            </tr>
          </thead>
          <tbody>
            {RATIO_PAIRS.map(pair => (
              <tr key={`${pair.fg}-${pair.bg}`}>
                <td>{pair.label}</td>
                <td className={css.tokenName}>{pair.fg.replace('--pi-', '')}</td>
                <td className={css.tokenName}>{pair.bg.replace('--pi-', '')}</td>
                <td>
                  <RatioBadge value={ratioOf(values, pair.fg, pair.bg)} large={pair.large} />
                </td>
                <td className={css.caption}>{pair.large ? '≥ 3:1（非文字）' : '≥ 4.5:1'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="键盘路径" note="每一行都是一条必须手工验证的路径；只写「支持键盘」等于没写。">
        <table className={css.tokenTable}>
          <thead>
            <tr>
              <th scope="col">组件</th>
              <th scope="col">按键</th>
            </tr>
          </thead>
          <tbody>
            {KEYBOARD_PATHS.map(item => (
              <tr key={item.component}>
                <td className={css.tokenName}>{item.component}</td>
                <td>{item.keys}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="焦点">
        <div className={css.demoRow}>
          <div className={css.demoPane}>
            <PaneLabel>焦点环</PaneLabel>
            <div className={css.demoStack}>
              <span className={css.ringDemo}>
                <Button variant="primary">键盘聚焦我</Button>
              </span>
              <Button variant="secondary">次要按钮</Button>
            </div>
            <p className={css.caption}>
              2px 实线 + 2px 间隔，始终在元素外部；用 <span className={css.inlineMono}>:focus-visible</span>{' '}
              只在键盘操作时出现。
            </p>
          </div>
          <div className={css.demoPane}>
            <PaneLabel>触达尺寸</PaneLabel>
            <div className={css.demoStack}>
              <Button size="sm" icon="plus">
                24px
              </Button>
              <Button size="md" icon="plus">
                28px
              </Button>
              <Button size="lg" icon="plus">
                32px
              </Button>
            </div>
            <p className={css.caption}>可点区域下限 24×24（WCAG 2.5.8）；小于 24 必须用透明外扩补足。</p>
          </div>
        </div>
      </Section>

      <Section title="规则">
        <RuleList
          items={[
            { head: '正文与次要文字 ≥4.5:1，边框与图标 ≥3:1', why: 'AA 的硬门槛。低视力用户对 3.3:1 的灰字几乎不可读，而设计稿上它看起来「很精致」。' },
            { head: '状态不能只靠颜色', why: '红绿色盲约占男性 8%；成功/失败必须同时有图标或文字。' },
            { head: '焦点不可被裁、不可透明化', why: 'overflow: hidden 常常顺手裁掉焦点环，等于让键盘用户丢失位置。' },
            { head: '图标按钮必须有 aria-label', why: '读屏读到「按钮」而没有名字，等于不可用。' },
            { head: '动效尊重 reduced-motion', why: '前庭功能障碍是医学问题，不是审美偏好。' },
            { head: '不用 placeholder 当标签', why: '输入后标签就消失了，用户无法确认自己在填哪个字段。' },
          ]}
        />
      </Section>
    </div>
  )
}

/* ============================================================================
 * 第 9 章 · 组件速查
 * ========================================================================== */

/** 组件清单条目。 */
interface IndexEntry {
  name: string
  use: string
  tier: 'P0' | 'P1'
}

/** P0：本批已交付。 */
const COMPONENT_INDEX: readonly IndexEntry[] = [
  { name: 'Button', use: '触发动作；一个视图最多一个 primary', tier: 'P0' },
  { name: 'IconButton', use: '空间紧张的工具栏动作（必须带 label）', tier: 'P0' },
  { name: 'ButtonGroup', use: '强关联的并列动作', tier: 'P0' },
  { name: 'Input', use: '单行文本输入', tier: 'P0' },
  { name: 'Textarea', use: '多行文本、带字数统计', tier: 'P0' },
  { name: 'Select', use: '从固定选项中选一个', tier: 'P0' },
  { name: 'Checkbox', use: '多选 / 不确定态', tier: 'P0' },
  { name: 'Radio', use: '互斥选项（少于 5 个时优于 Select）', tier: 'P0' },
  { name: 'Switch', use: '立即生效的开关', tier: 'P0' },
  { name: 'Field', use: '标签 / 说明 / 错误的统一容器', tier: 'P0' },
  { name: 'Menu', use: '上下文动作列表', tier: 'P0' },
  { name: 'Popover', use: '任意锚定浮层', tier: 'P0' },
  { name: 'Tooltip', use: '补充说明，不承载必须信息', tier: 'P0' },
  { name: 'Dialog', use: '需要决策或填写的中断式任务', tier: 'P0' },
  { name: 'Toast', use: '非阻塞结果反馈', tier: 'P0' },
  { name: 'Tabs', use: '同层级内容切换（带 URL 状态时）', tier: 'P0' },
  { name: 'SegmentedControl', use: '2–4 个互斥视图切换', tier: 'P0' },
  { name: 'Avatar', use: '身份标识', tier: 'P0' },
  { name: 'Badge / Tag', use: '状态标记 / 可移除标签', tier: 'P0' },
  { name: 'Card', use: '把相关元素装成一个单元', tier: 'P0' },
  { name: 'Divider', use: '分隔（优先用间距，其次才是线）', tier: 'P0' },
  { name: 'NavItem / NavGroup', use: '侧栏导航项与分组', tier: 'P0' },
  { name: 'Kbd', use: '快捷键提示', tier: 'P0' },
  { name: 'Skeleton', use: '加载占位（保持布局不跳）', tier: 'P0' },
  { name: 'EmptyState', use: '空数据 / 无结果', tier: 'P0' },
  { name: 'Table', use: '多列数据对比', tier: 'P1' },
  { name: 'CommandPalette', use: '全键盘驱动的高频操作入口', tier: 'P1' },
  { name: 'Drawer', use: '侧向滑出的次级面板', tier: 'P1' },
  { name: 'Accordion', use: '长内容折叠', tier: 'P1' },
  { name: 'Progress', use: '确定性进度', tier: 'P1' },
]

/** 组件速查章。 */
function IndexChapter({ onOpenComponent }: { onOpenComponent?: ((name: string) => void) | undefined }) {
  const p0 = COMPONENT_INDEX.filter(entry => entry.tier === 'P0')
  const p1 = COMPONENT_INDEX.filter(entry => entry.tier === 'P1')
  return (
    <div className={css.chapter} data-chapter="index">
      <div className={css.chapterHead}>
        <span className={css.chapterIndex}>09</span>
        <h2 className={css.chapterTitle}>组件速查</h2>
        <p className={css.chapterLead}>
          P0 是本批完整交付的组件：每个都有状态矩阵、props 表、键盘路径与深浅双主题并排。
          P1 只登记不实现——先把高频路径做扎实，再扩面。
        </p>
      </div>

      <Section title={`P0 · ${p0.length} 个组件`} note="点击进入组件详情页。">
        <div className={css.indexGrid}>
          {p0.map(entry => (
            <button
              key={entry.name}
              type="button"
              className={css.indexCard}
              onClick={() => onOpenComponent?.(entry.name)}
              disabled={onOpenComponent === undefined}
            >
              <span className={css.indexCardName}>{entry.name}</span>
              <span className={css.indexCardUse}>{entry.use}</span>
              <span className={css.indexCardStatus}>
                <Badge tone="success" size="sm" dot>
                  已交付
                </Badge>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title={`P1 · ${p1.length} 个已登记`} note="接口设计已定，实现排后。">
        <div className={css.indexGrid}>
          {p1.map(entry => (
            <div key={entry.name} className={css.indexCard} style={{ cursor: 'default' }}>
              <span className={css.indexCardName}>{entry.name}</span>
              <span className={css.indexCardUse}>{entry.use}</span>
              <span className={css.indexCardStatus}>
                <Badge tone="neutral" size="sm">
                  已登记
                </Badge>
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

/* ============================================================================
 * 页面本体
 * ========================================================================== */

/** SpecPage props。 */
export interface SpecPageProps {
  /** 点击组件速查卡时跳转到组件页。 */
  onOpenComponent?: ((name: string) => void) | undefined
}

/**
 * 规范页：九章设计规范，所有数值运行时从令牌读取。
 *
 * 左侧目录跟随滚动高亮；点目录跳转对应章节。
 * @param props - 可选的组件跳转回调。
 * @returns 规范页。
 */
export const SpecPage = memo(function SpecPage({ onOpenComponent }: SpecPageProps) {
  const probeRef = useRef<HTMLDivElement | null>(null)
  const docRef = useRef<HTMLDivElement | null>(null)
  const values = useTokens(probeRef, TOKEN_NAMES)
  const [activeId, setActiveId] = useState('stance')
  const tokenExport = useTokenExport(docRef)

  /** 目录点击：滚到章节，并把焦点交给章节标题，方便读屏跟上。 */
  const goTo = useCallback((id: string) => {
    const doc = docRef.current
    const target = doc?.querySelector<HTMLElement>(`[data-chapter="${id}"]`)
    if (doc === null || doc === undefined || target === null || target === undefined) return
    doc.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' })
    setActiveId(id)
  }, [])

  /** 滚动时更新当前章节：取「顶部已越过的最后一个章节」。 */
  const onScroll = useCallback(() => {
    const doc = docRef.current
    if (doc === null || doc === undefined) return
    const top = doc.scrollTop + 24
    const current = doc.querySelectorAll<HTMLElement>('[data-chapter]')
    let next = 'stance'
    for (const element of current) {
      if (element.offsetTop <= top) next = element.dataset.chapter ?? next
    }
    setActiveId(previous => (previous === next ? previous : next))
  }, [])

  /** 首屏读一次，避免初始高亮错。 */
  useEffect(() => {
    onScroll()
  }, [onScroll])

  const chapters = useMemo(
    () => (
      <>
        <StanceChapter />
        <ColorChapter values={values} />
        <TypeChapter values={values} />
        <SpaceChapter values={values} />
        <ShapeChapter values={values} />
        <IconChapter />
        <MotionChapter />
        <A11yChapter values={values} />
        <IndexChapter onOpenComponent={onOpenComponent} />
      </>
    ),
    [values, onOpenComponent],
  )

  return (
    <div className={css.page}>
      <div ref={probeRef} className={css.probe} aria-hidden="true" />
      <nav className={css.toc} aria-label="规范目录">
        {CHAPTERS.map((chapter, index) => (
          <button
            key={chapter.id}
            type="button"
            className={css.tocItem}
            data-active={activeId === chapter.id || undefined}
            aria-current={activeId === chapter.id ? 'location' : undefined}
            onClick={() => goTo(chapter.id)}
          >
            <span className={css.tocIndex}>{String(index + 1).padStart(2, '0')}</span>
            <span>{chapter.title}</span>
          </button>
        ))}
      </nav>
      <div ref={docRef} className={css.doc} onScroll={onScroll}>
        <div className={css.docInner}>
          <header className={css.pageHead}>
            <h1 className={css.pageTitle}>Pi Design System</h1>
            <p className={css.pageLead}>
              pi agent 桌面客户端的设计系统。三层令牌 + CSS Modules，双主题同源，WCAG AA
              作为硬门槛而不是参考线。这一页是可执行的规范：数值来自运行时，改令牌页面就变。
            </p>
            <div className={css.pageMeta}>
              <Badge tone="accent" size="sm">
                v1.0
              </Badge>
              <Badge tone="neutral" size="sm">
                --pi-* 令牌
              </Badge>
              <Badge tone="neutral" size="sm">
                浅色 / 深色同源
              </Badge>
              <Badge tone="neutral" size="sm">
                运行时校验
              </Badge>
            </div>
            <div className={css.pageActions}>
              <Button size="sm" icon="copy" onClick={tokenExport.copyCurrent}>
                导出当前主题令牌
              </Button>
              <Button size="sm" icon="copy" onClick={tokenExport.copyAll}>
                导出浅色 + 深色
              </Button>
              {tokenExport.copiedLabel !== null && (
                <span className={css.pageActionsNote} role="status">
                  {tokenExport.copiedLabel}
                </span>
              )}
            </div>
          </header>
          {chapters}
        </div>
      </div>
    </div>
  )
})
